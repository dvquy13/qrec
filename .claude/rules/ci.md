---
paths:
  - .github/**
---

# CI Rules (.github/workflows/)

## CI bootstrap strategy

`setup-bun` installs bun. Dependencies via `bun install --frozen-lockfile`. Then `bun link` registers the `qrec` CLI globally.

Integration test uses `qrec serve --daemon --no-open` to start daemon, then polls `/search` for 200 before asserting.

## Embed provider in CI

Set `QREC_EMBED_PROVIDER: stub` on steps that need fast startup (MCP round-trip test). The real model is downloaded + cached by the integration test step.

**`qrec serve --daemon --no-open`** exits immediately (fire-and-fork). Poll `/search` for 200 before asserting — `/health` is always 200 but search needs the model loaded:

```bash
for i in $(seq 1 24); do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:25927/search \
    -H 'Content-Type: application/json' -d '{"query":"test","k":3}' || echo "000")
  [ "$status" = "200" ] && break
  sleep 5
done
```

**`|| echo "000"` is required** — with `set -e`, `status=$(curl ...)` propagates curl exit code 7 (ECONNREFUSED) when the daemon isn't bound yet, killing the script before any retry. The `|| echo "000"` ensures the subshell always exits 0.

## CI assertion strength

Always use `jq -e '.results | length > 0'` not `jq '.results | length'`. Error JSON responses (e.g. 503 body `{"error":"..."}`) have `.results = null`, and `null | length = 0` in jq which exits 0 — the test passes vacuously.

## Model cache

```yaml
- name: Cache embedding model
  uses: actions/cache@v4
  with:
    path: ~/.qrec/models/
    key: embeddinggemma-300M-Q8_0-v2
```

Key suffix `-v2` was added to bust a corrupt cache entry. Do not revert to `-v1` or un-suffixed.

## `timeout` not available on macOS runners

`timeout` is GNU coreutils — not in PATH on `macos-latest`. Do not use it in workflow steps.

## node_modules cache key

Keyed on `bun.lock`. Place the cache step **before** `bun install`.

## analytics/ pipeline

**Supabase:** reuses `dvquys-metrics` project (ref `olssvguaeagsmkfmsvvo`, Singapore). Table `metrics_snapshots` is shared with dvquys.com — metric keys are namespaced by name, no collision risk.

**GitHub secrets set:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `DISCORD_WEBHOOK_URL`, `GH_PAT_TRAFFIC`. The last one is a classic PAT with `repo` scope — required because `GITHUB_TOKEN` with `permissions: contents: write` loses traffic API access (see metric-extractor providers/github/gotchas.md).

**Schedule:** `13 20 * * *` UTC = 03:13 GMT+7.

**Merge step:** `fetch-metrics.py` emits a single JSON blob; `fetch-github-sponsors.py` emits JSONL. A Python inline merges them into `/tmp/merged.json` before piping to `push-and-notify.py`. See workflow step "Merge metrics into single snapshot".

**Discord:** `#qrec` channel in Icewrack server (ID `1493639465758101667`), webhook ID `1493639479922000032`. Bot API listing returns `"embeds": []` for webhook messages — this is a Discord quirk, not a failure. Verify via `GET /webhooks/{id}/{token}/messages/{msgId}` or send with `?wait=true`.

## Creating a gh-pages branch

Do NOT create the gh-pages orphan branch locally — the pre-commit `tsc` hook fires on any commit attempt, including orphan branches with no tsconfig.json. Create the branch via GitHub API instead:

```bash
MAIN_SHA=$(gh api repos/{owner}/{repo}/git/ref/heads/main --jq '.object.sha')
gh api repos/{owner}/{repo}/git/refs \
  --method POST \
  --field ref="refs/heads/gh-pages" \
  --field sha="$MAIN_SHA"
```

The CI stamp step then writes `dashboard.html` onto it on first run.

## Smoke test must use compiled CJS

`scripts/smoke-test.sh` must start the daemon via `bun run plugin/scripts/qrec.cjs`, **not** `bun run src/cli.ts`.

Bun source mode defines `import.meta.dir`, which takes the dev branch in `UI_DIR` resolution — the CJS `__dirname` path is never exercised. A bug where `join(__dirname, "..", "ui")` resolved to the wrong `plugin/ui/` directory went undetected for this reason.

Use `QREC_EMBED_PROVIDER=stub` so no model loads and the daemon is instantly ready for the full test flow.
