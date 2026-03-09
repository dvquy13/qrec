#!/usr/bin/env node
// bun-runner.js — Plain Node.js Bun launcher
// Probes common Bun install paths and spawns Bun with the provided args.
// Buffers stdin before passing to Bun (workaround for Linux pipe safety).

"use strict";

const { spawnSync } = require("child_process");
const { existsSync } = require("fs");
const { homedir } = require("os");

const BUN_CANDIDATES = [
  require("path").join(homedir(), ".bun", "bin", "bun"),
  "/usr/local/bin/bun",
  "/opt/homebrew/bin/bun",
  "/home/linuxbrew/.linuxbrew/bin/bun",
];

function findBun() {
  for (const candidate of BUN_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  // Try in PATH
  try {
    const result = spawnSync("which", ["bun"], { encoding: "utf-8", timeout: 3000 });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  } catch {}
  return null;
}

function main() {
  const bunPath = findBun();
  if (!bunPath) {
    process.stderr.write(
      "[bun-runner] ERROR: bun not found. Install from https://bun.sh or run node smart-install.js\n"
    );
    process.exit(1);
  }

  const args = process.argv.slice(2); // everything after bun-runner.js

  // Buffer stdin to avoid Bun libuv crash on Linux when receiving piped input from Claude Code hooks
  const stdinChunks = [];
  process.stdin.on("data", chunk => stdinChunks.push(chunk));
  process.stdin.on("end", () => {
    const stdinBuffer = Buffer.concat(stdinChunks);

    const result = spawnSync(bunPath, args, {
      input: stdinBuffer.length > 0 ? stdinBuffer : undefined,
      stdio: stdinBuffer.length > 0 ? ["pipe", "inherit", "inherit"] : ["ignore", "inherit", "inherit"],
      env: process.env,
    });

    process.exit(result.status ?? 1);
  });

  // Handle non-piped case (stdin not providing data — end event may not fire promptly)
  if (!process.stdin.isTTY) {
    // Already listening above
  } else {
    process.stdin.destroy();
    const result = spawnSync(bunPath, args, {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });
    process.exit(result.status ?? 1);
  }
}

main();
