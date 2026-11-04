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

- Renamed the project from Control Center to OpenCode Lookout. Existing plugin
  IDs, RPCs, commands, ownership markers, and recovery filenames remain compatible.
- Matched native semantic status-dot colors and removed duplicate MCP browsing.
  Native MCP controls and existing extension-owned restrictions are unchanged.

### Validation

- OpenCode 2.2.5 server lifecycle and reversible-control integration tests.
- Carbonfox wide-terminal and Tokyonight narrow-terminal keyboard workflows.
- See [Validation](docs/VALIDATION.md) for exact evidence and known limits.
