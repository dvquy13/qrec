# qrec Refactor Plan v3

Distilled from design review session (2026-03-10). Addresses installation complexity,
auto-indexing reliability, dashboard observability, and UI maintainability.

## Status — 2026-03-11 ✅ COMPLETE

All phases shipped in PR #4 (`remove-smart-install` branch). CI running.

| Phase | What | Status |
|---|---|---|
| A | Indexer mtime pre-filter + stdin mode + remove index-session | ✅ |
| B | Daemon cron indexing via setInterval | ✅ |
| C | Activity log (src/activity.ts + /activity/entries) | ✅ |
| D | qrec onboard + qrec teardown | ✅ |
| E | Delete smart-install.js + bun-runner.js, simplify hooks.json | ✅ |
| F | ui/index.html SPA consolidating all 4 tabs | ✅ |
| CI | Rewrite to use setup-bun + onboard + cron test | ✅ |

---

---

## Context: What we're fixing

The current design has three interconnected problems:

1. **Installation is too implicit and hard to test.** `smart-install.js` runs on every
   `SessionStart`, installs Bun, spawns a background worker for `bun install` + model
   download, then immediately exits — while the next hook fires `serve --daemon` before
   native addons are compiled. The retry loop in `server.ts` papers over the race but
   makes the whole thing hard to reason about or test on a clean machine.

2. **Auto-indexing via `SessionEnd` hook is fragile.** Hook timeouts, stdin lifecycle
   issues (documented in `bun-runner.js`), and the fact that sessions are appended
   incrementally during a conversation all make the hook-based approach brittle. File
   watching was considered but adds OS-specific complexity (debouncing mid-session writes,
   FSEvents vs inotify) that isn't justified — 5-minute indexing latency is acceptable
   for searching past sessions.

3. **Dashboard has no visibility into out-of-process work.** `serverProgress` is
   in-memory, so when `qrec index` runs as a separate CLI process (hook), the server
   sees nothing. Four separate HTML pages lose state on tab switch and duplicate nav +
   polling boilerplate.

---

## Decisions

### D1 — Explicit installation via `qrec onboard`
Remove `smart-install.js` from hooks entirely. Installation becomes a one-time manual
step the user runs consciously. They see what's happening, errors are visible, and the
sequence is deterministic.

### D2 — Cron-based auto-indexing inside the daemon
Replace the `SessionEnd` hook with a `setInterval` inside the daemon that calls
`indexVault` incrementally every 5 minutes. The checksum map is already implemented
(`sessions.hash` column + hash diff in `indexer.ts:211`). This is 90% already built —
just needs the interval wired into `server.ts`. Indexing runs in-process, so the
dashboard has full visibility.

### D3 — mtime pre-filter in indexer
`buildJsonlCandidate` currently reads every JSONL file to compute its hash. Add an
mtime check first: if `file.mtime < session.indexed_at`, skip without reading. Makes
the cron scan fast even at 1-minute intervals on large collections.

### D4 — `qrec index` absorbs `index-session`
`index-session` is already a thin wrapper. Extend `qrec index` (no-arg form) to also
accept a stdin JSON payload (`{ transcript_path }`) for any remaining hook use cases.
Remove `index-session` from CLI and hooks.

### D5 — Plugin simplification
`hooks.json` becomes a single `SessionStart` hook:
```json
SessionStart → qrec serve --daemon
```
`smart-install.js` and `bun-runner.js` are both removed. qrec is globally installed
(npm or bun link) before the plugin is activated, so no Node→Bun bridge is needed.
The hook invokes `qrec` directly.

### D6 — Activity log for dashboard observability
New `src/activity.ts` — append-only structured log at `~/.qrec/activity.jsonl`.
Written by daemon when indexing runs (events: `index_started`, `session_indexed`,
`index_complete`, `daemon_started`). Server exposes `/activity/entries`. Dashboard
shows a "Recent activity" feed. Replaces the need for cross-process IPC.

### D7 — Single-page UI
Consolidate `dashboard.html`, `search.html`, `audit.html`, `debug.html` into one
`ui/index.html` with JS tab-switching. No framework, no build step. Solves:
- State loss on tab switch (search query, scroll position)
- Nav + polling boilerplate duplication
- Cross-tab navigation (e.g., search result → session detail)

Not migrating to React. If UI complexity grows significantly, Alpine.js is the right
next step before React.

### D8 — `qrec onboard` and `qrec teardown`
Two new CLI commands:

`qrec onboard` — sequential, visible, first-time setup:
1. Check Bun (fail loudly with install URL if missing)
2. Download model if absent (progress bar in CLI)
3. `qrec index` (initial scan with progress)
4. `qrec serve --daemon`
5. Open browser to `http://localhost:3030`

`qrec teardown` — clean removal:
1. `qrec stop` (stop daemon)
2. Remove `~/.qrec/` (DB, model, logs, pid, activity log)
3. Confirm before destructive steps

---

## New CLI surface

```
qrec onboard              # first-time setup (new)
qrec teardown             # remove everything (new)
qrec index [path]         # unchanged; absorbs index-session stdin mode
qrec serve [--daemon]     # unchanged
qrec stop                 # unchanged
qrec status               # unchanged
qrec mcp [--http]         # unchanged
qrec --version            # unchanged

REMOVED:
qrec index-session        # absorbed into qrec index
```

