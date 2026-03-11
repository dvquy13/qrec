# qrec

qrec is a purpose-built session recall engine. It replaces QMD's per-invocation CLI model loading (~2600ms cold start) with a persistent daemon that keeps the embedding model resident in memory (~55ms warm query).

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp 3.15.1 (`embeddinggemma-300M-Q8_0`, cached at `~/.qrec/models/`) |
| MCP server | `@modelcontextprotocol/sdk` |

Python scripts (eval generation) run with `uv`. Read-only subtrees in `docs/ext/` — do not modify.

## Codebase Map

```
src/
  cli.ts          # Entry: `qrec onboard`, `qrec teardown`, `qrec index`, `qrec serve [--daemon]`, `qrec stop`, `qrec mcp [--http]`, `qrec status`
  db.ts           # SQLite schema + migrations (bun:sqlite + sqlite-vec extension)
  chunk.ts        # Heading-aware markdown chunker (~900 tokens/chunk, 15% overlap)
  parser.ts       # JSONL → ParsedSession: strips XML tags, summarizes tool_use, extracts thinking blocks (Turn.thinking: string[]), extracts chunk text
  indexer.ts      # Scan ~/.claude/projects/ (*.jsonl) or legacy *.md → chunk → embed → store; mtime pre-filter skips unchanged files
  search.ts       # BM25 → KNN → RRF fusion → top-k session results
  server.ts       # HTTP server (port 3030): /search /health /status /sessions /sessions/:id /audit/entries /activity/entries /debug/*; serves SPA (ui/index.html) at /; cron incremental index (QREC_INDEX_INTERVAL_MS, default 60000ms)
  progress.ts     # Shared in-process progress state (phases: starting→model_download→model_loading→indexing→ready); written by local.ts + indexer.ts, read by server.ts
  activity.ts     # Append-only event log (~/.qrec/activity.jsonl); events: daemon_started|index_started|session_indexed|index_complete
  mcp.ts          # MCP server (stdio + HTTP on 3031): proxies search/get/status to daemon at localhost:3030; no model/DB loaded
  mcp-entry.ts    # Standalone entry point for qrec-mcp.cjs bundle — calls runMcpServer() (mcp.ts only exports it)
  daemon.ts       # PID-file daemon management (~/.qrec/qrec.pid)
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
  index.html      # SPA: dashboard/search/sessions/activity/debug tabs + session detail (#session/:id); hash routing; marked.js for markdown; served fresh on every request (browser refresh picks up changes — no server restart needed)
scripts/
  reset.sh        # Wipe ~/.qrec/ DB/log/pid (keeps model cache)
```

**Source**: `~/.claude/projects/*/*.jsonl` (default; legacy `~/vault/sessions/*.md` still supported)
**DB**: `~/.qrec/qrec.db`
**Model**: `~/.qrec/models/` (new installs); legacy `~/.cache/qmd/models/hf_ggml-org_embeddinggemma-300M-Q8_0.gguf` still checked

## SQLite Schema

```sql
CREATE TABLE chunks (id TEXT PRIMARY KEY,  -- "{session_id}_{seq}"
  session_id TEXT, seq INTEGER, pos INTEGER, text TEXT, created_at INTEGER);
CREATE TABLE sessions (id TEXT PRIMARY KEY,  -- 8-char hex
  path TEXT, project TEXT, date TEXT, title TEXT, hash TEXT, indexed_at INTEGER);
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
qrec serve                                  # start server (foreground, port 3030); auto-opens browser
qrec serve --daemon                         # start as daemon; auto-opens browser
qrec serve --daemon --no-open               # start as daemon without opening browser
qrec stop                                   # stop daemon
qrec mcp                                    # MCP server (stdio)
qrec mcp --http                             # MCP server (HTTP, port 3031)
qrec status                                 # print status + log tail

# Dev (without bun link)
bun run src/cli.ts <command>

# Eval (full pipeline: query gen → index → serve → eval → report)
bash scripts/reset.sh                       # wipe DB/log/pid for a clean run
CLAUDECODE="" uv run eval/pipeline.py --config eval/configs/phase1_raw_s30_seed99.yaml
# agent backend blocks inside Claude Code session — always prefix with CLAUDECODE=""
```

## Critical Gotchas

**node-llama-cpp pinned to 3.15.1** — 3.17.x segfaults on exit under Bun 1.3.10. Do not upgrade without testing.

**Always dispose before exit** — call `disposeEmbedder()` before `process.exit()` in any command that loads the model. Without: Bun hangs forever. With exit but no dispose: Bun crashes with NAPI fatal error.

**FTS5 query sanitization required** — FTS5 throws syntax errors on `.`, `/`, `(` etc. (e.g. `"plugin.json"` → `fts5: syntax error near "."`). The catch block silently drops BM25, leaving only KNN. Strip to `[a-zA-Z0-9\s'-]` before querying.

**Session aggregation: MAX not SUM** — SUM inflates scores for verbose sessions (27-chunk session scores 5× higher than 5-chunk session). MAX picks the session with the best single matching chunk.

**contextSize must be set to 8192** — default causes "Input too long" on session transcripts; dense code chunks hit 2000+ tokens at ~2 chars/token.

**Bun quirks**: use `bun:sqlite` (not `better-sqlite3`); use `await Bun.file(path).text()` (not `.toString()` — returns `"[object Promise]"`).

**Model download: use `resolveModelFile`, not `createModelDownloader`** — `createModelDownloader` fetches the HF manifest API which returns 401 on gated models (Gemma is gated). `resolveModelFile` handles this correctly. HF URI must be full form: `hf:<user>/<repo>/<file>` (e.g. `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf`). Short form without the inner repo path → 401.

**Server starts before model loads** — `Bun.serve()` binds immediately; embedder loads async in background. `/health` returns 200 right away (daemon startup fast). `/search` returns 503 until embedder is ready. Server auto-indexes on first run (sessions=0) after model loads.

## Conventions

- Git commits follow Conventional Commits
- Python scripts: always run with `uv`
- Do not modify `docs/ext/` — read-only subtrees
