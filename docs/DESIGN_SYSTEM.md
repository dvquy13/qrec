# qrec Design System

**Philosophy**: Neutral at rest, accent on interaction. Generous white space, high contrast, minimum color palette — black, white, and primary blue. Multiple vertical axes are fine as long as alignment is intentional.

---

## Tokens

### Color

```css
/* Surfaces */
--bg:              #ffffff   /* page background */
--bg2:             #f8fafc   /* subtle inset / hover bg */
--bg3:             #f1f5f9   /* stronger inset */
--border:          #e2e8f0   /* structural borders only */

/* Text */
--text:            #0f172a   /* primary content */
--text-muted:      #64748b   /* metadata, labels, secondary */

/* Accent (interactive — blue) */
--accent:          #0062a8
--accent-hover:    #004d84
--accent-light:    #e0f0ff   /* chip background, highlights */
--accent-border:   #b3d9f5   /* accent-tinted borders */

/* Semantic */
--green:           #059669   /* success, live, score */
--green-bg:        #ecfdf5
--green-border:    #a7f3d0
--yellow:          #d97706   /* warning, restart-required */
--yellow-bg:       #fffbeb
--red:             #dc2626   /* error */
```

**Rules:**
- Interactive elements are `--text` / `--text-muted` at rest → `--accent` on hover. Never pre-colored.
- Accent fill (solid `--accent` bg) only for primary call-to-action buttons.
- Semantic colors are status indicators only — never used for decoration.

### Typography

| Role | Font | Token | Weight |
|---|---|---|---|
| Page / section heading | Google Sans | `--font-6xl` (40px) | 700 |
| Stat value | Google Sans | `--font-5xl` (32px) | 400 |
| Detail page title | Google Sans | `--font-5xl` (32px) | 700 |
| Session card title | Google Sans | `--font-2xl` (18px) | 500 |
| Header h1 | Google Sans | `--font-lg` (16px) | 600 |
| Body / UI labels / buttons / inputs / nav | Google Sans | `--font-base` (15px) | 400–500 |
| Google Sans body default | Google Sans | `--font-body` (14px) | 400 |
| Secondary metadata, scores | Google Sans | `--font-md` (13px) | 400–500 |
| Tags, labels, progress text | Google Sans | `--font-sm` (12px) | 400–600 |
| Timestamps, IDs, heatmap labels | Google Sans | `--font-xs` (11px) | 400 |
| Prose / summaries / turn text | DM Sans | `--font-base` (15px) | 400 |
| Monospace (IDs, code, tool output) | Google Sans Code → Menlo → Consolas | `--font-xs`–`--font-md` | — |

**Rules:**
- Google Sans: UI chrome, labels, numbers, titles.
- DM Sans: prose reading zones only (`.turn-text`, `.session-card-summary`, `p`, `li`).
- Google Sans Code: any text that must be machine-scannable (session IDs, timestamps in activity rows, code).
- Never use negative `letter-spacing` — removed from all elements.
- Never use `.session-id` (monospace class) for human-readable text — it applies `var(--mono)`.

### Type Scale

All font sizes use CSS custom property tokens defined in `ui-react/src/styles/variables.css` (bundled into `ui/components.css`, available globally). **Never write raw `font-size: Npx` — always use a token.**

| Token | Value | Used for |
|---|---|---|
| `--font-2xs` | 10px | Tiny badges, picker section titles |
| `--font-xs` | 11px | Timestamps, session IDs, heatmap labels, tooltips |
| `--font-sm` | 12px | Secondary meta, tags, progress labels, activity details |
| `--font-md` | 13px | Run entries, scores, code/tool text, activity headers |
| `--font-body` | 14px | Google Sans body default, h4, description text |
| `--font-base` | 15px | Primary: buttons, inputs, nav, prose, body copy |
| `--font-lg` | 16px | Header h1, arrow icons |
| `--font-xl` | 17px | Markdown h2 |
| `--font-2xl` | 18px | Session card title, mobile detail title |
| `--font-3xl` | 19px | Markdown h1 |
| `--font-4xl` | 22px | Debug stat strip |
| `--font-5xl` | 32px | Detail page title, dashboard stat value |
| `--font-6xl` | 40px | Section / page headings |

To resize the entire UI, edit the token values in `variables.css` — every reference updates automatically.

### Spacing

```
Page content max-width:  900px
Page padding:            40px 24px
Header height:           ~56px (14px top/bottom padding + content)
Section heading gap:     28–32px below before next section
Card padding:            14px 0  (no horizontal indent — aligns with page heading)
Section header padding:  11px 0  (no horizontal indent)
```

**The one-axis rule**: All block elements — page heading, search bar, filter row, cards, section headers — share the same left edge. No component may introduce a horizontal indent from this axis. Two competing left edges is a defect.

---

## Components

### Page Heading
```css
.section-heading {
  font-size: var(--font-6xl);   /* 40px */
  font-weight: 700;
  color: var(--text);
}
```
Every tab panel gets exactly one at the top. Nothing else uses `--font-6xl` weight-700.

