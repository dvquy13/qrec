#!/usr/bin/env node
// qrec-cli.js — npm bin entry. Locates bun and spawns qrec.cjs with all CLI args.

"use strict";

const { spawnSync, spawn } = require("child_process");
const { existsSync } = require("fs");
const { homedir } = require("os");
const path = require("path");

const BUN_CANDIDATES = [
  path.join(homedir(), ".bun", "bin", "bun"),
  "/usr/local/bin/bun",
  "/opt/homebrew/bin/bun",
  "/home/linuxbrew/.linuxbrew/bin/bun",
];

function findBun() {
  for (const candidate of BUN_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  try {
    const r = spawnSync("which", ["bun"], { encoding: "utf-8", timeout: 3000 });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch {}
  return null;
}

const bunPath = findBun();
if (!bunPath) {
  process.stderr.write("[qrec] ERROR: bun not found. Install from https://bun.sh\n");
  process.exit(1);
}

const qrecCjs = path.join(__dirname, "qrec.cjs");
const userArgs = process.argv.slice(2);
const bunArgs = ["run", qrecCjs, ...userArgs];

// serve --daemon: fire-and-fork so the hook returns immediately.
// Claude Code hooks never close stdin, so blocking on stdin would hang forever.
if (userArgs.includes("serve") && userArgs.includes("--daemon")) {
  const child = spawn(bunPath, bunArgs, {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  process.exit(0);
}

// Buffer stdin before passing to bun (avoids libuv pipe crash on Linux).
const stdinChunks = [];
process.stdin.on("data", chunk => stdinChunks.push(chunk));
process.stdin.on("end", () => {
  const buf = Buffer.concat(stdinChunks);
  const result = spawnSync(bunPath, bunArgs, {
    input: buf.length > 0 ? buf : undefined,
    stdio: buf.length > 0 ? ["pipe", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
    env: process.env,
  });
  process.exit(result.status ?? 1);
});

if (process.stdin.isTTY) {
  process.stdin.destroy();
  const result = spawnSync(bunPath, bunArgs, {
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
  process.exit(result.status ?? 1);
}
