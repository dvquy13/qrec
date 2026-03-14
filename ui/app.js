// ── Activity state ───────────────────────────────────────────────────────────
let _allRunGroups = [];
const RUNS_INITIAL = 5;
let _visibleRunCount = RUNS_INITIAL;
let _lastRenderedSessionCount = -1;

// ── Search + Sessions state (must be before navigate() at line ~43) ──────────
let _lastSearchResults = null;
let _allSessions = [];
let _sessionsTotal = 0;
let _sessionsOffset = 0;
let _sessionsLoading = false;
let _scrollObserver = null;
let _filterDate = null;
let _filterOptions = { project: [], tag: [] };
const CARD_FIELD_DEFAULTS = { summary: true, tags: true, entities: false, learnings: false, questions: false };
let _cardFields = (() => {
  try { return { ...CARD_FIELD_DEFAULTS, ...JSON.parse(localStorage.getItem('qrec_card_fields') || '{}') }; }
  catch { return { ...CARD_FIELD_DEFAULTS }; }
})();

// ── Heatmap state ─────────────────────────────────────────────────────────
let _heatmapData = null;
let _heatmapMetric = (() => {
  try { return localStorage.getItem('qrec_heatmap_metric') || 'sessions'; } catch { return 'sessions'; }
})();
let _heatmapProject = null;
let _heatmapProjects = [];

// ── Tab routing ─────────────────────────────────────────────────────────────

function navigate(hash, push = true) {
  if (!hash) hash = 'dashboard';
  if (hash === 'activity') hash = 'dashboard'; // activity is now part of dashboard
  if (hash.startsWith('session/')) {
    const id = hash.slice('session/'.length);
    openSessionDetail(id);
    if (push) history.pushState(null, '', '#' + hash);
  } else {
    showTab(hash, push);
  }
}

function showTab(name, push = true) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  const btn = document.getElementById('nav-' + name);
  if (btn) btn.classList.add('active');
  if (push) history.pushState(null, '', '#' + name);
  onTabActivated(name);
}

function onTabActivated(name) {
  if (name === 'dashboard') { _visibleRunCount = RUNS_INITIAL; loadDashboard(); }
  if (name === 'sessions') {
    document.getElementById('query')?.focus();
    loadSessions();
  }
  if (name === 'debug') { fetchStats(); fetchLog(); fetchConfig(); }
}

// Initial tab from URL — replaceState so the blank entry isn't a back-button stop
const initHash = location.hash.slice(1) || 'dashboard';
navigate(initHash, false);
history.replaceState(null, '', '#' + initHash);
window.addEventListener('popstate', () => navigate(location.hash.slice(1) || 'dashboard', false));

// ── Custom tooltip ───────────────────────────────────────────────────────────
const _tip = document.createElement('div');
_tip.id = 'qrec-tooltip';
document.body.appendChild(_tip);
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip-html],[data-tooltip]');
  if (!el) return;
  if (el.dataset.tipHtml) {
    _tip.innerHTML = el.dataset.tipHtml;
    _tip.classList.add('tip--rich');
  } else {
    _tip.textContent = el.dataset.tooltip || '';
    _tip.classList.remove('tip--rich');
  }
  _tip.classList.add('visible');
});
document.addEventListener('mouseout', e => {
  if (e.target.closest('[data-tip-html],[data-tooltip]')) _tip.classList.remove('visible');
});
document.addEventListener('mousemove', e => {
  if (!_tip.classList.contains('visible')) return;
  const x = e.clientX + 12, y = e.clientY - 32;
  _tip.style.left = Math.min(x, window.innerWidth - _tip.offsetWidth - 8) + 'px';
  _tip.style.top = Math.max(y, 4) + 'px';
});

// ── Shared polling ──────────────────────────────────────────────────────────

setInterval(() => {
  const active = document.querySelector('.tab-panel.active')?.id?.replace('tab-', '');
  if (active === 'dashboard') loadDashboard();
  if (active === 'debug') { fetchStats(); fetchLog(); }
}, 5000);

// ── Utilities ───────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatRelative(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Render markdown to HTML using marked, falling back to plain text. */
function renderText(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined') {
    return marked.parse(text, { breaks: true, gfm: true });
  }
  // Fallback: escape and preserve line breaks
  return '<p>' + escHtml(text).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

// ── Dashboard ───────────────────────────────────────────────────────────────

async function loadDashboard() {
  try {
    const [statusRes, actRes] = await Promise.all([
      fetch('/status'),
      fetch('/activity/entries?limit=500'),
    ]);
    if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
    const data = await statusRes.json();
    const { entries: actEntries } = actRes.ok ? await actRes.json() : { entries: [] };

    document.getElementById('db-loading').style.display = 'none';
    document.getElementById('db-error').style.display = 'none';

    const isReady = data.phase === 'ready' && data.sessions > 0;
    if (isReady) {
      document.getElementById('onboarding').style.display = 'none';
      showDashboardPanel(data, actEntries);
    } else {
      document.getElementById('dashboard').style.display = 'none';
      showOnboarding(data);
    }
  } catch (err) {
    document.getElementById('db-loading').style.display = 'none';
    const el = document.getElementById('db-error');
    el.style.display = '';
    el.textContent = 'Could not connect to qrec server: ' + String(err);
  }
}

function showOnboarding(data) {
  const phase = data.phase ?? 'ready';
  const dl = data.modelDownload ?? { percent: 0, downloadedMB: 0, totalMB: null };
  const idx = data.indexing ?? { indexed: 0, total: 0, current: '' };

  const modelDone = ['indexing', 'ready'].includes(phase);
  const indexDone = phase === 'ready' && data.sessions > 0;
  const indexActive = phase === 'indexing';
  const searchDone = data.searches > 0;

  const steps = [
    {
      state: 'done',
      title: 'Server is running',
      desc: 'The qrec HTTP server is up and accepting requests.',
    },
    {
      state: modelDone ? 'done' : 'active',
      title: modelDone ? 'Embedding model ready'
        : phase === 'model_download' ? 'Downloading embedding model…'
        : 'Loading embedding model…',
      desc: modelDone ? `${escHtml(data.embedProvider)} provider loaded.`
        : phase === 'model_download'
          ? `${dl.downloadedMB} MB${dl.totalMB ? ' / ' + dl.totalMB + ' MB' : ''} downloaded`
          : 'Loading model into memory…',
      progress: !modelDone ? {
        percent: phase === 'model_download' ? dl.percent : null,
        label: phase === 'model_download'
          ? `${dl.percent}%${dl.totalMB ? ' — ' + dl.downloadedMB + ' / ' + dl.totalMB + ' MB' : ''}`
          : 'Loading…',
      } : null,
    },
    {
      state: indexDone ? 'done' : indexActive ? 'active' : 'pending',
      title: indexDone
        ? `Sessions indexed (${data.sessions.toLocaleString()})`
        : indexActive
          ? `Indexing sessions… (${idx.indexed}${idx.total ? ' / ' + idx.total : ''})`
          : 'Indexing sessions',
      desc: indexDone
        ? `${data.chunks.toLocaleString()} chunks ready to search.`
        : indexActive
          ? (idx.current ? `Current: ${idx.current}` : 'Scanning your Claude Code session history…')
          : 'Will start automatically after model loads.',
      progress: indexActive ? {
        percent: idx.total > 0 ? Math.round((idx.indexed / idx.total) * 100) : null,
        label: idx.total > 0 ? `${idx.indexed} / ${idx.total} sessions` : `${idx.indexed} sessions indexed…`,
      } : null,
    },
    {
      state: searchDone ? 'done' : (indexDone ? 'active' : 'pending'),
      title: searchDone ? 'First search complete' : 'Run your first search',
      desc: searchDone
        ? 'qrec is fully set up and working.'
        : 'Open the search tab and try a query — or use the MCP tool in Claude.',
      link: (!searchDone && indexDone) ? { label: 'Go to search →', tab: 'sessions' } : null,
    },
  ];

  const stepsEl = document.getElementById('steps');
  stepsEl.innerHTML = '';
  steps.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'step' + (s.state === 'done' ? ' done' : s.state === 'active' ? ' active' : '');

    const iconHtml = s.state === 'done' ? '✓'
      : s.state === 'active' ? `<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>`
      : String(i + 1);

    const progressHtml = s.progress ? `
      <div class="progress-wrap">
        <div class="progress-label">
          <span>${escHtml(s.progress.label)}</span>
          ${s.progress.percent != null ? `<strong>${s.progress.percent}%</strong>` : ''}
        </div>
        <div class="progress-track">
          <div class="progress-fill ${s.progress.percent == null ? 'indeterminate' : ''}"
               style="width:${s.progress.percent ?? 40}%"></div>
        </div>
      </div>` : '';

    const linkHtml = s.link
      ? `<div style="margin-top:10px;"><button class="action-btn primary" style="display:inline-flex;" onclick="showTab('${s.link.tab}')">${s.link.label}</button></div>`
      : '';

    div.innerHTML = `
      <div class="step-icon">${iconHtml}</div>
      <div class="step-body">
        <div class="step-title">${escHtml(s.title)}</div>
        <div class="step-desc">${escHtml(s.desc)}</div>
        ${progressHtml}${linkHtml}
      </div>
    `;
    stepsEl.appendChild(div);
  });

  document.getElementById('onboarding').style.display = 'block';
}

