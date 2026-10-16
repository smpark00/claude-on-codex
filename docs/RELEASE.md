# Release process

## Current status

The first public prerelease is [v0.2.0-alpha.1](https://github.com/smpark00/claude-on-codex/releases/tag/v0.2.0-alpha.1), an independent community alpha. Build scripts only create local archives; publishing a GitHub release and submitting the plugin to a directory are separate operations.

This prerelease records an explicit verification limitation: native Codex app UI checks could not be performed because the computer-control tool denied access to the app. CLI installation, app-server skill discovery, offline lifecycle checks, and live Claude advice/review/edit requests are the available evidence. This limitation is stated in the README, validation record, and release notes; app UI behavior is not marked as passed.

## Public source access

The repository owner and maintainer is [@smpark00](https://github.com/smpark00). Support and private reporting links are documented in the README and [security policy](../SECURITY.md). Keep private vulnerability reporting enabled while the repository is public.

Before opening access, review committed history and Actions logs for private content, verify the English documentation and MIT attribution, and check the full CI matrix. Record live-provider evidence and known verification gaps in [VALIDATION.md](VALIDATION.md). Public source availability does not imply stable-version support.

## Before a tagged release

1. Review the staged index, English documentation, license/attribution, and `release-files.json`. Keep local notes, credentials, and diagnostics out of Git.
2. Verify the support/reporting links and accurate independent-project attribution.
3. Run the full CI matrix on the actual candidate. Complete manual Codex app onboarding, invocation, cancellation, and error-message checks.
4. Run explicitly authorized live smoke checks for that candidate. Record actual versions and distinguish mock evidence from live evidence.
5. Review the finished archives, checksums, changelog, and known limitations before tagging or uploading.

## Build and verify

```sh
npm run check
npm run check:staged
npm run test:install
npm run test:artifacts
npm run pack:plugin
```

`release-files.json` is the explicit source distribution inventory. Packaging rejects symlinks and unsafe entries, copies only these files, normalizes file metadata, and produces:

- `dist/claude-on-codex-VERSION.zip`: source, marketplace, tests, and English documentation.
- `dist/claude-on-codex-plugin-VERSION.zip`: standalone portable plugin.
- A SHA-256 sidecar for each archive.

Unlisted files are excluded even when they are inside an otherwise distributable directory. Adding a new public source file requires updating the inventory. The inventory is not a general secret scanner: review the content of listed files too. ZIP implementation differences may affect byte-for-byte reproducibility across platforms.

Extract the source archive and install from its root using the README commands. Do not edit installed cache files as a release/update mechanism. Keep the package and portable manifest versions synchronized.

## Release scope and future work

Alpha support covers local macOS/Linux execution, complete text-diff reviews, advice, and isolated file edits. Windows, arbitrary command execution, OS-level sandboxing, edit resume, automatic patch application, and enterprise authentication backends remain outside the supported scope.

Directory publication and becoming a vendor-owned official product are separate processes. Recheck current submission requirements if directory publication is pursued; do not imply approval from manifest compatibility alone.
