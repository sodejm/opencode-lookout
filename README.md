# OpenCode Control Center

Inspect agents, skills, plugins, MCP servers, commands, providers, and models in
OpenCode's terminal interface. The extension appends a compact section to the
existing sidebar. It does not replace Context or MCP status.

Requires OpenCode **2.2.5** and Node.js **22 or later**. The package is private and
local; it is not published. Install development dependencies with `npm ci
--ignore-scripts`. Do not use the legacy `@opencode-ai/plugin` API for this package.

## Load or unload

Run these commands **from this package's directory**, outside OpenCode:

```sh
node bin/control-center.mjs load
node bin/control-center.mjs status
node bin/control-center.mjs unload
```

The commands work without the extension, server, or TUI running. They change one
marked entry in your global `opencode.jsonc` or `opencode.json`. They refuse to
choose between those files if both exist. They respect `XDG_CONFIG_HOME`.

OpenCode watches configuration changes. Use `/reload` if the UI has not updated.
`status` reports the configuration on disk, **not** whether the extension loaded.
Check `opencode plugin list` and open `/control-center` to verify both parts.

Unloading keeps resource restrictions in place. Removing a UI must not silently
restore tool access. To remove restrictions created by this extension:

```sh
node bin/control-center.mjs restore --yes
```

This affects all projects using the server. It removes only marked Control Center
entries. Existing permissions, policies, credentials, and plugin entries remain.

## Browse the catalog

Run `/control-center`, or choose **Open Control Center** in the command palette.
Use `/control-center skill` to start with one category. Category names are `agent`,
`skill`, `plugin`, `mcp`, `command`, `provider`, and `model`.

The catalog uses OpenCode's native searchable dialogs:

| Action | Control |
| --- | --- |
| Search names, IDs, descriptions, and model details | Type in the search field |
| Change category | Ctrl+F |
| Filter by state | Ctrl+S |
| Refresh the inventory | Ctrl+R |
| Inspect an item or change it | Enter |
| Return or close | Escape |

Sidebar headings expand or collapse on click. Each expanded category shows up to
three entries. Select an item and choose **Pin to sidebar** to choose which entries
appear. Pins and collapsed sections are terminal presentation preferences; they
do not enable or disable resources. Keyboard-only users can access every resource
and action through `/control-center`, even when the terminal hides the sidebar.

## What the controls mean

All changes require a preview and **Apply globally** confirmation. They affect
every project using that server, not just the current conversation. Wait for other
work to finish before changing resources it may use.

| Resource | Supported control |
| --- | --- |
| Skills from configured local sources | Add an exact `skill.use` denial |
| MCP servers in your global configuration | Add an exact `mcp.use` denial; do not delete credentials |
| Local plugins inside your OpenCode configuration directory | Add an exact `-plugin-id` entry |
| Agents | Inspect; use `/agents` to select |
| Commands, providers, models | Inspect; use native OpenCode or Console controls |
| Built-in, managed, unknown-source plugins | Read-only |
| Control Center itself | Use the external `unload` command |

**Enable** removes this extension's denial. It never adds an `allow`, removes an
external restriction, or overrides managed policy. A missing resource stays in
the catalog as a disabled row when Control Center owns its restriction, so you can
restore it after a reload or restart.

**Restricted; still listed** means the config entry exists but the live catalog
still includes the resource. Do not interpret that state as successful blocking.
Higher-priority policy, reload timing, or plugin ordering may explain the result.
Refresh and use the native controls to verify access. Disabling a skill does not
remove instructions already loaded into an existing conversation.

## Troubleshoot

1. Run `node bin/control-center.mjs status` to inspect the load entry and owned
   restriction count. No credentials are needed.
2. Run `node bin/control-center.mjs unload` to remove both extension parts from
   configuration. The package lives outside automatic plugin discovery.
3. Use `/reload`. If only the terminal is unusable, open a terminal without its UI:

   ```sh
   OPENCODE_CLI_CONFIG_CONTENT='{"plugins":["*","-personal.control-center"]}' opencode
   ```

   This suppresses only the TUI part for that process. Use `unload` for the server
   part. It does not bypass any policy or remove resource restrictions.
4. Fix the failure, run `make check`, and use `load` to re-enable the extension.

If an apply request loses its response during configuration reload, refresh before
retrying: the write might already have succeeded. If a `.cc-lock` file remains
after a crash, first ensure no Control Center command is running. Inspect the lock
beside your global config, then remove that lock manually and retry. Never delete
the global configuration to clear a lock.

Do not edit text inside `cc:begin` / `cc:end` ownership markers. The controller
rejects modified blocks rather than risk deleting your edits. Unload still works
without calling the server. Preserve the file and repair the marked block manually
if normal restore cannot parse it.

## Development

```sh
npm ci --ignore-scripts
make check
```

See [Architecture](docs/ARCHITECTURE.md) for module boundaries and configuration
ownership, [Threat model](docs/THREAT_MODEL.md) for safety limits, and
[Validation](docs/VALIDATION.md) for evidence and remaining manual checks.
