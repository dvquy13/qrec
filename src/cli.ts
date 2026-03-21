#!/usr/bin/env bun
// src/cli.ts
// Commands: qrec teardown, qrec index, qrec serve [--daemon],
//           qrec stop, qrec search, qrec get, qrec status, qrec enrich, qrec doctor

import { defineCommand, runMain } from "citty";
import { openDb } from "./db.ts";
import { indexVault } from "./indexer.ts";
import { disposeEmbedder } from "./embed/local.ts";
import { startDaemon, stopDaemon, getDaemonPid } from "./daemon.ts";
import { existsSync, readFileSync, rmSync } from "fs";
import { homedir } from "os";
import { QREC_DIR, LOG_FILE, getQrecPort } from "./dirs.ts";
import { probeGpu } from "./gpu-probe.ts";

// --- Pre-processing (must run before citty parses args and before any subcommand code) ---
const rawArgv = process.argv.slice(2);

// Handle --version / -v before citty
if (rawArgv[0] === "--version" || rawArgv[0] === "-v") {
  const version = typeof __QREC_VERSION__ !== "undefined" ? __QREC_VERSION__ : "(dev)";
  console.log(`qrec ${version}`);
  process.exit(0);
}

// Handle --port early: set env var before getQrecPort() is called anywhere.
// (dirs.ts exports getQrecPort() which reads process.env at call time — must happen first.)
const portIdx = rawArgv.indexOf("--port");
if (portIdx !== -1) {
  const portVal = rawArgv[portIdx + 1];
  if (!portVal || isNaN(parseInt(portVal, 10))) {
    console.error("[cli] --port requires a numeric value");
    process.exit(1);
  }
  process.env.QREC_PORT = portVal;
  rawArgv.splice(portIdx, 2);
}

// --- Helpers ---

function getLogTail(lines: number = 20): string[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const content = readFileSync(LOG_FILE, "utf-8");
    return content.split("\n").filter(l => l.length > 0).slice(-lines);
  } catch {
    return [];
  }
}

function openBrowser() {
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  try { Bun.spawnSync([cmd, `http://localhost:${getQrecPort()}`]); } catch {}
}

// --- Commands ---

const teardownCmd = defineCommand({
  meta: { name: "teardown", description: "Stop daemon and remove all qrec data (~/.qrec/)" },
  args: {
    yes: { type: "boolean", alias: "y", description: "Skip confirmation prompt", default: false },
  },
  async run({ args }) {
    await stopDaemon();

    if (!existsSync(QREC_DIR)) {
      console.log("[teardown] ~/.qrec/ not found, nothing to remove.");
      process.exit(0);
    }

    if (!args.yes) {
      process.stdout.write(`[teardown] Remove ${QREC_DIR} (DB, model, logs, pid, activity log)? [y/N] `);
      const answer = await new Promise<string>(resolve => {
        process.stdin.setEncoding("utf-8");
        process.stdin.once("data", d => resolve(String(d).trim()));
      });
      if (answer.toLowerCase() !== "y") {
        console.log("[teardown] Aborted.");
        process.exit(0);
      }
    }

    rmSync(QREC_DIR, { recursive: true, force: true });
    console.log("[teardown] Removed ~/.qrec/");
    process.exit(0);
  },
});

