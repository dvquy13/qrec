#!/usr/bin/env bash
# reset.sh — wipe qrec persistent state for a clean run
# Keeps: model file (~/.cache/qmd/models/), node_modules, source code, eval set
# Removes: database, WAL, daemon PID file, log

set -euo pipefail

QREC_DIR="$HOME/.qrec"

echo "[reset] Stopping daemon if running..."
qrec stop 2>/dev/null || true

echo "[reset] Removing database..."
rm -f "$QREC_DIR/qrec.db" \
       "$QREC_DIR/qrec.db-shm" \
       "$QREC_DIR/qrec.db-wal"

echo "[reset] Removing log..."
rm -f "$QREC_DIR/qrec.log"

echo "[reset] Done. State wiped — ready for a clean run."
echo "  Kept: $HOME/.cache/qmd/models/ (embedding model)"
