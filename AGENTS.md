# Contributor contract

Read README.md and CONTRIBUTING.md before editing. Inspect branch, worktree, and
local changes; preserve unrelated work. Do not copy personal OpenCode configuration,
credentials, transcripts, or machine-specific paths into this repository.

## Agent guidance format

This repository adopts [AGENTS.md](https://aaif.io/projects/agents-md), the simple,
open format for guiding coding agents stewarded by the Agentic AI Foundation (AAIF).
Keep this project-local guidance concise, actionable, and aligned with README.md and
CONTRIBUTING.md; adoption does not imply AAIF affiliation or endorsement.

When changing an agent-facing interface or integration, first check
[AAIF Projects](https://aaif.io/projects), follow each applicable upstream
specification, and verify compatibility on every supported OpenCode version before
handoff. Use the repository compatibility suite when live CLI evidence is required.

- Keep the change focused. Preserve the `opencode-lookout` plugin/RPC ID,
  `/lookout` command, recovery CLI, storage keys, and `lookout:` markers unless
  the maintainer explicitly approves a migration.
- Encode behavioral changes in tests. Use `make check` before handoff; UI/config
  changes also need isolated integration tests. Do not use personal resources as
  destructive test fixtures. Keep fixture provider/tool denials in place.
- Update affected docs and the threat model, or record a specific no-impact reason.
- Use semantic theme colors and public OpenCode 2.4.1 APIs. Never substitute V1 SDKs.
- Create a local checkpoint after a coherent, validated authorized change. Do not
  rewrite history or discard unrelated work. Push, release, or publish only when
  explicitly authorized. npm publication is manual, uses trusted publishing, and
  requires exact-revision approval plus the release gates in docs/RELEASING.md.
  The sole exception is the explicitly approved first-package v0.1.2 bootstrap
  documented there; it does not authorize token-based publishing for later versions.
- Report exact validation, skips, and remaining risks. Automated review is not
  human approval; the maintainer reviews the exact revision before merge/release.

The project has one maintainer. Do not introduce mandatory second-reviewer gates,
automatic publishing, or external service requirements without approval.
