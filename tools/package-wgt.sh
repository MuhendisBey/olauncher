#!/bin/sh
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$DIR/dist"
WGT_DIR="$DIST_DIR/wgt"
OUTPUT_WGT="$DIST_DIR/olauncher.wgt"

if [ ! -d "$WGT_DIR" ]; then
  echo "[PACKAGE] Error: dist/wgt does not exist. Run 'npm run build' first."
  exit 1
fi

rm -f "$OUTPUT_WGT"
cd "$WGT_DIR"
zip -r "$OUTPUT_WGT" . -x "*.DS_Store"

echo "[PACKAGE] Successfully created package: $OUTPUT_WGT"