### Stat Card
```css
.stat-label  { font-size: var(--font-md); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value  { font-size: var(--font-5xl); font-weight: 400; line-height: 1; }
.stat-sub    { font-size: var(--font-sm); color: var(--text-muted); margin-top: 4px; }
.stat-card   { background: transparent; padding: 20px 0; border-radius: 10px; }
```
Stats grid: `grid-template-columns: repeat(3, 1fr)` — exactly 3 metrics. No shadows, no backgrounds.

### Session Card (list)
```css
padding: 14px 0;           /* no horizontal indent */
cursor: pointer;
```
- Title: `--font-2xl` (18px) weight-500 → turns `--accent` on card hover.
- Meta line: `--font-sm` (12px) `--text-muted` (project, date, duration).
- Summary: `--font-sm` (12px) `--text-muted`, 2-line clamp.
- Separator: `border-bottom: 1px solid var(--border)` structural only.

### Enrich Tag (`.enrich-tag`)
```
at rest:  transparent bg, var(--border) border, var(--text) text
hover:    var(--accent) border + var(--accent) text
active:   same as hover
```
No fill. Ever.

### Buttons
```
Primary (call-to-action):
  default:  background var(--accent), color white
  hover:    background var(--accent-hover)

Secondary / filter:
  default:  transparent bg, var(--border) border, var(--text)
  hover:    background var(--accent), color white, border var(--accent)

Text/ghost (show more, footer links):
  default:  no bg, no border, var(--text-muted)
  hover:    color var(--accent)
```

### Input / Search Bar
```
background: var(--bg)
border: 1px solid var(--border)
border-radius: 8px
padding: 10px 14px
focus: border-color var(--accent)
placeholder: var(--text-muted)
```

### Badge / Chip
- Provider badge: `--accent-light` bg, `--accent` text, `var(--mono)` font, 12px.
- Tag badge: transparent, `--text-muted`, no border (`.tag` in search results — non-interactive display).
- Activity project chip: `--accent-light` bg, `--accent` text, 10px, weight 600.

### Progress Bar
```
track:  height 6px, background var(--border), border-radius 99px
fill:   background var(--accent), transition width 0.4s ease
```
Indeterminate variant: fixed 40% width + `translateX` animation.

### Spinner
```
width/height: 18px
border: 2px solid var(--border)
border-top-color: var(--accent)
border-radius: 50%
animation: spin 0.7s linear infinite
```

### Live / Status Dots
- Indexing dot: 6px, `--accent`, `pulse` animation (opacity 1→0.3→1 over 1.5s).
- Activity live dot: 6px, `--green`, same pulse.

---

## Layout

```
┌─────────────────────────────────────────┐
│ header (sticky, border-bottom)          │  14px padding, 900px+ wide
├─────────────────────────────────────────┤
│ main (max-width 900px, 0 auto)          │
│   40px 24px padding                     │
│                                         │
│   .section-heading ←─ left axis         │
│   .section-header  ←─ left axis (11px 0)│
│   .session-card    ←─ left axis (14px 0)│
│   search-bar       ←─ left axis         │
│   filter-row       ←─ left axis         │
└─────────────────────────────────────────┘
```

### Dashboard Layout
```
.dashboard-top: flex, gap 40px
  ├── .dashboard-heatmap-col (flex-shrink: 0)
  └── .stats-grid (repeat(3,1fr), flex: 1, align-self: center)
```

---

## Motion

| Element | Property | Duration | Easing |
|---|---|---|---|
| Nav/button bg+color | background, color | 100ms | — |
| Action button bg | background | 150ms | — |
| Progress fill | width | 400ms | ease |
| Spinner | transform rotate | 700ms | linear ∞ |
| Pulse dot | opacity | 1500ms | — ∞ |
| Indeterminate bar | translateX | 1400ms | ease-in-out ∞ |

No transitions on layout properties (width/height of structural elements). No shadows to animate. Keep motion purposeful and brief.

---

## State Communication

| State | Pattern |
|---|---|
| Loading | `.loading-state`: centered, `--text-muted`, 80px vertical padding |
| Empty | `.empty-state`: centered, `--text-muted`, 15px, 48px padding |
| Error | `.error-state`: centered, `--red`, 48px padding |
| Active/selected | `--accent` text or border (never a different bg) |
| Disabled | `opacity: 0.5`, `cursor: default` |
| Settings: live | green feedback |
| Settings: restart-required | amber/yellow feedback |

---

## What Not To Do

- **No card shadows** — cards are transparent; `box-shadow` is banned.
- **No decorative borders** — borders are structural dividers only.
- **No pre-colored interactive elements** — neutral → accent on hover only.
- **No horizontal indent on block elements** — breaks the left axis.
- **No fill on `.enrich-tag`** — border+text color change only.
- **No raw `font-size: Npx`** — always use a `--font-*` token from `variables.css`. Exempt: `7px`/`9px` (icon glyphs), `11.5px` (log body), `12.5px` (result snippet body).
- **No negative `letter-spacing`** — removed from all elements; do not reintroduce.
- **No DM Sans for UI chrome** — DM Sans is prose-only (`.turn-text`, `p`, `li`, `.session-card-summary`).
- **No `.session-id` on non-ID text** — it forces monospace rendering.
- **No vertical borders inside stat items** — use spacing.
- **No separate onboarding banner** — startup state surfaces inline.
- **No "● Running" pill or manual refresh** — redundant; dashboard polls.
