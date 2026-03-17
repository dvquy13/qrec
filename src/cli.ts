#!/usr/bin/env bun
// src/cli.ts
// Commands: qrec teardown, qrec index, qrec serve [--daemon],
//           qrec stop, qrec mcp [--http], qrec status

import { openDb } from "./db.ts";
import { indexVault } from "./indexer.ts";
import { disposeEmbedder } from "./embed/local.ts";
import { startDaemon, stopDaemon, getDaemonPid } from "./daemon.ts";
import { existsSync, readFileSync, rmSync } from "fs";
import { homedir } from "os";
import { QREC_DIR, LOG_FILE } from "./dirs.ts";
import { probeGpu } from "./gpu-probe.ts";

const [, , command, ...args] = process.argv;

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
  try { Bun.spawnSync([cmd, "http://localhost:25927"]); } catch {}
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
        const vaultPath = args[0] ?? `${homedir()}/.claude/projects/`;
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

    case "mcp": {
      const useHttp = args.includes("--http");
      const { runMcpServer } = await import("./mcp.ts");
      await runMcpServer(useHttp);
      break;
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
            const res = await fetch("http://localhost:25927/health");
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

        console.log("=== qrec status ===");
        console.log(`Daemon PID:     ${daemonPid ?? "not running"}`);
        console.log(`HTTP health:    ${httpHealth}`);
        console.log(`Sessions:       ${sessionRow.count}`);
        console.log(`Chunks:         ${chunkRow.count}`);
        console.log(`Last indexed:   ${lastIndexed}`);
        if (process.platform === "linux") {
          const probe = probeGpu();
          console.log("");
          console.log("--- Compute ---");
          console.log(`Backend:        ${probe.selectedBackend}`);
          if (probe.gpuDetected) {
            console.log(`GPU:            ${probe.gpuName} (driver ${probe.driverVersion}, CUDA ${probe.cudaDriverVersion})`);
            console.log(`CUDA runtime:   ${probe.cudaRuntimeAvailable ? "available" : "NOT AVAILABLE"}`);
            if (probe.missingLibs.length > 0) {
              console.log(`  Missing libs: ${probe.missingLibs.join(", ")}`);
              const ver = probe.cudaDriverVersion !== "unknown" ? probe.cudaDriverVersion!.split(".").slice(0, 2).join("-") : "12";
              console.log(`  Fix:          apt install -y cuda-toolkit-${ver}`);
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

      console.log("GPU Hardware");
      if (probe.gpuDetected) {
        console.log(`  Device:         ${probe.gpuName}`);
        console.log(`  Driver:         ${probe.driverVersion}`);
        console.log(`  CUDA (driver):  ${probe.cudaDriverVersion}`);
      } else {
        console.log("  No NVIDIA GPU detected (nvidia-smi not found or returned no output)");
      }

      console.log("");
      console.log("CUDA Runtime Libraries");

      if (probe.gpuDetected) {
        const allLibs = ["libcudart", "libcublas", "libcublasLt"];
        for (const lib of allLibs) {
          const missing = probe.missingLibs.includes(lib);
          console.log(`  ${lib.padEnd(14)}  ${missing ? "NOT FOUND" : "found"}`);
        }
        console.log("");
        if (probe.cudaRuntimeAvailable) {
          console.log("  Status: CUDA runtime available ✓");
        } else {
          console.log("  Status: CUDA runtime not available");
          const ver = probe.cudaDriverVersion !== "unknown" ? probe.cudaDriverVersion!.split(".").slice(0, 2).join("-") : "12";
          console.log("");
          console.log("  To fix:");
          console.log(`    sudo apt install -y cuda-toolkit-${ver}`);
          console.log("    # or for runtime-only:");
          console.log("    sudo apt install -y libcudart12 libcublas12");
        }
      } else {
        console.log("  (skipped — no NVIDIA GPU detected)");
      }

      console.log("");
      console.log("Vulkan");
      console.log(`  libvulkan:      ${probe.vulkanAvailable ? "found" : "NOT FOUND"}`);

      console.log("");
      console.log(`Active Backend: ${probe.selectedBackend.toUpperCase()}${probe.selectedBackend === "cpu" && probe.gpuDetected ? " (fallback)" : ""}`);

      if (!probe.cudaRuntimeAvailable && probe.gpuDetected) {
        console.log("");
        console.log("After installing CUDA libs, restart qrec:");
        console.log("  qrec teardown && qrec serve --daemon");
      }

      process.exit(0);
    }

    default: {
      console.error(`Unknown command: ${command}`);
      console.error("Usage:");
      console.error("  qrec teardown [--yes]             # remove all qrec data");
      console.error("  qrec index [path] [--force]       # default: ~/.claude/projects/");
      console.error("  qrec index                        # stdin JSON {transcript_path} (hook mode)");
      console.error("  qrec serve [--daemon] [--no-open]");
      console.error("  qrec stop");
      console.error("  qrec mcp [--http]");
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
