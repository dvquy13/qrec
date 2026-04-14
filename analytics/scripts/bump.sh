#!/usr/bin/env bash
# Usage: ./scripts/bump.sh patch|minor|major
set -euo pipefail

TYPE=${1:-}
if [[ -z "$TYPE" || ! "$TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 patch|minor|major" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$REPO_DIR/VERSION"
CURRENT=$(cat "$VERSION_FILE" | tr -d '[:space:]')

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEXT="$MAJOR.$MINOR.$PATCH"
echo "$NEXT" > "$VERSION_FILE"

git -C "$REPO_DIR" add VERSION
git -C "$REPO_DIR" commit -m "chore: bump version to $NEXT"
git -C "$REPO_DIR" tag "v$NEXT"

echo "Bumped $CURRENT → $NEXT (tagged v$NEXT)"
