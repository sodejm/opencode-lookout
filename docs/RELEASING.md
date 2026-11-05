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
certify provider readiness, or install an update for users. The repository keeps
`private: true`, and there is no automatic publishing workflow.

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
Use zero required external approvals: the sole maintainer reviews the exact
revision. Disable force pushes/deletions and apply the checks to administrators.
Remote protection must be verified live; this document alone does not enable it.

Only standard public GitHub runners are used. No self-hosted runners, artifact
uploads, or cache actions are configured. Runner logs still have normal GitHub
retention. Do not add paid runners or external service requirements implicitly.
Keep `private: true`. Future npm publication needs a separate packaging review
and OIDC trusted-publishing setup; never reuse a token from conversation history.
