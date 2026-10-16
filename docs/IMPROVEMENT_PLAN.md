# Open-source readiness plan

Status: hardening implemented; local, remote CI, and live-provider checks passed. Target: `0.2.0-alpha.1`, an independent community alpha.

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
- Validation records distinguish local, remote CI, and live-provider evidence from unverified behavior.

## Publication boundary

The source is hosted at [smpark00/claude-on-codex](https://github.com/smpark00/claude-on-codex), maintained by [@smpark00](https://github.com/smpark00). The README and security policy provide support and private vulnerability reporting links. Public source access is appropriate for this documented alpha; it does not establish a tagged release, vendor endorsement, or stable-version support.

## Remaining verification

The Ubuntu/macOS CI matrix passed on Node.js 22 and 24. Authenticated live advice, review, and edit smoke tests and upstream manifest schema validation also passed. Manual Codex app UI checks, real-provider resume/cancellation, and broader environment testing remain outstanding. Complete the [tagged-release prerequisites](RELEASE.md) before distributing a release. See [validation evidence](VALIDATION.md) for the exact scope of completed checks.
