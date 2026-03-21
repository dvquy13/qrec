// demo/src/animUtils.ts
// Shared animation utilities for Remotion scenes.
// All functions are pure (take frame/fps as args) so scenes can use them outside React components.

// ── CLAMP ────────────────────────────────────────────────────────────────────
// Pass to any interpolate() call to prevent extrapolation beyond the input range.
export const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// ── Spring configs ────────────────────────────────────────────────────────────
// Named presets keep the visual language consistent across scenes.
// "bouncy" — mascots, browsers, logos entering the stage (~1s settle, slight overshoot)
export const SPRING_BOUNCY = {damping: 14, stiffness: 140} as const;
// "snappy" — UI panels, cards, quick pops (~0.5s settle, no overshoot)
export const SPRING_SNAPPY = {damping: 20, stiffness: 200} as const;
// "crisp"  — text/headings that slide in with zero bounce
export const SPRING_CRISP = {damping: 200} as const;

// ── Typing animation ──────────────────────────────────────────────────────────
// Returns the visible portion of `text` at the given frame, starting from `startFrame`.
// Default charsPerFrame ≈ 1.4 at 30fps ≈ ~42 chars/second — natural typing speed.
export function getTyped(
  text: string,
  startFrame: number,
  frame: number,
  charsPerFrame = 1.4,
): string {
  return text.substring(
    0,
    Math.min(text.length, Math.floor(Math.max(0, frame - startFrame) * charsPerFrame)),
  );
}

// ── Cursor blink ──────────────────────────────────────────────────────────────
// Returns true on the "bright" half of each blink cycle.
// Default period 15f = 0.5s at 30fps.
export function cursorBlink(frame: number, period = 15): boolean {
  return Math.floor(frame / period) % 2 === 0;
}

// ── CSS animation overrides for Remotion ─────────────────────────────────────
// CSS animations don't run in Remotion's headless renderer. Any ui-react component
// that uses CSS animations must be overridden with frame-driven values passed as
// CSS custom properties (see the <style> block pattern in Onboard.tsx).
//
// CSS selectors that need overriding (match ui-react/src/ class names):
//   .af-spinner                   → rotation    (--remotion-spin-angle)
//   .af-progress-fill--indeterminate → translation (--remotion-indeterminate-x)
//   .stat-indexing-dot.visible    → opacity pulse (--remotion-pulse-opacity)
//   .activity-live-dot            → opacity pulse (--remotion-pulse-opacity)
//
// Usage:
//   const cssVars = remotionCSSAnimVars(frame, fps);
//   <div style={{ ...cssVars }}>
//     <style>{REMOTION_ANIM_OVERRIDES}</style>
//     ...
//   </div>
export function remotionCSSAnimVars(
  frame: number,
  fps: number,
): Record<string, string> {
  // Spinner: 1 full rotation per 0.7s
  const spinAngle = (frame / (0.7 * fps)) * 360;
  // Indeterminate progress bar: position cycles from -100% → 400% per 1.4s
  const indetermPhase = (frame / (1.4 * fps)) % 1;
  const indetermX = `${indetermPhase * 500 - 100}%`;
  // Live/pulse dot: sine wave opacity, 1.5s period, range 0.35–1.0
  const pulseOpacity = 0.35 + 0.65 * (Math.sin((frame / (1.5 * fps)) * 2 * Math.PI) * 0.5 + 0.5);

  return {
    ['--remotion-spin-angle' as string]: `${spinAngle}deg`,
    ['--remotion-indeterminate-x' as string]: indetermX,
    ['--remotion-pulse-opacity' as string]: String(pulseOpacity),
  };
}

// The companion <style> block to inject alongside remotionCSSAnimVars().
// Drop this into any scene that renders live ui-react components.
export const REMOTION_ANIM_OVERRIDES = `
  .af-spinner { animation: none !important; transform: rotate(var(--remotion-spin-angle, 0deg)); }
  .af-progress-fill--indeterminate { animation: none !important; transform: translateX(var(--remotion-indeterminate-x, -100%)); }
  .stat-indexing-dot.visible, .activity-live-dot { animation: none !important; opacity: var(--remotion-pulse-opacity, 1); }
`;
