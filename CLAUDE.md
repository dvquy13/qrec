# qrec

qrec is a purpose-built session recall engine. It replaces QMD's per-invocation CLI model loading (~2600ms cold start) with a persistent daemon that keeps the embedding model resident in memory (~55ms warm query).

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp 3.17.1 (`embeddinggemma-300M-Q8_0`, cached at `~/.qrec/models/`) |
| MCP server | `@modelcontextprotocol/sdk` |

Python scripts (eval generation) run with `uv`. Read-only subtrees in `docs/ext/` — do not modify.

## Codebase Map

```
src/
  cli.ts          # Entry: `qrec onboard`, `qrec teardown`, `qrec index`, `qrec serve [--daemon]`, `qrec stop`, `qrec mcp [--http]`, `qrec status`, `qrec enrich [--limit N] [--min-age-ms N]`
  dirs.ts         # Single source of truth for all ~/.qrec paths + QREC_PORT. Import from here; never hardcode paths elsewhere.
  db.ts           # SQLite schema + migrations (bun:sqlite + sqlite-vec extension)
  chunk.ts        # Heading-aware markdown chunker (~900 tokens/chunk, 15% overlap)
  parser.ts       # JSONL → ParsedSession: strips XML tags, summarizes tool_use, extracts thinking blocks (Turn.thinking: string[]), extracts chunk text
  indexer.ts      # Scan ~/.claude/projects/ (*.jsonl) or legacy *.md → chunk → embed → store; mtime pre-filter skips unchanged files; copies every JSONL to ~/.qrec/archive/<project>/ (archiveJsonl) — durable copy for sessions whose source files were deleted by Claude Code cleanup
  search.ts       # BM25 → KNN → RRF fusion → top-k session results
  server.ts       # HTTP server (port 25927): /search /query_db /health /status /sessions /sessions/:id /settings /audit/entries /activity/entries /debug/*; serves SPA (ui/index.html) at /; two independent 1-min crons: incremental index (QREC_INDEX_INTERVAL_MS) + enrich spawn; enrich also fires once immediately after startup index; age gate: COALESCE(last_message_at, indexed_at) < now - QREC_ENRICH_IDLE_MS (default 300s)
  progress.ts     # Shared in-process progress state (phases: starting→model_download→model_loading→indexing→ready); written by local.ts + indexer.ts, read by server.ts
  activity.ts     # Append-only event log (~/.qrec/activity.jsonl); events: daemon_started|index_started|session_indexed|index_complete|enrich_started|session_enriched|enrich_complete
  mcp.ts          # MCP server (stdio + HTTP on 3031): proxies search/get/status/query_db to daemon at localhost:25927; no model/DB loaded
  mcp-entry.ts    # Standalone entry point for qrec-mcp.cjs bundle — calls runMcpServer() (mcp.ts only exports it)
  daemon.ts       # PID-file daemon management (~/.qrec/qrec.pid)
  enrich.ts       # Standalone enricher child process: backfill summary chunks → load Qwen3-1.7B → batch-summarize pending sessions → dispose → exit. PID guard at ~/.qrec/enrich.pid prevents double-spawn.
  summarize.ts    # Pure inference: summarizeSession(ctx, chunkText) → {summary, tags, entities}. No lifecycle — caller owns the LlamaContext.
  config.ts       # ~/.qrec/config.json reader/writer: { enrichEnabled: boolean }. Read by server.ts before spawning enrich child.
  embed/
    provider.ts   # Interface: embed(text): Promise<Float32Array>
    local.ts      # node-llama-cpp singleton + disposeEmbedder()
    factory.ts    # getEmbedProvider() — reads QREC_EMBED_PROVIDER (local/ollama/openai/stub)
    ollama.ts     # Ollama HTTP backend
    openai.ts     # OpenAI-compatible backend
    stub.ts       # Fixed 768-dim unit vector — no model, no network (CI/testing)
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
  index.html      # SPA shell: tab panels (dashboard/sessions/debug + session detail); hash routing; script/style tags only — no logic
  app.js          # All SPA logic: tab routing, data fetching, rendering, filters, infinite scroll, search; served fresh
  styles.css      # All styles; served fresh — edit and reload browser, no daemon restart needed
scripts/
  reset.sh              # Wipe ~/.qrec/ DB/log/pid (keeps model cache)
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
  enriched_at INTEGER, enrichment_version INTEGER);
CREATE TABLE query_cache (query_hash TEXT PRIMARY KEY, embedding BLOB, created_at INTEGER);
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
# Local dev install (one-time)
bun link                                    # registers qrec globally → ~/.bun/bin/qrec

# Engine (short form after bun link)
qrec onboard [--no-open]                    # first-time setup: daemon → browser → (model + index async in background)
qrec teardown [--yes]                       # stop daemon + remove ~/.qrec/
qrec index                                  # index ~/.claude/projects/ (default)
qrec index <path>                           # index specific path (.jsonl or dir)
qrec index                                  # stdin JSON {transcript_path} mode (hook compat, piped)
qrec serve                                  # start server (foreground, port 25927); auto-opens browser
qrec serve --daemon                         # start as daemon; auto-opens browser
qrec serve --daemon --no-open               # start as daemon without opening browser
qrec stop                                   # stop daemon
qrec mcp                                    # MCP server (stdio)
qrec mcp --http                             # MCP server (HTTP, port 3031)
qrec status                                 # print status + log tail
qrec enrich                                 # enrich unenriched sessions with summary/tags/entities (also spawned automatically by daemon)
qrec enrich --limit N                       # process at most N sessions

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
```

