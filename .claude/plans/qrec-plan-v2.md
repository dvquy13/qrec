# qrec — Session Recall Engine

> Last updated: 2026-03-09

---

## The Problem

Claude Code stores every session as a JSONL file. When a developer starts a new session, they
often need to recall what they did in a past one — which library fixed the issue, which config
worked, which gotcha they already debugged. Today that knowledge is unreachable.

qrec replaces QMD's per-invocation CLI model loading (~2600ms cold start) with a persistent
daemon that keeps the embedding model resident (~55ms warm query). Sessions are indexed directly
from `~/.claude/projects/*/*.jsonl` — no markdown vault, no dependency on auto-recall-cc.

---

## Metrics

Four metrics, all measured at k=10:

| Metric | Target | Phase 1 Result |
|---|---|---|
| **Found@10** | ≥ 90% | **91.7%** ✅ |
| **NDCG@10** | ≥ 0.75 | **0.8497** ✅ |
| **Latency p50** | < 100ms | **18ms** ✅ |
| **Latency p95** | < 300ms | **46ms** ✅ |
| **RSS startup** | < 500MB | 627 MB ⚠️ (acceptable — inherent to keeping model resident) |

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp 3.15.1 (`embeddinggemma-300M-Q8_0`, cached at `~/.cache/qmd/models/`) |
| MCP server | `@modelcontextprotocol/sdk` |

---

## Search Pipeline

```
POST /search {query, k}
  ├─ Sanitize query (strip to [a-zA-Z0-9\s'-])
  ├─ BM25 (FTS5, ~1ms)                → top k*5 chunk rows
  ├─ Check query_cache (SHA-256 hash)
  │   hit  → skip embed   miss → embed(query ~50ms) → cache
  ├─ cosine KNN (sqlite-vec, ~4ms)    → top k*5 chunk rows
  ├─ RRF fusion (k=60): score = Σ 1/(60 + rank)
  ├─ Aggregate to session: MAX chunk score per session
  └─ Top-k sessions → metadata + best chunk preview → return
```

---

## Build Sequence

```
Phase 0: Eval set       Generate labeled query set from vault         ✅ DONE (2026-03-08)
Phase 1: qrec-eval      Minimal engine + Python eval pipeline         ✅ DONE (2026-03-08)
Phase 2: qrec v1        MCP, Web UI, audit, custom embed backends     ✅ DONE (2026-03-09)
Phase 4: JSONL-native   Parser + SessionEnd hook (absorbs arc)        ✅ DONE (2026-03-09)
Phase 5: CI/CD          GitHub repo, CI workflow, Linux db fix        ← NEXT
M6: Distribution        Marketplace plugin, npm publish, smoke test   ← after Phase 5
```

---

## Phase 0 ✅ — Eval Set Generation (2026-03-08)

**Result**: `eval/data/eval_set.json` — 104 queries, 22 sessions, avg 4.7 queries/session.
Style mix: 43 keyword-soup, 28 full-question, 25 short-concept, 8 action-phrase.
Config fingerprint: `05cf7fa587004c9e` (v2 prompts, haiku-4-5).

**Run command**: `CLAUDECODE="" uv run eval/pipeline.py --generate-only --config eval/configs/<name>.yaml`

---

## Phase 1 ✅ — Minimal Engine + Eval Pipeline (2026-03-08)

All quality and latency targets met. Error pattern: 2/24 misses, both COMPETING_SESSIONS
(short sessions outscored by larger sessions on overlapping topics).

Results: `eval/data/results/results_phase1_raw_s30_seed99_2026-03-08T15-06-53.json/.html`

**Key bugs fixed during Phase 1:**
- node-llama-cpp 3.17.1 segfaults on exit under Bun 1.3.10 → pinned to 3.15.1
- Missing `disposeEmbedder()` → Bun hangs forever after indexing
- `contextSize` not set → "Input too long" on dense code chunks → set to 8192
- `Bun.file().toString()` returns `"[object Promise]"` → use `await .text()`
- FTS5 syntax error on `.`, `/` silently drops BM25 → sanitize query to `[a-zA-Z0-9\s'-]`
- Session score aggregation SUM inflates verbose sessions → fixed to MAX

