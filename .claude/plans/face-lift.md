# Plan: Dashboard Redesign — Alignment + Unified Grid + Recent Sessions

## Context

Dashboard has too many vertical alignment lines and two competing grid structures. User wants:
1. Single unified stat-card grid for all 6 metrics (3 stats + 3 metadata)
2. Remove Daemon memory (completely from UI)
3. AI summaries → plain stat card (no toggle button on dashboard)
4. Replace "Search sessions" CTA with 5 recent session cards showing summary preview
5. Fix RECENT ACTIVITY alignment (left-indent vs section title)

## Target Layout

```
Dashboard
─────────────────────────────────────────────────────────

SESSIONS      CHUNKS        SEARCHES
206           1,004         49
indexed       searchable    queries run

EMBED         LAST          AI
PROVIDER      INDEXED       SUMMARIES
local         just now      206/206

─────────────────────────────────────────────────────────
RECENT SESSIONS                          All sessions →
─────────────────────────────────────────────────────────
Project name  •  2025-01-15  •  abc123de
Session title goes here
Summary text preview line one...
─────────────────────────────────────────────────────────
(×5 sessions)

RECENT ACTIVITY  ●
▶ ✦ Enrich run  1 session enriched 7.0s             just now
  ○ Index scan  5× no new sessions                  just now
```

## Files Changed

- `ui/index.html` — restructure HTML
- `ui/styles.css` — CSS adjustments
- `ui/app.js` — remove memory/toggle logic, add recent sessions

---

## `ui/index.html` Changes

**Dashboard header** — remove `● Running` pill and `↻ Refresh` button; they're redundant (dashboard auto-polls every 5s, and if the page loads, the daemon is obviously running). Replace with just the h2:
```html
<!-- Before -->
<div class="dashboard-header">
  <h2>Dashboard</h2>
  <div style="display:flex;align-items:center;gap:10px;">
    <span class="status-pill">...</span>
    <button class="action-btn secondary" onclick="loadDashboard()">↻ Refresh</button>
  </div>
</div>

<!-- After -->
<div class="dashboard-header">
  <h2>Dashboard</h2>
</div>
```

**Replace** the entire `stats-grid` + `info-grid` + `actions` + `settings-section` block with:

```html
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-label">Sessions</div>
    <div class="stat-value" id="stat-sessions">—</div>
    <div class="stat-sub">indexed</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Chunks</div>
    <div class="stat-value" id="stat-chunks">—</div>
    <div class="stat-sub">searchable units</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Searches</div>
    <div class="stat-value" id="stat-searches">—</div>
    <div class="stat-sub">queries run</div>
  </div>

  <div class="stat-card stat-card--info">
    <div class="stat-label">Embed Provider</div>
    <div class="stat-value"><span class="provider-badge" id="info-provider">—</span></div>
  </div>
  <div class="stat-card stat-card--info">
    <div class="stat-label">Last Indexed</div>
    <div class="stat-value" id="info-last-indexed">—</div>
  </div>
  <div class="stat-card stat-card--info">
    <div class="stat-label">AI Summaries</div>
    <div class="stat-value" id="info-ai-summaries">—</div>
    <div class="stat-sub" id="info-ai-summaries-sub"></div>
  </div>
</div>

<div class="dashboard-recent">
  <div class="dashboard-recent-header">
    <span class="activity-section-title">Recent Sessions</span>
    <span class="dashboard-recent-link" onclick="showTab('sessions')">All sessions →</span>
  </div>
  <div id="dashboard-recent-list"></div>
</div>
```

**Also:**
- Remove the old `.info-grid` div (4 `.info-row` children)
- Remove the `.actions` div
- Remove the `id="settings-section"` div

---

## `ui/styles.css` Changes

**1. `.stats-grid`** — separate row/col gaps:
```css
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 12px; row-gap: 20px; margin-bottom: 28px; }
```

**2. Heading hierarchy** — unified visual language across all headings:

Page title "Dashboard" → large:
```css
.dashboard-header h2 { font-size: 32px; font-weight: 700; letter-spacing: -0.04em; }
```

Section titles "Recent Sessions" + "Recent Activity" → same style, smaller:
```css
/* Replace .activity-section-title (12px uppercase) with a consistent section heading style */
.section-heading {
  font-size: 18px; font-weight: 700; letter-spacing: -0.03em; color: var(--text);
}
```

In HTML, replace `.activity-section-title` spans with elements using `.section-heading`:
- Recent Sessions header: `<span class="section-heading">Recent Sessions</span>`
- Recent Activity header: `<span class="section-heading">Recent Activity</span>` + live dot

Also remove `.status-pill` and `.status-dot` rules (no longer used on dashboard).

**3. `.stat-card`** — remove horizontal padding (aligns labels with h2):
```css
.stat-card { background: transparent; border-radius: 10px; padding: 20px 0; }
```

**3. Add `.stat-card--info`** — smaller value for metadata row:
```css
.stat-card--info .stat-value { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
```

**4. Remove** `.info-grid`, `.info-row`, `.info-key`, `.info-val` rules (no longer used)

**5. Remove** `.actions` rule (replaced by dashboard-recent)

**6. Add `.dashboard-recent` styles:**
```css
.dashboard-recent { margin-bottom: 32px; }
.dashboard-recent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0; }
.dashboard-recent-link { font-size: 12px; color: var(--accent); cursor: pointer; }
.dashboard-recent-link:hover { text-decoration: underline; }
.dashboard-session-card { padding: 12px 0; border-bottom: 1px solid var(--border); cursor: pointer; }
.dashboard-session-card:first-child { border-top: 1px solid var(--border); }
.dashboard-session-card:hover .dashboard-session-title { color: var(--accent); }
.dashboard-session-title { font-size: 14px; font-weight: 500; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dashboard-session-meta { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.dashboard-session-summary { font-size: 12px; color: var(--text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
```

