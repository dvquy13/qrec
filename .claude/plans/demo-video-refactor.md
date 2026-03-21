# Demo Video: Full Refactor

Remotion demo in `demo/src/`. Goal: show the real qrec onboarding UX, using real UI components on synthetic data.

## Theme decision
"In-app" scenes show the actual **light** qrec UI (`--bg: #fff`) inside a `BrowserFrame` component on a dark video background. Opening + CTA stay dark/overlay. This means the demo stops fighting against `variables.css` and starts using it honestly.

## New shared component: BrowserFrame
```
demo/src/components/BrowserFrame.tsx
```
A minimal mock browser chrome (dark bg, rounded corners, traffic-light dots, optional address bar showing `localhost:25927`). Wraps any light-themed qrec UI content. Used by: Indexing, ProjectDashboard, RecentSessions, SideBySideSearch, SessionDetail scenes.

---

## Task A: Synthetic data module

**File:** `demo/src/data/index.ts` — single source of truth, no hardcoded data in scene files.

```ts
export const PROJECTS = ['qrec', 'api', 'dashboard', 'infra'] as const;

// 26-week heatmap data keyed by project (different colour, different activity pattern)
export const HEATMAP_DAYS: DayEntry[];                         // all-projects combined
export const HEATMAP_BY_PROJECT: Record<string, DayEntry[]>;  // per-project view
export const HEATMAP_BYPROJECT_BREAKDOWN: Record<string, Record<string, number>>; // for byProject prop

// Enriched session cards per project (realistic titles, summaries, tags, learnings)
export const SESSIONS: SessionData[];                          // all projects mixed
export const SESSIONS_BY_PROJECT: Record<string, SessionData[]>;

// Timed activity states for the Indexing scene
export const ACTIVITY_SEQUENCE: ActivityState[];
// States: model_download(0%→100%) → model_loading → indexing(0→847) → enriching(0→847) → ready

// Search results keyed by query string (for SideBySideSearch scene)
export const SEARCH_RESULTS: Record<string, SearchResult[]>;
```

---

## Task B: Scene refactor

### Timing (@ 30fps)
```
Opening        0   → 240   (8s)    — dark bg, floating questions
Indexing       210 → 540   (11s)   — BrowserFrame: activity feed animating + stat cards counting up
ProjectDash    510 → 900   (13s)   — BrowserFrame: heatmap + filter pills, 3 project switches
RecentSessions 870 → 1110  (8s)    — BrowserFrame: session cards with enrich reveal
ClaudeRecall   1080→ 1320  (8s)    — terminal: qrec search --project qrec
SideBySide     1290→ 1560  (9s)    — BrowserFrame left + terminal right
SessionDetail  1530→ 1770  (8s)    — BrowserFrame left + terminal right
CTA            1740→ 1920  (6s)    — dark bg, install command
Total: 1920 frames = 64s
```
(30-frame overlaps = crossfades between scenes)

### Scene files

| File | Status | Notes |
|---|---|---|
| `Opening.tsx` | rename + rewrite `Problem.tsx` | Floating question cards; 2 groups: human pain + agent pain |
| `Indexing.tsx` | new (replaces `Architecture.tsx`) | Uses `ActivityFeed` + `StatCard` via BrowserFrame |
| `ProjectDashboard.tsx` | refactor `WebUI.tsx` P1 | Uses `HeatmapGrid` (full props) + `HeatmapProjectFilter` pills; sequence-driven project switching |
| `RecentSessions.tsx` | refactor `WebUI.tsx` P3 | Uses `SessionCard` + `EnrichBlock` expanding in |
| `ClaudeRecall.tsx` | refactor existing | `qrec search --project qrec` command; 3 session cards appear |
| `SideBySideSearch.tsx` | split from `ClaudeRecall.tsx` | BrowserFrame (search UI) left + terminal right, same query typed simultaneously |
| `SessionDetail.tsx` | new | BrowserFrame (session detail) left + terminal (`qrec get <id>`) right |
| `CTA.tsx` | minor update | Add `logo.svg` from `public/`; unchanged otherwise |
| `QrecDemo.tsx` | update timing | New sequence + 1920 frame total |
| `Root.tsx` | update duration | `durationInFrames={1920}` |

