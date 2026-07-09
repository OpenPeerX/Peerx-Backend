# PeerX Rebranding

PeerX is the successor project to the previous **SwapTrade** codebase.
This document tracks what changed and how to migrate.

## What changed
- npm package: `swaptrade-backend` -> `peerx-backend`
- Database default: `swaptrade.db` -> `peerx.db`
- OTEL service name: `swaptrade-backend` -> `peerx-backend`
- Default admin email: `admin@swaptrade.com` -> `admin@peerx.com`
- Public API host: `api.swaptrade.com` -> `api.peerx.com`
- Grafana dashboards, Prometheus jobs, alerting rule groups and SLO
  configs were updated to the new identifiers.
- The `did:ethr:0xSwapTradeKycIssuer000000` issuer DID is replaced by
  `did:ethr:0xPeerXKycIssuer000000`.

## Migration steps for operators
1. Update your `.env` to use `peerx.db` (or run with the new default).
2. Update Prometheus/Grafana data sources to scrape `peerx-backend`.
3. If you depend on the legacy `swaptrade` tracing service name, update
   your dashboards.
4. If you minted credentials from the old `SwapTradeMasterSuperSecret`,
   re-issue them under `PeerXMasterSuperSecret`.
