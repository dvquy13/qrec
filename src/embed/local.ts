// src/embed/local.ts
// node-llama-cpp singleton: loads model once, reuses across queries

import type { LlamaEmbeddingContext, Llama } from "node-llama-cpp";
import { join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync } from "fs";
import { MODEL_CACHE_DIR } from "../dirs.ts";
import type { EmbedProvider } from "./provider.ts";
import { serverProgress } from "../progress.ts";

// Full HF URI — format: hf:<user>/<repo>/<file> (matches qmd convention)
const MODEL_URI = "hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf";
// Legacy filename written by old short-form URI (kept for backward compat)
const LEGACY_MODEL_PATH = join(homedir(), ".cache", "qmd", "models", "hf_ggml-org_embeddinggemma-300M-Q8_0.gguf");

// Singleton state
let llamaInstance: Llama | null = null;
let embeddingContext: LlamaEmbeddingContext | null = null;
let initPromise: Promise<LlamaEmbeddingContext> | null = null;

async function findOrDownloadModel(): Promise<string> {
  // Check legacy location (models downloaded by old qrec/qmd versions)
  if (existsSync(LEGACY_MODEL_PATH)) {
    console.log(`[embed] Found model at legacy path: ${LEGACY_MODEL_PATH}`);
    return LEGACY_MODEL_PATH;
  }

  // resolveModelFile: checks cache dir first, downloads from HF if missing
  console.log(`[embed] Resolving model: ${MODEL_URI}`);
  mkdirSync(MODEL_CACHE_DIR, { recursive: true });

  serverProgress.phase = "model_download";
  serverProgress.modelDownload = { percent: 0, downloadedMB: 0, totalMB: null };

  const { resolveModelFile } = await import("node-llama-cpp");
  const modelPath = await resolveModelFile(MODEL_URI, {
    directory: MODEL_CACHE_DIR,
    onProgress({ totalSize, downloadedSize }) {
      serverProgress.modelDownload = {
        percent: totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0,
        downloadedMB: +(downloadedSize / 1048576).toFixed(1),
        totalMB: totalSize ? +(totalSize / 1048576).toFixed(1) : null,
      };
    },
  });

  console.log(`[embed] Model ready at ${modelPath}`);
  return modelPath;
}

async function initEmbeddingContext(): Promise<LlamaEmbeddingContext> {
  const modelPath = await findOrDownloadModel();
  serverProgress.phase = "model_loading";
  console.log(`[embed] Loading model from ${modelPath}`);

  const { getLlama } = await import("node-llama-cpp");
  llamaInstance = await getLlama();
  const model = await llamaInstance.loadModel({ modelPath });
  const ctx = await model.createEmbeddingContext({ contextSize: 8192 });

  console.log(`[embed] Model loaded, embedding dimensions: 768`);
  return ctx;
}

export async function disposeEmbedder(): Promise<void> {
  if (embeddingContext) {
    await embeddingContext.dispose();
    embeddingContext = null;
  }
  if (llamaInstance) {
    await llamaInstance.dispose();
    llamaInstance = null;
    initPromise = null;
  }
}

export async function getEmbedder(): Promise<EmbedProvider> {
  if (!initPromise) {
    initPromise = initEmbeddingContext().catch(err => {
      // Reset so a subsequent call can retry (e.g. after background bun install completes)
      initPromise = null;
      throw err;
    });
  }

  if (!embeddingContext) {
    embeddingContext = await initPromise;
  }

  return {
    dimensions: 768,
    async embed(text: string): Promise<Float32Array> {
      const ctx = embeddingContext!;
      // Safety: truncate at 24000 chars (~6000 tokens @ 4 chars/token) to stay inside 8192-token context.
      // Dense code can tokenize at ~2 chars/token; 24000 / 2 = 12000 tokens still leaves a buffer
      // but in practice session transcripts average ~3-4 chars/token so this is very conservative.
      const MAX_CHARS = 24000;
      const safeText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
      if (safeText !== text) {
        console.warn(`[embed] Truncated chunk from ${text.length} to ${MAX_CHARS} chars`);
      }
      const embedding = await ctx.getEmbeddingFor(safeText);
      return new Float32Array(embedding.vector);
    },
  };
}
