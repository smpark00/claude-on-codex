# Release process

## Current status

The local target is `0.2.0-alpha.1`. No public repository, release, directory submission, or vendor endorsement is created by the build scripts. The project is an independent community implementation.

## Before the first public release

1. Choose the repository owner and maintainer identity. Configure Git authorship without committing personal local records.
2. Enable GitHub private vulnerability reporting and set the real support/reporting links. Verify publisher attribution in the manifest.
3. Review the staged index, English documentation, license/attribution, and `release-files.json`. Keep local notes, credentials, and diagnostics out of Git.
4. Run the full CI matrix on the actual repository. Complete manual Codex app onboarding, invocation, cancellation, and error-message checks.
5. Run explicitly authorized live smoke checks for the release candidate. Record the actual versions and distinguish mock evidence from live evidence.
6. Review the finished archives, checksums, changelog, and known limitations before tagging or uploading.

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
