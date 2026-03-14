#!/bin/bash
# Start an onboarding test environment:
#   - Backs up ~/.qrec/qrec.db
#   - Creates a temp dir with 10 recent Claude sessions
#   - Starts the daemon pointing at the temp dir (QREC_PROJECTS_DIR)
#
# Restore with: bash scripts/onboard-test-restore.sh
set -euo pipefail

STATE_FILE="$HOME/.qrec/.onboard-test-state"

if [ -f "$STATE_FILE" ]; then
  echo "Test env already active. Run scripts/onboard-test-restore.sh first."
  exit 1
fi

echo "→ Stopping daemon..."
qrec stop 2>/dev/null || true
sleep 0.5

# Checkpoint WAL into main DB before backup so qrec.db is self-contained.
# Without this, sessions written since last checkpoint live only in the WAL
# and are lost if the WAL is not restored alongside qrec.db.
DB="$HOME/.qrec/qrec.db"
DB_BAK="$HOME/.qrec/qrec.db.onboard-test-bak"
if [ -f "$DB" ]; then
  sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
  cp "$DB" "$DB_BAK"
  rm -f "$DB" "${DB}-wal" "${DB}-shm"
  echo "✓ DB checkpointed and backed up"
else
  echo "  No DB found (already fresh)"
fi

# Copy 10 most recent JSONL sessions into a temp dir
SESSIONS_DIR=$(mktemp -d)
REAL_SESSIONS="$HOME/.claude/projects"
# Use stat for mtime sort on macOS; pipe errors suppressed to avoid SIGPIPE with head
while IFS= read -r f; do
  cp "$f" "$SESSIONS_DIR/"
done < <(find "$REAL_SESSIONS" -name "*.jsonl" -type f \
  | xargs stat -f "%m %N" 2>/dev/null \
  | sort -rn \
  | head -10 \
  | awk '{print $2}')
COUNT=$(find "$SESSIONS_DIR" -name "*.jsonl" | wc -l | tr -d ' ')
echo "✓ Copied $COUNT sessions → $SESSIONS_DIR"

# Persist state for restore script
echo "$SESSIONS_DIR" > "$STATE_FILE"

# Start daemon with the temp sessions dir
echo "→ Starting daemon (QREC_PROJECTS_DIR=$SESSIONS_DIR)..."
QREC_PROJECTS_DIR="$SESSIONS_DIR" qrec serve --daemon --no-open

echo ""
echo "✓ Onboarding test env ready — visit http://localhost:25927"
echo "  Restore with: bash scripts/onboard-test-restore.sh"
