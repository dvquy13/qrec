# Onboarding Flow & Recent Activity UI — Learnings

Session: 2026-03-15. Status: **complete** ✅

---

## Bugs Fixed

### 1. `--fresh-models` still used legacy model path
**File**: `src/embed/local.ts`
Legacy path (`~/.cache/qmd/models/...`) was checked before `MODEL_CACHE_DIR`, and it's hardcoded to `homedir()` — not derived from `QREC_DIR`. With `QREC_DIR` overridden, the legacy check should be skipped.
**Fix**: Skip legacy path when `process.env.QREC_DIR` is set.

### 2. `groupActivityEvents` prematurely closed enrich group
**File**: `ui/app.js`
The parser used a single `current` cursor. When `index_started` arrived mid-enrich (cron fires every 60s), it closed the enrich group before `session_enriched` events arrived — causing "Enriching... 0/N" to stick forever.
**Fix**: Dual cursors (`curIndex` / `curEnrich`) — index and enrich events are independent.

### 3. `enrich_model_downloading` flooding activity.jsonl (362 events)
**Files**: `src/enrich.ts`, `src/activity.ts`, `src/server.ts`, `ui/app.js`
The `pct === 100` throttle condition fired on every callback after download complete, spamming hundreds of events and pushing `enrich_started` out of the `limit=500` window.
**Fix**: Route download progress to `~/.qrec/enrich-progress.json` (written by enrich child, read by server.ts, exposed as `data.enrichProgress` in `/status`). Activity now only gets `enrich_model_loaded`. Removed `enrich_model_downloading` from `ActivityType`.

### 4. Stale "Enriching..." spinner (10-minute timeout)
**File**: `ui/app.js`
When enrich process crashed before writing `enrich_complete`, the spinner stayed for 10 minutes.
**Fix**: Cross-reference `data.enriching` from `/status`. If process is dead and run is open >30s, mark it closed immediately.

### 5. "ongoing sessions" label
**File**: `ui/app.js`
`"${n} ongoing sessions"` was shown when `data.enriching === false` — it meant *pending*, not *active*. Renamed to `"${n} pending"`.

### 6. onboard-test scripts using global `qrec`
**Files**: `scripts/onboard-test-start.sh`, `scripts/onboard-test-stop.sh`
`~/.bun/bin/qrec` pointed to the globally installed npm version, not the worktree. All test runs were running published code.
**Fix**: Scripts now use `bun run $SCRIPT_DIR/../src/cli.ts` directly — always runs the worktree.

### 7. Browser caching `app.js` / `styles.css`
**File**: `src/server.ts`
Static file responses had no `Cache-Control` headers; browsers cached aggressively.
**Fix**: Added `Cache-Control: no-cache, no-store, must-revalidate` to `serveStaticFile`.

### 8. Download rows disappeared from Recent Activity after completion
**Files**: `src/activity.ts`, `src/enrich.ts`, `src/embed/local.ts`, `ui/app.js`
`buildEnrichModelSyntheticGroup` Phase 2 hid itself when `enrich_complete.ts > enrich_model_loaded.ts`. `buildModelSyntheticGroup` disappeared as soon as `phase` left `model_download`/`model_loading`. Neither wrote a permanent record.
**Fix**: Emit permanent activity events at download completion:
- `enrich_model_downloaded` — written by `enrich.ts` before deleting `enrich-progress.json`; carries `{ totalMB }`
- `embed_model_downloaded` — written by `embed/local.ts` after `resolveModelFile` returns; only emitted when a download actually occurred (`totalMB !== null`, not a cache hit)

Both synthetic group builders now have a Phase 2 that reads the respective activity event and return a permanent `running: false` entry. No hide condition.

### 9. Synthetic groups always sorted above real groups
**File**: `ui/app.js`
`renderActivityRuns` prepended synthetics unconditionally (`[...synthetics, ...real]`), so "Enrichment model downloaded" appeared above "Enriching..." regardless of timestamps.
**Fix**: Merge and sort all groups by `ts` descending — chronological order regardless of source.

### 10. Progress bar shown on completed download rows
**File**: `ui/app.js`
`buildRunProgressHtml` was called whenever `group.syntheticProgress` was set, including `running: false` completed entries.
**Fix**: Gate on `group.running && group.syntheticProgress`.

### 11. "Show N older runs" button non-functional after expand
**File**: `ui/app.js`
`showMoreRuns()` set `_visibleRunCount = _allRunGroups.length` (real groups only). `displayGroups` includes synthetic entries too, so `hidden = displayGroups.length - _visibleRunCount` was always N (number of synthetics) — clicking the button set the same value, no change. Synthetic entries (e.g. "Embedding model downloaded") were permanently hidden behind the button.
**Fix**: `showMoreRuns()` sets `_visibleRunCount = Infinity`.

---

## Architecture Notes

- `data.enrichProgress` in `/status` = `{ percent, downloadedMB, totalMB } | null` — present only during active enrich model download; written by enrich child, deleted on model load
- `ENRICH_PROGRESS_FILE` = `$QREC_DIR/enrich-progress.json` (added to `dirs.ts`)
- Dual-cursor activity parser: `curIndex` / `curEnrich` tracked independently — concurrent index cron + enrich runs don't corrupt each other
- Synthetic group lifecycle (both embed + enrich model):
  - Phase 1 (active): live progress from `serverProgress` / `data.enrichProgress`
  - Phase 2 (complete): permanent `running: false` entry from `embed_model_downloaded` / `enrich_model_downloaded` activity events
- `showMoreRuns()` uses `Infinity` for `_visibleRunCount` — avoids synthetic/real count mismatch
- `onboard-test-start.sh --fresh-models`: skips model symlink AND skips legacy path check (via `QREC_DIR` env), forcing full download flow
