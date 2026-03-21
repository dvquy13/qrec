# Demo Video Rules (demo/)

## Gotchas

**CSS animations are silent no-ops in Remotion.** The renderer never runs the animation loop. Any ui-react component with CSS animations (spinner, indeterminate bar, pulse dot) will appear frozen unless overridden with frame-driven values. Use `remotionCSSAnimVars` + `REMOTION_ANIM_OVERRIDES` from `animUtils.ts`.

**Heatmap counts must use largest-remainder apportionment, not `Math.round` per day.** At low session counts (e.g. 13 sessions, heatmap scale factor ~0.2), `Math.round(count * scale * progress)` makes every day round to 0 — the heatmap shows blank while the stat card shows 13. Apportionment ensures `sum(animatedDays) === sessionsCount` exactly at every frame.

**Only the last 30 days of the heatmap animate.** Claude Code only retains ~30 days of session JSONL files. Older weeks are shown at count=0 (not their real data) to reflect what a new user would actually see on first run.

**`Sequence from={N}` makes inner frames 0-based.** A scene placed at `from={210}` receives `useCurrentFrame() === 0` at absolute frame 210. All scene-internal timings are relative to 0 — never add the sequence offset inside a scene.

**Logo/mascot hand-placement geometry requires manual pixel measurement.** The arm contact point in `Opening.tsx` was derived by measuring SVG pixel coordinates at a specific scale. If `ClawdMascot` SVG changes or scale changes, recalculate `armVisualPos()` empirically — there's no formula that derives it automatically.
