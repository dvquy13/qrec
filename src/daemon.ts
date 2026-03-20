// src/daemon.ts
// PID-file daemon management: start (detached child) + stop (SIGTERM)

import { join } from "path";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { QREC_DIR, PID_FILE, ENRICH_PID_FILE, LOG_FILE, getQrecPort } from "./dirs.ts";

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

  // Kill any orphaned process still holding the port (escaped pid-file tracking).
  // Try lsof first (macOS + most Linux), fall back to ss (Debian/Ubuntu minimal images).
  try {
    let pids: string[] = [];
    const lsof = Bun.spawnSync(["lsof", "-ti", `:${getQrecPort()}`], { stdio: ["ignore", "pipe", "ignore"] });
    if (lsof.exitCode === 0) {
      pids = new TextDecoder().decode(lsof.stdout).trim().split("\n").filter(Boolean);
    } else {
      // lsof not available — use ss (iproute2, standard on Ubuntu/Debian/Alpine)
      const ss = Bun.spawnSync(["ss", "-tlnp", `sport = :${getQrecPort()}`], { stdio: ["ignore", "pipe", "ignore"] });
      const ssOut = new TextDecoder().decode(ss.stdout);
      // ss output: "LISTEN  0  128  *:25927  *:*  users:(("bun",pid=1234,fd=5))"
      const m = ssOut.match(/pid=(\d+)/g);
      if (m) pids = m.map(s => s.replace("pid=", ""));
    }
    for (const p of pids) { try { process.kill(parseInt(p), "SIGKILL"); } catch {} }
    if (pids.length > 0) await Bun.sleep(300);
  } catch {}

  ensureQrecDir();

  // Truncate log on each daemon start — daemon output is buffered and not useful for live tailing;
  // activity.jsonl is the durable audit trail. Prevents megabyte log files from accumulating across restarts.
  const logFile = LOG_FILE;
  try { writeFileSync(logFile, ""); } catch {}

  // In Bun ESM (dev): spawn server.ts directly.
  // In compiled CJS bundle: spawn self (process.argv[1]) with "serve" — import.meta.dir is unavailable.
  const spawnArgs: string[] =
    typeof (import.meta as { dir?: string }).dir === "string"
      ? ["bun", "run", join((import.meta as { dir: string }).dir, "server.ts")]
      : [process.argv[0], process.argv[1], "serve"];

  // Spawn detached child process.
  // Explicitly pass process.env so mutations (e.g. --port sets QREC_PORT after module load)
  // are inherited by the child — Bun.spawn does not inherit post-startup env mutations by default.
  const child = Bun.spawn(spawnArgs, {
    detached: true,
    stdio: ["ignore", Bun.file(logFile), Bun.file(logFile)],
    env: process.env,
  });

  const pid = child.pid;
  writeFileSync(PID_FILE, String(pid), "utf-8");
  child.unref(); // Allow parent to exit

  console.log(`[daemon] qrec server started (PID ${pid})`);
  console.log(`[daemon] Logs: ${logFile}`);
  console.log(`[daemon] Waiting for server to be ready...`);

  // Wait for server to be ready (poll health endpoint).
  // Default 120s — model loading on CPU-only Linux is much slower than M2 Metal.
  // Override with QREC_DAEMON_TIMEOUT_MS env var.
  const timeoutMs = parseInt(process.env.QREC_DAEMON_TIMEOUT_MS ?? "120000", 10);
  const deadline = Date.now() + timeoutMs;
  let ready = false;

  while (Date.now() < deadline) {
    await Bun.sleep(500);
    try {
      const res = await fetch(`http://localhost:${getQrecPort()}/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // Not ready yet
    }
  }

  if (ready) {
    console.log(`[daemon] Server ready at http://localhost:${getQrecPort()}`);
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

  // Kill enrich child if still running
  try {
    const enrichPidStr = existsSync(ENRICH_PID_FILE) ? readFileSync(ENRICH_PID_FILE, "utf8").trim() : null;
    const enrichPid = enrichPidStr ? parseInt(enrichPidStr, 10) : null;
    if (enrichPid) {
      process.kill(enrichPid, "SIGTERM");
      console.log(`[daemon] Sent SIGTERM to enrich PID ${enrichPid}`);
    }
  } catch {}
  try { unlinkSync(ENRICH_PID_FILE); } catch {}

  // Clean up PID file
  try {
    unlinkSync(PID_FILE);
  } catch {}
  console.log("[daemon] qrec server stopped.");
}
