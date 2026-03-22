// src/routes.ts
// HTTP route handlers extracted from server.ts.
// Each handler accepts its dependencies explicitly (db, state, req/url).

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { ServerState } from "./lifecycle.ts";
import { INDEX_INTERVAL_MS } from "./lifecycle.ts";
import { search } from "./search.ts";
import type { SearchFilters } from "./search.ts";
import { logQuery, getAuditEntries } from "./audit.ts";
import { parseSession, renderMarkdown } from "./parser.ts";
import { serverProgress } from "./progress.ts";
import { getRecentActivity } from "./activity.ts";
import { readConfig, writeConfig } from "./config.ts";
import { isEnrichAlive, ENRICHMENT_VERSION } from "./enrich.ts";
import { LOG_FILE, MODEL_CACHE_DIR, getQrecPort, ENRICH_PROGRESS_FILE } from "./dirs.ts";
import { DEFAULT_DB_PATH } from "./db.ts";
import { readFileSync } from "fs";
import { probeGpu } from "./gpu-probe.ts";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// --- Core API ---

export function handleHealth(db: Database): Response {
  const row = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
  return Response.json({
    status: "ok",
    phase: serverProgress.phase,
    indexedSessions: row.count,
  });
}

export function handleStatus(db: Database): Response {
  const sessions = (db.prepare("SELECT COUNT(*) as n FROM sessions").get() as { n: number }).n;
  const chunks = (db.prepare("SELECT COUNT(*) as n FROM chunks").get() as { n: number }).n;
  const lastRow = db.prepare("SELECT MAX(indexed_at) as ts FROM sessions").get() as { ts: number | null };
  const searches = (db.prepare("SELECT COUNT(*) as n FROM query_audit").get() as { n: number }).n;
  const enrichedCount = (db.prepare("SELECT COUNT(*) as n FROM sessions WHERE enriched_at IS NOT NULL AND enrichment_version >= ?").get(ENRICHMENT_VERSION) as { n: number }).n;
  const pendingCount = sessions - enrichedCount;
  return Response.json({
    status: "ok",
    version: typeof __QREC_VERSION__ !== "undefined" ? __QREC_VERSION__ : "(dev)",
    phase: serverProgress.phase,
    sessions,
    chunks,
    lastIndexedAt: lastRow.ts,
    searches,
    embedProvider: process.env.QREC_EMBED_PROVIDER ?? "local",
    embedModel: process.env.QREC_EMBED_PROVIDER === "ollama" ? (process.env.QREC_OLLAMA_MODEL ?? "nomic-embed-text") : process.env.QREC_EMBED_PROVIDER === "openai" ? (process.env.QREC_OPENAI_MODEL ?? "text-embedding-3-small") : "gemma-300M",
    enrichModel: "Qwen3-1.7B",
    modelDownload: serverProgress.modelDownload,
    indexing: serverProgress.indexing,
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    enriching: isEnrichAlive(),
    enrichedCount,
    pendingCount,
    enrichEnabled: readConfig().enrichEnabled,
    enrichProgress: (() => {
      try { return JSON.parse(readFileSync(ENRICH_PROGRESS_FILE, "utf-8")); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.warn("[server] Failed to read enrich progress:", e); return null; }
    })(),
    compute: (() => {
      const p = probeGpu();
      return {
        selectedBackend: p.selectedBackend,
        gpuDetected: p.gpuDetected,
        gpuName: p.gpuName,
        driverVersion: p.driverVersion,
        cudaDriverVersion: p.cudaDriverVersion,
        cudaRuntimeAvailable: p.cudaRuntimeAvailable,
        vulkanAvailable: p.vulkanAvailable,
        missingLibs: p.missingLibs,
        libProbes: p.libProbes,
        activeBinaryName: p.activeBinaryName,
        installSteps: p.installSteps,
        advice: p.advice,
      };
    })(),
  });
}

