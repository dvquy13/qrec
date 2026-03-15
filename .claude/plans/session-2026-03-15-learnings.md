# Session Learnings — 2026-03-15

## Timestamps
- **`date` field** (YYYY-MM-DD from first message) was already correct for grouping/filtering.
- **Relative timestamps in UI** were using `indexed_at` instead of `last_message_at`. Fixed in `/sessions` API, search results, and all three UI display locations.
- **`last_message_at` was NULL for all pre-existing sessions** — column was added after they were indexed. Fix: clean reset + re-index from scratch rather than a backfill migration.

## Archive Auto-Index on Startup
- `reset.sh` wipes the DB but preserves `~/.qrec/archive/`. After a reset, sessions Claude deleted from `~/.claude/projects/` existed only in the archive.
- Added: on startup initial index, after indexing the live dir, also index `~/.qrec/archive/` — recovers deleted sessions automatically.
- **Self-copy bug fix** (`archiveJsonl`): skip archiving if source path is already inside `ARCHIVE_DIR` — was producing `ENOENT: copyfile src → src` spam when indexing the archive directory.

## Enrich / Stop Lifecycle
- `reset.sh` called `qrec stop` which killed the daemon but NOT the detached enrich child. The orphaned enrich process kept writing to the old (deleted) DB inode — enrichment appeared to work but nothing landed in the new DB.
- **Fix**: `stopDaemon()` in `daemon.ts` now also SIGTERMs the enrich PID from `enrich.pid` before cleaning up.
- `reset.sh` now also removes `activity.jsonl` — old events (hundreds of stale `index_started` entries) were polluting the activity view and pushing the 500-event window.

## Parallel Indexing + Enriching
- **Root cause of no parallel**: `setInterval(spawnEnrichIfNeeded, INDEX_INTERVAL_MS)` was set up AFTER `await runIncrementalIndex(true)` completed. Enrich cron never fired during indexing.
- **Fix**: move enrich cron setup to BEFORE `runIncrementalIndex(true)` so it ticks during the initial index.
- Initial `spawnEnrichIfNeeded()` call (before any sessions exist) correctly skips — pending check with age gate returns 0.

## Age Gate
- Removed `COALESCE(last_message_at, indexed_at)` fallback from enrich age gate in both `enrich.ts` and `spawnEnrichIfNeeded` in `server.ts`. Age should always mean session time, not index time. Sessions with `NULL last_message_at` are excluded (correct — they need re-indexing).
- **`spawnEnrichIfNeeded` pending check** must mirror the age gate used in `enrich.ts` exactly (`last_message_at < now - ENRICH_IDLE_MS`) — otherwise the server spawns the child and the child immediately exits with "no pending sessions", causing a brief phantom `enriching=true` with no `enrich_started` activity event.

## Activity UI Bugs Fixed
- **Two spinning index runs**: `daemon_started` was closing open runs by pushing them to `groups` without setting `running = false`. Fix: set `running = false` before pushing when closing due to daemon restart.
- **Stale timeout closing active enrich**: 10-min stale timeout in `groupActivityEvents` fired on long-running enrich (30+ min for 239 sessions). Fix: moved stale logic out of `groupActivityEvents` into `showDashboardPanel` where `data.enriching` is available — enrich groups are never stale-closed while `data.enriching = true`.
- **Enrich spinner not showing**: `enrich_started` from a previous daemon run sat before the current `daemon_started` → grouper closed it → subsequent `session_enriched` events had no open group. Root cause was orphaned enrich process (fixed above).

## UI Improvements
- **"X / Y" progress format**: unified index and enrich running detail to `"${n} / ${total}"` — uses `_liveIndexing.total` from `/status` for index, `startEvent.data.pending` for enrich.
- **AI Summaries dot**: moved flashing dot from stat value to stat label (consistent with Sessions card and Recent Activity dot). Used same `stat-indexing-dot` CSS class + `visible` toggle pattern.
- **Model name in expanded rows**: `/status` now returns `embedModel` and `enrichModel`. Shown as first line in expanded Indexing/Enriching activity rows via `.run-model-info` (monospace, muted).
- **`last_message_at` in sessions list and search**: `/sessions` and search results now include `last_message_at`; UI uses it for relative timestamps instead of `indexed_at`.

## Enrich X/Y Format
- Aligned enrich running detail from `"${done}/${pending} sessions"` to `"${done} / ${pending}"` — consistent with index format, label provides context.
