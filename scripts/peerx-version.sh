#!/usr/bin/env bash
# Emit the PeerX version derived from the nearest git tag.
set -euo pipefail

if command -v git >/dev/null 2>&1; then
  git describe --tags --abbrev=0 2>/dev/null || echo 'peerx-0.0.0'
else
  echo 'peerx-0.0.0'
fi
