// src/embed/openai.ts
// OpenAI/Voyage-compatible HTTP embedding backend
// Env: QREC_OPENAI_KEY (required)
// Env: QREC_OPENAI_BASE_URL (default: https://api.openai.com/v1)
// Env: QREC_OPENAI_MODEL (default: text-embedding-3-small)
// Env: QREC_OPENAI_DIMENSIONS (default: 768)

import type { EmbedProvider } from "./provider.ts";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 768;

interface OpenAIEmbedResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export function getOpenAIEmbedder(): EmbedProvider {
  const apiKey = process.env.QREC_OPENAI_KEY;
  if (!apiKey) {
    throw new Error(
      "QREC_OPENAI_KEY environment variable is required for OpenAI embedding backend"
    );
  }

  const baseUrl = (process.env.QREC_OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.QREC_OPENAI_MODEL ?? DEFAULT_MODEL;
  const dimensions = parseInt(process.env.QREC_OPENAI_DIMENSIONS ?? String(DEFAULT_DIMENSIONS), 10);

  console.log(`[embed/openai] Using OpenAI-compatible API at ${baseUrl}, model: ${model}, dimensions: ${dimensions}`);

  return {
    dimensions,
    async embed(text: string): Promise<Float32Array> {
      const body: Record<string, unknown> = {
        model,
        input: text,
      };

      // Only pass dimensions param if using text-embedding-3-* models (not all providers support it)
      if (model.startsWith("text-embedding-3")) {
        body.dimensions = dimensions;
      }

      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`OpenAI embeddings request failed: HTTP ${res.status} — ${errBody}`);
      }

      const data = (await res.json()) as OpenAIEmbedResponse;

      if (!data.data?.[0]?.embedding || data.data[0].embedding.length === 0) {
        throw new Error("OpenAI returned empty or invalid embedding");
      }

      return new Float32Array(data.data[0].embedding);
    },
  };
}
