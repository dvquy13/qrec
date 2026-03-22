---
paths:
  - demo/**
---

# Demo Video Rules (demo/)

## Skills to use

Use remotion-best-practices skill for creating videos with Remotion.

## Gotchas

**CSS animations are silent no-ops in Remotion.** The renderer never runs the animation loop. Any ui-react component with CSS animations (spinner, indeterminate bar, pulse dot) will appear frozen unless overridden with frame-driven values. Use `remotionCSSAnimVars` + `REMOTION_ANIM_OVERRIDES` from `animUtils.ts`. Note: `REMOTION_ANIM_OVERRIDES` covers `.af-spinner` (ActivityFeed) and `.spinner` (SessionsSection isLoading) — if a new animated class is added to `shared.css`, add it there too.

**Heatmap counts must use largest-remainder apportionment, not `Math.round` per day.** At low session counts (e.g. 13 sessions, heatmap scale factor ~0.2), `Math.round(count * scale * progress)` makes every day round to 0 — the heatmap shows blank while the stat card shows 13. Apportionment ensures `sum(animatedDays) === sessionsCount` exactly at every frame.

**Only the last 30 days of the heatmap animate.** Claude Code only retains ~30 days of session JSONL files. Older weeks are shown at count=0 (not their real data) to reflect what a new user would actually see on first run.

**`Sequence from={N}` makes inner frames 0-based.** A scene placed at `from={210}` receives `useCurrentFrame() === 0` at absolute frame 210. All scene-internal timings are relative to 0 — never add the sequence offset inside a scene.

**Demo imports `ui-react/src/` directly — no rebuild needed.** Unlike the main UI (which uses the pre-built `ui/components.js` bundle), the Remotion demo imports components straight from `ui-react/src/`. Changes to `heatmap.ts`, component TSX, etc. are reflected immediately in the Remotion preview without running `bun run build.ts`.

**Logo/mascot hand-placement geometry requires manual pixel measurement.** The arm contact point in `Opening.tsx` was derived by measuring SVG pixel coordinates at a specific scale. If `ClawdMascot` SVG changes or scale changes, recalculate `armVisualPos()` empirically — there's no formula that derives it automatically.

**Cursor target coordinates must be measured via DevTools, not estimated from layout math.** Layout math (padding + flex + margin calculations) is unreliable for pixel-precise cursor placement — real rendered positions differ by 50–100px from estimates. Pattern: navigate to the composition in `localhost:3000`, advance to a frame where the content is visible, then use `mcp__chrome-devtools__evaluate_script` to call `getBoundingClientRect()` on the target element and the preview container. Convert to frame coords: `frameX = (elemRect.left - previewRect.left) / (previewRect.width / 1280)`.

**Animating CSS class properties via injected `<style>` + CSS custom properties works in Remotion.** To highlight fields in real ui-react components (where you don't control inline styles), set numeric CSS custom properties on a wrapper div via `style={{ '--my-var': String(springValue) }}`, then inject a `<style>` block that uses `rgba(R, G, B, var(--my-var, 0))` for border/background and `::after` pseudo-elements for badges. The alpha channel in `rgba()` accepts `var()` and `calc(var() * N)` in modern CSS. Avoids the need to fork or wrap the component.

**`ui-react` components get cross-component utility classes via `shared.css`, not `ui/styles.css`.** Classes like `.tag`, `.clickable-tag`, `.session-id`, `.copy-btn`, `.empty-state`, `.section-heading`, `.stat-card`, `.spinner` etc. live in `ui-react/src/styles/shared.css` and are imported by each component/section CSS file that needs them. The demo picks this up automatically via Vite at `ui-react/src/` import time — no extra setup required. `ui/styles.css` does NOT define these classes; they arrive in the browser app via `ui/components.css` (built from the shared imports).

**Simulating CSS `:hover` and button clicks in Remotion requires data attributes + injected styles.** CSS `:hover`/`:active` never fire in the headless renderer. Pattern for hover: set `data-foo-hovered={frame >= N ? 'true' : 'false'}` on the container, inject `[data-foo-hovered="true"] .target { /* exact hover CSS rules */ transition: none !important; }`. Pattern for press/click: use a CSS custom property `--scale` on the wrapper and inject `.target { transform: scale(var(--scale, 1)) !important; transition: none !important; }`, driven by `interpolate(frame, [clickFrame, clickFrame+5, clickFrame+14], [1, 0.88, 1], CLAMP)`. Mirror the exact CSS hover rules from the component's stylesheet — don't recreate them.

**Derive element position from live animated values, not a fixed scale snapshot.** When placing a logo/badge/cursor at a mascot's arm or other animated anchor, compute position from the *current* spring value (`revealClawdScale`) + arm state (`revealArmsUp`), not from a hardcoded `REVEAL_SCALE` constant. A snapshot constant drifts from reality while the spring is still moving, requiring a separate tracking animation (`logoArmFactor`, `ARM_DOWN_Y`) that is hard to keep in sync. Pattern: `const armNow = armsUp ? armVisualPos(currentScale) : armVisualPosDown(currentScale); top = armNow.y - handlePx;` — logo is frame-perfect with zero extra code.

**Calculate spring settling time before scheduling dependent animations.** For `spring({config: {damping, stiffness}})`, check ζ = damping / (2√stiffness). If ζ < 1 (underdamped — common with damping < 2√stiffness), the spring oscillates; settling frames ≈ (4 / (ζ · √stiffness)) · fps after trigger. Example: damping=11, stiffness=140 → ζ≈0.46, settles in ~35 frames at 30fps. Schedule any dependent animation (arm wave, reveal, etc.) *after* this frame, not before.

**Never apply two independent animations to the same CSS property simultaneously.** If an entrance spring controls Y offset, don't also shift `top` via a tracking factor during the same window — the two Y forces compound into a circular/looping path. Either gate the second animation to start after the spring settles, or collapse both into a single computed value (see live arm position pattern above).

**`SessionsSection` `isLoading` replaces the entire component.** The `isLoading` early-return fires before the search bar renders — using it to suppress the empty state also hides the search bar. To suppress empty states in Remotion scenes without losing the search bar: set `isEmpty={false}` and inject `<style>{'.empty-state { display: none !important; }'}</style>` into the scene. Both `isEmpty` and `sessions.length === 0` trigger `.empty-state`; the injected style suppresses both.

**Shared demo components — do not redefine inline.** The following are exported from shared locations; import them rather than writing new local versions:
- `TrafficDots` (`demo/src/components/TrafficDots.tsx`) — blue-monochrome traffic lights, accepts `dark?: boolean` for white variant.
- `MouseCursor` (`demo/src/components/MouseCursor.tsx`) — white SVG cursor, accepts `x, y, scale, opacity`.
- `TerminalWindow` (`demo/src/components/TerminalWindow.tsx`) — dark/light variant terminal with typewriter support.
- `BrowserFrame` (`demo/src/components/BrowserFrame.tsx`) — dark-themed browser chrome (macOS traffic lights). Note: production FullDemo scenes use a white-themed browser chrome inlined in each scene (not this component); `BrowserFrame` is for prototype/standalone scenes.
- Session c0ffee04 data (`demo/src/data/sessionC0ffee04.ts`) — `SESSION_ID`, `RAW_TITLE`, `SESSION_TITLE`, `SESSION_PROJECT`, `SESSION_DATE`, `SESSION_SUMMARY`, `SESSION_TAGS`, `SESSION_LEARNINGS`, `SESSION_QUESTIONS`, `MOCK_TURNS`, `ENRICH_ANIMATED_CSS`.
- QREC filtered heatmap (`demo/src/data/index.ts`) — `QREC_FILTERED_DAYS`, `QREC_SESSION_COUNT`, `QREC_ACTIVE_DAYS`.

**`useMemo` on searchResults is wrong if animated values are captured in the closure.** Wrapping `results.map(...)` in `useMemo([revealedCount])` silently freezes any per-frame animated value (e.g. `underlineDash`) that the map closure captures — the memoized value never updates even though the animation is running. Before memoizing a computation that builds React nodes, trace *all* variables captured in the closure; if any depend on `frame`, either exclude them from the memo or restructure to separate the frame-driven part.

**Verify Remotion changes by running `npx remotion studio` in `demo/`.** Open `localhost:3000`, step through each affected composition at key frames, and confirm animations render correctly. TypeScript clean + studio visual check is sufficient; no automated tests exist for scene output.

**ElevenLabs voiceover is generated separately, not inside Remotion.** `generate-voiceover.ts` is a one-shot Bun script — run it before rendering to produce `demo/public/voiceover/<scene-id>.mp3`. Requires `ELEVENLABS_API_KEY` in `../.env`. Usage: `bun --env-file=../.env generate-voiceover.ts`. `voiceover.ts` (`sceneAudioFile`, `getAudioDuration`) provides path helpers used by scenes to load the MP3s via `<Audio src={sceneAudioFile(id)}>`. The MP3s are gitignored — regenerate locally before any new render.

**`FullDemo` is the primary composition for the final render.** It glues all scenes (Opening → Onboard → ProjectFilter → EnrichDetail → SearchDemo → Closing) with hard cuts, offset-mapped voiceover, and a single `durationInFrames` derived from the sum of all scene durations. When adding or reordering scenes, update `FullDemo.tsx`; individual scene compositions are for preview/iteration only.
