// src/parser.ts
// Parse Claude Code JSONL session files into structured data for indexing.

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { basename } from "path";

export interface ParsedSession {
  session_id: string;    // 8-char hex prefix of UUID (from filename)
  path: string;          // absolute path to .jsonl file
  project: string;       // basename of cwd from first message
  date: string;          // YYYY-MM-DD from first message timestamp
  title: string | null;  // first real user message text, truncated to 120 chars
  hash: string;          // SHA-256 of file contents (for change detection)
  duration_seconds: number; // gap-capped active time (15-min idle threshold)
  last_message_at: number;  // Unix ms of the last message in the session
  turns: Turn[];
}

export interface Turn {
  role: "user" | "assistant";
  text: string;          // clean extracted text
  tools: string[];       // ["Bash: `ls /foo`", "Read: `/path/to/file`"]
  thinking: string[];    // extracted thinking blocks (extended thinking)
  timestamp: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip XML-like tags from user text (Claude Code injects system-reminder etc.) */
function stripTags(text: string): string {
  return text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, "").replace(/<[^>]+\/>/g, "").trim();
}

/** Summarize a tool_use block into a short readable string. */
function summarizeTool(name: string, input: Record<string, unknown>): string {
  const keyMap: Record<string, string> = {
    Bash: "command",
    Read: "file_path",
    Write: "file_path",
    Edit: "file_path",
    Glob: "pattern",
    Grep: "pattern",
    WebFetch: "url",
    WebSearch: "query",
    Agent: "description",
  };
  const key = keyMap[name];
  const raw = key && typeof input[key] === "string" ? input[key] as string : JSON.stringify(input);
  const truncated = raw.length > 80 ? raw.slice(0, 80) + "…" : raw;
  return `${name}: \`${truncated}\``;
}

/** Extract text content from a content block array (user or assistant side). */
function extractUserContent(
  content: unknown
): { text: string; isToolResult: boolean } {
  if (typeof content === "string") {
    const cleaned = stripTags(content).trim();
    return { text: cleaned, isToolResult: false };
  }

  if (!Array.isArray(content)) return { text: "", isToolResult: false };

  const allToolResult = content.every(
    (b: { type?: string }) => b?.type === "tool_result"
  );
  if (allToolResult) return { text: "", isToolResult: true };

  const parts: string[] = [];
  for (const block of content as Array<{ type?: string; text?: string }>) {
    if (block?.type === "text" && typeof block.text === "string") {
      const cleaned = stripTags(block.text).trim();
      if (cleaned) parts.push(cleaned);
    }
  }
  return { text: parts.join("\n").trim(), isToolResult: false };
}

/** Extract text, tool summaries, and thinking blocks from assistant content. */
function extractAssistantContent(
  content: unknown
): { text: string; tools: string[]; thinking: string[] } {
  if (!Array.isArray(content)) return { text: "", tools: [], thinking: [] };

  const textParts: string[] = [];
  const tools: string[] = [];
  const thinking: string[] = [];

  for (const block of content as Array<{
    type?: string;
    text?: string;
    thinking?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>) {
    if (block?.type === "text" && typeof block.text === "string") {
      const t = block.text.trim();
      if (t) textParts.push(t);
    } else if (block?.type === "tool_use" && block.name) {
      tools.push(summarizeTool(block.name, block.input ?? {}));
    } else if (block?.type === "thinking" && typeof block.thinking === "string") {
      const t = block.thinking.trim();
      if (t) thinking.push(t);
    }
  }

  return { text: textParts.join("\n").trim(), tools, thinking };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

interface JsonlLine {
  type?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  cwd?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
  };
}

export async function parseSession(jsonlPath: string): Promise<ParsedSession> {
  const raw = readFileSync(jsonlPath, "utf-8");
  const hash = createHash("sha256").update(raw).digest("hex");

  // UUID from filename: "03db1927-4353-4055-9ddf-4c3946c47f33.jsonl" → "03db1927"
  const uuidStr = basename(jsonlPath, ".jsonl");
  const session_id = uuidStr.replace(/-/g, "").slice(0, 8);

  const lines = raw
    .split("\n")
    .filter(l => l.trim())
    .map(l => {
      try { return JSON.parse(l) as JsonlLine; } catch { return null; }
    })
    .filter((l): l is JsonlLine => l !== null);

  let project = "";
  let date = "";
  let title: string | null = null;
  const turns: Turn[] = [];
  const timestamps: number[] = [];

  for (const line of lines) {
    // Collect all timestamps for duration calculation (before any skips)
    if (line.timestamp) timestamps.push(Date.parse(line.timestamp));

    // Skip internal/noise types
    if (
      line.type === "file-history-snapshot" ||
      line.type === "system" ||
      line.type === "progress"
    ) continue;

    // Skip metadata and sidechain messages
    if (line.isMeta || line.isSidechain) continue;

    const msg = line.message;
    if (!msg) continue;

    // Extract project + date from first message with cwd/timestamp
    if (!project && line.cwd) {
      project = basename(line.cwd);
    }
    if (!date && line.timestamp) {
      date = line.timestamp.slice(0, 10); // YYYY-MM-DD
    }

    if (msg.role === "user" && line.type === "user") {
      const { text, isToolResult } = extractUserContent(msg.content);
      if (isToolResult || !text) continue;

      if (!title) {
        title = text.slice(0, 120);
      }
      turns.push({ role: "user", text, tools: [], thinking: [], timestamp: line.timestamp ?? null });
    }

    if (msg.role === "assistant" && line.type === "assistant") {
      const { text, tools, thinking } = extractAssistantContent(msg.content);
      if (!text && tools.length === 0 && thinking.length === 0) continue;
      turns.push({ role: "assistant", text, tools, thinking, timestamp: line.timestamp ?? null });
    }
  }

  // Gap-capped duration: sum min(gap, 15min) over consecutive timestamps.
  // Drops idle time (lunch breaks, overnight pauses) without needing explicit tracking.
  const IDLE_GAP_MS = 15 * 60 * 1000;
  timestamps.sort((a, b) => a - b);
  let duration_ms = 0;
  for (let i = 1; i < timestamps.length; i++) {
    duration_ms += Math.min(timestamps[i] - timestamps[i - 1], IDLE_GAP_MS);
  }
  const duration_seconds = Math.round(duration_ms / 1000);
  const last_message_at = timestamps.length > 0 ? timestamps[timestamps.length - 1] : Date.now();

  return { session_id, path: jsonlPath, project, date, title, hash, duration_seconds, last_message_at, turns };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render a ParsedSession as clean human-readable markdown (for get() display).
 */
export function renderMarkdown(session: ParsedSession): string {
  const lines: string[] = [
    `# Session: ${session.project} — ${session.date}`,
    "",
  ];
  if (session.title) {
    lines.push(`_${session.title}_`, "");
  }

  for (const turn of session.turns) {
    if (turn.role === "user") {
      lines.push("## User", "", turn.text, "");
    } else {
      lines.push("## Assistant", "");
      if (turn.text) lines.push(turn.text, "");
      for (const tool of turn.tools) {
        lines.push(`> **Tool:** ${tool}`);
      }
      if (turn.tools.length > 0) lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Concatenate all turns into a flat text block for FTS5 + embedding.
 */
export function extractChunkText(session: ParsedSession): string {
  const parts: string[] = [];
  for (const turn of session.turns) {
    if (turn.text) parts.push(`[${turn.role === "user" ? "User" : "Assistant"}] ${turn.text}`);
    for (const tool of turn.tools) {
      parts.push(`[Tool] ${tool}`);
    }
  }
  return parts.join("\n");
}
