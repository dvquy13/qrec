# qrec

Purpose-built session recall engine for Claude Code. Keeps an embedding model resident in memory for fast hybrid search (BM25 + vector) over your Claude session transcripts.

- **Warm query**: ~55ms vs ~2600ms cold model load per invocation

## Install

### Claude Code plugin (recommended)

```bash
/plugin marketplace add dvquy13/qrec
/plugin install qrec@dvquy13-qrec
```

Then run first-time setup:

```bash
qrec onboard
```

`qrec onboard` downloads the embedding model (~313 MB, once), indexes your Claude sessions, and starts the daemon. Your browser opens automatically to show live progress.

After that, the plugin auto-starts the daemon on every Claude Code session — nothing else to configure.

### npm (CLI / CI)

```bash
npm install -g qrec
qrec onboard
```

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

Tools: `search(query, k?)`, `get(session_id)`, `status()`

## Commands

| Command | Description |
|---|---|
| `qrec onboard` | First-time setup: model download + index + start daemon + open browser |
| `qrec teardown` | Stop daemon and remove all qrec data (`~/.qrec/`) |
| `qrec index [path]` | Re-index sessions (default: `~/.claude/projects/`) |
| `qrec serve [--daemon]` | Start HTTP server on port 3030 |
| `qrec stop` | Stop daemon |
| `qrec mcp [--http]` | Start MCP server (stdio or HTTP) |
| `qrec status` | Status summary + log tail |

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp 3.15.1 (`embeddinggemma-300M-Q8_0`) |
| MCP | `@modelcontextprotocol/sdk` |
