# OpenCode Lookout

[![CI](https://github.com/sodejm/opencode-lookout/actions/workflows/ci.yml/badge.svg)](https://github.com/sodejm/opencode-lookout/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Inspect agents, skills, plugins, commands, providers, and models in
OpenCode's terminal interface. The extension appends a compact section to the
existing sidebar. It does not replace Context or MCP status.
Use OpenCode's native MCP section or `/mcps` for MCP inventory and controls.

Lookout is an independent community extension, not an official OpenCode product.
It targets OpenCode **2.2.5** and Node.js **22 or later**. The repository is public
under the MIT license; the package remains `private: true` to prevent accidental
npm publication. Compatibility with other OpenCode versions is not established.

## Install

Clone outside OpenCode's automatically discovered `plugins/` directory:

```sh
git clone https://github.com/sodejm/opencode-lookout.git
cd opencode-lookout
npm ci --ignore-scripts
make check
node bin/control-center.mjs load
```

Create your global OpenCode configuration through OpenCode first if it does not
exist. Lookout requires exactly one `opencode.json` or `opencode.jsonc` there;
it will not create a new config or choose between two files. Keep the checkout
at its installed path, because the load entry refers to that directory.

**Existing installations:** do not clone a second instance. Update your existing
checkout and use `/reload`. The plugin/RPC ID `personal.control-center`, command
`/control-center`, recovery filename, storage keys, and `cc:` ownership markers
remain stable. Some restriction and error messages still use **Control Center**,
the extension's original name. No configuration migration is required.

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

Run `/control-center`, or choose **Open Lookout** in the command palette.
Use `/control-center skill` to start with one category. Category names are `agent`,
`skill`, `plugin`, `command`, `provider`, and `model`.

The catalog uses OpenCode's native searchable dialogs:

| Action | Control |
| --- | --- |
| Search names, IDs, descriptions, and model details | Type in the search field |
| Change category | Ctrl+F |
| Filter by state | Ctrl+S |
| Refresh the inventory | Ctrl+R |
| Inspect an item or change it | Enter |
| Return or close | Escape |

Selecting an item opens its action menu. **Show details** opens a read-only
inspector; Escape closes it back to the prompt. Run `/control-center` again to
browse another item.

Sidebar headings expand or collapse on click. Each expanded category shows up to
three entries. Select an item and choose **Pin to sidebar** to choose which entries
appear. Pins and collapsed sections are terminal presentation preferences; they
do not enable or disable resources. Keyboard-only users can access every resource
and action through `/control-center`, even when the terminal hides the sidebar.

Status dots use the native sidebar's semantic theme colors: green for available
or active entries, yellow for pending, stale, unknown, or still-listed restrictions,
grey for disabled or inactive entries, and red for failures. The selected agent
also has an arrow. Green reflects catalog availability, not verified provider
authentication, quota, or successful execution. Open an item's details for its
text status.

## What the controls mean

Resource changes require a preview and **Apply Globally** confirmation. They affect
every project using that server, not just the current conversation. Wait for other
work to finish before changing resources it may use.

| Resource | Supported control |
| --- | --- |
| Skills from configured local sources | Add an exact `skill.use` denial |
| Local plugins inside your OpenCode configuration directory | Add an exact `-plugin-id` entry |
| Agents | Inspect; use `/agents` to select |
| Commands, providers, models | Inspect; use native OpenCode or Console controls |
| Built-in, managed, unknown-source plugins | Read-only |
| Lookout itself | Use the external `unload` command |

**Enable** removes this extension's denial. It never adds an `allow`, removes an
external restriction, or overrides managed policy. A missing resource stays in
the catalog as a disabled row when Control Center owns its restriction, so you can
restore it after a reload or restart.

Older Control Center MCP restrictions are preserved, not silently removed when
the inventory is hidden. Use the external `restore --yes` command to remove all
Control Center restrictions, including those MCP entries. The legacy MCP RPC
contract remains available for compatibility; it is not exposed in the browser.

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
npm run test:integration
npm run test:tui
CC_TUI=1 CC_NARROW=1 CC_THEME=tokyonight npm run test:integration
```

The integration checks require the `opencode` executable. Terminal checks also
require `/usr/bin/expect`. They use a temporary HOME and deny provider and tool
use. Set `CC_KEEP_FIXTURE=1` to retain a failed fixture for local inspection; do not
share its credential files or raw terminal transcript.

See [Architecture](docs/ARCHITECTURE.md) for module boundaries and configuration
ownership, [Threat model](docs/THREAT_MODEL.md) for safety limits, and
[Validation](docs/VALIDATION.md) for evidence and remaining manual checks.

## Project information

- [Contributing](CONTRIBUTING.md): setup, tests, and review expectations.
- [Security](SECURITY.md): supported versions and private vulnerability reports.
- [Support](SUPPORT.md): troubleshooting and useful bug reports.
- [Code of conduct](CODE_OF_CONDUCT.md) and [governance](GOVERNANCE.md).
- [Changelog](CHANGELOG.md) and [MIT license](LICENSE).
- [Repository metadata and release policy](docs/RELEASING.md).
