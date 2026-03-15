---
paths:
  - ui/**
---

# UI Rules (ui/)

## Design System

**Typography**
- Page headings: `.section-heading` — 32px, weight 700, letter-spacing -0.04em. Every tab gets one at the top.
- Stat values on dashboard: 32px, weight 400, letter-spacing -0.04em (large numbers feel light).
- Session card titles: 18px, weight 500. Turn accent blue on card hover.

**Color philosophy: black/white at rest, primary blue on interaction**
- Interactive elements are neutral by default and reveal `var(--accent)` (#0062a8) only on hover — never pre-colored except when actively selected/active.
- Tags (`.enrich-tag`): transparent background, dark border + dark text at rest → border + text turn accent on hover. No fill ever.
- Clickable metadata (project, date chips in cards): text turns accent on hover, no background change.
- Buttons (Search, filter actions): transparent background + dark border at rest → accent fill + white text on hover.
- Card titles: inherit text color at rest → turn accent on parent card hover.

**Minimal chrome**
- No card shadows or backgrounds. Cards are transparent; hover may add a subtle bg (`var(--bg)`) but never a shadow.
- Borders are structural only (separating content regions), not decorative. Default border color: `var(--border)` (#e2e8f0).
- Avoid vertical borders inside components (e.g. `.stat-item` column separators) — use spacing instead.

**Alignment: one left axis**
- All block elements — page heading, search bar, filter row, cards, section headers — share the same left edge (no horizontal padding offset). Two competing left edges is a defect.
- `.section-header`: `padding: 11px 0` (no horizontal indent).
- `.session-card`: `padding: 14px 0` (no horizontal indent).
- Any new component that introduces a left indent will misalign with the page heading above it.

---

- **Sessions tab is NOT polled** — the 5s `setInterval` in `app.js` refreshes dashboard and activity only. Do NOT add `sessions` back to the polling interval: `loadSessions()` resets `_allSessions`, replaces `innerHTML` with a spinner, and resets scroll to top — destroying infinite scroll state mid-browse.

- **Sessions list uses IntersectionObserver for infinite scroll** — `#sessions-sentinel` (1px div after `#sessions-grid`) triggers `loadMoreSessions()` when it enters the viewport. `loadMoreSessions()` uses `insertAdjacentHTML('beforeend', ...)` to append cards without replacing `innerHTML` (which would jump scroll to top). `renderSessionsList()` does a full rebuild and is only called on initial load or filter changes.

- **`_allSessions` is append-only during a session** — `loadSessions()` resets it (called once on tab activation); `loadMoreSessions()` concatenates. Never call `loadSessions()` to "refresh" while the user is browsing — they lose their scroll position and all loaded pages.

- **UI is served fresh** — `index.html`, `app.js`, `styles.css` are served with `Cache-Control: no-cache, no-store, must-revalidate`. Browser refresh always picks up changes without a daemon restart.

- **Use `data-run-ts` (not `data-session-ids`) as the open-state key for run groups** — Multiple runs can process the same session IDs (e.g. two enrich runs both processed `3f3e7a7a`), so `data-session-ids` is not unique per run. Using it caused all matching groups to restore as open on every 5s poll. `data-run-ts` (the run's start timestamp) is unique per run.

- **`_visibleRunCount` resets only in `onTabActivated`, not in `renderActivityRuns`** — Resetting it on every render (every 5s poll) collapses the list back to 5 items whenever the user has clicked "show more". Only reset when the user navigates to the dashboard tab.

- **`applyFilters` must never call `doSearch` or `loadSessions` synchronously from within `doSearch`/`loadSessions`** — `doSearch` previously called `applyFilters()` at the end, and `applyFilters` re-ran `doSearch()` → infinite loop. Fix: `doSearch` and `loadSessions` render results directly; `applyFilters` only re-triggers them as top-level entry points (e.g. from `oninput`, preset clicks).

- **Debounce `applyFilters` for server-side text filters** — `oninput` on project/tag inputs fires on every keystroke. Client-side filtering was instant; server round-trips need 300ms debounce (`_filterDebounceTimer` + `clearTimeout/setTimeout`). Discrete actions (preset clicks, date chip clicks, Enter key) call `applyFilters(true)` (immediate=true) to bypass the timer.

- **`_filterDateRange` shape: `{ from, to, label } | null`** — `from`/`to` are YYYY-MM-DD passed to the server; `label` is the display string shown in the `#date-btn` button. Set by `filterByDate()` (single date: from=to=date), `setDatePreset()` (preset label), `applyCustomDateRange()` (human-formatted range via `formatCustomRangeLabel()`), cleared by `clearDateFilter()`. There is no longer a separate `#date-chip` element — the button itself is the chip.

- **ALL module-level state vars must be declared before `navigate(initHash, false)` at line ~43** — `navigate()` fires synchronously at module load and can call `loadSessions()`, `loadDashboard()`, or `fetchStats()` depending on the URL hash. Any `let`/`const` declaration that appears later in the file is in the TDZ and throws `ReferenceError` when accessed synchronously. This includes activity vars (`_allRunGroups`, `_visibleRunCount`), search/sessions vars (`_lastSearchResults`, `_allSessions`, `_sessionsLoading`, `_scrollObserver`, `_filterDateRange`, `_filterOptions`, `_filterDebounceTimer`, `_datepickerOutsideHandler`), and card field vars (`CARD_FIELD_DEFAULTS`, `_cardFields`). Keep them all at the very top of `app.js`. Bug: landing on `#sessions` via direct URL/refresh showed a stuck spinner because `_sessionsLoading` was in TDZ — fixed 2026-03-14.

- **`loadRecentSessions()` is guarded by `_lastRenderedSessionCount`** — fetches `/sessions?offset=0` only when `data.sessions !== _lastRenderedSessionCount`. Without the guard, it fires a DB query + HTTP roundtrip on every 5s dashboard poll. Update `_lastRenderedSessionCount` on both the success path and the empty-state early return.

- **Dashboard uses a single 3-card stats grid** — the 3 metrics are sessions, searches, and AI summaries, in one `grid-template-columns: repeat(3, 1fr)` row. Chunks, Embed Provider, and Last Indexed were removed as clutter. Do not reintroduce a separate `.info-grid` — it broke alignment with the `h2` and required extra CSS to handle.

- **Dashboard "● Running" pill and "↻ Refresh" button were intentionally removed** — both are redundant: the page loading proves the daemon is up, and the dashboard auto-polls every 5s. Don't add them back.

- **`openSessionDetail` references `#detail-back-btn` by ID** — if the back button is removed from `index.html`, the `backBtn.textContent = ...` line in `app.js` throws a null dereference that silently kills `loadSessionDetail` and leaves the spinner forever. Remove the JS reference whenever the HTML element is removed.

- **`updateDateChip()` targets `#date-btn`, not a separate `#date-chip` element** — the date chip was removed; `#date-btn` is now the chip. When active, `btn.innerHTML` is set to `"Label <span class='date-btn-clear' onclick='clearDateFilter();event.stopPropagation()'>×</span>"`. The `event.stopPropagation()` on the inner clear span is critical — without it, the click bubbles to the button's `onclick="toggleDatePicker(event)"` and immediately reopens the picker after clearing.

- **Date picker outside-click: register/remove on open/close** — `toggleDatePicker()` adds a document-level click listener stored in `_datepickerOutsideHandler`. `closeDatePicker()` removes it and nulls it out. Always call `closeDatePicker()` (never just `dp.style.display = 'none'`) to avoid leaking the listener and getting stale handlers that close the picker on unrelated clicks.

- **Don't reuse `.session-id` for non-ID text** — `.session-id` has `font-family: var(--mono)`, so any text rendered in it (e.g. relative timestamps) will appear in Menlo. Use a dedicated class (e.g. `.session-ts`) that inherits the page font instead.

- **Page-level headings and section content must share one left alignment line** — `.section-header` uses `padding: 11px 0` (no horizontal indent) so section titles align with `.section-heading` page titles. Session cards use `padding: 14px 0` (no horizontal indent) so card titles align with the heading above. Any horizontal padding on these elements creates a competing vertical line and looks misaligned.

- **Onboarding is integrated into the dashboard — no separate banner** — There is no `onboarding-wrap` or `updateOnboardingBanner()`. Startup state is surfaced via three embedded signals: (1) a pulsing blue dot (`stat-indexing-dot`) on the Sessions stat card label when `phase === 'indexing'`; (2) a synthetic model-loading/downloading activity entry (with progress bar) injected at the top of Recent Activity when `phase` is `model_download`, `model_loading`, or `starting` — built by `buildModelSyntheticGroup()`; (3) a `search-ready-hint` span next to the "Recent Sessions" heading, shown when `sessions > 0 && phase === 'ready' && searches === 0`, that navigates to the Sessions tab on click. Do not reintroduce a banner or onboarding-wrap — the dashboard always shows full content even during startup.

- **Synthetic model download groups have two phases** — Phase 1 (active): live progress from `serverProgress` / `data.enrichProgress` in `/status`. Phase 2 (complete): permanent `running: false` entry read from `embed_model_downloaded` / `enrich_model_downloaded` activity events, written once at download completion. Never hide Phase 2 on any condition — it must persist in Recent Activity permanently. `buildCompletedDownloadGroup()` is the shared helper for Phase 2.

- **`groupActivityEvents` uses dual cursors `curIndex` / `curEnrich`** — index and enrich run in separate processes and their events interleave. A single `current` cursor closed the enrich group prematurely when `index_started` arrived mid-enrich (cron fires every 60s), causing "Enriching... 0/N" to stick forever. Track each independently.

- **`daemon_started` must set `running = false` on any open cursor before pushing** — when `daemon_started` arrives, both `curIndex` and `curEnrich` must have `running = false` before being pushed to `groups`. The original bug: groups were pushed with `running = true` → two spinning index entries appeared simultaneously in the UI. The fix: `curIndex.running = false; groups.push(curIndex)` (not `groups.push(curIndex); curIndex.running = false`).

- **Enrich spinner resolves in 30s when process is dead** — `showDashboardPanel` cross-references `data.enriching` from `/status`. If `false` (process dead) and the enrich group is still `running` after 30s grace, mark it closed immediately instead of waiting the 10-minute stale timeout.

- **`showMoreRuns()` sets `_visibleRunCount = Infinity`** — `_allRunGroups` holds real groups only, but `displayGroups` includes synthetic entries too. Setting `_visibleRunCount = _allRunGroups.length` left `hidden = syntheticCount` → clicking the button showed the same count → no change. `Infinity` always reveals everything.
