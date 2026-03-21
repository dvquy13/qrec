# Demo Video Rules (demo/)

## Overview

The demo is a 2310-frame (77s @ 30fps) Remotion video in `demo/src/`. Nine scenes are composed in `QrecDemo.tsx` with 60-frame overlaps for crossfades. Each scene is also registered as a standalone composition in `Root.tsx` for isolated preview.

**Stack**: Remotion 4.x, TypeScript, React. Real `ui-react/src/` components are imported directly — the demo IS the product UI, just driven by frame-based props instead of live data.

---

## Shared Utilities (`demo/src/animUtils.ts`)

**Always import from `animUtils.ts` — never inline these.**

```tsx
import {CLAMP, SPRING_BOUNCY, SPRING_SNAPPY, SPRING_CRISP,
        getTyped, cursorBlink,
        remotionCSSAnimVars, REMOTION_ANIM_OVERRIDES} from '../animUtils';
```

### `CLAMP`
Pass to every `interpolate()` call to prevent extrapolation. The inline object form `{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}` is banned — it's 57 chars of noise per call.

### Spring presets

| Preset | damping | stiffness | Use for |
|--------|---------|-----------|---------|
| `SPRING_BOUNCY` | 14 | 140 | Mascots, browsers, logos — friendly overshoot, ~1s settle |
| `SPRING_SNAPPY` | 20 | 200 | UI panels, cards — quick pop, no overshoot |
| `SPRING_CRISP` | 200 | default | Text/headings sliding in — zero bounce |

Custom configs are fine for special cases (logo arc uses `{damping: 11, stiffness: 140}`) but document why.

### `getTyped(text, startFrame, frame, charsPerFrame = 1.4)`
Terminal/typewriter effect. Default 1.4 chars/frame ≈ 42 chars/second at 30fps — natural typing speed. Pass a higher value when the timeline is compressed.

### `cursorBlink(frame, period = 15)`
Returns `true` on the bright half of the blink cycle. Period 15f = 0.5s at 30fps. Use in JSX as `opacity: cursorBlink(frame) ? 1 : 0`.

### CSS animation overrides (`remotionCSSAnimVars` + `REMOTION_ANIM_OVERRIDES`)
CSS animations don't run in Remotion's renderer. Any scene that renders live `ui-react` components with animations must override them. See section below.

---

## CSS Animation Overrides

When rendering live ui-react components, drop these into the content wrapper:

```tsx
const cssAnimVars = remotionCSSAnimVars(frame, fps);
const pulseOpacity = parseFloat(cssAnimVars['--remotion-pulse-opacity' as string]);

// In JSX:
<div style={{ background: '#fff', ...cssAnimVars }}>
  <style>{REMOTION_ANIM_OVERRIDES}</style>
  {/* ui-react components */}
</div>
```

**Formulas** (documented in `animUtils.ts`):
- Spinner: 1 full rotation per 0.7s
- Indeterminate progress bar: translates from -100% → 400% per 1.4s cycle
- Pulse dot: sine wave opacity, 1.5s period, range 0.35–1.0

**CSS selectors targeted** (fragile — update if ui-react class names change):
- `.af-spinner` — activity feed spinner
- `.af-progress-fill--indeterminate` — indeterminate progress bar
- `.stat-indexing-dot.visible` — dashboard stat card dot
- `.activity-live-dot` — recent activity live dot

---

## Timeline Architecture

### Master vs. scene-local frames
- `QrecDemo.tsx` owns absolute frame positions via `<Sequence from={N} durationInFrames={D}>`
- Inside each scene, `useCurrentFrame()` returns **0-based local frames** — not the global position
- Always write scene timings relative to 0; the Sequence handles placement

### Scene overlaps
60-frame overlaps between consecutive scenes enable crossfades. Each scene's fade-out starts 60f before its end; the next scene's fade-in runs simultaneously.

### Timeline comment convention
Every scene must open with a timeline block:
```tsx
// ── Timeline ────────────────────────────────────────────────────────────────
//   0– 15f:  scene fade in
//  15– 60f:  heading slides in
//  60–120f:  content animates
// 210–270f:  fade out
```

---

## Scene Patterns

### Simple scene (≤4 phases)
Use per-variable `interpolate()` calls. Keep frame boundaries as named constants at the top.

