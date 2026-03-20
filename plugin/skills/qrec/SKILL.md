---
name: qrec
description: >
  Expert knowledge base for the qrec session recall engine. Invoke automatically
  whenever the user mentions qrec issues, questions, errors, or wants to check
  status, debug problems, re-index sessions, or uninstall. Also use when search
  returns no results or the daemon seems unresponsive.
argument-hint: "[status|debug|re-index|teardown|<any question>]"
---

# qrec Expert Assistant

You are the qrec expert. Use the knowledge below to answer any question.
For specific actions, load and follow the matching sub-file.

**Route based on $ARGUMENTS or user intent:**
- `status` / `health` / "is qrec running?" → **status.md**
- `debug` / `diagnose` / `troubleshoot` / any error message → **debug.md**
- `re-index` / `reindex` / "sessions not showing up" → **re-index.md**
- `teardown` / `uninstall` / `remove` → **teardown.md**
- Empty or open question → answer directly using the knowledge below

---

## What qrec does

qrec is a persistent session recall engine for Claude Code. It indexes every Claude Code conversation into a local SQLite database and provides hybrid BM25 + vector search. Sessions are indexed automatically via a cron loop inside the daemon; the daemon starts automatically when Claude Code opens.

## Architecture

```
SessionStart hook → qrec serve --daemon --no-open  (starts daemon if not running; exits immediately if already up)

Daemon (port 25927)  → loads embedding model in background
                     → cron auto-index every 60s (picks up new/changed sessions)
                     → HTTP server always up; search returns 503 until model ready

HTTP server       → http://localhost:25927   (search UI + REST API)
SQLite DB         → ~/.qrec/qrec.db
Embedding model   → ~/.qrec/models/embeddinggemma-300M-Q8_0.gguf  (~300MB, local)
Server log        → ~/.qrec/qrec.log
PID file          → ~/.qrec/qrec.pid
Activity log      → ~/.qrec/activity.jsonl
```

## CLI commands

```bash
qrec status                          # health + session/chunk counts + log tail
qrec serve --daemon                  # first-time setup + all subsequent starts; auto-downloads model, indexes, opens browser
qrec serve --daemon --no-open        # start without opening browser (used by SessionStart hook)
qrec stop                            # stop daemon
qrec index [path]                    # index path (default: ~/.claude/projects/)
qrec index --force                   # force re-index all sessions from scratch
qrec search "<query>" [--k N]        # search indexed sessions (prints JSON)
qrec get <session_id>                # print full session markdown
qrec enrich [--limit N]              # enrich sessions with summary/tags/entities
qrec teardown [--yes]                # stop daemon + remove ~/.qrec/
qrec --version
```

If `qrec` is not in PATH yet, use the full path:
```bash
node $CLAUDE_PLUGIN_ROOT/scripts/qrec-cli.js <command>
```

## HTTP API (port 25927)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Always 200; `{status, model, indexedSessions}` |
| GET | `/` | Search UI |
| GET | `/audit` | Audit log UI |
| GET | `/debug` | Debug UI |
| POST | `/search` | `{query, k}` → results; 503 until model ready |
| GET | `/sessions` | List sessions |
| GET | `/sessions/:id` | Session detail JSON |
| GET | `/sessions/:id/markdown` | Session full markdown |
| GET | `/audit/entries?limit=N` | Audit log entries |
| GET | `/activity/entries` | Activity log entries |
| GET | `/settings` | Current config |
| POST | `/settings` | Update config |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `QREC_EMBED_PROVIDER` | `local` | `local` / `ollama` / `openai` / `stub` |
| `QREC_PORT` | `25927` | Daemon port |
| `QREC_DIR` | `~/.qrec` | Override data root |
| `QREC_PROJECTS_DIR` | `~/.claude/projects/` | Source sessions directory |
| `QREC_OLLAMA_HOST` | `http://localhost:11434` | Ollama URL |
| `QREC_OLLAMA_MODEL` | `nomic-embed-text` | Ollama model |
| `QREC_OPENAI_KEY` | — | OpenAI-compatible key |
| `QREC_OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible URL |
| `QREC_OPENAI_MODEL` | `text-embedding-3-small` | OpenAI model |

## First-run flow

1. SessionStart fires → hook runs `qrec serve --daemon --no-open`
2. If daemon not running: starts server immediately (Bun.serve binds before model loads)
3. Model downloads from HuggingFace if not cached (~300MB to `~/.qrec/models/`)
4. Initial index of `~/.claude/projects/` runs automatically
5. Hook exits immediately — Claude Code is responsive right away
6. Search returns 503 while model loads; once ready, all searches work
7. Subsequent sessions: daemon already running → hook is a no-op
