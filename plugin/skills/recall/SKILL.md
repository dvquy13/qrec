---
name: recall
description: >
  Session recall using qrec MCP tools. Invoke when the user asks about past
  conversations, past implementations, previous decisions, "last time we...",
  "how did we...", "what was the approach for...", or any question about prior
  work that may have been discussed in a Claude Code session.
allowed-tools: mcp__qrec__search, mcp__qrec__get, mcp__qrec__status, mcp__qrec__query_db
argument-hint: "<what to recall>"
---

# Session Recall

Use the qrec MCP tools to search past Claude Code sessions and answer questions about prior work.

## Decision rule

- **Structured queries** (dates, project names, counts, listings) → use `query_db` first
- **Content/topic queries** ("how did we implement X?", "what was the approach for Y?") → use `search`

## Workflow

### Structured queries (dates, projects, counts)
1. Call `mcp__qrec__query_db` with a SELECT targeting `sessions.date` or `sessions.project`.
2. Return the results directly — no need to call `search` or `get`.

### Content/topic queries
1. **Search** — call `mcp__qrec__search` with a focused query (concrete nouns: function names, error messages, feature names, file paths). Avoid stop words.
2. **Review results** — each result has `session_id`, `score`, `preview`, `project`, `date`, `title`. Higher score = better match.
3. **Get full session** — for the top 1–2 results, call `mcp__qrec__get` with the `session_id` to read the full conversation.
4. **Synthesize** — answer the user's question based on what you found.

## Search tips

- Use `k=5` for focused recall, `k=10` for broad exploration
- Concrete queries work best: `"FTS5 sanitization"`, `"node-llama-cpp dispose"`, `"MCP stdio shim"`, `"ECONNREFUSED"`, `"embedder cold start"`
- If the first search returns nothing useful, try alternate terminology
- If search returns an error about the daemon not running, tell the user to run `qrec serve --daemon`

## Tool reference

**`mcp__qrec__query_db`**
```
{ sql: string }   // READ-ONLY SELECT, no semicolons
→ { rows: [...], count: number }
```
Examples:
- `SELECT id, title, project, date FROM sessions WHERE date = '2026-03-12' ORDER BY indexed_at DESC`
- `SELECT project, COUNT(*) as sessions FROM sessions GROUP BY project ORDER BY sessions DESC`
- `SELECT id, title, date FROM sessions WHERE project = 'qrec' ORDER BY date DESC LIMIT 10`

**`mcp__qrec__search`**
```
{ query: string, k?: number }
→ { results: [{ session_id, score, preview, project, date, title }] }
```

**`mcp__qrec__get`**
```
{ session_id: string }   // 8-char hex ID from search results
→ full rendered markdown of the conversation
```

**`mcp__qrec__status`**
```
{}
→ { health, session_count, chunk_count, last_indexed, model_loaded, daemon_pid }
```

## Error handling

- `"qrec daemon not running"` → tell user: `qrec serve --daemon`
- Empty results → try a different query or check status
- Status shows `session_count: 0` → daemon is up but hasn't indexed yet; run `qrec index`
