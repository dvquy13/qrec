# Plan: Unified Server-Side Search Filters with Date Range

> **STATUS: DONE** — Implemented 2026-03-15. All 49 tests pass. Smoke test passes.
>
> **What landed:**
> - `src/search.ts` — `SearchFilters` interface; pre-filter block prunes `rankMap` after BM25+KNN, before RRF
> - `src/routes.ts` — `handleSearch` accepts `dateFrom/dateTo/project/tag` in body; `handleSessions` dynamic WHERE clause builder; `?date=X` shorthand preserved
> - `src/mcp.ts` — `daemonSearch` spreads filters into POST body; tool schema extended
> - `ui/app.js` — `_filterDate` → `_filterDateRange ({from,to,label}|null)`; `applyFilters` debounced (300ms), immediate=true for preset/chip clicks; `doSearch`/`loadSessions` render directly (no circular `applyFilters` call); new `setDatePreset()`, `updateDateChip()`
> - `ui/index.html` — Today / This week / This month preset buttons
> - `ui/styles.css` — `.date-preset` + `.date-preset.active` styles
> - `test/helpers.ts` — `tags?: string[]` field; `test/search.test.ts` — 5 filter tests

## Context

User wanted "sort by timestamp" on broad queries. Sorting by date would break relevance, so instead we add server-side filters that pre-filter candidates before ranking. All filters (date range, project, tag) must be server-side because client-side filtering on a truncated top-k set misses valid results ranked beyond the cutoff.

Currently `_filterDate` is a single exact date (from heatmap clicks). We unify this into a `{ from, to, label }` range that supports both single-date clicks and presets ("Today", "This week", "This month"). One filter mechanism drives both search and browse.

---

## Changes

### 1. `src/search.ts` — add `SearchFilters` + pre-filter rankMap

**Add interface** after `SearchResult` (line 70):
```ts
export interface SearchFilters {
  dateFrom?: string;  // YYYY-MM-DD inclusive
  dateTo?: string;    // YYYY-MM-DD inclusive
  project?: string;   // case-insensitive substring
  tag?: string;       // case-insensitive substring via json_each
}
```

**Extend signature** (line 144): add `filters?: SearchFilters` as 5th param.

**Insert pre-filter** between line 220 (rankMap fully populated) and line 222 (RRF scoring):
- Collect unique session IDs from rankMap keys
- If any filter is set, run one SQL query with dynamic WHERE clauses against `sessions`
- Delete non-matching entries from rankMap
- RRF then runs only on matching chunks

SQL pattern:
```sql
SELECT id FROM sessions WHERE id IN (?,?,...)
  AND date >= ?                                           -- dateFrom
  AND date <= ?                                           -- dateTo
  AND LOWER(project) LIKE '%' || LOWER(?) || '%'          -- project
  AND EXISTS (SELECT 1 FROM json_each(tags)               -- tag
              WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')
```

Each clause only added when the corresponding filter is set. `json_each(NULL)` returns 0 rows → unenriched sessions excluded from tag filter (correct).

### 2. `src/routes.ts` — wire filters into both handlers

**`handleSearch`** (line 71): expand body type to include `dateFrom?`, `dateTo?`, `project?`, `tag?`. Build `SearchFilters` object, pass to `search()` at line 94.

**`handleSessions`** (line 133): replace the binary `dateFilter` conditional (lines 136-147) with dynamic WHERE clause builder. Accept `dateFrom`, `dateTo`, `project`, `tag` query params. Keep `?date=` as shorthand (`dateFrom=dateTo=date`). Apply same WHERE to both the data query and the COUNT query.

### 3. `src/mcp.ts` — extend search tool schema + proxy

**`daemonSearch`** (line 15): add optional filters param, spread into POST body.

**Tool schema** (line 77-79): add optional `dateFrom`, `dateTo`, `project`, `tag` string properties.

**`handleToolCall`** (line 149-154): extract filter strings from args, pass to `daemonSearch`.

### 4. `ui/app.js` — unified date range + server-side filter flow

**State** (line 18): replace `let _filterDate = null` with `let _filterDateRange = null` as `{ from: string, to: string, label: string } | null`.

**`doSearch`** (line 628): include filters in POST body:
```js
const body = { query, k };
if (_filterDateRange) { body.dateFrom = _filterDateRange.from; body.dateTo = _filterDateRange.to; }
const fp = document.getElementById('filter-project').value.trim();
if (fp) body.project = fp;
const ft = document.getElementById('filter-tag').value.trim();
if (ft) body.tag = ft;
```

**Remove `applyFilters()` call at line 654** — `doSearch()` renders results directly. This breaks the circular dependency (`applyFilters` → `doSearch` → `applyFilters`).