function showDashboardPanel(data, actEntries) {
  document.getElementById('stat-sessions').textContent = data.sessions.toLocaleString();
  document.getElementById('stat-chunks').textContent = data.chunks.toLocaleString();
  document.getElementById('stat-searches').textContent = data.searches.toLocaleString();
  document.getElementById('info-provider').textContent = data.embedProvider;
  document.getElementById('info-last-indexed').textContent =
    data.lastIndexedAt ? formatRelative(data.lastIndexedAt) : '—';
  const enrichTotal = data.sessions ?? 0;
  const enrichDone = data.enrichedCount ?? 0;
  const enrichPending = data.pendingCount ?? 0;
  const aiEl = document.getElementById('info-ai-summaries');
  const aiSubEl = document.getElementById('info-ai-summaries-sub');
  if (aiEl) {
    if (!data.enrichEnabled) {
      aiEl.innerHTML = '<span style="color:var(--text-muted)">—</span>';
      if (aiSubEl) aiSubEl.textContent = 'disabled';
    } else if (data.enriching) {
      const pct = enrichTotal > 0 ? Math.round((enrichDone / enrichTotal) * 100) : 0;
      aiEl.innerHTML = `${enrichDone}<span class="enrich-dot" style="margin-left:6px;vertical-align:middle;"></span>`;
      if (aiSubEl) aiSubEl.textContent = `${pct}% enriched`;
    } else {
      aiEl.textContent = enrichDone;
      if (aiSubEl) aiSubEl.textContent = enrichPending > 0 ? `${enrichPending} pending` : 'enriched';
    }
  }

  // Activity runs
  _allRunGroups = groupActivityEvents(actEntries || []);
  renderActivityRuns(_allRunGroups);

  if (data.sessions !== _lastRenderedSessionCount) loadRecentSessions(data.sessions);
  if (data.sessions !== _lastRenderedSessionCount || !_heatmapData) fetchAndRenderHeatmap();

  document.getElementById('dashboard').style.display = 'block';
}

async function loadRecentSessions(sessionCount) {
  const container = document.getElementById('dashboard-recent-list');
  if (!container) return;
  try {
    const res = await fetch('/sessions?offset=0');
    if (!res.ok) return;
    const data = await res.json();
    const sessions = data.sessions;
    const total = data.total ?? sessions.length;
    const recent = sessions.slice(0, 5);
    if (recent.length === 0) {
      container.innerHTML = '<div style="padding:20px 0;color:var(--text-muted);font-size:13px;">No sessions indexed yet.</div>';
      _lastRenderedSessionCount = sessionCount ?? 0;
      return;
    }
    container.innerHTML = recent.map(s => {
      const summary = s.summary ? escHtml(s.summary.slice(0, 180)) : '';
      const relTime = s.indexed_at ? formatRelative(s.indexed_at) : (s.date || '—');
      return `<div class="dashboard-session-card" onclick="openSession('${escHtml(s.id)}')">
          <div class="dashboard-session-title">${escHtml(s.title || '(untitled)')}</div>
          <div class="dashboard-session-meta">
            <span>${escHtml(s.project || '—')}</span>
            <span>·</span>
            <span style="font-family:var(--mono);font-size:11px;">${escHtml(s.id)}</span>
            <span>·</span>
            <span class="dashboard-session-ts">${relTime}</span>
          </div>
          ${summary ? `<div class="dashboard-session-summary">${summary}</div>` : ''}
      </div>`;
    }).join('');
    container.insertAdjacentHTML('beforeend', `<button class="dashboard-recent-footer" onclick="showTab('sessions')">All ${total.toLocaleString()} sessions →</button>`);
    _lastRenderedSessionCount = sessionCount ?? total;
  } catch (_) { /* silently skip — not critical */ }
}

// ── Activity grouping ────────────────────────────────────────────────────────

