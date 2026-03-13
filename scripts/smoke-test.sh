#!/usr/bin/env bash
set -e

echo "[smoke-test] Building..."
node scripts/build.js

echo "[smoke-test] Verifying artifact..."
test -f plugin/scripts/qrec.cjs
echo "[smoke-test] plugin/scripts/qrec.cjs exists."

echo "[smoke-test] Running bun install in plugin dir..."
cd plugin && bun install && cd ..

echo "[smoke-test] Starting daemon via compiled CJS (simulates npm install)..."
# Must use qrec.cjs directly — NOT bun run src/cli.ts.
# bun source mode sets import.meta.dir and never exercises the CJS __dirname path,
# which caused a silent UI 404 bug that smoke-test missed.
# QREC_EMBED_PROVIDER=stub skips model loading so the daemon is instantly ready.
QREC_EMBED_PROVIDER=stub bun run plugin/scripts/qrec.cjs serve --daemon --no-open

echo "[smoke-test] Health check..."
curl -sf http://localhost:25927/health
echo ""

echo "[smoke-test] Search..."
curl -sf -X POST http://localhost:25927/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"test","k":5}'
echo ""

echo "[smoke-test] UI assets (catches wrong __dirname path in CJS)..."
curl -sf -o /dev/null http://localhost:25927/ui/styles.css   && echo "  OK  styles.css"
curl -sf -o /dev/null http://localhost:25927/ui/app.js       && echo "  OK  app.js"
curl -sf -o /dev/null http://localhost:25927/ui/fonts/InterVariable.woff2 && echo "  OK  font"

echo "[smoke-test] Stopping daemon..."
bun run plugin/scripts/qrec.cjs stop

echo "[smoke-test] PASSED"
