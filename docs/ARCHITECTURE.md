# Architecture

## Release tooling boundary

`scripts/release-policy.mjs` contains pure report, freshness, and compatibility
validation. `security.mjs` owns scanner execution, pinned rule acquisition, and
full-history/working-tree scans. `compatibility.mjs` owns version discovery,
artifact-bound Docker builds, terminal tests, and fixture cleanup.
`release-check.mjs` requires a clean source revision and fresh matching receipts,
reruns quality checks, and writes a local assessment. None of these scripts
publishes packages or changes user configuration. CI runs the same entry points.

## Boundaries

`src/tui.tsx` contributes to `sidebar.content` and uses native select and confirmation
dialogs plus a read-only inspector in the host dialog container. It uses semantic
theme colors, not hardcoded Carbonfox colors
or private host renderables. The UI requests a location-scoped inventory through
`src/rpc.ts`. It never writes configuration or executes a shell command.

The display allowlist excludes MCP from sidebar headings, category selection,
search, and saved pins; OpenCode provides that interface natively. The server's
seven-category RPC contract and owned MCP restrictions remain unchanged for
compatibility and offline recovery. Status dots use the same semantic feedback
tokens as the native MCP sidebar, with muted text for inactive entries.

`src/server.ts` reads the public V2 catalogs. Each category can fail independently;
the UI keeps stale data and disables controls rather than infer an empty catalog.
Inventory normalization in `src/catalog.mjs` copies only display fields. It does
not serialize prompts, skill bodies, MCP commands, provider headers, or credentials.

`src/plugin-description.mjs` enriches plugin rows from their exact local source.
Directories use their own `package.json` description; single files use only a
leading JSDoc `@description` tag. Reads are bounded to 64 KiB for manifests and a
16 KiB source prefix. Only the sanitized description (at most 400 UTF-16 code
units) reaches the UI. Metadata failures return `missing description` without
failing the catalog. There is no code evaluation, ancestor search, registry
request, or plugin-ID lookup table. Refresh rereads metadata rather than retaining
an outdated description cache. This tag is a Lookout convention, not an OpenCode
SDK field.

`src/controller.mjs` validates disable requests against a fresh inventory before
preview and apply. Enable requests require an owned restriction, even when the
resource has disappeared from the catalog. A random, single-use token binds the request to a file fingerprint for
60 seconds. A new preview invalidates the previous preview in that instance.
`src/config.mjs` owns exact-ID entries in marked array regions. Enabling removes
an owned entry; it never creates an overriding allow rule.

`bin/lookout.mjs` is the independent recovery path. It requires only Node.js
and the package's installed JSONC parser, not a working OpenCode process.

## Configuration ownership

OpenCode does not discover an arbitrary `lookout.jsonc`, so controls use
the existing global configuration. The controller writes only `policies` and
`plugins` arrays. JSONC syntax-tree validation rejects duplicate keys, damaged
ownership markers, and unexpected entry shapes. If an array already exists,
removing its managed block restores the original bytes. If the controller creates
an array, restoring its entries leaves an empty array.

Plugin load/unload uses a separate `lookout:lifecycle` marker. Unload replaces the
package path with `-opencode-lookout`. It does not remove resource-denial
blocks. The source directory is outside `plugins/`, so removing the load entry
actually stops discovery. Do not copy a second instance into `plugins/`.

Writes use an exclusive lock, a same-directory temporary file, flush, fingerprint
recheck, and atomic rename. The controller rejects symlinked or hard-linked files.
A lock serializes Lookout writers. An unrelated editor does not participate
in that lock: a small race remains between the final check and rename. Avoid
editing global config while confirming a change.

## Lifecycle and scope

Server cleanup removes its RPC registration and clears outstanding previews.
TUI cleanup aborts requests, cancels its refresh timer, removes its event listener,
disposes its Solid root, and unregisters the sidebar contribution. OpenCode owns
the lifecycle of the registered keymap layer. Requests for an old location cannot
replace the current inventory.

UI preferences are stored through OpenCode's terminal-local plugin storage.
They survive reloads and contain only collapsed sections and pinned IDs. Resource
restrictions live in the server's global config, not terminal storage. For remote
servers, controls affect the remote user's configuration; local unload changes
only the local installation. Run recovery commands on the relevant server host.

## Language and API conventions

- TypeScript defines the OpenCode integration and public UI data contracts.
- JavaScript modules use JSDoc to document exported behavior and security-sensitive
  boundaries. Tests exercise these pure modules without OpenCode or a terminal.
- Comments explain ownership, failure handling, and constraints. They do not
  narrate assignments or duplicate type declarations.
- V2 SDK dependencies are pinned to the target OpenCode release. Do not substitute
  the old `@opencode-ai/plugin` package or invent compatibility aliases.
- Changes must pass `make check`; changes to configuration semantics also need an
  isolated live server test before deployment to the personal environment.

## API references

- [TUI plugin API](https://opencode.ai/v2/docs/build/plugins/cli/)
- [Server plugin API](https://opencode.ai/v2/docs/build/plugins/server/)
- [RPC API](https://opencode.ai/v2/docs/build/plugins/rpc/)
- [Plugin loading and control](https://opencode.ai/v2/docs/plugins/)
- [Policy precedence](https://opencode.ai/v2/docs/policies/)