**Eval pipeline** (Python-native, replaced original TypeScript runner):
- `eval/pipeline.py` — orchestrator: query gen → index → serve → eval → JSON + HTML report
- `eval/qrec_eval.py` — HTTP eval loop, metrics, error analysis
- `eval/report.py` — self-contained HTML report
- `eval/configs/*.yaml` — reproducible run configs
- `scripts/reset.sh` — clean-state reset (wipes `~/.qrec/`, keeps model + query cache)

**Run command**: `CLAUDECODE="" uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml`

---

## Phase 2 ✅ — qrec v1 (2026-03-09)

**Delivered:**
- `src/mcp.ts` — MCP server (stdio + HTTP on 3031), tools: search / get / status
- `src/audit.ts` — append-only audit log to `query_audit` table
- `src/embed/factory.ts`, `ollama.ts`, `openai.ts` — pluggable embed backends (`QREC_EMBED_PROVIDER`)
- `ui/search.html`, `ui/audit.html` — served at GET / and GET /audit
- `plugin/` — plugin structure (hooks, skills, smart-install.js, bun-runner.js, qrec.cjs)
- `scripts/build.js`, `smoke-test.sh`, `sync-plugin-version.mjs`
- `.release-it.json`, `.github/workflows/pr-title.yml`, `.claude-plugin/marketplace.json`

**MCP tools:**
```
search(query, k?)  →  top-k sessions with scores, chunk previews, latency breakdown
get(session_id)    →  full session markdown by short ID
status()           →  { health, session_count, chunk_count, last_indexed, model_loaded, daemon_pid, log_tail }
```

---

## Phase 4 ✅ — JSONL-Native Ingestion (2026-03-09)

**Delivered:**
- `src/parser.ts` — JSONL parser: `parseSession`, `renderMarkdown`, `extractChunkText`; strips XML tags, skips meta/sidechain/system lines, summarizes tool_use blocks
- `src/indexer.ts` — detects JSONL vs `.md` source; single-file mode for SessionEnd hook; default path `~/.claude/projects/`; min 2-user-turn filter
- `src/cli.ts` — `index-session` command (path arg or stdin JSON payload); `index` default path `~/.claude/projects/`
- `src/mcp.ts` — `get()` renders clean markdown via `renderMarkdown()` for JSONL sessions
- `plugin/hooks/hooks.json` — `SessionEnd` hook added → `index-session`

**Exit gate results:**
- Single-file index: `index-session ~/.claude/.../session.jsonl` → 1 session, 8 chunks ✅
- Stdin hook mode: JSON payload on stdin → extracts `transcript_path`, indexes ✅
- Full vault: `index ~/.claude/projects/` → 552 files found, 152 indexed (≥2 user turns), 400 skipped ✅
- Incremental: second run → 151 up-to-date skipped, 1 new session indexed ✅
- `get()` renders clean human-readable markdown from JSONL (not raw bytes) ✅

**Goal**: Index sessions directly from `~/.claude/projects/*/*.jsonl`. No markdown vault required.
Rendered clean markdown produced on demand by `get()` and the web UI.

### Architecture change

```
Before (Phase 1-2):
  ~/vault/sessions/*.md  ──►  indexer.ts  ──►  SQLite

After (Phase 4):
  ~/.claude/projects/*/*.jsonl  ──►  parser.ts  ──►  indexer.ts  ──►  SQLite
                                                              get() renders on demand
```

The `sessions.path` column already stores the source file path — it now points to the `.jsonl`
file. `sessions.title` is derived from the first user message. No other schema changes needed.

### New / changed files

