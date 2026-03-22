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

**Does the prompt contain any recency signal?** Words like "latest", "recent", "pick up", "continue from", "what were we working on", "last time", "last session" — even mixed with topic words like "the latest session on remotion demo" — always mean **browse first**. Recency signals override topic keywords; don't let topic words push you into semantic search.

1. Run `qrec search --k 10` (no query → browse mode, date-sorted latest first). You may add `--project <name>` if the project is unambiguous, but never add a query string.
2. Scan `project`, `title`, `date` fields. Pick the session that best matches the current context — topic words in the prompt help you recognize the right session, not find it via search.
3. Run `qrec get <session_id>` and summarize what was in progress.

**No recency signal — pure topic search** — user asks about a specific past decision, implementation, bug, or feature with no "latest/continue" framing:
1. Run `qrec search "<query>" --k 10` with concrete nouns (function names, error messages, feature names). Narrow with `--project <name>`, `--tag <tag>`, `--from`/`--to YYYY-MM-DD` if helpful.
2. If top results don't match, try up to 2 different phrasings.
3. Run `qrec get <session_id>` on the top 1–2 matches and synthesize.

**Uncertain intent**: browse first (`qrec search --k 10`), fall back to semantic only if nothing relevant surfaces.

## Commands

```bash
# Browse mode — no query, date-sorted (latest first)
qrec search --k 10                              # 10 most recent sessions (all projects)
qrec search --project <name> --k 10            # filter to a known project name
qrec search --project <name> --tag <tag> --k 10

# Semantic search
qrec search "<query>" --k 10
qrec search "<query>" --project <name> --k 10

qrec get <session_id>   # full session markdown (8-char hex ID from results)
```

## Error handling

- `ECONNREFUSED` → tell user: `qrec serve --daemon`
- Empty results → try a different query phrasing
