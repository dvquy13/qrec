# Refactoring Plan: Tests + Structural Cleanup

## Context

qrec has ~3k lines of TypeScript with **zero regression tests**. Several structural issues were identified (monolithic server.ts, complex RRF fusion, scattered SQL, silent catches) but refactoring without tests is risky. Strategy: **write stable interface tests first, then refactor with confidence**.

The app.js UI (1600 lines), styles.css, plugin scripts, and eval Python are **explicitly out of scope** — cost/benefit is poor for the engine-focused work here.

---

## Phase 1: Test Infrastructure + Pure Function Tests ✅ DONE (2026-03-15)

### 1a. Setup
- Add `"test": "QREC_EMBED_PROVIDER=stub bun test"` to `package.json` scripts
- Create `test/` directory
- Create `test/fixtures/` with 2–3 minimal JSONL fixture files:
  - `minimal.jsonl` — 2 user turns, 2 assistant turns (smallest valid session)
  - `with-thinking.jsonl` — session with extended thinking blocks + tool_use
  - `single-turn.jsonl` — 1 user turn only (filtered out by minTurns=2)
- Create `test/helpers.ts` — shared helper: `createTestDb()` (opens temp-file DB with migrations via `openDb()`), `cleanupTestDb()` (close + unlink)

### 1b. `test/chunk.test.ts`
Test `chunkMarkdown()` — pure function, zero dependencies:
- Empty/short text → single chunk at pos 0
- Heading splits → chunks break at `# Heading` boundaries
- Overlap → last ~540 chars of chunk N appear at start of chunk N+1
- Hard split fallback → paragraph-break preference when no headings
- Position tracking → each chunk's `pos` reflects source offset

### 1c. `test/parser.test.ts`
Test `parseSession()`, `extractChunkText()`, `renderMarkdown()`:
- Basic parse: session_id, project, date, title, hash, turn count
- Thinking blocks → `Turn.thinking[]` populated
- Tool summarization → `Turn.tools[]` contains `"Bash: \`cmd\`"` format
- Duration gap-capping → gaps > 15min capped
- Title truncation → max 120 chars
- `extractChunkText()` → `[User]`/`[Assistant]`/`[Tool]` prefixed lines
- `renderMarkdown()` → markdown with `## User`/`## Assistant` headings

### Verification
`bun test` exits 0, all tests green.

**Files touched:** `package.json`, new `test/` directory

---

## Phase 2: Search Tests + RRF Refactor ✅ DONE (2026-03-15)

### 2a. `test/search.test.ts`
Requires temp DB with pre-populated sessions/chunks/embeddings + stub embedder.

Create `test/helpers.ts` additions:
- `insertSession(db, {...})` — insert into sessions table
- `insertChunkWithVec(db, {...})` — insert into chunks + chunks_vec

Test cases:
- Basic search returns results sorted by score
- BM25 matching: text-matching sessions rank higher
- FTS5 sanitization: `.`, `/`, `(` don't crash (KNN-only fallback)
- MAX aggregation: 1 high-relevance chunk beats 5 medium-relevance chunks
- Query caching: second identical query hits `query_cache`
- Empty results: no-match query returns `[]`
- `extractHighlightSnippets()` — direct test with constructed `<mark>` strings

### 2b. RRF Fusion Refactor
**After tests pass**, simplify `src/search.ts` lines 189–255.

Current: 4 maps (`bm25Ranks`, `vecRanks`, `rowidToChunkId`, `chunkIdToRowid`) with O(n^2) reverse lookup at line 239 iterating `rowidToChunkId` to find a chunk_id that `chunkIdToRowid` already maps.

Refactored: single `Map<string, RankEntry>`:
```ts
interface RankEntry { bm25Rank?: number; vecRank?: number; rowid?: number; }
```
- Resolve BM25 rowid → chunk_id immediately via existing DB lookup
- Populate KNN ranks directly
- Single-pass RRF: `score = (bm25Rank ? 1/(K+bm25Rank) : 0) + (vecRank ? 1/(K+vecRank) : 0)`
- Keep `rowid` in entry for highlight lookup (replaces `chunkIdToRowid`)

### Verification
All search tests pass before AND after the RRF refactor. `bun test` all green.

**Files touched:** `src/search.ts`, new `test/search.test.ts`

---

## Phase 3: Indexer Tests + Embedder Injection ✅ DONE (2026-03-15)

### 3a. Embedder Injection Refactor (small, do first)
Change `indexVault` signature from:
```ts
export async function indexVault(db, sourcePath, options, onProgress)
  // line 142: const embedder = await getEmbedProvider();
```
To:
```ts
export async function indexVault(db, sourcePath, options, onProgress, embedder?)
  // when provided, use directly; when omitted, call getEmbedProvider()
```
Zero callers break (all existing call sites omit the param). Matches `search()` which already accepts `embedder` as a parameter.

