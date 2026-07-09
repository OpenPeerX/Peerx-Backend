# Contributing to PeerX

Thanks for your interest in contributing to **PeerX**! The canonical
contribution guide is in [CONTRIBUTING.md](../CONTRIBUTING.md). This file
is a quick reference for rebrand-related changes.

## Code of conduct
All participants are expected to follow the PeerX Code of Conduct.

## Style
- TypeScript: 2-space indent, single quotes, no semicolons (Prettier
  defaults configured at the repo root).
- YAML: 2-space indent; no tabs.

## Branding checks
Before opening a pull request, run:

```bash
./scripts/check-branding.sh
```

to ensure no legacy SwapTrade references were introduced.
