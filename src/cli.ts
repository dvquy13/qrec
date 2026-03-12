#!/usr/bin/env bun
// src/cli.ts
// Commands: qrec onboard, qrec teardown, qrec index, qrec serve [--daemon],
//           qrec stop, qrec mcp [--http], qrec status

import { openDb } from "./db.ts";
import { indexVault } from "./indexer.ts";
import { disposeEmbedder } from "./embed/local.ts";
import { startDaemon, stopDaemon, getDaemonPid } from "./daemon.ts";
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, rmSync } from "fs";

const [, , command, ...args] = process.argv;

const LOG_FILE = join(homedir(), ".qrec", "qrec.log");
const QREC_DIR = join(homedir(), ".qrec");

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
  try { Bun.spawnSync([cmd, "http://localhost:25729"]); } catch {}
}

async function main() {
  switch (command) {
    case "--version":
    case "-v": {
      const version = typeof __QREC_VERSION__ !== "undefined" ? __QREC_VERSION__ : "(dev)";
      console.log(`qrec ${version}`);
      process.exit(0);
    }

    case "onboard": {
      const noOpen = args.includes("--no-open");

      // Start daemon first — server binds immediately, model loads async in background.
      // startDaemon() polls /health until the port is open (~1-2s), then returns.
      await startDaemon();

      // Open browser now — the UI handles "not ready" state with its own progress bars.
      if (!noOpen) openBrowser();

      // ── ncurses-style progress renderer ────────────────────────────────────
      interface StatusResp {
        phase: string;
        sessions: number;
        modelDownload: { percent: number; downloadedMB: number; totalMB: number | null };
        indexing: { indexed: number; total: number; current: string };
      }
      const SPINNER = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
      const BAR_W = 22;
      const bar = (pct: number) => {
        const f = Math.min(BAR_W, Math.round(pct * BAR_W / 100));
        return "█".repeat(f) + "░".repeat(BAR_W - f);
      };

      let prevLines = 0;
      let tick = 0;

      const render = (s: StatusResp) => {
        const { phase, modelDownload: dl, indexing: idx } = s;
        const sp = SPINNER[tick % SPINNER.length];
        const modelDone = ["indexing", "ready"].includes(phase);
        const indexDone = phase === "ready";
        const indexActive = phase === "indexing";
        const W = 46;
        const lines: string[] = [
          "",
          `  qrec — setting up`,
          `  ${"─".repeat(W)}`,
        ];

        // Step 1: model
        if (phase === "model_download") {
          const pct = dl.percent;
          lines.push(`  ${sp}  [1/3] Downloading model`);
          lines.push(`        ${bar(pct)}  ${pct}%  (${dl.downloadedMB.toFixed(0)} / ${dl.totalMB?.toFixed(0) ?? "?"} MB)`);
        } else if (phase === "model_loading") {
          lines.push(`  ${sp}  [1/3] Loading model into memory…`);
          lines.push("");
        } else {
          lines.push(`  ✓  [1/3] Model ready`);
          lines.push("");
        }

        // Step 2: indexing
        if (!modelDone) {
          lines.push(`  ·  [2/3] Index sessions`);
          lines.push("");
        } else if (indexActive) {
          const pct = idx.total > 0 ? Math.round(idx.indexed * 100 / idx.total) : 0;
          lines.push(`  ${sp}  [2/3] Indexing sessions`);
          lines.push(`        ${bar(pct)}  ${pct}%  (${idx.indexed}/${idx.total})  ${idx.current}`);
        } else {
          lines.push(`  ✓  [2/3] Sessions indexed  (${s.sessions} sessions)`);
          lines.push("");
        }

        // Step 3: ready
        if (indexDone) {
          lines.push(`  ✓  [3/3] Ready  →  http://localhost:25729`);
        } else {
          lines.push(`  ·  [3/3] Ready`);
        }

        lines.push(`  ${"─".repeat(W)}`);
        lines.push("");

        // Move cursor up and overwrite previous block
        if (prevLines > 0) process.stdout.write(`\x1b[${prevLines}A`);
        for (const line of lines) process.stdout.write(`\x1b[2K${line}\n`);
        prevLines = lines.length;
      };

      // Poll /status until ready
      while (true) {
        try {
          const r = await fetch("http://localhost:25729/status");
          if (r.ok) {
            const s = await r.json() as StatusResp;
            render(s);
            if (s.phase === "ready") break;
          }
        } catch {}
        tick++;
        await Bun.sleep(500);
      }

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
            const res = await fetch("http://localhost:25729/health");
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
      const { runEnrich } = await import("./enrich.ts");
      await runEnrich({ limit });
      process.exit(0);
    }

    default: {
      console.error(`Unknown command: ${command}`);
      console.error("Usage:");
      console.error("  qrec onboard [--no-open]          # first-time setup");
      console.error("  qrec teardown [--yes]             # remove all qrec data");
      console.error("  qrec index [path] [--force]       # default: ~/.claude/projects/");
      console.error("  qrec index                        # stdin JSON {transcript_path} (hook mode)");
      console.error("  qrec serve [--daemon] [--no-open]");
      console.error("  qrec stop");
      console.error("  qrec mcp [--http]");
      console.error("  qrec status");
      console.error("  qrec enrich [--limit N]           # summarize unenriched sessions");
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
