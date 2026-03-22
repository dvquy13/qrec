# Plan: Demo Video Final Touch

Reference storyboard: `demo/STORYBOARD.md`

## Overview

Four changes needed to complete the demo video:

1. **Rewrite `Opening.tsx`** — cascade-of-sessions → lens-organizes → "Meet qrec." → scene ends (no terminal)
2. **Modify `Onboard.tsx`** — terminal entrance changes from fade-in to slide-up from bottom (owns the transition from Opening)
3. **Add Clawd peek to `SearchDemo.tsx`** — mascot appears at right edge before terminal slides in (frames 82–120)
4. **Create `Closing.tsx`** — Clawd+logo-in-hand + tagline + CTA

Then update `Root.tsx` to wire the new/renamed compositions.

---

## Execution Order

**Execute in this order: Task 4 → Task 1 → Task 2 → Task 3 → Task 5**

Reason: Task 4 (Closing.tsx) must copy spring/geometry constants from the current
`Opening.tsx` `showLogo=true` path (frames 158–270). Task 1 rewrites Opening.tsx and
deletes that code. If Task 1 runs first, the source is gone.

Tasks are numbered by creation order; execution order differs:

| Step | Task | File |
|------|------|------|
| 1st  | Task 4 | Create Closing.tsx (copy Opening showLogo code first) |
| 2nd  | Task 1 | Rewrite Opening.tsx |
| 3rd  | Task 2 | Modify Onboard.tsx (terminal slide-up entrance) |
| 4th  | Task 3 | Add Clawd peek to SearchDemo.tsx |
| 5th  | Task 5 | Update Root.tsx |

---

## Remotion / Design-System Compliance Notes

- **No `Math.random()`** — all hardcoded entry vectors; Remotion renders must be deterministic.
- **No CSS animations** — use spring/interpolate only; CSS animation loops are silent no-ops in the renderer.
- **Design system scope** — `DESIGN_SYSTEM.md` governs the light-mode `ui-react` components embedded
  in scenes. Opening and Closing are full-screen promo scenes on `theme.blue`; their typography/spacing
  is not bound by the light-mode token rules, only by the storyboard spec.
- **CTA typo** — `CTA.tsx` has `github.com/dvquys/qrec` (wrong). Closing.tsx must use `dvquy13/qrec`
  for the GitHub URL.

---

## Task 4 — Create Closing.tsx

> **Do this first** — before Task 1 rewrites Opening.tsx.

**New file:** `demo/src/scenes/Closing.tsx`
**Composition:** `Closing` in Root.tsx · target ~280f

### Timeline

```
  0– 30f:  fade in
 30–160f:  Clawd + logo-in-hand animation (copy from current Opening.tsx showLogo path)
            — Clawd springs in center, arms up, logo arcs in and lands in hand
160–195f:  tagline fades in (large bold white text, two lines)
195–225f:  install command block fades in
225–245f:  github URL fades in
245–270f:  hold
270–280f:  fade to black
```

### Clawd + logo animation

Copy these constants and spring/interpolate expressions **verbatim** from the current
`Opening.tsx` `showLogo=true` path before Task 1 begins:

- `armVisualPos()` helper
- `LOGO_SIZE`, `REVEAL_SCALE`, `handleFrac`, `handlePx`, `logoRestLeft`, `logoRestTop`
- `revealClawdSp`, `revealClawdScale`, `revealClawdOp`, `revealArmsUp`
- `logoArcSp`, `logoOffsetX`, `logoOffsetY`, `logoEnterScale`, `logoOp`

