# Changelog

## 0.2.0-alpha.1 — 2026-10-16

First public prerelease. Independent community alpha for macOS and Linux. See [validation evidence](docs/VALIDATION.md) for tested paths and remaining app UI checks.

### Fixed

- Override Git color and path-prefix configuration, and check each edit patch against its recorded base using a temporary index.
- Detect dirty, staged, and committed submodule changes even when Git ignore settings hide them.
- Reject dangling edited symlinks without rejecting ordinary deletions.
- Package an explicit file inventory instead of recursively copying directories that can contain ignored secrets.
- Distinguish an explicitly logged-out CLI from a failed or malformed authentication check without echoing sensitive output.
- Explicitly stage the ignored submodule in regression fixtures so the test covers a real index change across Git versions.

### Added

- Requested and CLI-reported model identifiers in completed jobs.
- Workspace/thread-scoped job listing and explicit, guarded cleanup of finished records and edit worktrees.
- Regression tests for the reviewed defects, artifact checks, and staged documentation enforcement.
- English architecture, authentication, troubleshooting, contribution, security, testing, and release guides.
- CI installation/artifact verification alongside the Node.js 22/24 macOS/Linux matrix.

### Compatibility

- New job metadata is additive; old retained jobs may lack it.
- Doctor reports `loggedIn: null` when authentication cannot be checked. Consumers must inspect `authStatus` rather than equating every failure with logout.
- No automatic migration, patch application, or deletion of retained jobs is performed.

## 0.1.0 — Local prototype

Introduced advice, complete text-diff review, isolated edits, background jobs, cancellation, and explicit advice resume through the official Claude Code CLI.
