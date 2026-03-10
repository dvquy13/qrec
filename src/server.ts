// src/server.ts
// HTTP server: POST /search, GET /health, GET /sessions, GET /audit/entries, GET /, GET /audit

import { openDb } from "./db.ts";
import { getEmbedProvider } from "./embed/factory.ts";
import type { EmbedProvider } from "./embed/provider.ts";
import { search } from "./search.ts";
import { logQuery, getAuditEntries } from "./audit.ts";
import { join } from "path";
import { existsSync } from "fs";

const PORT = 3030;
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

      // Health check — always 200, model state surfaced in body
      if (req.method === "GET" && url.pathname === "/health") {
        return Response.json({
          status: "ok",
          model: embedder ? "loaded" : embedderError ? "error" : "loading",
          indexedSessions: getIndexedSessionCount(),
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
            { error: embedderError ?? "Model is still loading, please retry shortly" },
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
          // Audit log (non-blocking, errors silently ignored)
          try {
            logQuery(db, query, k, results, durationMs);
          } catch {
            // Audit log failure must not affect search response
          }
          const latencyMs = results[0]?.latency.totalMs ?? 0;
          return Response.json({ results, latencyMs });
        } catch (err) {
          console.error("[server] Search error:", err);
          return Response.json(
            { error: String(err) },
            { status: 500 }
          );
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

      // Serve search UI
      if (req.method === "GET" && url.pathname === "/") {
        return serveFile(join(UI_DIR, "search.html"), "text/html; charset=utf-8");
      }

      // Serve audit UI
      if (req.method === "GET" && url.pathname === "/audit") {
        return serveFile(join(UI_DIR, "audit.html"), "text/html; charset=utf-8");
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });

  console.log(`[server] Listening on http://localhost:${PORT}`);

  // Load embedder in background — /search serves 503 until this resolves
  getEmbedProvider()
    .then(e => {
      embedder = e;
      console.log("[server] Model ready");
    })
    .catch(err => {
      embedderError = String(err);
      console.error("[server] Model load failed:", err);
    });

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
