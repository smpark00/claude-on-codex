# Open-source readiness plan

Status: implemented and locally verified. Target: `0.2.0-alpha.1`, an independent community alpha.

## Release goals

1. Fix the five reproduced correctness and distribution defects before release.
2. Make authentication, model selection, and job lifecycle observable.
3. Publish structured English documentation without personal local records.
4. Verify portable installation and artifacts as well as runtime behavior.

## Implementation checklist

- [x] Pin Git diff formatting and validate each edit patch against its base commit.
- [x] Detect submodule changes despite user Git ignore settings; reject incomplete reviews.
- [x] Package an explicit file inventory and reject symlinks in distribution inputs.
- [x] Reject dangling edited symlinks while preserving valid deletions.
- [x] Distinguish unauthenticated from unavailable authentication diagnostics.
- [x] Expose requested and reported model identifiers, and list retained jobs.
- [x] Add deliberate, guarded cleanup for finished jobs.
- [x] Replace public Korean documents with English guides; retain originals only in ignored local notes.
- [x] Check document language in the staged index, development checks, and CI.
- [x] Add contribution, security, release, and validation documentation.
- [x] Run regression, artifact, and isolated Codex installation checks.

## Acceptance criteria

- Reproductions fail on the old implementation and pass after the fix.
- Colored or prefix-altering Git configuration cannot corrupt a delivered patch.
- No submodule change is silently labeled as fully reviewed.
- Ignored secret canaries and local notes appear in neither release ZIP.
- Authentication command failures do not prompt an unnecessary login.
- Public Markdown contains no Korean text or machine-specific user paths.
- CI covers Node.js 22 and 24 on macOS and Linux, without credentials or model calls.
- Validation records distinguish local evidence from pending remote CI and live-provider checks.

## Publication boundary

This work prepares a local alpha. It does not create a GitHub repository, publish a release, claim vendor endorsement, or establish stable-version support. Before public release, configure repository ownership and private vulnerability reporting, run remote CI, and review the final staged files and archives.

## Remaining release gates

Remote Linux/macOS CI, manual Codex app UI checks, a live-provider rerun for this candidate, repository ownership, and private vulnerability reporting are still required before public release. Authentication was rechecked successfully after the user logged in; candidate live-provider smoke tests remain pending. The plugin did not change account configuration. See [validation evidence](VALIDATION.md).
