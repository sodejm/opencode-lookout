# npm packaging implementation plan

**Goal:** Prepare v0.1.2 for deliberate npm publication without changing signed
v0.1.1 or weakening release gates.

**Architecture:** Ship the existing V2 server/RPC TypeScript entrypoints, a
byte-checked compiled Solid TUI and offline CLI in an allowlisted package.
OpenTUI's transform excludes node_modules; raw TSX reproduced a React-resolution
failure in a consumer installation. Install to a stable local prefix and use the existing
path-owned lifecycle; no implicit migration from checkout or registry entries.
Test the production-installed tarball outside the checkout. A manually dispatched
OIDC workflow must verify the exact published GitHub release and fresh full
hosted checks before publishing the validated tarball with provenance.

**Tech stack:** Node 22+ recovery CLI, Node 26 development, npm 11, OpenCode 2.2.5,
repository Node tests, isolated Docker/Expect integration, GitHub Actions.

**Authorization:** The maintainer approved preparation of v0.1.2 with packaging,
installed-artifact tests and a manual trusted-publishing workflow. Stop for
exact-revision approval and npm account setup before publication. Implement
natively in this session; do not delegate automatically.

## Constraints and review focus

- Preserve plugin/RPC ID, exports, `/lookout`, storage keys and ownership markers.
- Keep Node 22 offline recovery; do not install development dependencies to make
  a consumer test pass. Consumer installs do not inherit repository overrides.
- Test npm bin symlinks, recovery without a server, malformed/ambiguous config,
  confirmation refusal, and preservation of unrelated policies.
- Ship no workflows, tests, credentials, install scripts or personal paths.
- Retain provider/tool denials and both real terminal modes in all CLI profiles.
- Fail closed on missing/stale/mismatched/full-scan evidence. PR scans cannot
  authorize publication. No tag movement or automatic publication.

## Tasks

1. **Package and recovery** — `package*.json`, `bin/lookout.mjs`,
   `test/package.test.mjs`, `test/packed.mjs`: first prove the package boundary
   and executable failures, then add files/bin metadata and host-provided optional
   SDK/UI peers. A normal SDK dependency reproduced consumer vulnerabilities
   because dependency overrides do not propagate. Test a real tarball installed with production dependencies
   outside the checkout, audit the consumer graph, and exercise offline recovery.
2. **Installed integration** — `test/integration.mjs`, `test/Dockerfile`, CI:
   separate harness paths from package paths. Run the existing server/TUI matrix
   against a production-installed tarball with no access to checkout dependencies.
   Keep Node 22/24 packed recovery coverage and make packed tests a local gate.
3. **Manual publishing** — `.github/workflows/npm-publish.yml`,
   `scripts/npm-publish-check.mjs`, policy tests: accept an exact release SHA/tag,
   verify fresh full GitHub Actions checks and matching main tree, require a
   non-draft release and immutable tag, rerun local gates, and publish only the
   tested tarball through OIDC. Use the npm environment for maintainer control.
4. **Docs and validation** — README, contributor contract, release/validation/
   architecture/threat docs and changelog: document stable-path install and
   migration, direct registry-entry limitations, trusted-publisher bootstrap,
   exact approval and provenance. Run `make check`, `actionlint`, security and
   compatibility. Create a local checkpoint; report hosted/account blockers
   rather than claiming release readiness.
