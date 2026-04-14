# Analytics Pipeline Setup — qrec

## Context

qrec is an OSS npm package with no existing analytics pipeline. The goal is a complete metrics → Supabase → GitHub Pages dashboard flow for 3 KPIs. All 3 data sources have been tracer-bulleted and confirmed working.

---

## Confirmed Metric Data (tracer bullet results)

| Metric | Key | Current value | Method |
|---|---|---|---|
| GitHub Stars | `github_stars` | 24 | REST `GET /repos/dvquy13/qrec` → `.stargazers_count` |
| npm downloads last week | `npm_downloads_last_week` | 190 | REST `GET api.npmjs.org/downloads/point/last-week/@dvquys%2Fqrec` → `.downloads` |
| GitHub unique cloners (14d) | `github_unique_cloners_14d` | 25 | REST `GET /repos/dvquy13/qrec/traffic/clones` → `.uniques` (requires token w/ repo scope) |
| GitHub unique page visitors (14d) | `github_unique_visitors_14d` | 16 | REST `GET /repos/dvquy13/qrec/traffic/views` → `.uniques` (same auth, same 14d window) |
| GitHub Sponsors lifetime | `github_sponsors_lifetime` | $0.00 | GraphQL `lifetimeReceivedSponsorshipValues(first: 100)` → sum `.amountInCents` / 100 |

**Stars + npm last-week**: JSON config files (no auth, public REST).

**GitHub unique cloners**: JSON config, auth `bearer $GITHUB_TOKEN`. Use `.uniques` not `.count` — `count` is inflated by CI/repeated clones from same user (April 7 showed 85 clones from 2 people). The `GITHUB_TOKEN` auto-injected by Actions has repo scope and works for traffic API. Data window is rolling 14 days — must poll daily to avoid gaps.

**Sponsors**: Custom standalone script (GraphQL). Token: the default `gh auth token` works (has `user` scope). No dedicated PAT needed for CI — use `GITHUB_TOKEN` (automatically injected by Actions) since it has the required `user` scope in the workflow. The query returns 0 nodes currently but will reflect future sponsors correctly; paginate with `pageInfo.hasNextPage` for safety.

Confirmed working GraphQL query:
```graphql
{ user(login: "dvquy13") {
    lifetimeReceivedSponsorshipValues(first: 100) {
      nodes { amountInCents formattedAmount }
      pageInfo { hasNextPage endCursor }
    }
    estimatedNextSponsorsPayoutInCents
    monthlyEstimatedSponsorsIncomeInCents
} }
```

---

## Files to Create/Modify

```
analytics/
  scripts/                              # copied from ~/.claude/skills/metric-extractor/scripts/
    fetch-metrics.py
    push-and-notify.py
    extract-cookies.py
    stamp-dashboard.py
  configs/
    github_stars.json                   # new
    npm_downloads_all_time.json         # new
  fixtures/
    github_stars.txt                    # captured from live run
    npm_downloads_all_time.txt          # captured from live run
  scripts/fetch-github-sponsors.py      # custom standalone script (new)
  alerts.yaml                           # new, from skill template + customized
  dashboard.html                        # new, from skill template + configured
supabase/migrations/
  20240101000000_create_metrics_snapshots.sql   # copied from skill
.github/workflows/
  fetch-metrics.yml                     # new
Makefile                                # new (project has no Makefile yet)
```

Modified:
- `.gitignore` — add `analytics/cookies/`, `analytics/secrets/`, `analytics/credentials/`, `supabase/.temp/`
- `CLAUDE.md` — add one-liner referencing `analytics/` and skill docs

---

## Implementation Plan

### Step 1: Bootstrap analytics directory

```bash
mkdir -p analytics/{scripts,configs,fixtures,cookies,secrets,credentials}
cp ~/.claude/skills/metric-extractor/scripts/* analytics/scripts/
cp ~/.claude/skills/metric-extractor/alerts.yaml analytics/alerts.yaml
cp ~/.claude/skills/metric-extractor/dashboard-template.html analytics/dashboard.html
mkdir -p supabase/migrations
cp ~/.claude/skills/metric-extractor/supabase/migrations/20240101000000_create_metrics_snapshots.sql supabase/migrations/
```

Register with skill consumers registry (python one-liner from skill SKILL.md).

### Step 2: Metric configs

**`analytics/configs/github_stars.json`**
```json
{
  "name": "github_stars",
  "url": "https://api.github.com/repos/dvquy13/qrec",
  "auth": { "type": "none" },
  "request": { "method": "GET", "headers": { "Accept": "application/vnd.github+json" } },
  "response": { "type": "json", "value_path": "stargazers_count" }
}
```

**`analytics/configs/npm_downloads_last_week.json`**
```json
{
  "name": "npm_downloads_last_week",
  "url": "https://api.npmjs.org/downloads/point/last-week/@dvquys%2Fqrec",
  "auth": { "type": "none" },
  "request": { "method": "GET" },
  "response": { "type": "json", "value_path": "downloads" }
}
```