## Critical Gotchas


**Always dispose before exit** — call `disposeEmbedder()` before `process.exit()` in any command that loads the model. Without: Bun hangs forever. With exit but no dispose: Bun crashes with NAPI fatal error.

**FTS5 query sanitization required** — FTS5 throws syntax errors on `.`, `/`, `(` etc. (e.g. `"plugin.json"` → `fts5: syntax error near "."`). The catch block silently drops BM25, leaving only KNN. Strip to `[a-zA-Z0-9\s'-]` before querying.

**Session aggregation: MAX not SUM** — SUM inflates scores for verbose sessions (27-chunk session scores 5× higher than 5-chunk session). MAX picks the session with the best single matching chunk.

**contextSize must be set to 8192** — default causes "Input too long" on session transcripts; dense code chunks hit 2000+ tokens at ~2 chars/token.

**Bun quirks**: use `bun:sqlite` (not `better-sqlite3`); use `await Bun.file(path).text()` (not `.toString()` — returns `"[object Promise]"`).

**Model download: use `resolveModelFile`, not `createModelDownloader`** — `createModelDownloader` fetches the HF manifest API which returns 401 on gated models (Gemma is gated). `resolveModelFile` handles this correctly. HF URI must be full form: `hf:<user>/<repo>/<file>` (e.g. `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf`). Short form without the inner repo path → 401.

**Server starts before model loads** — `Bun.serve()` binds immediately; embedder loads async in background. `/health` returns 200 right away (daemon startup fast). `/search` returns 503 until embedder is ready. Server auto-indexes on first run (sessions=0) after model loads.

**`~/.qrec/archive/` is the only durable copy of deleted sessions** — `indexer.ts` copies every indexed JSONL to `~/.qrec/archive/<project>/` via `archiveJsonl()`. Claude Code periodically deletes source JSONL files; sessions older than ~30 days may no longer exist at their original path. Never wipe `~/.qrec/archive/` thinking it's expendable — it is not. `teardown` removes it; `reset.sh` does not.

**Backing up `qrec.db` alone silently loses recent sessions** — SQLite WAL mode writes new data to `qrec.db-wal` and only folds it into the main file at a checkpoint. A `cp qrec.db` taken while the WAL is active misses everything since the last checkpoint. Always run `PRAGMA wal_checkpoint(TRUNCATE)` (after stopping the daemon) before copying the DB. The resulting `qrec.db` is self-contained; no WAL needed for restore. This was discovered when Feb 9–14 sessions vanished after an incomplete backup — they existed only in the WAL.

**Summarizer must be a separate child process** — never load the Qwen3-1.7B summarizer in the same process as the embedding daemon. Co-resident would hold 300MB (embedder) + 1.28GB (summarizer) = 1.6GB indefinitely. `qrec enrich` is transient: loads model → batch-processes all pending sessions → disposes → exits. OS fully reclaims GPU memory on exit. Stale PID in `~/.qrec/enrich.pid` (process dead) never blocks next run.

## Conventions

- Git commits follow Conventional Commits
- Python scripts: always run with `uv`
- Do not modify `docs/ext/` — read-only subtrees
