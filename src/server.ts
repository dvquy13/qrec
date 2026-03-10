// src/server.ts
// HTTP server: POST /search, GET /health, GET /sessions, GET /audit/entries, GET /, GET /audit

import { openDb, DEFAULT_DB_PATH } from "./db.ts";
import { getEmbedProvider } from "./embed/factory.ts";
import type { EmbedProvider } from "./embed/provider.ts";
import { search } from "./search.ts";
import { logQuery, getAuditEntries } from "./audit.ts";
import { indexVault } from "./indexer.ts";
import { serverProgress } from "./progress.ts";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";

const PORT = 3030;
const DEFAULT_VAULT_PATH = join(homedir(), ".claude", "projects");

// Resolve UI dir: works in both Bun ESM (dev) and compiled CJS bundle (plugin).
// In CJS, import.meta.dir is undefined — fall back to __dirname which is adjacent to ui/ in the bundle layout.
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

  // Embedder loads in background — server binds immediately.
  // /search returns 503 until ready; /health responds instantly.
  let embedder: EmbedProvider | null = null;
  let embedderError: string | null = null;

  function getIndexedSessionCount(): number {
    const row = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
    return row.count;
  }

  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);

      // Health check — always 200 once server is bound
      if (req.method === "GET" && url.pathname === "/health") {
        return Response.json({
          status: "ok",
          phase: serverProgress.phase,
          indexedSessions: getIndexedSessionCount(),
        });
      }

      // Status (richer than /health)
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

      // List sessions
      if (req.method === "GET" && url.pathname === "/sessions") {
        const rows = db.prepare("SELECT id FROM sessions").all() as Array<{ id: string }>;
        return Response.json({ sessions: rows.map(r => r.id) });
      }

      // Search — 503 until embedder is ready
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
          try {
            logQuery(db, query, k, results, durationMs);
          } catch {
            // Audit log failure must not affect search response
          }
          const latencyMs = results[0]?.latency.totalMs ?? 0;
          return Response.json({ results, latencyMs });
        } catch (err) {
          console.error("[server] Search error:", err);
          return Response.json({ error: String(err) }, { status: 500 });
        }
      }

      // Audit entries
      if (req.method === "GET" && url.pathname === "/audit/entries") {
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 100;
        try {
          const entries = getAuditEntries(db, limit);
          return Response.json({ entries });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      }

      // Serve dashboard (control center)
      if (req.method === "GET" && url.pathname === "/") {
        return serveFile(join(UI_DIR, "dashboard.html"), "text/html; charset=utf-8");
      }

      // Serve search UI
      if (req.method === "GET" && url.pathname === "/search") {
        return serveFile(join(UI_DIR, "search.html"), "text/html; charset=utf-8");
      }

      // Serve audit UI
      if (req.method === "GET" && url.pathname === "/audit") {
        return serveFile(join(UI_DIR, "audit.html"), "text/html; charset=utf-8");
      }

      // Serve debug UI
      if (req.method === "GET" && url.pathname === "/debug") {
        return serveFile(join(UI_DIR, "debug.html"), "text/html; charset=utf-8");
      }

      // Debug: log tail
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

      // Debug: config/env info
      if (req.method === "GET" && url.pathname === "/debug/config") {
        return Response.json({
          dbPath: DEFAULT_DB_PATH,
          logPath: join(homedir(), ".qrec", "qrec.log"),
          modelCachePath: join(homedir(), ".cache", "qmd", "models"),
          embedProvider: process.env.QREC_EMBED_PROVIDER ?? "local",
          ollamaHost: process.env.QREC_OLLAMA_HOST ?? null,
          ollamaModel: process.env.QREC_OLLAMA_MODEL ?? null,
          openaiBaseUrl: process.env.QREC_OPENAI_BASE_URL ?? null,
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

  // Load embedder in background — /search serves 503 until this resolves.
  // Retries up to 10 times (5 min total) to handle background bun install on first run.
  async function loadEmbedderWithRetry(maxAttempts = 10, delayMs = 30_000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        serverProgress.phase = "model_loading";
        embedder = await getEmbedProvider();
        embedderError = null;
        console.log("[server] Model ready");

        // Auto-index on first run (no sessions in DB)
        if (getIndexedSessionCount() === 0 && existsSync(DEFAULT_VAULT_PATH)) {
          console.log("[server] No sessions indexed — starting auto-index of", DEFAULT_VAULT_PATH);
          serverProgress.phase = "indexing";
          serverProgress.indexing = { indexed: 0, total: 0, current: "" };
          await indexVault(db, DEFAULT_VAULT_PATH, {}, (indexed, total, current) => {
            serverProgress.indexing = { indexed, total, current };
          });
          console.log("[server] Auto-index complete");
        }

        serverProgress.phase = "ready";
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

  // Handle graceful shutdown
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
