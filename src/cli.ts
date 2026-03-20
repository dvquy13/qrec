#!/usr/bin/env bun
// src/cli.ts
// Commands: qrec teardown, qrec index, qrec serve [--daemon],
//           qrec stop, qrec search, qrec get, qrec status

import { openDb } from "./db.ts";
import { indexVault } from "./indexer.ts";
import { disposeEmbedder } from "./embed/local.ts";
import { startDaemon, stopDaemon, getDaemonPid } from "./daemon.ts";
import { existsSync, readFileSync, rmSync } from "fs";
import { homedir } from "os";
import { QREC_DIR, LOG_FILE, getQrecPort } from "./dirs.ts";
import { probeGpu } from "./gpu-probe.ts";

const [, , command, ...args] = process.argv;

// Parse --port early so it's available before any module reads process.env.QREC_PORT.
// (dirs.ts exports getQrecPort() which reads process.env at call time, not module load time.)
{
  const portIdx = args.indexOf("--port");
  if (portIdx !== -1) {
    const portVal = args[portIdx + 1];
    if (!portVal || isNaN(parseInt(portVal, 10))) {
      console.error("[cli] --port requires a numeric value");
      process.exit(1);
    }
    process.env.QREC_PORT = portVal;
    args.splice(portIdx, 2); // remove --port <n> from args
  }
}

function getLogTail(lines: number = 20): string[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const content = readFileSync(LOG_FILE, "utf-8");
    const allLines = content.split("\n").filter(l => l.length > 0);
    return allLines.slice(-lines);
  } catch {
    return [];
  }
}

function openBrowser() {
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  try { Bun.spawnSync([cmd, `http://localhost:${getQrecPort()}`]); } catch {}
}

