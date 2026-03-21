---
paths:
  - demo/**
---

# Demo Video Rules (demo/)

## Skills to use

Use remotion-best-practices skill for creating videos with Remotion.

## Gotchas

**CSS animations are silent no-ops in Remotion.** The renderer never runs the animation loop. Any ui-react component with CSS animations (spinner, indeterminate bar, pulse dot) will appear frozen unless overridden with frame-driven values. Use `remotionCSSAnimVars` + `REMOTION_ANIM_OVERRIDES` from `animUtils.ts`.

**Heatmap counts must use largest-remainder apportionment, not `Math.round` per day.** At low session counts (e.g. 13 sessions, heatmap scale factor ~0.2), `Math.round(count * scale * progress)` makes every day round to 0 — the heatmap shows blank while the stat card shows 13. Apportionment ensures `sum(animatedDays) === sessionsCount` exactly at every frame.

**Only the last 30 days of the heatmap animate.** Claude Code only retains ~30 days of session JSONL files. Older weeks are shown at count=0 (not their real data) to reflect what a new user would actually see on first run.

**`Sequence from={N}` makes inner frames 0-based.** A scene placed at `from={210}` receives `useCurrentFrame() === 0` at absolute frame 210. All scene-internal timings are relative to 0 — never add the sequence offset inside a scene.

**Demo imports `ui-react/src/` directly — no rebuild needed.** Unlike the main UI (which uses the pre-built `ui/components.js` bundle), the Remotion demo imports components straight from `ui-react/src/`. Changes to `heatmap.ts`, component TSX, etc. are reflected immediately in the Remotion preview without running `bun run build.ts`.

**Logo/mascot hand-placement geometry requires manual pixel measurement.** The arm contact point in `Opening.tsx` was derived by measuring SVG pixel coordinates at a specific scale. If `ClawdMascot` SVG changes or scale changes, recalculate `armVisualPos()` empirically — there's no formula that derives it automatically.

**Cursor target coordinates must be measured via DevTools, not estimated from layout math.** Layout math (padding + flex + margin calculations) is unreliable for pixel-precise cursor placement — real rendered positions differ by 50–100px from estimates. Pattern: navigate to the composition in `localhost:3000`, advance to a frame where the content is visible, then use `mcp__chrome-devtools__evaluate_script` to call `getBoundingClientRect()` on the target element and the preview container. Convert to frame coords: `frameX = (elemRect.left - previewRect.left) / (previewRect.width / 1280)`.

**Animating CSS class properties via injected `<style>` + CSS custom properties works in Remotion.** To highlight fields in real ui-react components (where you don't control inline styles), set numeric CSS custom properties on a wrapper div via `style={{ '--my-var': String(springValue) }}`, then inject a `<style>` block that uses `rgba(R, G, B, var(--my-var, 0))` for border/background and `::after` pseudo-elements for badges. The alpha channel in `rgba()` accepts `var()` and `calc(var() * N)` in modern CSS. Avoids the need to fork or wrap the component.

**`ui-react` components depend on global classes from `ui/styles.css` that are NOT in the component CSS files.** Classes like `.tag`, `.clickable-tag`, `.session-id`, `.copy-btn`, `.empty-state` are defined only in `ui/styles.css` (loaded by the browser app) but used in `SessionDetailSection` and `EnrichBlock`. When used in the demo or standalone, these elements render unstyled. Fix: copy the missing rules into the relevant component `.css` file so the component is self-contained.

**Simulating CSS `:hover` in Remotion requires a data attribute + injected style.** CSS `:hover` never fires in the headless renderer. Pattern: set `data-session-hovered={frame >= N ? 'true' : 'false'}` on the container, then inject `[data-session-hovered="true"] .target { color: var(--accent) !important; transition: none !important; }`.
