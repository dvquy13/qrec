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

## Smoke test must use compiled CJS

`scripts/smoke-test.sh` must start the daemon via `bun run plugin/scripts/qrec.cjs`, **not** `bun run src/cli.ts`.

Bun source mode defines `import.meta.dir`, which takes the dev branch in `UI_DIR` resolution — the CJS `__dirname` path is never exercised. A bug where `join(__dirname, "..", "ui")` resolved to the wrong `plugin/ui/` directory went undetected for this reason.

Use `QREC_EMBED_PROVIDER=stub` so no model loads and the daemon is instantly ready for the full test flow.
