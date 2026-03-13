# Plan: Add `learnings` + `questions` to Enrich + Extract Prompt to Versioned File

## Context
The enrichment pipeline currently extracts `summary`, `tags`, and `entities` from session transcripts. Adding `learnings` (brief technical insights/gotchas from the session) and `questions` (questions this session can answer, useful as recall hints) increases the value of enriched sessions in search and review. The extraction prompt is currently hardcoded in `summarize.ts`; moving it to a versioned file makes prompt evolution explicit and diffable in git.

## Files to modify

| File | Change |
|---|---|
| `src/prompts/session-extract-v1.ts` | **NEW** — exports `SYSTEM_PROMPT` + `PROMPT_VERSION = 1` |
| `src/summarize.ts` | Extend `SessionSummary`, import prompt from prompts file, update `parseResponse`, bump `maxTokens` |
| `src/db.ts` | Two new `ALTER TABLE` migrations for `learnings` and `questions` |
| `src/enrich.ts` | Bump `ENRICHMENT_VERSION` to 2, extend `updateSession` SQL + `buildSummaryChunkText` |
| `src/server.ts` | Expose `learnings`/`questions` in `GET /sessions/:id` response |

---

## Step-by-step

### 1. Create `src/prompts/session-extract-v1.ts`

New file. Moves the system prompt out of `summarize.ts`. Exports a string constant and a version number.

```typescript
// src/prompts/session-extract-v1.ts
// Extraction prompt v1: summary + tags + entities + learnings + questions
// Bump version in src/enrich.ts (ENRICHMENT_VERSION) when this prompt changes.

export const PROMPT_VERSION = 1;

export const SYSTEM_PROMPT = `You are a concise technical summarizer for AI coding sessions.
Given a conversation transcript between a user and an AI coding assistant, produce a structured summary.

Output ONLY valid JSON with this exact shape:
{
  "summary": "2-3 sentence description of what was accomplished",
  "tags": ["tag1", "tag2", "tag3"],
  "entities": ["FileName.ts", "functionName()", "ErrorType", "library-name"],
  "learnings": ["brief insight 1", "brief insight 2"],
  "questions": ["Question this session answers?", "Another question?"]
}

Rules:
- summary: focus on what was built/fixed/decided — not how the conversation went
- tags: 3-6 lowercase kebab-case labels (e.g. "bug-fix", "refactor", "typescript", "mcp", "database")
- entities: key technical artifacts mentioned (files, functions, errors, libraries) — max 8
- learnings: 2-4 brief technical insights, decisions, or gotchas discovered in this session — one sentence each
- questions: 3-5 concrete questions a developer might ask that this session directly answers (e.g. "How do you fix X?", "What causes Y?")
- No explanation outside the JSON block`;
```

### 2. Update `src/summarize.ts`

- Import `SYSTEM_PROMPT` from `./prompts/session-extract-v1.ts` (remove inline const)
- Extend `SessionSummary`:
  ```typescript
  export interface SessionSummary {
    summary: string;
    tags: string[];
    entities: string[];
    learnings: string[];
    questions: string[];
  }
  ```
- Update `parseResponse` to extract `learnings` and `questions` (same pattern as `tags`/`entities` — filter to string[])
- Update fallback return in `parseResponse` to include `learnings: [], questions: []`
- Bump `maxTokens` from `300` → `500` (two extra arrays need more output budget)

### 3. Update `src/db.ts`

Add two new idempotent migrations in the existing `ALTER TABLE` block:
```sql
ALTER TABLE sessions ADD COLUMN learnings TEXT   -- JSON array, NULL until enriched
ALTER TABLE sessions ADD COLUMN questions TEXT   -- JSON array, NULL until enriched
```
Same try/catch pattern as existing migrations.

### 4. Update `src/enrich.ts`

- **Bump** `ENRICHMENT_VERSION = 2` — re-queues all v1 sessions
- **Extend `updateSession` prepared statement**:
  ```sql
  UPDATE sessions SET summary=?, tags=?, entities=?, learnings=?, questions=?,
    enriched_at=?, enrichment_version=? WHERE id=?
  ```
- **Pass new values** in `.run()`: add `JSON.stringify(result.learnings)`, `JSON.stringify(result.questions)`
- **Extend `buildSummaryChunkText`** to include learnings + questions in the FTS5-indexed summary chunk:
  ```typescript
  function buildSummaryChunkText(summary, tags, entities, learnings, questions): string {
    return [
      summary,
      tags.length > 0 ? "Tags: " + tags.join(", ") : "",
      entities.length > 0 ? "Entities: " + entities.join(", ") : "",
      learnings.length > 0 ? "Learnings: " + learnings.join(" ") : "",
      questions.length > 0 ? "Questions: " + questions.join(" ") : "",
    ].filter(Boolean).join("\n");
  }
  ```
- **Update `backfillSummaryChunks`** to pass learnings/questions (parse from DB rows or pass empty arrays — they'll be NULL for v1 rows)
- **Update console log** to print learnings/questions count alongside summary

### 5. Update `src/server.ts`

**`GET /sessions/:id`** SQL:
```sql
SELECT id, title, project, date, path, summary, tags, entities, learnings, questions FROM sessions WHERE id = ?
```

Add to response JSON:
```typescript
learnings: row.learnings ? JSON.parse(row.learnings) : null,
questions: row.questions ? JSON.parse(row.questions) : null,
```

Also update `GET /sessions` list endpoint if it returns enrichment fields (check if tags/entities are in list response — if so, add learnings/questions there too).

---

## Verification

1. Run `qrec enrich --limit 3` — confirm it processes sessions and logs learnings/questions
2. Check DB directly: `SELECT learnings, questions FROM sessions WHERE enriched_at IS NOT NULL LIMIT 3`
3. Hit `GET /sessions/:id` for an enriched session — confirm `learnings` and `questions` arrays in response
4. Run `POST /search` with a query matching known learnings text — confirm FTS5 picks it up via summary chunk