const indexCmd = defineCommand({
  meta: { name: "index", description: "Index sessions into the search database" },
  args: {
    path: { type: "positional", required: false, description: "Path to index (default: ~/.claude/projects/)" },
    force: { type: "boolean", description: "Force re-index all sessions", default: false },
    sessions: { type: "string", description: "Number of sessions to sample (for testing)" },
    seed: { type: "string", description: "Random seed for session sampling" },
  },
  async run({ args }) {
    let resolvedPath: string;
    const force = args.force ?? false;
    const sessions = args.sessions ? parseInt(args.sessions, 10) : undefined;
    const seed = args.seed ? parseInt(args.seed, 10) : undefined;

    // Stdin JSON payload mode: no path arg + piped stdin (hook compat)
    if (!args.path && !process.stdin.isTTY) {
      const raw = await Bun.stdin.text();
      try {
        const payload = JSON.parse(raw.trim()) as { transcript_path?: string };
        if (!payload.transcript_path) throw new Error("Missing transcript_path");
        resolvedPath = payload.transcript_path;
      } catch (err) {
        console.error(`[cli] index: failed to parse stdin: ${err}`);
        process.exit(1);
      }
    } else {
      resolvedPath = (args.path ?? `${homedir()}/.claude/projects/`).replace("~", process.env.HOME ?? "");
    }

    console.log(`[cli] Indexing: ${resolvedPath}${sessions ? ` (${sessions} sessions, seed=${seed ?? 42})` : ""}`);
    const db = openDb();
    try {
      await indexVault(db, resolvedPath, { force, sessions, seed });
    } finally {
      db.close();
      await disposeEmbedder();
    }
    process.exit(0);
  },
});

const serveCmd = defineCommand({
  meta: { name: "serve", description: "Start the qrec HTTP server (default: foreground)" },
  args: {
    daemon: { type: "boolean", description: "Run as background daemon", default: false },
    "no-open": { type: "boolean", description: "Do not open browser on start", default: false },
  },
  async run({ args }) {
    const noOpen = args["no-open"] ?? false;
    if (args.daemon) {
      await startDaemon();
      if (!noOpen) openBrowser();
    } else {
      if (!noOpen) setTimeout(openBrowser, 1000);
      await import("./server.ts");
    }
  },
});

const stopCmd = defineCommand({
  meta: { name: "stop", description: "Stop the qrec daemon" },
  async run() {
    await stopDaemon();
  },
});

const searchCmd = defineCommand({
  meta: { name: "search", description: 'Search sessions (omit query for browse mode sorted by date)' },
  args: {
    k:       { type: "string",  description: "Number of results", default: "10" },
    project: { type: "string",  description: "Filter by project name" },
    tag:     { type: "string",  description: "Filter by tag" },
    from:    { type: "string",  description: "Filter from date", valueHint: "YYYY-MM-DD" },
    to:      { type: "string",  description: "Filter to date",   valueHint: "YYYY-MM-DD" },
  },
  async run({ args }) {
    // All positional words (after the subcommand name) are the query.
    // citty puts them in args._ — this correctly handles multi-word queries
    // and produces an empty string when only flags are present (browse mode).
    const query   = args._.join(" ").trim();
    const k       = parseInt(args.k ?? "10", 10);
    const project = args.project ?? null;
    const tag     = args.tag     ?? null;
    const from    = args.from    ?? null;
    const to      = args.to      ?? null;

    if (query) {
      // POST /search — semantic + BM25 with optional filters
      const body: Record<string, unknown> = { query, k };
      if (project) body.project  = project;
      if (tag)     body.tag      = tag;
      if (from)    body.dateFrom = from;
      if (to)      body.dateTo   = to;
      const res = await fetch(`http://localhost:${getQrecPort()}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body2 = await res.json().catch(() => ({})) as { error?: string };
        console.error(`[cli] search failed (${res.status}): ${body2.error ?? "unknown error"}`);
        process.exit(1);
      }
      console.log(JSON.stringify(await res.json(), null, 2));
    } else {
      // GET /sessions — browse mode, date-sorted (no query)
      const params = new URLSearchParams({ offset: "0", limit: String(k) });
      if (project) params.set("project", project);
      if (tag)     params.set("tag",     tag);
      if (from)    params.set("dateFrom", from);
      if (to)      params.set("dateTo",   to);
      const res = await fetch(`http://localhost:${getQrecPort()}/sessions?${params}`);
      if (!res.ok) {
        const body2 = await res.json().catch(() => ({})) as { error?: string };
        console.error(`[cli] browse failed (${res.status}): ${body2.error ?? "unknown error"}`);
        process.exit(1);
      }
      const data = await res.json() as { sessions: Array<Record<string, unknown>>; total: number };
      const rows = data.sessions.map(s => ({
        id:      s.id,
        date:    s.date,
        project: s.project,
        title:   s.title,
        tags:    Array.isArray(s.tags) ? (s.tags as string[]).join(", ") : null,
        summary: typeof s.summary === "string" ? s.summary.slice(0, 120) + (s.summary.length > 120 ? "…" : "") : null,
      }));
      console.log(JSON.stringify(rows, null, 2));
    }
    process.exit(0);
  },
});

const getCmd = defineCommand({
  meta: { name: "get", description: "Print full session markdown" },
  args: {
    sessionId: { type: "positional", required: true, description: "Session ID (8-char hex or full UUID)" },
  },
  async run({ args }) {
    const sessionId = args.sessionId?.trim();
    if (!sessionId) {
      console.error("[cli] Usage: qrec get <session-id>");
      process.exit(1);
    }
    const res = await fetch(`http://localhost:${getQrecPort()}/sessions/${sessionId}/markdown`);
    if (res.status === 404) {
      console.error(`[cli] Session not found: ${sessionId}`);
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`[cli] get failed (${res.status})`);
      process.exit(1);
    }
    console.log(await res.text());
    process.exit(0);
  },
});

