#!/usr/bin/env node
// qrec-cli.js — npm bin entry. Locates bun and spawns qrec.cjs with all CLI args.

"use strict";

const { spawnSync, spawn } = require("child_process");
const path = require("path");
const { findBun } = require("./bun-finder.js");

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

// TTY: pass stdin directly so interactive prompts (e.g. teardown Y/N) work.
if (process.stdin.isTTY) {
  const result = spawnSync(bunPath, bunArgs, {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

// Non-TTY (hook/pipe): buffer stdin before passing to bun (avoids libuv pipe crash on Linux).
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