function fmtDuration(ms) {
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function runIcon(type) {
  if (type === 'index' || type === 'index_collapsed') return '⊙';
  if (type === 'enrich') return '✦';
  return '◉';
}

function groupActivityEvents(events) {
  // events are newest-first; reverse to process chronologically
  const chron = [...events].reverse();
  const groups = [];
  let current = null;

  for (const e of chron) {
    if (e.type === 'daemon_started') {
      if (current) { groups.push(current); current = null; }
      groups.push({ type: 'daemon', events: [e], running: false, ts: e.ts });
    } else if (e.type === 'index_started') {
      if (current) { groups.push(current); }
      current = { type: 'index', events: [e], running: true, ts: e.ts };
    } else if (e.type === 'enrich_started') {
      if (current) { groups.push(current); }
      current = { type: 'enrich', events: [e], running: true, ts: e.ts };
    } else if (e.type === 'index_complete' || e.type === 'enrich_complete') {
      if (current) {
        current.events.push(e);
        current.running = false;
        groups.push(current);
        current = null;
      }
    } else if (e.type === 'session_indexed' || e.type === 'session_enriched') {
      if (current) current.events.push(e);
    }
  }

  if (current) groups.push(current); // ongoing run

  // Mark stale: if a run is still "running" after 10 minutes, the process crashed without
  // writing a completion event. Treat it as done so the spinner/live-dot don't flash forever.
  const STALE_MS = 10 * 60 * 1000;
  const now = Date.now();
  for (const g of groups) {
    if (g.running && (now - g.ts) > STALE_MS) g.running = false;
  }

  return collapseZeroIndexRuns(groups.reverse()); // newest first
}

function isZeroIndexRun(g) {
  if (g.type !== 'index' || g.running) return false;
  const complete = g.events.find(e => e.type === 'index_complete');
  return (complete?.data?.newSessions ?? 0) === 0;
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

function groupSummary(group) {
  const completeEvent = group.events.find(e => e.type === 'index_complete' || e.type === 'enrich_complete');
  const startEvent = group.events.find(e => e.type === 'index_started' || e.type === 'enrich_started');

  if (group.type === 'daemon') return { label: 'Daemon started', detail: null };

  if (group.type === 'index_collapsed') {
    return { label: 'Index scan', detail: `${group.count}× no new sessions` };
  }

  if (group.type === 'index') {
    if (group.running) {
      const n = group.events.filter(e => e.type === 'session_indexed').length;
      return { label: 'Indexing…', detail: n > 0 ? `${n} indexed` : null };
    }
    const n = completeEvent?.data?.newSessions ?? 0;
    const ms = completeEvent?.data?.durationMs;
    return { label: 'Index scan', detail: `${n} new session${n === 1 ? '' : 's'}${ms ? '  ' + fmtDuration(ms) : ''}` };
  }

  if (group.type === 'enrich') {
    if (group.running) {
      const done = group.events.filter(e => e.type === 'session_enriched').length;
      const pending = startEvent?.data?.pending ?? '?';
      return { label: 'Enriching…', detail: `${done}/${pending} sessions` };
    }
    const n = completeEvent?.data?.enriched ?? 0;
    const ms = completeEvent?.data?.durationMs;
    return { label: 'Enrich run', detail: `${n} session${n === 1 ? '' : 's'} enriched${ms ? '  ' + fmtDuration(ms) : ''}` };
  }

  return { label: group.type, detail: null };
}

function renderRunGroup(group) {
  const { label, detail } = groupSummary(group);
  const subEvents = group.events.filter(e =>
    e.type === 'session_indexed' || e.type === 'session_enriched'
  );

  const iconHtml = group.running
    ? `<span class="run-spinner-wrap"><span class="spinner run-spinner"></span></span>`
    : `<span class="run-icon-badge ${group.type === 'index_collapsed' ? 'index' : group.type}">${runIcon(group.type)}</span>`;

  const detailHtml = detail ? `<span class="run-detail">${escHtml(detail)}</span>` : '';
  const tsHtml = `<span class="run-ts">${formatRelative(group.ts)}</span>`;

  if (subEvents.length === 0) {
    return `<div class="run-group no-expand"><div class="run-header">
      ${tsHtml}<span class="run-chevron-spacer"></span>${iconHtml}
      <span class="run-label">${escHtml(label)}</span>${detailHtml}
    </div></div>`;
  }

  const sessionIds = subEvents.map(e => e.data?.sessionId ?? '').filter(Boolean);

  const eventsHtml = subEvents.map(e => {
    const sid = escHtml(e.data?.sessionId ?? '');
    const ms = e.data?.latencyMs != null ? escHtml(fmtDuration(e.data.latencyMs)) : '';
    const timeStr = new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<div class="run-event" data-session-id="${sid}">
      <span class="run-event-ts">${timeStr}</span>
      <span class="run-event-id">${sid}</span>
      ${ms ? `<span class="run-event-meta">${ms}</span>` : ''}
    </div>`;
  }).join('');

  return `<details class="run-group" data-run-ts="${group.ts}" data-session-ids="${escHtml(sessionIds.join(','))}">
    <summary class="run-header">
      ${tsHtml}${iconHtml}<span class="run-label">${escHtml(label)}</span>${detailHtml}
    </summary>
    <div class="run-events">${eventsHtml}</div>
  </details>`;
}

function renderActivityRuns(groups) {
  const runList = document.getElementById('run-list');
  const showMoreBtn = document.getElementById('activity-show-more');
  const liveDot = document.getElementById('activity-live-dot');
  if (!runList) return;

  // Preserve open state across re-renders
  const openTs = new Set();
  runList.querySelectorAll('details.run-group').forEach(d => {
    if (d.open) openTs.add(d.dataset.runTs);
  });

  const visible = groups.slice(0, _visibleRunCount);
  const hidden = groups.length - visible.length;
  const anyRunning = groups.slice(0, 3).some(g => g.running);

  if (groups.length === 0) {
    runList.innerHTML = '<div style="padding:20px 0;color:var(--text-muted);font-size:13px;">No activity yet.</div>';
  } else {
    runList.innerHTML = visible.map(g => renderRunGroup(g)).join('');
  }

  // Restore open state — always re-enrich since DOM was rebuilt
  runList.querySelectorAll('details.run-group').forEach(d => {
    if (openTs.has(d.dataset.runTs)) {
      d.setAttribute('open', '');
      enrichRunGroup(d);
    }
  });

  if (liveDot) liveDot.classList.toggle('visible', anyRunning);

  if (showMoreBtn) {
    if (hidden > 0) {
      showMoreBtn.textContent = `Show ${hidden} older run${hidden === 1 ? '' : 's'}`;
      showMoreBtn.style.display = '';
    } else {
      showMoreBtn.style.display = 'none';
    }
  }
}

function showMoreRuns() {
  _visibleRunCount = _allRunGroups.length;
  renderActivityRuns(_allRunGroups);
}

async function enrichRunGroup(detailsEl) {
  detailsEl.dataset.enriched = '1';
  const ids = (detailsEl.dataset.sessionIds || '').split(',').filter(Boolean);
  if (ids.length === 0) return;

  try {
    const idList = ids.map(id => `'${id}'`).join(',');
    const res = await fetch('/query_db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: `SELECT id, title, project, summary FROM sessions WHERE id IN (${idList})` }),
    });
    if (!res.ok) return;
    const { rows } = await res.json();
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));

    detailsEl.querySelectorAll('.run-event[data-session-id]').forEach(row => {
      const session = byId[row.dataset.sessionId];
      if (!session) return;
      const tsEl = row.querySelector('.run-event-ts');
      const metaEl = row.querySelector('.run-event-meta');
      const title = escHtml(session.title || 'Untitled session');
      const project = escHtml(session.project || '');
      const summary = session.summary
        ? escHtml(session.summary.slice(0, 120)) + (session.summary.length > 120 ? '…' : '')
        : '';
      row.innerHTML = `
        ${tsEl ? tsEl.outerHTML : ''}
        <div class="run-event-info">
          <div class="run-event-header">
            <span class="run-event-title">${title}</span>
            ${project ? `<span class="run-event-project">${project}</span>` : ''}
          </div>
          ${summary ? `<div class="run-event-summary">${summary}</div>` : ''}
        </div>
        ${metaEl ? metaEl.outerHTML : ''}
      `;
    });
  } catch { /* silently fail — IDs remain as fallback */ }
}

// Lazy-enrich session rows when a run group is expanded
document.addEventListener('toggle', e => {
  const details = e.target;
  if (!details.matches('details.run-group') || !details.open || details.dataset.enriched) return;
  enrichRunGroup(details);
}, true);

// ── Search ──────────────────────────────────────────────────────────────────

document.getElementById('query').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

async function doSearch() {
  const query = document.getElementById('query').value.trim();
  if (!query) return;
  const k = parseInt(document.getElementById('k').value, 10) || 10;

  const btn = document.getElementById('search-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  document.getElementById('latency-bar').style.display = 'none';

  try {
    const res = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, k }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      document.getElementById('sessions-content').innerHTML =
        `<div class="error-state">Error: ${escHtml(err.error ?? 'Search failed')}</div>`;
      return;
    }

    const { results } = await res.json();
    _lastSearchResults = results ?? [];

    const lat = results?.[0]?.latency;
    const latencyEl = document.getElementById('latency-bar');
    if (lat) {
      latencyEl.style.display = 'flex';
      latencyEl.innerHTML = `
        <span>BM25 <strong>${lat.bm25Ms.toFixed(1)}ms</strong></span>
        <span>Embed <strong>${lat.embedMs.toFixed(1)}ms</strong></span>
        <span>KNN <strong>${lat.knnMs.toFixed(1)}ms</strong></span>
        <span>Fusion <strong>${lat.fusionMs.toFixed(1)}ms</strong></span>
        <span>Total <strong>${lat.totalMs.toFixed(1)}ms</strong></span>
      `;
    }
    document.getElementById('clear-search-btn').style.display = '';
    applyFilters();
  } catch (err) {
    document.getElementById('sessions-content').innerHTML =
      `<div class="error-state">Error: ${escHtml(String(err))}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Search';
  }
}

function renderSearchResults(results) {
  const content = document.getElementById('sessions-content');
  if (!results || results.length === 0) {
    content.innerHTML = '<div class="empty-state">No results found.</div>';
    return;
  }
  content.innerHTML = `<div class="sessions-grid">${results.map(r => {
    const tagPills = (r.tags ?? []).map(t =>
      `<span class="enrich-tag" onclick="event.stopPropagation();filterByTag('${escHtml(t)}')">${escHtml(t)}</span>`
    ).join('');
    const summaryHtml = r.summary
      ? `<div class="session-card-summary">${escHtml(r.summary)}</div>` : '';
    const snippetText = r.highlightedPreview ?? r.preview;
    const previewHtml = snippetText
      ? `<div class="result-snippet">
           <span class="result-snippet-score">${r.score.toFixed(4)}</span>
           <div class="result-snippet-body">${renderText(snippetText)}</div>
         </div>` : '';
    return `
    <div class="session-card" onclick="openSession('${escHtml(r.session_id)}')">
      <div class="session-card-body">
        <div class="session-card-title">${escHtml(r.title || r.session_id)}</div>
        <div class="session-card-meta">
          <span class="tag clickable-tag" onclick="event.stopPropagation();filterByProject('${escHtml(r.project || '')}')">${escHtml(r.project || '—')}</span>
          <span class="tag clickable-tag" onclick="event.stopPropagation();filterByDate('${escHtml(r.date || '')}')">${escHtml(r.date || '—')}</span>
          ${r.indexed_at ? `<span class="session-ts">${formatRelative(r.indexed_at)}</span>` : ''}
          <span class="session-id">${escHtml(r.session_id)}</span>
          ${tagPills}
        </div>
        ${summaryHtml}
        ${previewHtml}
      </div>
      <div class="session-card-arrow">›</div>
    </div>`;
  }).join('')}</div>`;
}

function clearSearch() {
  _lastSearchResults = null;
  document.getElementById('query').value = '';
  document.getElementById('latency-bar').style.display = 'none';
  document.getElementById('clear-search-btn').style.display = 'none';
  applyFilters();
}

// ── Sessions list ────────────────────────────────────────────────────────────

function updateFilterOptions(newSessions) {
  const seenProjects = new Set(_filterOptions.project);
  for (const s of newSessions) {
    if (s.project && !seenProjects.has(s.project)) {
      _filterOptions.project.push(s.project);
      seenProjects.add(s.project);
    }
  }
  const allTags = new Set(_filterOptions.tag);
  for (const s of newSessions) {
    for (const t of s.tags ?? []) allTags.add(t);
  }
  _filterOptions.tag = [...allTags].sort();
}

// ── Card fields config ───────────────────────────────────────────────────────
function saveCardFields() {
  localStorage.setItem('qrec_card_fields', JSON.stringify(_cardFields));
}

function initFieldsPicker() {
  for (const key of Object.keys(CARD_FIELD_DEFAULTS)) {
    const el = document.getElementById('field-' + key);
    if (el) el.checked = _cardFields[key];
  }
}

function toggleFieldsPicker() {
  const picker = document.getElementById('fields-picker');
  const isOpen = picker.style.display !== 'none';
  if (isOpen) {
    picker.style.display = 'none';
  } else {
    initFieldsPicker();
    picker.style.display = '';
  }
}

function onFieldChange() {
  for (const key of Object.keys(CARD_FIELD_DEFAULTS)) {
    const el = document.getElementById('field-' + key);
    if (el) _cardFields[key] = el.checked;
  }
  saveCardFields();
  // Re-render visible sessions with updated fields
  const filtered = getFilteredSessions();
  renderSessionsList(filtered);
}

document.addEventListener('click', e => {
  const picker = document.getElementById('fields-picker');
  const btn = document.getElementById('fields-btn');
  if (picker && picker.style.display !== 'none' && !picker.contains(e.target) && e.target !== btn) {
    picker.style.display = 'none';
  }
});

function setupScrollObserver() {
  if (_scrollObserver) _scrollObserver.disconnect();
  const sentinel = document.getElementById('sessions-sentinel');
  if (!sentinel) return;
  _scrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && _sessionsOffset < _sessionsTotal && !_sessionsLoading) {
      loadMoreSessions();
    }
  }, { rootMargin: '300px' });
  _scrollObserver.observe(sentinel);
}

