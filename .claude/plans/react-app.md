# Plan: React-ify Page Sections for Remotion Reuse

## Context

qrec's UI has two layers:
- **`ui-react/`** — individual React components (`HeatmapGrid`, `HeatmapProjectFilter`, `ActivityFeed`, etc.) — already importable in Remotion ✅
- **`ui/app.js`** — vanilla JS SPA that fetches data, builds the page *shell* (stat card HTML, heatmap section HTML) via `innerHTML`/`getElementById`, then mounts individual React islands into those shells

The dashboard layout (heading, stats grid, heatmap column) is not a React component — it's hardcoded HTML in `index.html` and manipulated by `app.js`. This forces the demo to replicate CSS classes and HTML structure manually in `Onboard.tsx`.

**Goal:** Promote page sections into React components in `ui-react/src/sections/` so they can be imported directly by Remotion AND mounted via `window.QrecUI.renderXxx()` in the web app. No more CSS/HTML replication in the demo.

---

## What Changes

### New files
| File | Purpose |
|------|---------|
| `ui-react/src/sections/DashboardSection.tsx` | Full dashboard top section as a React component |
| `ui-react/src/sections/DashboardSection.css` | Dashboard layout CSS (moved from `ui/styles.css`) |

### Modified files
| File | Change |
|------|--------|
| `ui-react/web-entry.ts` | Add `renderDashboard(el, props)` to `window.QrecUI` |
| `ui/index.html` | Replace 30-line stats+heatmap HTML shell with single `<div id="dashboard-panel">` |
| `ui/app.js` | Replace DOM manipulation in `showDashboardPanel` + `fetchAndRenderHeatmap` + `renderHeatmapMetricBtns` + `renderHeatmapProjectFilter` with a single `window.QrecUI.renderDashboard(el, props)` call |
| `ui/styles.css` | Remove classes moved to `DashboardSection.css` |
| `demo/src/scenes/Onboard.tsx` | Replace inline CSS replication with `import { DashboardSection } from '../../../ui-react/src/sections/DashboardSection'` |

### Deleted files
| File | Reason |
|------|--------|
| `demo/src/styles/dashboard.css` | Replaced by `DashboardSection.css` inside the component |

---

## DashboardSection Props

```typescript
export interface DashboardSectionProps {
  // Stat cards
  sessionsCount: number;
  sessionsIndexing?: boolean;          // shows pulsing blue dot
  summariesCount: number | null;       // null = enrichment disabled → shows "—"
  summariesSub?: string;               // "enriched" | "87% enriched" | "disabled"
  summariesEnriching?: boolean;        // shows pulsing blue dot
  searchesCount: number;

  // Heatmap
  heatmapDays?: { date: string; count: number }[];
  heatmapByProject?: Record<string, Record<string, number>>;
  projects?: string[];
  selectedProject?: string | null;
  onProjectSelect?: (p: string | null) => void;
  heatmapMetric?: string;              // 'sessions' | 'hours', default 'sessions'
  onMetricSelect?: (m: string) => void;
  footerText?: string;                 // e.g. "322 sessions · 32 active days"

  // Remotion-specific (animation)
  revealedCount?: number;              // passed to HeatmapGrid for cell-reveal animation
}
```

Controlled: `selectedProject` and `heatmapMetric` are props, not internal state. The caller (app.js or Remotion) owns them and provides callbacks.

---

## DashboardSection.css

Move these classes **out of `ui/styles.css`** and into `DashboardSection.css`:
- `@keyframes pulse`
- `.stat-indexing-dot` / `.stat-indexing-dot.visible`
- `.dashboard-header`
- `.dashboard-top`
- `.dashboard-heatmap-col`
- `.stats-grid`
- `.stat-card`, `.stat-label`, `.stat-value`, `.stat-sub`
- `.heatmap-controls`
- `.heatmap-metrics`, `.heatmap-metric`, `.heatmap-metric--active`
- `.heatmap-footer`

Keep in `ui/styles.css` (used in raw HTML elsewhere):
- `.section-heading` — used in "Recent Sessions" / "Recent Activity" headers in `app.js`
- `@keyframes pulse` — also used by `.activity-live-dot` → keep a copy in both

---

## app.js changes (conceptual)

```js
// New: single render function
function renderDashboard() {
  const el = document.getElementById('dashboard-panel');
  if (!el || !window.QrecUI?.renderDashboard) return;
  window.QrecUI.renderDashboard(el, {
    sessionsCount: _sessionsCount,
    sessionsIndexing: _phase === 'indexing',
    summariesCount: _enrichEnabled ? _enrichDone : null,
    summariesSub: _computeSummariesSub(),
    summariesEnriching: _enriching,
    searchesCount: _searchesCount,
    heatmapDays: _heatmapData?.days,
    heatmapByProject: _heatmapData?.byProject,
    projects: _heatmapProjects,
    selectedProject: _heatmapProject,
    onProjectSelect: (p) => { _heatmapProject = p; fetchAndRenderHeatmap(); },
    heatmapMetric: _heatmapMetric,
    onMetricSelect: (m) => { _heatmapMetric = m; localStorage.setItem('qrec_heatmap_metric', m); fetchAndRenderHeatmap(); },
    footerText: _heatmapData ? _computeFooterText() : null,
  });
}

// showDashboardPanel — remove all getElementById/textContent/classList calls for stats
// fetchAndRenderHeatmap — remove renderHeatmapGrid/renderHeatmapProjectFilter/renderHeatmapMetricBtns calls
// Both call renderDashboard() at the end instead
```

---

## Remotion usage (Onboard.tsx)

```tsx
import { DashboardSection } from '../../../ui-react/src/sections/DashboardSection';

// Static data for layout review:
<DashboardSection
  sessionsCount={100}
  summariesCount={87}
  summariesSub="enriched"
  searchesCount={0}
  heatmapDays={HEATMAP_DAYS}
  heatmapByProject={HEATMAP_BYPROJECT_BREAKDOWN}
  projects={[...PROJECTS]}
  selectedProject={null}
  heatmapMetric="sessions"
  footerText={`100 sessions · ${ACTIVE_DAYS} active days`}
/>

// With animation:
<DashboardSection
  sessionsCount={sessionsCount}          // interpolated 0→100
  sessionsIndexing={indexingActive}
  summariesCount={summariesCount}        // interpolated 0→100, slower
  summariesEnriching={enrichingActive}
  revealedCount={revealedCount}          // proportional to sessionsCount
  ...
/>
```

No CSS imports, no CSS vars injection, no class replication in Onboard.tsx.

---

## CSS pipeline

`DashboardSection.tsx` imports `./DashboardSection.css`. When built:
- **Remotion**: Vite/Bun handles the CSS import directly at dev time ✅
- **Web app**: `build.ts` bundles CSS → `ui/components.css` → loaded by `index.html` ✅

No changes to `build.ts` needed.

---

## Verification

1. **Remotion preview**: Open Remotion Studio, select `Onboard` composition — dashboard renders identically to the real web UI screenshot
2. **Web app**: Start daemon (`qrec serve`), open browser to `localhost:25927` — dashboard loads, stats update, heatmap project filter works, metric tabs switch between Sessions/Hours
3. **Build**: Run `cd ui-react && bun run build.ts` — `components.js` + `components.css` produced without errors

---

## Scope not included (follow-up)

- "Recent Sessions" section → `RecentSessionsSection.tsx`
- "Recent Activity" section → already React via `window.QrecUI.renderActivityFeed()`
- Sessions tab layout → `SessionsSection.tsx`
- Other tabs (Debug, Settings) — lower priority
