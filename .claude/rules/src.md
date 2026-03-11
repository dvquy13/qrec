---
paths:
  - src/**
---

# Engine Rules (src/)

See CLAUDE.md §Critical Gotchas for the full list. Quick reference for when you're in src/:

- **node-llama-cpp 3.15.1** — pinned. Do not upgrade without testing against Bun exit.
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
- **`GET /sessions` response format** — returns `{ sessions: [{id, title, project, date, indexed_at}], total }` (full metadata, sorted date DESC). Not just an array of IDs. `/sessions/:id` calls `parseSession(path)` and returns `{ id, title, project, date, turns }`.
- **`POST /query_db` security guard** — string-based: `toUpperCase().startsWith("SELECT")` + no semicolons. Intentional — endpoint is localhost-only (MCP proxy), a full SQL parser would be overkill. Returns `{ rows, count }`.
