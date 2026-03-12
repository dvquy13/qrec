---
paths:
  - .github/**
---

# CI Rules (.github/workflows/)

## CI bootstrap strategy

`setup-bun` installs bun. Dependencies via `bun install --frozen-lockfile`. Then `bun link` registers the `qrec` CLI globally.

Integration test uses `qrec onboard --no-open` to load model + index fixtures + start daemon in one step.

## Embed provider in CI

Set `QREC_EMBED_PROVIDER: stub` on steps that need fast startup (MCP round-trip test). The real model is downloaded + cached by the integration test step.

**`qrec onboard --no-open`** starts the daemon (fire-and-fork internally), then polls `/status` until `phase=ready`. Server binds immediately; model loads async. After onboard returns, server is fully ready.

For direct `qrec serve --daemon` usage (if needed): it exits immediately. Poll `/search` for 200 before asserting — `/health` is always 200 but search needs the model loaded:

```bash
for i in $(seq 1 24); do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:25927/search \
    -H 'Content-Type: application/json' -d '{"query":"test","k":3}')
  [ "$status" = "200" ] && break
  sleep 5
done
```

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