async function loadSessions() {
  if (_sessionsLoading) return;
  _sessionsLoading = true;
  _allSessions = [];
  _sessionsOffset = 0;
  const content = document.getElementById('sessions-content');
  content.innerHTML = '<div class="loading-state"><span class="spinner"></span></div>';
  try {
    const dateParam = _filterDate ? `&date=${encodeURIComponent(_filterDate)}` : '';
    const res = await fetch(`/sessions?offset=0${dateParam}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { sessions, total } = await res.json();

    _sessionsTotal = total;
    _sessionsOffset = sessions.length;
    _allSessions = sessions;

    // Build filter options from first page (sessions are date-DESC; first occurrence = most recently active)
    _filterOptions.project = [];
    _filterOptions.tag = [];
    updateFilterOptions(sessions);

    applyFilters();
    if (!_heatmapData) fetchAndRenderHeatmap();
  } catch (err) {
    content.innerHTML = `<div class="error-state">Failed to load sessions: ${escHtml(String(err))}</div>`;
  } finally {
    _sessionsLoading = false;
  }
}

async function loadMoreSessions() {
  if (_sessionsLoading || _sessionsOffset >= _sessionsTotal) return;
  _sessionsLoading = true;
  try {
    const dateParam = _filterDate ? `&date=${encodeURIComponent(_filterDate)}` : '';
    const res = await fetch(`/sessions?offset=${_sessionsOffset}${dateParam}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { sessions, total } = await res.json();

    _sessionsTotal = total;
    _sessionsOffset += sessions.length;
    _allSessions = _allSessions.concat(sessions);

    // Incrementally update filter options from the new batch only — O(batch) not O(total)
    updateFilterOptions(sessions);

    // Append matching cards directly — no full re-render to avoid scroll jump
    const project = document.getElementById('filter-project').value.trim().toLowerCase();
    const tag = document.getElementById('filter-tag').value.trim().toLowerCase();
    const matching = sessions.filter(s => {
      if (project && !(s.project ?? '').toLowerCase().includes(project)) return false;
      if (tag && !(s.tags ?? []).some(t => t.toLowerCase().includes(tag))) return false;
      if (_filterDate && s.date !== _filterDate) return false;
      return true;
    });

    const grid = document.getElementById('sessions-grid');
    if (grid && matching.length > 0) {
      grid.insertAdjacentHTML('beforeend', matching.map(sessionCardHtml).join(''));
    }

    // Update count
    const countEl = document.getElementById('sessions-count');
    if (countEl && _lastSearchResults === null) {
      const visibleCount = (grid ? grid.children.length : 0);
      countEl.textContent = String(visibleCount);
    }

    setupScrollObserver();
  } catch (_) {
    // silently ignore append errors — user can scroll again to retry
  } finally {
    _sessionsLoading = false;
  }
}

function renderFilterDropdown(type, options) {
  const el = document.getElementById(`dropdown-${type}`);
  if (options.length === 0) { el.classList.remove('open'); return; }
  el.innerHTML = options.map(o => {
    const dot = type === 'project' ? `${projectDot(o, 8)}&nbsp;` : '';
    return `<div class="filter-dropdown-item" style="${type === 'project' ? 'display:flex;align-items:center;gap:4px;' : ''}" onclick="selectFilterOption('${type}','${escHtml(o)}')">${dot}${escHtml(o)}</div>`;
  }).join('');
  el.classList.add('open');
}

function showFilterDropdown(type) {
  const val = document.getElementById(`filter-${type}`).value.trim().toLowerCase();
  const opts = val
    ? _filterOptions[type].filter(o => o.toLowerCase().includes(val))
    : _filterOptions[type];
  renderFilterDropdown(type, opts);
}

function hideFilterDropdown(type) {
  document.getElementById(`dropdown-${type}`).classList.remove('open');
}

function handleFilterInput(input, type) {
  applyFilters();
  showFilterDropdown(type);
}

function filterByProject(project) {
  document.getElementById('filter-project').value = project;
  hideFilterDropdown('project');
  applyFilters();
  if (!document.getElementById('tab-sessions').classList.contains('active')) showTab('sessions');
}

function selectFilterOption(type, value) {
  document.getElementById(`filter-${type}`).value = value;
  hideFilterDropdown(type);
  applyFilters();
}

function getFilteredSessions() {
  const project = document.getElementById('filter-project').value.trim().toLowerCase();
  const tag = document.getElementById('filter-tag').value.trim().toLowerCase();
  return _allSessions.filter(s => {
    if (project && !(s.project ?? '').toLowerCase().includes(project)) return false;
    if (tag && !(s.tags ?? []).some(t => t.toLowerCase().includes(tag))) return false;
    if (_filterDate && s.date !== _filterDate) return false;
    return true;
  });
}

function applyFilters() {
  const project = document.getElementById('filter-project').value.trim().toLowerCase();
  const tag = document.getElementById('filter-tag').value.trim().toLowerCase();
  const hasFilter = project || tag || _filterDate;
  document.getElementById('clear-filters-btn').style.display = hasFilter ? '' : 'none';

  const filteredSessions = getFilteredSessions();

  if (_lastSearchResults !== null) {
    const filteredIds = new Set(filteredSessions.map(s => s.id));
    const intersected = _lastSearchResults.filter(r => filteredIds.has(r.session_id));
    document.getElementById('sessions-count').textContent = String(intersected.length);
    renderSearchResults(intersected);
  } else {
    document.getElementById('sessions-count').textContent = String(filteredSessions.length);
    renderSessionsList(filteredSessions);
  }
}

// ── Session Activity Heatmap ──────────────────────────────────────────────

const HEATMAP_METRICS = [
  { id: 'sessions', label: 'Sessions', unit: 'session', units: 'sessions' },
  { id: 'hours',    label: 'Hours',    unit: 'hour',    units: 'hours'    },
];
const HEATMAP_COLORS = ['#f0f0f0', '#d0d0d0', '#a0a0a0', '#686868', '#2a2a2a'];
const PROJECT_COLORS = ['#e63946','#2a9d8f','#e9a825','#9b5de5','#f4713c','#4361ee','#43aa8b','#f72585','#3d7ebf','#c77dff'];
function projectColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}
function projectColorScale(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const mix = (c, t) => Math.round(c * t + 255 * (1 - t));
  return [
    '#f0f0f0',
    `rgb(${mix(r,0.2)},${mix(g,0.2)},${mix(b,0.2)})`,
    `rgb(${mix(r,0.45)},${mix(g,0.45)},${mix(b,0.45)})`,
    `rgb(${mix(r,0.7)},${mix(g,0.7)},${mix(b,0.7)})`,
    hex,
  ];
}
function projectDot(name, size = 8) {
  return `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:${projectColor(name)};flex-shrink:0;vertical-align:middle;"></span>`;
}
const HEATMAP_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function heatmapIntensity(count, maxCount) {
  if (count === 0 || maxCount === 0) return 0;
  const q = count / maxCount;
  if (q <= 0.25) return 1;
  if (q <= 0.5)  return 2;
  if (q <= 0.75) return 3;
  return 4;
}

