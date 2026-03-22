# Orchestration Manifest — qrec Demo Video Refactor

## Project root
`/Users/dvq/frostmourne/qrec`

## Decisions already locked (do not re-discuss)
- Theme: light qrec UI (`--bg: #fff`) inside `BrowserFrame` component on dark video background
- Opening: single stream of floating questions (dark bg)
- Project switching animation: hard cut (no crossfade)
- SessionDetail synthetic session: "Debugging a memory leak in a long-running Node.js service"
- Browse mode CLI output: compact human-readable lines
- ActivityFeed: full component in ui-react; demo never triggers expansion
- HeatmapProjectFilter: pills (replaces current dropdown in app.js)

---

## Task graph

```
T1 (cli-search-filters)        ──────────────────────────────────► done
T2 (HeatmapProjectFilter)      ─────────────────────────┐
T3 (ActivityFeed)              ─────────────────────────┤
T4 (demo-synthetic-data)       ──────────────────────────┤──► T6 (demo-scenes)
T5 (demo-BrowserFrame)         ─────────────────────────┘
T6 (demo-scenes)               depends on T2, T3, T4, T5
T7 (app.js-adopt-components)   depends on T2, T3
```

**Parallel group A (no deps):** T1, T2, T3, T4, T5
**Sequential:** T6 after group A; T7 after T2+T3

---

## Tasks

### T1 — CLI: extend `qrec search` with filter flags
**Plan:** `.claude/plans/cli-search-filters.md`
**Files:** `src/cli.ts` only
**Done when:**
- `qrec search "query" --project api --tag security` passes filters to `POST /search`
- `qrec search --project qrec --k 5` (no query) hits `GET /sessions`, prints compact lines: `[date] title — summary (120 chars)`
- `qrec search` with no args still errors with usage
- `--from`, `--to` flags work (dateFrom/dateTo)
- Helper `flagValue(args, flag)` guards missing-value case

---

### T2 — ui-react: HeatmapProjectFilter component
**Plan:** `.claude/plans/ui-react-new-components.md` (section 1)
**Files:**
- `ui-react/src/components/HeatmapProjectFilter/HeatmapProjectFilter.tsx` — new
- `ui-react/src/components/HeatmapProjectFilter/HeatmapProjectFilter.css` — new
- `ui-react/src/components/HeatmapProjectFilter/index.ts` — new
- `ui-react/src/index.ts` — add export
- `ui-react/web-entry.tsx` — add `renderHeatmapProjectFilter`
- `ui/app.js` — replace dropdown with React-rendered pills
- `ui/index.html` — remove `heatmap-project-btn` + `heatmap-dropdown-project` markup
**Done when:**
- Pills render: "All" + one pill per project with colour dot
- Selected pill shows filled bg + coloured border using `projectColor()`
- `onSelect(null)` fires for "All", `onSelect(name)` for project pills
- `window.QrecUI.renderHeatmapProjectFilter(el, props)` works in app.js
- Dashboard project filter works end-to-end in the browser

---

### T3 — ui-react: ActivityFeed component
**Plan:** `.claude/plans/ui-react-new-components.md` (section 2)
**Files:**
- `ui-react/src/components/ActivityFeed/ActivityFeed.tsx` — new
- `ui-react/src/components/ActivityFeed/ActivityFeed.css` — new (self-contained; includes spinner keyframe)
- `ui-react/src/components/ActivityFeed/index.ts` — new
- `ui-react/src/index.ts` — add export
- `ui-react/web-entry.tsx` — add `renderActivityFeed`
- `ui/app.js` — replace `renderRunGroup`/`renderActivityRuns`/`enrichRunGroup` with React-rendered feed
- Remove toggle listener from app.js (expansion handled inside component)
**Done when:**
- All run group types render correctly (index, enrich, model_download, model_loading, collapsed variants)
- Spinner animates for `running: true` groups
- Progress bar renders for `syntheticProgress` (determinate + indeterminate)
- Expandable groups show session list; `onSessionsLoad` callback fires on expand
- `window.QrecUI.renderActivityFeed(el, props)` works in app.js
- Dashboard activity feed works end-to-end

---

### T4 — Demo: synthetic data module
**Plan:** `.claude/plans/demo-video-refactor.md` (Task A)
**Files:**
- `demo/src/data/index.ts` — new (single export file)
**Exports needed:**
```ts
PROJECTS: ['qrec', 'api', 'dashboard', 'infra']
HEATMAP_DAYS: DayEntry[]                          // 26 weeks, all projects combined
HEATMAP_BY_PROJECT: Record<string, DayEntry[]>    // per-project, different activity patterns
HEATMAP_BYPROJECT_BREAKDOWN: Record<string, Record<string, number>>  // for HeatmapGrid byProject prop
SESSIONS: SessionData[]                           // ~12 sessions across all projects, fully enriched
SESSIONS_BY_PROJECT: Record<string, SessionData[]>
ACTIVITY_SEQUENCE: ActivityState[]               // timed states for Indexing scene
SEARCH_RESULTS: Record<string, SearchResult[]>   // keyed by query ("memory leak", "auth bug", "embedding performance")
```
**Session content guidelines:**
- qrec sessions: indexer work, search pipeline, enrichment
- api sessions: auth middleware, rate limiting, JWT
- dashboard sessions: React migration, chart performance
- infra sessions: CI/CD, Docker, deploy pipeline
- SessionDetail session (memory leak): project=api, tags=[debugging,memory,nodejs,performance], 2 tool calls (Read+Edit), 1 thinking block content
**Done when:** all exports typecheck and contain realistic data; no hardcoded arrays remain in scene files