**`applyFilters`** (line 908): simplify — no client-side intersection. If search active, re-run `doSearch()`. If browse, re-run `loadSessions()`. Update filter visibility state (clear button, date chip). **Debounce server calls by 300ms** — currently `oninput` on project/tag inputs calls `handleFilterInput → applyFilters` on every keystroke. Client-side filtering was instant; server round-trips need debouncing to avoid firing on every character. Use a module-level `_filterDebounceTimer` and `clearTimeout/setTimeout` pattern.

**`loadSessions`** (line 788): replace `_filterDate` date param with `dateFrom`/`dateTo`/`project`/`tag` query params from current state. Remove `applyFilters()` call at line 802 — render directly.

**`loadMoreSessions`** (line 815): same query param changes. Update client-side filter at line 833 to use `_filterDateRange`.

**`filterByDate`** (line 1254): set `_filterDateRange = { from: date, to: date, label: date }`. Trigger `doSearch()` or `loadSessions()` based on mode.

**`clearDateFilter`** (line 1269): clear `_filterDateRange`, deactivate preset buttons, trigger refresh.

**`clearFilters`** (line 1275): update for `_filterDateRange`.

**`getFilteredSessions`** (line 897): update `_filterDate` reference to `_filterDateRange` range check. Kept as safety net for `loadMoreSessions` append path.

**New: `setDatePreset(preset)`** — computes `{ from, to, label }` for "today"/"week"/"month", sets `_filterDateRange`, updates chip + preset button active state, triggers `doSearch()` or `loadSessions()`.

**New: `updateDateChip()`** — helper to show/hide `#date-chip` from `_filterDateRange.label`.

### 5. `ui/index.html` — add preset buttons

Insert inside `.sessions-filters` (between tag filter-wrap at line 113 and `#date-chip` at line 115):
```html
<div class="date-presets">
  <button class="btn date-preset" data-preset="today" onclick="setDatePreset('today')">Today</button>
  <button class="btn date-preset" data-preset="week" onclick="setDatePreset('week')">This week</button>
  <button class="btn date-preset" data-preset="month" onclick="setDatePreset('month')">This month</button>
</div>
```

### 6. `ui/styles.css` — preset button styles

Add after `.date-chip-x:hover` (line 393):
```css
.date-presets { display: flex; gap: 4px; }
.date-preset {
  font-size: 12px; padding: 3px 8px; border-radius: 6px;
  background: transparent; border: 1px solid var(--border); color: var(--text);
  cursor: pointer; transition: all 0.15s;
}
.date-preset:hover { border-color: var(--accent); color: var(--accent); }
.date-preset.active {
  background: var(--accent-light); border-color: var(--accent-border); color: var(--accent);
}
```

### 7. `test/helpers.ts` + `test/search.test.ts` — filter tests

**helpers.ts**: add optional `tags?: string[]` to `insertSession`, store as `JSON.stringify(tags)`.

**search.test.ts**: add `describe("search filters")` with tests for:
- Date range filter (sessions across dates, only range matches returned)
- Project substring filter
- Tag filter (via json_each)
- Combined filters (intersection)
- No matches → empty `[]`

---

## Execution order

1. `test/helpers.ts` — add `tags` field
2. `src/search.ts` — `SearchFilters` interface + pre-filter block
3. `test/search.test.ts` — filter tests → run `QREC_EMBED_PROVIDER=stub bun test test/search.test.ts`
4. `src/routes.ts` — wire filters into `handleSearch` + `handleSessions`
5. `src/mcp.ts` — extend schema + proxy
6. `ui/index.html` — preset buttons
7. `ui/styles.css` — preset styles
8. `ui/app.js` — `_filterDateRange`, `setDatePreset`, `updateDateChip`, refactor `doSearch`/`applyFilters`/`loadSessions`
9. Full test: `QREC_EMBED_PROVIDER=stub bun test`
10. Smoke test: `bash scripts/smoke-test.sh` + manual browser test

## Pitfalls

- **Circular call**: `doSearch` line 654 calls `applyFilters()` which would call `doSearch()` again. Must remove the `applyFilters()` call from `doSearch` — render results directly instead.
- **`loadSessions` line 802** calls `applyFilters()` — same issue. Remove and render directly.
- **Debounce required**: `oninput` on project/tag inputs fires on every keystroke. With server-side filtering, each keystroke would trigger a fetch. Debounce `applyFilters()` by 300ms (search latency ~60ms → total ~360ms after last keystroke). Discrete actions (preset clicks, date chip clicks, Enter key) bypass debounce and fire immediately.
- **`json_each(NULL)`** returns 0 rows — unenriched sessions won't match tag filters. Correct behavior.
- **`?date=` backward compat**: `handleSessions` treats `?date=X` as `dateFrom=X&dateTo=X`.