function heatmapUnitLabel(count, metricId) {
  const m = HEATMAP_METRICS.find(m => m.id === metricId) || HEATMAP_METRICS[0];
  const display = Number.isInteger(count) ? count.toLocaleString() : count.toFixed(1);
  return `${display} ${count === 1 ? m.unit : m.units}`;
}

function buildProjectTooltip(headerHtml, projectCounts) {
  const sorted = Object.entries(projectCounts).sort((a, b) => b[1] - a[1]);
  let html = `<div style="font-weight:600;margin-bottom:4px;">${headerHtml}</div>`;
  for (const [proj, cnt] of sorted) {
    html += `<div style="display:flex;align-items:center;gap:5px;margin-top:2px;">`;
    html += `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${projectColor(proj)};flex-shrink:0;"></span>`;
    html += `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${escHtml(proj)}</span>`;
    html += `<span style="margin-left:6px;opacity:0.85;">${heatmapUnitLabel(cnt, _heatmapMetric)}</span>`;
    html += `</div>`;
  }
  return html;
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function heatmapCurrentWeek(days) {
  const today = new Date();
  const wd = (today.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(today);
  monday.setDate(today.getDate() - wd);
  monday.setHours(0, 0, 0, 0);
  const result = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: localDateStr(d), count: 0 };  // local date, not UTC
  });
  const mondayStr = result[0].date;
  const sundayStr = result[6].date;
  for (const day of days) {
    if (day.date >= mondayStr && day.date <= sundayStr) {
      const i = (new Date(day.date + 'T00:00:00').getDay() + 6) % 7;
      result[i] = { date: day.date, count: day.count };
    }
  }
  return result;
}

function renderHeatmapMetricBtns() {
  const el = document.getElementById('heatmap-metric-btns');
  if (!el || HEATMAP_METRICS.length <= 1) return;
  el.innerHTML = '<div class="heatmap-metrics">' +
    HEATMAP_METRICS.map(m => {
      const active = m.id === _heatmapMetric ? ' heatmap-metric--active' : '';
      return `<button class="heatmap-metric${active}" onclick="selectHeatmapMetric('${m.id}')">${m.label}</button>`;
    }).join('') + '</div>';
}

function selectHeatmapMetric(metricId) {
  _heatmapMetric = metricId;
  try { localStorage.setItem('qrec_heatmap_metric', metricId); } catch {}
  fetchAndRenderHeatmap();
}

function selectHeatmapProject(project) {
  _heatmapProject = project || null;
  const btn = document.getElementById('heatmap-project-btn');
  if (btn) {
    if (project) {
      btn.innerHTML = `${projectDot(project, 8)} <span style="margin-left:5px;">${escHtml(project)}</span> ▾`;
    } else {
      btn.textContent = 'All projects ▾';
    }
  }
  document.getElementById('heatmap-dropdown-project')?.classList.remove('open');
  fetchAndRenderHeatmap();
}

function toggleHeatmapProjectDropdown() {
  const el = document.getElementById('heatmap-dropdown-project');
  if (el.classList.contains('open')) { el.classList.remove('open'); return; }
  const items = [{ label: 'All projects', value: '' }, ..._heatmapProjects.map(p => ({ label: p, value: p }))];
  el.innerHTML = items.map(({ label, value }) => {
    const dot = value ? `${projectDot(value, 8)}&nbsp;` : '';
    return `<div class="filter-dropdown-item${value === (_heatmapProject ?? '') ? ' filter-dropdown-item--active' : ''}" style="display:flex;align-items:center;gap:4px;" onclick="selectHeatmapProject('${escHtml(value)}')">${dot}${escHtml(label)}</div>`;
  }).join('');
  el.classList.add('open');
}

function hideHeatmapProjectDropdown() {
  document.getElementById('heatmap-dropdown-project')?.classList.remove('open');
}

