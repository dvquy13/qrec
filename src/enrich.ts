// src/enrich.ts
// Standalone enricher: open DB → load Qwen3-1.7B → batch summarize → dispose → exit.
// Also exports PID helpers so server.ts can check enrichment state without loading a model.

import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import type { Database } from "bun:sqlite";
import { openDb } from "./db.ts";
import type { SummarizerCtx } from "./summarize.ts";
import { summarizeSession } from "./summarize.ts";

// Bump to re-enrich all sessions (sessions with enrichment_version < this get re-queued).
export const ENRICHMENT_VERSION = 1;

const MODEL_URI = "hf:bartowski/Qwen_Qwen3-1.7B-GGUF/Qwen_Qwen3-1.7B-Q4_K_M.gguf";
const MODEL_CACHE_DIR = join(homedir(), ".qrec", "models");
export const ENRICH_PID_FILE = join(homedir(), ".qrec", "enrich.pid");

// ---------------------------------------------------------------------------
// PID helpers (no model loaded — safe to import from server.ts)
// ---------------------------------------------------------------------------

export function readEnrichPid(): number | null {
  if (!existsSync(ENRICH_PID_FILE)) return null;
  const pid = parseInt(readFileSync(ENRICH_PID_FILE, "utf-8").trim(), 10);
  return isNaN(pid) ? null : pid;
}

export function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** Returns true if an enrich child process is currently running. */
export function isEnrichAlive(): boolean {
  const pid = readEnrichPid();
  return pid !== null && isProcessAlive(pid);
}

function writeEnrichPid(pid: number): void {
  mkdirSync(join(homedir(), ".qrec"), { recursive: true });
  writeFileSync(ENRICH_PID_FILE, String(pid), "utf-8");
}

function deleteEnrichPid(): void {
  try { unlinkSync(ENRICH_PID_FILE); } catch {}
}

// ---------------------------------------------------------------------------
// Model lifecycle
// ---------------------------------------------------------------------------

export async function loadSummarizer(): Promise<SummarizerCtx> {
  const { resolveModelFile, getLlama } = await import("node-llama-cpp");
  mkdirSync(MODEL_CACHE_DIR, { recursive: true });

  process.stdout.write("[enrich] Resolving model...\n");
  const modelPath = await resolveModelFile(MODEL_URI, {
    directory: MODEL_CACHE_DIR,
    onProgress({ totalSize, downloadedSize }) {
      const pct = totalSize ? Math.round((downloadedSize / totalSize) * 100) : "?";
      process.stdout.write(`\r[enrich] Downloading model... ${pct}%`);
    },
  });
  process.stdout.write(`\n[enrich] Model ready at ${modelPath}\n`);

  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath });
  // sequences: 1 — we process sessions sequentially (dispose sequence before getting next)
  const ctx = await model.createContext({ contextSize: 8192, sequences: 1 });
  console.log("[enrich] Model loaded.");
  return { llama, model, ctx };
}

