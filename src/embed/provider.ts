// src/embed/provider.ts
// Interface for embedding providers

export interface EmbedProvider {
  embed(text: string): Promise<Float32Array>;
  dimensions: number;
}
