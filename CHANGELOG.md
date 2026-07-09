# Changelog

All notable changes to **PeerX** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Project rebrand**: The platform formerly known as *SwapTrade* has been
  renamed to *PeerX*. All package names, environment defaults, telemetry
  labels, monitoring dashboards, regulatory reporting entities, and
  documentation have been updated to the new brand.

### Migration notes
- `swaptrade-backend` -> `peerx-backend` (npm package)
- `swaptrade.db` -> `peerx.db` (SQLite default)
- `swaptrade-backend` (OTEL service name) -> `peerx-backend`
- `api.swaptrade.com` -> `api.peerx.com`
- `cdn.swaptrade.io` -> `cdn.peerx.io`
- `docs.swaptrade.com` -> `docs.peerx.com`
- `admin@swaptrade.com` -> `admin@peerx.com`
- `notifications@swaptrade.com` -> `notifications@peerx.com`
- `support@swaptrade.io` -> `support@peerx.io`
