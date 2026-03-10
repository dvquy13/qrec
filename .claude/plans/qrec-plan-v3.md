# qrec Refactor Plan v1

Distilled from design review session (2026-03-10). Addresses installation complexity,
auto-indexing reliability, dashboard observability, and UI maintainability.

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

### Phase A — Indexer optimization (prerequisite)
- Add mtime pre-filter to `buildJsonlCandidate` in `indexer.ts`
- Extend `qrec index` (no path arg) to also parse stdin JSON payload for hook compat
- Remove `index-session` command from `cli.ts`

### Phase B — Daemon cron indexing
- Add `setInterval` to `server.ts` that calls `indexVault` incrementally after model is ready
- Default interval: 1 minute (`QREC_INDEX_INTERVAL_MS`, default `60000`); CI uses `5000`
- Guard: skip tick if previous run still in progress
- On daemon startup: run one immediate incremental scan (catchup for sessions missed while offline)
- Wire `serverProgress` to reflect cron-triggered indexing phases

### Phase C — Activity log
- New `src/activity.ts`: `appendActivity(event)`, `getRecentActivity(n)`
- Events: `{ ts, type, data }` where type is `daemon_started | index_started | session_indexed | index_complete`
- Add `GET /activity/entries?limit=N` to `server.ts`
- Write events from daemon cron indexing path

### Phase D — CLI commands
- Add `qrec onboard` to `cli.ts` (sequential: check bun → download model → index → serve → open)
- Add `qrec teardown` to `cli.ts` (stop daemon → confirm → rm -rf ~/.qrec/)
- Update help text

### Phase E — Plugin simplification
- Delete `plugin/scripts/smart-install.js` and `plugin/scripts/bun-runner.js`
- Update `hooks.json` to single SessionStart hook: `qrec serve --daemon`
- Update README: explicit install instructions (npm install -g qrec → qrec onboard → install plugin)

### Phase F — UI consolidation
- Merge 4 HTML files into `ui/index.html` with tab-switching
- Tabs: Dashboard | Search | Activity | Debug
- Dashboard tab: daemon status, session/chunk counts, last indexed, activity feed (polls `/activity/entries`)
- Activity tab: full activity log
- Search tab: search input + results (state preserved on tab switch)
- Debug tab: log viewer + config (from `/debug/log`, `/debug/config`)
- Single polling loop shared across tabs

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

## Open questions

- **`/sessions` endpoint**: Currently returns only IDs. Phase F dashboard may want
  richer metadata (project, date, title, chunk count) for a sessions list view.
