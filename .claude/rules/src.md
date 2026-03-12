---
paths:
  - src/**
---

# Engine Rules (src/)

See CLAUDE.md §Critical Gotchas for the full list. Quick reference for when you're in src/:

- **node-llama-cpp 3.17.1** — Bun exit segfault fixed in 3.17.0; 3.17.1 confirmed clean under Bun 1.3.10.
- **`disposeEmbedder()` before `process.exit()`** — always, in every CLI command that loads the model.
- **FTS5**: sanitize query to `[a-zA-Z0-9\s'-]` before `WHERE text MATCH ?`.
- **Session aggregation**: MAX chunk score per session, not SUM.
- **`createEmbeddingContext({ contextSize: 8192 })`** — required, not optional.
- **`bun:sqlite`** not `better-sqlite3`. **`await Bun.file().text()`** not `.toString()`.
- **node-llama-cpp dynamic import only** — `node-llama-cpp` is ESM with top-level `await`. Any static `import` from it in a file bundled into `qrec.cjs` crashes with `require() async module` at load time. Use `const { getLlama } = await import("node-llama-cpp")` inside the async function that needs it.
- **esbuild shebang** — esbuild preserves the `#!/usr/bin/env bun` shebang from `src/cli.ts`. Never add `banner: { js: "#!/usr/bin/env bun" }` in `build.js` — produces a duplicate shebang on line 2, which Bun rejects as a syntax error.
- **server.ts: `Bun.serve()` must come before `getEmbedProvider()`** — server binds immediately; model loads in background. `/health` always 200; `/search` 503 until ready. Reversing this order breaks the daemon's 30s health-check on slow CI runners and real user machines with cold model loads.
- **Embed factory**: use `getEmbedProvider()` from `embed/factory.ts` — never import `local.ts`/`ollama.ts`/`stub.ts` directly. Direct imports silently ignore `QREC_EMBED_PROVIDER`.
- **Model download**: use `resolveModelFile(uri, { directory, onProgress })` — NOT `createModelDownloader`. HF URI must be full `hf:<user>/<repo>/<file>`; short form without inner repo path returns 401 from HF manifest API.
- **`serverProgress`** in `src/progress.ts` — shared mutable state for server.ts dashboard. `local.ts` and `indexer.ts` write to it directly (not via embed factory). This is the one place where direct import of a non-provider module is intentional.
- **JSONL thinking blocks** — `type: "thinking"` blocks carry the content in a `thinking` field (not `text`); extracted into `Turn.thinking: string[]` by `parser.ts`. Note: connector phrases before tool calls ("Now let me read…") are `type: "text"` in `type: "assistant"` entries — structurally identical to final response text. No field distinguishes them.
- **`GET /sessions` response format** — returns `{ sessions: [{id, title, project, date, indexed_at, summary, tags, entities}], total }` (full metadata, sorted date DESC). `tags`/`entities` are parsed arrays (null when unenriched). `/sessions/:id` also includes `summary`, `tags`, `entities`.
- **`sessions` table: `ON CONFLICT DO UPDATE SET` not `INSERT OR REPLACE`** — SQLite `REPLACE` is DELETE+INSERT; all unspecified columns (including `summary`, `tags`, `entities`, `enriched_at`, `enrichment_version`) go to NULL on re-index. Use `ON CONFLICT(id) DO UPDATE SET col = CASE WHEN excluded.hash != sessions.hash THEN NULL ELSE sessions.col END` to preserve enrichment when content is unchanged and clear it only when content changed (so re-enrichment is triggered).
- **Summary chunk convention** — `{session_id}_summary` with `seq=-1, pos=-1` sentinels. Inserted by `enrich.ts` after enrichment. Indexer's `DELETE FROM chunks WHERE session_id = ?` removes it on re-index; `deleteVec WHERE chunk_id LIKE '{id}_%'` also covers it — no orphaned vec entries.
- **Qwen3 `/no_think` prefix** — Qwen3 models default to chain-of-thought thinking mode. Prefix the user prompt with `/no_think` to disable it and halve latency. Required in `summarize.ts`; omitting it doubles per-session time.
- **`contextSize: 8192` applies to summarizer too** — same lesson as embedder. Default context causes truncation on long session transcripts fed to Qwen3-1.7B.
- **`POST /query_db` security guard** — string-based: `toUpperCase().startsWith("SELECT")` + no semicolons. Intentional — endpoint is localhost-only (MCP proxy), a full SQL parser would be overkill. Returns `{ rows, count }`.
