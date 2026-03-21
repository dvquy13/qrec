# CLI: Extend `qrec search` with filter flags

## Goal
Mirror the web UI's search + browse UX from the command line.

## Behaviour

**With query → POST /search + filters (semantic + BM25, ranked by relevance)**
```bash
qrec search "auth bug" --project api --tag security
qrec search "race condition" --from 2026-03-01 --to 2026-03-15
```

**No query + filters → GET /sessions (browse mode, date-sorted — matches web UI empty-query behaviour)**
```bash
qrec search --project qrec --k 10
qrec search --tag bug
```

**No query, no filters → current error (unchanged)**
```bash
qrec search   # still errors: requires query or at least one filter
```

## Flags to add
| Flag | Maps to | Notes |
|---|---|---|
| `--project <name>` | `project` | substring match (server-side LIKE) |
| `--tag <tag>` | `tag` | substring match |
| `--from <YYYY-MM-DD>` | `dateFrom` | inclusive |
| `--to <YYYY-MM-DD>` | `dateTo` | inclusive |
| `--k N` | `k` / `LIMIT` | already exists; applies to both paths |

## Implementation — `src/cli.ts`

```ts
case "search": {
  const positional = args.filter(a => !a.startsWith("--"));
  const query = positional.join(" ").trim();

  const kIdx    = args.indexOf("--k");
  const k       = kIdx !== -1 ? parseInt(args[kIdx + 1], 10) : 10;
  const project = args[args.indexOf("--project") + 1] ?? null;   // if --project missing, idx=-1 → args[0] which is fine to guard
  const tag     = args[args.indexOf("--tag")    + 1] ?? null;
  const from    = args[args.indexOf("--from")   + 1] ?? null;
  const to      = args[args.indexOf("--to")     + 1] ?? null;

  const hasFilter = project || tag || from || to;
  if (!query && !hasFilter) {
    console.error('[cli] Usage: qrec search "<query>" [--project P] [--tag T] [--from DATE] [--to DATE] [--k N]');
    process.exit(1);
  }

  if (query) {
    // POST /search — semantic + BM25 with optional filters
    const body: Record<string, unknown> = { query, k };
    if (project) body.project = project;
    if (tag)     body.tag     = tag;
    if (from)    body.dateFrom = from;
    if (to)      body.dateTo   = to;
    const res = await fetch(`http://localhost:${getQrecPort()}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    ...
  } else {
    // GET /sessions — browse mode, date-sorted
    const params = new URLSearchParams({ offset: "0", limit: String(k) });
    if (project) params.set("project", project);
    if (tag)     params.set("tag", tag);
    if (from)    params.set("dateFrom", from);
    if (to)      params.set("dateTo", to);
    const res = await fetch(`http://localhost:${getQrecPort()}/sessions?${params}`);
    ...
  }
}
```

## Output format
- Search mode: existing JSON (unchanged)
- Browse mode: same shape as search results where possible — print `title`, `project`, `date`, `summary` (truncated), `tags`; no `score` field (not ranked)

## Concerns / open questions
- `GET /sessions` currently returns `{ sessions, total, offset, limit }` — different shape from `POST /search` `{ results }`. Browse mode output should be normalised to be useful in Claude's context (not raw JSON dump). Consider printing a compact table or the same fields as search mode.
- `--k` default: search mode defaults to 10 (current); browse mode should also default to 10 (not 100 like the web UI).
- Flag collision: `args[args.indexOf("--project") + 1]` breaks if `--project` is last arg with no value. Add a helper `flagValue(args, flag)` that returns `null` in that case.

## Dependencies
None — fully independent.

## Files changed
- `src/cli.ts` — search case only