**7. Activity `.run-header`** — remove 14px left indent + remove `▶` prefix column:
```css
.run-header { display: flex; align-items: center; gap: 6px; padding: 9px 0; }
/* Remove ▶ pseudo-element — discoverability moves to icon badge ::after */
.run-group:not(.no-expand) > summary.run-header::before { content: none; }
/* Hide spacer elements on non-expandable rows */
.run-chevron-spacer { display: none; }
```

**8. Activity icon badge — embed expand indicator** (no new alignment column):
```css
/* Icon badge must be position:relative for the ::after indicator */
.run-icon-badge { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; background: transparent; color: var(--text-muted); position: relative; }
/* Tiny ▾ indicator at bottom-right of badge for expandable items */
.run-group:not(.no-expand) .run-icon-badge::after {
  content: '▾'; font-size: 7px; line-height: 1;
  position: absolute; bottom: -1px; right: -2px;
  color: var(--text-muted);
}
.run-group[open] .run-icon-badge::after { content: '▴'; }
```

**9. Activity `.run-event`** — adjust left indent to match new layout (icon at 0, text at 28px):
```css
/* before: padding: 5px 14px 5px 54px */
.run-event { display: flex; align-items: center; gap: 12px; padding: 5px 0 5px 40px; font-size: 12px; }
```

**9. Mobile** — remove now-dead `.info-grid { grid-template-columns: 1fr; }` override

---

## `ui/app.js` Changes

### Remove from `showDashboardPanel(data, actEntries)`:
- The `document.getElementById('info-memory')` update block (memoryMB)
- The `enrich-toggle-btn` update block (button text/disabled state)
- The `info-enriching` update — replace with `info-ai-summaries` update:
  ```javascript
  // AI summaries stat card (simple count, no toggle)
  const enrichTotal = data.sessions ?? 0;
  const enrichDone = data.enrichedCount ?? 0;
  const enrichPending = data.pendingCount ?? 0;
  const aiEl = document.getElementById('info-ai-summaries');
  const aiSubEl = document.getElementById('info-ai-summaries-sub');
  if (aiEl) {
    if (!data.enrichEnabled) {
      aiEl.innerHTML = '<span style="color:var(--text-muted)">—</span>';
      if (aiSubEl) aiSubEl.textContent = 'disabled';
    } else if (data.enriching) {
      const pct = enrichTotal > 0 ? Math.round((enrichDone / enrichTotal) * 100) : 0;
      aiEl.innerHTML = `<span class="enrich-dot"></span>${enrichDone}<span style="color:var(--text-muted);font-size:14px;">/${enrichTotal}</span>`;
      if (aiSubEl) aiSubEl.textContent = `${pct}% enriched`;
    } else {
      aiEl.innerHTML = enrichPending === 0
        ? `<span style="color:var(--green)">${enrichDone}</span><span style="color:var(--text-muted);font-size:14px;">/${enrichTotal}</span>`
        : `${enrichDone}<span style="color:var(--text-muted);font-size:14px;">/${enrichTotal}</span>`;
      if (aiSubEl) aiSubEl.textContent = enrichPending > 0 ? `${enrichPending} pending` : 'sessions enriched';
    }
  }
  ```
- Also call `loadRecentSessions()` from within `showDashboardPanel()`

### Remove `toggleEnrichment()` function entirely

### Add `loadRecentSessions()` function:
```javascript
async function loadRecentSessions() {
  const container = document.getElementById('dashboard-recent-list');
  if (!container) return;
  try {
    const res = await fetch('/sessions?offset=0');
    if (!res.ok) return;
    const { sessions } = await res.json();
    const recent = sessions.slice(0, 5);
    if (recent.length === 0) {
      container.innerHTML = '<div style="padding:20px 0;color:var(--text-muted);font-size:13px;">No sessions indexed yet.</div>';
      return;
    }
    container.innerHTML = recent.map(s => {
      const summary = s.summary ? escHtml(s.summary.slice(0, 180)) : '';
      return `<div class="dashboard-session-card" onclick="openSession('${escHtml(s.id)}')">
        <div class="dashboard-session-title">${escHtml(s.title || '(untitled)')}</div>
        <div class="dashboard-session-meta">
          <span>${escHtml(s.project || '—')}</span>
          <span>·</span>
          <span>${escHtml(s.date || '—')}</span>
          <span>·</span>
          <span style="font-family:var(--mono);font-size:11px;">${escHtml(s.id)}</span>
        </div>
        ${summary ? `<div class="dashboard-session-summary">${summary}</div>` : ''}
      </div>`;
    }).join('');
  } catch (_) { /* silently skip — not critical */ }
}
```

---

## Alignment Result

| Before | After |
|---|---|
| ~8 vertical alignment positions | ~4 (content edge, col-2, col-3, activity text) |
| 3-col stats + 2-col info = mismatched grids | One 3-col grid for all 6 metrics |
| stat-card labels 20px offset from h2 | stat-card labels flush with h2 |
| activity rows 14px indented from section title | activity rows flush with "RECENT ACTIVITY" |

## Verification

- Browser refresh at `http://localhost:25927` (CSS/HTML served fresh, no daemon restart)
- Check: stat labels align with "Dashboard" h2
- Check: row 2 cards show embed/indexed/ai-summaries at smaller text
- Check: recent sessions section shows 5 cards with summary previews
- Check: activity rows flush-left with "RECENT ACTIVITY" section title
- Check: mobile view — 3-col grid collapses to 1-col via existing `@media (max-width: 600px)` override
