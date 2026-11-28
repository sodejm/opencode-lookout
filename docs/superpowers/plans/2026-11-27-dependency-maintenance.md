# Dependency Maintenance Implementation Plan

> **For agentic workers:** Execute each task natively in this authorized maintenance session.

**Goal:** Resolve the four dependency PRs with compatible updates and passing required checks.

**Architecture:** Consolidate CodeQL action pins and dependency patches. Defer incompatible major updates through documented Dependabot constraints.

**Tech Stack:** Node.js, npm, Babel 7, Solid 1, TypeScript 6, GitHub Actions.

**Spec:** AGENTS.md and CONTRIBUTING.md; maintainer request to investigate, fix, and merge current issues.

## Global Constraints

Preserve public OpenCode 2.4.1 APIs and all Lookout identifiers. Keep install scripts disabled and existing security gates. Do not publish a package.

## Review Focus

Mismatched CodeQL steps must fail the regression check. Peer requirements must resolve without force flags. Packed consumers must install on supported Node versions. Docker fixtures must retain provider/tool denials. Required full-branch scans must pass before merge.

### Task 1: Compatible dependency maintenance

**Files:** package.json, package-lock.json, .github/dependabot.yml, .github/workflows/codeql.yml, test/development.test.mjs, CONTRIBUTING.md, docs/THREAT_MODEL.md.

**Interfaces:** Existing package scripts and public plugin APIs remain unchanged.

- [x] Add the CodeQL pin consistency regression test and verify a mismatched pin fails.
- [x] Synchronize CodeQL pins; group future updates; document peer-blocked majors.
- [x] Apply compatible development dependency patches and resolve the lockfile with scripts disabled.
- [x] Audit the complete lockfile delta before installing.
- [x] Run make check, inspect the diff, and create a local checkpoint.
- [ ] Push the candidate and require all hosted checks including compatibility and full CodeQL scans.
- [ ] Merge the exact passing revision, close superseded PRs, and verify the final repository state.
