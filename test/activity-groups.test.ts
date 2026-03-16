// Tests for ui/activity-groups.js — pure grouping logic
// Run with: QREC_EMBED_PROVIDER=stub bun test test/activity-groups.test.ts

import { describe, test, expect } from 'bun:test';
import { groupActivityEvents, groupSummary } from '../ui/activity-groups.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function ts(offset = 0) { return 1_000_000 + offset; }

function makeIndex(newSessions: number, t = 0) {
  return [
    { ts: ts(t), type: 'index_started' },
    { ts: ts(t + 1), type: 'index_complete', data: { newSessions, durationMs: 100 } },
  ];
}

function makeEnrich(enriched: number, t = 0) {
  return [
    { ts: ts(t), type: 'enrich_started', data: { pending: enriched } },
    { ts: ts(t + 1), type: 'enrich_complete', data: { enriched, durationMs: 200 } },
  ];
}

// Events returned by /activity/entries are newest-first (sorted by ts desc).
function toFeed(...batches: object[][]) {
  return batches.flat().sort((a: any, b: any) => b.ts - a.ts);
}

// ── enrich collapse ───────────────────────────────────────────────────────────

describe('collapseZeroEnrichRuns', () => {
  test('single zero-enrich run is NOT collapsed (shown as-is)', () => {
    const events = toFeed(makeEnrich(0));
    const groups = groupActivityEvents(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('enrich');
  });

  test('two zero-enrich runs collapse into one enrich_collapsed group', () => {
    const events = toFeed(makeEnrich(0, 0), makeEnrich(0, 100));
    const groups = groupActivityEvents(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('enrich_collapsed');
    expect((groups[0] as any).count).toBe(2);
  });

  test('many zero-enrich runs collapse into one enrich_collapsed group', () => {
    const batches = Array.from({ length: 10 }, (_, i) => makeEnrich(0, i * 100));
    const events = toFeed(...batches);
    const groups = groupActivityEvents(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('enrich_collapsed');
    expect((groups[0] as any).count).toBe(10);
  });

  test('zero-enrich runs do not collapse across non-zero enrich run', () => {
    const events = toFeed(makeEnrich(0, 0), makeEnrich(5, 100), makeEnrich(0, 200));
    const groups = groupActivityEvents(events);
    // oldest: single zero-enrich, middle: non-zero enrich, newest: single zero-enrich
    expect(groups).toHaveLength(3);
    expect(groups[0].type).toBe('enrich'); // newest zero (not collapsed — count=1)
    expect(groups[1].type).toBe('enrich'); // non-zero
    expect(groups[2].type).toBe('enrich'); // oldest zero (not collapsed — count=1)
  });

  test('zero-enrich and zero-index runs collapse independently', () => {
    const events = toFeed(
      makeIndex(0, 0), makeIndex(0, 100),   // 2 zero-index
      makeEnrich(0, 200), makeEnrich(0, 300), makeEnrich(0, 400), // 3 zero-enrich
    );
    const groups = groupActivityEvents(events);
    expect(groups).toHaveLength(2);
    expect(groups[0].type).toBe('enrich_collapsed');
    expect((groups[0] as any).count).toBe(3);
    expect(groups[1].type).toBe('index_collapsed');
    expect((groups[1] as any).count).toBe(2);
  });

  test('enrich_collapsed groupSummary shows count', () => {
    const group = { type: 'enrich_collapsed', count: 5, ts: ts(), running: false, events: [] };
    const { label, detail } = groupSummary(group, null);
    expect(label).toBe('Enrich run');
    expect(detail).toBe('5× nothing to enrich');
  });
});

// ── crashed index run (no index_complete) ─────────────────────────────────────

describe('groupSummary — crashed index run', () => {
  test('completed index group with index_complete shows newSessions from event', () => {
    const group = {
      type: 'index', running: false, ts: ts(), events: [
        { ts: ts(0), type: 'index_started' },
        { ts: ts(1), type: 'session_indexed', data: { sessionId: 'aa' } },
        { ts: ts(2), type: 'session_indexed', data: { sessionId: 'bb' } },
        { ts: ts(3), type: 'index_complete', data: { newSessions: 2, durationMs: 500 } },
      ],
    };
    const { label, detail } = groupSummary(group, null);
    expect(label).toBe('Index scan');
    expect(detail).toContain('2 new sessions');
  });

  test('crashed index run (no index_complete) falls back to session_indexed event count', () => {
    // Simulate: 28 sessions indexed but indexer crashed before writing index_complete.
    const sessionEvents = Array.from({ length: 28 }, (_, i) => ({
      ts: ts(i + 1), type: 'session_indexed', data: { sessionId: `s${i}` },
    }));
    const group = {
      type: 'index', running: false, ts: ts(), events: [
        { ts: ts(0), type: 'index_started' },
        ...sessionEvents,
        // NO index_complete event
      ],
    };
    const { label, detail } = groupSummary(group, null);
    expect(label).toBe('Index scan');
    // Before fix: detail would be "0 new sessions" (completeEvent is undefined → n=0)
    // After fix:  detail should be "28 new sessions"
    expect(detail).toContain('28 new sessions');
  });

  test('crashed index run with 0 session_indexed shows 0 new sessions', () => {
    const group = {
      type: 'index', running: false, ts: ts(), events: [
        { ts: ts(0), type: 'index_started' },
        // crashed immediately, no sessions indexed, no index_complete
      ],
    };
    const { label, detail } = groupSummary(group, null);
    expect(label).toBe('Index scan');
    expect(detail).toContain('0 new sessions');
  });
});