Adjust all frame offsets to be relative to frame 30 in this new scene (i.e. shift by
−128f from Opening's original offsets: Opening frame 158 → Closing frame 30).

### Tagline

```tsx
<div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2.5, color: '#ffffff', lineHeight: 1.15, textAlign: 'center' }}>
  Total recall for Claude Code —<br />
  yours and Claude's. On-device.
</div>
```

### CTA block

```tsx
{/* Install command */}
<div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 28px', fontFamily: theme.mono, fontSize: 18, color: '#ffffff' }}>
  $ npm install -g @dvquys/qrec
</div>

{/* GitHub URL */}
<div style={{ fontSize: 15, fontFamily: theme.mono, color: 'rgba(255,255,255,0.55)' }}>
  github.com/dvquy13/qrec
</div>
```

Note: npm package is `@dvquys/qrec` (correct). GitHub URL is `dvquy13/qrec` (not `dvquys`
— CTA.tsx has the wrong username; do not copy from there).

---

## Task 1 — Rewrite Opening.tsx

**Composition:** `OpeningLogo` in Root.tsx · target ~185f (no terminal — Onboard owns it)

### Timeline

```
  0–  8f:  fade in
  8– 60f:  session cards cascade in from all edges (10 cards, random angles/rotations)
            counter appears: "847 sessions"
 60–100f:  qrec logo springs in center (SPRING_BOUNCY), glow ring fades in
100–150f:  cards within lens radius spring to vertical list (no rotation, aligned)
            cards outside follow — all snap to order
150–175f:  "Meet qrec." fades in below logo
175–185f:  scene fades out
```

The terminal slide-up is no longer part of this scene — it is the opening of `Onboard.tsx`.
This eliminates the terminal content question and avoids duplicating Onboard's chrome.

### Session card design

Each card is a simplified tile — NOT a full SessionCard component render:
- Left edge: 4px colored bar (project color — use 3–4 distinct colors)
- Title: one line, white, 14px, truncated
- Date: right-aligned, muted, 12px
- Card: white bg, 8px radius, ~340×52px
- ~10 cards total

### Card cascade mechanics

- Each card has a fixed random entry vector (hardcode 10 entries — no Math.random, Remotion renders must be deterministic)
- Entry: spring from off-screen position to a resting "pile" position (random x/y within ~800×500 center zone, random rotation −15° to +15°)
- Stagger: cards enter frames 8, 12, 16, 20, 24, 28, 32, 36, 40, 44
- Use `SPRING_SNAPPY` for entry

### Lens-organizes mechanics

- At frame 100, compute each card's "organized" position: centered vertical stack, x=center, spacing=64px, rotation=0
- Use spring driven from frame 100 for each card to lerp toward organized position
- Cards outside lens (~250px radius from center) also organize but with a slight delay (+10f)
- Glow ring: `radial-gradient` centered on logo, opacity 0→0.4 over frames 60–80

### Imports needed

```ts
import {QrecLogo} from '../components/QrecLogo';
// No ClawdMascot import — mascot removed from this scene
// No TerminalWindow — terminal owned by Onboard.tsx
```

---

## Task 2 — Modify Onboard.tsx (terminal slide-up entrance)

**File:** `demo/src/scenes/Onboard.tsx`
**Scope:** Small — ~5 line change, no frame offset shifts required

### What to change

The terminal currently fades in (`terminalOpacity` goes `0→1` over frames 0–8). Change it to
slide up from below the frame instead — Onboard now owns the visual transition from Opening.

### Implementation

Add one spring for the slide:

```ts
const terminalSlideY = interpolate(
  spring({frame, fps, config: SPRING_SNAPPY}),
  [0, 1],
  [600, 0],
);
```

Remove the fade-in portion of `terminalOpacity` (keep only the fade-out):

```ts
// Before:
const terminalOpacity = interpolate(frame, [0, 8, 108, 112], [0, 1, 1, 0], CLAMP);
// After:
const terminalOpacity = interpolate(frame, [108, 112], [1, 0], CLAMP);
```

Add `transform: \`translateY(${terminalSlideY}px)\`` to the terminal's outer wrapper div
(the one with `position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', ...`).

All existing frame offsets (typing at 12f, install response at 48f, etc.) stay unchanged —
the SPRING_SNAPPY settles within ~15 frames so it's visually complete before typing begins.

---

## Task 3 — Add Clawd peek to SearchDemo.tsx

**File:** `demo/src/scenes/SearchDemo.tsx`
**Scope:** Small — add ~25 lines, no timeline changes

### What to add

Between tab switch (frame 78) and split start (frame 105), Clawd appears at the right edge:

```
 82–100f:  Clawd springs in from x=1280 → x=1050, scale 0→0.6, armsUp=true
100–120f:  Clawd fades out (opacity 1→0) as terminal begins sliding in at frame 105
```

### Implementation

Add these values in the animation section of SearchDemo.tsx:

```ts
const clawdPeekSp = spring({frame: frame - 82, fps, config: SPRING_SNAPPY});
const clawdX = interpolate(clawdPeekSp, [0, 1], [1280, 1050]);
const clawdOpacity = interpolate(frame, [82, 92, 105, 120], [0, 1, 1, 0], CLAMP);
```

Render ClawdMascot inside the AbsoluteFill, positioned absolutely at `(clawdX, 200)`,
`scale=0.6`, `armsUp=true`. Include `frame` and `fps` props (required by ClawdMascotProps,
already available from `useCurrentFrame` / `useVideoConfig` in SearchDemo):

```tsx
<div style={{ position: 'absolute', left: clawdX, top: 200, opacity: clawdOpacity }}>
  <ClawdMascot
    scale={0.6}
    opacity={1}
    bob={0}
    armsUp={true}
    frame={frame}
    fps={fps}
    color="#ffffff"
  />
</div>
```

```ts
import {ClawdMascot} from '../components/ClawdMascot';
```

---

## Task 5 — Update Root.tsx

```tsx
import {Opening} from './scenes/Opening';       // no change to import; drop showLogo wrapper
import {Closing} from './scenes/Closing';        // new

// Remove the OpeningLogo wrapper function:
// const OpeningLogo: React.FC = () => <Opening showLogo />;  ← DELETE
// Opening no longer has a showLogo prop after the rewrite.

// Update composition (duration 270 → 185, component: Opening directly):
<Composition id="OpeningLogo" component={Opening} durationInFrames={185} fps={30} width={1280} height={720} />

// Onboard duration stays 198 — no offset shifts needed (slide-up settles within existing frame 0–15):
<Composition id="Onboard" component={Onboard} durationInFrames={198} fps={30} width={1280} height={720} />

// Add after SearchDemo:
<Composition id="Closing" component={Closing} durationInFrames={280} fps={30} width={1280} height={720} />
```

---

## Completion Checklist

- [x] Task 4: Closing.tsx created — Clawd+logo + tagline + CTA
- [x] Task 1: Opening.tsx rewritten — cascade + lens + "Meet qrec." + fade out (~185f)
- [x] Task 2: Onboard.tsx modified — terminal entrance is slide-up from bottom
- [ ] Task 3: SearchDemo.tsx — Clawd peek added at frames 82–120 (with `frame`+`fps` props)
- [ ] Task 5: Root.tsx updated — OpeningLogo wrapper removed, Opening duration → 185, Closing composition added (280f)
- [ ] Verify: preview all scenes in Remotion studio at localhost:3000
- [ ] Verify: Opening → Onboard visual handoff looks seamless (terminal slides in at Onboard start)
- [ ] Verify: cursor coordinates in SearchDemo still correct after Clawd addition (no layout shift)
