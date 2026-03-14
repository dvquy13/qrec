---
paths:
  - ui/**
---

# UI Rules (ui/)

- **Sessions tab is NOT polled** — the 5s `setInterval` in `app.js` refreshes dashboard and activity only. Do NOT add `sessions` back to the polling interval: `loadSessions()` resets `_allSessions`, replaces `innerHTML` with a spinner, and resets scroll to top — destroying infinite scroll state mid-browse.

- **Sessions list uses IntersectionObserver for infinite scroll** — `#sessions-sentinel` (1px div after `#sessions-grid`) triggers `loadMoreSessions()` when it enters the viewport. `loadMoreSessions()` uses `insertAdjacentHTML('beforeend', ...)` to append cards without replacing `innerHTML` (which would jump scroll to top). `renderSessionsList()` does a full rebuild and is only called on initial load or filter changes.

- **`_allSessions` is append-only during a session** — `loadSessions()` resets it (called once on tab activation); `loadMoreSessions()` concatenates. Never call `loadSessions()` to "refresh" while the user is browsing — they lose their scroll position and all loaded pages.

- **UI is served fresh** — `index.html`, `app.js`, `styles.css` are served fresh on every request (no cache headers). Browser refresh picks up UI changes without a daemon restart.

- **Use `data-run-ts` (not `data-session-ids`) as the open-state key for run groups** — Multiple runs can process the same session IDs (e.g. two enrich runs both processed `3f3e7a7a`), so `data-session-ids` is not unique per run. Using it caused all matching groups to restore as open on every 5s poll. `data-run-ts` (the run's start timestamp) is unique per run.

- **`_visibleRunCount` resets only in `onTabActivated`, not in `renderActivityRuns`** — Resetting it on every render (every 5s poll) collapses the list back to 5 items whenever the user has clicked "show more". Only reset when the user navigates to the dashboard tab.

- **Activity state vars must be declared before `navigate(initHash, false)` at line ~37** — `navigate()` fires synchronously at module load, which calls `onTabActivated('dashboard')`, which references `RUNS_INITIAL` and `_visibleRunCount`. If those `const`/`let` declarations appear later in the file, they are in the TDZ and throw `ReferenceError`. Keep them at the very top of `app.js`.

- **`loadRecentSessions()` is guarded by `_lastRenderedSessionCount`** — fetches `/sessions?offset=0` only when `data.sessions !== _lastRenderedSessionCount`. Without the guard, it fires a DB query + HTTP roundtrip on every 5s dashboard poll. Update `_lastRenderedSessionCount` on both the success path and the empty-state early return.

- **Dashboard uses a single 6-card stats grid** — all 6 metrics (sessions/chunks/searches + embed provider/last indexed/AI summaries) live in one `grid-template-columns: repeat(3, 1fr)` grid. Row-2 cards use the `.stat-card--info` modifier (smaller `font-size` on `.stat-value`). Do not reintroduce a separate `.info-grid` — it broke alignment with the `h2` and required extra CSS to handle.

- **Dashboard "● Running" pill and "↻ Refresh" button were intentionally removed** — both are redundant: the page loading proves the daemon is up, and the dashboard auto-polls every 5s. Don't add them back.