```
src/
  parser.ts       # NEW: JSONL → ParsedSession (metadata + clean turns)
  indexer.ts      # CHANGED: scan *.jsonl instead of *.md; call parser.ts
  mcp.ts          # CHANGED: get() renders via parser instead of reading .md
  cli.ts          # CHANGED: default index path → ~/.claude/projects/; add index-session command
plugin/
  hooks/
    hooks.json    # CHANGED: add SessionEnd hook → qrec index-session (reads stdin)
```

### `src/parser.ts`

```typescript
export interface ParsedSession {
  session_id: string;    // 8-char hex prefix of UUID
  path: string;          // absolute path to .jsonl file
  project: string;       // basename of cwd
  date: string;          // YYYY-MM-DD from first message timestamp
  title: string | null;  // first user message text, truncated to 120 chars
  hash: string;          // MD5 of file contents (for change detection)
  turns: Turn[];
}

export interface Turn {
  role: "user" | "assistant";
  text: string;          // clean extracted text
  tools: string[];       // ["Bash: `ls /foo`", "Read: `/path/to/file`"]
  timestamp: string | null;
}

export function parseSession(jsonlPath: string): Promise<ParsedSession>
export function renderMarkdown(session: ParsedSession): string   // for get() display
export function extractChunkText(session: ParsedSession): string // for FTS5 + embedding
```

**JSONL line types and handling:**

| Line type | Handling |
|---|---|
| `user` with text content | Extract as user turn; set metadata from first occurrence |
| `user` with `tool_result` content | Skip (noise — raw tool output captured in assistant turn) |
| `assistant` with text blocks | Extract text; skip `thinking` blocks |
| `assistant` with `tool_use` blocks | Summarize as `[Tool: name(truncated_input)]` |
| `system`, `progress`, `file-history-snapshot` | Skip entirely |

**Session ID**: Extract UUID from the JSONL filename (`{uuid}.jsonl`), take first 8 hex chars.

**Title**: First user message text content, stripped of whitespace, truncated at 120 chars.
If the first user message is a `tool_result`, scan forward for the first real text message.

**Hash**: MD5 of the raw file bytes. Stored in `sessions.hash`; re-index skips sessions where hash matches.

**Minimum session filter**: Skip sessions with fewer than 2 user text turns. Configurable via `--min-turns` flag.

**renderMarkdown()** produces clean human-readable output for `get()`:
```markdown
# Session: {project} — {date}

_{title}_

## User
{text}

## Assistant
{text}

> **Tool:** Bash: `ls /foo`
> **Tool:** Read: `/path/to/file`

## User
...
```

**extractChunkText()** concatenates all turns into a single text block for the chunker:
```
[User] {text}
[Tool] Bash: `ls /foo`
[Assistant] {text}
```

This feeds into the existing `chunk.ts` (unchanged) for heading-aware splitting.

### `indexer.ts` changes

```typescript
// New signature (backwards compatible)
indexVault(db, embedder, sourcePath, opts)
// sourcePath can be:
//   ~/.claude/projects/          → scans all *.jsonl recursively
//   ~/.claude/projects/foo/bar.jsonl  → indexes single file (used by SessionEnd hook)
//   ~/vault/sessions/            → still works (scans *.md, legacy path)
```

The indexer detects source type by extension:
- `.jsonl` → parse via `parser.ts`, chunk, embed, upsert
- `.md`    → read raw text, chunk, embed, upsert (legacy path, kept for migration)

### SessionEnd hook

The SessionEnd hook receives a JSON payload on stdin from Claude Code:

```json
{ "transcript_path": "/Users/dvq/.claude/projects/-Users-.../abc123.jsonl", "session_id": "...", "cwd": "..." }
```

`hooks.json` is updated to add a `SessionEnd` entry:

