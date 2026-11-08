# Repository metadata and releases

The GitHub repository description should explain what Lookout does without
claiming official OpenCode affiliation or verified security. Use topic tags for
discovery: `opencode`, `opencode-plugin`, `tui`, `terminal`, `sidebar`, `typescript`,
and `developer-tools`. Topics are not Git release tags.

## Version and tag policy

Use [Semantic Versioning](https://semver.org/) and annotated Git tags named
`vMAJOR.MINOR.PATCH`. During 0.x development, describe compatibility changes
explicitly in the changelog; do not treat a minor bump as a migration plan.
Prereleases use suffixes such as `v0.2.0-rc.1`. Never move or replace a published
tag. Create a new version if a release needs correction.

Tags identify reviewed source revisions. They do not publish an npm package,
certify provider readiness, or install an update for users. There is
no automatic publishing workflow. v0.1.2 introduces a separate, manually
dispatched npm workflow; the older source-release tags remain unchanged.

## Release checklist

1. Review the exact commit, including security, compatibility, recovery, dependency,
   and license impact. Record the maintainer's approval and commit ID in the PR
   or release notes. Automated review does not satisfy this step.
2. Update package and lockfile versions together. Move the relevant changelog
   entries from **Unreleased** to a dated version section.
3. On the clean candidate, run `make check`, `npm run security`,
   `npm run test:compatibility`, and `npm run release:check`. Require all hosted
   CI jobs, including **Release gate**, to pass on that same revision. Record the
   source digest, CLI versions/artifacts, container architecture, and Node versions.
   The required **Analyze** checks must come from full `push` or
   `workflow_dispatch` runs on the candidate, not the separate **PR Analyze**
   checks. After merging, verify the full checks on `main` too and confirm its
   source tree is identical to the approved candidate before publishing.
4. Inspect tracked files and full history for private data. Every configured
   finding at any severity, scanner error, missing result, stale receipt, or
   incomplete compatibility result blocks. Do not waive or suppress findings to
   make a release pass. Fix the root cause or leave the release blocked.
5. Create a signed annotated tag if signing is available, or an annotated tag
   otherwise. Confirm the tag targets the approved commit before pushing it.
   Push only that named tag; do not use a blanket tag push.
6. Create a GitHub release deliberately, with behavior changes, compatibility,
   validation, recovery, and known limitations. Do not attach personal config,
   logs, credentials, or retained test fixtures.

Public repository creation is not an initial release. Leave changes under
**Unreleased** and omit a release tag until this checklist is satisfied.

## Scanner prerequisites and evidence

Install Semgrep 1.182.0, Trivy 0.76.1, Gitleaks 8.30.1, Docker, and Node 26.4.0+.
CI installs checksum-verified binaries and uses a digest-pinned
Semgrep image; see `scripts/install-ci-scanners.sh`. Semgrep rules are downloaded
from commit `16b9e6d45f10649f6a531ec4838ed9924372c3bc` with a pinned checksum.
Only JavaScript/TypeScript language security and GitHub Actions security packs
are selected. React-specific style/i18n rules are not applicable to this Solid TUI;
registry packs requiring the paid Pro engine are not silently counted as passing.
The rules retain the upstream Semgrep Rules License and are not vendored as MIT.

All receipts live in ignored `release-evidence/`. Release assessment requires
receipts no older than 24 hours and re-discovers CLI targets; a new RC invalidates
an older matrix. Missing tools, registry outages, scanner database failures, and
nonzero test statuses block instead of falling back to previous success. Re-run
after correcting the cause. Failed runs must never be presented as passes.

The matrix tests supported behavior, not identical features on every CLI. The
maintainer-approved profiles are **read-only** for 2.2.1/2.2.2 and **controls**
for the remaining targets. Read-only cases must prove rejected mutations, safe
inventory, lifecycle, and both terminal browsing flows. Control cases must prove
effective skill/MCP/plugin restrictions and recovery as well. Every case must
pass its explicit profile; any new unsupported CLI blocks until reviewed.

## Single-maintainer hosted protection

Require a pull request, resolved conversations, and successful **Runtime (Node 22)**,
**Runtime (Node 24)**, **Quality (Node 26)**, **Security**, **Compatibility**, and
**Release gate** checks, plus CodeQL's **Analyze (actions)** and
**Analyze (javascript-typescript)**. The CI aggregate does not replace those
separate hosted CodeQL checks. Each CodeQL job validates SARIF for every finding
and analysis error after the analyze action succeeds.
Full scans run on every repository branch push. PR scans remain available as
**PR Analyze (actions)** and **PR Analyze (javascript-typescript)**, but their
change-focused results cannot substitute for full-candidate assurance. For a fork
PR, the maintainer must bring the reviewed candidate onto a repository branch
and obtain the required full checks; do not bypass protection to merge it.
Use zero required external approvals: the sole maintainer reviews the exact
revision. Disable force pushes/deletions and apply the checks to administrators.
Remote protection must be verified live; this document alone does not enable it.

Only standard public GitHub runners are used. No self-hosted runners, artifact
uploads, or cache actions are configured. Runner logs still have normal GitHub
retention. Do not add paid runners or external service requirements implicitly.
Never reuse a token from conversation history.

## Manual npm publication (v0.1.2 onward)

Preparation does not authorize publication. Obtain exact-revision maintainer
approval after reviewing packaging, generated TUI, consumer audits and installed
server/TUI evidence. Complete the GitHub release checklist first, including full
candidate and post-merge CodeQL. The approved tag and main must have identical
source trees. Re-run stale hosted checks: every required job must have completed
successfully within 24 hours. A newer failed or incomplete workflow blocks; the
validator does not fall back to an older success.

Configure an npm trusted publisher for GitHub owner `sodejm`, repository
`opencode-lookout`, workflow filename `npm-publish.yml`, environment `npm`.
Use GitHub-hosted standard runners. Configure the GitHub `npm` environment to
allow reviewed release tags and require the sole maintainer's approval; do not
require a second reviewer. Verify these settings live. Give the publisher only
the required publish permission, not dist-tag administration. No npm token is
stored in the repository or workflow. See the current
[npm trusted publishing guide](https://docs.npmjs.com/trusted-publishers/).

**First-package bootstrap remains an account-setup decision.** npm's
[trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust) require the
package to already exist on the registry. A registry
404 does not establish ownership, and local `npm whoami` is not an OIDC permission
check. If package settings are not available for this new name, stop and agree a
bootstrap procedure with the maintainer. Do not publish a placeholder, use the
revoked token, silently switch to token publishing, or claim OIDC provenance for
a local publish. Login/2FA must happen in the maintainer's own terminal or npm UI,
never by sharing credentials in chat.

### Approved one-time v0.1.2 bootstrap

The maintainer approved publishing the real first `opencode-lookout@0.1.2`
artifact using the existing authenticated npm login, with 2FA completed privately.
This is a one-time exception to OIDC publication, not permission to publish a
placeholder or use the revoked token. It does not waive any quality, security,
compatibility, signed-tag, GitHub-release, exact-revision approval, or post-merge
gate above. Record the approved SHA and tested tarball integrity in the release.

Before publishing, verify the registry still has no package, verify account
identity, and run `node scripts/check-package-evidence.mjs PATH_TO_TESTED_TARBALL`
on the clean approved checkout with fresh evidence. Publish those exact tarball
bytes with `npm publish PATH_TO_TESTED_TARBALL --access public --ignore-scripts`
from the maintainer's terminal. Never send credentials or 2FA codes through chat.
If publication is interrupted, query the registry before retrying; do not attempt
to replace an existing version.

This version has **no GitHub OIDC provenance**. Verify its registry integrity
against the approved artifact and test a fresh registry installation, including
offline recovery and both isolated terminal modes. After the package exists,
configure the trusted publisher described above for future versions. Do not
dispatch the OIDC workflow for the already-published v0.1.2: npm versions are
immutable. This exception expires after the first successful v0.1.2 publication.

### Subsequent trusted publications

After account setup and exact approval, manually dispatch **Publish npm (manual)**
on the published tag (not `main`) with `approved_sha` set to its full commit ID:

```sh
gh workflow run npm-publish.yml --ref vX.Y.Z -f approved_sha=FULL_APPROVED_COMMIT
```

The workflow verifies the signed annotated tag through GitHub, the non-draft
GitHub release, the approved SHA and fresh hosted CI/full-CodeQL runs. It installs
with scripts disabled, reruns security, Docker and release assessment, packs and
tests the actual tarball, and checks its integrity against Docker evidence. It
rechecks hosted state immediately before `npm publish --provenance` using OIDC.
The job has `id-token: write` only for this manual operation; PR CI cannot publish.
Provenance binds the workflow's tag revision to the artifact, not to human review.

After publication, verify the registry's version, tarball integrity and provenance
against the workflow output and approved tag. Install the registry artifact in a
fresh isolated prefix and rerun packed recovery/server/TUI validation before
claiming npm delivery complete. If the job is interrupted after publication,
inspect registry state first: published versions are immutable, and the workflow
rejects an already-present version rather than attempting to replace it.
