// ── Tab routing ─────────────────────────────────────────────────────────────

function navigate(hash, push = true) {
  if (!hash) hash = 'dashboard';
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
  if (name === 'dashboard') loadDashboard();
  if (name === 'activity') loadActivity();
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

// ── Shared polling ──────────────────────────────────────────────────────────

setInterval(() => {
  const active = document.querySelector('.tab-panel.active')?.id?.replace('tab-', '');
  if (active === 'dashboard') loadDashboard();
  if (active === 'activity') loadActivity();
  if (active === 'sessions') loadSessions();
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
      fetch('/activity/entries?limit=20'),
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
  document.getElementById('info-memory').textContent =
    data.memoryMB != null ? data.memoryMB + ' MB' : '—';
  const enrichTotal = data.sessions ?? 0;
  const enrichDone = data.enrichedCount ?? 0;
  const enrichPending = data.pendingCount ?? 0;
  let enrichHtml;
  if (!data.enrichEnabled) {
    enrichHtml = '<span style="color:var(--text-muted)">disabled</span>';
  } else if (data.enriching) {
    const pct = enrichTotal > 0 ? Math.round((enrichDone / enrichTotal) * 100) : 0;
    enrichHtml = `<span class="enrich-dot"></span>${enrichDone} / ${enrichTotal} (${pct}%)`;
  } else if (enrichPending === 0) {
    enrichHtml = `<span style="color:var(--green)">✓ ${enrichDone} / ${enrichTotal}</span>`;
  } else {
    enrichHtml = `${enrichDone} / ${enrichTotal} <span style="color:var(--text-muted);font-size:11px;">(${enrichPending} pending)</span>`;
  }
  document.getElementById('info-enriching').innerHTML = enrichHtml;
  document.getElementById('db-last-updated').textContent = 'Last updated ' + new Date().toLocaleTimeString();

  const toggleBtn = document.getElementById('enrich-toggle-btn');
  if (data.enrichEnabled) {
    toggleBtn.textContent = 'Enabled';
    toggleBtn.style.color = 'var(--green)';
    toggleBtn.style.borderColor = 'var(--green-border)';
  } else {
    toggleBtn.textContent = 'Disabled';
    toggleBtn.style.color = 'var(--text-muted)';
    toggleBtn.style.borderColor = 'var(--border)';
  }

  // Activity feed
  const listEl = document.getElementById('db-activity-list');
  if (actEntries && actEntries.length > 0) {
    listEl.innerHTML = actEntries.slice(0, 8).map(e => {
      const label = activityLabel(e);
      return `<div class="activity-item">
        <div class="activity-dot ${escHtml(e.type)}"></div>
        <span>${escHtml(label)}</span>
        <span class="activity-ts">${formatRelative(e.ts)}</span>
      </div>`;
    }).join('');
    document.getElementById('db-activity-feed').style.display = '';
  } else {
    document.getElementById('db-activity-feed').style.display = 'none';
  }

  document.getElementById('dashboard').style.display = 'block';
}

async function toggleEnrichment() {
  const btn = document.getElementById('enrich-toggle-btn');
  const current = btn.textContent === 'Enabled';
  btn.disabled = true;
  try {
    const res = await fetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrichEnabled: !current }),
    });
    if (res.ok) loadDashboard();
  } finally {
    btn.disabled = false;
  }
}

function activityLabel(e) {
  switch (e.type) {
    case 'daemon_started': return 'Daemon started';
    case 'index_started': return 'Index scan started';
    case 'session_indexed': return `Indexed session ${e.data?.sessionId ?? ''}`;
    case 'index_complete': {
      const n = e.data?.newSessions ?? 0;
      const ms = e.data?.durationMs ? ` (${Math.round(e.data.durationMs)}ms)` : '';
      return `Index complete — ${n} new session${n === 1 ? '' : 's'}${ms}`;
    }
    default: return String(e.type);
  }
}

// ── Search ──────────────────────────────────────────────────────────────────

let _lastSearchResults = null;

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
          <span class="tag">${escHtml(r.date || '—')}</span>
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

let _allSessions = [];
let _filterDate = null;

