// demo/src/data/index.ts
// Single source of truth for all synthetic demo data.
// DayEntry is { date: string; count: number } — matching HeatmapGrid's days prop shape.

export type DayEntry = { date: string; count: number };

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const PROJECTS = ['qrec', 'api', 'dashboard', 'infra'] as const;
export type Project = (typeof PROJECTS)[number];

// ---------------------------------------------------------------------------
// Session data type (matching SessionCard props)
// ---------------------------------------------------------------------------

export interface SessionData {
  id: string;
  title: string;
  project: Project;
  date: string; // "Mar 15" format
  last_message_at?: number;
  summary: string;
  tags: string[];
  entities?: string[];
  learnings?: string[];
  questions?: string[];
  score?: number;
}

// ---------------------------------------------------------------------------
// Seeded deterministic pseudo-random (LCG)
// seed(n) → float in [0, 1)
// ---------------------------------------------------------------------------

const seed = (n: number): number => ((n * 1664525 + 1013904223) >>> 0) / 0xffffffff;

// Derive a repeatable "random" integer in [min, max] using two chained seed calls
const seededInt = (n: number, min: number, max: number): number =>
  min + Math.floor(seed(seed(n) * 0x7fffffff) * (max - min + 1));

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// Anchor: a fixed reference date so renders are stable regardless of when they run.
// "Today" for demo purposes = 2025-09-28 (26 weeks back from ~2026-03-29)
const DEMO_TODAY = new Date('2026-03-29T00:00:00Z');
const DEMO_START = addDays(DEMO_TODAY, -181); // 26 weeks = 182 days (index 0..181)

// ---------------------------------------------------------------------------
// HEATMAP_DAYS — 26-week combined activity (all projects)
// Weekdays get higher counts; weekends get sparse/zero.
// Target: ~847 total sessions across 182 days.
// ---------------------------------------------------------------------------

export const HEATMAP_DAYS: DayEntry[] = (() => {
  const days: DayEntry[] = [];
  for (let i = 0; i < 182; i++) {
    const d = addDays(DEMO_START, i);
    const weekday = d.getUTCDay(); // 0=Sun, 6=Sat
    const isWeekend = weekday === 0 || weekday === 6;
    // base count for weekdays: 3-8; weekends: 0-2
    const base = isWeekend ? seededInt(i * 7, 0, 2) : seededInt(i * 7, 2, 8);
    // occasional burst days (roughly every 2 weeks on weekdays)
    const burst = !isWeekend && seed(i * 13 + 3) > 0.88 ? seededInt(i * 11, 3, 6) : 0;
    days.push({ date: isoDate(d), count: base + burst });
  }
  return days;
})();

// ---------------------------------------------------------------------------
// HEATMAP_BY_PROJECT — per-project view with distinct activity patterns
// ---------------------------------------------------------------------------

// Project-specific day generators
function projectDays(projectIndex: number, activityMultiplier: number): DayEntry[] {
  const days: DayEntry[] = [];
  for (let i = 0; i < 182; i++) {
    const d = addDays(DEMO_START, i);
    const weekday = d.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const pSeed = i * (projectIndex + 1) * 17 + projectIndex * 97;
    // Each project has different active/quiet periods
    const activePhase = seed(pSeed + 5000) > (0.35 + projectIndex * 0.08);
    if (!activePhase) {
      days.push({ date: isoDate(d), count: 0 });
      continue;
    }
    const base = isWeekend ? seededInt(pSeed + 1, 0, 1) : seededInt(pSeed + 2, 1, 3);
    const burst = !isWeekend && seed(pSeed + 9) > 0.9 ? seededInt(pSeed + 3, 2, 4) : 0;
    days.push({ date: isoDate(d), count: Math.round((base + burst) * activityMultiplier) });
  }
  return days;
}

export const HEATMAP_BY_PROJECT: Record<Project, DayEntry[]> = {
  qrec:      projectDays(0, 1.2),
  api:       projectDays(1, 1.0),
  dashboard: projectDays(2, 0.7),
  infra:     projectDays(3, 0.5),
};

// ---------------------------------------------------------------------------
// HEATMAP_BYPROJECT_BREAKDOWN — per-date breakdown by project
// Format: { "2025-01-06": { "qrec": 3, "api": 1 }, ... }
// ---------------------------------------------------------------------------

