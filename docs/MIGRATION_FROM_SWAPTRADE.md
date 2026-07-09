# Migrating from SwapTrade to PeerX

This guide covers the operator-facing steps required to migrate a running
deployment of the legacy *SwapTrade* service to the new *PeerX* service.

## Pre-flight
- Take a full backup of your database.
- Note any custom Prometheus rules, Grafana dashboards, or alert
  receivers that reference the old identifiers.

## Steps
1. Deploy PeerX alongside the existing SwapTrade instance.
2. Cut over read traffic (queries) to PeerX.
3. Run a dual-write window of 24h for state-changing operations.
4. Decommission SwapTrade.

## Mapping table
| SwapTrade                | PeerX                |
|--------------------------|----------------------|
| swaptrade-backend        | peerx-backend        |
| swaptrade.db             | peerx.db             |
| swaptrade_db             | peerx_db             |
| api.swaptrade.com        | api.peerx.com        |
| cdn.swaptrade.io         | cdn.peerx.io         |
| docs.swaptrade.com       | docs.peerx.com       |
| admin@swaptrade.com      | admin@peerx.com      |
| support@swaptrade.io     | support@peerx.io     |
