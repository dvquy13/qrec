# Plan: Dashboard Vertical Alignment Line

## Goal

The vertical line between the **stats grid** (left) and the **heatmap column** (right) inside `.dashboard-top` should extend downward as the dividing line between **session content** and **timestamp** in the Recent Sessions cards — creating one shared page-level vertical axis.

```
┌─────────────────────────────┬──────────────────────┐
│  Sessions   1,035   49      │  [heatmap + bars]    │
│  211        local   just now│                      │
└─────────────────────────────┴──────────────────────┘
                              ↕  ← shared vertical line
┌─────────────────────────────┬──────────────────────┐
│  Session title truncated…   │  just now            │
│  qrec · a1444457            │                      │
│  Summary text here…         │                      │
├─────────────────────────────┼──────────────────────┤
│  Another session title…     │  29m ago             │
└─────────────────────────────┴──────────────────────┘
```

## Mechanism

`.dashboard-top` is a flex row with `gap: 40px`:
- Left: `.stats-grid` — `flex: 1` (takes remaining space)
- Right: `.dashboard-heatmap-col` — `flex-shrink: 0` (width determined by content)

The vertical line is at `x = stats_grid_right_edge`. For Recent Sessions to share it:
- `.dashboard-session-card` gap must equal `dashboard-top` gap (40px)
- `.dashboard-session-ts` must have `min-width` = heatmap column rendered width

Since the heatmap column width is content-driven (not a fixed CSS value), we measure it after render and publish it as a CSS variable.

## Files to Change

| File | Change |
|------|--------|
| `ui/app.js` | After `container.innerHTML = html` in `renderHeatmap`, set `--heatmap-col-w` via `requestAnimationFrame` |
| `ui/styles.css` | `.dashboard-session-card { gap: 40px }` (was 12px); `.dashboard-session-ts { min-width: var(--heatmap-col-w, 280px); text-align: right; }` |

## Implementation

### `ui/app.js` — inside `renderHeatmap`, after `container.innerHTML = html`

```js
// Sync the page vertical alignment line: heatmap col width → Recent Sessions timestamp col
requestAnimationFrame(() => {
  document.documentElement.style.setProperty('--heatmap-col-w', container.offsetWidth + 'px');
});
```

### `ui/styles.css`

```css
/* was gap: 12px */
.dashboard-session-card { gap: 40px; }

/* timestamp column shares the heatmap column width */
.dashboard-session-ts { min-width: var(--heatmap-col-w, 280px); text-align: right; }
```

## Notes

- `requestAnimationFrame` ensures layout is flushed before measuring `offsetWidth`
- The CSS variable cascades instantly — no re-render of session cards needed
- Default fallback `280px` used on first paint before heatmap has rendered
- Only the dashboard heatmap container (`#dashboard-heatmap`) is measured, not the sessions tab heatmap
- On mobile (`≤600px`) the flex layout stacks vertically so the shared line doesn't apply; the existing mobile override (`dashboard-top: flex-direction: column`) already handles this — no timestamp min-width override needed since the column layout collapses anyway
