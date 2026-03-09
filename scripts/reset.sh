#!/usr/bin/env bash
# reset.sh — wipe qrec persistent state for a clean run
# Keeps: model file (~/.cache/qmd/models/), node_modules, source code, eval set
# Removes: database, WAL, daemon PID file, log

set -euo pipefail

QREC_DIR="$HOME/.qrec"

echo "[reset] Stopping daemon if running..."
if [ -f "$QREC_DIR/qrec.pid" ]; then
  PID=$(cat "$QREC_DIR/qrec.pid")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" && echo "[reset] Killed daemon (PID $PID)"
    sleep 1
  fi
  rm -f "$QREC_DIR/qrec.pid"
fi

echo "[reset] Removing database..."
rm -f "$QREC_DIR/qrec.db" \
       "$QREC_DIR/qrec.db-shm" \
       "$QREC_DIR/qrec.db-wal"

echo "[reset] Removing log..."
rm -f "$QREC_DIR/qrec.log"

echo "[reset] Done. State wiped — ready for a clean run."
echo "  Kept: $HOME/.cache/qmd/models/ (embedding model)"