---

### T5 — Demo: BrowserFrame component
**Plan:** `.claude/plans/demo-video-refactor.md` (Task C)
**Files:**
- `demo/src/components/BrowserFrame.tsx` — new
**Props:**
```ts
{ children, url?: string, style?: React.CSSProperties }
```
**Visual:** dark outer shell (`#1e1e2e`), `borderRadius: 10`, traffic-light dots (🔴🟡🟢 as coloured circles, not emoji), address bar showing url (default `localhost:25927`), white content area that clips children
**Done when:** renders correctly at various heights; children receive white bg context via CSS variable override on the content div; no overflow

---

### T6 — Demo: all 8 scenes
**Plan:** `.claude/plans/demo-video-refactor.md` (Task B)
**Depends on:** T2, T3, T4, T5
**Files to create/rewrite:**
```
demo/src/scenes/Opening.tsx          (rename+rewrite Problem.tsx)
demo/src/scenes/Indexing.tsx         (new; delete Architecture.tsx)
demo/src/scenes/ProjectDashboard.tsx (new; replaces WebUI.tsx Panel 1)
demo/src/scenes/RecentSessions.tsx   (new; replaces WebUI.tsx Panel 3)
demo/src/scenes/ClaudeRecall.tsx     (rewrite)
demo/src/scenes/SideBySideSearch.tsx (new; was ClaudeRecall Panel 2)
demo/src/scenes/SessionDetail.tsx    (new)
demo/src/scenes/CTA.tsx              (minor: add logo.svg if suitable)
demo/src/QrecDemo.tsx                (new timing: 1920 frames total)
demo/src/Root.tsx                    (update durationInFrames: 1920)
```
**Delete:** `demo/src/scenes/Architecture.tsx`, `demo/src/scenes/WebUI.tsx`

**Scene timing (30fps, 30-frame crossfade overlaps):**
| Scene | From | To | Duration |
|---|---|---|---|
| Opening | 0 | 240 | 8s |
| Indexing | 210 | 540 | 11s |
| ProjectDashboard | 510 | 900 | 13s |
| RecentSessions | 870 | 1110 | 8s |
| ClaudeRecall | 1080 | 1320 | 8s |
| SideBySideSearch | 1290 | 1560 | 9s |
| SessionDetail | 1530 | 1770 | 8s |
| CTA | 1740 | 1920 | 6s |

**Per-scene one-sentence titles (shown as subtitle overlay):**
- Opening: (no title — questions speak for themselves)
- Indexing: "Indexed and enriched locally. Your models, your machine."
- ProjectDashboard: "Filter by project. See your work through a new lens."
- RecentSessions: "Every session enriched with summaries, learnings, and tags."
- ClaudeRecall: "Claude recalls your recent context in milliseconds."
- SideBySideSearch: "Search from the UI or straight from the terminal."
- SessionDetail: "Dive into any session — full detail, side by side."
- CTA: (no title — install command is the message)

**Done when:** `npx remotion preview` in `demo/` shows all 8 scenes playing in sequence with correct timing; no TypeScript errors; no layout overflow at 1280×720

---

### T7 — app.js: adopt new React components
**Depends on:** T2, T3
**Note:** T2 and T3 each include their own app.js changes as part of "done". T7 is just the final integration verification — confirm that after both T2 and T3 are merged, the live dashboard works end-to-end (heatmap filter + activity feed both React-rendered).
**Done when:** `qrec serve` → open dashboard → project filter pills work → activity feed shows run groups → no JS console errors

---

## Key files for context
- `ui-react/src/utils/heatmap.ts` — `projectColor()`, `projectColorScale()`, `heatmapIntensity()` — use these, don't reimplement
- `ui-react/src/components/HeatmapGrid/HeatmapGrid.tsx` — existing component; use as-is with `showWeeklyBars=true showDayLabels=true`
- `ui-react/src/components/SessionCard/SessionCard.tsx` — existing; use directly in scenes
- `demo/src/theme.ts` — dark theme values for non-BrowserFrame areas (Opening, CTA, terminal windows)
- `demo/src/components/TerminalWindow.tsx` — existing terminal component; reuse in ClaudeRecall + SideBySideSearch + SessionDetail
- `ui-react/src/styles/variables.css` — CSS variables for light theme; already imported in `demo/src/Root.tsx`

## Constraints
- No backward-compatibility shims
- ActivityFeed CSS must be self-contained (no imports from `ui/styles.css`)
- All demo scenes import data from `demo/src/data/index.ts` — no hardcoded arrays in scene files
- `ui-react` components use CSS variables (`var(--text)`, etc.) — do not hardcode colours
- Conventional Commits for all git commits
