---
paths:
  - ui/**
  - ui-react/**
  - demo/**
---

# UI Rules (ui/)

> Visual design tokens, component specs, and layout rules → **[docs/DESIGN_SYSTEM.md](../../docs/DESIGN_SYSTEM.md)**

---

## Behavioral Gotchas (app.js)

- **Sessions tab is NOT polled** — the 5s `setInterval` in `app.js` refreshes dashboard and activity only. Do NOT add `sessions` back to the polling interval: `loadSessions()` resets `_allSessions`, replaces `innerHTML` with a spinner, and resets scroll to top — destroying infinite scroll state mid-browse.

- **Sessions list uses IntersectionObserver for infinite scroll** — `#sessions-sentinel` (1px div after `#sessions-grid`) triggers `loadMoreSessions()` when it enters the viewport. `loadMoreSessions()` uses `insertAdjacentHTML('beforeend', ...)` to append cards without replacing `innerHTML` (which would jump scroll to top). `renderSessionsList()` does a full rebuild and is only called on initial load or filter changes.

- **`_allSessions` is append-only during a session** — `loadSessions()` resets it (called once on tab activation); `loadMoreSessions()` concatenates. Never call `loadSessions()` to "refresh" while the user is browsing — they lose their scroll position and all loaded pages.

- **UI is served fresh** — `index.html`, `app.js`, `activity-groups.js`, `styles.css` are served with `Cache-Control: no-cache, no-store, must-revalidate`. Browser refresh always picks up changes without a daemon restart.

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

- **One left alignment axis** — `.section-header` uses `padding: 11px 0` (no horizontal indent) so section titles align with `.section-heading` page titles. Session cards use `padding: 14px 0` (no horizontal indent) so card titles align with the heading above. Any horizontal padding on these elements creates a competing vertical line and looks misaligned.

- **Onboarding is integrated into the dashboard — no separate banner** — There is no `onboarding-wrap` or `updateOnboardingBanner()`. Startup state is surfaced via three embedded signals: (1) a pulsing blue dot (`stat-indexing-dot`) on the Sessions stat card label when `phase === 'indexing'`; (2) a synthetic model-loading/downloading activity entry (with progress bar) injected at the top of Recent Activity when `phase` is `model_download`, `model_loading`, or `starting` — built by `buildModelSyntheticGroup()`; (3) a `search-ready-hint` span next to the "Recent Sessions" heading, shown when `sessions > 0 && phase === 'ready' && searches === 0`, that navigates to the Sessions tab on click. Do not reintroduce a banner or onboarding-wrap — the dashboard always shows full content even during startup.

- **Synthetic model download groups have two phases** — Phase 1 (active): live progress from `serverProgress` / `data.enrichProgress` in `/status`. Phase 2 (complete): permanent `running: false` entry read from `embed_model_downloaded` / `enrich_model_downloaded` activity events, written once at download completion. Never hide Phase 2 on any condition — it must persist in Recent Activity permanently. `buildCompletedDownloadGroup()` is the shared helper for Phase 2.

- **`groupActivityEvents` uses dual cursors `curIndex` / `curEnrich`** — index and enrich run in separate processes and their events interleave. A single `current` cursor closed the enrich group prematurely when `index_started` arrived mid-enrich (cron fires every 60s), causing "Enriching... 0/N" to stick forever. Track each independently.

- **`daemon_started` must set `running = false` on any open cursor before pushing** — when `daemon_started` arrives, both `curIndex` and `curEnrich` must have `running = false` before being pushed to `groups`. The original bug: groups were pushed with `running = true` → two spinning index entries appeared simultaneously in the UI. The fix: `curIndex.running = false; groups.push(curIndex)` (not `groups.push(curIndex); curIndex.running = false`).

- **Enrich spinner resolves in 30s when process is dead** — `showDashboardPanel` cross-references `data.enriching` from `/status`. If `false` (process dead) and the enrich group is still `running` after 30s grace, mark it closed immediately instead of waiting the 10-minute stale timeout.

- **`showMoreRuns()` sets `_visibleRunCount = Infinity`** — `_allRunGroups` holds real groups only, but `displayGroups` includes synthetic entries too. Setting `_visibleRunCount = _allRunGroups.length` left `hidden = syntheticCount` → clicking the button showed the same count → no change. `Infinity` always reveals everything.

- **`ui/activity-groups.js` is the testable home for pure grouping logic** — `groupActivityEvents`, `collapseZeroIndexRuns`, `collapseZeroEnrichRuns`, `groupSummary`, etc. live here, not inline in `app.js`. Loaded via `<script src="/ui/activity-groups.js">` before `app.js`; also `require()`-able in Bun tests via `if (typeof module !== 'undefined') module.exports = { ... }` at the bottom. `app.js` is served as a plain (non-module) script so it cannot `import` — dual-mode plain JS is the pattern for testing browser globals without bundling.

- **`groupSummary(group, liveIndexing)` — parameterized, not global** — takes `liveIndexing` as an explicit second arg (pass `_liveIndexing` from `app.js`, pass `null` in tests). The old signature read `_liveIndexing` as a global, which made it untestable.

- **Crashed index run displays "0 new sessions" without the fallback** — when the initial index throws before writing `index_complete`, the group's stale timeout fires after 10 min and `groupSummary` reads `completeEvent?.data?.newSessions ?? 0` — 0, because no complete event was written. Fix: `?? group.events.filter(e => e.type === 'session_indexed').length` as fallback shows the actual partial count.

- **`collapseZeroEnrichRuns` mirrors `collapseZeroIndexRuns`** — zero-enrich runs ("Enrich run 0 sessions") flood Recent Activity the same way zero-index runs did before collapse was added. `isZeroEnrichRun` checks `enrich_complete.data.enriched` (falling back to `session_enriched` event count); multiple consecutive zero-enrich runs collapse into one `enrich_collapsed` group. `groupSummary` handles `enrich_collapsed` → `"Enrich run N× nothing to enrich"`.

- **Settings tab: runtime vs restart-required** — `enrichEnabled`/`enrichIdleMs` apply on the next daemon tick (live-read); `indexIntervalMs` requires a restart (`setInterval` is called once at startup). Save feedback is green for runtime changes, amber for restart-required ones.

---

## React Component Library (ui-react/)

- **`ui-react/` is the shared component library** — two tiers:
  - `src/components/` — primitives: SessionCard, HeatmapGrid, EnrichBlock, TagBadge, StatCard, HeatmapProjectFilter, ActivityFeed
  - `src/sections/` — page subsections that compose multiple primitives + own their CSS: `DashboardSection` (stats grid + heatmap). Use sections when a full UI region is shared between the web app and Remotion.
  - Build: `cd ui-react && bun run build.ts` → `ui/components.js` (IIFE). Also runs automatically via `scripts/build.js` after the main esbuild step.

- **Section components are controlled** — `selectedProject`, `heatmapMetric`, and similar state are **props**, not internal state. The caller (app.js or Remotion scene) owns the state and provides `onProjectSelect`/`onMetricSelect` callbacks. Never move selection state inside a section component.

- **`renderDashboard()` pattern in app.js** — module-level vars (`_sessionsCount`, `_sessionsIndexing`, `_summariesCount`, `_summariesSub`, `_summariesEnriching`, `_searchesCount`) are the source of truth. `showDashboardPanel()` updates them; `fetchAndRenderHeatmap()` updates `_heatmapData`; both funnel into a single `renderDashboard()` call that passes everything to `window.QrecUI.renderDashboard(el, props)`.

- **`DashboardSection` owns stats grid + heatmap only** — `loadRecentSessions()` (vanilla `innerHTML`, `.dashboard-session-card` design) and `renderActivityFeed()` (separate React mount into `#run-list`) remain as independent calls below the section. Do not absorb them into `DashboardSection`.

- **Bun IIFE build naming quirk** — `format: 'iife'` with `naming: '[name].[ext]'` emits `web-entry.js` + `web-entry.css`. `build.ts` renames `web-entry.js` → `components.js` and deletes the extracted CSS file (CSS vars are already in `ui/styles.css`). The size displayed in build output shows 0.0 KB due to the rename happening after size capture — the file on disk is correct.

- **`window.QrecUI` unmount before clearing innerHTML** — before any `container.innerHTML = ''` that may contain React-mounted cards, call: `container.querySelectorAll('[data-qrec-mount]').forEach(el => window.QrecUI?.unmount(el))`. The `data-qrec-mount="1"` attribute is added to container divs in `app.js`, not inside the React component.

- **React component props: `null` !== `undefined` for array defaults** — TypeScript default parameter syntax (`tags = []`) only guards against `undefined`. The `/sessions` and `/search` APIs return `tags: null`, `entities: null`, `learnings: null`, `questions: null` for unenriched sessions. A prop typed `tags?: string[]` with default `= []` will receive `null` and `.map()` throws "Cannot read properties of null". Fix: rename the destructured prop (`tagsProp`) and apply `const tags = tagsProp ?? []` in the component body. This pattern is required in any component that receives nullable array fields from the API. `SessionCard` normalizes before passing down to `EnrichBlock`, so `EnrichBlock` itself is protected.

- **Remotion demo imports directly from `ui-react/src/`** — not from the built `components.js`. Use relative paths: `import { DashboardSection } from '../../../ui-react/src/sections/DashboardSection'`. CSS custom properties (`--accent`, `--text`, etc.) are set globally by `Root.tsx → import '../../ui-react/src/styles/variables.css'` — do NOT add an inline `CSS_VARS` style object to each scene. It is redundant (values are identical to `variables.css`) and was the pre-sections workaround. Shared components and sections have no Remotion dependencies — animation stays in the demo scenes themselves.

- **Section components must spread `style` onto their own root element** — a `style` prop passed to a section (e.g. `style={{ flex: 1, overflow: 'hidden' }}`) must be applied to the section's own root `div`, not forwarded to a grandchild component. Misrouting `style` to a grandchild (e.g. passing it to `ActivityFeed`) is a silent failure: `flex: 1` is meaningless on a block child of a block parent, and `overflow: hidden` has no clip effect on an unconstrained grandchild. Convention: destructure `style` in the section props and spread it on the root div; bake in any required layout defaults (e.g. `minHeight: 0`) as a base before the caller's overrides.

- **`overflow: hidden` clips at the border edge — `paddingBottom` does NOT create breathing room for overflowing content** — In CSS, `overflow: hidden` clips at the border edge, which includes the padding area. When content overflows a flex container that has `overflow: hidden`, it bleeds into the padding area and is clipped at the border — so `paddingBottom` on that container does NOT produce visible white space below the content. The only reliable bottom gap is padding on a **containing ancestor** that sits outside the clipping element. Concretely: if an inner wrapper (flex column) is missing `overflow: hidden`, content overflows its boundary into the outer div's padding area, and the outer div's `overflow: hidden` clips at its border — making all `paddingBottom` attempts on the outer div silently fail. Fix: add `overflow: hidden` to the inner flex wrapper so it clips first, then the outer div's `paddingBottom` becomes visible white space.
