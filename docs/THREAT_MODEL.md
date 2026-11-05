# Threat model

## Release assurance boundary

Release checks reject every configured finding, regardless of severity, as well
as scanner errors, missing output, stale receipts, source mismatches, and missing
compatibility cases. npm audit covers development, optional, and peer dependencies;
npm signatures checks registry signatures; Trivy checks the lockfile and repository
misconfiguration; Semgrep uses pinned OSS language/Actions security rules; Gitleaks
checks full Git history and current nonignored source. No scan is proof of absence
of vulnerabilities. This does not certify the host OS or an upstream CLI binary.

The repository's `.semgrepignore` overrides default test exclusions: source,
test harnesses, and fixtures are scanned. Required entrypoint coverage is checked
explicitly. Only generated output and separately audited dependency code are
excluded. Downloaded rule fixtures are not project source and must not be scanned
as if they were part of Lookout.

Actions are SHA-pinned and use standard public runners. Repository access is
read-only except CodeQL security-result uploads (`security-events: write`);
CodeQL database uploads are disabled. Its Actions and JavaScript/TypeScript
analyses reject every SARIF result and warning/error, not just scanner failures.
Downloads of
standalone scanner binaries, the Semgrep image, rule archive, and Node base image
are digest-pinned. CLI versions are discovered dynamically, and npm integrity binds
each tested binary. A malicious registry, compromised upstream release, or scanner
blind spot remains a risk. Dependency overrides cross major versions and require
behavioral tests, not just a clean audit.

Docker test builds need network access to fetch dependencies. Test execution has
no network, host mounts, Docker socket, elevated capabilities, or personal secrets.
Fixture provider/tool denials remain mandatory even inside the container. The
repository and Docker daemon are trusted inputs, not a sandbox for arbitrary
malicious code. Local receipts are not signed attestations: a user with filesystem
access can forge them. Exact-revision maintainer review and matching hosted checks
remain required. No workflow automatically publishes or treats AI review as human
approval. The approved breaking rename does not claim old ownership blocks;
restore/unload the previous installation with its own CLI before reinstalling.

## Assets and authority

Protect global OpenCode configuration, existing access restrictions, credentials,
and unrelated plugins. The server process already runs with the user's filesystem
authority. Its authenticated clients can call plugin RPCs. Confirmation protects
against accidental UI use; it is not a sandbox against a malicious authenticated
client or another plugin running as the same user.

The TUI is not an authority for configuration paths, resource IDs, or management
eligibility. The server fixes the target path and rechecks the catalog. RPCs are
not exposed as model tools. No credential APIs are used.

## Threats and implemented controls

| Threat | Control | Evidence |
| --- | --- | --- |
| Wildcard disables or arbitrary file writes | Exact ID validation, fixed config path, fixed resource kinds | Config and controller tests |
| Erasing external policy | Remove only owned blocks; never add allow rules | Config tests |
| Replay or stale preview | One-use token, 60-second expiry, configuration hash | Controller tests |
| Two extension writers | Exclusive file lock and atomic replacement | Controller tests |
| Partial write or stale lock | Temp-file cleanup; preserve original on pre-rename failure; offline recovery | Controller tests and README |
| Credential disclosure | Display-field allowlist; no raw API errors or configuration in the catalog | Catalog tests |
| Terminal control sequences in metadata | Strip control characters and bound display strings | Catalog tests |
| Loss of re-enable path after filtering | Reconstruct disabled rows from owned entries | Catalog tests |
| Disabling policy enforcement | Built-in plugins and Lookout are read-only in the UI | Config and catalog tests |
| Broken UI prevents recovery | External load/unload/status/restore commands; no automatic discovery | Lifecycle tests |

The live fixture validates filtering and recovery for all three controllable
resource kinds. It runs with temporary HOME/XDG directories and denies provider
and tool use to keep keyboard-test mistakes from starting inference or shell work.
Terminal logs can contain local paths and session metadata; retained fixtures are
local debugging artifacts, not shareable evidence. See [Validation](VALIDATION.md)
for the tested runtime and remaining coverage limits.

Plugin descriptions add read-only access to the exact local plugin source from
the server catalog, or its direct package manifest. File reads are bounded and
reject non-regular files and final-component symlinks. Plugin source is never
executed for metadata extraction. Only an explicit description field/tag is
returned, sanitized for terminal control characters; errors do not expose paths.
The catalog, not an RPC caller, selects the source path. An installed malicious
plugin already has the server user's authority; these checks are not a sandbox
against that user or plugin. Description metadata is display text, not instructions.

## Limits and review

Public contribution and CI are additional trust boundaries. GitHub Actions run
untrusted pull-request code without repository write permissions or project
secrets. Checkout credentials are not persisted, action revisions are pinned, and
dependency install scripts are disabled. Dependabot proposes updates; it does not
merge or publish them. Human review must check runtime dependency compatibility.
Dependency licenses and notices must be reviewed before redistributing bundled
artifacts; this repository does not publish bundles.

The status-dot and MCP-display change affects presentation only. It adds no RPC,
configuration write, credential access, or trust boundary. Existing MCP
restrictions remain intact and can still be removed by offline restore. Green
dots indicate catalog availability, not successful authentication or execution.

- Global changes can affect active work in other sessions. The preview warns about
  this; it does not forcibly stop or migrate those sessions.
- Higher-priority policy can override a local denial. A saved entry is not proof
  that a resource is blocked. The catalog reports when it remains listed.
- An uncooperative external writer can race the final hash check. Keep manual
  config edits separate from Lookout changes.
- Loaded skill text cannot be removed from an existing conversation.
- Server-side plugin status does not certify its terminal component is healthy.
- Managed provenance is not available for every catalog field. Unrecognized
  sources are read-only instead of being assumed local.
- Denials are operational configuration, not a sandbox for arbitrary plugin code.

The owner of this local installation owns these residual risks. Human review is
pending; test results are not human approval. Recheck this model when adding
resource kinds, file targets, credential access, or remote management.
