// src/server.ts
// HTTP server: POST /search, GET /health, GET /status, GET /sessions,
// GET /audit/entries, GET /activity/entries, GET /debug/log, GET /debug/config

import { openDb, DEFAULT_DB_PATH } from "./db.ts";
import { getEmbedProvider } from "./embed/factory.ts";
import type { EmbedProvider } from "./embed/provider.ts";
import { search } from "./search.ts";
import { logQuery, getAuditEntries } from "./audit.ts";
import { indexVault, embedSummaryChunks } from "./indexer.ts";
import { parseSession, renderMarkdown } from "./parser.ts";
import { serverProgress } from "./progress.ts";
import { appendActivity, getRecentActivity } from "./activity.ts";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { LOG_FILE, MODEL_CACHE_DIR, QREC_PORT, ENRICH_PROGRESS_FILE } from "./dirs.ts";
import { isEnrichAlive, readEnrichPid, isProcessAlive, ENRICHMENT_VERSION } from "./enrich.ts";
import { readConfig, writeConfig } from "./config.ts";

const PORT = QREC_PORT;
const DEFAULT_VAULT_PATH = process.env.QREC_PROJECTS_DIR ?? join(homedir(), ".claude", "projects");

// Default cron interval: 1 minute. Override with QREC_INDEX_INTERVAL_MS.
const INDEX_INTERVAL_MS = parseInt(process.env.QREC_INDEX_INTERVAL_MS ?? "60000", 10);
// Only enrich sessions whose last message is older than this (skip in-flight sessions).
const ENRICH_IDLE_MS = parseInt(process.env.QREC_ENRICH_IDLE_MS ?? String(5 * 60 * 1000), 10);


// In the compiled CJS bundle, __UI_HTML__ is injected by esbuild at build time.
// In Bun dev mode the constant is undefined, so we fall back to reading from disk (live reload).
declare const __UI_HTML__: string | undefined;

const UI_HTML_INLINE: string | null = typeof __UI_HTML__ !== "undefined" ? __UI_HTML__ : null;
const _metaDir = (import.meta as { dir?: string }).dir;
const UI_DIR = _metaDir
  ? join(_metaDir, "..", "ui")            // dev: src/ → ui/
  : join(__dirname, "..", "..", "ui");    // CJS: plugin/scripts/ → ui/
