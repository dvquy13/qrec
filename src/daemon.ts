// src/daemon.ts
// PID-file daemon management: start (detached child) + stop (SIGTERM)

import { join } from "path";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { QREC_DIR, PID_FILE, LOG_FILE, QREC_PORT } from "./dirs.ts";

function ensureQrecDir(): void {
  mkdirSync(QREC_DIR, { recursive: true });
}

export function isDaemonRunning(): boolean {
  if (!existsSync(PID_FILE)) return false;

  const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
  if (isNaN(pid)) return false;

  try {
    // Signal 0 checks if process exists without sending a signal
    process.kill(pid, 0);
    return true;
  } catch {
    // Process doesn't exist — clean up stale PID file
    try {
      unlinkSync(PID_FILE);
    } catch {}
    return false;
  }
}

export function getDaemonPid(): number | null {
  if (!existsSync(PID_FILE)) return null;
  const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
  return isNaN(pid) ? null : pid;
}

export async function startDaemon(): Promise<void> {
  if (isDaemonRunning()) {
    const pid = getDaemonPid();
    console.log(`[daemon] qrec server already running (PID ${pid})`);
    return;
  }

  // Kill any orphaned process still holding the port (escaped pid-file tracking)
  try {
    const r = Bun.spawnSync(["lsof", "-ti", `:${QREC_PORT}`], { stdio: ["ignore", "pipe", "ignore"] });
    const pids = new TextDecoder().decode(r.stdout).trim().split("\n").filter(Boolean);
    for (const p of pids) { try { process.kill(parseInt(p), "SIGKILL"); } catch {} }
    if (pids.length > 0) await Bun.sleep(300);
  } catch {}

  ensureQrecDir();

  const logFile = LOG_FILE;

  // In Bun ESM (dev): spawn server.ts directly.
  // In compiled CJS bundle: spawn self (process.argv[1]) with "serve" — import.meta.dir is unavailable.
  const spawnArgs: string[] =
    typeof (import.meta as { dir?: string }).dir === "string"
      ? ["bun", "run", join((import.meta as { dir: string }).dir, "server.ts")]
      : [process.argv[0], process.argv[1], "serve"];

  // Spawn detached child process
  const child = Bun.spawn(spawnArgs, {
    detached: true,
    stdio: ["ignore", Bun.file(logFile), Bun.file(logFile)],
  });

  const pid = child.pid;
  writeFileSync(PID_FILE, String(pid), "utf-8");
  child.unref(); // Allow parent to exit

  console.log(`[daemon] qrec server started (PID ${pid})`);
  console.log(`[daemon] Logs: ${logFile}`);
  console.log(`[daemon] Waiting for server to be ready...`);

  // Wait for server to be ready (poll health endpoint)
  const deadline = Date.now() + 30_000; // 30 second timeout (model load time)
  let ready = false;

  while (Date.now() < deadline) {
    await Bun.sleep(500);
    try {
      const res = await fetch(`http://localhost:${QREC_PORT}/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // Not ready yet
    }
  }

  if (ready) {
    console.log(`[daemon] Server ready at http://localhost:${QREC_PORT}`);
  } else {
    console.error(`[daemon] Server failed to start within 30 seconds. Check logs: ${logFile}`);
    process.exit(1);
  }
}

export async function stopDaemon(): Promise<void> {
  if (!isDaemonRunning()) {
    console.log("[daemon] No running qrec server found.");
    return;
  }

  const pid = getDaemonPid()!;
  try {
    process.kill(pid, "SIGTERM");
    console.log(`[daemon] Sent SIGTERM to PID ${pid}`);

    // Wait for process to exit
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      await Bun.sleep(200);
      try {
        process.kill(pid, 0);
        // Still running
      } catch {
        // Process exited
        break;
      }
    }
  } catch (err) {
    console.error(`[daemon] Failed to send SIGTERM: ${err}`);
  }

  // Clean up PID file
  try {
    unlinkSync(PID_FILE);
  } catch {}
  console.log("[daemon] qrec server stopped.");
}
