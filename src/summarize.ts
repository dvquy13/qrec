// src/summarize.ts
// Pure inference: summarize a session transcript using an already-loaded SummarizerCtx.
// No model lifecycle here — caller owns load/dispose (see enrich.ts).

import type { Llama, LlamaModel, LlamaContext } from "node-llama-cpp";

export interface SessionSummary {
  summary: string;
  tags: string[];
  entities: string[];
}

export interface SummarizerCtx {
  llama: Llama;
  model: LlamaModel;
  ctx: LlamaContext;
}

const SYSTEM_PROMPT = `You are a concise technical summarizer for AI coding sessions.
Given a conversation transcript between a user and an AI coding assistant, produce a structured summary.

Output ONLY valid JSON with this exact shape:
{
  "summary": "2-3 sentence description of what was accomplished",
  "tags": ["tag1", "tag2", "tag3"],
  "entities": ["FileName.ts", "functionName()", "ErrorType", "library-name"]
}

Rules:
- summary: focus on what was built/fixed/decided — not how the conversation went
- tags: 3-6 lowercase kebab-case labels (e.g. "bug-fix", "refactor", "typescript", "mcp", "database")
- entities: key technical artifacts mentioned (files, functions, errors, libraries) — max 8
- No explanation outside the JSON block`;

/** Build a compact session digest for the LLM: skip tool lines, cap at maxChars. */
function buildDigest(chunkText: string, maxChars = 6000): string {
  const lines = chunkText.split("\n");
  const kept: string[] = [];
  let chars = 0;
  for (const line of lines) {
    if (line.startsWith("[Tool]")) continue;
    if (chars + line.length > maxChars) {
      kept.push("... (truncated)");
      break;
    }
    kept.push(line);
    chars += line.length + 1;
  }
  return kept.join("\n");
}

function parseResponse(text: string): SessionSummary {
  // Strip <think> blocks if Qwen3 emits them despite /no_think
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { summary: cleaned.slice(0, 500) || "", tags: [], entities: [] };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t: unknown): t is string => typeof t === "string")
        : [],
      entities: Array.isArray(parsed.entities)
        ? parsed.entities.filter((e: unknown): e is string => typeof e === "string")
        : [],
    };
  } catch {
    return { summary: "", tags: [], entities: [] };
  }
}

/**
 * Summarize a session using the already-loaded SummarizerCtx.
 * Creates a fresh context sequence per call (no KV cache bleed between sessions).
 */
export async function summarizeSession(
  summCtx: SummarizerCtx,
  chunkText: string
): Promise<SessionSummary> {
  const { LlamaChatSession } = await import("node-llama-cpp");
  const sequence = summCtx.ctx.getSequence();
  const chatSession = new LlamaChatSession({
    contextSequence: sequence,
    systemPrompt: SYSTEM_PROMPT,
  });
  const digest = buildDigest(chunkText);
  // /no_think disables Qwen3's chain-of-thought mode, halving latency
  const userPrompt = `/no_think\n\nTranscript:\n\n${digest}\n\nJSON summary:`;
  try {
    const response = await chatSession.prompt(userPrompt, {
      maxTokens: 300,
      temperature: 0.1,
    });
    return parseResponse(response);
  } catch {
    return { summary: "", tags: [], entities: [] };
  } finally {
    sequence.dispose();
  }
}
