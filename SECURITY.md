# Security policy

Lookout runs with the filesystem authority of your OpenCode process. Its controls
edit global configuration and can affect other sessions. It is not a sandbox.
Read the [threat model](docs/THREAT_MODEL.md) before enabling resource controls.

## Supported versions

Security fixes target the current `main` branch. The initial package version is
0.1.0, targeting OpenCode 2.2.5. The release matrix requires read-only behavior on
2.2.1–2.2.2 and full controls on supported V2 versions from 2.2.3 onward. Consult
the exact release's test evidence; the API version floor is not a blanket claim
that every future CLI is compatible. There are no maintained older release
branches or guaranteed response times.

## Report a vulnerability privately

Use [GitHub's private vulnerability report form](https://github.com/sodejm/opencode-lookout/security/advisories/new).
Include affected revisions, impact, and a minimal reproduction with synthetic
data. Do not open a public issue containing exploit details, credentials, global
configuration, or retained test transcripts. If the private form is unavailable,
open an issue asking for a private reporting channel without technical details.

If a credential was exposed, revoke or rotate it through its provider. Removing
it from an issue or commit is not enough. Do not send the credential to maintainers.

The maintainer will assess the report, coordinate a fix and disclosure, and credit
reporters who want attribution. Automated checks are not security certification.

## Safe recovery

From the installed checkout, run `node bin/lookout.mjs unload`. This works
without OpenCode and preserves resource restrictions. Use `restore --yes` only
when you intend to remove all restrictions owned by this extension. Never delete
the global configuration to recover. See the [recovery guide](README.md#troubleshoot).