async function main() {
  switch (command) {
    case "--version":
    case "-v": {
      const version = typeof __QREC_VERSION__ !== "undefined" ? __QREC_VERSION__ : "(dev)";
      console.log(`qrec ${version}`);
      process.exit(0);
    }

    case "teardown": {
      const yes = args.includes("--yes");

      await stopDaemon();

      if (!existsSync(QREC_DIR)) {
        console.log("[teardown] ~/.qrec/ not found, nothing to remove.");
        process.exit(0);
      }

      if (!yes) {
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
    }

    case "index": {
      let resolvedPath: string;
      let force = false;
      let sessions: number | undefined;
      let seed: number | undefined;

      // Stdin JSON payload mode: no args + piped stdin (hook compat)
      if (!args[0] && !process.stdin.isTTY) {
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
        const vaultPath = args.find(a => !a.startsWith("--")) ?? `${homedir()}/.claude/projects/`;
        force = args.includes("--force");
        const sessionsIdx = args.indexOf("--sessions");
        sessions = sessionsIdx !== -1 ? parseInt(args[sessionsIdx + 1], 10) : undefined;
        const seedIdx = args.indexOf("--seed");
        seed = seedIdx !== -1 ? parseInt(args[seedIdx + 1], 10) : undefined;
        resolvedPath = vaultPath.replace("~", process.env.HOME ?? "");
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
    }

    case "serve": {
      const daemon = args.includes("--daemon");
      const noOpen = args.includes("--no-open");

      if (daemon) {
        await startDaemon();
        if (!noOpen) openBrowser();
      } else {
        if (!noOpen) setTimeout(openBrowser, 1000);
        await import("./server.ts");
      }
      break;
    }

    case "stop": {
      await stopDaemon();
      break;
    }

    case "search": {
      const query = args.filter(a => !a.startsWith("--")).join(" ").trim();
      if (!query) {
        console.error('[cli] Usage: qrec search "<query>" [--k N]');
        process.exit(1);
      }
      const kIdx = args.indexOf("--k");
      const k = kIdx !== -1 ? parseInt(args[kIdx + 1], 10) : 10;
      const res = await fetch(`http://localhost:${getQrecPort()}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, k }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        console.error(`[cli] search failed (${res.status}): ${body.error ?? "unknown error"}`);
        process.exit(1);
      }
      console.log(JSON.stringify(await res.json(), null, 2));
      process.exit(0);
    }

    case "get": {
      const sessionId = args[0]?.trim();
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
    }

    case "status": {
      const db = openDb();
      try {
        const sessionRow = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
        const chunkRow = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };
        const lastIndexedRow = db
          .prepare("SELECT MAX(indexed_at) as last FROM sessions")
          .get() as { last: number | null };

        const daemonPid = getDaemonPid();
        const daemonRunning = daemonPid !== null;

        let httpHealth = "not checked";
        if (daemonRunning) {
          try {
            const res = await fetch(`http://localhost:${getQrecPort()}/health`);
            if (res.ok) {
              const data = await res.json() as { status?: string };
              httpHealth = data.status ?? "unknown";
            } else {
              httpHealth = `http error ${res.status}`;
            }
          } catch {
            httpHealth = "unreachable";
          }
        }

        const lastIndexed = lastIndexedRow.last
          ? new Date(lastIndexedRow.last).toISOString()
          : "never";

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
    }

    case "enrich": {
      const limitIdx = args.indexOf("--limit");
      const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;
      const minAgeIdx = args.indexOf("--min-age-ms");
      const minAgeMs = minAgeIdx !== -1 ? parseInt(args[minAgeIdx + 1], 10) : undefined;
      const { runEnrich } = await import("./enrich.ts");
      await runEnrich({ limit, minAgeMs });
      process.exit(0);
    }

    case "doctor": {
      const probe = probeGpu();
      console.log("=== qrec doctor ===");
      console.log("");

      if (process.platform !== "linux") {
        console.log(`Platform: ${process.platform}`);
        console.log("Metal/GPU acceleration is handled automatically by node-llama-cpp on macOS.");
        console.log("No CUDA probe needed.");
        process.exit(0);
      }

      // Checklist helpers
      const OK   = (msg: string) => `[check] ${msg}`;
      const FAIL = (msg: string) => `[FAIL]  ${msg}`;
      const INFO = (msg: string) => `        ${msg}`;

      // GPU
      if (probe.gpuDetected) {
        console.log(OK(`NVIDIA GPU ............ ${probe.gpuName} (driver ${probe.driverVersion}, CUDA ${probe.cudaDriverVersion})`));
      } else {
        console.log(FAIL("NVIDIA GPU ............ not detected (nvidia-smi not found or no output)"));
      }

      // CUDA libs
      for (const [name, lib] of Object.entries(probe.libProbes)) {
        if (lib.found) {
          console.log(OK(`${name.padEnd(14)} .... .so.${lib.soVersion} at ${lib.path}`));
        } else {
          console.log(FAIL(`${name.padEnd(14)} .... NOT FOUND`));
        }
      }

      // Vulkan
      if (probe.vulkanAvailable) {
        console.log(OK("Vulkan ................ available"));
      } else {
        console.log(OK("Vulkan ................ not found (optional)"));
      }

      // Binary
      if (probe.activeBinaryName) {
        console.log(OK(`node-llama-cpp binary . ${probe.activeBinaryName}`));
      }

      console.log("");

      // Summary
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
    }

    default: {
      console.error(`Unknown command: ${command}`);
      console.error("Usage:");
      console.error("  qrec teardown [--yes]             # remove all qrec data");
      console.error("  qrec index [path] [--force]       # default: ~/.claude/projects/");
      console.error("  qrec index                        # stdin JSON {transcript_path} (hook mode)");
      console.error("  qrec serve [--daemon] [--no-open] [--port N]");
      console.error("  qrec stop");
      console.error('  qrec search "<query>" [--k N]   # search indexed sessions');
      console.error("  qrec get <session-id>            # print full session markdown");
      console.error("  qrec status");
      console.error("  qrec enrich [--limit N]           # summarize unenriched sessions");
      console.error("  qrec doctor                       # diagnose GPU/CUDA setup");
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
