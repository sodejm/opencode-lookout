# Validation

## Local checks

Validated locally on November 3, 2026, with OpenCode 2.2.5, Node.js 26.12.1, and
macOS. `make check` runs Prettier, TypeScript checking, and Node's native test runner.
All 17 tests pass. Current tests
cover catalog field filtering, literal searches, disabled-item recovery, ownership
markers, reversible controls, malformed config, duplicate keys, protected IDs,
stale and replayed previews, external file edits, symlinks, concurrent locks,
pre-write failures, and offline load/unload/re-enable behavior.
Display tests cover native status-color roles, stale-state warnings, and removal
of MCP from Control Center views without changing legacy recovery rows. Both
terminal sizes passed again after this change; the wide-terminal check also
confirms native MCP status remains visible and no duplicate MCP heading appears.

## Runtime validation

Both commands passed against fresh temporary HOME/XDG directories:

```sh
CC_TUI=1 node test/integration.mjs
CC_TUI=1 CC_NARROW=1 CC_THEME=tokyonight node test/integration.mjs
```

- Server: skill, MCP, and local plugin disable/reload/re-enable; recovery of
  filtered rows; rejection of protected plugin and agent controls.
- Recovery: the offline CLI unloads the server plugin and removes its RPC, then
  loads it again and restores RPC availability.
- Carbonfox at 150×52: sidebar contribution and keyboard catalog workflow.
- Tokyonight at 80×36: the same keyboard workflow without requiring a sidebar.
- Keyboard workflow: literal search, Ctrl+F category selection, Ctrl+S state
  selection, details, cancellation without a configuration change, confirmed
  restriction, and offline restoration. Session inference cost remained zero.

The narrow-terminal test initially sent input before startup completed. Waiting
for the prompt while draining PTY output fixed the test; no layout change was
needed. CSI-u Escape avoids ambiguous bare-Escape handling in the test terminal.

The fixture denies all `provider.use` and `tool.use` actions and does not inherit
personal credentials. These safeguards were added after an earlier keyboard-test
failure submitted text to a free model. Only the hardened runs above establish
the current no-inference result.

## Existing usage-router documentation

From the global configuration directory,
`node --test routing/router.test.mjs routing/plugin.test.mjs` passed all 29 tests.
The source diff against pre-edit backups contains comments only. The Node runner
reports the existing unspecified-module-type warning for `usage-router.js`;
changing the global package type is outside this documentation change.

## Personal installation

The normal server loaded one active `personal.control-center` plugin with server,
TUI, and RPC parts declared. Its snapshot returned all seven catalog categories
without errors. An immediate check after the first load ran before the config
watcher finished; the subsequent check confirmed the active plugin.

The external unload/load cycle also passed on the normal server: unload removed
the plugin and its RPC, and load restored the RPC. The cycle restored the exact
loaded configuration bytes. The initial installation was checked against the
lifecycle transformation and preserved all unrelated settings and restrictions.
The extension was left loaded with zero owned resource restrictions. No personal
resource was disabled for this check. Live rendering in the user's existing TUI
still needs confirmation; the automated terminal evidence above used fixtures.

## Limits

- Terminal evidence is a PTY workflow, not a pixel-level visual or accessibility
  audit. Mouse interaction, pin persistence across restart, other terminal sizes,
  remote-server behavior, and minimum-Node-version compatibility need human checks.
- Catalog removal is evidence of effective configuration filtering, not a security
  sandbox or revocation of instructions already loaded into a conversation.
- Provider authentication and quota are not certified by catalog enumeration.
- Dependency vulnerability and external secret-scanning services were not run.

## Human review

Human review of the exact implementation commit is pending. This is a local,
private installation; no push, package publication, or hosted release has occurred.