export function handleProjects(db: Database): Response {
  const rows = db
    .prepare("SELECT project, MAX(date) as last_active FROM sessions WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY last_active DESC")
    .all() as Array<{ project: string }>;
  return Response.json({ projects: rows.map(r => r.project) });
}

export async function handleSearch(db: Database, state: ServerState, req: Request): Promise<Response> {
  if (!state.embedder) {
    return Response.json(
      { error: state.embedderError ?? `Model not ready yet (phase: ${serverProgress.phase})` },
      { status: 503 }
    );
  }

  let body: { query?: string; k?: number; dateFrom?: string; dateTo?: string; project?: string; tag?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return Response.json({ error: "Missing required field: query" }, { status: 400 });
  }

  const k = body.k ?? 10;
  const filters: SearchFilters = {};
  if (body.dateFrom) filters.dateFrom = body.dateFrom;
  if (body.dateTo)   filters.dateTo   = body.dateTo;
  if (body.project)  filters.project  = body.project;
  if (body.tag)      filters.tag      = body.tag;
  const t0 = performance.now();
  try {
    const results = await search(db, state.embedder, query, k, filters);
    const durationMs = performance.now() - t0;
    try { logQuery(db, query, k, results, durationMs); } catch (e) { console.warn("[server] Failed to write audit query:", e); }
    const latencyMs = results[0]?.latency.totalMs ?? 0;
    return Response.json({ results, latencyMs });
  } catch (err) {
    console.error("[server] Search error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function handleQueryDb(db: Database, req: Request): Promise<Response> {
  let body: { sql?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const sql = body.sql?.trim() ?? "";
  if (!sql) return Response.json({ error: "Missing required field: sql" }, { status: 400 });
  if (!sql.toUpperCase().startsWith("SELECT")) return Response.json({ error: "Only SELECT queries are allowed" }, { status: 400 });
  if (sql.includes(";")) return Response.json({ error: "Semicolons are not allowed (no statement stacking)" }, { status: 400 });
  try {
    const rows = db.prepare(sql).all() as Array<Record<string, unknown>>;
    return Response.json({ rows, count: rows.length });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export function handleSettings(): Response {
  return Response.json(readConfig());
}

export async function handleSettingsUpdate(req: Request): Promise<Response> {
  let body: { enrichEnabled?: boolean; enrichIdleMs?: number; indexIntervalMs?: number };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const patch: Parameters<typeof writeConfig>[0] = {};
  if (body.enrichEnabled !== undefined) patch.enrichEnabled = Boolean(body.enrichEnabled);
  if (body.enrichIdleMs !== undefined) {
    const v = body.enrichIdleMs;
    if (!Number.isInteger(v) || v < 60_000 || v > 3_600_000) {
      return Response.json({ error: "enrichIdleMs must be an integer between 60000 and 3600000" }, { status: 400 });
    }
    patch.enrichIdleMs = v;
  }
  if (body.indexIntervalMs !== undefined) {
    const v = body.indexIntervalMs;
    if (!Number.isInteger(v) || v < 10_000 || v > 3_600_000) {
      return Response.json({ error: "indexIntervalMs must be an integer between 10000 and 3600000" }, { status: 400 });
    }
    patch.indexIntervalMs = v;
  }

  const updated = writeConfig(patch);
  return Response.json(updated);
}

// --- Sessions ---

export function handleSessions(db: Database, url: URL): Response {
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "100", 10) || 100));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  // ?date=X is shorthand for dateFrom=X&dateTo=X
  const dateShorthand = url.searchParams.get("date") ?? null;
  const dateFrom = dateShorthand ?? url.searchParams.get("dateFrom") ?? null;
  const dateTo   = dateShorthand ?? url.searchParams.get("dateTo")   ?? null;
  const project  = url.searchParams.get("project") ?? null;
  const tag      = url.searchParams.get("tag")     ?? null;

  const whereClauses: string[] = [];
  const whereParams: SQLQueryBindings[] = [];
  if (dateFrom) { whereClauses.push("date >= ?"); whereParams.push(dateFrom); }
  if (dateTo)   { whereClauses.push("date <= ?"); whereParams.push(dateTo); }
  if (project)  { whereClauses.push("LOWER(project) LIKE '%' || LOWER(?) || '%'"); whereParams.push(project); }
  if (tag)      {
    whereClauses.push("EXISTS (SELECT 1 FROM json_each(tags) WHERE LOWER(json_each.value) LIKE '%' || LOWER(?) || '%')");
    whereParams.push(tag);
  }
  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const rows = db
    .prepare(`SELECT id, title, project, date, indexed_at, last_message_at, summary, tags, entities, learnings, questions FROM sessions ${where} ORDER BY COALESCE(last_message_at, indexed_at) DESC LIMIT ? OFFSET ?`)
    .all(...whereParams, limit, offset) as Array<{
      id: string; title: string | null; project: string; date: string; indexed_at: number; last_message_at: number | null;
      summary: string | null; tags: string | null; entities: string | null; learnings: string | null; questions: string | null;
    }>;
  const total = (db
    .prepare(`SELECT COUNT(*) as count FROM sessions ${where}`)
    .get(...whereParams) as { count: number }).count;
  const sessions = rows.map(r => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) as string[] : null,
    entities: r.entities ? JSON.parse(r.entities) as string[] : null,
    learnings: r.learnings ? JSON.parse(r.learnings) as string[] : null,
    questions: r.questions ? JSON.parse(r.questions) as string[] : null,
  }));
  return Response.json({ sessions, total, offset, limit });
}

