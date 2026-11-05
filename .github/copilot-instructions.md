# OpenCode Lookout contributor instructions

Read [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md) before
editing. They are the shared contributor contract for agents and humans.

Use public OpenCode V2 APIs, strict TypeScript, and checked JSDoc. Run `make check`
and the relevant isolated integration tests. Preserve fixture provider/tool
denials; never test destructive controls against personal resources. Report exact
commands, failures, and unrun checks. Security findings of every severity block
release. Do not publish, push, or change personal configuration without authority.

Do not add credentials, model choices, permission grants, or automatic plugin
loading to development configuration. Automated review is not maintainer approval.
