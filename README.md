# qrec

Purpose-built session recall engine. Keeps an embedding model resident in memory for fast hybrid search (BM25 + vector) over Claude session transcripts.

- **Cold start**: ~2600ms (per-invocation model load)
- **Warm query**: ~55ms (persistent daemon)

## Install (local dev)

```bash
bun install
bun link   # registers qrec globally → ~/.bun/bin/qrec
```

## Quick Start

### 1. Index sessions

```bash
qrec index                        # index ~/.claude/projects/ (default)
qrec index <path>                 # index a specific dir or .jsonl file
```

### 2. Start the server

```bash
qrec serve --daemon               # background daemon (port 3030)
# or
qrec serve                        # foreground
```

### 3. Search

```bash
curl -s http://localhost:3030/search \
  -H "Content-Type: application/json" \
  -d '{"query": "sqlite vec extension", "k": 5}' | jq .
```

Response shape:
```json
{
  "results": [
    {
      "session_id": "a1b2c3d4",
      "title": "...",
      "date": "2026-03-09",
      "project": "qrec",
      "score": 0.042,
      "preview": "...best matching chunk..."
    }
  ],
  "latency_ms": { "bm25": 1, "embed": 52, "knn": 4, "total": 58 }
}
```

### 4. Fetch a full session

```bash
# GET /sessions lists all indexed sessions
curl -s http://localhost:3030/sessions | jq '.[0]'

# Retrieve full rendered markdown for a session
curl -s http://localhost:3030/sessions/a1b2c3d4
```

### 5. Check status / stop

```bash
qrec status    # sessions count, chunks, daemon PID, log tail
qrec stop      # stop the daemon
```

## MCP Server

```bash
qrec mcp          # stdio (for Claude Code plugin)
qrec mcp --http   # HTTP transport on port 3031
```

Tools: `search(query, k?)`, `get(session_id)`, `status()`

## Commands Reference

| Command | Description |
|---|---|
| `qrec index [path]` | Index sessions (default: `~/.claude/projects/`) |
| `qrec index-session <path.jsonl>` | Index a single session file |
| `qrec index-session` | Index single session from stdin JSON payload (hook mode) |
| `qrec serve [--daemon]` | Start HTTP server on port 3030 |
| `qrec stop` | Stop daemon |
| `qrec mcp [--http]` | Start MCP server |
| `qrec status` | Print status summary |

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp 3.15.1 (`embeddinggemma-300M-Q8_0`) |
| MCP | `@modelcontextprotocol/sdk` |
