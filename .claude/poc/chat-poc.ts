#!/usr/bin/env bun
// scripts/chat-poc.ts
// PoC: Qwen3-1.7B tool calling against the live qrec daemon.
//
// Usage:
//   bun run scripts/chat-poc.ts "What have I been working on recently?"
//   bun run scripts/chat-poc.ts "Did I work on anything related to TypeScript last week?"
//   bun run scripts/chat-poc.ts "Show me details about qrec indexing work"

import { join } from "path";
import { homedir } from "os";
import { mkdirSync } from "fs";

const MODEL_URI = "hf:bartowski/Qwen_Qwen3-1.7B-GGUF/Qwen_Qwen3-1.7B-Q4_K_M.gguf";
const MODEL_CACHE_DIR = join(homedir(), ".qrec", "models");
const DAEMON_URL = "http://localhost:25927";

// ---------------------------------------------------------------------------
// Tool implementations — HTTP calls to the live daemon
// ---------------------------------------------------------------------------

async function toolSearch(query: string, k: number): Promise<string> {
  const resp = await fetch(`${DAEMON_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, k }),
  });
  if (!resp.ok) return `search failed: HTTP ${resp.status}`;
  const data = (await resp.json()) as { results: Array<{
    session_id: string; title: string | null; date: string; project: string;
    preview: string | null; summary: string | null; score: number;
  }> };
  const results = data.results ?? [];
  if (results.length === 0) return "No sessions found for that query.";
  return results.map((r) =>
    `ID: ${r.session_id} | ${r.date} | ${r.project}${r.title ? " | " + r.title : ""}\n` +
    (r.summary ? `Summary: ${r.summary}\n` : "") +
    `Preview: ${(r.preview ?? "").slice(0, 250)}`
  ).join("\n---\n");
}

async function toolGet(sessionId: string): Promise<string> {
  const resp = await fetch(`${DAEMON_URL}/sessions/${sessionId}/markdown`);
  if (!resp.ok) return `Session ${sessionId} not found (HTTP ${resp.status}).`;
  const text = await resp.text();
  // Cap at 3500 chars to stay within context budget
  return text.length > 3500 ? text.slice(0, 3500) + "\n...(truncated)" : text;
}

async function toolQueryDb(sql: string): Promise<string> {
  // Strip trailing semicolons — model often generates SQL ending with ";"
  // but the server rejects any SQL containing semicolons.
  const cleanSql = sql.trim().replace(/;+$/, "");
  const resp = await fetch(`${DAEMON_URL}/query_db`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql: cleanSql }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return `query_db failed: HTTP ${resp.status}${body ? " — " + body : ""}`;
  }
  const data = (await resp.json()) as { rows: unknown[]; count: number };
  if (!data.rows || data.rows.length === 0) return "No rows returned.";
  return JSON.stringify(data.rows, null, 2);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const query = process.argv[2] ?? "What have I been working on recently?";
  console.log(`\n[chat-poc] Query: "${query}"\n`);

  // Verify daemon is running
  try {
    const health = await fetch(`${DAEMON_URL}/health`);
    if (!health.ok) throw new Error("not ok");
    const { phase } = (await health.json()) as { phase: string };
    if (phase !== "ready") {
      console.error(`[chat-poc] Daemon not ready (phase=${phase}). Wait for it to finish loading.`);
      process.exit(1);
    }
    console.log("[chat-poc] Daemon is ready.");
  } catch {
    console.error("[chat-poc] ERROR: qrec daemon not running. Start it with: qrec serve --daemon");
    process.exit(1);
  }

  // Load model (dynamic import — node-llama-cpp is ESM-only)
  const { resolveModelFile, getLlama, LlamaChatSession, QwenChatWrapper, defineChatSessionFunction } =
    await import("node-llama-cpp");

  mkdirSync(MODEL_CACHE_DIR, { recursive: true });
  console.log("[chat-poc] Resolving model...");

  const modelPath = await resolveModelFile(MODEL_URI, {
    directory: MODEL_CACHE_DIR,
    onProgress({ totalSize, downloadedSize }) {
      const pct = totalSize ? Math.round((downloadedSize / totalSize) * 100) : "?";
      process.stdout.write(`\r[chat-poc] Downloading model... ${pct}%   `);
    },
  });
  process.stdout.write("\n");
  console.log("[chat-poc] Model resolved. Loading...");

  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath });
  const ctx = await model.createContext({ contextSize: 8192, sequences: 1 });
  const sequence = ctx.getSequence();
  console.log("[chat-poc] Model loaded.\n");

  const systemPrompt = `You are a helpful assistant with access to qrec, a personal AI session recall engine.
qrec indexes the user's Claude Code session transcripts and lets you search and retrieve them.

Use the provided tools to find relevant information, then synthesize a clear, concise answer.
Guidelines:
- Always call search() first with a relevant query
- Call get() on the most relevant session ID if you need specific details
- Use query_db() for counting/temporal questions (e.g. "how many sessions", "sessions from last week")
- After collecting enough information, write a direct, helpful answer
- Cite session IDs when referring to specific sessions`;

  // QwenChatWrapper with thoughts:"discourage" suppresses <think> blocks, giving
  // a direct response. Without this, Qwen3 generates thinking segments and returns
  // empty final text after tool calls.
  const chatWrapper = new QwenChatWrapper({ thoughts: "discourage" });
  const session = new LlamaChatSession({
    contextSequence: sequence,
    systemPrompt,
    chatWrapper,
  });

  // Define tools with inline handlers
  const tools = {
    search: defineChatSessionFunction({
      description:
        "Search indexed Claude Code sessions with hybrid BM25 + vector search. " +
        "Use concrete nouns, function names, error messages, or topic keywords. " +
        "Returns session IDs, dates, projects, summaries, and content previews.",
      params: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keywords or phrase" },
          k: { type: "number", description: "Max results to return (1-10)" },
        },
      } as const,
      handler: async ({ query, k }: { query: string; k: number }) => {
        const capped = Math.min(Math.max(k ?? 5, 1), 10);
        console.log(`  [tool:search] query="${query}" k=${capped}`);
        const result = await toolSearch(query, capped);
        console.log(`  [tool:search] → ${result.split("\n---\n").length} result(s)`);
        return result;
      },
    }),

    get_session: defineChatSessionFunction({
      description:
        "Get the full content of a specific session by its ID. " +
        "Use IDs returned by search(). Good for reading full context of a conversation.",
      params: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "8-character hex session ID (e.g. 'a1b2c3d4')" },
        },
      } as const,
      handler: async ({ session_id }: { session_id: string }) => {
        console.log(`  [tool:get_session] ${session_id}`);
        const result = await toolGet(session_id);
        console.log(`  [tool:get_session] → ${result.length} chars`);
        return result;
      },
    }),

    query_db: defineChatSessionFunction({
      description:
        "Run a read-only SELECT query against the sessions SQLite database. " +
        "Schema: sessions(id, path, project, date, title, summary, tags, entities, enriched_at). " +
        "Use for counting, date filtering, listing projects. No semicolons.",
      params: {
        type: "object",
        properties: {
          sql: { type: "string", description: "SELECT SQL query without trailing semicolon" },
        },
      } as const,
      handler: async ({ sql }: { sql: string }) => {
        console.log(`  [tool:query_db] ${sql}`);
        const result = await toolQueryDb(sql);
        console.log(`  [tool:query_db] → ${result.length} chars`);
        return result;
      },
    }),
  };

  const t0 = Date.now();
  console.log("[chat-poc] Running (streaming response):\n");
  console.log("─".repeat(60));

  const response = await session.prompt(query, {
    functions: tools,
    maxTokens: 1200,
    temperature: 0.3,
    onTextChunk: (text) => process.stdout.write(text),
  });

  const elapsed = Date.now() - t0;
  console.log("\n" + "─".repeat(60));
  console.log(`\n[chat-poc] Total: ${elapsed}ms | Response: ${response.length} chars\n`);

  // Dispose in order: sequence → ctx → model → llama, then explicit exit.
  // Explicit process.exit(0) is required — Bun segfaults if the process exits
  // naturally while node-llama-cpp native objects are still in GC scope.
  sequence.dispose();
  await ctx.dispose();
  await model.dispose();
  await llama.dispose();
  process.exit(0);
}

main().catch((e) => {
  console.error("\n[chat-poc] Fatal:", e);
  process.exit(1);
});
