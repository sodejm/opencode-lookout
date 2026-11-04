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
3. Run `make check` and both isolated terminal cases. Verify hosted CI for the
   same commit. Record supported OpenCode/Node versions and skipped checks.
4. Inspect tracked files and full history for private data. Run
   `gitleaks git --redact --log-opts='--all' .` when Gitleaks is installed.
5. Create a signed annotated tag if signing is available, or an annotated tag
   otherwise. Confirm the tag targets the approved commit before pushing it.
   Push only that named tag; do not use a blanket tag push.
6. Create a GitHub release deliberately, with behavior changes, compatibility,
   validation, recovery, and known limitations. Do not attach personal config,
   logs, credentials, or retained test fixtures.

Public repository creation is not an initial release. Leave changes under
**Unreleased** and omit a release tag until this checklist is satisfied.
