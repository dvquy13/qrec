---
paths:
  - src/**
---

# Engine Rules (src/)

## Embedder & Model

- **node-llama-cpp 3.17.1** — Bun exit segfault fixed in 3.17.0; 3.17.1 confirmed clean under Bun 1.3.10 **on macOS only**. On Linux (K8s/Ubuntu/Tesla T4), GGML/CUDA worker threads can still race during `disposeSummarizer()` and segfault with "multiple threads are crashing". Fix: commit all DB writes + `enrich_complete` + `deleteEnrichPid()` BEFORE calling `disposeSummarizer()` so a crash there is harmless. Do NOT disable GPU on Linux — T4/CUDA is valid and intentional.
- **`disposeEmbedder()` before `process.exit()`** — always, in every CLI command that loads the model. Without: Bun hangs forever. With exit but no dispose: Bun crashes with NAPI fatal error.
- **`createEmbeddingContext({ contextSize: 8192 })`** — required, not optional. Default causes "Input too long" on session transcripts; dense code chunks hit 2000+ tokens at ~2 chars/token.
- **Embed factory**: use `getEmbedProvider()` from `embed/factory.ts` — never import `local.ts`/`ollama.ts`/`stub.ts` directly. Direct imports silently ignore `QREC_EMBED_PROVIDER`.
- **Model download**: use `resolveModelFile(uri, { directory, onProgress })` — NOT `createModelDownloader`. HF URI must be full `hf:<user>/<repo>/<file>`; short form without inner repo path returns 401 from HF manifest API.
- **node-llama-cpp dynamic import only** — `node-llama-cpp` is ESM with top-level `await`. Any static `import` from it in a file bundled into `qrec.cjs` crashes with `require() async module` at load time. Use `const { getLlama } = await import("node-llama-cpp")` inside the async function that needs it.
- **`embed/local.ts` skips legacy model path when `QREC_DIR` is overridden** — the legacy path (`~/.cache/qmd/models/...`) is hardcoded to `homedir()`, not derived from `QREC_DIR`. In isolated test environments (`QREC_DIR` set), checking it would silently reuse the host's cached model. Guard: `if (!process.env.QREC_DIR && existsSync(LEGACY_MODEL_PATH))`.

## Database & FTS5

- **`bun:sqlite`** not `better-sqlite3`. **`await Bun.file().text()`** not `.toString()` — `.toString()` returns `"[object Promise]"`.
- **FTS5**: sanitize query to `[a-zA-Z0-9\s'-]` before `WHERE text MATCH ?`. FTS5 throws on `.`, `/`, `(` etc. (e.g. `"plugin.json"` → `fts5: syntax error near "."`). The catch block silently drops BM25, leaving only KNN.
- **Session aggregation**: MAX chunk score per session, not SUM. SUM inflates scores for verbose sessions (27-chunk session scores 5× higher than 5-chunk session).
- **`sessions` table: `ON CONFLICT DO UPDATE SET` not `INSERT OR REPLACE`** — SQLite `REPLACE` is DELETE+INSERT; all unspecified columns (including `summary`, `tags`, `entities`, `enriched_at`, `enrichment_version`) go to NULL on re-index. Use `ON CONFLICT(id) DO UPDATE SET col = CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.col END` to preserve enrichment when content is unchanged and clear it only when content changed.
- **Summary chunk convention** — `{session_id}_summary` with `seq=-1, pos=-1` sentinels. Inserted by `enrich.ts` after enrichment. Indexer's `DELETE FROM chunks WHERE session_id = ?` removes it on re-index; `deleteVec WHERE chunk_id LIKE '{id}_%'` also covers it — no orphaned vec entries.
- **WAL backup** — SQLite WAL mode writes new data to `qrec.db-wal` and only folds it into the main file at a checkpoint. A `cp qrec.db` taken while the WAL is active misses everything since the last checkpoint. Always run `PRAGMA wal_checkpoint(TRUNCATE)` (after stopping the daemon) before copying the DB.

## Server Startup & State

- **`Bun.serve()` must come before `getEmbedProvider()`** — server binds immediately; model loads in background. `/health` always 200; `/search` 503 until ready. Reversing this order breaks the daemon's 30s health-check on slow CI runners and real user machines with cold model loads.
- **`ServerState` pattern** — `server.ts` holds `const state: ServerState = { embedder, embedderError, isIndexing }` and passes it to every route handler and lifecycle function. Never add module-level mutable vars to `server.ts`; add fields to `ServerState` instead and thread them through.
- **`serverProgress`** in `src/progress.ts` — shared mutable state for server.ts dashboard. `local.ts` and `indexer.ts` write to it directly (not via embed factory). This is the one place where direct import of a non-provider module is intentional.
- **esbuild shebang** — esbuild preserves the `#!/usr/bin/env bun` shebang from `src/cli.ts`. Never add `banner: { js: "#!/usr/bin/env bun" }` in `build.js` — produces a duplicate shebang on line 2, which Bun rejects as a syntax error.
- **Bun stdout buffering in daemon** — `Bun.spawn({ stdio: ["ignore", Bun.file(logFile), ...] })` buffers stdout; writes only flush when the buffer fills or the process exits. `tail -f qrec.log` does NOT show live output from the daemon child. Use `~/.qrec/activity.jsonl` for real-time observability.

## Indexer & Archive

- **`~/.qrec/archive/` is the only durable copy of deleted sessions** — `indexer.ts` copies every indexed JSONL to `~/.qrec/archive/<project>/` via `archiveJsonl()`. Claude Code periodically deletes source JSONL files; sessions older than ~30 days may no longer exist at their original path. Never wipe `~/.qrec/archive/` — it is not expendable. `teardown` removes it; `reset.sh` does not.
- **`archiveJsonl()` self-copy guard** — if the source path is already inside `ARCHIVE_DIR`, skip archiving to avoid `ENOENT: copyfile src → src`. Without this, `qrec index ~/.qrec/archive/` crashes with ENOENT spam.
- **`~/.qrec/archive/` is auto-indexed on startup** — after the initial index of `~/.claude/projects/`, `runIncrementalIndex(isInitialRun=true)` also runs `indexVault` on `ARCHIVE_DIR` to recover sessions Claude Code deleted from the live dir.
- **`onProgress` 0-based index** — `indexer.ts` calls `onProgress(i, toIndex.length, id)` with 0-based `i`. The `indexed > prevIndexed` check in server.ts misses the first session in a batch (`0 > 0 = false`). Logic that must fire on every processed session should gate on `current` being non-empty, separately from the count gate.
- **`/sessions` must ORDER BY `COALESCE(last_message_at, indexed_at) DESC`** — `ORDER BY date DESC, indexed_at DESC` sorts by YYYY-MM-DD first; sessions from the same day all tie on `date` and secondary `indexed_at` reflects bulk-indexing order, not conversation chronology.
- **Zero-session cron index runs must NOT write to `activity.jsonl`** — cron fires every 60s; at 2 events/run, 5 hours idle produces 600 events that push the initial index and enrich runs out of the fetch window. Buffer and only flush `index_started + session_indexed × N + index_complete` when `newSessions > 0`.

## Enricher & Summarizer

- **Summarizer must be a separate child process** — never load the Qwen3-1.7B summarizer in the same process as the embedding daemon. Co-resident: 300MB (embedder) + 1.28GB (summarizer) = 1.6GB indefinitely. `qrec enrich` is transient: loads model → batch-processes → disposes → exits. OS fully reclaims GPU memory on exit.
- **`flashAttention: true` required for Qwen3 CUDA (Tesla T4)** — without it, the model produces gibberish output on CUDA (node-llama-cpp issue #261). Safe on macOS Metal — no regression. Always pass `flashAttention: true` when creating the summarizer context in `enrich.ts`.
- **Qwen3 `/no_think` prefix** — Qwen3 models default to chain-of-thought mode. Prefix the user prompt with `/no_think` to disable it and halve latency. Required in `summarize.ts`.
- **`contextSize: 8192` applies to summarizer too** — same lesson as embedder. Default context causes truncation on long session transcripts fed to Qwen3-1.7B.
- **Enrich idle gate uses `last_message_at < now - enrichIdleMs`** (default 300s) — `last_message_at` is the max timestamp across all JSONL messages; active sessions have a fresh value → skipped. Sessions with NULL `last_message_at` are excluded — they need re-indexing. **`spawnEnrichIfNeeded()` and the query in `enrich.ts` must use the exact same filter.** If they diverge, the server spawns the child but the child exits with "no pending sessions", causing a phantom `enriching=true` with no `enrich_started` event. `enrichIdleMs` is live-read each tick → applies without restart. `indexIntervalMs` is captured in `setInterval` at startup → restart required.
- **Enrich download progress routes to `ENRICH_PROGRESS_FILE`, not `activity.jsonl`** — percent-updates to the activity log caused 362+ events pushing `enrich_started` out of the 500-event window. `enrich.ts` writes `{ percent, downloadedMB, totalMB }` to `~/.qrec/enrich-progress.json` on every 5% step; deleted when model loads. Activity receives only `enrich_model_downloaded` once at load time.
- **`stopDaemon()` must also SIGTERM the enrich child** — `daemon.ts` reads `~/.qrec/enrich.pid` and kills it alongside the main daemon. Without this, the orphaned enrich process keeps writing to the old (deleted) DB inode after a `reset.sh` + restart.
- **Enrich cron must be set up BEFORE `runIncrementalIndex(true)`** — `setInterval(spawnEnrichIfNeeded, INDEX_INTERVAL_MS)` and the immediate `spawnEnrichIfNeeded()` call must come before `await runIncrementalIndex(true)`. If set up after, enrich never fires during the initial index (which can take 10+ minutes for large installs).
- **No-chunk sessions: set BOTH `enriched_at` AND `enrichment_version`** — when the enrich loop skips a session because `getChunkText()` returns empty, it must mark the session with both fields. Setting only `enrichment_version` does NOT remove it from the pending queue: the query has `(enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?)` — the leading `enriched_at IS NULL` OR still matches, causing `spawnEnrichIfNeeded` to respawn every 60s ("Enrich run 0 sessions" flooding).

## Paths, Dirs & Config

- **`src/dirs.ts` is the single source of truth for paths and port** — all `~/.qrec/*` paths and `QREC_PORT` are exported from `dirs.ts`. Never hardcode `join(homedir(), ".qrec", ...)` or `25927` directly. `QREC_DIR` env var overrides the root and all derived paths update automatically — enables isolated test environments.
- **`readConfig()` silently returns defaults on ENOENT** — warns only on malformed JSON. `config.json` is never created until a user first POSTs to `/settings`; treating ENOENT as an error floods the daemon log on every poll.
- **Use `getQrecPort()`, not the `QREC_PORT` constant, for any code that must respect `--port`** — `QREC_PORT` is a module-level constant frozen at import time. The `--port` CLI flag sets `process.env.QREC_PORT` *after* module load; only `getQrecPort()` (reads env at call time) sees it. Any code that captures the constant at module scope will silently use the wrong port when `--port` is passed.
- **`startDaemon()` kills orphan processes on port 25927** — after `isDaemonRunning()` returns false, `daemon.ts` runs `lsof -ti :25927` (falls back to `ss -tlnp` on minimal Linux images where `lsof` isn't installed), SIGKILLs any process found, and waits 300ms before spawning. Handles zombie daemons left when the PID file goes stale. Do not route around this.
- **`startDaemon()` health-check timeout is 120s by default** (was 30s). CPU-only Linux model loading can take 60–120s. Override with `QREC_DAEMON_TIMEOUT_MS=<ms>`.

## GPU Probe

- **`probeGpu()` in `src/gpu-probe.ts` is memoized and Linux-only** — on macOS it returns immediately with `selectedBackend:"cpu"` and all nulls (Metal is selected automatically by node-llama-cpp; no probe needed). On Linux it runs `nvidia-smi`, scans CUDA lib paths, and checks Vulkan.
- **`selectedBackend` mirrors node-llama-cpp's detection**: `cuda` when GPU + CUDA runtime libs present; `vulkan` when Vulkan found; `cpu` otherwise. `activeBinaryName` is the exact node-llama-cpp prebuilt that would be loaded (`linux-x64`, `linux-x64-cuda-ext`, or `linux-x64-cuda`).
- **CUDA lib lookup covers `LD_LIBRARY_PATH` and `CUDA_PATH`** — non-standard installs (e.g. `/usr/local/cuda/lib64`) are found if those env vars are set. Don't add new hardcoded paths; add to the env var instead.
- **`advice` + `installSteps` are set only when GPU is detected but CUDA runtime libs are missing** — the UI surfaces these as actionable copy-paste commands. Keep them in sync with the node-llama-cpp prebuilt version requirements (`.so.12`/`.so.13`).

## API & Protocol

- **`GET /sessions` response format** — returns `{ sessions, total, offset, limit }` (full metadata, sorted date DESC). Supports `?offset=N` for pagination (page size 100). Filter params: `?dateFrom=YYYY-MM-DD`, `?dateTo=YYYY-MM-DD`, `?project=<substring>`, `?tag=<substring>` — all server-side via dynamic WHERE clause. `?date=X` shorthand sets both `dateFrom` and `dateTo`. `tags`/`entities` are parsed arrays (null when unenriched). `/sessions/:id` also includes `summary`, `tags`, `entities`.
- **`POST /search` filters** — accepts optional `dateFrom`, `dateTo`, `project`, `tag` in JSON body. Pre-filters the `rankMap` (after BM25+KNN population, before RRF scoring) by running one SQL query with dynamic WHERE clauses against `sessions` and deleting non-matching chunk entries. Ensures all filters are server-side — client-side filtering on a truncated top-k set misses valid results ranked beyond the cutoff.
- **`json_each(NULL)` returns 0 rows** — unenriched sessions have `tags=NULL`; they never match a tag filter. This is correct behavior: tag filter only applies to enriched sessions. Do not add a fallback.
- **`POST /query_db` security guard** — string-based: `toUpperCase().startsWith("SELECT")` + no semicolons. Intentional — endpoint is localhost-only (MCP proxy), a full SQL parser would be overkill. Returns `{ rows, count }`.
- **JSONL thinking blocks** — `type: "thinking"` blocks carry the content in a `thinking` field (not `text`); extracted into `Turn.thinking: string[]` by `parser.ts`. Note: connector phrases before tool calls ("Now let me read…") are `type: "text"` in `type: "assistant"` entries — no field distinguishes them from final response text.