---

## Implementation phases

### Phase A — Indexer optimization (prerequisite) ✅
- Mtime pre-filter is in `indexVault`, not in `buildJsonlCandidate`. Pre-builds a `Map<path, indexed_at>` from the sessions table, then filters the file list before any JSONL reads.
- Stdin detection: `!process.stdin.isTTY` (not `args.length === 0` — the latter breaks when called from scripts that pass empty argv).
- `index-session` removed from `cli.ts`; absorbed into `index` case.

### Phase B — Daemon cron indexing ✅
- `runIncrementalIndex()` extracted as a named async function; called immediately after model loads (startup catchup), then scheduled via `setInterval`.
- `isIndexing` boolean guard prevents overlapping runs (e.g. if indexVault is slow on a large collection).
- `serverProgress.phase` flips to `"indexing"` during cron scans and back to `"ready"` after — dashboard correctly shows indexing state mid-scan.
- `QREC_INDEX_INTERVAL_MS` read once at module load; CI sets to `5000`.

### Phase C — Activity log ✅
- `activity.jsonl` is append-only raw JSONL; `getRecentActivity(n)` reads the whole file and returns last n entries reversed (most recent first). Fine for current scale; revisit if file grows large.
- `session_indexed` event emitted per newly indexed session using `prevIndexed` tracking against the `onProgress` callback — the callback is only called for sessions actually being embedded (already past the hash filter), so this is safe.

### Phase D — CLI commands ✅
- `qrec onboard` intentionally loads + disposes the model before starting the daemon. The daemon loads it fresh. Two model loads is the price of keeping the sequence explicit and testable.
- Skipped the "check Bun" step from the plan — since qrec's shebang is `#!/usr/bin/env bun`, it can't run without Bun in the first place.
- `qrec teardown --yes` skips confirmation prompt (needed for scripted teardown/reset flows).

### Phase E — Plugin simplification ✅
- README update deferred — no README.md exists in the repo yet.
- `package.json` files array cleaned up (removed bun-runner.js and smart-install.js entries).

### Phase F — UI consolidation ✅
- Tab routing uses URL path for initial tab selection (`/search` → search tab, `/audit` → activity tab, `/debug` → debug tab), then switches to hash-based routing on navigation. Old bookmarks still work.
- Old HTML files (`dashboard.html`, `search.html`, etc.) left in place as dead files — harmless, not served.
- Single `setInterval(5000)` drives all tabs; only the active tab's fetch runs (gated by `document.querySelector('.tab-panel.active')`).
- Dashboard activity feed capped at 8 entries; Activity tab shows up to 200.

---

## What stays the same

- `src/search.ts`, `src/chunk.ts`, `src/parser.ts`, `src/embed/`, `src/mcp.ts`, `src/db.ts` — no changes
- `src/daemon.ts` — no changes
- Port 3030 (HTTP), 3031 (MCP HTTP)
- `QREC_EMBED_PROVIDER` and all embed env vars
- `~/.qrec/` directory layout (DB, model, logs, pid)
- Eval pipeline (`eval/`) — untouched

---

## Testing philosophy

**Integration tests only — no unit tests.** Add tests when a bug occurs, not speculatively.

Current CI has 3 of 9 steps testing smart-install.js + bun-runner.js plumbing. After
refactor those disappear. New CI:

```yaml
- setup-bun
- bun install
- type check (bun tsc --noEmit)
- build + verify artifact
- seed fixture sessions
- integration test:
    qrec onboard --no-open      # model load + index + serve --daemon
    poll /health until ready
    POST /search → results > 0
    GET /activity/entries → events logged
    add new fixture session →
      wait for cron (QREC_INDEX_INTERVAL_MS=5000) →
      assert session appears in /sessions
    qrec stop
- npm pack → install -g → qrec --version
```

The cron auto-index flow is the one new test that matters — it covers the primary
user journey (session written → indexed automatically) that previously relied on
the fragile SessionEnd hook.

`qrec onboard` needs a `--no-open` flag to suppress browser open in headless CI.

### CI implementation notes
- **Cron test**: copies a fixture file with a unique filename prefix (`f1f1f1f1-cron-test.jsonl`). Session ID is derived from the filename, not file content (`parser.ts:128`), so a new filename = new session ID even with identical content.
- **Heredoc JSONL**: the inline fixture in the CI `run:` block uses YAML `|` which strips common indentation, so the JSONL lines are not padded with spaces. `JSON.parse` handles leading whitespace anyway.
- **Poll strategy**: integration test polls `/search` for 200 (up to 2 min) rather than `/health`, because `/health` is always 200 but search needs the model loaded. Once search works, the startup index scan is either done or very close.
- **MCP step uses stub**: placed after the integration test (which calls `qrec stop`) to avoid port conflicts.

## Open questions

- **`/sessions` endpoint**: Currently returns only IDs. Dashboard may want richer metadata (project, date, title, chunk count) for a sessions list view. Deferred.
- **Activity log size**: `getRecentActivity` reads the whole file on every request. Fine now, but will need a line-count cap or rotation if the daemon runs for months.
