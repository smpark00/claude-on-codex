# Repository guidance

## Scope

Maintain an independent Codex-to-Claude-Code community plugin. Preserve user authorization, account configuration, and explicit task scope. Do not describe this project as vendor-official.

## Public files

Write structured public documentation in English. Keep Korean and personal notes only in the ignored `.local-notes/` directory. Do not stage those notes or include them in release archives. Do not put private paths, real job IDs, credentials, or account details in public examples.

## Verification

Run `npm run check` after runtime or distribution changes. Run `npm run test:install` and `npm run test:artifacts` for installation/layout changes when Codex is available. Live-provider tests consume usage and are separate from offline checks. Record only verification that actually ran.

Update `release-files.json` when adding or removing public files. Keep package and plugin versions synchronized. Preserve fail-closed review coverage, isolated edit worktrees, explicit session identity, and truthful process-termination reporting.
