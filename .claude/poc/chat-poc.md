# PoC: Qwen3-1.7B Tool Calling for qrec Chat

**Date**: 2026-03-13
**Status**: ✅ Validated — tool calling works, ready to implement

## Hypothesis

Can Qwen3-1.7B use tool calling to query qrec's search/get/query_db endpoints and synthesize useful natural language answers to knowledge retrieval questions?

## Setup

- **Model**: `bartowski/Qwen_Qwen3-1.7B-GGUF` Q4_K_M (cached at `~/.qrec/models/`)
- **Runtime**: node-llama-cpp 3.17.1 via `LlamaChatSession` + `defineChatSessionFunction`
- **Tools**: 3 tools backed by HTTP calls to the live qrec daemon at `localhost:25927`
- **Script**: `chat-poc.ts` (same directory)

```bash
# Prerequisites: qrec daemon must be running
qrec serve --daemon

# Run
bun run .claude/poc/chat-poc.ts "your question"
```

## Tools Exposed

| Tool | Backed by | When model uses it |
|---|---|---|
| `search(query, k)` | `POST /search` | Recall questions, topic lookup |
| `get_session(session_id)` | `GET /sessions/:id/markdown` | Deep-dive into a specific session |
| `query_db(sql)` | `POST /query_db` | Counting, date filtering, project listing |

## Test Results

### Q1: "What have I been working on recently?"
- Called `search("recent sessions", k=5)`
- Synthesized a clean numbered list with dates, projects, summaries
- **Quality**: Good

### Q2: "How did we implement the qrec MCP server?"
- Called `search("qrec MCP server implementation tools", k=1)`
- Returned a relevant answer about the query MCP tool design
- **Quality**: Good (though k=1 was too few; model could be guided to use k=5 default)

### Q3: "How many sessions indexed, which projects have most?"
- Called `query_db("SELECT project, COUNT(*) AS count FROM sessions GROUP BY project ORDER BY count DESC")` — success after semicolon fix
- Returned accurate counts: workspace=62, qrec=51, auto-recall-cc=33
- **Quality**: Excellent — 4.4s total, single tool call

### Q4: "What bugs/errors have I encountered in qrec?"
- Called `search("bugs errors", k=5)`
- Returned 5 specific sessions with bug descriptions and session IDs
- **Quality**: Good — high precision results

## Key Findings

### What works well
- **Tool selection**: Model correctly routes counting questions to `query_db`, recall questions to `search`
- **Error recovery**: SQL failure (wrong syntax) → model acknowledges error, falls back to `search`
- **Multi-tool chaining**: Can call multiple tools in sequence when one fails or more context is needed
- **Answer quality**: Clear, structured, Markdown-formatted, cites session IDs

### Gotchas discovered

**1. `QwenChatWrapper({ thoughts: "discourage" })` is required**
Without it, Qwen3 generates `<think>...</think>` segments and returns `"\n\n"` as the final `onTextChunk` response — the model thinks but produces no visible text.
`/no_think` in the user message does NOT work when using node-llama-cpp's function calling mechanism; the `QwenChatWrapper` API is the correct control point.

**2. Strip trailing semicolons from SQL**
The model consistently generates SQL ending in `;` (e.g. `SELECT ... FROM sessions;`). The `/query_db` endpoint rejects any SQL containing semicolons. Strip with `.trim().replace(/;+$/, "")` in the tool handler before forwarding to the daemon.

**3. Bun segfault on process exit**
After `sequence.dispose() → ctx.dispose() → model.dispose() → llama.dispose()`, calling `process.exit(0)` triggers a segfault in Bun 1.3.10's GC cleanup of native llama.cpp objects.
This does NOT affect answer correctness. In production the model will stay resident as a daemon child process (same pattern as `enrich.ts`), so explicit exits are rare and the segfault is a non-issue.

**4. All GbnfJson schema properties are required**
`defineChatSessionFunction`'s `params` uses `GbnfJsonSchema` where all properties in an object are always required — the `required` field is ignored and has no effect. Design tool params accordingly (either include all as required or handle missing values with defaults in the handler).

## Performance

| Phase | Time |
|---|---|
| Model load (warm cache) | ~3s |
| Simple query (1 tool call) | ~4–8s |
| Complex query (2 tool calls + synthesis) | ~15–22s |
| Peak memory | ~2.6GB |

## Implementation Path

The PoC validates the full architecture. For production:

1. **`src/chat.ts`** — persistent chat child process (lazy-spawned on first request, stays alive)
   - Loads Qwen3 once, exposes HTTP on `localhost:25928`
   - Tool handlers are HTTP calls back to main daemon at `localhost:25927`
   - Uses `QwenChatWrapper({ thoughts: "discourage" })` (confirmed required)
   - Strips trailing semicolons in `query_db` handler

2. **`src/server.ts`** — add `POST /chat` + `GET /chat/status` endpoints, manage chat child lifecycle

3. **`ui/index.html`** — add Chat tab with conversation history, streaming output, loading state
