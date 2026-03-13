# qrec

Purpose-built session recall engine for Claude Code.

## Install

### Step 1 — Install the CLI

```bash
npm install -g @dvquys/qrec
qrec onboard
```

`qrec onboard` downloads the embedding model (~313 MB, once), indexes your Claude sessions at `~/.claude/projects/`, and starts the daemon. Your browser opens automatically to show live progress.

### Step 2 — Claude Code integration (optional)

Install the plugin so the daemon auto-starts with every Claude Code session:

```bash
/plugin marketplace add dvquy13/qrec
/plugin install qrec@dvquy13-qrec
```

That's it — no further configuration needed.

### Local dev

```bash
bun install
bun link        # register qrec globally → ~/.bun/bin/qrec
qrec onboard
```

## Usage

The daemon runs at **http://localhost:3030**. Open it in your browser to search sessions and monitor indexing activity.

```bash
qrec status     # check if daemon is running
qrec stop       # stop the daemon
```

### API

```bash
curl -s -X POST http://localhost:3030/search \
  -H "Content-Type: application/json" \
  -d '{"query": "sqlite vec extension", "k": 5}' | jq .
```

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
  "latencyMs": 58
}
```

### MCP server

```bash
qrec mcp          # stdio (Claude Code MCP config)
qrec mcp --http   # HTTP on port 3031
```

Tools: `search(query, k?)`, `get(session_id)`, `status()`, `query_db(sql)`

## Commands

| Command | Description |
|---|---|
| `qrec onboard` | First-time setup: starts daemon + opens browser immediately; model download + indexing run in background |
| `qrec teardown` | Stop daemon and remove all qrec data (`~/.qrec/`) |
| `qrec index [path]` | Re-index sessions (default: `~/.claude/projects/`) |
| `qrec serve [--daemon]` | Start HTTP server on port 3030 |
| `qrec stop` | Stop daemon |
| `qrec mcp [--http]` | Start MCP server (stdio or HTTP) |
| `qrec status` | Status summary + log tail |
| `qrec enrich [--limit N]` | Backfill session summaries, tags, and entities |

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp 3.17.1 (`embeddinggemma-300M-Q8_0`) |
| MCP | `@modelcontextprotocol/sdk` |
