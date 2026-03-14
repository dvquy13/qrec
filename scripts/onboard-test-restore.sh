#!/bin/bash
# Restore from onboarding test environment:
#   - Stops the daemon
#   - Restores ~/.qrec/qrec.db from backup
#   - Removes the temp sessions dir
#   - Restarts the daemon normally
set -euo pipefail

STATE_FILE="$HOME/.qrec/.onboard-test-state"

if [ ! -f "$STATE_FILE" ]; then
  echo "No test env active."
  exit 0
fi

SESSIONS_DIR=$(cat "$STATE_FILE")

echo "→ Stopping daemon..."
qrec stop 2>/dev/null || true
sleep 0.5

# Restore DB (backup is a fully-checkpointed single file — no WAL needed)
DB="$HOME/.qrec/qrec.db"
DB_BAK="$HOME/.qrec/qrec.db.onboard-test-bak"
if [ -f "$DB_BAK" ]; then
  rm -f "$DB" "${DB}-wal" "${DB}-shm"
  mv "$DB_BAK" "$DB"
  echo "✓ DB restored"
else
  echo "  No DB backup found (DB was fresh to begin with)"
fi

# Remove temp sessions dir
if [ -d "$SESSIONS_DIR" ]; then
  rm -rf "$SESSIONS_DIR"
  echo "✓ Temp sessions dir removed"
fi

rm "$STATE_FILE"

# Restart daemon normally
echo "→ Restarting daemon..."
qrec serve --daemon --no-open

echo ""
echo "✓ Restored — visit http://localhost:25927"
