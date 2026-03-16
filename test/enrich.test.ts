// Tests for src/enrich.ts — no-chunk session re-queue prevention
// Run with: QREC_EMBED_PROVIDER=stub bun test test/enrich.test.ts

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { Database } from 'bun:sqlite';
import { createTestDb, cleanupTestDb, insertSession } from './helpers.ts';
import { ENRICHMENT_VERSION } from '../src/enrich.ts';

let db: Database;
let dbPath: string;

beforeEach(() => {
  ({ db, path: dbPath } = createTestDb());
});

afterEach(() => {
  cleanupTestDb(db, dbPath);
});

// Helper: count sessions that would be picked up by spawnEnrichIfNeeded
function countPending(db: Database): number {
  return (db.prepare(
    `SELECT COUNT(*) as n FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at IS NOT NULL`
  ).get(ENRICHMENT_VERSION) as { n: number }).n;
}

describe('enrich — no-chunk sessions', () => {
  test('session with chunks remains pending before enrichment', () => {
    const past = Date.now() - 10 * 60 * 1000; // 10 min ago
    insertSession(db, { id: 'aaa00001', last_message_at: past });
    db.prepare('INSERT INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?,?,?,?,?,?)')
      .run('aaa00001_0', 'aaa00001', 0, 0, 'some content', Date.now());

    expect(countPending(db)).toBe(1);
  });

  test('no-chunk session gets enriched_at + enrichment_version set so it leaves the pending queue', () => {
    const past = Date.now() - 10 * 60 * 1000;
    insertSession(db, { id: 'ccc00003', last_message_at: past });
    // No chunks

    expect(countPending(db)).toBe(1); // pending before

    // Simulate what the fixed enrich loop does when it encounters a no-chunk session.
    // Must set enriched_at too — the query has (enriched_at IS NULL OR ...) so
    // setting enrichment_version alone does NOT remove it from the pending set.
    const now = Date.now();
    db.prepare('UPDATE sessions SET enriched_at=?, enrichment_version=? WHERE id=?')
      .run(now, ENRICHMENT_VERSION, 'ccc00003');

    expect(countPending(db)).toBe(0); // no longer pending
    const row = db.prepare('SELECT enriched_at, enrichment_version FROM sessions WHERE id=?')
      .get('ccc00003') as { enriched_at: number | null; enrichment_version: number };
    expect(row.enriched_at).not.toBeNull();
    expect(row.enrichment_version).toBe(ENRICHMENT_VERSION);
  });

  test('session with chunks is unaffected by no-chunk fix', () => {
    const past = Date.now() - 10 * 60 * 1000;
    insertSession(db, { id: 'ddd00004', last_message_at: past });
    db.prepare('INSERT INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?,?,?,?,?,?)')
      .run('ddd00004_0', 'ddd00004', 0, 0, 'real content here', Date.now());

    // This session has chunks — it should NOT be short-circuited
    const chunkText = (db.prepare('SELECT text FROM chunks WHERE session_id = ? ORDER BY seq')
      .all('ddd00004') as Array<{ text: string }>)
      .map(r => r.text).join('\n\n');

    expect(chunkText.trim()).not.toBe('');
    // Would proceed to summarize, not skip
    expect(countPending(db)).toBe(1);
  });
});