const statusCmd = defineCommand({
  meta: { name: "status", description: "Show daemon status, session counts, and log tail" },
  async run() {
    const db = openDb();
    try {
      const sessionRow    = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
      const chunkRow      = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };
      const lastIndexedRow = db.prepare("SELECT MAX(indexed_at) as last FROM sessions").get() as { last: number | null };

      const daemonPid    = getDaemonPid();
      const daemonRunning = daemonPid !== null;

      let httpHealth = "not checked";
      if (daemonRunning) {
        try {
          const res = await fetch(`http://localhost:${getQrecPort()}/health`);
          httpHealth = res.ok
            ? ((await res.json() as { status?: string }).status ?? "unknown")
            : `http error ${res.status}`;
        } catch {
          httpHealth = "unreachable";
        }
      }

      const lastIndexed = lastIndexedRow.last ? new Date(lastIndexedRow.last).toISOString() : "never";
      const version = typeof __QREC_VERSION__ !== "undefined" ? __QREC_VERSION__ : "(dev)";

      console.log("=== qrec status ===");
      console.log(`Version:        ${version}`);
      console.log(`Daemon PID:     ${daemonPid ?? "not running"}`);
      console.log(`HTTP health:    ${httpHealth}`);
      console.log(`Sessions:       ${sessionRow.count}`);
      console.log(`Chunks:         ${chunkRow.count}`);
      console.log(`Last indexed:   ${lastIndexed}`);

      if (process.platform === "linux") {
        const probe = probeGpu();
        console.log("");
        console.log("--- Compute ---");
        const backendSuffix = probe.selectedBackend === "cpu" && probe.gpuDetected ? " (fallback — CUDA libs missing)" : "";
        console.log(`Backend:        ${probe.selectedBackend}${backendSuffix}`);
        if (probe.gpuDetected) {
          console.log(`GPU:            ${probe.gpuName} (driver ${probe.driverVersion}, CUDA ${probe.cudaDriverVersion})`);
          console.log(`CUDA runtime:   ${probe.cudaRuntimeAvailable ? "available" : "NOT AVAILABLE"}`);
          if (probe.cudaRuntimeAvailable) {
            console.log(`Binary:         ${probe.activeBinaryName}`);
          } else {
            console.log(`  Missing libs: ${probe.missingLibs.join(", ")}`);
            if (probe.installSteps) {
              console.log(`  Fix:`);
              probe.installSteps.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
            }
          }
        } else {
          console.log("GPU:            none detected");
        }
        if (probe.vulkanAvailable) console.log("Vulkan:         available");
      }

      console.log("");
      console.log("--- Log tail (last 20 lines) ---");
      const tail = getLogTail(20);
      if (tail.length === 0) {
        console.log("(no log entries)");
      } else {
        for (const line of tail) console.log(line);
      }
    } finally {
      db.close();
    }
    process.exit(0);
  },
});

