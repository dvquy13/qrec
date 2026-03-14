#!/bin/bash
# Start an isolated onboarding test environment.
# Uses QREC_DIR to point qrec at a fresh temp dir — the real ~/.qrec is never touched.
# Models are symlinked from ~/.qrec/models/ to avoid re-downloading.
#
# Stop with: bash scripts/onboard-test-stop.sh
set -euo pipefail

STATE_FILE="$HOME/.qrec/.onboard-test-state"

if [ -f "$STATE_FILE" ]; then
  echo "Test env already active. Run scripts/onboard-test-restore.sh first."
  exit 1
fi

# Isolated data dir (fresh DB, logs, config — real ~/.qrec never touched)
TEST_DIR=$(mktemp -d)

# Symlink models so we don't re-download 300MB
REAL_MODELS="$HOME/.qrec/models"
if [ -d "$REAL_MODELS" ]; then
  ln -s "$REAL_MODELS" "$TEST_DIR/models"
  echo "✓ Models symlinked from $REAL_MODELS"
else
  echo "  No model cache found — will download on first run"
fi

# Copy 10 most recent JSONL sessions into a temp dir
SESSIONS_DIR=$(mktemp -d)
REAL_SESSIONS="$HOME/.claude/projects"
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
printf "%s\n%s\n" "$TEST_DIR" "$SESSIONS_DIR" > "$STATE_FILE"

# Start daemon in the isolated env (port 25928 to avoid conflicting with real daemon on 25927)
echo "→ Starting daemon (QREC_DIR=$TEST_DIR, QREC_PROJECTS_DIR=$SESSIONS_DIR, port 25928)..."
QREC_DIR="$TEST_DIR" QREC_PROJECTS_DIR="$SESSIONS_DIR" QREC_PORT=25928 qrec serve --daemon --no-open

echo ""
echo "✓ Onboarding test env ready — visit http://localhost:25928"
echo "  Stop with: bash scripts/onboard-test-stop.sh"
