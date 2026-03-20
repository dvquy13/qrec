// src/server.ts
// HTTP server: thin router dispatching to routes.ts; lifecycle via lifecycle.ts.

import { openDb } from "./db.ts";
import { getQrecPort } from "./dirs.ts";
import { appendActivity } from "./activity.ts";
import { existsSync } from "fs";
import { join } from "path";
import type { ServerState } from "./lifecycle.ts";
import { loadEmbedderWithRetry } from "./lifecycle.ts";
import {
  handleHealth, handleStatus, handleProjects, handleHeatmap,
  handleSessions, handleSessionDetail, handleSessionMarkdown,
  handleSearch, handleQueryDb, handleSettings, handleSettingsUpdate,
  handleAuditEntries, handleActivityEntries, handleDebugLog, handleDebugConfig,
} from "./routes.ts";

const PORT = getQrecPort();

// In the compiled CJS bundle, __UI_HTML__ is injected by esbuild at build time.
// In Bun dev mode the constant is undefined, so we fall back to reading from disk (live reload).
declare const __UI_HTML__: string | undefined;

const UI_HTML_INLINE: string | null = typeof __UI_HTML__ !== "undefined" ? __UI_HTML__ : null;
const _metaDir = (import.meta as { dir?: string }).dir;
const UI_DIR = _metaDir
  ? join(_metaDir, "..", "ui")            // dev: src/ → ui/
  : join(__dirname, "..", "..", "ui");    // CJS: plugin/scripts/ → ui/
const UI_HTML_PATH = join(UI_DIR, "index.html");

async function serveUiHtml(): Promise<Response> {
  if (UI_HTML_INLINE !== null) {
    return new Response(UI_HTML_INLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
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
  const state: ServerState = { embedder: null, embedderError: null, isIndexing: false };

  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const { method } = req;
      const { pathname } = url;

      if (method === "GET" && pathname === "/health") return handleHealth(db);
      if (method === "GET" && pathname === "/status") return handleStatus(db);
      if (method === "GET" && pathname === "/projects") return handleProjects(db);
      if (method === "GET" && pathname === "/stats/heatmap") return handleHeatmap(db, url);
      if (method === "GET" && pathname === "/sessions") return handleSessions(db, url);
      if (method === "GET" && pathname.startsWith("/sessions/") && pathname.endsWith("/markdown")) {
        const id = pathname.slice("/sessions/".length, -"/markdown".length);
        if (!id) return Response.json({ error: "Not found" }, { status: 404 });
        return handleSessionMarkdown(db, id);
      }
      if (method === "GET" && pathname.startsWith("/sessions/")) {
        const id = pathname.slice("/sessions/".length);
        if (!id || id.includes("/")) return Response.json({ error: "Not found" }, { status: 404 });
        return handleSessionDetail(db, id);
      }
      if (method === "POST" && pathname === "/search") return handleSearch(db, state, req);
      if (method === "POST" && pathname === "/query_db") return handleQueryDb(db, req);
      if (method === "GET" && pathname === "/settings") return handleSettings();
      if (method === "POST" && pathname === "/settings") return handleSettingsUpdate(req);
      if (method === "GET" && pathname === "/audit/entries") return handleAuditEntries(db, url);
      if (method === "GET" && pathname === "/activity/entries") return handleActivityEntries(url);
      if (method === "GET" && pathname.startsWith("/ui/")) return serveStaticFile(pathname);
      if (method === "GET" && (
        pathname === "/" ||
        pathname === "/search" ||
        pathname === "/audit" ||
        pathname === "/debug"
      )) {
        return serveUiHtml();
      }
      if (method === "GET" && pathname === "/debug/log") return handleDebugLog(url);
      if (method === "GET" && pathname === "/debug/config") return handleDebugConfig();

      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });

  console.log(`[server] Listening on http://localhost:${PORT}`);

  appendActivity({ type: "daemon_started" });
  loadEmbedderWithRetry(db, state);

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
