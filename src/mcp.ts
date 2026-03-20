// src/mcp.ts
// MCP server: stdio transport (primary) and HTTP transport (--http flag)
// Proxies all tool calls to the running qrec daemon (default http://localhost:25927; override with QREC_PORT).
// No model or DB loaded here — reuses the daemon's already-loaded embedder.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const getDaemonBase = () => `http://localhost:${parseInt(process.env.QREC_PORT ?? "25927", 10)}`;
const MCP_HTTP_PORT = 3031;
const DAEMON_DOWN_MSG = "qrec daemon is not running. Start it with: qrec serve --daemon";

interface SearchFilters { dateFrom?: string; dateTo?: string; project?: string; tag?: string; }

async function daemonSearch(query: string, k: number, filters?: SearchFilters): Promise<unknown> {
  const res = await fetch(`${getDaemonBase()}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, k, ...filters }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    const fallback = res.status === 503 ? "qrec daemon not ready yet (model still loading)" : `Daemon returned ${res.status}`;
    throw new Error(body.error ?? fallback);
  }
  return res.json();
}

async function daemonGetMarkdown(sessionId: string): Promise<string> {
  const res = await fetch(`${getDaemonBase()}/sessions/${sessionId}/markdown`);
  if (res.status === 404) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  if (!res.ok) {
    throw new Error(`Daemon returned ${res.status}`);
  }
  return res.text();
}

async function daemonHealth(): Promise<unknown> {
  const res = await fetch(`${getDaemonBase()}/health`);
  if (!res.ok) {
    throw new Error(`Daemon returned ${res.status}`);
  }
  return res.json();
}

async function daemonQueryDb(sql: string): Promise<unknown> {
  const res = await fetch(`${getDaemonBase()}/query_db`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Daemon returned ${res.status}`);
  }
  return res.json();
}

function isDaemonDown(err: unknown): boolean {
  const msg = String(err);
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("fetch failed") ||
    msg.includes("Connection refused") ||
    msg.includes("Unable to connect")
  );
}

const TOOLS = [
  {
    name: "search",
    description: "Search indexed Claude Code sessions using hybrid BM25 + vector search",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (use concrete nouns: function names, error messages, feature names)" },
        k: { type: "number", description: "Number of results (default: 10)" },
        dateFrom: { type: "string", description: "Filter: sessions on or after this date (YYYY-MM-DD)" },
        dateTo: { type: "string", description: "Filter: sessions on or before this date (YYYY-MM-DD)" },
        project: { type: "string", description: "Filter: project name substring (case-insensitive)" },
        tag: { type: "string", description: "Filter: tag substring (case-insensitive, requires enriched sessions)" },
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
        session_id: { type: "string", description: "8-char hex session ID from search results" },
      },
      required: ["session_id"],
    },
  },
  {
    name: "status",
    description: "Get qrec daemon health and index status",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "query_db",
    description: `Run a read-only SQL SELECT query against the qrec SQLite database.
Use for structured/temporal/project questions (dates, project names, counts, listings).
Prefer over search when the question is about: dates, project names, counts, or listing sessions.

Schema:
  sessions(id TEXT, path TEXT, project TEXT, date TEXT, title TEXT, hash TEXT, indexed_at INTEGER, summary TEXT, tags TEXT, entities TEXT, enriched_at INTEGER, enrichment_version INTEGER)
  chunks(id TEXT, session_id TEXT, seq INTEGER, pos INTEGER, text TEXT, created_at INTEGER)
  query_audit(id INTEGER, query TEXT, k INTEGER, result_count INTEGER, top_session_id TEXT, top_score REAL, duration_ms REAL, created_at INTEGER)

Only SELECT statements. No semicolons.

\`project\` = basename of the working directory (e.g. cwd \`/Users/dvq/frostmourne/qrec\` → project \`qrec\`).
\`summary\` and \`tags\` may be null for unenriched sessions; fall back to \`title\` + \`date\` if so.

Examples:
  SELECT id, title, project, date FROM sessions WHERE date = '2026-03-11' ORDER BY indexed_at DESC
  SELECT project, COUNT(*) as sessions FROM sessions GROUP BY project ORDER BY sessions DESC
  SELECT id, title, date FROM sessions WHERE project = 'qrec' ORDER BY date DESC LIMIT 10
  -- Project orientation (project = basename of working directory):
  SELECT id, title, date, summary, tags FROM sessions WHERE project = 'qrec' ORDER BY date DESC LIMIT 5`,
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "A read-only SELECT SQL query" },
      },
      required: ["sql"],
    },
  },
];

type MCPResult = { content: [{ type: "text"; text: string }]; isError?: true };

function mcpError(msg: string): MCPResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true };
}

async function callDaemon(fn: () => Promise<unknown>, format: (r: unknown) => string): Promise<MCPResult> {
  try {
    return { content: [{ type: "text", text: format(await fn()) }] };
  } catch (err) {
    return mcpError(isDaemonDown(err) ? DAEMON_DOWN_MSG : String(err));
  }
}

export async function handleToolCall(name: string, args: Record<string, unknown>): Promise<MCPResult> {
  if (name === "search") {
    const query = String(args?.query ?? "").trim();
    if (!query) return mcpError("Missing required field: query");
    const k = typeof args?.k === "number" ? args.k : 10;
    const filters: SearchFilters = {};
    if (typeof args?.dateFrom === "string") filters.dateFrom = args.dateFrom;
    if (typeof args?.dateTo   === "string") filters.dateTo   = args.dateTo;
    if (typeof args?.project  === "string") filters.project  = args.project;
    if (typeof args?.tag      === "string") filters.tag      = args.tag;
    return callDaemon(() => daemonSearch(query, k, filters), (d) => JSON.stringify(d));
  }

  if (name === "get") {
    const sessionId = String(args?.session_id ?? "").trim();
    if (!sessionId) return mcpError("Missing required field: session_id");
    return callDaemon(() => daemonGetMarkdown(sessionId), (md) => String(md));
  }

  if (name === "status") {
    return callDaemon(daemonHealth, (d) => JSON.stringify(d));
  }

  if (name === "query_db") {
    const sql = String(args?.sql ?? "").trim();
    if (!sql) return mcpError("Missing required field: sql");
    return callDaemon(() => daemonQueryDb(sql), (d) => JSON.stringify(d));
  }

  return mcpError(`Unknown tool: ${name}`);
}

export async function runMcpServer(useHttp: boolean = false): Promise<void> {
  const server = new Server(
    { name: "qrec", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, (args ?? {}) as Record<string, unknown>);
  });

  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));

  if (useHttp) {
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

        if (body.method === "tools/list") {
          return Response.json({ jsonrpc: "2.0", result: { tools: TOOLS }, id: body.id });
        }

        if (body.method === "tools/call") {
          const params = body.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
          const toolName = params?.name ?? "";
          const toolArgs = params?.arguments ?? {};
          const result = await handleToolCall(toolName, toolArgs);
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
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[mcp] qrec MCP server running on stdio (proxying to daemon at ${getDaemonBase()})`);
  }
}