export const HEATMAP_BYPROJECT_BREAKDOWN: Record<string, Record<string, number>> = (() => {
  const breakdown: Record<string, Record<string, number>> = {};
  for (const project of PROJECTS) {
    for (const entry of HEATMAP_BY_PROJECT[project]) {
      if (entry.count > 0) {
        if (!breakdown[entry.date]) breakdown[entry.date] = {};
        breakdown[entry.date][project] = entry.count;
      }
    }
  }
  return breakdown;
})();

// ---------------------------------------------------------------------------
// SESSIONS — ~12 fully enriched sessions across all projects
// ---------------------------------------------------------------------------

export const SESSIONS: SessionData[] = [
  // ---- qrec (4 sessions) ----
  {
    id: 'c0ffee01',
    title: 'Fixed mtime pre-filter bug in indexer',
    project: 'qrec',
    date: 'Mar 10',
    last_message_at: new Date('2026-03-10T18:42:00Z').getTime(),
    summary:
      'Discovered mtime check compared against wall-clock time instead of indexed_at, causing concurrent writes to miss updates. Fixed by anchoring comparison to the session\'s own indexed_at timestamp.',
    tags: ['bug', 'indexer', 'concurrency'],
    entities: ['indexer.ts', 'mtime', 'indexed_at'],
    learnings: [
      'Always compare file mtime against indexed_at, not wall-clock time — concurrent writes shift the baseline.',
      'Adding a unit test with two near-simultaneous writes caught the regression in under a second.',
    ],
    questions: ['Should we add a grace period to the mtime filter to handle NFS clock skew?'],
    score: 0.892,
  },
  {
    id: 'c0ffee02',
    title: 'Search pipeline: BM25 + KNN + RRF fusion',
    project: 'qrec',
    date: 'Mar 11',
    last_message_at: new Date('2026-03-11T20:15:00Z').getTime(),
    summary:
      'Implemented hybrid retrieval: BM25 via FTS5 for keyword recall, cosine KNN via sqlite-vec for semantic recall, fused with Reciprocal Rank Fusion (k=60). Aggregation uses MAX chunk score per session to avoid verbose-session inflation.',
    tags: ['search', 'embeddings', 'performance', 'sqlite'],
    entities: ['search.ts', 'chunks_fts', 'chunks_vec', 'RRF'],
    learnings: [
      'RRF with k=60 is surprisingly robust — even a single top-10 BM25 hit dramatically lifts relevant sessions.',
      'MAX over SUM for session aggregation prevents long sessions from dominating purely due to chunk volume.',
      'FTS5 must sanitize input; punctuation (dots, slashes) causes hard parse errors, not graceful misses.',
    ],
    score: 0.871,
  },
  {
    id: 'c0ffee03',
    title: 'Embedder singleton + dispose lifecycle',
    project: 'qrec',
    date: 'Mar 12',
    last_message_at: new Date('2026-03-12T14:30:00Z').getTime(),
    summary:
      'Resolved Bun hang-on-exit by always calling disposeEmbedder() before process.exit(). Converted model loading to a lazy singleton with retry so the HTTP server binds before the model finishes loading.',
    tags: ['embeddings', 'lifecycle', 'bun', 'node-llama-cpp'],
    entities: ['embed/local.ts', 'disposeEmbedder', 'Bun.serve'],
    learnings: [
      'Bun hangs forever if node-llama-cpp model is loaded but never disposed on exit.',
      'Server must bind (Bun.serve) before starting model load — health checks need to respond during cold start.',
    ],
    score: 0.814,
  },
  {
    id: 'c0ffee04',
    title: 'Archive JSONL on index for session durability',
    project: 'qrec',
    date: 'Mar 13',
    last_message_at: new Date('2026-03-13T11:00:00Z').getTime(),
    summary:
      'Claude Code deletes old JSONL files after ~30 days. Added archiveJsonl() in indexer.ts to copy each ingested file to ~/.qrec/archive/<project>/ before indexing, ensuring sessions remain queryable after source deletion.',
    tags: ['indexer', 'durability', 'archive'],
    entities: ['indexer.ts', 'archiveJsonl', 'ARCHIVE_DIR'],
    learnings: [
      'JSONL files disappear silently — never assume source files are durable.',
      'Self-copy guard is essential: if source is already inside ARCHIVE_DIR, skip to avoid ENOENT.',
    ],
    score: 0.776,
  },

  // ---- api (4 sessions) ----
  {
    id: 'a1b2c3d4', // IMPORTANT: consistent id for SessionDetail scene
    title: 'Memory leak in long-running Node.js service',
    project: 'api',
    date: 'Feb 20',
    last_message_at: new Date('2026-02-20T22:55:00Z').getTime(),
    summary:
      'Identified a memory leak in the API gateway caused by unbounded event listener accumulation on the request pool. Used Node.js --inspect + Chrome DevTools heap snapshots to pinpoint retained closures from uncancelled timeout chains.',
    tags: ['debugging', 'memory', 'nodejs', 'performance'],
    entities: ['api-gateway.ts', 'EventEmitter', 'heap snapshot', 'setInterval'],
    learnings: [
      'Heap snapshots between requests reveal retained closures invisible in shallow profiling.',
      'EventEmitter listeners added inside request handlers must be explicitly removed — process.on() accumulates silently.',
      'Uncancelled setInterval chains inside async request handlers prevent GC of the entire closure scope.',
    ],
    questions: [
      'Is there a lint rule that flags process.on() without a corresponding removeListener in the same scope?',
    ],
    score: 0.941,
  },
  {
    id: 'a1b2c3d5',
    title: 'Refactor auth middleware for JWT validation',
    project: 'api',
    date: 'Feb 14',
    last_message_at: new Date('2026-02-14T16:20:00Z').getTime(),
    summary:
      'Rewrote the auth middleware to validate JWTs using a JWKS endpoint with key rotation support. Added short-circuit for expired tokens before signature verification to reduce unnecessary crypto work.',
    tags: ['auth', 'jwt', 'security', 'middleware'],
    entities: ['auth-middleware.ts', 'JWKS', 'jsonwebtoken'],
    learnings: [
      'Check token expiry before signature — saves expensive RSA verify on already-expired tokens.',
      'JWKS key rotation requires caching with a TTL, not a hard-coded cert.',
    ],
    score: 0.891,
  },
  {
    id: 'a1b2c3d6',
    title: 'Rate limiting middleware with Redis sliding window',
    project: 'api',
    date: 'Feb 28',
    last_message_at: new Date('2026-02-28T19:10:00Z').getTime(),
    summary:
      'Implemented sliding-window rate limiting using Redis sorted sets (ZADD / ZREMRANGEBYSCORE). Replaced the previous fixed-window approach which allowed 2x burst at window boundaries.',
    tags: ['rate-limiting', 'redis', 'performance', 'middleware'],
    entities: ['rate-limit.ts', 'Redis', 'ZADD', 'ZREMRANGEBYSCORE'],
    learnings: [
      'Fixed-window rate limiting allows up to 2x burst at the window boundary — sliding window closes this gap.',
      'Lua scripts for atomic ZADD + ZREMRANGEBYSCORE prevent race conditions under high concurrency.',
    ],
    score: 0.834,
  },
  {
    id: 'a1b2c3d7',
    title: 'Rewrote auth middleware for compliance',
    project: 'api',
    date: 'Feb 28',
    last_message_at: new Date('2026-02-28T21:30:00Z').getTime(),
    summary:
      'Legal flagged session token storage in localStorage. Rewrote middleware to use httpOnly cookies with CSRF protection. Tokens no longer accessible to client-side JS.',
    tags: ['auth', 'security', 'compliance', 'cookies'],
    entities: ['auth-middleware.ts', 'httpOnly', 'CSRF', 'Set-Cookie'],
    learnings: [
      'httpOnly cookies prevent XSS token theft — localStorage tokens are accessible to any injected script.',
      'CSRF token must be rotated on every auth state change, not just on login.',
    ],
    score: 0.867,
  },

  // ---- dashboard (2 sessions) ----
  {
    id: 'd3e4f5a6',
    title: 'React migration: class components to hooks',
    project: 'dashboard',
    date: 'Mar 05',
    last_message_at: new Date('2026-03-05T17:45:00Z').getTime(),
    summary:
      'Migrated 14 class components to function components with hooks. Replaced componentDidUpdate lifecycle logic with useEffect dependency arrays. Reduced bundle size by 8% due to eliminated React.PureComponent boilerplate.',
    tags: ['react', 'refactor', 'hooks', 'migration'],
    entities: ['DashboardView.tsx', 'useEffect', 'useCallback', 'React.memo'],
    learnings: [
      'useEffect with an empty dependency array is not equivalent to componentDidMount — StrictMode double-invokes effects.',
      'React.memo + useCallback prevents unnecessary re-renders but adds complexity; profile before applying.',
    ],
    score: 0.783,
  },
  {
    id: 'd3e4f5a7',
    title: 'Chart performance: virtual rendering for large datasets',
    project: 'dashboard',
    date: 'Mar 18',
    last_message_at: new Date('2026-03-18T14:00:00Z').getTime(),
    summary:
      'Dashboard chart was rendering 10k data points synchronously on each frame. Added windowed rendering with requestAnimationFrame batching. Time-to-interactive dropped from 3.2s to 340ms.',
    tags: ['performance', 'charts', 'rendering', 'react'],
    entities: ['TimeSeriesChart.tsx', 'requestAnimationFrame', 'canvas'],
    learnings: [
      'Canvas 2D is 10x faster than SVG for >1000 data points due to eliminated DOM overhead.',
      'Batch RAF updates with a dirty flag — multiple state changes in one tick collapse to a single repaint.',
    ],
    score: 0.751,
  },

  // ---- infra (2 sessions) ----
  {
    id: 'f6a7b8c9',
    title: 'CI/CD pipeline: parallel test sharding',
    project: 'infra',
    date: 'Mar 01',
    last_message_at: new Date('2026-03-01T12:30:00Z').getTime(),
    summary:
      'Reduced CI pipeline time from 18 minutes to 4 minutes by sharding tests across 6 parallel runners using GitHub Actions matrix strategy. Added test result aggregation step for unified failure reporting.',
    tags: ['ci-cd', 'github-actions', 'testing', 'performance'],
    entities: ['.github/workflows/ci.yml', 'matrix strategy', 'test sharding'],
    learnings: [
      'Test sharding requires deterministic ordering — random sharding causes flaky splits when tests have shared state.',
      'Aggregating test results from parallel runners needs a separate job with needs: [...all shard jobs].',
    ],
    score: 0.812,
  },
  {
    id: 'f6a7b8ca',
    title: 'Docker layer optimization: 60% image size reduction',
    project: 'infra',
    date: 'Mar 15',
    last_message_at: new Date('2026-03-15T16:00:00Z').getTime(),
    summary:
      'Restructured Dockerfile to maximize layer caching: dependency install before source copy, multi-stage build to exclude dev dependencies. Production image dropped from 1.4GB to 560MB.',
    tags: ['docker', 'optimization', 'infra', 'ci-cd'],
    entities: ['Dockerfile', 'multi-stage build', '.dockerignore'],
    learnings: [
      'COPY package.json before COPY . so npm install layer is only invalidated on dependency changes.',
      'Multi-stage builds must explicitly COPY --from=builder only the files needed at runtime.',
    ],
    score: 0.798,
  },
];

