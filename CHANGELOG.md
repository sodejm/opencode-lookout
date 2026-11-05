# Changelog

## Unreleased

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
- Added fail-closed OSS security checks, source-bound release evidence, dynamic
  Docker compatibility tests, and portable OpenCode/Copilot/VS Code guidance.
- Matched native semantic status-dot colors and removed duplicate MCP browsing.
  Native MCP controls and existing extension-owned restrictions are unchanged.

### Validation

- OpenCode 2.2.5 server lifecycle and reversible-control integration tests.
- Carbonfox wide-terminal and Tokyonight narrow-terminal keyboard workflows.
- See [Validation](docs/VALIDATION.md) for exact evidence and known limits.
