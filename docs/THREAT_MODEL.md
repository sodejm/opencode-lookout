# Threat model

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
| Disabling policy enforcement | Built-in plugins and Control Center are read-only in the UI | Config and catalog tests |
| Broken UI prevents recovery | External load/unload/status/restore commands; no automatic discovery | Lifecycle tests |

The live fixture validates filtering and recovery for all three controllable
resource kinds. It runs with temporary HOME/XDG directories and denies provider
and tool use to keep keyboard-test mistakes from starting inference or shell work.
Terminal logs can contain local paths and session metadata; retained fixtures are
local debugging artifacts, not shareable evidence. See [Validation](VALIDATION.md)
for the tested runtime and remaining coverage limits. This increment adds no new
production credential access, RPC methods, file targets, or resource kinds.

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
  config edits separate from Control Center changes.
- Loaded skill text cannot be removed from an existing conversation.
- Server-side plugin status does not certify its terminal component is healthy.
- Managed provenance is not available for every catalog field. Unrecognized
  sources are read-only instead of being assumed local.
- Denials are operational configuration, not a sandbox for arbitrary plugin code.

The owner of this local installation owns these residual risks. Human review is
pending; test results are not human approval. Recheck this model when adding
resource kinds, file targets, credential access, or remote management.
