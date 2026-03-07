#!/bin/bash
set -e

VERSION=$(node -p "require('./manifest.json').version")
OUTFILE="dist/chat-ripper-v${VERSION}.zip"

mkdir -p dist

zip -r "$OUTFILE" \
  manifest.json \
  config.js \
  background/ \
  content/ \
  sidepanel/ \
  popup/ \
  icons/ \
  loading.gif \
  -x "**/.DS_Store"

echo "Packaged: $OUTFILE"
