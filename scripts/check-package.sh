#!/usr/bin/env bash
# Verifies that every file under ui/, plugin/, and public/ is included in the npm package.
# No hardcoded list — if a new file is added to those dirs but forgotten in
# package.json "files", this test catches it automatically.
set -e

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "[check-package] Packing..."
npm pack --pack-destination "$TMPDIR" --quiet

TARBALL=$(ls "$TMPDIR"/*.tgz)
echo "[check-package] Extracting $TARBALL..."
tar -xzf "$TARBALL" -C "$TMPDIR"

FAIL=0
for src in $(find ui plugin public -type f | sort); do
  packed="$TMPDIR/package/$src"
  if [ -f "$packed" ]; then
    echo "  OK      $src"
  else
    echo "  MISSING $src"
    FAIL=1
  fi
done

if [ $FAIL -ne 0 ]; then
  echo "[check-package] FAILED — source files missing from package"
  exit 1
fi

echo "[check-package] PASSED"
