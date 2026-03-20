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

This: syncs versions → rebuilds `qrec.cjs` → CHANGELOG → commit → tag → push → GitHub release → npm publish.

**Run `npm run check-package` before releasing.** It packs a dry-run tarball and asserts every file under `ui/` and `plugin/` is present. Uses `find` (not a hardcoded list), so new files are caught automatically without updating the test.

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

## npm package layout

`ui/` lives at the **package root** (not `plugin/ui/`). The compiled `qrec.cjs` resolves static assets via `join(__dirname, "..", "..", "ui")` — two levels up from `plugin/scripts/`. One `..` would land in `plugin/ui/` (wrong).

The `package.json` `files` array must include both `"ui"` and the individual `plugin/` subdirs. `"plugin"` alone is not listed as a top-level entry because only specific subdirs are included (scripts, hooks, skills, .claude-plugin).

**Plugin marketplace copies only `plugin/`** — `"source": "./plugin"` in `.claude-plugin/marketplace.json` means Claude Code copies only that subdir to `~/.claude/plugins/cache/`. The CLI (`qrec`) comes from `npm install -g`; hooks/skills/MCP come from the plugin cache. They are separate installs.

## Bun install ownership

`plugin/scripts/postinstall.js` runs during `npm install -g` and installs bun if missing (calls `installBun()` from `bun-finder.js`). It exits **1 on failure** so the npm install itself fails — qrec is never left in a half-ready state.

`plugin/scripts/qrec-cli.js` only *locates* bun (`findBun() || "bun"`). It no longer installs bun — that's postinstall's job. If bun disappears after install, spawn fails with a natural OS error.

## qrec-cli.js: npm bin entry

`plugin/scripts/qrec-cli.js` is the npm `bin` entry for the `qrec` CLI. It locates bun and spawns `bun run qrec.cjs <args>` directly — bun-runner.js was deleted and its spawn logic is now inlined here.

**`serve --daemon` is fire-and-fork** — qrec-cli.js detects `args.includes("serve") && args.includes("--daemon")` and spawns bun detached + unrefs + exits 0 immediately. The daemon starts in the background.

**Consequence**: `qrec serve --daemon` returns before the server is bound. Any caller (CI, scripts) that needs the server ready must poll `/health` with retry.

**`bun link`** symlinks `~/.bun/bin/qrec` directly to `src/cli.ts` (not qrec-cli.js). So in dev mode `qrec` runs TypeScript natively via bun, and `qrec --version` shows `(dev)` — `__QREC_VERSION__` is a build-time constant only injected in the compiled `.cjs`.

All other commands (stdin pipe mode for `qrec index`, etc.) buffer stdin before spawning bun to avoid Linux libuv pipe crashes.

## npm publish gotchas

Package name is **`@dvquys/qrec`** (scoped). Three things that will bite you:

**`--access public` is required** — scoped packages default to private on npm. `release.sh` already includes this; don't remove it.

**Granular token scope** — a token scoped to `@dvquys` covers `@dvquys/*` packages only. It will NOT work for unscoped packages. `@dvquys/qrec` is covered; a plain `qrec` package would not be.

**Auth method** — `npm publish --_authToken=<token>` silently fails. Use the env var form:
```bash
NPM_TOKEN=<token> npm publish --access public
```
Or set in `~/.npmrc`: `//registry.npmjs.org/:_authToken=<token>`

## Plugin recall: CLI-based (`qrec search` / `qrec get`)

The recall skill uses `Bash` with `qrec search` and `qrec get` shell commands — no MCP server needed. Both commands proxy to the daemon over HTTP at `localhost:25927`.

**`--no-open` in hooks.json** — `qrec serve --daemon --no-open` prevents the browser from auto-opening on every `SessionStart` hook fire. Always keep `--no-open` in the hook command.

## Plugin skills: disable-model-invocation

`disable-model-invocation: true` in a skill's frontmatter **hides the skill from Claude entirely** — the skill description is not loaded into context and Claude cannot auto-invoke it. Only the user can trigger it manually with `/skill-name`.

Use it only for skills with destructive side effects (deploy, teardown). For informational skills like `qrec`, omit the flag so Claude can proactively invoke it when relevant issues arise.
