// src/embed/stub.ts
// Stub embed provider for CI/testing — returns a fixed unit vector without loading any model.
// Use by setting QREC_EMBED_PROVIDER=stub. Safe to call disposeEmbedder() after; local.ts is never loaded.

import type { EmbedProvider } from "./provider.ts";

const DIMENSIONS = 768;

// Fixed unit vector: all zeros except index 0 = 1.0
// Avoids division-by-zero in cosine similarity while keeping all embeddings identical (BM25 determines rank).
const UNIT_VECTOR = new Float32Array(DIMENSIONS);
UNIT_VECTOR[0] = 1.0;

export function getStubEmbedder(): EmbedProvider {
  return {
    dimensions: DIMENSIONS,
    async embed(_text: string): Promise<Float32Array> {
      return UNIT_VECTOR;
    },
  };
}