export async function disposeSummarizer(summCtx: SummarizerCtx): Promise<void> {
  await summCtx.ctx.dispose();
  await summCtx.model.dispose();
  await summCtx.llama.dispose();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChunkText(db: Database, sessionId: string): string {
  const rows = db
    .prepare("SELECT text FROM chunks WHERE session_id = ? ORDER BY seq")
    .all(sessionId) as Array<{ text: string }>;
  return rows.map(r => r.text).join("\n\n");
}

function buildSummaryChunkText(summary: string | null, tags: string[], entities: string[]): string {
  return [
    summary,
    tags.length > 0 ? "Tags: " + tags.join(", ") : "",
    entities.length > 0 ? "Entities: " + entities.join(", ") : "",
  ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Main enrichment run
// ---------------------------------------------------------------------------

/**
 * Backfill summary chunks for sessions already enriched but missing their _summary chunk.
 * Pure DB operation — no LLM needed. Runs before the main enrich loop.
 */
function backfillSummaryChunks(db: Database): void {
  const enriched = db.prepare(
    `SELECT id, summary, tags, entities FROM sessions
     WHERE enriched_at IS NOT NULL
       AND id NOT IN (SELECT session_id FROM chunks WHERE id = session_id || '_summary')`
  ).all() as Array<{ id: string; summary: string | null; tags: string | null; entities: string | null }>;

  if (enriched.length === 0) return;
  console.log(`[enrich] Backfilling summary chunks for ${enriched.length} already-enriched session(s)`);

  const insertSummaryChunk = db.prepare(
    "INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );

  for (const row of enriched) {
    if (!row.summary) continue;
    const tags: string[] = row.tags ? JSON.parse(row.tags) as string[] : [];
    const entities: string[] = row.entities ? JSON.parse(row.entities) as string[] : [];
    const text = buildSummaryChunkText(row.summary, tags, entities);
    insertSummaryChunk.run(`${row.id}_summary`, row.id, -1, -1, text, Date.now());
  }
  console.log(`[enrich] Backfill done.`);
}

export async function runEnrich(opts: { limit?: number } = {}): Promise<void> {
  writeEnrichPid(process.pid);
  const db = openDb();

  try {
    // Fast pass: backfill summary chunks for sessions enriched before this feature existed.
    backfillSummaryChunks(db);

    let pending = db
      .prepare(
        "SELECT id FROM sessions WHERE enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?"
      )
      .all(ENRICHMENT_VERSION) as Array<{ id: string }>;

    if (opts.limit !== undefined) {
      pending = pending.slice(0, opts.limit);
    }

    if (pending.length === 0) {
      console.log("[enrich] No pending sessions. Exiting without loading model.");
      return;
    }

    console.log(`[enrich] ${pending.length} session(s) to enrich`);

    const summCtx = await loadSummarizer();
    try {
      const updateSession = db.prepare(
        "UPDATE sessions SET summary=?, tags=?, entities=?, enriched_at=?, enrichment_version=? WHERE id=?"
      );
      // Summary chunks go into the chunks table (FTS5 trigger auto-indexes them for BM25 search).
      // Chunk id format: "{session_id}_summary" — distinct from real chunks "{session_id}_{seq}".
      const deleteSummaryChunk = db.prepare("DELETE FROM chunks WHERE id = ?");
      const insertSummaryChunk = db.prepare(
        "INSERT OR REPLACE INTO chunks (id, session_id, seq, pos, text, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      );

      for (let i = 0; i < pending.length; i++) {
        const { id } = pending[i];
        const chunkText = getChunkText(db, id);
        if (!chunkText.trim()) {
          console.log(`[${i + 1}/${pending.length}] ${id} — skip (no chunks)`);
          continue;
        }

        const t0 = Date.now();
        const result = await summarizeSession(summCtx, chunkText);
        const latencyMs = Date.now() - t0;

        // Checkpoint to DB immediately after each session
        const now = Date.now();
        updateSession.run(
          result.summary,
          JSON.stringify(result.tags),
          JSON.stringify(result.entities),
          now,
          ENRICHMENT_VERSION,
          id
        );

        // Insert summary chunk so BM25 (FTS5) search covers summary/tags/entities text.
        // seq=-1 marks it as synthetic; pos=-1 means before all real content.
        if (result.summary || result.tags.length > 0 || result.entities.length > 0) {
          const summaryChunkText = buildSummaryChunkText(result.summary, result.tags, result.entities);
          deleteSummaryChunk.run(`${id}_summary`);
          insertSummaryChunk.run(`${id}_summary`, id, -1, -1, summaryChunkText, now);
        }

        console.log(`[${i + 1}/${pending.length}] ${id} — ${latencyMs}ms`);
        if (result.summary) console.log(`  Summary: ${result.summary.slice(0, 100)}`);
        if (result.tags.length > 0) console.log(`  Tags: ${result.tags.join(", ")}`);
      }
    } finally {
      await disposeSummarizer(summCtx);
    }

    console.log("[enrich] Done.");
  } finally {
    db.close();
    deleteEnrichPid();
  }
}
