#!/usr/bin/env bun
// src/cli.ts
// Commands: `qrec index`, `qrec serve [--daemon]`, `qrec stop`, `qrec mcp [--http]`, `qrec status`

import { openDb } from "./db.ts";
import { indexVault } from "./indexer.ts";
import { disposeEmbedder } from "./embed/local.ts";
import { startDaemon, stopDaemon, getDaemonPid } from "./daemon.ts";
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync } from "fs";

const [, , command, ...args] = process.argv;

const LOG_FILE = join(homedir(), ".qrec", "qrec.log");

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

async function main() {
  switch (command) {
    case "--version":
    case "-v": {
      console.log(`qrec ${__QREC_VERSION__}`);
      process.exit(0);
    }

    case "index": {
      const vaultPath = args[0] ?? `${homedir()}/.claude/projects/`;
      const force = args.includes("--force");
      const sessionsIdx = args.indexOf("--sessions");
      const sessions = sessionsIdx !== -1 ? parseInt(args[sessionsIdx + 1], 10) : undefined;
      const seedIdx = args.indexOf("--seed");
      const seed = seedIdx !== -1 ? parseInt(args[seedIdx + 1], 10) : undefined;
      const resolvedPath = vaultPath.replace("~", process.env.HOME ?? "");

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

    case "index-session": {
      // Single-session indexing — called by the SessionEnd hook.
      // Accepts a path as argument OR reads a JSON payload from stdin.
      let transcriptPath: string;
      if (args[0]) {
        transcriptPath = args[0].replace("~", process.env.HOME ?? "");
      } else {
        const raw = await Bun.stdin.text();
        try {
          const payload = JSON.parse(raw.trim()) as { transcript_path?: string };
          if (!payload.transcript_path) throw new Error("Missing transcript_path");
          transcriptPath = payload.transcript_path;
        } catch (err) {
          console.error(`[cli] index-session: failed to parse stdin: ${err}`);
          process.exit(1);
        }
      }

      console.log(`[cli] Indexing session: ${transcriptPath}`);
      const db = openDb();
      try {
        await indexVault(db, transcriptPath, {});
      } finally {
        db.close();
        await disposeEmbedder();
      }
      process.exit(0);
    }

    case "serve": {
      const daemon = args.includes("--daemon");

      if (daemon) {
        await startDaemon();
      } else {
        // Run server in-process (blocking) — import the server module which starts serving
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
            const res = await fetch("http://localhost:3030/health");
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
          for (const line of tail) {
            console.log(line);
          }
        }
      } finally {
        db.close();
      }
      process.exit(0);
    }

    default: {
      console.error(`Unknown command: ${command}`);
      console.error("Usage:");
      console.error("  qrec index [source_path] [--force]         # default: ~/.claude/projects/");
      console.error("  qrec index-session <path.jsonl>            # index a single session");
      console.error("  qrec index-session                         # read JSON payload from stdin (hook mode)");
      console.error("  qrec serve [--daemon]");
      console.error("  qrec stop");
      console.error("  qrec mcp [--http]");
      console.error("  qrec status");
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