async function loadSessions() {
  const content = document.getElementById('sessions-content');
  try {
    const res = await fetch('/sessions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { sessions, total } = await res.json();

    _allSessions = sessions;

    // Populate project + tag datalists
    const projects = [...new Set(sessions.map(s => s.project).filter(Boolean))].sort();
    const tags = [...new Set(sessions.flatMap(s => s.tags ?? []))].sort();
    document.getElementById('project-list').innerHTML = projects.map(p => `<option value="${escHtml(p)}">`).join('');
    document.getElementById('tag-list').innerHTML = tags.map(t => `<option value="${escHtml(t)}">`).join('');

    applyFilters(); // preserve any active filters after (re)load
  } catch (err) {
    content.innerHTML = `<div class="error-state">Failed to load sessions: ${escHtml(String(err))}</div>`;
  }
}

function applyFilters() {
  const project = document.getElementById('filter-project').value.trim().toLowerCase();
  const tag = document.getElementById('filter-tag').value.trim().toLowerCase();
  const hasFilter = project || tag || _filterDate;
  document.getElementById('clear-filters-btn').style.display = hasFilter ? '' : 'none';

  const filteredSessions = _allSessions.filter(s => {
    if (project && !(s.project ?? '').toLowerCase().includes(project)) return false;
    if (tag && !(s.tags ?? []).some(t => t.toLowerCase().includes(tag))) return false;
    if (_filterDate && s.date !== _filterDate) return false;
    return true;
  });

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

function filterByProject(project) {
  document.getElementById('filter-project').value = project;
  applyFilters();
  if (!document.getElementById('tab-sessions').classList.contains('active')) showTab('sessions');
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
  applyFilters();
  if (!document.getElementById('tab-sessions').classList.contains('active')) showTab('sessions');
}

function clearDateFilter() {
  _filterDate = null;
  document.getElementById('date-chip').style.display = 'none';
  applyFilters();
}

function clearFilters() {
  document.getElementById('filter-project').value = '';
  document.getElementById('filter-tag').value = '';
  _filterDate = null;
  document.getElementById('date-chip').style.display = 'none';
  document.getElementById('clear-filters-btn').style.display = 'none';
  renderSessionsList(_allSessions);
}

function renderSessionsList(sessions) {
  const content = document.getElementById('sessions-content');
  if (!sessions || sessions.length === 0) {
    content.innerHTML = '<div class="empty-state">No sessions found.</div>';
    return;
  }
  content.innerHTML = `<div class="sessions-grid">${sessions.map(s => {
    const tagPills = (s.tags ?? []).map(t =>
      `<span class="enrich-tag" onclick="event.stopPropagation();filterByTag('${escHtml(t)}')">${escHtml(t)}</span>`
    ).join('');
    const summaryHtml = s.summary
      ? `<div class="session-card-summary">${escHtml(s.summary)}</div>`
      : '';
    return `
    <div class="session-card" onclick="openSession('${escHtml(s.id)}')">
      <div class="session-card-body">
        <div class="session-card-title">${escHtml(s.title || '(untitled)')}</div>
        <div class="session-card-meta">
          <span class="tag clickable-tag" onclick="event.stopPropagation();filterByProject('${escHtml(s.project || '')}')">${escHtml(s.project || '—')}</span>
          <span class="tag clickable-tag" onclick="event.stopPropagation();filterByDate('${escHtml(s.date || '')}')">${escHtml(s.date || '—')}</span>
          <span class="session-id">${escHtml(s.id)}</span>
          ${tagPills}
        </div>
        ${summaryHtml}
      </div>
      <div class="session-card-arrow">›</div>
    </div>`;
  }).join('')}</div>`;
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

  const backBtn = document.getElementById('detail-back-btn');
  backBtn.textContent = '← Sessions';

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

    // Summary block (shown above turns when enriched)
    document.querySelector('.summary-block')?.remove();
    const turnsEl = document.getElementById('detail-turns');
    if (session.summary) {
      const tagPills = (session.tags ?? []).map(t =>
        `<span class="enrich-tag" onclick="filterByTag('${escHtml(t)}');showTab('sessions')">${escHtml(t)}</span>`
      ).join('');
      const entityPills = (session.entities ?? []).map(e =>
        `<span class="tag" style="font-family:var(--mono);font-size:11px;">${escHtml(e)}</span>`
      ).join('');
      const tagsHtml = (tagPills || entityPills)
        ? `<div class="summary-block-tags">${tagPills}${entityPills}</div>` : '';
      turnsEl.insertAdjacentHTML('beforebegin', `
        <div class="summary-block">
          <p>${escHtml(session.summary)}</p>
          ${tagsHtml}
        </div>`);
    }

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

// ── Activity ─────────────────────────────────────────────────────────────────

async function loadActivity() {
  try {
    const res = await fetch('/activity/entries?limit=200');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { entries } = await res.json();

    document.getElementById('activity-count').textContent = String(entries.length);
    const content = document.getElementById('activity-content');

    if (entries.length === 0) {
      content.innerHTML = '<div class="empty-state">No activity yet. Start the daemon and run a search.</div>';
      return;
    }

    const rows = entries.map(e => `
      <tr>
        <td>${formatDate(e.ts)}</td>
        <td><span class="type-badge ${escHtml(e.type)}">${escHtml(e.type)}</span></td>
        <td style="color:var(--text-muted);font-size:12px;">${escHtml(e.data ? JSON.stringify(e.data) : '')}</td>
      </tr>
    `).join('');

    content.innerHTML = `
      <table class="activity-table">
        <thead><tr><th>Time</th><th>Event</th><th>Data</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (err) {
    document.getElementById('activity-content').innerHTML =
      `<div class="error-state">Failed to load activity: ${escHtml(String(err))}</div>`;
  }
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
