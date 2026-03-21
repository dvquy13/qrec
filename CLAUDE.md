# qrec

qrec is a purpose-built session recall engine. It replaces QMD's per-invocation CLI model loading (~2600ms cold start) with a persistent daemon that keeps the embedding model resident in memory (~55ms warm query).

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp 3.17.1 (`embeddinggemma-300M-Q8_0`, cached at `~/.qrec/models/`) |
| CLI recall | `qrec search` / `qrec get` |

Python scripts (eval generation) run with `uv`. Read-only subtrees in `docs/ext/` — do not modify.

## Codebase Map

```
src/
  cli.ts          # Entry: `qrec teardown`, `qrec index`, `qrec serve [--daemon]`, `qrec stop`, `qrec search`, `qrec get`, `qrec status`, `qrec enrich [--limit N] [--min-age-ms N] [--force]`
  dirs.ts         # Single source of truth for all ~/.qrec paths. Exports getQrecPort() (reads env at call time) and QREC_PORT (frozen at import). Use getQrecPort() everywhere; --port sets env after module load.
  gpu-probe.ts    # probeGpu() — memoized GPU/CUDA/Vulkan detection (Linux only; macOS returns cpu/false immediately). Used by routes.ts /status for Debug UI Compute section.
  db.ts           # SQLite schema + migrations (bun:sqlite + sqlite-vec extension)
  chunk.ts        # Heading-aware markdown chunker (~900 tokens/chunk, 15% overlap)
  parser.ts       # JSONL → ParsedSession: strips XML tags, summarizes tool_use, extracts thinking blocks (Turn.thinking: string[]), extracts chunk text
  indexer.ts      # Scan ~/.claude/projects/ (*.jsonl) or legacy *.md → chunk → embed → store; mtime pre-filter skips unchanged files; copies every JSONL to ~/.qrec/archive/<project>/ (archiveJsonl) — durable copy for sessions whose source files were deleted by Claude Code cleanup
  search.ts       # BM25 → KNN → RRF fusion → top-k session results
  audit.ts        # Query audit log: logQuery() → query_audit table; getAuditEntries(); migrateAudit() — called by db.ts
  routes.ts       # Route handlers as standalone functions; each accepts explicit deps (db, url, req, or state as needed — no module-level state). Handlers: handleSearch, handleSessions, handleSessionDetail, handleSessionMarkdown, handleProjects, handleHeatmap, handleAuditEntries, handleActivityEntries, handleSettings, handleSettingsUpdate, handleDebugLog, handleDebugConfig, handleHealth, handleStatus, handleQueryDb
  lifecycle.ts    # Daemon lifecycle: runIncrementalIndex(), spawnEnrichIfNeeded(), loadEmbedderWithRetry() — extracted from server.ts; accept deps explicitly
  server.ts       # Thin router (~139 lines): main() opens DB → Bun.serve() dispatches to routes.ts → calls lifecycle.ts; holds ServerState { embedder, embedderError, isIndexing }; signal handlers
  progress.ts     # Shared in-process progress state (phases: starting→model_download→model_loading→indexing→ready); written by local.ts + indexer.ts, read by server.ts
  activity.ts     # Append-only event log (~/.qrec/activity.jsonl); events: daemon_started|index_started|session_indexed|index_complete|enrich_started|session_enriched|enrich_complete
  daemon.ts       # PID-file daemon management (~/.qrec/qrec.pid)
  enrich.ts       # Standalone enricher child process: backfill summary chunks → load Qwen3-1.7B → batch-summarize pending sessions → dispose → exit. PID guard at ~/.qrec/enrich.pid prevents double-spawn.
  summarize.ts    # Pure inference: summarizeSession(ctx, chunkText) → {summary, tags, entities}. No lifecycle — caller owns the LlamaContext.
  prompts/
    session-extract-v1.ts  # Extraction prompt v1: SYSTEM_PROMPT + PROMPT_VERSION. Bump ENRICHMENT_VERSION in enrich.ts when this changes.
  config.ts       # ~/.qrec/config.json reader/writer: { enrichEnabled, enrichIdleMs, indexIntervalMs }. ENOENT silently returns defaults (file isn't created until first POST /settings).
  embed/
    provider.ts   # Interface: embed(text): Promise<Float32Array>
    local.ts      # node-llama-cpp singleton + disposeEmbedder()
    factory.ts    # getEmbedProvider() — reads QREC_EMBED_PROVIDER (local/ollama/openai/stub)
    ollama.ts     # Ollama HTTP backend
    openai.ts     # OpenAI-compatible backend
    stub.ts       # Fixed 768-dim unit vector — no model, no network (CI/testing)
test/
  helpers.ts      # createTestDb()/cleanupTestDb() — temp-file DB with migrations; insertSession()/insertChunkWithVec() for search test setup
  fixtures/       # Minimal JSONL files for parser/indexer tests (minimal, with-thinking, single-turn)
  chunk.test.ts   # chunkMarkdown() unit tests
  parser.test.ts  # parseSession(), extractChunkText(), renderMarkdown() unit tests
  search.test.ts  # BM25/KNN/RRF integration tests with stub embedder
  indexer.test.ts # indexVault() integration tests (skip/force/archive/enrichment preservation)
eval/
  pipeline.py     # Orchestrator: query gen → index → serve → eval → report
  qrec_eval.py    # qrec HTTP eval loop: index + daemon + metrics + error analysis
  report.py       # HTML report generation (Inter font, white background)
  generate_queries.py  # Two-stage Haiku query gen; QUERY_SCHEMA (includes style field)
  configs/        # YAML configs for reproducible runs
    phase1_raw_s30_seed99.yaml
  data/
    results/      # Per-run JSON + HTML results
  cache/
    cache.json    # Silver cache: keyed on query_gen_fingerprint + session_body_hash
ui/
  index.html      # SPA shell: tab panels (dashboard/sessions/debug + session detail); hash routing; dashboard stats+heatmap rendered via <div id="dashboard-panel"> (React); script/style tags only — no logic
  app.js          # All SPA logic: tab routing, data fetching, rendering, filters, infinite scroll, search; served fresh
  styles.css      # All styles; served fresh — edit and reload browser, no daemon restart needed
  components.js   # Built React component bundle (IIFE, window.QrecUI global); generated by `cd ui-react && bun run build.ts`
ui-react/         # Shared React TSX component library (built → ui/components.js)
  src/
    components/   # SessionCard, HeatmapGrid, EnrichBlock, TagBadge, StatCard, HeatmapProjectFilter, ActivityFeed
    sections/     # Page subsections (compose components + own CSS): DashboardSection (stats grid + heatmap), RecentSessionsSection, SessionsSection (results grid + infinite scroll), SessionDetailSection (turns + markdown + thinking/tools)
    utils/        # formatRelative.ts, heatmap.ts (heatmapIntensity, projectColor, etc.)
    styles/       # variables.css — CSS custom properties (loaded globally by demo/Root.tsx)
  web-entry.ts    # IIFE entry: exports window.QrecUI { renderSessionCard, renderHeatmapGrid, renderEnrichBlock, renderDashboard, renderRecentSessions, renderSessions, renderSessionDetail, unmount }
  build.ts        # Bun IIFE build → renames web-entry.js → components.js; deletes extracted CSS (vars in ui/styles.css)
demo/                 # Remotion animation demo; imports components directly from ui-react/src/ (not the built bundle)
scripts/
  reset.sh              # Wipe ~/.qrec/ DB/log/pid/activity.jsonl (keeps model cache)
  smoke-test.sh         # Build → start CJS daemon (QREC_EMBED_PROVIDER=stub) → health/search/UI asset checks → stop
  check-package.sh      # Pack tarball → assert every file under ui/ and plugin/ is present (run before release)
  onboard-test-start.sh   # Simulate fresh-user onboarding: creates isolated QREC_DIR temp dir, symlinks ~/.qrec/models/, sets QREC_PROJECTS_DIR to 10 sessions, starts daemon on port 25928 — real ~/.qrec never touched
  onboard-test-stop.sh    # Stop the onboard-test daemon (port 25928) and clean up temp QREC_DIR
```