// ---------------------------------------------------------------------------
// SESSIONS_BY_PROJECT
// ---------------------------------------------------------------------------

export const SESSIONS_BY_PROJECT: Record<Project, SessionData[]> = {
  qrec:      SESSIONS.filter((s) => s.project === 'qrec'),
  api:       SESSIONS.filter((s) => s.project === 'api'),
  dashboard: SESSIONS.filter((s) => s.project === 'dashboard'),
  infra:     SESSIONS.filter((s) => s.project === 'infra'),
};

// ---------------------------------------------------------------------------
// ActivityState — timed states for the Indexing scene
// Scene: 11s = 330 frames at 30fps
// ---------------------------------------------------------------------------

export interface ActivityState {
  frame: number; // at which frame to apply this state
  type: 'model_download' | 'model_loading' | 'indexing' | 'enriching' | 'ready';
  progress?: number; // 0–100 for download
  count?: number; // sessions indexed/enriched so far
  total?: number; // total sessions
}

export const ACTIVITY_SEQUENCE: ActivityState[] = [
  // Frames 0–60: model download 0% → 100%
  { frame: 0,   type: 'model_download', progress: 0 },
  { frame: 12,  type: 'model_download', progress: 20 },
  { frame: 24,  type: 'model_download', progress: 42 },
  { frame: 36,  type: 'model_download', progress: 65 },
  { frame: 48,  type: 'model_download', progress: 85 },
  { frame: 58,  type: 'model_download', progress: 100 },
  // Frames 60–90: model loading (indeterminate)
  { frame: 60,  type: 'model_loading' },
  { frame: 75,  type: 'model_loading' },
  // Frames 90–210: indexing 0 → 847 sessions
  { frame: 90,  type: 'indexing', count: 0,   total: 847 },
  { frame: 120, type: 'indexing', count: 141, total: 847 },
  { frame: 150, type: 'indexing', count: 338, total: 847 },
  { frame: 180, type: 'indexing', count: 564, total: 847 },
  { frame: 205, type: 'indexing', count: 847, total: 847 },
  // Frames 210–270: enriching 0 → 847
  { frame: 210, type: 'enriching', count: 0,   total: 847 },
  { frame: 235, type: 'enriching', count: 212, total: 847 },
  { frame: 255, type: 'enriching', count: 523, total: 847 },
  { frame: 268, type: 'enriching', count: 847, total: 847 },
  // Frames 270–330: ready
  { frame: 270, type: 'ready' },
];

