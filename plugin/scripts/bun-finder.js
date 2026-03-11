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

module.exports = { findBun };