**Source**: `~/.claude/projects/*/*.jsonl` (default; override with `QREC_PROJECTS_DIR=<path>` — useful for onboarding tests with a small session set; legacy `~/vault/sessions/*.md` still supported)
**DB**: `~/.qrec/qrec.db` (root overridable via `QREC_DIR=<path>`)
**Model**: `~/.qrec/models/` (new installs); legacy `~/.cache/qmd/models/hf_ggml-org_embeddinggemma-300M-Q8_0.gguf` still checked
**Port**: 25927 (overridable via `QREC_PORT=<n>`)
**All `~/.qrec/` paths**: exported from `src/dirs.ts` — single source of truth. `QREC_DIR` overrides the root; all derived paths (db, pid, archive, models, log, config, activity) update automatically.

## SQLite Schema

```sql
CREATE TABLE chunks (id TEXT PRIMARY KEY,  -- "{session_id}_{seq}"
  session_id TEXT, seq INTEGER, pos INTEGER, text TEXT, created_at INTEGER);
CREATE TABLE sessions (id TEXT PRIMARY KEY,  -- 8-char hex
  path TEXT, project TEXT, date TEXT, title TEXT, hash TEXT, indexed_at INTEGER,
  summary TEXT, tags TEXT, entities TEXT,  -- JSON arrays; NULL until enriched by `qrec enrich`
  enriched_at INTEGER, enrichment_version INTEGER,
  learnings TEXT, questions TEXT,          -- JSON arrays; NULL until enriched
  duration_seconds INTEGER,               -- session duration in seconds
  last_message_at INTEGER);               -- max timestamp across JSONL messages
CREATE TABLE query_cache (query_hash TEXT PRIMARY KEY, embedding BLOB, created_at INTEGER);
CREATE TABLE query_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT, k INTEGER, result_count INTEGER,
  top_session_id TEXT, top_score REAL, duration_ms REAL, created_at INTEGER);
CREATE VIRTUAL TABLE chunks_fts  USING fts5(session_id, text, content='chunks', content_rowid='rowid');
CREATE VIRTUAL TABLE chunks_vec  USING vec0(chunk_id TEXT PRIMARY KEY, embedding FLOAT[768] distance_metric=cosine);
```

