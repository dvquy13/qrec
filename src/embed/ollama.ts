// src/embed/ollama.ts
// Ollama HTTP embedding backend
// Env: QREC_OLLAMA_HOST (default: http://localhost:11434)
// Env: QREC_OLLAMA_MODEL (default: nomic-embed-text)

import type { EmbedProvider } from "./provider.ts";

const DEFAULT_HOST = "http://localhost:11434";
const DEFAULT_MODEL = "nomic-embed-text";
// nomic-embed-text produces 768-dimensional embeddings (matches local model)
const DEFAULT_DIMENSIONS = 768;

interface OllamaEmbedResponse {
  embedding: number[];
}

export function getOllamaEmbedder(): EmbedProvider {
  const host = process.env.QREC_OLLAMA_HOST ?? DEFAULT_HOST;
  const model = process.env.QREC_OLLAMA_MODEL ?? DEFAULT_MODEL;

  console.log(`[embed/ollama] Using Ollama at ${host}, model: ${model}`);

  return {
    dimensions: DEFAULT_DIMENSIONS,
    async embed(text: string): Promise<Float32Array> {
      const res = await fetch(`${host}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama embeddings request failed: HTTP ${res.status} — ${body}`);
      }

      const data = (await res.json()) as OllamaEmbedResponse;

      if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
        throw new Error(`Ollama returned empty or invalid embedding`);
      }

      return new Float32Array(data.embedding);
    },
  };
}
