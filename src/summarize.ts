// src/summarize.ts
// Pure inference: summarize a session transcript using an already-loaded SummarizerCtx.
// No model lifecycle here — caller owns load/dispose (see enrich.ts).

import type { Llama, LlamaModel, LlamaContext } from "node-llama-cpp";
import { SYSTEM_PROMPT } from "./prompts/session-extract-v1.ts";

export interface SessionSummary {
  summary: string;
  tags: string[];
  entities: string[];
  learnings: string[];
  questions: string[];
}

export interface SummarizerCtx {
  llama: Llama;
  model: LlamaModel;
  ctx: LlamaContext;
}

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

function parseStringArray(val: unknown): string[] {
  return Array.isArray(val)
    ? val.filter((t: unknown): t is string => typeof t === "string")
    : [];
}

function parseResponse(text: string): SessionSummary {
  // Strip <think> blocks if Qwen3 emits them despite /no_think
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { summary: cleaned.slice(0, 500) || "", tags: [], entities: [], learnings: [], questions: [] };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      tags: parseStringArray(parsed.tags),
      entities: parseStringArray(parsed.entities),
      learnings: parseStringArray(parsed.learnings),
      questions: parseStringArray(parsed.questions),
    };
  } catch {
    return { summary: "", tags: [], entities: [], learnings: [], questions: [] };
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
      maxTokens: 500,
      temperature: 0.1,
    });
    return parseResponse(response);
  } catch {
    return { summary: "", tags: [], entities: [], learnings: [], questions: [] };
  } finally {
    sequence.dispose();
  }
}
