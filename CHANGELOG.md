# Changelog

## Unreleased

### v0.1.2 preparation

- Add an allowlisted npm artifact and a `lookout` executable for stable-prefix
  installs. Correct executable detection through npm's symlink; preserve the
  existing checkout invocation and path-owned recovery markers.
- Precompile the Solid TUI for loading inside `node_modules`; check generated
  output against source. Declare the host SDK/UI runtime as optional peers rather
  than installing a second SDK graph with consumer-unprotected dependencies.
- Test production-installed tarballs, offline failure/recovery, consumer dependency
  audits, and the real server/TUI matrix. Bind Docker receipts to tarball integrity.
- Add a manual OIDC publication workflow requiring the exact approved signed tag,
  published GitHub release, matching main tree, fresh full hosted checks and fresh
  local release gates. npm account setup and exact-revision approval remain required.

## 0.1.1 — 2026-11-05

### Fixed

- Remove an unused fixture session-response dump reported by full CodeQL analysis.
  The isolated terminal tests now assert that the response is not saved.
- Require full CodeQL scans on candidate branch pushes. PR-only scans use separate
  check names and cannot satisfy the required full-scan checks. Release procedure
  also verifies post-merge checks before publishing.
- Supersede the withdrawn 0.1.0 release, whose PR analysis passed but post-merge
  full analysis reported the fixture finding. The 0.1.0 tag remains immutable.

## 0.1.0 — 2026-11-05

### Added

- Native-style Lookout sidebar for agents, skills, plugins, commands, providers,
  and models, with search, category/state filters, details, and pinned entries.
- Confirmed, exact-ID restrictions for locally controllable skills and plugins.
- Independent load, unload, status, and restore commands.
- Plugin-file descriptions in the sidebar, with `missing description` when
  supported metadata is absent; plugin code is not executed to read metadata.
- Public MIT-licensed repository, contributor guidance, security policy, CI,
  issue templates, and dependency-update configuration.

### Changed

- Standardized product and machine-facing names on Lookout: `opencode-lookout`
  plugin/RPC ID, `/lookout`, `bin/lookout.mjs`, and `lookout:` ownership markers.
  This is a deliberate breaking rename, without legacy aliases. Restore and
  unload an older installation using its own CLI before reinstalling.
- Enabled strict checked JavaScript, typed catalog projections, and blocking lint.
- Pinned patched glob/minimatch overrides for all affected dependency versions.
- Aligned development Node declarations with Node 26 using `@types/node` 26.6.6.
  Production-only offline CLI tests retain Node 22 and 24 coverage.
- Added fail-closed OSS security checks, source-bound release evidence, dynamic
  Docker compatibility tests, and portable OpenCode/Copilot/VS Code guidance.
- Matched native semantic status-dot colors and removed duplicate MCP browsing.
  Native MCP controls and existing extension-owned restrictions are unchanged.

### Fixed

- Validate opened configuration descriptors and bound reads against file growth,
  hard-link changes, and stale permission metadata; reject FIFOs and final symlinks.
- Install runtime-test dependencies with npm 11.19.1 to preserve patched overrides
  that npm 10 misresolves. Encode complete registry URL components.
- Extract checksum-verified rules from memory into fresh directories and distinguish
  informational CodeQL diagnostics from findings without severity waivers.

### Validation

- OpenCode 2.2.5 server lifecycle and reversible-control integration tests.
- Carbonfox wide-terminal and Tokyonight narrow-terminal keyboard workflows.
- See [Validation](docs/VALIDATION.md) for exact evidence and known limits.
