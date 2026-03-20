// src/lifecycle.ts
// Lifecycle management: embedder loading, incremental indexing, enrich spawning.

import type { Database } from "bun:sqlite";
import type { EmbedProvider } from "./embed/provider.ts";
import { getEmbedProvider } from "./embed/factory.ts";
import { indexVault, embedSummaryChunks } from "./indexer.ts";
import { serverProgress } from "./progress.ts";
import { appendActivity } from "./activity.ts";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { LOG_FILE, ARCHIVE_DIR } from "./dirs.ts";
import { isProcessAlive, readEnrichPid, ENRICHMENT_VERSION } from "./enrich.ts";
import { readConfig } from "./config.ts";
import { probeGpu } from "./gpu-probe.ts";

export const DEFAULT_VAULT_PATH = process.env.QREC_PROJECTS_DIR ?? join(homedir(), ".claude", "projects");
export const INDEX_INTERVAL_MS = parseInt(process.env.QREC_INDEX_INTERVAL_MS ?? "60000", 10);
export const ENRICH_IDLE_MS = parseInt(process.env.QREC_ENRICH_IDLE_MS ?? String(5 * 60 * 1000), 10);

export interface ServerState {
  embedder: EmbedProvider | null;
  embedderError: string | null;
  isIndexing: boolean;
}

export function spawnEnrichIfNeeded(db: Database): void {
  if (!readConfig().enrichEnabled) return;
  const pid = readEnrichPid();
  if (pid !== null && isProcessAlive(pid)) {
    console.log("[server] Enrich child already running, skipping spawn.");
    return;
  }
  const idleMs = readConfig().enrichIdleMs;
  const cutoff = Date.now() - idleMs;
  const pending = (db.prepare(
    `SELECT COUNT(*) as n FROM sessions WHERE (enriched_at IS NULL OR enrichment_version IS NULL OR enrichment_version < ?) AND last_message_at < ?`
  ).get(ENRICHMENT_VERSION, cutoff) as { n: number }).n;
  if (pending === 0) return;
  const logFile = LOG_FILE;
  const baseArgs: string[] =
    typeof (import.meta as { dir?: string }).dir === "string"
      ? ["bun", "run", join((import.meta as { dir: string }).dir, "cli.ts"), "enrich"]
      : [process.argv[0], process.argv[1], "enrich"];
  const child = Bun.spawn([...baseArgs, "--min-age-ms", String(idleMs)], {
    detached: true,
    stdio: ["ignore", Bun.file(logFile), Bun.file(logFile)],
  });
  child.unref();
  console.log(`[server] Spawned enrich child (PID ${child.pid})`);
}

