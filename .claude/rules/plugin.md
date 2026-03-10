---
paths:
  - plugin/**
  - scripts/release.sh
  - scripts/sync-plugin-version.mjs
---

# Plugin Distribution Rules

## Release flow

```bash
bash scripts/release.sh <version>
```

This: syncs versions → rebuilds `qrec.cjs` + copies UI → CHANGELOG → commit → tag → push → GitHub release → npm publish.

**`plugin/ui/` must be committed to git.** It was previously in `.gitignore` (caused localhost:3030 to return 404 on all installs). It's now intentionally tracked. Do not add it back to `.gitignore`.

**`plugin/ui/` must be in the `git add` in `release.sh`** — the build step regenerates it from `ui/`, and it must be staged in the release commit.

## Version sync

`scripts/sync-plugin-version.mjs` updates **three places**:
1. `package.json` (root)
2. `.claude-plugin/marketplace.json` — top-level `version` AND `plugins[].version`
3. `plugin/.claude-plugin/plugin.json`

If `plugins[].version` in marketplace.json drifts from the top-level version, Claude Code may install the wrong version. The script handles both; don't edit version numbers manually.

## HuggingFace model URI

Always use the **full three-part URI**: `hf:<user>/<repo>/<filename>`

```
✓  hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf
✗  hf:ggml-org/embeddinggemma-300M-Q8_0   ← 401 Unauthorized, no useful error
```

The short form hits the HF manifest API which requires auth. The full form resolves directly.

## bun-runner.js: routing and fire-and-fork

`plugin/qrec-cli.js` (the `bin` entry for the `qrec` CLI) splices `run qrec.cjs` into `process.argv` and then `require('./bun-runner.js')`. This means **every `qrec` command** — not just hooks — is routed through `bun-runner.js`. Changes to bun-runner.js affect all `qrec` invocations.

**`serve --daemon` is fire-and-fork** — bun-runner.js detects `args.includes("serve") && args.includes("--daemon")` and spawns bun detached + unrefs + exits 0 immediately, without touching stdin. The daemon starts in the background.

**Consequence**: `qrec serve --daemon` returns before the server is bound. Any caller (CI, scripts) that needs the server ready must poll `/health` with retry — it cannot assume readiness after `qrec serve --daemon` returns.

All other commands (`mcp`, `index-session`, etc.) still use the stdin-buffering path (buffers stdin, waits for EOF, then spawnSync).

## smart-install.js: background mode

On first run (missing or stale `.install-version` marker), `smart-install.js` **detaches the heavy work** (bun install + model download + initial index) as a background process and exits immediately — so the Claude Code hook returns fast and doesn't block the session.

**`CI=true` forces synchronous mode** — CI steps are sequential; the background process would race with later steps (especially `bun link` → `qrec` CLI availability). If `CI` env var is `true` or `1`, smart-install runs everything synchronously.

The server handles the race gracefully: it retries embedder loading up to 10× (30s apart) and self-heals once background install completes.

## Plugin skills: disable-model-invocation

`disable-model-invocation: true` in a skill's frontmatter **hides the skill from Claude entirely** — the skill description is not loaded into context and Claude cannot auto-invoke it. Only the user can trigger it manually with `/skill-name`.

Use it only for skills with destructive side effects (deploy, teardown). For informational skills like `qrec`, omit the flag so Claude can proactively invoke it when relevant issues arise.
