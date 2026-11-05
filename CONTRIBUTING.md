# Contributing to OpenCode Lookout

Start with a focused issue for substantial behavior or API changes. Bug fixes,
tests, and documentation improvements can go directly to a pull request. Keep
unrelated cleanup separate. Contributions are licensed under [MIT](LICENSE).

## Set up

Use Node.js 26.4.0+ and npm for development, as required by OpenTUI 0.8.0.
Use npm 11 or later to install the lockfile. npm 10 misresolves the patched
override graph and rejects `npm ci`; do not remove the overrides to work around it.
Runtime CI installs with npm 11.19.1 while still running tests on Node 22 and 24.
Development uses Node 26 declarations. Do not assume a type-checked Node API is
available to the offline CLI on Node 22; its production-only runtime tests remain required.
The offline CLI retains Node.js 22+ support with production
dependencies only. OpenCode 2.2.5 is needed only for live integration
tests. The optional terminal harness needs `/usr/bin/expect` (macOS or Linux).

```sh
git clone https://github.com/sodejm/opencode-lookout.git
cd opencode-lookout
npm ci --ignore-scripts
make check
```

Do not load an unreviewed contribution into your personal OpenCode environment.
Use `npm run test:integration` or `npm run test:tui`: these start an isolated server
with temporary HOME/XDG directories and deny provider and tool use. See
[Validation](docs/VALIDATION.md) for the runtime matrix and limitations.

## Make a change

1. Create a focused branch. Reproduce a behavioral bug with a test when practical.
2. Preserve the plugin ID, RPC contract, configuration markers, and offline
   recovery commands unless a migration has been explicitly agreed.
3. Use typed TypeScript contracts and JSDoc for exported JavaScript behavior.
   Explain non-obvious constraints and failure paths, not routine assignments.
4. Update affected user and architecture docs. For security-sensitive changes,
   update the [threat model](docs/THREAT_MODEL.md) and test failure/recovery paths.
5. Run `make check`. For UI or config changes, also run both terminal cases in the
   validation guide. Do not describe unavailable checks as passing.
6. Review the diff for credentials, personal paths, transcripts, and unrelated
   edits. Never commit retained test fixtures or global OpenCode configuration.
7. Submit a PR with the behavior change, evidence, compatibility impact, and
   recovery procedure. A maintainer reviews the exact revision before merging.

Format source with the pinned Prettier version:

```sh
npm exec -- prettier --write 'src/**/*.{mjs,ts,tsx}' 'test/**/*.mjs' 'bin/*.mjs' 'scripts/*.mjs' '*.json'
```

## Dependencies and CI

Keep the SDK and OpenTUI versions aligned with the tested OpenCode release. Commit
`package-lock.json`; install with scripts disabled. Explain new dependencies and
their trust implications. CI checks quality on Node.js 26 and runtime tests with
production dependencies on Node.js 22 and 24. The Docker job
exercises real OpenCode loading and terminal workflows; it does not prove provider
authentication or pixel-level rendering. All security severities block release.

GitHub Actions use pinned revisions and read-only repository permissions, except
the existing CodeQL job's `security-events: write` permission to upload scan
results. Do not add secret-bearing PR jobs, `pull_request_target` execution of
contributor code, or automatic publishing. AI-assisted contributions have the
same testing, attribution, security, and human-review requirements as other work.

## Agent and editor development

OpenCode reads `opencode.json` and the shared `AGENTS.md`/contributor guidance.
Copilot's repository instructions point to the same contract. Neither adapter
selects models, grants permissions, loads this plugin, or installs MCP servers.

Open `opencode-lookout.code-workspace` in VS Code, review Workspace Trust, and run
**Lookout: install** yourself. Accepting recommended extensions is optional.
Tasks cover checks, lint, tests, Docker compatibility, security, and release
assessment. Tasks do not run on workspace open. Use the workspace TypeScript
version after installation. Terminal tests need Linux/macOS; use Docker on other
hosts. No editor task loads the plugin into personal configuration.

## Dependency remediation

The lockfile overrides vulnerable `glob` 9–14.0.1 with 14.0.3 and `minimatch`
7–11.0.0 with 11.0.4. These major-version overrides address
GHSA-3g3m-2fjr-6pw4 and GHSA-g3hv-75wg-m249; they are not severity waivers.
Older unaffected majors are not replaced. `make check` and actual server/TUI
integration must pass after each override change. Remove an override only when
the upstream graph resolves patched versions and the full checks still pass.