```json
{
  "hooks": {
    "SessionStart": [ ...existing... ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PLUGIN_ROOT/scripts/bun-runner.js\" \"$CLAUDE_PLUGIN_ROOT/scripts/qrec.cjs\" index-session",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

New `index-session` CLI command reads the hook JSON from stdin, extracts `transcript_path`,
calls `indexVault(db, embedder, transcriptPath)` for that single file, then exits cleanly
(dispose embedder, close db). Should complete in <10s on warm model or ~35s cold.

### Phase 4 milestones

| Milestone | Scope | Est. |
|---|---|---|
| **M7 — Parser** | `src/parser.ts`: parseSession, renderMarkdown, extractChunkText | 1 day |
| **M8 — Indexer update** | Scan `.jsonl`, single-file mode, legacy `.md` path kept | 0.5 days |
| **M9 — SessionEnd hook** | `index-session` CLI command + hooks.json update | 0.5 days |

### Phase 4 exit gate

```bash
# Single-session index from JSONL
bun run src/cli.ts index-session < /path/to/session.jsonl
# → should index 1 session, N chunks

# Full vault index from ~/.claude/projects/
bun run src/cli.ts index ~/.claude/projects/

# get() renders clean markdown
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get","arguments":{"session_id":"<id>"}},"id":1}' \
  | bun run src/cli.ts mcp --http
# → returns readable markdown, not raw JSONL

# Eval pipeline still passes (re-run against JSONL-indexed vault)
CLAUDECODE="" uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml
# → Found@10 ≥ 90%, NDCG@10 ≥ 0.75 (quality must not regress from parser changes)
```

---

## Phase 5 ← NEXT — CI/CD (after Phase 4)

**Goal**: Automated build + integration test on every push. Full pipeline tested against real
JSONL fixtures (no mocks). GitHub repo created, npm package publishable.

### Real blocker: `db.ts` Linux incompatibility

`db.ts` currently calls `Database.setCustomSQLite()` with Homebrew macOS paths. On Linux,
this is unnecessary — system SQLite supports extension loading. Fix:

```typescript
// Only override SQLite on macOS (Homebrew build required for extension loading)
// Linux system SQLite supports loadExtension() natively
if (process.platform === "darwin") {
  const homebrewSQLite = findHomebrewSQLite();
  if (!homebrewSQLite) throw new Error("Install Homebrew SQLite: brew install sqlite");
  Database.setCustomSQLite(homebrewSQLite);
}
```

### CI fixtures

Copy 3–5 small real JSONL files from `~/.claude/projects/` into `eval/fixtures/sessions/`.
Criteria: small file size (<200KB each), at least 3 user turns, different projects.
Scrub any secrets (API keys, passwords) before committing.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"]
}
```

### `.github/workflows/ci.yml`

Matrix: `ubuntu-latest` + `macos-latest`.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.10   # pin to match dev environment

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun tsc --noEmit

      - name: Build
        run: node scripts/build.js

      - name: Verify build artifact
        run: test -f plugin/scripts/qrec.cjs

      - name: Cache embedding model
        uses: actions/cache@v4
        with:
          path: ~/.cache/qmd/models
          key: qrec-model-embeddinggemma-300M-Q8_0

      - name: Install Homebrew SQLite (macOS only)
        if: matrix.os == 'macos-latest'
        run: brew install sqlite

      - name: Integration test — index fixtures
        run: |
          bun run src/cli.ts index eval/fixtures/sessions/
          bun run src/cli.ts status

      - name: Integration test — serve + search + audit
        run: |
          bun run src/cli.ts serve --daemon
          curl -sf http://localhost:3030/health
          curl -sf -X POST http://localhost:3030/search \
            -H 'Content-Type: application/json' \
            -d '{"query":"sqlite","k":3}' | jq '.results | length'
          curl -sf http://localhost:3030/audit/entries | jq '.entries | length'
          bun run src/cli.ts stop

      - name: Integration test — MCP tools/list
        run: |
          printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}\n{"jsonrpc":"2.0","method":"initialized","params":{}}\n{"jsonrpc":"2.0","method":"tools/list","id":2}\n' \
            | timeout 60 bun run src/cli.ts mcp 2>/dev/null \
            | grep -q '"search"'
          echo "MCP tools/list: OK"
