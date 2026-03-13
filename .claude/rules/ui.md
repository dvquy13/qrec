---
paths:
  - ui/**
---

# UI Rules (ui/)

- **Sessions tab is NOT polled** — the 5s `setInterval` in `app.js` refreshes dashboard and activity only. Do NOT add `sessions` back to the polling interval: `loadSessions()` resets `_allSessions`, replaces `innerHTML` with a spinner, and resets scroll to top — destroying infinite scroll state mid-browse.

- **Sessions list uses IntersectionObserver for infinite scroll** — `#sessions-sentinel` (1px div after `#sessions-grid`) triggers `loadMoreSessions()` when it enters the viewport. `loadMoreSessions()` uses `insertAdjacentHTML('beforeend', ...)` to append cards without replacing `innerHTML` (which would jump scroll to top). `renderSessionsList()` does a full rebuild and is only called on initial load or filter changes.

- **`_allSessions` is append-only during a session** — `loadSessions()` resets it (called once on tab activation); `loadMoreSessions()` concatenates. Never call `loadSessions()` to "refresh" while the user is browsing — they lose their scroll position and all loaded pages.

- **UI is served fresh** — `index.html`, `app.js`, `styles.css` are served fresh on every request (no cache headers). Browser refresh picks up UI changes without a daemon restart.
