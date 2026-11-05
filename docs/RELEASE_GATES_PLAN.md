# Release assurance implementation plan

## Goal and boundaries

Add fail-closed release validation without publishing a release, installing a
self-hosted runner or spending on hosted services. Apply the approved naming break
below. Preserve the installed checkout; work on `feat/release-gates`.

## Authorized naming migration

The maintainer approved a clean naming break, superseding the compatibility
requirement. New identifiers are `opencode-lookout`, `/lookout`,
`bin/lookout.mjs`, and `lookout:` markers. No legacy aliases or preference
migration are required. Do not touch the installed copy, personal configuration,
or private host storage. Reinstallation is deferred until after remote release.

Tests must cover damaged markers, idempotent load/unload, retained restrictions,
rejected self-disables, and offline recovery. Public GitHub already uses
`opencode-lookout`; verify hosted state before delivery. Old restrictions must be
restored with the old checkout before reinstalling; never silently remove them.

## Execution checkpoints

The maintainer chose the current policy API rather than an adapter for OpenCode
2.2.1/2.2.2, then approved a support-aware test policy after the first realistic
matrix test exposed the API change. Controls require V2 2.2.3+. All five versions
remain mandatory: 2.2.1/2.2.2 must prove read-only inventory, rejected mutations,
offline lifecycle/recovery, and both terminal browsing flows. Other versions
must pass full controls and both terminal flows. Unknown versions do not become
read-only skips. Evidence records and validates each target's profile.

- [ ] Quality, dependency remediation, and naming migration: `src/`, `bin/`,
  existing tests and docs; run `make check` and both isolated terminal cases.
- [ ] Scanner/evidence validation: `scripts/`, failure fixtures in `test/`;
  reject every finding, error, missing report, and source mismatch.
- [ ] Docker matrix and hosted gates: discover and exercise five stable versions
  and the next RC, then validate workflows and repository protection.
- [ ] Portable editor/agent guidance and final delivery evidence.

## Work units

1. **Quality and documentation:** enable checked JavaScript alongside strict
   TypeScript, add lint/JSDoc checks, document module contracts, and run `make check`.
2. **Release evidence:** add tested parsers that reject any scanner finding/error,
   missing/stale evidence, nonzero test results, and incomplete compatibility sets.
   Audit all dependency classes and full Git history; never use severity waivers.
3. **Containers:** discover the newest five stable `@opencode/cli` versions plus
   the newest RC for the next release when present. Run actual server/TUI flows in
   isolated local Docker containers, bound to immutable source and CLI artifacts.
4. **Hosted gates:** run quality, OSS security, dependency/supply-chain, and container
   compatibility checks on public standard Ubuntu runners. Avoid artifact uploads,
   caches, paid scanners, and privileged PR jobs. Manual release assessment also
   requires matching local evidence and human review; it does not publish.
5. **Governance:** configure single-maintainer protections (zero required external
   approvals), security settings, release documentation, and explicit support limits.

## Acceptance and failure paths

Test low/unknown-severity findings, scanner errors and empty/malformed reports;
stale/mismatched source evidence; fewer than five stable versions; a newly
available RC; failed/missing matrix entries; and container cleanup. A blocked
upstream dependency is a release blocker, not permission to weaken the policy.

All code needs typed public contracts or checked JSDoc, with side effects and
failure/recovery behavior explained. A clean result means only no findings in the
configured checks at that time. It is not a guarantee that vulnerabilities do not
exist. No new platform or CLI support claim is made until its test passes.
