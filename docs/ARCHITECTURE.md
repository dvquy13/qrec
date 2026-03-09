# qrec Architecture

> Purpose-built session recall engine: persistent daemon with BM25 + vector hybrid search.

## Context & Prior Work

Extracted from the **auto-recall-cc** plugin, which handles Claude Code JSONL → markdown → indexed vault. qrec replaces the QMD search layer. QMD's bottleneck: each CLI invocation cold-loads a 300MB embedding model (~2600ms). qrec keeps the model resident; warm queries take ~55ms.

## Architectural Decisions

**MAX vs SUM for session aggregation** — SUM gives 5× higher score to a 27-chunk session vs a 5-chunk session even when the focused session has a more relevant single chunk. MAX picks the session with the best matching chunk, which matches the retrieval goal.

**RRF k=60** — standard RRF damping constant. Gives diminishing returns to lower-ranked chunks; prevents a cluster of mediocre matches from outscoring one excellent match.

**FTS5 query sanitization** — FTS5 raises syntax errors on `.`, `/`, and other punctuation. The error is caught silently, dropping BM25 entirely for that query. Must strip punctuation before querying. Kept in sanitizer: hyphens and apostrophes (meaningful in English terms).

**contextSize: 8192** — Gemma embedding model's full trained context. Default (when unspecified) is implementation-defined and may be as low as 512. Session transcripts with dense code can exceed 2048 tokens at ~2 chars/token; 8192 covers all realistic chunk sizes.

**node-llama-cpp 3.15.1 pinned** — 3.17.x introduced a NAPI regression that segfaults on exit under Bun 1.3.10. QMD also uses 3.15.1. Match this version until a known-good 3.17.x+ is confirmed.

**disposeEmbedder() before process.exit()** — node-llama-cpp registers NAPI finalizers that keep the Bun event loop alive. Without dispose: hangs. With process.exit() but no dispose: Bun crashes (`NAPI FATAL ERROR: Error::New`). Correct sequence: dispose embedding context → dispose llama instance → process.exit(0).

**sqlite-vec for KNN** — exact cosine KNN, on-disk, zero startup cost, ~4ms p50 at 1000-chunk scale. In-memory alternatives (hnswlib, FAISS) offer no meaningful latency improvement and add approximate-search recall risk.

**Chunk ID format: `{session_id}_{seq}`** — parse with `chunkId.split("_").slice(0,-1).join("_")` to recover session ID. Session IDs are 8-char hex with no underscores, so this is unambiguous.

**Homebrew SQLite for extension loading** — `bun:sqlite`'s bundled SQLite doesn't support `LOAD EXTENSION`. `Database.setCustomSQLite()` points to Homebrew's build. Checked at module load time in `db.ts`; throws with actionable message if not found.

## Phase 1 Baseline (2026-03-08)

Final run: 30 sessions (seed=99), 24 eval queries, new eval pipeline. Phase 1 exit gate **PASSED**.

| Metric | Value | Target | Status |
|---|---|---|---|
| Found@10 | 91.7% | ≥90% | ✓ |
| NDCG@10 | 0.8497 | ≥0.75 | ✓ |
| Latency p50 | 18ms | <100ms | ✓ |
| Latency p95 | 46ms | <300ms | ✓ |
| RSS startup | 627 MB | <500MB | ✗ |

RSS exceeds target — the 313MB model alone accounts for most of it. Target may need revisiting; no action until it becomes a user complaint.

**Error pattern** (2 misses, both COMPETING_SESSIONS): short sessions (few chunks) outscored by larger sessions on overlapping topics. This is the primary hypothesis for Phase 2 doc enrichment.

**Intermediate debug runs** (before eval pipeline redesign):

| Run | Found@10 | NDCG@10 | Notes |
|---|---|---|---|
| Initial (bugs) | 64.4% | 0.379 | FTS5 silent failures + SUM aggregation |
| +FTS5 sanitize | 69.2% | 0.404 | BM25 active for punctuated queries |
| +MAX aggregation | 76.0% | 0.559 | Final state before pipeline redesign |

Numbers above used old static eval_set.json (22 sessions, vault grown to 142 → artificially low).

## Eval Pipeline Design

The eval pipeline is fully Python. `pipeline.py` orchestrates everything; `run_eval.ts` / `metrics.ts` are deleted.

**Flow**: `pipeline.py --config` → sample sessions → query gen (cache check → batch API) → `bun index` → `bun serve --daemon` → HTTP eval loop → error analysis → JSON + HTML report

**Config YAML** (`eval/configs/*.yaml`): defines all params. Each run reads its config, embeds a full config snapshot in the results JSON. Required for reproducibility.

**Cache key design**:
```
query_gen_fingerprint = hash(model + stage1_prompt + stage2_prompt + schema_json)
cache_key = f"{query_gen_fingerprint}_{sha256(session_body)}"
```
- Schema changes invalidate cache (via `RunConfig.set_schema()`) — verified
- Seed, sessions count, indexing strategy excluded: they affect sampling, not per-session output
- Two fingerprints: `query_gen_fingerprint` (cache) vs `run_fingerprint` (full run identity for results JSON)

**Session sampling**: `discover_sessions` project-caps (max 4 per project with 30 sessions, 7 projects → returns 23 when thin projects can't fill quota). `pipeline.py` fills up to requested count deterministically (seed+1).

**Results**: `eval/data/results/results_{run_name}_{timestamp}.json` + `.html`. JSON includes full config snapshot, per-stage query gen stats (cache hits, LLM calls, cost, duration), indexing stats, eval metrics, per-query details with `rank_of_relevant` and `diagnosis`.

**Query gen cost**: ~$0.005/session cold (batch API); $0 for cached sessions. 30 sessions cold ≈ $0.15, ≈5 min.

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `node-llama-cpp` | 3.15.1 (pinned) | Embedding model inference |
| `sqlite-vec` | latest | Cosine KNN via SQLite extension |
| `bun:sqlite` | built-in | SQLite (not better-sqlite3 — Node native, unsupported in Bun) |
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP server (Phase 4) |
