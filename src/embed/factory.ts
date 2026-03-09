// src/embed/factory.ts
// Factory: reads QREC_EMBED_PROVIDER env var and returns the appropriate EmbedProvider.
//
// QREC_EMBED_PROVIDER=local   (default) → node-llama-cpp local model
// QREC_EMBED_PROVIDER=ollama            → Ollama HTTP backend
// QREC_EMBED_PROVIDER=openai            → OpenAI/Voyage-compatible HTTP backend
// QREC_EMBED_PROVIDER=stub              → fixed unit vector, no model (CI/testing)

import type { EmbedProvider } from "./provider.ts";

export async function getEmbedProvider(): Promise<EmbedProvider> {
  const provider = (process.env.QREC_EMBED_PROVIDER ?? "local").toLowerCase().trim();

  switch (provider) {
    case "local":
    case "": {
      const { getEmbedder } = await import("./local.ts");
      return getEmbedder();
    }

    case "ollama": {
      const { getOllamaEmbedder } = await import("./ollama.ts");
      return getOllamaEmbedder();
    }

    case "openai": {
      const { getOpenAIEmbedder } = await import("./openai.ts");
      return getOpenAIEmbedder();
    }

    case "stub": {
      const { getStubEmbedder } = await import("./stub.ts");
      return getStubEmbedder();
    }

    default:
      throw new Error(
        `Unknown QREC_EMBED_PROVIDER: "${provider}". Valid values: local, ollama, openai, stub`
      );
  }
}
