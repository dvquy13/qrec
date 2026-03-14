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

- **UI is served fresh** — `index.html`, `app.js`, `styles.css` are served fresh on every request (no cache headers). Browser refresh picks up UI changes without a daemon restart.

- **Use `data-run-ts` (not `data-session-ids`) as the open-state key for run groups** — Multiple runs can process the same session IDs (e.g. two enrich runs both processed `3f3e7a7a`), so `data-session-ids` is not unique per run. Using it caused all matching groups to restore as open on every 5s poll. `data-run-ts` (the run's start timestamp) is unique per run.

- **`_visibleRunCount` resets only in `onTabActivated`, not in `renderActivityRuns`** — Resetting it on every render (every 5s poll) collapses the list back to 5 items whenever the user has clicked "show more". Only reset when the user navigates to the dashboard tab.

- **ALL module-level state vars must be declared before `navigate(initHash, false)` at line ~43** — `navigate()` fires synchronously at module load and can call `loadSessions()`, `loadDashboard()`, or `fetchStats()` depending on the URL hash. Any `let`/`const` declaration that appears later in the file is in the TDZ and throws `ReferenceError` when accessed synchronously. This includes activity vars (`_allRunGroups`, `_visibleRunCount`), search/sessions vars (`_lastSearchResults`, `_allSessions`, `_sessionsLoading`, `_scrollObserver`, `_filterDate`, `_filterOptions`), and card field vars (`CARD_FIELD_DEFAULTS`, `_cardFields`). Keep them all at the very top of `app.js`. Bug: landing on `#sessions` via direct URL/refresh showed a stuck spinner because `_sessionsLoading` was in TDZ — fixed 2026-03-14.

- **`loadRecentSessions()` is guarded by `_lastRenderedSessionCount`** — fetches `/sessions?offset=0` only when `data.sessions !== _lastRenderedSessionCount`. Without the guard, it fires a DB query + HTTP roundtrip on every 5s dashboard poll. Update `_lastRenderedSessionCount` on both the success path and the empty-state early return.

- **Dashboard uses a single 6-card stats grid** — all 6 metrics (sessions/chunks/searches + embed provider/last indexed/AI summaries) live in one `grid-template-columns: repeat(3, 1fr)` grid. Row-2 cards use the `.stat-card--info` modifier (smaller `font-size` on `.stat-value`). Do not reintroduce a separate `.info-grid` — it broke alignment with the `h2` and required extra CSS to handle.

- **Dashboard "● Running" pill and "↻ Refresh" button were intentionally removed** — both are redundant: the page loading proves the daemon is up, and the dashboard auto-polls every 5s. Don't add them back.

- **`openSessionDetail` references `#detail-back-btn` by ID** — if the back button is removed from `index.html`, the `backBtn.textContent = ...` line in `app.js` throws a null dereference that silently kills `loadSessionDetail` and leaves the spinner forever. Remove the JS reference whenever the HTML element is removed.

- **Don't reuse `.session-id` for non-ID text** — `.session-id` has `font-family: var(--mono)`, so any text rendered in it (e.g. relative timestamps) will appear in Menlo. Use a dedicated class (e.g. `.session-ts`) that inherits the page font instead.

- **Page-level headings and section content must share one left alignment line** — `.section-header` uses `padding: 11px 0` (no horizontal indent) so section titles align with `.section-heading` page titles. Session cards use `padding: 14px 0` (no horizontal indent) so card titles align with the heading above. Any horizontal padding on these elements creates a competing vertical line and looks misaligned.

- **Onboarding is a banner inside the dashboard, not a panel replacement** — `updateOnboardingBanner()` prepends a dismissible banner to the dashboard panel; the full dashboard (stats, heatmap, recent sessions, activity) is always rendered. The banner auto-hides when `phase === 'ready'` (not `phase === 'ready' && searches > 0` — requiring a search before hiding left the banner stuck for users who already had sessions). Step 4 "Run your first search" stays `'pending'` state (no spinner) until the user actually searches; it never auto-advances to `'active'`. Do not revert to hiding the dashboard panel during onboarding — users with zero sessions would see a blank page instead of useful context.
