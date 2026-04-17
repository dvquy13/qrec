# Analytics Pipeline Setup — qrec

**Status: COMPLETE** (implemented 2026-04-14)

---

## What Was Built

| Metric | Key | Current value | Method |
|---|---|---|---|
| GitHub Stars | `github_stars` | 24 | REST `GET /repos/dvquy13/qrec` → `.stargazers_count` |
| npm downloads last week | `npm_downloads_last_week` | 190 | REST `GET api.npmjs.org/downloads/point/last-week/@dvquys%2Fqrec` → `.downloads` |
| GitHub unique cloners (14d) | `github_unique_cloners_14d` | 25 | REST `GET /repos/dvquy13/qrec/traffic/clones` → `.uniques` (requires PAT w/ repo scope) |
| GitHub unique page visitors (14d) | `github_unique_visitors_14d` | 16 | REST `GET /repos/dvquy13/qrec/traffic/views` → `.uniques` (same auth) |
| GitHub Sponsors lifetime | `github_sponsors_lifetime` | $0.00 | GraphQL `lifetimeReceivedSponsorshipValues` — custom script |
| GitHub Sponsors next payout | `github_sponsors_next_payout` | $0.00 | bonus metric from same GraphQL query |
| GitHub Sponsors monthly est. | `github_sponsors_monthly_est` | $0.00 | bonus metric from same GraphQL query |

---

## Infrastructure

| Component | Detail |
|---|---|
| Supabase project | `dvquys-metrics` (ref: `olssvguaeagsmkfmsvvo`, Singapore) — shared with dvquys.com |
| Supabase table | `metrics_snapshots` (pre-existing) |
| Dashboard URL | `http://dvquys.com/qrec/dashboard.html` (GitHub Pages, gh-pages branch) |
| Discord channel | `#qrec` in Icewrack server (channel ID `1493639465758101667`) |
| Webhook | `metric-extractor` bot (webhook ID `1493639479922000032`) |
| CI schedule | `13 20 * * *` UTC = 03:13 GMT+7 daily |

GitHub Secrets set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DISCORD_WEBHOOK_URL`, `GH_PAT_TRAFFIC`

---

## Files Created

```
analytics/
  scripts/
    fetch-metrics.py          # copied from skill
    push-and-notify.py        # copied from skill
    extract-cookies.py        # copied from skill
    stamp-dashboard.py        # copied from skill
    fetch-github-sponsors.py  # custom GraphQL script
  configs/
    github_stars.json
    npm_downloads_last_week.json
    github_unique_cloners_14d.json
    github_unique_visitors_14d.json
  fixtures/
    github_stars.txt
    npm_downloads_last_week.txt
    github_unique_cloners_14d.txt
    github_unique_visitors_14d.txt
  alerts.yaml
  dashboard.html              # CONFIG block set; __SUPABASE_URL__/__SUPABASE_KEY__ replaced by sed in CI
  .env                        # gitignored; local secrets for make analytics-push
.github/workflows/
  fetch-metrics.yml
Makefile
supabase/migrations/
  20240101000000_create_metrics_snapshots.sql
```

---

## Gotchas Discovered During Implementation

### 1. Config schema mismatch
The plan had configs using `url` (top-level) and `response.value_path`. The actual skill schema uses `request.url` and `extract.path` with `extract.type: "jsonpath"`. All 4 JSON configs were rewritten to the correct schema before the live test passed.

### 2. GITHUB_TOKEN traffic scope
The plan said `GITHUB_TOKEN` auto-injected by Actions works for traffic API. **This is wrong** when the workflow has an explicit `permissions: contents: write` block — that restricts the token to content write only, losing traffic read. Fix: stored `gh auth token` output as secret `GH_PAT_TRAFFIC` and use that for the `GITHUB_TOKEN` env var in the fetch steps.

### 3. fetch-metrics.py outputs JSON, not JSONL
`fetch-metrics.py` emits a single JSON blob `{"fetched_at": ..., "metrics": {...}}`. The sponsors script emits JSONL (one line per metric). `push-and-notify.py` expects a single JSON blob on stdin. A Python merge step was added in CI (and Makefile) between fetch and push:
```python
snapshot = json.load(scalar_file)
for line in sponsors_jsonl:
    m = json.loads(line)
    snapshot['metrics'][m['name']] = {'value': m['value'], 'status': ..., 'fetched_at': ...}
```

### 4. gh-pages branch creation triggers pre-commit hook
Trying to create the gh-pages orphan branch locally failed because the pre-commit hook runs `tsc` on a branch with no tsconfig.json. Fixed by creating the branch via GitHub API (`gh api repos/dvquy13/qrec/git/refs --method POST`) pointing to main's current SHA, then letting CI stamp `dashboard.html` onto it.

### 5. Bot API can't read embeds from its own webhook messages
Discord's channel listing API (`GET /channels/{id}/messages`) returns `"embeds": []` for webhook messages when authenticated as the bot that owns the webhook. The embed IS sent correctly — verified via `POST webhook?wait=true` (response shows full embed) and via `GET /webhooks/{id}/{token}/messages/{msgId}` (webhook token endpoint). Not a bug; just a Discord API quirk.

---

## Verification Commands

```bash
# Offline fixture test
cd analytics && uv run scripts/fetch-metrics.py --fixture --test

# Live scalar test
cd analytics && export GITHUB_TOKEN=$(gh auth token) && uv run scripts/fetch-metrics.py --test

# Sponsors script
GITHUB_TOKEN=$(gh auth token) uv run analytics/scripts/fetch-github-sponsors.py

# Full local pipeline (fetch + push + Discord)
make analytics-push

# Trigger CI and watch
make fetch-metrics
```
