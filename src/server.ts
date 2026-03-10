// src/server.ts
// HTTP server: POST /search, GET /health, GET /status, GET /sessions,
// GET /audit/entries, GET /activity/entries, GET /debug/log, GET /debug/config

import { openDb, DEFAULT_DB_PATH } from "./db.ts";
import { getEmbedProvider } from "./embed/factory.ts";
import type { EmbedProvider } from "./embed/provider.ts";
import { search } from "./search.ts";
import { logQuery, getAuditEntries } from "./audit.ts";
import { indexVault } from "./indexer.ts";
import { serverProgress } from "./progress.ts";
import { appendActivity, getRecentActivity } from "./activity.ts";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";

const PORT = 3030;
const DEFAULT_VAULT_PATH = join(homedir(), ".claude", "projects");

// Default cron interval: 1 minute. Override with QREC_INDEX_INTERVAL_MS.
const INDEX_INTERVAL_MS = parseInt(process.env.QREC_INDEX_INTERVAL_MS ?? "60000", 10);

// Resolve UI dir: works in both Bun ESM (dev) and compiled CJS bundle (plugin).
const UI_DIR =
  typeof (import.meta as { dir?: string }).dir === "string"
    ? join((import.meta as { dir: string }).dir, "..", "ui")
    : join(__dirname, "..", "ui");

async function serveFile(filePath: string, contentType: string): Promise<Response> {
  if (!existsSync(filePath)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const content = await Bun.file(filePath).text();
  return new Response(content, { headers: { "Content-Type": contentType } });
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
        });
      }

      if (req.method === "GET" && url.pathname === "/sessions") {
        const rows = db.prepare("SELECT id FROM sessions").all() as Array<{ id: string }>;
        return Response.json({ sessions: rows.map(r => r.id) });
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
        return serveFile(join(UI_DIR, "index.html"), "text/html; charset=utf-8");
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
