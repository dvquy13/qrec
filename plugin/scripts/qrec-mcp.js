#!/usr/bin/env node
// MCP stdio shim: finds bun, spawns qrec-mcp.cjs with streaming pipe stdio
const { spawn } = require("child_process");
const path = require("path");
const { findBun } = require("./bun-finder.js");

const bun = findBun();
if (!bun) {
  process.stderr.write("[qrec-mcp] ERROR: bun not found. Install from https://bun.sh\n");
  process.exit(1);
}

const qrecCjs = path.join(__dirname, "qrec-mcp.cjs");
const child = spawn(bun, ["run", qrecCjs], {
  stdio: ["pipe", "pipe", "inherit"], // stream stdin/stdout; inherit stderr for logs
  env: process.env,
});

process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);

child.on("exit", code => process.exit(code ?? 1));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
