# Plan: ContextHandoff Remotion Scene

## Context

A blog post at dvquys.com/posts/introducing-qrec describes a "context handoff" use case: when a Claude Code session approaches the context limit, open a new session, type "pick up context from the previous session", and qrec returns the prior context cleanly so work can continue without re-explaining anything.

This scene demonstrates that workflow visually. It's a standalone composition (not part of FullDemo) intended for embedding in the blog post as a `<video>` tag once rendered and uploaded to GitHub.

---

## New file

`/Users/dvq/frostmourne/qrec/demo/src/scenes/ContextHandoff.tsx`

## Scene structure (~300 frames, 30fps ≈ 10s)

| Frames | Beat |
|--------|------|
| 0–60   | `TerminalWindow` with a long active session — abbreviated user/assistant turns visible, scrolling. A "context usage" badge in the top-right animates from ~80% toward full (100%). |
| 60–90  | Terminal dims. Small label fades in: `"Context window approaching limit"` |
| 90–130 | Clean new terminal fades in (fresh session). Cursor blinks. |
| 130–200 | `getTyped()` animates the user message: `pick up context from the previous session` |
| 200–260 | Tool call block appears: `[Tool] qrec:recall` → result fades in line by line: `"Decided on FTS5 + sqlite-vec for the session index after testing speed vs. BM25 alone"` |
| 260–300 | User types next message (`ok let's continue with the migration`). `SceneFade` out. |

## Components to reuse

- `TerminalWindow.tsx` — terminal chrome + typing animation
- `getTyped()` from `animUtils.ts` — character-by-character typing
- `FadeIn.tsx`, `SceneFade.tsx` — entrance/exit transitions
- `spring()`, `interpolate()` from Remotion — smooth easing
- Existing color theme from `theme.ts`

Pattern reference: `Onboard.tsx` for typing animation, `SearchDemo.tsx` for split-content layout.

## Register in Root.tsx

```tsx
<Composition
  id="ContextHandoff"
  component={ContextHandoff}
  durationInFrames={300}
  fps={30}
  width={1280}
  height={720}
/>
```

Do NOT add to FullDemo — this is blog-only.

## Render & distribute

```bash
cd /Users/dvq/frostmourne/qrec/demo
npx remotion studio          # preview first
npx remotion render ContextHandoff out/context-handoff.mp4
```

Upload `out/context-handoff.mp4` to GitHub by dragging into a GitHub issue comment on the qrec repo. Copy the `https://github.com/user-attachments/assets/...` URL.

Then in the blog post (`posts/introducing-qrec/index.qmd`), add after the opening paragraph of "The thing I didn't design for":

```html
<video src="https://github.com/user-attachments/assets/YOUR_ID" controls loop muted playsinline style="width:100%"></video>
```

## Verification

1. `npx remotion studio` → ContextHandoff composition renders correctly in preview
2. Render completes without errors
3. Video plays correctly in the blog post preview (`make preview` in the blog repo)
