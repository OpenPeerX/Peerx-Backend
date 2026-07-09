#!/usr/bin/env bash
# Fail CI if any legacy SwapTrade reference is found in the working tree.
# Skips: .git, node_modules, dist, lockfile dependency subtree, .db files.

set -uo pipefail

ROOTS=("$(git rev-parse --show-toplevel)")
EXCLUDES=(
  --exclude-dir=node_modules
  --exclude-dir=.git
  --exclude-dir=dist
  --exclude-dir=backup
  --exclude-dir=.next
  --exclude=package-lock.json
  --exclude='*.db'
  --exclude='*.patch'
)

PATTERN='swaptrade|SwapTrade|swap-trade|swap_trade|SWAPTRADE|StelTade'

if grep -rIln "${EXCLUDES[@]}" -E "${PATTERN}" "${ROOTS[0]}" >/dev/null; then
  echo "ERROR: Legacy SwapTrade reference(s) detected:"
  grep -rIn "${EXCLUDES[@]}" -E "${PATTERN}" "${ROOTS[0]}" || true
  exit 1
fi

echo "OK: no legacy SwapTrade references found in the PeerX working tree."
