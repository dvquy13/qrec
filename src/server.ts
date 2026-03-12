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
import { isEnrichAlive, readEnrichPid, isProcessAlive, ENRICHMENT_VERSION } from "./enrich.ts";
import { readConfig, writeConfig } from "./config.ts";

const PORT = 25927;
const DEFAULT_VAULT_PATH = join(homedir(), ".claude", "projects");

// Default cron interval: 1 minute. Override with QREC_INDEX_INTERVAL_MS.
const INDEX_INTERVAL_MS = parseInt(process.env.QREC_INDEX_INTERVAL_MS ?? "60000", 10);


// In the compiled CJS bundle, __UI_HTML__ is injected by esbuild at build time.
// In Bun dev mode the constant is undefined, so we fall back to reading from disk (live reload).
declare const __UI_HTML__: string | undefined;

const UI_HTML_INLINE: string | null = typeof __UI_HTML__ !== "undefined" ? __UI_HTML__ : null;
const UI_HTML_PATH = join((import.meta as { dir?: string }).dir ?? __dirname, "..", "ui", "index.html");

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
        });
      }

      if (req.method === "GET" && url.pathname === "/sessions") {
        const rows = db
          .prepare("SELECT id, title, project, date, indexed_at, summary, tags, entities FROM sessions ORDER BY date DESC, indexed_at DESC LIMIT 100")
          .all() as Array<{
            id: string; title: string | null; project: string; date: string; indexed_at: number;
            summary: string | null; tags: string | null; entities: string | null;
          }>;
        const total = (db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number }).count;
        const sessions = rows.map(r => ({
          ...r,
          tags: r.tags ? JSON.parse(r.tags) as string[] : null,
          entities: r.entities ? JSON.parse(r.entities) as string[] : null,
        }));
        return Response.json({ sessions, total });
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
          .prepare("SELECT id, title, project, date, path, summary, tags, entities FROM sessions WHERE id = ?")
          .get(id) as { id: string; title: string | null; project: string; date: string; path: string; summary: string | null; tags: string | null; entities: string | null } | null;
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
        const logPath = join(homedir(), ".qrec", "qrec.log");
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
          logPath: join(homedir(), ".qrec", "qrec.log"),
          modelCachePath: join(homedir(), ".qrec", "models"),
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
  function spawnEnrichIfNeeded(): void {
    if (!readConfig().enrichEnabled) return;
    const pid = readEnrichPid();
    if (pid !== null && isProcessAlive(pid)) {
      console.log("[server] Enrich child already running, skipping spawn.");
      return;
    }
    const logFile = join(homedir(), ".qrec", "qrec.log");
    const spawnArgs: string[] =
      typeof (import.meta as { dir?: string }).dir === "string"
        ? ["bun", "run", join((import.meta as { dir: string }).dir, "cli.ts"), "enrich"]
        : [process.argv[0], process.argv[1], "enrich"];
    const child = Bun.spawn(spawnArgs, {
      detached: true,
      stdio: ["ignore", Bun.file(logFile), Bun.file(logFile)],
    });
    child.unref();
    console.log(`[server] Spawned enrich child (PID ${child.pid})`);
  }

  // Run an incremental index scan (fast — mtime pre-filter skips unchanged files).
  async function runIncrementalIndex() {
    if (isIndexing || !existsSync(DEFAULT_VAULT_PATH)) return;
    isIndexing = true;
    const t0 = Date.now();
    appendActivity({ type: "index_started" });
    serverProgress.phase = "indexing";
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
      spawnEnrichIfNeeded();
      // Embed any summary chunks (seq=-1) not yet in chunks_vec.
      // Enrich child writes summary chunks then exits; the next cron tick picks them up here.
      if (embedder) await embedSummaryChunks(db, embedder);
    } catch (err) {
      console.error("[server] Index error:", err);
    } finally {
      isIndexing = false;
      serverProgress.phase = "ready";
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

        // Immediate catchup scan on startup
        await runIncrementalIndex();

        serverProgress.phase = "ready";

        // Schedule periodic incremental scans
        setInterval(runIncrementalIndex, INDEX_INTERVAL_MS);

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
