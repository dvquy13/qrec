# Plan: ui-react CSS Self-Containment

## Problem

`ui-react` components silently depend on global classes defined only in `ui/styles.css`. When a
component is used outside the full browser app (Remotion demo, future embedding, tests), those
elements render unstyled with no error or warning.

**Full audit of leaked classes (global → component dependency):**

| Class(es) | Used by |
|-----------|---------|
| `.tag`, `.clickable-tag` | SessionCard, EnrichBlock, TagBadge, SessionDetailSection |
| `.enrich-tag` | SessionCard, EnrichBlock, TagBadge |
| `.session-id`, `.session-ts`, `.copy-btn` | SessionCard, SessionDetailSection |
| `.section-heading` | DashboardSection, RecentSessionsSection, RecentActivitySection |
| `.stat-card` | DashboardSection, StatCard |
| `.empty-state`, `.loading-state`, `.spinner` | SessionsSection, SessionDetailSection |
| `.search-grid`, `.latency-bar` | SessionsSection |

Components with **no paired CSS file at all**: `TagBadge`, `StatCard`

## Goal

Every `ui-react` component must render correctly with only its own CSS imports — zero silent
dependency on `ui/styles.css`.

## Approach

**Not** CSS modules (would require Bun build config changes + significant TSX refactor).

Instead: create a shared CSS file within `ui-react` that is the single source of truth for
cross-component utility classes, imported by components that need it. `ui/styles.css` then removes
its copies of those classes (they arrive via the `components.css` bundle that `index.html` already
loads).

This is the **minimal, reversible change**: no component API changes, no build system changes, no
TSX edits.

## Steps

### Step 1 — Create `ui-react/src/styles/shared.css`

Extract all cross-component utility classes from `ui/styles.css` into a new file:

```css
/* ui-react/src/styles/shared.css
   Cross-component utility classes. This is the single source of truth.
   ui/styles.css must NOT duplicate these — it receives them via components.css.
*/

/* Tags / pills */
.tag { background: transparent; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.clickable-tag { cursor: pointer; transition: color 0.15s; }
.clickable-tag:hover { color: var(--accent); }
.enrich-tag { ... }   /* copy from ui/styles.css */
.session-id { ... }
.session-ts { ... }
.copy-btn { ... }
.copy-btn:hover { ... }

/* Layout */
.section-heading { ... }
.stat-card { ... }
.search-grid { ... }
.latency-bar { ... }

/* States */
.empty-state { ... }
.loading-state { ... }
.spinner { ... }
```

### Step 2 — Import `shared.css` in components that need it

Add `import '../styles/shared.css'` (or the appropriate relative path) at the top of each component
CSS file that uses classes from the shared set. CSS import deduplication in the Bun bundler means
`shared.css` is emitted only once in the output `components.css`.

Components to update:
- `SessionCard.css` — import shared (tag, clickable-tag, enrich-tag, session-id, session-ts)
- `EnrichBlock.css` — import shared (tag, enrich-tag)  ← already has `.tag` as quick-fix; remove that, use import
- `TagBadge.tsx` — create `TagBadge.css`, import it + shared
- `StatCard.tsx` — create `StatCard.css`, import it + shared (stat-card)
- `DashboardSection.css` — import shared (section-heading, stat-card)
- `RecentSessionsSection.css` — import shared (section-heading)
- `RecentActivitySection.css` — import shared (section-heading); remove the "mirrors" comment workaround
- `SessionsSection.css` — import shared (search-grid, latency-bar, empty-state, loading-state, spinner)
- `SessionDetailSection.css` — import shared (tag, clickable-tag, session-id, copy-btn, empty-state)  ← remove quick-fix copy

### Step 3 — Remove duplicate definitions from `ui/styles.css`

Delete the class definitions that now live in `shared.css`. `ui/index.html` already loads
`components.css` before any app-specific styles, so the classes will be present.

Add a comment block at the deletion site:
```css
/* Classes moved to ui-react/src/styles/shared.css (bundled into ui/components.css) */
```

### Step 4 — Verify build output

Run `cd ui-react && bun run build.ts` and confirm:
1. `ui/components.css` contains all the shared classes exactly once
2. No duplicate class definitions between `components.css` and `ui/styles.css`
3. `ui/index.html` loads `components.css` before `styles.css` (already the case)

### Step 5 — Verify Remotion demo

Open the Remotion preview of `EnrichDetail` (and any other scene using `SessionDetailSection` or
`EnrichBlock`) and confirm the subtitle row, tags, and stat cards all render with correct styling
without any injected `<style>` workarounds.

### Step 6 — Smoke test

Add a check to `scripts/smoke-test.sh` that fetches `ui/components.css` from the running daemon
and greps for `.tag` and `.section-heading` to assert the shared classes are present in the bundle:

```bash
COMPONENTS_CSS=$(curl -s http://localhost:25927/components.css)
echo "$COMPONENTS_CSS" | grep -q '\.tag' || { echo "FAIL: .tag missing from components.css"; exit 1; }
echo "$COMPONENTS_CSS" | grep -q '\.section-heading' || { echo "FAIL: .section-heading missing"; exit 1; }
echo "OK: shared classes present in components.css"
```

## What this does NOT change

- Build system (still Bun IIFE, no CSS modules)
- Component API (no TSX changes except creating CSS files for TagBadge/StatCard)
- `ui/styles.css` layout/typography rules (only the extracted class blocks are removed)
- Demo import path (`demo/src/` still imports `ui-react/src/` directly — CSS imports are resolved
  by Vite/Bun at demo build time, so `shared.css` is picked up automatically)

## Why not CSS modules?

CSS modules would be the "correct" long-term solution but require:
1. Bun build config changes (`cssModules: true`)
2. Renaming every `className="foo"` to `className={styles.foo}` across all TSX
3. Rewriting injected `<style>` blocks in `EnrichDetail.tsx` (they reference class names by string)
4. Likely breaking the IIFE global-CSS assumption that `app.js` depends on

CSS modules can be revisited if `ui-react` is ever extracted into a standalone npm package. For
now, the `shared.css` approach gives full self-containment with minimal disruption.

## Acceptance Criteria

### AC1 — Zero leaked classes
Every class used in a `ui-react` TSX file is defined in either:
- that component's own `.css` file, or
- `ui-react/src/styles/shared.css` (imported by the component CSS)

**Verify:** `grep -r 'className=' ui-react/src/ | grep -oP '"[^"]*"' | tr ' ' '\n' | sort -u` — for every class listed, it must exist in a `ui-react` CSS file. No class should require `ui/styles.css` to render.

### AC2 — No class definitions remain in `ui/styles.css` for the migrated set
The following classes must NOT appear as definitions (`.foo {`) in `ui/styles.css` after the migration:
`.tag`, `.clickable-tag`, `.enrich-tag`, `.session-id`, `.session-ts`, `.copy-btn`, `.section-heading`, `.stat-card`, `.search-grid`, `.latency-bar`, `.empty-state`, `.loading-state`, `.spinner`

**Verify:** `grep -E '^\.(tag|clickable-tag|enrich-tag|session-id|session-ts|copy-btn|section-heading|stat-card|search-grid|latency-bar|empty-state|loading-state|spinner)\b' ui/styles.css` → must return no matches.

### AC3 — `shared.css` classes appear exactly once in the built bundle
Running `cd ui-react && bun run build.ts` produces a `ui/components.css` where each shared class appears exactly once (CSS `@import` deduplication works correctly).

**Verify:** `grep -c '\.tag {' ui/components.css` → must equal `1`.

### AC4 — Remotion demo renders correctly with no injected workarounds
Open `EnrichDetail` in Remotion Studio at a frame in the detail phase (frame ~100). The subtitle row ("qrec · 2026-03-13 · c0ffee04 · 2 turns") must show styled pill tags — same visual as the real qrec UI at `localhost:25927/#session/<id>`. No `<style>` injection required in `EnrichDetail.tsx` to achieve this.

**Verify:** Screenshot comparison of demo frame ~100 vs real qrec UI session detail.

### AC5 — Real qrec UI unchanged
Load `localhost:25927` in a browser. Dashboard, session detail, search results must look identical to before the migration. No visual regressions.

**Verify:** Run `bash scripts/smoke-test.sh` — must pass. Manual spot-check of dashboard + one session detail.

### AC6 — Smoke test assertion added
`scripts/smoke-test.sh` includes a check that fetches `ui/components.css` from the running daemon and asserts `.tag` and `.section-heading` are present.

**Verify:** Run the smoke test and confirm the new assertion line appears in output as `OK`.

### AC7 — TagBadge and StatCard have paired CSS files
Both components must have a `.css` file imported in their TSX (even if minimal). No component in `ui-react/src/` is CSS-file-less.

**Verify:** `ls ui-react/src/components/TagBadge/TagBadge.css ui-react/src/components/StatCard/StatCard.css` → both exist.

### AC8 — Quick-fix copies removed
The manually copied `.tag` definition in `EnrichBlock.css` and the copied block in `SessionDetailSection.css` (added as a quick-fix in this session) are removed. Those classes now come exclusively from the `shared.css` import.

**Verify:** `grep '\.tag {' ui-react/src/components/EnrichBlock/EnrichBlock.css` → no match. Same for `SessionDetailSection.css`.

---

## Gotcha to document in demo.md (after completion)

Remove the current workaround note about copying global classes into component CSS. Replace with:
> Components import `ui-react/src/styles/shared.css` for cross-component utilities. The demo picks
> this up automatically via Vite. The full browser app gets it via `ui/components.css`.
