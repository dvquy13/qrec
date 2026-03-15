"use strict";
const { spawnSync } = require("child_process");
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

function installBun() {
  process.stderr.write("[qrec] bun not found — installing bun (https://bun.sh)...\n");
  const result = spawnSync(
    "sh",
    ["-c", "curl -fsSL https://bun.sh/install | bash"],
    { stdio: "inherit", timeout: 120_000 }
  );
  if (result.status !== 0) return false;
  process.stderr.write("[qrec] bun installed.\n");
  return true;
}

module.exports = { findBun, installBun };
