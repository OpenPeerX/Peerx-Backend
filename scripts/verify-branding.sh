#!/usr/bin/env bash
# Print a PeerX branding summary. Intended for use in release notes.
set -euo pipefail

echo 'PeerX branding summary'
echo '----------------------'
echo "Package:        $(jq -r .name package.json 2>/dev/null || echo peerx-backend)"
echo "OTEL service:   peerx-backend"
echo "DB file:        peerx.db"
echo "API host:       api.peerx.com"
echo "Documentation:  docs.peerx.com"
echo "Support:        support@peerx.io"
echo "Security:       security@peerx.com"