function renderHeatmap(containerId, days, opts = {}) {
  const container = document.getElementById(containerId);
  if (!container || !days || days.length === 0) return;
  const { clickable, selectedDate, byProject } = opts;

  const CELL = 15, GAP = 2, LABEL_W = 40;
  const CHART_H = 70, MAX_INLINE = 80, INLINE_GAP = 16;
  const cs = `width:${CELL}px;height:${CELL}px;border-radius:2px;flex-shrink:0;`;
  const maxCount = Math.max(...days.map(d => d.count), 1);
  const colors = _heatmapProject ? projectColorScale(projectColor(_heatmapProject)) : HEATMAP_COLORS;
  const barColor = _heatmapProject ? projectColor(_heatmapProject) : '#686868';

  // Build week columns
  const weeks = [];
  for (const day of days) {
    const d = new Date(day.date + 'T00:00:00');
    const weekday = (d.getDay() + 6) % 7;
    const monday = new Date(d); monday.setDate(d.getDate() - weekday);
    const mondayStr = monday.toISOString().slice(0, 10);
    if (!weeks.length || weeks[weeks.length - 1].monday !== mondayStr)
      weeks.push({ monday: mondayStr, cells: new Array(7).fill(null) });
    weeks[weeks.length - 1].cells[weekday] = day;
  }

  // Month labels
  let lastMonth = -1;
  let lastMonthCol = -99;
  const monthAtCol = weeks.map((week, i) => {
    const first = week.cells.find(c => c);
    if (!first) return null;
    const m = new Date(first.date + 'T00:00:00').getMonth();
    if (m !== lastMonth && i - lastMonthCol >= 3) {
      lastMonth = m; lastMonthCol = i; return HEATMAP_MONTHS[m];
    }
    return null;
  });

  // Current week inline bars
  const cwDays = heatmapCurrentWeek(days);
  const cwMax  = Math.max(...cwDays.map(d => d.count), 1);
  const cwStart = new Date(cwDays[0].date + 'T00:00:00');
  const cwEnd   = new Date(cwDays[6].date + 'T00:00:00');
  const fmtDay  = d => `${HEATMAP_MONTHS[d.getMonth()]} ${d.getDate()}`;
  const cwLabel = `${fmtDay(cwStart)} – ${fmtDay(cwEnd)}`;

  let html = '<div class="heatmap">';

  // Month header row + current-week range label
  html += `<div style="display:flex;align-items:center;gap:${GAP}px;margin-bottom:${GAP}px;">`;
  html += `<div style="width:${LABEL_W}px;flex-shrink:0;"></div>`;
  for (let i = 0; i < weeks.length; i++) {
    html += `<div style="width:${CELL}px;flex-shrink:0;">`;
    if (monthAtCol[i]) html += `<span class="heatmap-month-label">${monthAtCol[i]}</span>`;
    html += '</div>';
  }
  html += `<div style="margin-left:${INLINE_GAP}px;font-size:11px;color:var(--text-muted);white-space:nowrap;flex-shrink:0;">${escHtml(cwLabel)}</div>`;
  html += '</div>';

  // Weekday rows
  for (let wd = 0; wd < 7; wd++) {
    html += `<div style="display:flex;align-items:center;gap:${GAP}px;">`;
    html += `<div class="heatmap-day-label" style="width:${LABEL_W}px;">${HEATMAP_WEEKDAYS[wd]}</div>`;

    for (let wi = 0; wi < weeks.length; wi++) {
      const cell = weeks[wi].cells[wd];
      if (cell) {
        const intensity = heatmapIntensity(cell.count, maxCount);
        const isSelected = selectedDate && cell.date === selectedDate;
        const bg = isSelected ? 'var(--accent)' : colors[intensity];
        const isClick = clickable && cell.count > 0;
        const cd = new Date(cell.date + 'T00:00:00');
        const friendlyDate = `${HEATMAP_WEEKDAYS[wd]}, ${HEATMAP_MONTHS[cd.getMonth()]} ${cd.getDate()}`;
        const title = `${friendlyDate}: ${heatmapUnitLabel(cell.count, _heatmapMetric)}`;
        const cellProjects = byProject && byProject[cell.date];
        const tipHtmlAttr = (cellProjects && Object.keys(cellProjects).length > 1)
          ? ` data-tip-html="${escHtml(buildProjectTooltip(escHtml(title), cellProjects))}"`
          : '';
        html += `<div class="heatmap-cell${isClick ? ' heatmap-cell--clickable' : ''}" style="${cs}background:${bg};" data-tooltip="${escHtml(title)}"${tipHtmlAttr} data-date="${cell.date}" data-count="${cell.count}"></div>`;
      } else {
        const ed = new Date(weeks[wi].monday + 'T00:00:00');
        ed.setDate(ed.getDate() + wd);
        const friendlyDate = `${HEATMAP_WEEKDAYS[wd]}, ${HEATMAP_MONTHS[ed.getMonth()]} ${ed.getDate()}`;
        html += `<div style="${cs}background:${colors[0]};" data-tooltip="${escHtml(friendlyDate)}"></div>`;
      }
    }

    // Right-side inline bar (current week)
    const cwCount = cwDays[wd]?.count || 0;
    const cwDate  = cwDays[wd]?.date;
    const barW    = Math.round((cwCount / cwMax) * MAX_INLINE);
    const barBg   = cwCount > 0 ? colors[heatmapIntensity(cwCount, cwMax)] : 'transparent';
    const label   = cwCount > 0 ? String(cwCount) : '';
    const fitsInside = barW > label.length * 7 + 8;
    const cwFriendly = cwDate ? `${HEATMAP_WEEKDAYS[wd]}, ${HEATMAP_MONTHS[new Date(cwDate + 'T00:00:00').getMonth()]} ${new Date(cwDate + 'T00:00:00').getDate()}` : HEATMAP_WEEKDAYS[wd];
    const cwTitle = cwCount > 0 ? `${cwFriendly}: ${heatmapUnitLabel(cwCount, _heatmapMetric)}` : cwFriendly;
    const cwProjects = byProject && cwDate && byProject[cwDate];
    const cwTipAttr = (cwProjects && Object.keys(cwProjects).length > 1)
      ? `data-tip-html="${escHtml(buildProjectTooltip(escHtml(cwTitle), cwProjects))}"`
      : `data-tooltip="${escHtml(cwTitle)}"`;
    html += `<div style="display:flex;align-items:center;margin-left:${INLINE_GAP}px;min-width:${MAX_INLINE + 24}px;" ${cwTipAttr}>`;
    html += `<div style="width:${barW}px;height:${CELL}px;background:${barBg};border-radius:2px;display:flex;align-items:center;justify-content:flex-end;min-width:${cwCount > 0 ? 2 : 0}px;flex-shrink:0;">`;
    if (label && fitsInside) html += `<span style="font-size:10px;padding-right:2px;color:#fff;line-height:1;">${label}</span>`;
    html += '</div>';
    if (label && !fitsInside) html += `<span style="font-size:11px;color:var(--text-muted);margin-left:4px;">${label}</span>`;
    html += '</div>';

    html += '</div>'; // end row
  }

  // Bottom weekly bar chart
  const weeklyTotals = weeks.map(w => {
    const d = new Date(w.monday + 'T00:00:00');
    const weekProjects = {};
    if (byProject) {
      for (const cell of w.cells) {
        if (!cell) continue;
        const dp = byProject[cell.date];
        if (!dp) continue;
        for (const [proj, cnt] of Object.entries(dp)) {
          weekProjects[proj] = (weekProjects[proj] || 0) + cnt;
        }
      }
    }
    return {
      label: `${HEATMAP_MONTHS[d.getMonth()]} ${d.getDate()}`,
      total: w.cells.reduce((s, c) => s + (c?.count || 0), 0),
      projects: weekProjects,
    };
  });
  const maxWeekly  = Math.max(...weeklyTotals.map(w => w.total), 1);
  const roundedMax = Math.max(Math.ceil(maxWeekly / 5) * 5, 5);

  html += `<div style="display:flex;align-items:flex-end;height:${CHART_H}px;margin-top:8px;">`;
  html += `<div style="width:${LABEL_W}px;flex-shrink:0;"></div>`;
  html += `<div style="display:flex;align-items:flex-end;gap:${GAP}px;">`;
  for (const week of weeklyTotals) {
    const barH   = Math.round((week.total / roundedMax) * CHART_H);
    const actualH = Math.max(barH, week.total > 0 ? 2 : 0);
    const title  = `Week of ${week.label}: ${heatmapUnitLabel(week.total, _heatmapMetric)}`;
    const labelInside = week.total > 0 && actualH >= 14
      ? `<span style="position:absolute;top:2px;left:0;right:0;text-align:center;font-size:10px;color:rgba(255,255,255,0.85);line-height:1;pointer-events:none;">${Math.round(week.total)}</span>`
      : '';
    const weekTipHtmlAttr = (Object.keys(week.projects).length > 1)
      ? ` data-tip-html="${escHtml(buildProjectTooltip(escHtml(title), week.projects))}"`
      : ` data-tooltip="${escHtml(title)}"`;
    html += `<div class="heatmap-weekly-bar" style="width:${CELL}px;height:${actualH}px;position:relative;background:${barColor};"${weekTipHtmlAttr}>${labelInside}</div>`;
  }
  html += '</div></div>';

  html += '</div>'; // end .heatmap
  container.innerHTML = html;

  container.onclick = clickable
    ? e => {
        const cell = e.target.closest('[data-date]');
        if (cell && parseInt(cell.dataset.count || '0') > 0) filterByDate(cell.dataset.date);
      }
    : null;
}

