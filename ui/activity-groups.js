// Pure activity grouping logic — no DOM dependencies.
// Loaded as a plain <script> in the browser (defines globals);
// imported via require() in Bun tests.

function fmtDuration(ms) {
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function groupActivityEvents(events) {
  // events are newest-first; reverse to process chronologically
  const chron = [...events].reverse();
  const groups = [];
  // Index and enrich run concurrently (different processes) so their events interleave.
  // Track separate cursors per type so an index_started mid-enrich doesn't close the enrich group.
  let curIndex = null;
  let curEnrich = null;

  for (const e of chron) {
    if (e.type === 'daemon_started') {
      if (curIndex) { curIndex.running = false; groups.push(curIndex); curIndex = null; }
      if (curEnrich) { curEnrich.running = false; groups.push(curEnrich); curEnrich = null; }
      groups.push({ type: 'daemon', events: [e], running: false, ts: e.ts });
    } else if (e.type === 'index_started') {
      if (curIndex) { groups.push(curIndex); }
      curIndex = { type: 'index', events: [e], running: true, ts: e.ts };
    } else if (e.type === 'enrich_started') {
      if (curEnrich) { groups.push(curEnrich); }
      curEnrich = { type: 'enrich', events: [e], running: true, ts: e.ts };
    } else if (e.type === 'index_complete') {
      if (curIndex) {
        curIndex.events.push(e);
        curIndex.running = false;
        groups.push(curIndex);
        curIndex = null;
      }
    } else if (e.type === 'enrich_complete') {
      if (curEnrich) {
        curEnrich.events.push(e);
        curEnrich.running = false;
        groups.push(curEnrich);
        curEnrich = null;
      }
    } else if (e.type === 'session_indexed') {
      if (curIndex) curIndex.events.push(e);
    } else if (e.type === 'session_enriched') {
      if (curEnrich) curEnrich.events.push(e);
    }
  }

  if (curIndex) groups.push(curIndex);   // ongoing index run
  if (curEnrich) groups.push(curEnrich); // ongoing enrich run

  return collapseZeroEnrichRuns(collapseZeroIndexRuns(groups.reverse())); // newest first
}

function isZeroIndexRun(g) {
  if (g.type !== 'index' || g.running) return false;
  const complete = g.events.find(e => e.type === 'index_complete');
  return (complete?.data?.newSessions ?? 0) === 0;
}

function isZeroEnrichRun(g) {
  if (g.type !== 'enrich' || g.running) return false;
  const complete = g.events.find(e => e.type === 'enrich_complete');
  return (complete?.data?.enriched ?? g.events.filter(e => e.type === 'session_enriched').length) === 0;
}

function collapseZeroIndexRuns(groups) {
  const result = [];
  let i = 0;
  while (i < groups.length) {
    const g = groups[i];
    if (isZeroIndexRun(g)) {
      let count = 1;
      while (i + count < groups.length && isZeroIndexRun(groups[i + count])) count++;
      if (count === 1) {
        result.push(g);
      } else {
        result.push({ type: 'index_collapsed', count, ts: g.ts, running: false, events: [] });
      }
      i += count;
    } else {
      result.push(g);
      i++;
    }
  }
  return result;
}

function collapseZeroEnrichRuns(groups) {
  const result = [];
  let i = 0;
  while (i < groups.length) {
    const g = groups[i];
    if (isZeroEnrichRun(g)) {
      let count = 1;
      while (i + count < groups.length && isZeroEnrichRun(groups[i + count])) count++;
      if (count === 1) {
        result.push(g);
      } else {
        result.push({ type: 'enrich_collapsed', count, ts: g.ts, running: false, events: [] });
      }
      i += count;
    } else {
      result.push(g);
      i++;
    }
  }
  return result;
}

// liveIndexing: { total, indexed, current } — only needed for running index groups.
// Pass null (or omit) when testing completed groups.
function groupSummary(group, liveIndexing) {
  if (group.syntheticLabel !== undefined) return { label: group.syntheticLabel, detail: null };

  const completeEvent = group.events.find(e => e.type === 'index_complete' || e.type === 'enrich_complete');
  const startEvent = group.events.find(e => e.type === 'index_started' || e.type === 'enrich_started');

  if (group.type === 'daemon') return { label: 'Daemon started', detail: null };

  if (group.type === 'index_collapsed') {
    return { label: 'Index scan', detail: `${group.count}× no new sessions` };
  }

  if (group.type === 'enrich_collapsed') {
    return { label: 'Enrich run', detail: `${group.count}× nothing to enrich` };
  }

  if (group.type === 'index') {
    if (group.running) {
      const n = group.events.filter(e => e.type === 'session_indexed').length;
      const total = liveIndexing?.total;
      const detail = total > 0 ? `${n} / ${total}` : (n > 0 ? `${n} indexed` : null);
      return { label: 'Indexing…', detail };
    }
    // Fallback to session_indexed count when index_complete is missing (crashed run).
    const n = completeEvent?.data?.newSessions ?? group.events.filter(e => e.type === 'session_indexed').length;
    const ms = completeEvent?.data?.durationMs;
    return { label: 'Index scan', detail: `${n} new session${n === 1 ? '' : 's'}${ms ? '  ' + fmtDuration(ms) : ''}` };
  }

  if (group.type === 'enrich') {
    if (group.running) {
      const done = group.events.filter(e => e.type === 'session_enriched').length;
      const pending = startEvent?.data?.pending ?? '?';
      return { label: 'Enriching…', detail: `${done} / ${pending}` };
    }
    const n = completeEvent?.data?.enriched ?? group.events.filter(e => e.type === 'session_enriched').length;
    const ms = completeEvent?.data?.durationMs;
    return { label: 'Enrich run', detail: `${n} session${n === 1 ? '' : 's'} enriched${ms ? '  ' + fmtDuration(ms) : ''}` };
  }

  return { label: group.type, detail: null };
}

// Node.js / Bun compatibility — exports for tests
if (typeof module !== 'undefined') {
  module.exports = { fmtDuration, groupActivityEvents, isZeroIndexRun, collapseZeroIndexRuns, isZeroEnrichRun, collapseZeroEnrichRuns, groupSummary };
}
