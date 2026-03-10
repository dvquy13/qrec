---
paths:
  - .github/**
  - plugin/scripts/smart-install.js
---

# CI Rules (.github/workflows/, plugin/scripts/smart-install.js)

## CI bootstrap strategy

`setup-bun` is NOT used. `smart-install.js` installs Bun as its first step, simulating a real new-user machine. After it runs, add `~/.bun/bin` to `$GITHUB_PATH` for subsequent steps.

**`smart-install.js` runs synchronously in CI** (`CI=true` env var detected). On a real user machine it spawns heavy work (bun install, model download, index) as a detached background process and returns immediately. In CI it must be synchronous because subsequent steps depend on `bun link` having run (which creates `~/.bun/bin/qrec`). If you ever see `qrec: command not found` in CI, check that `CI` env var is set in the step.

```yaml
- name: Test SessionStart hook (smart-install.js)
  run: |
    printf '{"session_id":"ci",...,"hook_event_name":"SessionStart"}' \
      | CLAUDE_PLUGIN_ROOT=${{ github.workspace }}/plugin \
        node plugin/scripts/smart-install.js

- name: Add Bun to PATH
  run: echo "$HOME/.bun/bin" >> $GITHUB_PATH
  # CI-only: bun.sh/install modifies ~/.zshrc but that doesn't affect the running job.
  # Real users get ~/.bun/bin in PATH on next shell open.
```

## Hook testing without Claude Code

Pipe the event JSON to the hook script's stdin — no API key, no Claude Code session:

```bash
printf '{"session_id":"ci","transcript_path":"/tmp/t","cwd":"/tmp","permission_mode":"ask","hook_event_name":"SessionStart"}' \
  | CLAUDE_PLUGIN_ROOT=./plugin node plugin/scripts/smart-install.js
```

Exit code 0 = approved, 2 = blocked. Official Anthropic pattern from `anthropics/claude-code` repo.

## Embed provider in CI

Set `QREC_EMBED_PROVIDER: stub` on steps that need fast startup (MCP test). The real model is downloaded + cached by the `smart-install.js` step and used for `serve + search` integration test.

**`qrec serve --daemon` is fire-and-fork** — it exits immediately (bun-runner.js spawns bun detached). Always poll `/health` with retry before running curl assertions:

```bash
qrec serve --daemon
for i in $(seq 1 15); do
  curl -sf http://localhost:3030/health && break
  sleep 1
done
```

For serve+search with real model: server binds immediately but model loads in background. Poll `/search` until 200 before asserting:

```bash
for i in $(seq 1 24); do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3030/search \
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

Key suffix `-v2` was added to bust a corrupt cache entry caused by the redirect bug in `downloadFile()`. Do not revert to `-v1` or un-suffixed.

## bun-runner.js regression test ordering

Any CI step that invokes `bun-runner.js serve --daemon` (regression tests, etc.) must run **after** the integration test that ends with `qrec stop`. Placing it before causes an orphan-daemon race: bun-runner exits immediately (fire-and-fork), `qrec stop` runs before the PID file is written, stop does nothing, the orphan daemon persists, and the integration test sees "already running" — it skips the health poll and curl immediately fails (exit code 7).

## `downloadFile` redirect handling

When following HTTP 301/302, do NOT call `file.close()` before the recursive `doRequest()`. The write stream is shared across redirect hops — closing it causes the downloaded bytes to be written to a closed stream, producing a corrupt/empty file. Use `res.resume()` to drain the redirect response body instead:

```js
if (res.statusCode === 301 || res.statusCode === 302) {
  res.resume(); // drain redirect body — keep file stream open
  doRequest(res.headers.location);
  return;
}
```

## `timeout` not available on macOS runners

`timeout` is GNU coreutils — not in PATH on `macos-latest`. Do not use it in workflow steps.

## node_modules cache key

Keyed on `bun.lock`. Place the cache step **before** `bun install`.