FTS5 kept in sync via INSERT/DELETE/UPDATE triggers on `chunks`.

## Search Pipeline

```
POST /search {query, k}
  ├─ Sanitize query for FTS5 (strip punctuation → alphanumeric + spaces)
  ├─ BM25 (FTS5, ~1ms)                → top k*5 chunk rows
  ├─ Check query_cache (SHA-256 hash)
  │   hit  → skip embed  miss → embed(query ~50ms) → cache
  ├─ cosine KNN (sqlite-vec, ~4ms)    → top k*5 chunk rows
  ├─ RRF fusion (k=60): score = Σ 1/(60 + rank)
  ├─ Aggregate to session: MAX chunk score per session  ← not SUM
  └─ Top-k sessions → metadata + best chunk preview → return
```

## Commands

```bash
# Build React component library (ui/components.js)
cd ui-react && bun run build.ts             # also runs automatically via scripts/build.js after esbuild step

# Tests
QREC_EMBED_PROVIDER=stub bun test          # run all tests (stub required — skips model load)

# Local dev install (one-time)
bun link                                    # registers qrec globally → ~/.bun/bin/qrec

# Engine (short form after bun link)
qrec serve --daemon                         # first-time setup + all subsequent starts; auto-downloads model, indexes, opens browser
qrec serve --daemon --no-open               # start as daemon without opening browser (used by plugin hook)
qrec teardown [--yes]                       # stop daemon + remove ~/.qrec/
qrec index                                  # index ~/.claude/projects/ (default)
qrec index <path>                           # index specific path (.jsonl or dir)
qrec index                                  # stdin JSON {transcript_path} mode (hook compat, piped)
qrec serve                                  # start server (foreground, port 25927); auto-opens browser
qrec serve --daemon --port 25930            # override port (sets QREC_PORT; all subcommands accept --port)
qrec stop                                   # stop daemon
qrec search "<query>" [--project P] [--tag T] [--from DATE] [--to DATE] [--k N]  # search sessions (with query: POST /search; no query + filters: GET /sessions browse)
qrec get <session-id>                       # print full session markdown
qrec status                                 # print status + log tail
qrec enrich                                 # enrich unenriched sessions with summary/tags/entities (also spawned automatically by daemon)
qrec enrich --limit N                       # process at most N sessions
qrec enrich --force                         # re-enrich all sessions regardless of enriched_at (use to recover titles after accidental re-index)

# Onboarding test (isolated env — real ~/.qrec never touched)
bash scripts/onboard-test-start.sh              # creates temp QREC_DIR, symlinks models, starts daemon on port 25928
bash scripts/onboard-test-stop.sh               # stop test daemon + clean up temp dir

# Dev (without bun link)
bun run src/cli.ts <command>

# Eval (full pipeline: query gen → index → serve → eval → report)
bash scripts/reset.sh                       # wipe DB/log/pid for a clean run
CLAUDECODE="" uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml
# agent backend blocks inside Claude Code session — always prefix with CLAUDECODE=""

# Key env vars
# QREC_DIR=<path>               override ~/.qrec root (all paths derived from it; used for isolated test envs)
# QREC_PORT=<n>                 override daemon port 25927
# QREC_EMBED_PROVIDER=stub      skip model load (CI/testing)
# QREC_PROJECTS_DIR=<path>      override ~/.claude/projects/ source dir
# QREC_INDEX_INTERVAL_MS=<ms>   cron index interval (default 60000)
# QREC_ENRICH_IDLE_MS=<ms>      min session age (indexed_at) before enrich picks it up (default 300000)
# QREC_DAEMON_TIMEOUT_MS=<ms>   health-check timeout for startDaemon() (default 120000; CPU-only Linux needs more time)
```

## Release

```bash
bash scripts/release.sh 0.7.0              # stable  → npm tag: latest  (npm install -g @dvquys/qrec)
bash scripts/release.sh 0.7.0-next.0 next  # pre-release → npm tag: next (npm install -g @dvquys/qrec@next)
```
Use pre-release to test on non-macOS environments (Linux K8s, etc.) before promoting to stable.

## Conventions

- Git commits follow Conventional Commits
- Python scripts: always run with `uv`
- Do not modify `docs/ext/` — read-only subtrees
- Engine-specific gotchas (embedder, FTS5, server startup, indexer, enricher): see `.claude/rules/src.md`
