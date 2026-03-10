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

qrec is a persistent session recall engine for Claude Code. It indexes every Claude Code conversation into a local SQLite database and provides hybrid BM25 + vector search. Sessions are indexed automatically as they close; the daemon starts automatically when Claude Code opens.

## Architecture

```
SessionStart hook → smart-install.js  (first-run: background bun install + model download)
                  → qrec serve --daemon  (HTTP server, port 3030)

SessionEnd hook   → qrec index-session  (indexes the just-closed session)

HTTP server       → http://localhost:3030   (search UI + REST API)
MCP server        → stdio  or  http://localhost:3031
SQLite DB         → ~/.qrec/qrec.db
Embedding model   → ~/.qrec/models/embeddinggemma-300M-Q8_0.gguf  (~300MB, local)
Server log        → ~/.qrec/qrec.log
Install log       → ~/.qrec/install.log
PID file          → ~/.qrec/qrec.pid
Install marker    → $CLAUDE_PLUGIN_ROOT/.install-version
```

## CLI commands

```bash
qrec status                          # health + session/chunk counts + log tail
qrec serve --daemon                  # start HTTP server in background
qrec stop                            # stop daemon
qrec index [path]                    # index path (default: ~/.claude/projects/)
qrec index-session <path.jsonl>      # index a single session file
qrec mcp [--http]                    # MCP server (stdio or port 3031)
qrec --version
```

If `qrec` is not in PATH yet (background install still running), use the full path:
```bash
node $CLAUDE_PLUGIN_ROOT/scripts/bun-runner.js \
     $CLAUDE_PLUGIN_ROOT/scripts/qrec.cjs <command>
```

## HTTP API (port 3030)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Always 200; `{status, model, indexedSessions}` |
| GET | `/` | Search UI |
| GET | `/audit` | Audit log UI |
| POST | `/search` | `{query, k}` → results; 503 until model ready |
| GET | `/sessions` | List session IDs |
| GET | `/audit/entries?limit=N` | Audit log |

## MCP tools: `search(query, k)` · `get(session_id)` · `status()`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `QREC_EMBED_PROVIDER` | `local` | `local` / `ollama` / `openai` / `stub` |
| `QREC_OLLAMA_HOST` | `http://localhost:11434` | Ollama URL |
| `QREC_OLLAMA_MODEL` | `nomic-embed-text` | Ollama model |
| `QREC_OPENAI_KEY` | — | OpenAI-compatible key |
| `QREC_OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible URL |
| `QREC_OPENAI_MODEL` | `text-embedding-3-small` | OpenAI model |

## First-run flow

1. SessionStart fires → `smart-install.js` checks `.install-version` marker
2. If first run: spawns **background process** (detached, non-blocking) that does:
   - `bun install` in plugin dir (node-llama-cpp, sqlite-vec)
   - Downloads embedding model from HuggingFace (~300MB)
   - Initial index of `~/.claude/projects/`
   - Writes `.install-version` marker when complete
3. Hook exits immediately — Claude Code is responsive right away
4. Daemon starts — HTTP server up instantly, model loads in background
5. Server retries model loading every 30s (up to 10×) — self-heals once install finishes
6. Subsequent sessions: marker matches → fast path, exits in <1s

Track progress: `tail -f ~/.qrec/install.log`
