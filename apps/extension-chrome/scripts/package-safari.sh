#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Recall — Safari WebExtension Packager
#
# Safari extensions require an Apple App Extension wrapper built via Xcode.
# This script converts the built Safari WebExtension manifest into an Xcode
# project using Apple's official `safari-web-extension-converter`.
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_SAFARI="$EXT_DIR/dist/safari"
OUTPUT_DIR="$EXT_DIR/safari-app"

echo "=== Packaging Recall for Safari ==="

if [ ! -d "$DIST_SAFARI" ]; then
  echo "Dist folder $DIST_SAFARI not found. Building safari bundle first..."
  cd "$EXT_DIR" && npm run build:safari
fi

# Check for Xcode developer tools
if ! command -v xcrun &> /dev/null; then
  echo "Error: 'xcrun' is not found. Please install Xcode Command Line Tools: xcode-select --install"
  exit 1
fi

if ! xcrun --find safari-web-extension-converter &> /dev/null; then
  echo "⚠️  Note: 'safari-web-extension-converter' requires the full Xcode application installed at /Applications/Xcode.app"
  echo "   Current developer directory: $(xcode-select -p)"
  echo "   To switch once Xcode is installed, run:"
  echo "     sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  echo "   Then re-run this script."
  echo ""
  echo "   The WebExtension files are compiled and ready in: $DIST_SAFARI"
  exit 0
fi

echo "Running safari-web-extension-converter..."
xcrun safari-web-extension-converter "$DIST_SAFARI" \
  --app-name "Recall" \
  --bundle-identifier "dev.recall.safari" \
  --macos-only \
  --swift \
  --no-open \
  --project-location "$OUTPUT_DIR"

echo "✅ Safari project successfully generated at: $OUTPUT_DIR"
echo "To build and install:"
echo "  1. Open $OUTPUT_DIR/Recall/Recall.xcodeproj in Xcode"
echo "  2. Sign with your Apple Developer account"
echo "  3. Build & Run (Product -> Run)"
echo "  4. In Safari -> Settings -> Extensions, enable 'Recall'"
