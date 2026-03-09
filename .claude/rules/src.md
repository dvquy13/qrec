---
paths:
  - src/**
---

# Engine Rules (src/)

See CLAUDE.md §Critical Gotchas for the full list. Quick reference for when you're in src/:

- **node-llama-cpp 3.15.1** — pinned. Do not upgrade without testing against Bun exit.
- **`disposeEmbedder()` before `process.exit()`** — always, in every CLI command that loads the model.
- **FTS5**: sanitize query to `[a-zA-Z0-9\s'-]` before `WHERE text MATCH ?`.
- **Session aggregation**: MAX chunk score per session, not SUM.
- **`createEmbeddingContext({ contextSize: 8192 })`** — required, not optional.
- **`bun:sqlite`** not `better-sqlite3`. **`await Bun.file().text()`** not `.toString()`.