```

### Phase 5 milestones

| Milestone | Scope | Est. |
|---|---|---|
| **M10 — Linux db fix** | `db.ts`: skip `setCustomSQLite` on non-macOS | 0.5 hours |
| **M11 — Fixtures** | Copy + scrub 3-5 JSONL sessions into `eval/fixtures/sessions/` | 1 hour |
| **M12 — tsconfig** | Add `tsconfig.json`, verify `bun tsc --noEmit` passes | 1 hour |
| **M13 — CI workflow** | `.github/workflows/ci.yml` matrix (ubuntu + macOS) | 2 hours |
| **M14 — GitHub repo** | `gh repo create`, push, verify CI passes on first push | 1 hour |

### Phase 5 exit gate

```
[ ] CI passes on ubuntu-latest and macos-latest
[ ] Model cache hits on second run (< 30s for model step)
[ ] PR title workflow enforces Conventional Commits
[ ] `npm run release` dry run completes without error
```

---

## M6 — Distribution (after Phase 5)

#### Target platforms

macOS arm64, macOS x64, Linux x86\_64 (CPU + CUDA). node-llama-cpp ships prebuilt platform
binaries in its own npm package — no cross-compilation needed.

#### Two-tier distribution

| Channel | Audience | What it provides |
|---|---|---|
| Claude Code marketplace | Claude Code users (all platforms) | Plugin + skills + hook registration |
| npm (`qrec` package) | CLI-only / CI / scripting users | CLI engine only, no Claude Code integration |

Both channels share the same version and the same source tree. The marketplace plugin ships
compiled CJS artifacts (`plugin/scripts/qrec.cjs`); `smart-install.js` runs `bun install`
inside the plugin dir at first SessionStart to resolve node-llama-cpp native binaries.

#### Install story — marketplace path (primary)

```bash
# Step 1: Add marketplace source
claude plugin marketplace add dvquy13/qrec

# Step 2: Install plugin
claude plugin install qrec@qrec

# Step 3: Restart Claude Code — everything else is automatic
```

No setup wizard needed. On the first SessionStart after install, `smart-install.js` runs
automatically and handles everything.

#### Install story — npm path (CLI / CI)

```bash
npm install -g qrec
qrec index ~/.claude/projects/
qrec serve --daemon
```

#### Plugin structure

```
.claude-plugin/
  marketplace.json        # Root two-tier manifest: name, owner, source: "./plugin"

plugin/
  .claude-plugin/
    plugin.json           # { name, version, skills: ["./skills/qrec"] }
  hooks/
    hooks.json            # SessionStart + SessionEnd hooks
  scripts/
    smart-install.js      # Node.js dep installer (runs first, before Bun in PATH)
    bun-runner.js         # Finds Bun in common paths; bridges node → bun
    qrec.cjs              # Compiled CLI + MCP server (esbuild bundle)
  skills/
    qrec/
      SKILL.md            # Dispatcher: routes status|teardown; disable-model-invocation: true
      status.md           # Health check + troubleshoot: status() MCP + ~/.qrec/install.log
      teardown.md         # Uninstall: stop daemon, unhook from settings.json
```

#### `smart-install.js` behaviour

Runs via `node` (not Bun) because Bun may not be installed yet on first run.

1. **Check/install Bun** — if missing, installs from `bun.sh/install`
2. **Check `.install-version` marker** — if plugin version + Bun version unchanged, skip (~fast path)
3. **`bun install`** in `$PLUGIN_ROOT` — resolves node-llama-cpp native binaries
4. **Model download** — if absent at `~/.cache/qmd/models/`, downloads with progress to stderr
5. **First-time index** — if DB absent, runs `qrec index ~/.claude/projects/`
6. **Write `.install-version` marker**

All steps logged to `~/.qrec/install.log`. On failure: exits 1, error visible in terminal.

#### Release pipeline

**`.release-it.json`**:
```json
{
  "git": { "commitMessage": "chore: release v${version}", "tagName": "v${version}" },
  "npm": { "publish": true },
  "github": { "release": true },
  "hooks": { "after:bump": "node scripts/sync-plugin-version.mjs ${version}" },
  "plugins": {
    "@release-it/conventional-changelog": { "preset": "angular", "infile": "CHANGELOG.md" }
  }
}
```

`scripts/sync-plugin-version.mjs` bumps version in `package.json`, `.claude-plugin/marketplace.json`, and `plugin/.claude-plugin/plugin.json`.

**Release command**:
```bash
export GITHUB_TOKEN=$(gh auth token)
npm run release
```

#### Testing approach

**CI (automated):**
```bash
node scripts/build.js
cd plugin && bun install && cd ..
node plugin/scripts/smart-install.js
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
  | node plugin/scripts/bun-runner.js plugin/scripts/qrec.cjs mcp
