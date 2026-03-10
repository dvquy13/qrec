#!/usr/bin/env bash
# scripts/release.sh <version>
# Release flow: sync versions → CHANGELOG → commit → tag → push → gh release
#
# Prerequisites:
#   gh auth login  (uses gh auth token, no separate GITHUB_TOKEN needed)
#   npx conventional-changelog-cli  (installed on demand via npx)
#
# Usage:
#   bash scripts/release.sh 0.2.0

set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: bash scripts/release.sh <version>" >&2
  exit 1
fi

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be semver (e.g. 1.2.3), got: $VERSION" >&2
  exit 1
fi

# Ensure working tree is clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

echo "[release] Releasing v${VERSION}..."

# 1. Sync version across package.json + plugin manifests
echo "[release] Syncing version to manifests..."
node scripts/sync-plugin-version.mjs "$VERSION"

# 2. Rebuild compiled artifact with new version baked in
echo "[release] Building plugin artifact..."
node scripts/build.js

# 3. Generate CHANGELOG (conventional-changelog angular preset)
echo "[release] Generating CHANGELOG..."
npx --yes conventional-changelog-cli -p angular -i CHANGELOG.md -s

# 4. Commit all changes
echo "[release] Committing..."
git add package.json .claude-plugin/marketplace.json plugin/.claude-plugin/plugin.json \
        plugin/scripts/qrec.cjs plugin/ui/ CHANGELOG.md
git commit -m "chore: release v${VERSION}"

# 5. Tag
git tag "v${VERSION}"

# 6. Push branch + tag
echo "[release] Pushing..."
git push origin main
git push origin "v${VERSION}"

# 7. Create GitHub release with CHANGELOG as notes
echo "[release] Creating GitHub release..."
# Extract the top section of CHANGELOG (up to the second ## header) as release notes
NOTES=$(awk '/^## /{found++} found==2{exit} found==1{print}' CHANGELOG.md)
if [[ -z "$NOTES" ]]; then
  # Fallback to auto-generated notes if CHANGELOG section is empty
  gh release create "v${VERSION}" --title "v${VERSION}" --generate-notes
else
  gh release create "v${VERSION}" --title "v${VERSION}" --notes "$NOTES"
fi

# 8. Publish to npm
echo "[release] Publishing to npm..."
npm publish --access public
echo "[release] npm publish complete."

echo "[release] Done. v${VERSION} released."
echo "[release] https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/v${VERSION}"