### Scene: Opening
- Dark background
- Two columns: "For you" / "For Claude" — or single stream of questions
- Questions fade in one by one (SlideUp):
  - "What was I working on last week?"
  - "Why did we change the auth middleware?"
  - "What did I learn building the indexer?"
  - "Claude: what's the current state of the qrec project?"
  - "Claude: have we solved this problem before?"
- Hold on last question → fade out → scene title: **"qrec remembers."**

### Scene: Indexing
- BrowserFrame showing Dashboard tab
- ActivityFeed animates through states driven by `ACTIVITY_SEQUENCE`:
  1. `⬇ Downloading embedding model` with progress bar 0→100%
  2. `◎ Loading embedding model` (indeterminate spinner)
  3. `⊙ Index scan — 847 sessions` (spinning, count ticking up)
  4. `✦ Enriching — 0/847` (ticking up)
  5. All complete — stat cards count up: Sessions `0→847`, AI Summaries `0→847`
- One sentence title overlay: **"Indexed and enriched locally. Your models, your machine."**

### Scene: ProjectDashboard
- BrowserFrame showing Dashboard tab (full heatmap UI)
- `HeatmapGrid` with `showWeeklyBars=true`, `showDayLabels=true`, `byProject` data
- `HeatmapProjectFilter` pills above: All · qrec · api · dashboard · infra
- Sequence:
  1. Start: "All projects" selected, grey heatmap
  2. Frame ~60: "qrec" pill clicks (animate border/bg), heatmap recolours to qrec colour, recent sessions list below updates
  3. Frame ~150: "api" pill clicks, recolours to api colour
  4. Frame ~240: "dashboard" pill clicks, recolours to dashboard colour
  5. Frame ~300: back to "All" — hold
- One sentence title: **"Filter by project. See your work through a new lens."**

### Scene: RecentSessions
- BrowserFrame showing Sessions tab (search results area)
- 3 SessionCards slide in; each starts bare (title + project + date only)
- EnrichBlock expands in with summary → tags → learnings (staggered per card)
- One sentence title: **"Every session enriched with summaries, learnings, and tags."**

### Scene: ClaudeRecall
- Dark bg; single terminal window (Claude Code)
- Typewriter: `$ qrec search --project qrec --k 5`
- Results appear:
  - `↳ 5 sessions found  [27ms]`
  - 5 session titles with scores
- Then: `$ qrec get <id>` → session markdown scrolls in (first few lines)
- One sentence title: **"Claude recalls your recent context in milliseconds."**

### Scene: SideBySideSearch
- Left: BrowserFrame with Search tab — search bar, query types, results appear
- Right: terminal — same query types simultaneously, same results appear
- Query: `"embedding performance"`
- One sentence title: **"Search from the UI or straight from the terminal."**

### Scene: SessionDetail
- Left: BrowserFrame showing session detail (title, project, tags, summary, tool call blocks, thinking block collapsed purple)
- Right: terminal output of `qrec get <id>` — markdown scrolling
- One sentence title: **"Dive into any session — full detail, side by side."**

---

## Task C: BrowserFrame component

```
demo/src/components/BrowserFrame.tsx
```

Props:
```ts
interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;      // default: 'localhost:25927'
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}
```

Visual: dark outer frame (`#1e1e2e`), radius 10, traffic light dots (red/yellow/green), address bar with URL. Content area has white bg (`#ffffff`) and clips to frame bounds.

---

## Dependencies
- Task A (synthetic data) — no deps; do first
- Task B scenes — depend on: `HeatmapProjectFilter` (ui-react), `ActivityFeed` (ui-react), `BrowserFrame` (demo)
- BrowserFrame — no deps; do alongside Task A

## Open questions / concerns
See `demo-video-concerns.md`