**`analytics/configs/github_unique_cloners_14d.json`**
```json
{
  "name": "github_unique_cloners_14d",
  "url": "https://api.github.com/repos/dvquy13/qrec/traffic/clones",
  "auth": { "type": "api_key", "header": "Authorization", "value": "bearer ${GITHUB_TOKEN}" },
  "request": { "method": "GET", "headers": { "Accept": "application/vnd.github+json" } },
  "response": { "type": "json", "value_path": "uniques" }
}
```
Note: use `.uniques` not `.count`. GitHub retains only 14 days of traffic data — daily polling is required to avoid gaps.

**`analytics/configs/github_unique_visitors_14d.json`**
```json
{
  "name": "github_unique_visitors_14d",
  "url": "https://api.github.com/repos/dvquy13/qrec/traffic/views",
  "auth": { "type": "api_key", "header": "Authorization", "value": "bearer ${GITHUB_TOKEN}" },
  "request": { "method": "GET", "headers": { "Accept": "application/vnd.github+json" } },
  "response": { "type": "json", "value_path": "uniques" }
}
```

### Step 3: Custom sponsors script

`analytics/scripts/fetch-github-sponsors.py`:
- Auth: `GITHUB_TOKEN` env var (provided by Actions; locally use `gh auth token`)
- Query: confirmed above — `lifetimeReceivedSponsorshipValues(first: 100)` with pagination loop
- Output JSONL: `{"name": "github_sponsors_lifetime", "value": <float USD>, "status": "ok"}`
- Also emit `github_sponsors_next_payout` and `github_sponsors_monthly_est` as bonus metrics

### Step 4: Configure dashboard.html

Edit `CONFIG` block only:
```js
const CONFIG = {
  title: 'qrec metrics',
  supabase: { url: '__SUPABASE_URL__', key: '__SUPABASE_KEY__', table: 'metrics_snapshots' },
  snapshots: 30,
  aggUnit: 'day',
  sections: [{ title: 'Growth', keys: ['github_stars', 'npm_downloads_all_time', 'github_sponsors_lifetime'] }],
  metrics: {
    github_stars:            { label: 'GitHub Stars',          fmt: 'int',   period: 'live',     url: 'https://github.com/dvquy13/qrec' },
    npm_downloads_all_time:  { label: 'npm Downloads',         fmt: 'int',   period: 'all time' },
    github_sponsors_lifetime:{ label: 'Sponsors',              fmt: 'money', period: 'lifetime', url: 'https://github.com/sponsors/dvquy13' }
  }
};
```

`__SUPABASE_URL__` / `__SUPABASE_KEY__` replaced by `sed` in CI — never hardcode in main.

### Step 5: Configure alerts.yaml

```yaml
- type: daily_digest
  title: "qrec"
  labels:
    github_stars: "GitHub Stars"
    npm_downloads_all_time: "npm Downloads (all time)"
    github_sponsors_lifetime: "Sponsors (lifetime $)"
discord:
  webhook_url_env: DISCORD_WEBHOOK_URL
  dashboard_url: https://dvquy13.github.io/qrec/dashboard.html
```

### Step 6: GitHub Actions workflow

`.github/workflows/fetch-metrics.yml`:
- Trigger: `schedule: '13 0 * * *'` + `workflow_dispatch`
- Permissions: `contents: write` (for gh-pages push)
- Steps:
  1. Checkout
  2. Install `uv`
  3. `uv run analytics/scripts/fetch-metrics.py > /tmp/scalar.jsonl`
  4. `uv run analytics/scripts/fetch-github-sponsors.py >> /tmp/scalar.jsonl`
  5. Push to Supabase + Discord via `push-and-notify.py < /tmp/scalar.jsonl`
  6. Stamp gh-pages via worktree (sed creds + stamp-dashboard.py → push to gh-pages branch)
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DISCORD_WEBHOOK_URL` (optional)
- `GITHUB_TOKEN` auto-injected (needed for Sponsors GraphQL)

### Step 7: Makefile

```makefile
.PHONY: fetch-metrics

fetch-metrics:
	gh workflow run fetch-metrics.yml
	@sleep 3
	gh run watch $$(gh run list --workflow=fetch-metrics.yml --limit=1 --json databaseId -q '.[0].databaseId') --exit-status
```

### Step 8: Supabase setup (manual steps for user after code is in place)

```bash
supabase projects create qrec-metrics --org-id <org-id> --region ap-southeast-1 --db-password <password>
# wait ~2 min, then:
supabase link --project-ref <ref>
supabase db push
supabase projects api-keys --project-ref <ref>
```

GitHub Secrets to add:
| Secret | Value |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SUPABASE_ANON_KEY` | anon key |
| `DISCORD_WEBHOOK_URL` | webhook URL (optional) |

(`GITHUB_TOKEN` is auto-injected by Actions — no manual secret needed.)

---

## Verification

1. **Fixture test**: `cd analytics && uv run scripts/fetch-metrics.py --fixture --test`
2. **Live scalar test**: `cd analytics && uv run scripts/fetch-metrics.py --test`
3. **Sponsors script**: `GITHUB_TOKEN=$(gh auth token) uv run analytics/scripts/fetch-github-sponsors.py`
4. **Full local pipeline**: `cd analytics && export GITHUB_TOKEN=$(gh auth token) && uv run scripts/fetch-metrics.py | uv run scripts/push-and-notify.py`
5. **Dashboard local**: `cd analytics && python3 -m http.server 8080`
6. **CI dry-run**: `make fetch-metrics`
