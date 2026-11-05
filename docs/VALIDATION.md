# Validation

## Repository checks

`make check` runs Prettier, local documentation-link checks, blocking ESLint/JSDoc,
strict TypeScript with checked JavaScript, and Node's test runner. Unit tests
cover catalog filtering, literal search, description metadata, ownership,
reversible controls, malformed config, duplicate keys, protected IDs, expired
and replayed previews, external edits, symlinks, locks, and offline recovery.
Release tests reject low/unknown findings, scanner errors, incomplete reports,
stale/source-mismatched evidence, incomplete matrices, and failed commands.

## Runtime checks

```sh
LOOKOUT_TUI=1 node test/integration.mjs
LOOKOUT_TUI=1 LOOKOUT_NARROW=1 LOOKOUT_THEME=tokyonight node test/integration.mjs
npm run test:compatibility
```

The first two commands use the installed CLI with fresh HOME/XDG fixtures. They
deny every provider/tool action and never submit a model request. They exercise:

- Skill, MCP, and local plugin disable/reload/re-enable and filtered-row recovery.
- Rejection of protected controls; offline unload/load and RPC disappearance.
- Carbonfox at 150×52 and Tokyonight at 80×36, search, category/state selection,
  details, cancellation, confirmation, and offline restore; zero inference cost.
- Native MCP status without duplicate inventory; file-sourced plugin descriptions.

The Docker runner discovers the newest five stable V2+ CLI versions plus the
highest RC of the nearest unreleased version. It fails if discovery or any test
fails. Each image installs a CLI artifact with verified npm integrity and locked
dependencies. Tests run as non-root, without network, capabilities, host mounts,
credentials, or a Docker socket. Only temporary container storage is writable.
Both terminal modes run for each target; server/recovery checks run in each mode.
The approved read-only profile for 2.2.1/2.2.2 requires visible inventory, rejected
enable/disable/apply RPCs, browsing/details, no changed restrictions, and offline
load/unload. All other targets require full effective controls. These are distinct
support claims, not silently skipped test steps.
Reports bind results to source bytes, CLI integrity, and Docker image IDs.

## Evidence and limits

The renamed plugin passed a Linux arm64 Docker probe against OpenCode 2.2.5 with
the Carbonfox terminal flow. That probe is not the full release matrix. Current
machine-readable evidence is generated under ignored `release-evidence/`; do not
commit raw scanner logs or terminal fixtures. See [Release policy](RELEASING.md).

The initial five-version run reproduced an ineffective skill restriction on
2.2.1. Upstream source confirms 2.2.1/2.2.2 use a different policy action; the
current `skill.use`/`mcp.use` API starts in 2.2.3. The maintainer chose not to add
an older-policy adapter and approved testing those hosts against a read-only
support profile. The original failed control test is not counted as passing;
fresh profile-specific evidence is required.

The old installation is deliberately untouched. Reinstallation is deferred until
after remote release. Historical pre-rename tests do not establish this revision's
compatibility. No broader platform/version support is claimed before its matrix
passes. Linux amd64 hosted results are distinct from local Linux arm64 results.

PTY tests are not pixel-level or accessibility audits. Mouse interactions,
preference persistence, remote-server behavior, and other terminal sizes still
need human review. Catalog filtering does not revoke instructions already loaded
in conversations. Catalog availability proves neither provider authentication nor
quota. A clean scan means only no findings in the configured checks at that time.
