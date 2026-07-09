# Releasing PeerX

1. Bump the version in `package.json` (e.g., `peerx-backend@0.1.0`).
2. Move the `## [Unreleased]` block in `CHANGELOG.md` into a dated
   versioned section.
3. Tag the commit: `git tag -s v0.1.0 -m 'PeerX v0.1.0'`.
4. Push the tag: `git push origin v0.1.0`.
5. The release-drafter workflow will publish the notes.
