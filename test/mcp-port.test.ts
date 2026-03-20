// test/mcp-port.test.ts
// Verifies that the MCP server proxies tool calls to QREC_PORT, not always the default 25927.
//
// Root cause caught here: DAEMON_BASE was a module-level constant frozen at import time.
// Static imports are hoisted before any module-level code in ESM, so setting
// process.env.QREC_PORT before a static import has no effect on mcp.ts.
// Fix: getDaemonBase() is called per request so QREC_PORT is always read at call time.

import { describe, test, expect, afterAll, beforeAll } from "bun:test";

const TEST_PORT = 25929;
const DEFAULT_PORT = 25927;

// Minimal mock daemon on TEST_PORT. Records which paths were hit.
const hits: string[] = [];
const mockDaemon = Bun.serve({
  port: TEST_PORT,
  fetch(req) {
    const url = new URL(req.url);
    hits.push(url.pathname);
    if (url.pathname === "/health") return Response.json({ status: "ready", port: TEST_PORT });
    if (url.pathname === "/search") return Response.json({ results: [] });
    if (url.pathname.startsWith("/sessions/") && url.pathname.endsWith("/markdown")) {
      const id = url.pathname.split("/")[2];
      return new Response(`# Session ${id}`);
    }
    if (url.pathname === "/query_db") return Response.json({ rows: [], count: 0 });
    return new Response("not found", { status: 404 });
  },
});

afterAll(async () => {
  await mockDaemon.stop();
});

// Use dynamic import so we can set QREC_PORT before mcp.ts module code runs.
// Static imports are hoisted before module-level code in ESM — a static import
// of mcp.ts would freeze DAEMON_BASE before process.env.QREC_PORT is set.
let handleToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;

beforeAll(async () => {
  process.env.QREC_PORT = String(TEST_PORT);
  ({ handleToolCall } = await import("../src/mcp.ts"));
});

describe("MCP port adaptation", () => {
  test("status tool hits daemon on QREC_PORT (25929), not default (25927)", async () => {
    hits.length = 0;

    const result = await handleToolCall("status", {}) as { isError?: boolean; content: [{ text: string }] };

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("ready");
    expect(parsed.port).toBe(TEST_PORT);
    expect(hits).toContain("/health");
  });

  test("search tool hits daemon on QREC_PORT", async () => {
    hits.length = 0;

    const result = await handleToolCall("search", { query: "test query" }) as { isError?: boolean; content: [{ text: string }] };

    expect(result.isError).toBeFalsy();
    expect(hits).toContain("/search");
  });

  test("get tool hits daemon on QREC_PORT", async () => {
    hits.length = 0;

    const result = await handleToolCall("get", { session_id: "abc12345" }) as { isError?: boolean; content: [{ text: string }] };

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Session abc12345");
    expect(hits.some(p => p.includes("/sessions/abc12345"))).toBe(true);
  });

  test("query_db tool hits daemon on QREC_PORT", async () => {
    hits.length = 0;

    const result = await handleToolCall("query_db", { sql: "SELECT 1" }) as { isError?: boolean; content: [{ text: string }] };

    expect(result.isError).toBeFalsy();
    expect(hits).toContain("/query_db");
  });

  test("default port differs from test port (sanity check)", () => {
    expect(DEFAULT_PORT).not.toBe(TEST_PORT);
  });
});
