# Contributor contract

Read README.md and CONTRIBUTING.md before editing. Inspect branch, worktree, and
local changes; preserve unrelated work. Do not copy personal OpenCode configuration,
credentials, transcripts, or machine-specific paths into this repository.

- Keep the change focused. Preserve the `personal.control-center` plugin/RPC ID,
  `/control-center` command, recovery CLI, storage keys, and `cc:` markers unless
  the maintainer explicitly approves a migration.
- Encode behavioral changes in tests. Use `make check` before handoff; UI/config
  changes also need isolated integration tests. Do not use personal resources as
  destructive test fixtures. Keep fixture provider/tool denials in place.
- Update affected docs and the threat model, or record a specific no-impact reason.
- Use semantic theme colors and public OpenCode 2.2.5 APIs. Never substitute V1 SDKs.
- Create a local checkpoint after a coherent, validated authorized change. Do not
  rewrite history or discard unrelated work. Push, release, or publish only when
  explicitly authorized. `private: true` intentionally blocks npm publication.
- Report exact validation, skips, and remaining risks. Automated review is not
  human approval; the maintainer reviews the exact revision before merge/release.

The project has one maintainer. Do not introduce mandatory second-reviewer gates,
automatic publishing, or external service requirements without approval.
