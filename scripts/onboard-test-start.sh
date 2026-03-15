#!/bin/bash
# Start an isolated onboarding test environment.
# Uses QREC_DIR to point qrec at a fresh temp dir — the real ~/.qrec is never touched.
# By default, models are symlinked from ~/.qrec/models/ to avoid re-downloading.
# Pass --fresh-models to skip the symlink and observe the full download flow in the UI.
#
# Stop with: bash scripts/onboard-test-stop.sh
set -euo pipefail

FRESH_MODELS=false
for arg in "$@"; do
  case "$arg" in
    --fresh-models) FRESH_MODELS=true ;;
  esac
done

STATE_FILE="$HOME/.qrec/.onboard-test-state"

if [ -f "$STATE_FILE" ]; then
  echo "Test env already active. Run scripts/onboard-test-restore.sh first."
  exit 1
fi

# Isolated data dir (fresh DB, logs, config — real ~/.qrec never touched)
TEST_DIR=$(mktemp -d)

# Symlink models so we don't re-download 300MB (skip with --fresh-models)
REAL_MODELS="$HOME/.qrec/models"
if [ "$FRESH_MODELS" = true ]; then
  echo "  --fresh-models: skipping model symlink — daemon will download on first run"
elif [ -d "$REAL_MODELS" ]; then
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

# Use the local worktree source directly so the test always runs the code under development,
# regardless of what the global `qrec` symlink points to (npm release vs. another worktree).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QREC_BIN="bun run $SCRIPT_DIR/../src/cli.ts"

# Start daemon in the isolated env (port 25928 to avoid conflicting with real daemon on 25927)
echo "→ Starting daemon (QREC_DIR=$TEST_DIR, QREC_PROJECTS_DIR=$SESSIONS_DIR, port 25928)..."
QREC_DIR="$TEST_DIR" QREC_PROJECTS_DIR="$SESSIONS_DIR" QREC_PORT=25928 $QREC_BIN serve --daemon --no-open

echo ""
echo "✓ Onboarding test env ready — visit http://localhost:25928"
echo "  Stop with: bash scripts/onboard-test-stop.sh"
