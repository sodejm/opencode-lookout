# Contributing to OpenCode Lookout

Start with a focused issue for substantial behavior or API changes. Bug fixes,
tests, and documentation improvements can go directly to a pull request. Keep
unrelated cleanup separate. Contributions are licensed under [MIT](LICENSE).

## Set up

Use Node.js 22 or later and npm. OpenCode 2.2.5 is needed only for live integration
tests. The optional terminal harness needs macOS's `/usr/bin/expect`.

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
their trust implications. CI checks Node.js 22 and 24 on Linux, but does not prove
OpenCode loading, provider authentication, or terminal rendering.

GitHub Actions run with read-only repository permissions and pinned action
revisions. Do not add secret-bearing PR jobs, `pull_request_target` execution of
contributor code, or automatic publishing. AI-assisted contributions have the
same testing, attribution, security, and human-review requirements as other work.