const UI_HTML_PATH = join(UI_DIR, "index.html");

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function serveUiHtml(): Promise<Response> {
  if (UI_HTML_INLINE !== null) {
    return new Response(UI_HTML_INLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  // Dev mode: read fresh from disk on every request so browser refresh picks up changes
  if (!existsSync(UI_HTML_PATH)) {
    return Response.json({ error: "UI not found" }, { status: 404 });
  }
  const content = await Bun.file(UI_HTML_PATH).text();
  return new Response(content, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function serveStaticFile(pathname: string): Promise<Response> {
  const rel = pathname.slice("/ui/".length);
  if (rel.includes("..") || rel.startsWith("/")) {
    return new Response("Forbidden", { status: 403 });
  }
  const filePath = join(UI_DIR, rel);
  const file = Bun.file(filePath);
  if (!await file.exists()) {
    return new Response("Not found", { status: 404 });
  }
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  const contentType =
    ext === "css"   ? "text/css; charset=utf-8" :
    ext === "js"    ? "text/javascript; charset=utf-8" :
    ext === "woff2" ? "font/woff2" :
    ext === "woff"  ? "font/woff" :
    ext === "ttf"   ? "font/ttf" :
    "application/octet-stream";
  return new Response(file, { headers: {
    "Content-Type": contentType,
    "Cache-Control": "no-cache, no-store, must-revalidate",
  } });
}

async function main() {
  console.log("[server] Starting qrec server...");

  const db = openDb();

  let embedder: EmbedProvider | null = null;
  let embedderError: string | null = null;
  let isIndexing = false;

  function getIndexedSessionCount(): number {
    const row = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
    return row.count;
  }

  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "GET" && url.pathname === "/health") {
        return Response.json({
          status: "ok",
          phase: serverProgress.phase,
          indexedSessions: getIndexedSessionCount(),
        });
      }

      if (req.method === "GET" && url.pathname === "/status") {
        const sessions = (db.prepare("SELECT COUNT(*) as n FROM sessions").get() as { n: number }).n;
        const chunks = (db.prepare("SELECT COUNT(*) as n FROM chunks").get() as { n: number }).n;
        const lastRow = db.prepare("SELECT MAX(indexed_at) as ts FROM sessions").get() as { ts: number | null };
        const searches = (db.prepare("SELECT COUNT(*) as n FROM query_audit").get() as { n: number }).n;
        const enrichedCount = (db.prepare("SELECT COUNT(*) as n FROM sessions WHERE enriched_at IS NOT NULL AND enrichment_version >= ?").get(ENRICHMENT_VERSION) as { n: number }).n;
        const pendingCount = sessions - enrichedCount;
        return Response.json({
          status: "ok",
          phase: serverProgress.phase,
          sessions,
          chunks,
          lastIndexedAt: lastRow.ts,
          searches,
          embedProvider: process.env.QREC_EMBED_PROVIDER ?? "local",
          modelDownload: serverProgress.modelDownload,
          indexing: serverProgress.indexing,
          memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
          enriching: isEnrichAlive(),
          enrichedCount,
          pendingCount,
          enrichEnabled: readConfig().enrichEnabled,
          enrichProgress: (() => {
            try { return existsSync(ENRICH_PROGRESS_FILE) ? JSON.parse(readFileSync(ENRICH_PROGRESS_FILE, "utf-8")) : null; } catch { return null; }
          })(),
        });
      }

      if (req.method === "GET" && url.pathname === "/projects") {
        const rows = db
          .prepare("SELECT project, MAX(date) as last_active FROM sessions WHERE project IS NOT NULL AND project != '' GROUP BY project ORDER BY last_active DESC")
          .all() as Array<{ project: string }>;
        return Response.json({ projects: rows.map(r => r.project) });
      }

      if (req.method === "GET" && url.pathname === "/stats/heatmap") {
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
          // default: sessions
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
        // Per-project breakdown (only when not filtered — redundant when already filtered to one project)
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

      if (req.method === "GET" && url.pathname === "/sessions") {
        const limit = 100;
        const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
        const dateFilter = url.searchParams.get("date") ?? null;
        const rows = (dateFilter
          ? db.prepare("SELECT id, title, project, date, indexed_at, summary, tags, entities, learnings, questions FROM sessions WHERE date = ? ORDER BY indexed_at DESC LIMIT ? OFFSET ?")
              .all(dateFilter, limit, offset)
          : db.prepare("SELECT id, title, project, date, indexed_at, summary, tags, entities, learnings, questions FROM sessions ORDER BY date DESC, indexed_at DESC LIMIT ? OFFSET ?")
              .all(limit, offset)) as Array<{
            id: string; title: string | null; project: string; date: string; indexed_at: number;
            summary: string | null; tags: string | null; entities: string | null; learnings: string | null; questions: string | null;
          }>;
        const total = dateFilter
          ? (db.prepare("SELECT COUNT(*) as count FROM sessions WHERE date = ?").get(dateFilter) as { count: number }).count
          : (db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number }).count;
        const sessions = rows.map(r => ({
          ...r,
          tags: r.tags ? JSON.parse(r.tags) as string[] : null,
          entities: r.entities ? JSON.parse(r.entities) as string[] : null,
          learnings: r.learnings ? JSON.parse(r.learnings) as string[] : null,
          questions: r.questions ? JSON.parse(r.questions) as string[] : null,
        }));
        return Response.json({ sessions, total, offset, limit });
      }

      if (req.method === "GET" && url.pathname.startsWith("/sessions/") && url.pathname.endsWith("/markdown")) {
        const id = url.pathname.slice("/sessions/".length, -"/markdown".length);
        if (!id) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        const row = db
          .prepare("SELECT path, summary, tags, entities FROM sessions WHERE id = ?")
          .get(id) as { path: string; summary: string | null; tags: string | null; entities: string | null } | null;
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

      if (req.method === "GET" && url.pathname.startsWith("/sessions/")) {
        const id = url.pathname.slice("/sessions/".length);
        if (!id || id.includes("/")) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        const row = db
          .prepare("SELECT id, title, project, date, path, summary, tags, entities, learnings, questions FROM sessions WHERE id = ?")
          .get(id) as { id: string; title: string | null; project: string; date: string; path: string; summary: string | null; tags: string | null; entities: string | null; learnings: string | null; questions: string | null } | null;
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

      if (req.method === "POST" && url.pathname === "/search") {
        if (!embedder) {
          return Response.json(
            { error: embedderError ?? `Model not ready yet (phase: ${serverProgress.phase})` },
            { status: 503 }
          );
        }

        let body: { query?: string; k?: number };
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
        const t0 = performance.now();
        try {
          const results = await search(db, embedder, query, k);
          const durationMs = performance.now() - t0;
          try { logQuery(db, query, k, results, durationMs); } catch {}
          const latencyMs = results[0]?.latency.totalMs ?? 0;
          return Response.json({ results, latencyMs });
        } catch (err) {
          console.error("[server] Search error:", err);
          return Response.json({ error: String(err) }, { status: 500 });
        }
      }

      if (req.method === "POST" && url.pathname === "/query_db") {
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

      if (req.method === "GET" && url.pathname === "/settings") {
        return Response.json(readConfig());
      }

      if (req.method === "POST" && url.pathname === "/settings") {
        let body: { enrichEnabled?: boolean };
        try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
        const updated = writeConfig({ enrichEnabled: body.enrichEnabled });
        return Response.json(updated);
      }

      if (req.method === "GET" && url.pathname === "/audit/entries") {
        const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
        try {
          const entries = getAuditEntries(db, limit);
          return Response.json({ entries });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      }

      if (req.method === "GET" && url.pathname === "/activity/entries") {
        const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
        const entries = getRecentActivity(limit);
        return Response.json({ entries });
      }

      // Serve static UI assets (CSS, JS, fonts)
      if (req.method === "GET" && url.pathname.startsWith("/ui/")) {
        return serveStaticFile(url.pathname);
      }

      // Serve SPA for all UI routes
      if (req.method === "GET" && (
        url.pathname === "/" ||
        url.pathname === "/search" ||
        url.pathname === "/audit" ||
        url.pathname === "/debug"
      )) {
        return serveUiHtml();
      }

      if (req.method === "GET" && url.pathname === "/debug/log") {
        const logPath = LOG_FILE;
        const limit = parseInt(url.searchParams.get("lines") ?? "100", 10);
        try {
          const content = readFileSync(logPath, "utf-8");
          const lines = content.split("\n").filter(l => l.length > 0).slice(-limit);
          return Response.json({ lines });
        } catch {
          return Response.json({ lines: [] });
        }
      }

      if (req.method === "GET" && url.pathname === "/debug/config") {
        return Response.json({
          dbPath: DEFAULT_DB_PATH,
          logPath: LOG_FILE,
          modelCachePath: MODEL_CACHE_DIR,
          embedProvider: process.env.QREC_EMBED_PROVIDER ?? "local",
          ollamaHost: process.env.QREC_OLLAMA_HOST ?? null,
          ollamaModel: process.env.QREC_OLLAMA_MODEL ?? null,
          openaiBaseUrl: process.env.QREC_OPENAI_BASE_URL ?? null,
          indexIntervalMs: INDEX_INTERVAL_MS,
          port: PORT,
          platform: process.platform,
          bunVersion: process.versions.bun ?? null,
          nodeVersion: process.version,
        });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });

  console.log(`[server] Listening on http://localhost:${PORT}`);

  appendActivity({ type: "daemon_started" });

  // Spawn qrec enrich as a detached child (non-blocking). PID-guarded to prevent double-spawn.
  // Passes --min-age-ms so enrich only picks up sessions indexed > ENRICH_IDLE_MS ago.
  function spawnEnrichIfNeeded(): void {
    if (!readConfig().enrichEnabled) return;
    const pid = readEnrichPid();
    if (pid !== null && isProcessAlive(pid)) {
      console.log("[server] Enrich child already running, skipping spawn.");
      return;
    }
    const logFile = LOG_FILE;
    const baseArgs: string[] =
      typeof (import.meta as { dir?: string }).dir === "string"
        ? ["bun", "run", join((import.meta as { dir: string }).dir, "cli.ts"), "enrich"]
        : [process.argv[0], process.argv[1], "enrich"];
    const child = Bun.spawn([...baseArgs, "--min-age-ms", String(ENRICH_IDLE_MS)], {
      detached: true,
      stdio: ["ignore", Bun.file(logFile), Bun.file(logFile)],
    });
    child.unref();
    console.log(`[server] Spawned enrich child (PID ${child.pid})`);
  }

  // Run an incremental index scan (fast — mtime pre-filter skips unchanged files).
  // isInitialRun=true: sets phase="indexing" so the onboarding UI can show progress.
  // isInitialRun=false (cron): keeps phase="ready" so the dashboard doesn't revert to onboarding.
  async function runIncrementalIndex(isInitialRun = false) {
    if (isIndexing || !existsSync(DEFAULT_VAULT_PATH)) return;
    isIndexing = true;
    const t0 = Date.now();
    appendActivity({ type: "index_started" });
    if (isInitialRun) serverProgress.phase = "indexing";
    serverProgress.indexing = { indexed: 0, total: 0, current: "" };

    let newSessions = 0;
    let prevIndexed = 0;

    try {
      await indexVault(db, DEFAULT_VAULT_PATH, {}, (indexed, total, current) => {
        serverProgress.indexing = { indexed, total, current };
        if (current && indexed > prevIndexed) {
          appendActivity({ type: "session_indexed", data: { sessionId: current } });
          newSessions++;
          prevIndexed = indexed;
        }
      });
      appendActivity({ type: "index_complete", data: { newSessions, durationMs: Date.now() - t0 } });
      // Embed any summary chunks (seq=-1) not yet in chunks_vec.
      // Enrich child writes summary chunks then exits; the next cron tick picks them up here.
      if (embedder) await embedSummaryChunks(db, embedder);
    } catch (err) {
      console.error("[server] Index error:", err);
    } finally {
      isIndexing = false;
      if (isInitialRun) serverProgress.phase = "ready";
    }
  }

  // Load embedder in background; /search returns 503 until ready.
  async function loadEmbedderWithRetry(maxAttempts = 10, delayMs = 30_000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        serverProgress.phase = "model_loading";
        embedder = await getEmbedProvider();
        embedderError = null;
        console.log("[server] Model ready");

        // Immediate catchup scan on startup (shows indexing progress in onboarding UI)
        await runIncrementalIndex(true);

        serverProgress.phase = "ready";

        // Kick off enrich immediately after startup index (old sessions already past the age gate).
        spawnEnrichIfNeeded();

        // Schedule periodic incremental scans and enrich runs (both every 1 minute).
        setInterval(runIncrementalIndex, INDEX_INTERVAL_MS);
        setInterval(spawnEnrichIfNeeded, INDEX_INTERVAL_MS);

        return;
      } catch (err) {
        embedderError = String(err);
        console.error(`[server] Model load failed (attempt ${attempt}/${maxAttempts}):`, err);
        if (attempt < maxAttempts) {
          console.log(`[server] Retrying in ${delayMs / 1000}s...`);
          await Bun.sleep(delayMs);
        }
      }
    }
    console.error("[server] Model load gave up after all retries.");
    serverProgress.phase = "ready";
  }
  loadEmbedderWithRetry();

  process.on("SIGTERM", () => {
    console.log("[server] SIGTERM received, shutting down...");
    db.close();
    server.stop();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("[server] SIGINT received, shutting down...");
    db.close();
    server.stop();
    process.exit(0);
  });
}

main().catch(err => {
  console.error("[server] Fatal error:", err);
  process.exit(1);
});
