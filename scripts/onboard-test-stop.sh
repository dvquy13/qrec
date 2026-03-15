#!/bin/bash
# Stop the onboarding test environment:
#   - Stops the test daemon
#   - Removes the isolated QREC_DIR and temp sessions dir
#   - Restarts the real daemon
set -euo pipefail

STATE_FILE="$HOME/.qrec/.onboard-test-state"

if [ ! -f "$STATE_FILE" ]; then
  echo "No test env active."
  exit 0
fi

TEST_DIR=$(sed -n '1p' "$STATE_FILE")
SESSIONS_DIR=$(sed -n '2p' "$STATE_FILE")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QREC_BIN="bun run $SCRIPT_DIR/../src/cli.ts"

echo "→ Stopping test daemon..."
QREC_DIR="$TEST_DIR" QREC_PORT=25928 $QREC_BIN stop 2>/dev/null || true
sleep 0.5

# Remove isolated env (nothing in ~/.qrec was touched)
if [ -d "$TEST_DIR" ]; then
  rm -rf "$TEST_DIR"
  echo "✓ Test QREC_DIR removed ($TEST_DIR)"
fi

if [ -d "$SESSIONS_DIR" ]; then
  rm -rf "$SESSIONS_DIR"
  echo "✓ Temp sessions dir removed"
fi

rm "$STATE_FILE"

echo "✓ Done"
