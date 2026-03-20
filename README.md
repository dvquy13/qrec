# qrec

[![GitHub Sponsors](https://img.shields.io/github/sponsors/dvquy13?style=flat&logo=github&label=Sponsor)](https://github.com/sponsors/dvquy13)

Purpose-built session recall engine for Claude Code. Indexes your past Claude conversations locally so you can search them instantly — and so Claude itself can answer questions like *"What was I working on last week?"* or *"How did we implement that auth flow?"*

## Prerequisites

| Requirement | Details |
|---|---|
| **macOS** | Fully supported on Apple Silicon (tested on M2). |
| **Linux** | Supported. NVIDIA GPU strongly recommended for enrichment (tested on Tesla T4 with CUDA 12). |
| **Windows** | Not supported. |
| **[Bun](https://bun.sh)** | v1.1.0+ — auto-installed by the npm postinstall script if not present. |
| **Node.js** | v18+ — only needed to bootstrap the CLI wrapper; Bun handles everything else. |
| **Disk space** | ~500 MB for the embedding model (`embeddinggemma-300M-Q8_0`, ~313 MB) + enrichment model (`Qwen3-1.7B`, ~1.7 GB, downloaded on first `qrec enrich`). |

> **Linux CUDA note:** qrec auto-detects CUDA at startup via `libcuda.so` / `nvidia-smi`. No manual configuration needed — just have the NVIDIA driver installed.

## Install

### Step 1 — Install the CLI

```bash
npm install -g @dvquys/qrec
qrec serve --daemon
```

On first run, the daemon downloads the embedding model (~313 MB) and indexes your Claude sessions at `~/.claude/projects/`. Your browser opens automatically — watch progress there.

### Step 2 — Claude Code plugin (recommended)

Install the plugin to unlock **in-session recall**: Claude can search your past conversations in real time to answer questions about prior work.

```bash
claude plugin marketplace add dvquy13/qrec
```

```bash
claude plugin install qrec@qrec
```

Once installed, you can ask Claude things like:

- *"What was I working on recently?"*
- *"How did we implement the auth flow last month?"*
- *"What did we decide about the database schema?"*
- *"Find that session where we debugged the rate limiter"*

The plugin also ensures the qrec daemon starts automatically with every Claude Code session — no manual `qrec serve` needed.

## Usage

The daemon runs at **http://localhost:25927**. Open it in your browser to search sessions and monitor indexing activity.

```bash
qrec status     # check daemon status
qrec stop       # stop the daemon
```

### Search API

```bash
curl -s -X POST http://localhost:25927/search \
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

### CLI recall

```bash
qrec search "embedding pipeline" --k 5   # search indexed sessions (JSON output)
qrec get <session-id>                     # print full session markdown
```

## Commands

| Command | Description |
|---|---|
| `qrec serve [--daemon]` | Start HTTP server on port 25927; auto-downloads model + indexes on first run |
| `qrec stop` | Stop daemon |
| `qrec teardown` | Stop daemon and remove all qrec data (`~/.qrec/`) |
| `qrec index [path]` | Re-index sessions (default: `~/.claude/projects/`) |
| `qrec search "<query>" [--k N]` | Search indexed sessions (prints JSON) |
| `qrec get <session-id>` | Print full session markdown |
| `qrec status` | Status summary + log tail |
| `qrec enrich [--limit N]` | Backfill session summaries, tags, and entities |

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, testing, and PR guidelines.

## Local dev

```bash
bun install
bun link              # register qrec globally → ~/.bun/bin/qrec
qrec serve --daemon
```

## Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| Search DB | SQLite (FTS5 + sqlite-vec) |
| Embeddings | node-llama-cpp (`embeddinggemma-300M-Q8_0`) |

---

If you find this work useful and want to buy me a coffee, [GitHub Sponsors](https://github.com/sponsors/dvquy13) is the place. Thank you!
