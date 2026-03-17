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

// ── stale timeout bug: long initial index (new user) ─────────────────────────
// Bug: for a new user with 500+ sessions, the initial index legitimately takes
// >10 min. The app.js stale guard (STALE_MS=10min) fires before index_complete
// is written and sets running=false. groupSummary then renders the group as
// "Index scan (N new sessions)" — a completed-looking row — even though the
// real index is still running. On every subsequent 5s poll, more session_indexed
// events arrive and the count keeps growing.
//
// Fix (app.js): add `phase !== 'indexing'` guard so the stale timeout is
// suppressed while the daemon reports an active initial index run.

describe('stale timeout bug: long initial index (new-user)', () => {
  // Mirrors the stale-timeout logic in app.js showDashboardPanel.
  // phase='indexing' → initial index still running → stale must NOT fire.
  // phase='ready'    → no active index → stale fires after STALE_MS.
  function applyStaleTimeout(groups: any[], phase: string) {
    for (const g of groups) {
      if (g.type !== 'enrich' && phase !== 'indexing') g.running = false;
    }
  }

  // ── bug reproduction (phase='ready' simulates pre-fix behaviour) ───────────

  test('BUG: stale fires when phase=ready → running group appears completed', () => {
    const sessionEvents = Array.from({ length: 300 }, (_, i) => ({
      ts: ts(i + 1), type: 'session_indexed', data: { sessionId: `s${i}` },
    }));
    const events = toFeed([{ ts: ts(0), type: 'index_started' }, ...sessionEvents]);
    const groups = groupActivityEvents(events);

    expect(groups[0].running).toBe(true);
    expect(groupSummary(groups[0], null).label).toBe('Indexing…');

    applyStaleTimeout(groups, 'ready'); // pre-fix: stale fires regardless of phase

    expect(groups[0].running).toBe(false); // incorrectly marked done
    expect(groupSummary(groups[0], null).label).toBe('Index scan'); // completed look
  });

  test('BUG: session count grows on each poll after stale-close', () => {
    const batch1 = Array.from({ length: 300 }, (_, i) => ({
      ts: ts(i + 1), type: 'session_indexed', data: { sessionId: `s${i}` },
    }));
    const events1 = toFeed([{ ts: ts(0), type: 'index_started' }, ...batch1]);
    const groups1 = groupActivityEvents(events1);
    applyStaleTimeout(groups1, 'ready');
    const { detail: detail1 } = groupSummary(groups1[0], null);

    const batch2 = Array.from({ length: 50 }, (_, i) => ({
      ts: ts(300 + i + 1), type: 'session_indexed', data: { sessionId: `s${300 + i}` },
    }));
    const events2 = toFeed([{ ts: ts(0), type: 'index_started' }, ...batch1, ...batch2]);
    const groups2 = groupActivityEvents(events2);
    applyStaleTimeout(groups2, 'ready');
    const { detail: detail2 } = groupSummary(groups2[0], null);

    // Completed-looking row grows on every poll — the visible symptom.
    expect(detail1).toContain('300 new sessions');
    expect(detail2).toContain('350 new sessions');
  });

  // ── fix verification (phase='indexing' blocks stale) ──────────────────────

  test('FIX: stale does NOT fire while phase=indexing', () => {
    const sessionEvents = Array.from({ length: 300 }, (_, i) => ({
      ts: ts(i + 1), type: 'session_indexed', data: { sessionId: `s${i}` },
    }));
    const events = toFeed([{ ts: ts(0), type: 'index_started' }, ...sessionEvents]);
    const groups = groupActivityEvents(events);

    applyStaleTimeout(groups, 'indexing'); // fix: suppressed while daemon is indexing

    expect(groups[0].running).toBe(true); // still running — no stale-close
    expect(groupSummary(groups[0], null).label).toBe('Indexing…'); // progress label preserved
  });

  test('FIX: session count stable (Indexing… label) across polls while phase=indexing', () => {
    const batch1 = Array.from({ length: 300 }, (_, i) => ({
      ts: ts(i + 1), type: 'session_indexed', data: { sessionId: `s${i}` },
    }));
    const events1 = toFeed([{ ts: ts(0), type: 'index_started' }, ...batch1]);
    const groups1 = groupActivityEvents(events1);
    applyStaleTimeout(groups1, 'indexing');

    const batch2 = Array.from({ length: 50 }, (_, i) => ({
      ts: ts(300 + i + 1), type: 'session_indexed', data: { sessionId: `s${300 + i}` },
    }));
    const events2 = toFeed([{ ts: ts(0), type: 'index_started' }, ...batch1, ...batch2]);
    const groups2 = groupActivityEvents(events2);
    applyStaleTimeout(groups2, 'indexing');

    // Both polls show live progress — no completed row, no growing count.
    expect(groupSummary(groups1[0], null).label).toBe('Indexing…');
    expect(groupSummary(groups2[0], null).label).toBe('Indexing…');
  });

  test('normal fast index (<10min): index_complete closes group before stale fires', () => {
    const events = toFeed([
      { ts: ts(0), type: 'index_started' },
      { ts: ts(1), type: 'session_indexed', data: { sessionId: 's0' } },
      { ts: ts(2), type: 'index_complete', data: { newSessions: 1, durationMs: 500 } },
    ]);
    const groups = groupActivityEvents(events);
    expect(groups[0].running).toBe(false); // closed by index_complete, not stale
    const { label, detail } = groupSummary(groups[0], null);
    expect(label).toBe('Index scan');
    expect(detail).toContain('1 new session');
  });

  test('stale still fires for crashed cron runs (phase=ready)', () => {
    // Cron runs with phase=ready that crash (no index_complete) must still be cleaned up.
    const events = toFeed([
      { ts: ts(0), type: 'index_started' },
      { ts: ts(1), type: 'session_indexed', data: { sessionId: 's0' } },
      // no index_complete — crashed
    ]);
    const groups = groupActivityEvents(events);
    expect(groups[0].running).toBe(true);

    applyStaleTimeout(groups, 'ready'); // stale allowed when phase=ready

    expect(groups[0].running).toBe(false); // correctly cleaned up
    expect(groupSummary(groups[0], null).label).toBe('Index scan');
  });
});
