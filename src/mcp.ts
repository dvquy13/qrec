// src/mcp.ts
// MCP server: stdio transport (primary) and HTTP transport (--http flag)
// Tools: search, get, status

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { openDb } from "./db.ts";
import { getEmbedProvider } from "./embed/factory.ts";
import { disposeEmbedder } from "./embed/local.ts";
import { search } from "./search.ts";
import { getDaemonPid } from "./daemon.ts";
import { parseSession, renderMarkdown } from "./parser.ts";
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync } from "fs";

const LOG_FILE = join(homedir(), ".qrec", "qrec.log");
const MCP_HTTP_PORT = 3031;

function getLogTail(lines: number = 20): string[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const content = readFileSync(LOG_FILE, "utf-8");
    const allLines = content.split("\n").filter(l => l.length > 0);
    return allLines.slice(-lines);
  } catch {
    return [];
  }
}

async function getStatus(db: ReturnType<typeof openDb>, embedderLoaded: boolean) {
  const sessionRow = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
  const chunkRow = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };
  const lastIndexedRow = db
    .prepare("SELECT MAX(indexed_at) as last FROM sessions")
    .get() as { last: number | null };

  const daemonPid = getDaemonPid();

  return {
    health: "ok",
    session_count: sessionRow.count,
    chunk_count: chunkRow.count,
    last_indexed: lastIndexedRow.last ? new Date(lastIndexedRow.last).toISOString() : null,
    model_loaded: embedderLoaded,
    daemon_pid: daemonPid,
    log_tail: getLogTail(20),
  };
}

/** Read a session by path — renders clean markdown for JSONL, raw text for .md */
async function readSessionContent(filePath: string): Promise<string> {
  if (filePath.endsWith(".jsonl")) {
    const session = await parseSession(filePath);
    return renderMarkdown(session);
  }
  return Bun.file(filePath).text();
}

export async function runMcpServer(useHttp: boolean = false): Promise<void> {
  const db = openDb();
  let embedderLoaded = false;

  // Pre-load embedder (respects QREC_EMBED_PROVIDER env var)
  const embedder = await getEmbedProvider();
  embedderLoaded = true;

  const server = new Server(
    { name: "qrec", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search",
        description: "Search indexed sessions using hybrid BM25 + vector search",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            k: { type: "number", description: "Number of results (default: 10)" },
          },
          required: ["query"],
        },
      },
      {
        name: "get",
        description: "Get full session markdown by session ID",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "8-char hex session ID" },
          },
          required: ["session_id"],
        },
      },
      {
        name: "status",
        description: "Get qrec engine status and health information",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "search") {
      const query = String(args?.query ?? "").trim();
      if (!query) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Missing required field: query" }) }],
          isError: true,
        };
      }
      const k = typeof args?.k === "number" ? args.k : 10;

      try {
        const results = await search(db, embedder, query, k);
        return {
          content: [{ type: "text", text: JSON.stringify({ results }) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }],
          isError: true,
        };
      }
    }

    if (name === "get") {
      const sessionId = String(args?.session_id ?? "").trim();
      if (!sessionId) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Missing required field: session_id" }) }],
          isError: true,
        };
      }

      const row = db
        .prepare("SELECT path FROM sessions WHERE id = ?")
        .get(sessionId) as { path: string } | undefined;

      if (!row) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Session not found: ${sessionId}` }) }],
          isError: true,
        };
      }

      try {
        const content = await readSessionContent(row.path);
        return {
          content: [{ type: "text", text: content }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Failed to read session file: ${err}` }) }],
          isError: true,
        };
      }
    }

    if (name === "status") {
      try {
        const status = await getStatus(db, embedderLoaded);
        return {
          content: [{ type: "text", text: JSON.stringify(status) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }],
          isError: true,
        };
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    };
  });

  // Graceful shutdown
  async function shutdown() {
    console.error("[mcp] Shutting down...");
    db.close();
    await disposeEmbedder();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  if (useHttp) {
    // HTTP JSON-RPC transport on port 3031
    console.error(`[mcp] Starting HTTP MCP server on port ${MCP_HTTP_PORT}`);

    Bun.serve({
      port: MCP_HTTP_PORT,
      async fetch(req) {
        if (req.method !== "POST") {
          return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        let body: { jsonrpc?: string; method?: string; params?: unknown; id?: unknown };
        try {
          body = await req.json();
        } catch {
          return Response.json(
            { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
            { status: 400 }
          );
        }

        // Route to tool calls for simplicity
        if (body.method === "tools/list") {
          const tools = [
            {
              name: "search",
              description: "Search indexed sessions using hybrid BM25 + vector search",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  k: { type: "number" },
                },
                required: ["query"],
              },
            },
            {
              name: "get",
              description: "Get full session markdown by session ID",
              inputSchema: {
                type: "object",
                properties: { session_id: { type: "string" } },
                required: ["session_id"],
              },
            },
            {
              name: "status",
              description: "Get qrec engine status",
              inputSchema: { type: "object", properties: {} },
            },
          ];
          return Response.json({ jsonrpc: "2.0", result: { tools }, id: body.id });
        }

        if (body.method === "tools/call") {
          const params = body.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
          const toolName = params?.name ?? "";
          const toolArgs = params?.arguments ?? {};

          let result;
          try {
            if (toolName === "search") {
              const query = String(toolArgs?.query ?? "").trim();
              const k = typeof toolArgs?.k === "number" ? toolArgs.k : 10;
              const results = await search(db, embedder, query, k);
              result = { content: [{ type: "text", text: JSON.stringify({ results }) }] };
            } else if (toolName === "get") {
              const sessionId = String(toolArgs?.session_id ?? "").trim();
              const row = db.prepare("SELECT path FROM sessions WHERE id = ?").get(sessionId) as { path: string } | undefined;
              if (!row) {
                result = { content: [{ type: "text", text: JSON.stringify({ error: `Session not found: ${sessionId}` }) }], isError: true };
              } else {
                const content = await readSessionContent(row.path);
                result = { content: [{ type: "text", text: content }] };
              }
            } else if (toolName === "status") {
              const status = await getStatus(db, embedderLoaded);
              result = { content: [{ type: "text", text: JSON.stringify(status) }] };
            } else {
              result = { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }], isError: true };
            }
          } catch (err) {
            result = { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }], isError: true };
          }

          return Response.json({ jsonrpc: "2.0", result, id: body.id });
        }

        return Response.json(
          { jsonrpc: "2.0", error: { code: -32601, message: "Method not found" }, id: body.id },
          { status: 404 }
        );
      },
    });

    // Keep alive
    await new Promise(() => {});
  } else {
    // Stdio transport (primary)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[mcp] qrec MCP server running on stdio");
  }
}