const enrichCmd = defineCommand({
  meta: { name: "enrich", description: "Summarize unenriched sessions (tags, entities, summaries)" },
  args: {
    limit:        { type: "string",  description: "Maximum sessions to process" },
    "min-age-ms": { type: "string",  description: "Minimum session age (ms) before enrichment" },
    force:        { type: "boolean", description: "Re-enrich all sessions regardless of enriched_at", default: false },
  },
  async run({ args }) {
    const limit    = args.limit          ? parseInt(args.limit, 10)          : undefined;
    const minAgeMs = args["min-age-ms"]  ? parseInt(args["min-age-ms"], 10)  : undefined;
    const force    = args.force ?? false;
    const { runEnrich } = await import("./enrich.ts");
    await runEnrich({ limit, minAgeMs, force });
    process.exit(0);
  },
});

const doctorCmd = defineCommand({
  meta: { name: "doctor", description: "Diagnose GPU/CUDA setup (Linux only)" },
  async run() {
    const probe = probeGpu();
    console.log("=== qrec doctor ===");
    console.log("");

    if (process.platform !== "linux") {
      console.log(`Platform: ${process.platform}`);
      console.log("Metal/GPU acceleration is handled automatically by node-llama-cpp on macOS.");
      console.log("No CUDA probe needed.");
      process.exit(0);
    }

    const OK   = (msg: string) => `[check] ${msg}`;
    const FAIL = (msg: string) => `[FAIL]  ${msg}`;
    const INFO = (msg: string) => `        ${msg}`;

    if (probe.gpuDetected) {
      console.log(OK(`NVIDIA GPU ............ ${probe.gpuName} (driver ${probe.driverVersion}, CUDA ${probe.cudaDriverVersion})`));
    } else {
      console.log(FAIL("NVIDIA GPU ............ not detected (nvidia-smi not found or no output)"));
    }

    for (const [name, lib] of Object.entries(probe.libProbes)) {
      if (lib.found) {
        console.log(OK(`${name.padEnd(14)} .... .so.${lib.soVersion} at ${lib.path}`));
      } else {
        console.log(FAIL(`${name.padEnd(14)} .... NOT FOUND`));
      }
    }

    if (probe.vulkanAvailable) {
      console.log(OK("Vulkan ................ available"));
    } else {
      console.log(OK("Vulkan ................ not found (optional)"));
    }

    if (probe.activeBinaryName) {
      console.log(OK(`node-llama-cpp binary . ${probe.activeBinaryName}`));
    }

    console.log("");

    if (probe.cudaRuntimeAvailable) {
      console.log(`Result: CUDA backend ready (${probe.activeBinaryName})`);
    } else if (probe.gpuDetected) {
      console.log("Result: CUDA libs missing — running on CPU (fallback)");
      console.log("");
      console.log("Fix:");
      if (probe.installSteps) {
        probe.installSteps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
      }
      if (probe.cudaRepoConfigured === false) {
        console.log("");
        console.log(INFO("Note: NVIDIA apt repo not found in /etc/apt/sources.list.d/"));
        console.log(INFO("      The wget step above adds it. Run apt-get update after."));
      }
    } else {
      console.log("Result: No NVIDIA GPU detected — running on CPU");
    }

    process.exit(0);
  },
});

// --- Main ---

const main = defineCommand({
  meta: {
    name: "qrec",
    description: "Session recall engine — semantic search over Claude Code sessions",
    version: typeof __QREC_VERSION__ !== "undefined" ? __QREC_VERSION__ : "(dev)",
  },
  subCommands: {
    teardown: teardownCmd,
    index:    indexCmd,
    serve:    serveCmd,
    stop:     stopCmd,
    search:   searchCmd,
    get:      getCmd,
    status:   statusCmd,
    enrich:   enrichCmd,
    doctor:   doctorCmd,
  },
});

runMain(main, { rawArgs: rawArgv });