```tsx
const FADE_IN   = 15;
const CONTENT   = 30;
const FADE_OUT  = durationInFrames - 20;
```

### Complex scene (5+ phases)
Use a state-machine approach (see `Indexing.tsx`):
```tsx
const ACTIVITY_SEQUENCE: ActivityState[] = [
  { frame: 0,   type: 'idle' },
  { frame: 30,  type: 'downloading', progress: 0 },
  { frame: 90,  type: 'indexing', count: 0 },
  // ...
];
function getCurrentState(frame: number): ActivityState { ... }
```
This decouples frame numbers from rendering logic — easier to adjust timing by editing the sequence array.

### Spring entrance pattern
```tsx
const sp = spring({frame: frame - DELAY, fps, config: SPRING_BOUNCY});
const scale   = interpolate(sp, [0, 1], [0.3, 1]);
const opacity = interpolate(frame, [DELAY, DELAY + 20], [0, 1], CLAMP);
```
Spring drives motion; separate `interpolate` drives opacity. Don't tie opacity to the spring value (spring can overshoot → opacity > 1).

---

## Data (`demo/src/data/index.ts`)

Single source of truth for all synthetic demo data. Never hardcode demo values inside scene files.

- **Anchor date**: `DEMO_TODAY = 2026-03-29` — makes renders stable regardless of actual date
- **Seeded LCG**: deterministic pseudo-random; same seed → same output always
- **`HEATMAP_DAYS`**: 26-week combined activity (182 days), ~847 sessions total
- **`HEATMAP_BYPROJECT_BREAKDOWN`**: date-keyed by-project counts for tooltip data
- **`SESSIONS`**: 12 enriched sessions with all metadata fields

### Heatmap animation pattern (canonical — from Onboard.tsx)
Distribute `currentCount` sessions across target days using **largest-remainder apportionment** (Hamilton's method). This ensures `sum(animatedDays) === currentCount` exactly, so the heatmap total never drifts from the stat card:

```tsx
const exact  = targetDays.map(d => (d.count / weightTotal) * currentCount);
const floors = exact.map(Math.floor);
const remaining = currentCount - floors.reduce((s, v) => s + v, 0);
exact.map((v, i) => ({i, frac: v % 1}))
  .sort((a, b) => b.frac - a.frac)
  .slice(0, remaining)
  .forEach(({i}) => floors[i]++);
const animatedDays = targetDays.map((d, i) => ({...d, count: floors[i]}));
```

Do NOT use `Math.round(count * progress)` per-day — rounding drift causes the heatmap total to diverge from the stat card at low counts (most days round to 0).

---

## Real UI Component Integration

Scenes import from `ui-react/src/` directly (not the built `components.js`). This means:
1. Changes to `ui-react/` CSS/components are reflected in the video immediately
2. CSS custom properties (`--bg`, `--accent`, etc.) must be available — `Root.tsx` imports `variables.css` globally
3. Components must be **controlled** (all state passed as props). Remotion owns the timeline; components are pure renderers of frame-driven data.

When a ui-react component has a bug or visual issue visible in the demo, **fix it in ui-react** — the fix applies to both the real app and the video.

---

## Gotchas

1. **CSS animations are silent no-ops in Remotion.** Use `remotionCSSAnimVars` + `REMOTION_ANIM_OVERRIDES` for any animated ui-react component.

2. **Heatmap counts must use apportionment, not `Math.round`.** At `sessionsCount=13` with a scale factor of 0.2, every day rounds to 0.

3. **Only the last 30 days of the heatmap animate.** Claude only retains 30 days of sessions. The full 15-week grid (105 days) is displayed with older days at count=0 to match the real UI layout.

4. **Logo hand-placement geometry is trial-and-error.** If Clawd's arm position changes, recalculate `armVisualPos()` in Opening.tsx by measuring SVG pixel coordinates at the target scale.

5. **`getTyped` needs explicit `frame` argument.** The shared version is a pure function — don't close over `frame` from scope.

6. **`Sequence from={N}` makes inner frames 0-based.** A scene placed at `from={210}` receives `useCurrentFrame() === 0` at absolute frame 210. Never add the offset manually inside a scene.