async function fetchAndRenderHeatmap() {
  try {
    // Populate project list on first load
    if (_heatmapProject === null && _heatmapProjects.length === 0) {
      const pr = await fetch('/projects');
      if (pr.ok) _heatmapProjects = (await pr.json()).projects ?? [];
    }

    const params = new URLSearchParams({ weeks: '15', metric: _heatmapMetric });
    if (_heatmapProject) params.set('project', _heatmapProject);
    const res = await fetch(`/stats/heatmap?${params}`);
    if (!res.ok) return;
    _heatmapData = await res.json();

    // Dashboard
    const dashSection = document.getElementById('dashboard-heatmap-section');
    if (dashSection) {
      renderHeatmapMetricBtns();
      renderHeatmap('dashboard-heatmap', _heatmapData.days, { clickable: true, byProject: _heatmapData.byProject });
      const footer = document.getElementById('dashboard-heatmap-footer');
      if (footer) {
        const m = HEATMAP_METRICS.find(m => m.id === _heatmapMetric) || HEATMAP_METRICS[0];
        footer.textContent = `${_heatmapData.total.toLocaleString()} ${m.units} · ${_heatmapData.active_days} active days`;
      }
      dashSection.style.display = '';
    }
  } catch {}
}


function filterByTag(tag) {
  document.getElementById('filter-tag').value = tag;
  applyFilters();
  if (!document.getElementById('tab-sessions').classList.contains('active')) showTab('sessions');
}

function filterByDate(date) {
  _filterDate = date;
  const chip = document.getElementById('date-chip');
  chip.style.display = '';
  chip.innerHTML = `📅 ${escHtml(date)} <span class="date-chip-x" onclick="clearDateFilter()">×</span>`;
  if (document.getElementById('tab-sessions').classList.contains('active')) {
    loadSessions();
  } else {
    showTab('sessions');
  }
}

function clearDateFilter() {
  _filterDate = null;
  document.getElementById('date-chip').style.display = 'none';
  loadSessions();
}

function clearFilters() {
  document.getElementById('filter-project').value = '';
  document.getElementById('filter-tag').value = '';
  hideFilterDropdown('project');
  hideFilterDropdown('tag');
  _filterDate = null;
  document.getElementById('date-chip').style.display = 'none';
  document.getElementById('clear-filters-btn').style.display = 'none';
  loadSessions();
}

function enrichBlockHtml(s, compact = false) {
  const hasAny = !compact || Object.keys(_cardFields).some(k => k !== 'tags' && _cardFields[k] && s[k]);
  if (!hasAny) return '';

  // In compact (card) mode, only show fields the user has toggled on.
  // Tags are handled in the meta row for cards, so they're excluded from the block.
  const showField = k => !compact || (k !== 'tags' && _cardFields[k]);

  const summarySection = showField('summary') && s.summary
    ? `<div class="summary-block-section">
         <span class="summary-block-label">Summary</span>
         <p style="margin-top:4px;">${escHtml(s.summary)}</p>
       </div>` : '';

  // Tags only appear in the block for the detail view
  const tagPills = !compact
    ? (s.tags ?? []).map(t =>
        `<span class="enrich-tag" onclick="event.stopPropagation();filterByTag('${escHtml(t)}');showTab('sessions')">${escHtml(t)}</span>`
      ).join('')
    : '';
  const entityPills = showField('entities')
    ? (s.entities ?? []).map(e =>
        `<span class="tag" style="font-family:var(--mono);font-size:11px;">${escHtml(e)}</span>`
      ).join('')
    : '';
  const tagsHtml = (tagPills || entityPills)
    ? `<div class="summary-block-tags">${tagPills}${entityPills}</div>` : '';

  const learningsHtml = showField('learnings') && (s.learnings ?? []).length > 0
    ? `<div class="summary-block-section">
         <span class="summary-block-label">Learnings</span>
         <ul class="summary-block-list">${(s.learnings ?? []).map(l => `<li>${escHtml(l)}</li>`).join('')}</ul>
       </div>` : '';

  const questionsHtml = showField('questions') && (s.questions ?? []).length > 0
    ? `<div class="summary-block-section">
         <span class="summary-block-label">Questions answered</span>
         <ul class="summary-block-list">${(s.questions ?? []).map(q => `<li>${escHtml(q)}</li>`).join('')}</ul>
       </div>` : '';

  const inner = summarySection + tagsHtml + learningsHtml + questionsHtml;
  if (!inner.trim()) return '';
  return `<div class="summary-block${compact ? ' summary-block--compact' : ''}">${inner}</div>`;
}

function sessionCardHtml(s) {
  const metaTagPills = _cardFields.tags
    ? (s.tags ?? []).map(t =>
        `<span class="enrich-tag" onclick="event.stopPropagation();filterByTag('${escHtml(t)}')">${escHtml(t)}</span>`
      ).join('')
    : '';
  return `
  <div class="session-card" onclick="openSession('${escHtml(s.id)}')">
    <div class="session-card-body">
      <div class="session-card-title">${escHtml(s.title || '(untitled)')}</div>
      <div class="session-card-meta">
        <span class="tag clickable-tag" onclick="event.stopPropagation();filterByProject('${escHtml(s.project || '')}')">${escHtml(s.project || '—')}</span>
        <span class="tag clickable-tag" onclick="event.stopPropagation();filterByDate('${escHtml(s.date || '')}')">${escHtml(s.date || '—')}</span>
        ${s.indexed_at ? `<span class="session-ts">${formatRelative(s.indexed_at)}</span>` : ''}
        <span class="session-id">${escHtml(s.id)}</span>
        ${metaTagPills}
      </div>
      ${enrichBlockHtml(s, true)}
    </div>
    <div class="session-card-arrow">›</div>
  </div>`;
}

function renderSessionsList(sessions) {
  const content = document.getElementById('sessions-content');
  if (!sessions || sessions.length === 0) {
    content.innerHTML = '<div class="empty-state">No sessions found.</div>';
    setupScrollObserver();
    return;
  }
  content.innerHTML = `<div class="sessions-grid" id="sessions-grid">${sessions.map(sessionCardHtml).join('')}</div><div id="sessions-sentinel"></div>`;
  setupScrollObserver();
}

function openSession(id) {
  navigate('session/' + id);
}

// ── Session detail ───────────────────────────────────────────────────────────

function openSessionDetail(id) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-session-detail').classList.add('active');
  // Highlight the sessions nav button as parent context
  document.getElementById('nav-sessions').classList.add('active');

  document.getElementById('detail-loading').style.display = '';
  document.getElementById('detail-error').style.display = 'none';
  document.getElementById('detail-content').style.display = 'none';

  loadSessionDetail(id);
}

