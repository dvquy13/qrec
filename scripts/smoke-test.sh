#!/usr/bin/env bash
set -e

echo "[smoke-test] Building..."
node scripts/build.js

echo "[smoke-test] Verifying artifact..."
test -f plugin/scripts/qrec.cjs
echo "[smoke-test] plugin/scripts/qrec.cjs exists."

echo "[smoke-test] Running bun install in plugin dir..."
cd plugin && bun install && cd ..

echo "[smoke-test] Starting daemon..."
bun run src/cli.ts serve --daemon

echo "[smoke-test] Health check..."
curl -sf http://localhost:25927/health
echo ""

echo "[smoke-test] Search..."
curl -sf -X POST http://localhost:25927/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"test","k":5}'
echo ""

echo "[smoke-test] Stopping daemon..."
bun run src/cli.ts stop

echo "[smoke-test] PASSED"
