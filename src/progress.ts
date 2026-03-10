// src/progress.ts
// Shared in-process progress state — written by embed/local.ts and indexer.ts,
// read by server.ts via the /status endpoint.

export type ProgressPhase =
  | "starting"       // server just opened DB, hasn't touched embedder yet
  | "model_download" // model GGUF is being fetched from HuggingFace
  | "model_loading"  // model is on disk, being loaded into memory
  | "indexing"       // embedding + storing sessions
  | "ready";         // fully operational

export interface ProgressState {
  phase: ProgressPhase;
  modelDownload: { percent: number; downloadedMB: number; totalMB: number | null };
  indexing: { indexed: number; total: number; current: string };
}

export const serverProgress: ProgressState = {
  phase: "starting",
  modelDownload: { percent: 0, downloadedMB: 0, totalMB: null },
  indexing: { indexed: 0, total: 0, current: "" },
};