// ---------------------------------------------------------------------------
// SearchResult
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  title: string;
  project: Project;
  date: string;
  summary: string;
  tags: string[];
  score: number;
}

// ---------------------------------------------------------------------------
// SEARCH_RESULTS — results for 3 demo queries
// ---------------------------------------------------------------------------

export const SEARCH_RESULTS: Record<string, SearchResult[]> = {
  'memory leak': [
    {
      id: 'a1b2c3d4',
      title: 'Memory leak in long-running Node.js service',
      project: 'api',
      date: 'Feb 20',
      summary:
        'Identified a memory leak caused by unbounded event listener accumulation on the request pool. Heap snapshots pinpointed retained closures from uncancelled timeout chains.',
      tags: ['debugging', 'memory', 'nodejs', 'performance'],
      score: 0.941,
    },
    {
      id: 'a1b2c3d6',
      title: 'Rate limiting middleware with Redis sliding window',
      project: 'api',
      date: 'Feb 28',
      summary:
        'Sliding-window rate limiter using Redis sorted sets. Fixed 2x burst vulnerability at fixed-window boundaries.',
      tags: ['rate-limiting', 'redis', 'performance'],
      score: 0.712,
    },
    {
      id: 'f6a7b8c9',
      title: 'CI/CD pipeline: parallel test sharding',
      project: 'infra',
      date: 'Mar 01',
      summary:
        'Reduced CI time from 18 to 4 minutes. Identified memory pressure in test runners causing OOM failures on large test suites.',
      tags: ['ci-cd', 'testing', 'performance'],
      score: 0.634,
    },
  ],

  'auth bug': [
    {
      id: 'a1b2c3d5',
      title: 'Refactor auth middleware for JWT validation',
      project: 'api',
      date: 'Feb 14',
      summary:
        'Rewrote auth middleware with JWKS endpoint and key rotation support. Short-circuited expired token check before signature verification.',
      tags: ['auth', 'jwt', 'security'],
      score: 0.928,
    },
    {
      id: 'a1b2c3d7',
      title: 'Rewrote auth middleware for compliance',
      project: 'api',
      date: 'Feb 28',
      summary:
        'Migrated from localStorage tokens to httpOnly cookies with CSRF protection after legal compliance review.',
      tags: ['auth', 'security', 'compliance', 'cookies'],
      score: 0.874,
    },
    {
      id: 'a1b2c3d6',
      title: 'Rate limiting middleware with Redis sliding window',
      project: 'api',
      date: 'Feb 28',
      summary:
        'Auth rate limiting path required separate Redis key namespace to avoid collision with general API rate limits.',
      tags: ['rate-limiting', 'redis', 'middleware'],
      score: 0.698,
    },
    {
      id: 'a1b2c3d4',
      title: 'Memory leak in long-running Node.js service',
      project: 'api',
      date: 'Feb 20',
      summary:
        'Auth middleware contributed leaked listeners on token refresh path; fixed alongside main memory leak investigation.',
      tags: ['debugging', 'memory', 'nodejs'],
      score: 0.641,
    },
  ],

  'archive JSONL': [
    {
      id: 'c0ffee04',
      title: 'Archive JSONL on index for session durability',
      project: 'qrec',
      date: 'Mar 13',
      summary: 'Added archiveJsonl() in indexer.ts to copy each JSONL to ~/.qrec/archive/ before indexing.',
      tags: ['indexer', 'durability', 'archive'],
      score: 0.943,
    },
    {
      id: 'c0ffee01',
      title: 'Fixed mtime pre-filter bug in indexer',
      project: 'qrec',
      date: 'Mar 10',
      summary: 'Mtime pre-filter skips unchanged JSONL files; reduces embedding work on cron scans from O(n) to stat-only.',
      tags: ['indexer', 'performance'],
      score: 0.812,
    },
    {
      id: 'c0ffee03',
      title: 'Embedder singleton + dispose lifecycle',
      project: 'qrec',
      date: 'Mar 12',
      summary: 'Lazy singleton model load; disposeEmbedder() required before exit to avoid Bun hang.',
      tags: ['embeddings', 'lifecycle'],
      score: 0.741,
    },
  ],

  'embedding performance': [
    {
      id: 'c0ffee03',
      title: 'Embedder singleton + dispose lifecycle',
      project: 'qrec',
      date: 'Mar 12',
      summary:
        'Lazy singleton model load; server binds before model finishes loading. disposeEmbedder() required before exit to avoid Bun hang.',
      tags: ['embeddings', 'lifecycle', 'performance', 'bun'],
      score: 0.913,
    },
    {
      id: 'c0ffee02',
      title: 'Search pipeline: BM25 + KNN + RRF fusion',
      project: 'qrec',
      date: 'Mar 11',
      summary:
        'Hybrid retrieval fusing FTS5 BM25 and sqlite-vec cosine KNN with RRF. Query embedding cached by SHA-256 hash — warm queries skip embed entirely (~50ms → ~1ms).',
      tags: ['search', 'embeddings', 'performance', 'sqlite'],
      score: 0.887,
    },
    {
      id: 'c0ffee01',
      title: 'Fixed mtime pre-filter bug in indexer',
      project: 'qrec',
      date: 'Mar 10',
      summary:
        'Mtime pre-filter skips unchanged JSONL files; reduces embedding work on cron scans from O(n) to stat-only for unchanged sessions.',
      tags: ['indexer', 'performance', 'embeddings'],
      score: 0.762,
    },
    {
      id: 'c0ffee04',
      title: 'Archive JSONL on index for session durability',
      project: 'qrec',
      date: 'Mar 13',
      summary:
        'Archive copy ensures re-embedding is possible even after source JSONL deletion. Embedding work is idempotent due to hash-based skip logic.',
      tags: ['indexer', 'durability', 'embeddings'],
      score: 0.701,
    },
  ],
};

// ---------------------------------------------------------------------------
// QREC project heatmap — last 30 days animated, older days zeroed out
// (Claude Code only retains ~30 days of JSONL files; older weeks show empty)
// Shared by ProjectFilter and EnrichDetail scenes.
// ---------------------------------------------------------------------------

const _QREC_15W = HEATMAP_BY_PROJECT['qrec'].slice(-105);
const _QREC_30_OFFSET = _QREC_15W.length - 30;

export const QREC_FILTERED_DAYS: DayEntry[] = _QREC_15W.map((d, i) =>
  i >= _QREC_30_OFFSET ? d : {...d, count: 0},
);
export const QREC_SESSION_COUNT = QREC_FILTERED_DAYS.reduce((s, d) => s + d.count, 0);
export const QREC_ACTIVE_DAYS = QREC_FILTERED_DAYS.filter((d) => d.count > 0).length;
