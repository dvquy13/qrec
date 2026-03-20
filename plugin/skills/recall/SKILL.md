---
name: recall
description: >
  Session recall using qrec CLI. Invoke when the user asks about past
  conversations, past implementations, previous decisions, "last time we...",
  "how did we...", "what was the approach for...", or any question about prior
  work that may have been discussed in a Claude Code session.
allowed-tools: Bash
argument-hint: "<what to recall>"
---

# Session Recall

Use the qrec CLI to search past Claude Code sessions and answer questions about prior work.

## Workflow

1. **Search** — run `qrec search "<query>" --k 10`. Use concrete nouns from the topic (function names, error messages, feature names).
2. **Review results** — check titles, dates, and previews in the JSON output. If the top results don't match, run up to 2 more searches with different phrasings before giving up.
3. **Get full session** — for the top 1–2 matching results, run `qrec get <session_id>` to read the full conversation.
4. **Synthesize** — answer the user's question based on what you found.

## Commands

```bash
qrec search "<query>" --k 10
# → JSON: { results: [{ session_id, score, preview, project, date, title }], latencyMs }

qrec get <session_id>
# → full rendered markdown of the session (8-char hex ID from search results)
```

## Error handling

- `ECONNREFUSED` → tell user: `qrec serve --daemon`
- Empty results → try a different query phrasing