npm pack && npm install -g ./qrec-*.tgz && qrec --version
bash scripts/smoke-test.sh
```

**Manual (once before M6 merge):**
```
[ ] `claude plugin marketplace add dvquy13/qrec` succeeds
[ ] `claude plugin install qrec@qrec` succeeds
[ ] Restart Claude Code → smart-install.js runs, first-run output visible
[ ] Subsequent session → fast path, < 200ms overhead
[ ] Simulated failure (renamed model) → hook exits 1, error in terminal
[ ] /qrec:status → identifies root cause from install.log
[ ] /qrec:teardown → daemon stopped cleanly
[ ] status() MCP returns health: "degraded" with reason during failure
[ ] npm install -g qrec → qrec --version on macOS arm64 + Linux x86_64
```

#### M6 acceptance criteria

```
1.  Marketplace manifest valid; `claude plugin install qrec@qrec` installs cleanly
2.  hooks.json declares SessionStart + SessionEnd hooks; registered automatically (no manual merge)
3.  smart-install.js: installs Bun if missing, bun install, model download, first-time index
4.  smart-install.js: fast path via .install-version marker; < 200ms overhead on subsequent sessions
5.  bun-runner.js: finds Bun in common paths; buffers stdin for Linux pipe safety
6.  All install steps logged to ~/.qrec/install.log with timestamps + platform info
7.  On failure: smart-install.js exits 1, error visible in terminal
8.  status() MCP tool returns { health, reason, log_tail } — degraded state surfaced
9.  /qrec:status skill reads log + calls status(); diagnoses and suggests fixes
10. /qrec:teardown stops daemon cleanly
11. scripts/build.js compiles src/ → plugin/scripts/qrec.cjs; plugin/ ships no TypeScript
12. npm package published; `npm install -g qrec` → `qrec --version` on macOS arm64 + Linux x86_64
13. scripts/sync-plugin-version.mjs keeps version in sync across all manifests
14. PR title workflow enforces Conventional Commits
15. `npm run release`: CHANGELOG + git tag + GitHub release + npm publish
16. scripts/smoke-test.sh passes on CI matrix (macOS arm64 + Linux x86_64)
17. Layer 3 manual checklist completed and signed off before merge
```

---

## What qrec Does Not Include (V1)

| Feature | Why excluded | Revisit condition |
|---|---|---|
| Reranking | Adds 600MB model + 200-500ms per query | Found@10 < 0.80 in production |
| HyDE / query expansion | Claude (the MCP client) generates expansions natively | Never — wrong layer |
| Multi-collection | One collection: sessions | V2 if users request notes/docs support |
| Doc enrichment (Haiku summaries) | Phase 1 already exceeds quality targets; adds Haiku dependency at index time | Post-ship if COMPETING_SESSIONS misses surface in real usage |

---

## Key Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| JSONL format changes across Claude Code versions | Medium | Parser reads `type` field defensively; unknown line types skipped, not errored |
| db.ts requires Homebrew SQLite — fails on Linux CI | High | Fix `setCustomSQLite()` to be macOS-only (Phase 5 M10) |
| Warm embed latency > 100ms on CPU-only machines | Low | node-llama-cpp uses Metal (Apple Silicon) or CUDA; CPU fallback ~150ms; query cache covers repeats |
