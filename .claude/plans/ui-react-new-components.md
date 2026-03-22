# ui-react: New components — HeatmapProjectFilter + ActivityFeed

Two new React components added to `ui-react/src/components/`. Both self-contained (own CSS, no dependency on `ui/styles.css`). Both exported via `web-entry.tsx` so `app.js` can adopt them.

---

## 1. HeatmapProjectFilter

### What it is
A pill/chip row that replaces the current `heatmap-project-btn` dropdown in `app.js`. Shows "All" + one pill per project; selected pill is highlighted with the project's colour dot.

### Props
```ts
interface HeatmapProjectFilterProps {
  projects: string[];           // ordered list of project names
  selected: string | null;      // currently selected project (null = All)
  onSelect: (project: string | null) => void;
  style?: React.CSSProperties;
}
```

### Visual spec
- "All" pill always first; no colour dot
- Each project pill: small colour dot (via `projectColor()` from heatmap utils) + project name
- Selected state: filled background using project colour at low opacity + coloured border
- Scrollable horizontally if pills overflow (for many projects)

### Files
```
ui-react/src/components/HeatmapProjectFilter/
  HeatmapProjectFilter.tsx
  HeatmapProjectFilter.css
  index.ts
```

### app.js adoption
Replace `toggleHeatmapProjectDropdown` / `selectHeatmapProject` / `renderHeatmapMetricBtns` dropdown with:
```js
window.QrecUI.renderHeatmapProjectFilter(el, {
  projects: _heatmapProjects,
  selected: _heatmapProject,
  onSelect: (p) => { selectHeatmapProject(p); }
});
```
Remove: `heatmap-project-btn`, `heatmap-dropdown-project`, `toggleHeatmapProjectDropdown`, `hideHeatmapProjectDropdown` HTML + JS.

---

## 2. ActivityFeed

### What it is
React version of the run-group activity feed on the dashboard. Shows a list of run groups (index runs, enrich runs, model downloads) with spinners, progress bars, expandable session lists.

### Why in ui-react (not demo-only)
The vanilla JS `renderRunGroup` / `renderActivityRuns` in `app.js` is complex and growing. Moving it to React means the demo can import it directly, and the actual UI gets type safety and easier maintenance.

### Props
```ts
interface RunGroup {
  type: 'index' | 'enrich' | 'model_download' | 'model_loading' |
        'index_collapsed' | 'enrich_collapsed' | 'enrich_model_download';
  running: boolean;
  ts: number;
  events: RunEvent[];
  syntheticLabel?: string;
  syntheticProgress?: { percent: number | null; label: string | null };
}

interface RunEvent {
  type: 'session_indexed' | 'session_enriched';
  ts: number;
  data?: { sessionId?: string; latencyMs?: number };
}

interface ActivityFeedProps {
  groups: RunGroup[];           // sorted newest-first by caller
  modelName?: string;           // embed model name (shown in expanded index runs)
  enrichModelName?: string;     // enrich model name (shown in expanded enrich runs)
  maxVisible?: number;          // default 5; "show older" button appears beyond this
  onSessionClick?: (id: string) => void;
  onSessionsLoad?: (ids: string[]) => Promise<SessionMeta[]>; // lazy-enrich expansion
  style?: React.CSSProperties;
}
```

### Scope decision (important)
The full `enrichRunGroup` lazy-loading (fetch session titles when run group is expanded) requires an async callback. For the demo, we only need the visual states — progress bars, spinners, labels. The component should:
- Render all visual states from props (no internal fetching)
- Accept `onSessionsLoad` as optional callback for the live app adoption
- Demo passes no `onSessionsLoad` → sessions show as raw IDs (fine for demo; never expanded)

### Files
```
ui-react/src/components/ActivityFeed/
  ActivityFeed.tsx
  ActivityFeed.css
  index.ts
```

### app.js adoption
```js
window.QrecUI.renderActivityFeed(runListEl, {
  groups: displayGroups,
  modelName: _embedModel,
  enrichModelName: _enrichModel,
  maxVisible: _visibleRunCount,
  onSessionClick: (id) => openSession(id),
  onSessionsLoad: async (ids) => { /* existing enrichRunGroup logic */ },
});
```
Remove: `renderRunGroup`, `renderActivityRuns`, `enrichRunGroup`, the toggle listener.

---

## web-entry.tsx exports to add
```ts
export function renderHeatmapProjectFilter(el, props) { ... }
export function renderActivityFeed(el, props) { ... }
```

## Dependencies
- `HeatmapProjectFilter` uses `projectColor` from `ui-react/src/utils/heatmap.ts` — already there
- `ActivityFeed` CSS needs spinner keyframe — can share with or copy from `ui/styles.css`

## Files changed
- `ui-react/src/components/HeatmapProjectFilter/` — new
- `ui-react/src/components/ActivityFeed/` — new
- `ui-react/src/index.ts` — export both
- `ui-react/web-entry.tsx` — add render functions
- `ui-react/build.ts` — no changes needed (picks up new components automatically)
- `ui/app.js` — adopt both (see above)
- `ui/index.html` — remove dropdown markup for heatmap filter