// Run an incremental index scan (fast — mtime pre-filter skips unchanged files).
// isInitialRun=true: sets phase="indexing" so the onboarding UI can show progress.
// isInitialRun=false (cron): keeps phase="ready" so the dashboard doesn't revert to onboarding.
export async function runIncrementalIndex(db: Database, state: ServerState, isInitialRun = false): Promise<void> {
  if (state.isIndexing || !existsSync(DEFAULT_VAULT_PATH)) return;
  state.isIndexing = true;
  const t0 = Date.now();
  // Initial run: log index_started immediately so the UI can show live progress.
  // Cron runs: defer logging — only write to activity.jsonl if new sessions are found.
  // Zero-session cron runs are silently skipped to prevent event flooding.
  if (isInitialRun) appendActivity({ type: "index_started" });
  if (isInitialRun) serverProgress.phase = "indexing";
  serverProgress.indexing = { indexed: 0, total: 0, current: "" };

  let newSessions = 0;
  // prevIndexed is -1 so the first session (i=0) passes the `indexed > prevIndexed` check.
  // Reset to -1 again before the archive scan so the archive's 0-based counter isn't
  // compared against the end-value from the projects scan.
  let prevIndexed = -1;
  // Cron runs buffer session IDs; flushed to activity only if newSessions > 0.
  const bufferedSessions: string[] = [];

  try {
    await indexVault(db, DEFAULT_VAULT_PATH, {}, (indexed, total, current) => {
      serverProgress.indexing = { indexed, total, current };
      if (current && indexed > prevIndexed) {
        if (isInitialRun) {
          appendActivity({ type: "session_indexed", data: { sessionId: current } });
        } else {
          bufferedSessions.push(current);
        }
        newSessions++;
        prevIndexed = indexed;
      }
    });

    // On initial startup: also index the archive so sessions Claude deleted from
    // ~/.claude/projects/ are recovered. Runs inside the isIndexing guard so cron
    // can't start a concurrent run. Live sessions already indexed above win on conflict.
    if (isInitialRun && existsSync(ARCHIVE_DIR)) {
      prevIndexed = -1; // reset: archive's onProgress restarts at i=0
      await indexVault(db, ARCHIVE_DIR, {}, (indexed, total, current) => {
        serverProgress.indexing = { indexed, total, current };
        if (current && indexed > prevIndexed) {
          appendActivity({ type: "session_indexed", data: { sessionId: current } });
          newSessions++;
          prevIndexed = indexed;
        }
      });
    }

    // Flush buffered cron sessions and log completion (only when there's something to show).
    if (!isInitialRun && newSessions > 0) {
      appendActivity({ type: "index_started" });
      for (const id of bufferedSessions) {
        appendActivity({ type: "session_indexed", data: { sessionId: id } });
      }
    }
    if (isInitialRun || newSessions > 0) {
      appendActivity({ type: "index_complete", data: { newSessions, durationMs: Date.now() - t0 } });
    }
    // Embed any summary chunks (seq=-1) not yet in chunks_vec.
    // Enrich child writes summary chunks then exits; the next cron tick picks them up here.
    if (state.embedder) await embedSummaryChunks(db, state.embedder);
  } catch (err) {
    console.error("[server] Index error:", err);
  } finally {
    state.isIndexing = false;
    if (isInitialRun) serverProgress.phase = "ready";
  }
}

// Load embedder in background; /search returns 503 until ready.
export async function loadEmbedderWithRetry(db: Database, state: ServerState, maxAttempts = 10, delayMs = 30_000): Promise<void> {
  // Log GPU/compute backend info once at startup.
  const gpuInfo = probeGpu();
  if (process.platform === "linux") {
    console.log(`[server] GPU: ${gpuInfo.gpuDetected ? `${gpuInfo.gpuName} (driver ${gpuInfo.driverVersion}, CUDA ${gpuInfo.cudaDriverVersion})` : "none detected"}`);
    console.log(`[server] Compute backend: ${gpuInfo.selectedBackend}`);
    if (gpuInfo.advice) console.warn(`[server] WARNING: ${gpuInfo.advice}`);
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      serverProgress.phase = "model_loading";
      state.embedder = await getEmbedProvider();
      state.embedderError = null;
      console.log("[server] Model ready");

      // Start enrich cron before indexing so it fires during the initial index run.
      // Initial call skips if DB is empty; cron picks up sessions as they get indexed.
      // Env var takes precedence (CI uses QREC_INDEX_INTERVAL_MS=5000 for fast cron tests).
      // Falls back to config so the Settings UI takes effect on next restart.
      const indexInterval = process.env.QREC_INDEX_INTERVAL_MS
        ? INDEX_INTERVAL_MS
        : readConfig().indexIntervalMs;
      spawnEnrichIfNeeded(db);
      setInterval(() => spawnEnrichIfNeeded(db), indexInterval);

      // Immediate catchup scan on startup (shows indexing progress in onboarding UI)
      await runIncrementalIndex(db, state, true);

      serverProgress.phase = "ready";

      // Index cron starts after initial run completes (no point running concurrently).
      setInterval(() => runIncrementalIndex(db, state), indexInterval);

      return;
    } catch (err) {
      state.embedderError = String(err);
      console.error(`[server] Model load failed (attempt ${attempt}/${maxAttempts}):`, err);
      if (attempt < maxAttempts) {
        console.log(`[server] Retrying in ${delayMs / 1000}s...`);
        await Bun.sleep(delayMs);
      }
    }
  }
  console.error("[server] Model load gave up after all retries.");
  serverProgress.phase = "ready";
}