async function loadSessionDetail(id) {
  try {
    const res = await fetch('/sessions/' + id);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      document.getElementById('detail-loading').style.display = 'none';
      const errEl = document.getElementById('detail-error');
      errEl.style.display = '';
      errEl.textContent = 'Error: ' + (err.error ?? 'Failed to load session');
      return;
    }

    const session = await res.json();
    document.getElementById('detail-loading').style.display = 'none';

    document.getElementById('detail-title').textContent = session.title || '(untitled)';
    document.getElementById('detail-meta').innerHTML = `
      <span class="tag clickable-tag" onclick="filterByProject('${escHtml(session.project || '')}')">${escHtml(session.project || '—')}</span>
      <span class="tag clickable-tag" onclick="filterByDate('${escHtml(session.date || '')}')">${escHtml(session.date || '—')}</span>
      <span class="tag" style="font-family:var(--mono);font-size:11px;">${escHtml(session.id)}</span>
      <span class="tag">${session.turns ? session.turns.length + ' turns' : ''}</span>
    `;

    // Summary block (shown above turns when enriched) — remove all, not just first
    document.querySelectorAll('.summary-block').forEach(el => el.remove());
    const turnsEl = document.getElementById('detail-turns');
    const blockHtml = enrichBlockHtml(session, false);
    if (blockHtml) turnsEl.insertAdjacentHTML('beforebegin', blockHtml);

    if (!session.turns || session.turns.length === 0) {
      turnsEl.innerHTML = '<div class="empty-state">No turns found in this session.</div>';
    } else {
      turnsEl.innerHTML = groupTurns(session.turns).map(g => renderGroup(g)).join('');
    }

    document.getElementById('detail-content').style.display = '';
  } catch (err) {
    document.getElementById('detail-loading').style.display = 'none';
    const errEl = document.getElementById('detail-error');
    errEl.style.display = '';
    errEl.textContent = 'Error: ' + String(err);
  }
}

/** Group flat turn list: consecutive assistant turns → one agent group. */
function groupTurns(turns) {
  const groups = [];
  let i = 0;
  while (i < turns.length) {
    if (turns[i].role === 'user') {
      groups.push({ type: 'user', turn: turns[i] });
      i++;
    } else {
      const agentTurns = [];
      while (i < turns.length && turns[i].role === 'assistant') {
        agentTurns.push(turns[i]);
        i++;
      }
      groups.push({ type: 'agent', turns: agentTurns });
    }
  }
  return groups;
}

function renderGroup(group) {
  if (group.type === 'user') {
    const t = group.turn;
    const tsHtml = t.timestamp
      ? `<div class="turn-ts">${escHtml(new Date(t.timestamp).toLocaleString())}</div>`
      : '';
    return `
      <div class="turn user">
        <div class="turn-role">User</div>
        <div class="turn-text">${renderText(t.text)}</div>
        ${tsHtml}
      </div>`;
  }

  // Agent group: collect all tools, thinking, and text across consecutive turns
  const allTools = group.turns.flatMap(t => t.tools ?? []);
  const allThinking = group.turns.flatMap(t => t.thinking ?? []);
  const texts = group.turns.map(t => t.text).filter(Boolean);
  const lastTs = group.turns.map(t => t.timestamp).filter(Boolean).at(-1);

  const textHtml = texts.length
    ? `<div class="turn-text">${texts.map(renderText).join('<hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">')}</div>`
    : '';

  const thinkingHtml = allThinking.length
    ? `<details class="agent-thinking">
        <summary>Thinking (${allThinking.length})</summary>
        <div class="agent-thinking-body">${allThinking.map(t => escHtml(t)).join('\n\n---\n\n')}</div>
      </details>`
    : '';

  const actionsHtml = allTools.length
    ? `<details class="agent-actions">
        <summary>${allTools.length} tool call${allTools.length === 1 ? '' : 's'}</summary>
        <div class="agent-actions-body">
          ${allTools.map(tool => `
            <details class="tool-detail">
              <summary>${escHtml(tool)}</summary>
              <div class="tool-content">${escHtml(tool)}</div>
            </details>`).join('')}
        </div>
      </details>`
    : '';

  const tsHtml = lastTs
    ? `<div class="turn-ts">${escHtml(new Date(lastTs).toLocaleString())}</div>`
    : '';

  return `
    <div class="turn assistant">
      <div class="turn-role">Agent</div>
      ${textHtml}
      ${thinkingHtml}
      ${actionsHtml}
      ${tsHtml}
    </div>`;
}

function goBack() {
  showTab('sessions');
}


// ── Debug ────────────────────────────────────────────────────────────────────

let autoscroll = true;

function toggleAutoscroll() {
  autoscroll = !autoscroll;
  document.getElementById('autoscroll-btn').textContent = 'Autoscroll: ' + (autoscroll ? 'on' : 'off');
}

async function fetchStats() {
  try {
    const res = await fetch('/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    document.getElementById('dbg-sessions').textContent = d.sessions.toLocaleString();
    document.getElementById('dbg-chunks').textContent = d.chunks.toLocaleString();
    document.getElementById('dbg-searches').textContent = d.searches.toLocaleString();
    document.getElementById('dbg-provider').textContent = d.embedProvider;
    document.getElementById('dbg-stats-meta').textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (err) {
    document.getElementById('dbg-stats-meta').textContent = 'Error: ' + err.message;
  }
}

async function fetchLog() {
  try {
    const res = await fetch('/debug/log?lines=200');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { lines } = await res.json();
    const body = document.getElementById('dbg-log-body');
    if (!lines || lines.length === 0) {
      body.innerHTML = '<span class="log-empty">No log entries.</span>';
      document.getElementById('dbg-log-meta').textContent = 'Empty';
      return;
    }
    body.innerHTML = lines.map(l => {
      const cls = /error|fatal|err/i.test(l) ? 'log-err'
        : /warn/i.test(l) ? 'log-warn'
        : /ready|success|done/i.test(l) ? 'log-ok'
        : '';
      return `<span class="log-line ${cls}">${escHtml(l)}</span>`;
    }).join('\n');
    if (autoscroll) body.scrollTop = body.scrollHeight;
    document.getElementById('dbg-log-meta').textContent =
      `${lines.length} lines · ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    document.getElementById('dbg-log-meta').textContent = 'Error: ' + err.message;
  }
}

async function fetchConfig() {
  try {
    const res = await fetch('/debug/config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = await res.json();
    const rows = Object.entries(cfg).map(([k, v]) => {
      const display = v === null ? '<span style="color:var(--text-muted)">—</span>' : escHtml(String(v));
      return `<tr><td>${escHtml(k)}</td><td>${display}</td></tr>`;
    }).join('');
    document.getElementById('dbg-config-table').innerHTML = rows;
  } catch (err) {
    document.getElementById('dbg-config-table').innerHTML =
      `<tr><td colspan="2" style="padding:16px;color:var(--red)">Failed: ${escHtml(String(err))}</td></tr>`;
  }
}

async function runHealth() {
  showToolOutput('Fetching /health…');
  try {
    const res = await fetch('/health');
    showToolOutput(JSON.stringify(await res.json(), null, 2));
  } catch (err) { showToolOutput('Error: ' + err); }
}

async function runSearch() {
  showToolOutput('Sending test query…');
  try {
    const res = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test query', k: 3 }),
    });
    const data = await res.json();
    if (data.results) data.results = data.results.map(r => ({ ...r, preview: r.preview?.slice(0, 80) + '…' }));
    showToolOutput(JSON.stringify(data, null, 2));
  } catch (err) { showToolOutput('Error: ' + err); }
}

function showToolOutput(text) {
  document.getElementById('tool-output').style.display = '';
  document.getElementById('tool-pre').textContent = text;
}
