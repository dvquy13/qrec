# Demo Video: Open Concerns

Items that need your input before or during implementation.

---

## C1. Opening scene — one stream or two columns?

Current proposal: single stream of questions fading in.
Alternative: two-column ("For you" left / "For Claude" right) to visually separate the two audiences from the start.

The two-column version is richer but risks looking cluttered at 1280×720 with enough padding. Single stream is cleaner, and the human vs. agent distinction can be implied by question content rather than layout.

**Lean:** single stream. Confirm?

---

## C2. ActivityFeed — does the demo need expandable run groups?

In the Indexing scene, the ActivityFeed is animation-driven (we control the state via `ACTIVITY_SEQUENCE`). Run groups don't need to be expandable — just show labels + progress bars.

The full component (for `app.js` adoption) needs expansion + lazy session title loading.

**Plan:** build the full component but the demo scene never triggers expansion. No demo-specific shortcuts.

---

## C3. HeatmapGrid width at full props

With `showWeeklyBars=true` + `showDayLabels=true`, the full heatmap is ~620px wide (26 weeks × 17px + 40px day labels + 120px inline bars). The BrowserFrame in the ProjectDashboard scene needs to be wide enough to show it without clipping.

At 1280px canvas minus padding: we have ~1100px for the BrowserFrame. The heatmap + filter pills fit comfortably. The "recent sessions" list goes below the heatmap inside the frame. Height may be tight — heatmap grid is ~7×17px = ~120px, plus bottom bar chart (~84px), plus month labels, plus recent sessions. May need to limit to 2 recent session cards below rather than 3.

**Action:** verify during build by running `npx remotion preview` and eyeballing layout.

---

## C4. Project switching animation — smooth colour interpolation?

When the user "clicks" a different project pill, the heatmap recolours. Two approaches:

a) **Hard cut**: at frame N, `project` prop switches. Heatmap immediately shows new colour. Feels like a real click.
b) **Crossfade**: opacity interpolate old → new over 15 frames. Smoother but less realistic.

**Lean:** hard cut (option a) — more authentic to the actual UI behaviour.

---

## C5. SessionDetail scene — what content to show?

The session detail needs realistic-looking content: tool calls, a thinking block (collapsed, purple), some assistant text. All synthetic.

Proposed content: a fictional session about "Fixing a race condition in the indexer" — we have enough real context from our sessions to make this look authentic. Tool calls: `Read`, `Edit`, `Bash`. Thinking block: collapsed with "Analyzing the mtime comparison logic...".

**Confirm:** is this the right session to show, or do you want a different topic?

---

## C6. CTA scene — logo.svg

`public/logo.svg` exists. Should it appear in the CTA scene? Currently the CTA just has the `qrec` wordmark in mono font. The SVG could replace or complement that.

**Need to see the SVG** before deciding. Quick check during implementation.

---

## C7. `qrec search` output format in browse mode

When `qrec search --project qrec` (no query) hits `GET /sessions`, the response shape is `{ sessions, total, offset, limit }` — different from search's `{ results }`.

Options for CLI output:
a) Print compact lines: `[date] title — summary (truncated)`
b) Print full JSON (consistent with search mode but verbose)
c) Print same JSON structure as search results (normalise fields)

**Lean:** option (a) for browse mode — it's human-readable and useful in Claude's context window without token bloat. Search mode keeps full JSON (already used by recall skill).