// Accept full UUIDs (dfce70c4-274d-4cf0-ba6d-109ad49ee419) → resolve to 8-char id
function resolveSessionId(sessionId: string): string {
  const m = /^([0-9a-f]{8})-[0-9a-f]{4}-/i.exec(sessionId);
  return m ? m[1] : sessionId;
}

export async function handleSessionDetail(db: Database, sessionId: string): Promise<Response> {
  const row = db
    .prepare("SELECT id, title, project, date, path, summary, tags, entities, learnings, questions FROM sessions WHERE id = ?")
    .get(resolveSessionId(sessionId)) as { id: string; title: string | null; project: string; date: string; path: string; summary: string | null; tags: string | null; entities: string | null; learnings: string | null; questions: string | null } | null;
  if (!row) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  try {
    const parsed = await parseSession(row.path);
    return Response.json({
      id: row.id,
      title: row.title,
      project: row.project,
      date: row.date,
      path: row.path,
      summary: row.summary ?? null,
      tags: row.tags ? JSON.parse(row.tags) as string[] : null,
      entities: row.entities ? JSON.parse(row.entities) as string[] : null,
      learnings: row.learnings ? JSON.parse(row.learnings) as string[] : null,
      questions: row.questions ? JSON.parse(row.questions) as string[] : null,
      turns: parsed.turns,
    });
  } catch (err) {
    console.error("[server] Failed to parse session:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function handleSessionMarkdown(db: Database, sessionId: string): Promise<Response> {
  const row = db
    .prepare("SELECT path, summary, tags, entities FROM sessions WHERE id = ?")
    .get(resolveSessionId(sessionId)) as { path: string; summary: string | null; tags: string | null; entities: string | null } | null;
  if (!row) {
    return new Response("Session not found", { status: 404 });
  }
  try {
    const parsed = await parseSession(row.path);
    let md = renderMarkdown(parsed);
    if (row.summary) {
      const tagsArr: string[] = row.tags ? JSON.parse(row.tags) as string[] : [];
      const entitiesArr: string[] = row.entities ? JSON.parse(row.entities) as string[] : [];
      const header = [
        "## Summary",
        "",
        row.summary,
        "",
        tagsArr.length > 0 ? `**Tags:** ${tagsArr.join(", ")}` : "",
        entitiesArr.length > 0 ? `**Entities:** ${entitiesArr.join(", ")}` : "",
        "",
        "---",
        "",
      ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
      md = header + md;
    }
    return new Response(md, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    console.error("[server] Failed to render session markdown:", err);
    return new Response(String(err), { status: 500 });
  }
}

// --- Stats ---

export function handleHeatmap(db: Database, url: URL): Response {
  const weeks = Math.min(52, Math.max(4, parseInt(url.searchParams.get("weeks") ?? "15", 10) || 15));
  const metric = url.searchParams.get("metric") ?? "sessions";
  const project = url.searchParams.get("project") ?? null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7 + 1);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffStr = localDateStr(cutoff);

  const projectClause = project ? " AND project = ?" : "";
  const args = project ? [cutoffStr, project] : [cutoffStr];

  let rows: Array<{ date: string; count: number }>;
  if (metric === "hours") {
    rows = db
      .prepare(`SELECT date, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ?${projectClause} GROUP BY date ORDER BY date ASC`)
      .all(...args) as Array<{ date: string; count: number }>;
  } else {
    rows = db
      .prepare(`SELECT date, COUNT(*) as count FROM sessions WHERE date >= ?${projectClause} GROUP BY date ORDER BY date ASC`)
      .all(...args) as Array<{ date: string; count: number }>;
  }

  const byDate = new Map(rows.map(r => [r.date, r.count]));
  const days: Array<{ date: string; count: number }> = [];
  const cur = new Date(cutoff);
  const today = new Date();
  while (localDateStr(cur) <= localDateStr(today)) {
    const d = localDateStr(cur);
    days.push({ date: d, count: byDate.get(d) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  let byProject: Record<string, Record<string, number>> = {};
  if (!project) {
    let projectRows: Array<{ date: string; project: string; count: number }>;
    if (metric === "hours") {
      projectRows = db
        .prepare(`SELECT date, project, ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC`)
        .all(cutoffStr) as Array<{ date: string; project: string; count: number }>;
    } else {
      projectRows = db
        .prepare(`SELECT date, project, COUNT(*) as count FROM sessions WHERE date >= ? AND project IS NOT NULL AND project != '' GROUP BY date, project ORDER BY date, count DESC`)
        .all(cutoffStr) as Array<{ date: string; project: string; count: number }>;
    }
    for (const row of projectRows) {
      if (!byProject[row.date]) byProject[row.date] = {};
      byProject[row.date][row.project] = row.count;
    }
  }

  return Response.json({
    days,
    metric,
    total: rows.reduce((s, r) => s + r.count, 0),
    active_days: rows.filter(r => r.count > 0).length,
    byProject,
  });
}

// --- Observability ---

export function handleAuditEntries(db: Database, url: URL): Response {
  const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
  try {
    const entries = getAuditEntries(db, limit);
    return Response.json({ entries });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export function handleActivityEntries(url: URL): Response {
  const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
  const entries = getRecentActivity(limit);
  return Response.json({ entries });
}

export function handleDebugLog(url: URL): Response {
  const limit = parseInt(url.searchParams.get("lines") ?? "100", 10);
  try {
    const content = readFileSync(LOG_FILE, "utf-8");
    const lines = content.split("\n").filter(l => l.length > 0).slice(-limit);
    return Response.json({ lines });
  } catch {
    return Response.json({ lines: [] });
  }
}

export function handleDebugConfig(): Response {
  return Response.json({
    dbPath: DEFAULT_DB_PATH,
    logPath: LOG_FILE,
    modelCachePath: MODEL_CACHE_DIR,
    embedProvider: process.env.QREC_EMBED_PROVIDER ?? "local",
    ollamaHost: process.env.QREC_OLLAMA_HOST ?? null,
    ollamaModel: process.env.QREC_OLLAMA_MODEL ?? null,
    openaiBaseUrl: process.env.QREC_OPENAI_BASE_URL ?? null,
    indexIntervalMs: INDEX_INTERVAL_MS,
    port: getQrecPort(),
    platform: process.platform,
    bunVersion: process.versions.bun ?? null,
    nodeVersion: process.version,
  });
}
