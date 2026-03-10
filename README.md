# qrec

Purpose-built session recall engine for Claude Code. Keeps an embedding model resident in memory for fast hybrid search (BM25 + vector) over your Claude session transcripts.

- **Warm query**: ~55ms vs ~2600ms cold model load per invocation

## Install

### Claude Code plugin (recommended)

```bash
claude plugin add dvquy13/qrec
```

Restart Claude Code. On the first session start, everything runs automatically:
- Installs Bun if missing
- Downloads the embedding model (~313MB, once)
- Indexes your sessions at `~/.claude/projects/`
- Starts the daemon at `http://localhost:3030`

### npm (CLI / CI)

```bash
npm install -g qrec
qrec index
qrec serve --daemon
```

### Local dev

```bash
bun install
bun link   # registers qrec globally → ~/.bun/bin/qrec
```

## Usage

Once the daemon is running, open **http://localhost:3030** — the onboarding dashboard walks you through the first-run setup and then becomes the search interface.

### Search UI

| URL | Description |
|---|---|
| `http://localhost:3030/` | Dashboard / onboarding + search |
| `http://localhost:3030/audit` | Query audit log |

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
| `qrec index [path]` | Index sessions (default: `~/.claude/projects/`) |
| `qrec index-session <path.jsonl>` | Index a single session file |
| `qrec serve [--daemon]` | Start HTTP server on port 3030 |
| `qrec stop` | Stop daemon |
| `qrec mcp [--http]` | Start MCP server |
| `qrec status` | Status summary + log tail |
| `qrec --version` | Print version |

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp 3.15.1 (`embeddinggemma-300M-Q8_0`) |
| MCP | `@modelcontextprotocol/sdk` |