### 3b. `test/indexer.test.ts`
Uses temp directory with fixture JSONL, temp DB, injected stub embedder.

Test cases:
- Indexes JSONL: session in `sessions`, chunks in `chunks`, embeddings in `chunks_vec`
- Skips unchanged: second call with same JSONL doesn't re-index (hash match)
- Force re-index: `options.force = true` re-indexes despite matching hash
- Min turn filter: single-turn JSONL skipped
- Archive: source copied to archive dir
- ON CONFLICT preserves enrichment when hash unchanged
- ON CONFLICT clears enrichment when hash changes
- `embedSummaryChunks()`: pending summary chunks (seq=-1) get embedded

### Verification
`bun test` all green. Smoke test still passes.

**Files touched:** `src/indexer.ts` (1-line signature change + 1 conditional), new `test/indexer.test.ts`

---

## Phase 4: server.ts Route Extraction ✅ DONE (2026-03-15)

### 4a. Create `src/routes.ts`
Extract each route handler as a standalone function:
```ts
export function handleHealth(db, embedder, ...): Response
export function handleStatus(db, embedder, ...): Response
export async function handleSearch(db, embedder, req): Promise<Response>
export function handleSessions(db, url): Response
export function handleSessionDetail(db, sessionId): Promise<Response>
export function handleSessionMarkdown(db, sessionId): Promise<Response>
export async function handleQueryDb(db, req): Promise<Response>
// ... etc
```

Route grouping:
- **Core API**: `/health`, `/status`, `/search`, `/query_db`, `/projects`, `/settings`
- **Sessions**: `/sessions`, `/sessions/:id`, `/sessions/:id/markdown`
- **Stats**: `/stats/heatmap`
- **Observability**: `/debug/log`, `/debug/config`, `/audit/entries`, `/activity/entries`
- **UI**: SPA shell + static assets (stay in server.ts — trivial)

### 4b. Create `src/lifecycle.ts`
Extract from server.ts:
- `runIncrementalIndex()` (currently lines 457–524)
- `spawnEnrichIfNeeded()` (currently lines 429–452)
- `loadEmbedderWithRetry()` (currently lines 527–561)

These accept their dependencies explicitly (db, embedder, config) instead of closing over module-level variables.

### 4c. Simplify `src/server.ts`
After extraction, server.ts becomes:
1. `main()`: open DB → `Bun.serve()` with thin router dispatching to `routes.ts` → call lifecycle functions
2. Signal handlers
3. Target: ~100–150 lines (down from 582)

### 4d. Server state
Consolidate `embedder`, `embedderError`, `isIndexing` into a typed state object:
```ts
interface ServerState {
  embedder: EmbedProvider | null;
  embedderError: string | null;
  isIndexing: boolean;
}
```
Passed to route handlers and lifecycle functions.

### Verification
`bun test` all green. `bun run smoke-test` passes (end-to-end still works). `wc -l src/server.ts` < 200.

**Files touched:** `src/server.ts` (simplify), new `src/routes.ts`, new `src/lifecycle.ts`

---

## Phase 5: Silent Catch Audit ✅ DONE (2026-03-15)

### Add `console.warn()` to these silent catches:
| File | Line | Context |
|------|------|---------|
| `activity.ts` | 31 | `appendActivity()` — log write failure |
| `activity.ts` | 50 | `getRecentActivity()` — log read failure |
| `config.ts` | 20 | `readConfig()` — config parse failure |
| `indexer.ts` | 105 | `buildJsonlCandidate()` — JSONL parse error |
| `search.ts` | 169 | FTS5 query failure (BM25 fallback) |
| `search.ts` | 313 | Highlight extraction failure |
| `server.ts` | 133 | Enrich progress file read |
| `server.ts` | 324 | `logQuery()` audit write |

### Leave as-is (intentionally silent):
- `process.kill(pid, 0)` checks — expected to throw for dead PIDs
- `unlinkSync` cleanup — file may not exist
- `ALTER TABLE ADD COLUMN` in migrations — "already exists" is expected

### Verification
`bun test` all green. Start daemon, tail log, confirm warnings only appear for actual error conditions.

**Files touched:** `activity.ts`, `config.ts`, `indexer.ts`, `search.ts`, `server.ts` (or `routes.ts` post-Phase 4)

---

## Out of Scope (consciously deferred)

- **app.js refactoring** — vanilla JS SPA, no framework, works fine, poor cost/benefit
- **styles.css cleanup** — cosmetic, low risk
- **Plugin spawn dedup** — qrec-cli.js / qrec-mcp.js overlap is small (~15 lines)
- **Eval Python cleanup** — separate toolchain, independent lifecycle
- **DB query builder** — extracted route handlers make raw SQL more localized; a builder adds abstraction without proportional benefit at this scale
- **Request validation library** — manual validation is fine for 3 POST endpoints on localhost
