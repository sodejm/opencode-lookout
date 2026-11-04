# Validation

## Local checks

`make check` runs TypeScript checking and Node's native test runner. Current tests
cover catalog field filtering, literal searches, disabled-item recovery, ownership
markers, reversible controls, malformed config, duplicate keys, protected IDs,
stale and replayed previews, external file edits, symlinks, concurrent locks,
pre-write failures, and offline load/unload/re-enable behavior.

## Runtime validation

Live server and terminal validation is pending. Unit tests and typechecking do
not prove that OpenCode loads either plugin part, applies policies, or renders
the sidebar correctly. Record those results here after they run.

## Human review

Human review of the exact implementation commit is pending. No release, package
publication, push, or hosted configuration change is authorized by these checks.
