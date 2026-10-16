# Claude on Codex

Use Claude Code from inside Codex for advice, complete text-diff review, and isolated file edits. This is an independent community alpha, not an official OpenAI or Anthropic product.

## Requirements and setup

Requires a local executor, Node.js 22+, Git, macOS/Linux, and an authenticated official Claude Code CLI with the capabilities checked by `doctor`. Tested CLI versions: Claude Code 2.1.301 and Codex 0.163.0.

Use `$claude-on-codex:setup` for diagnosis and `$claude-on-codex:delegate` for a task. From this plugin directory, `node scripts/companion.mjs help` describes the JSON CLI. Diagnosis makes no model request. `authStatus: unavailable` is a failed check, not proof of logout; investigate the execution environment before changing login or permissions.

## Tasks and results

Requests use JSON stdin or `start --request FILE`. Review includes all nonignored staged/unstaged/untracked text, or committed branch changes when `base` is provided. Unsupported binary/submodule changes fail explicitly. Edits require a clean repository and explicit `allowedPaths`; a detached worktree returns an unapplied patch checked against its recorded base. File tools are available, but shell/test execution is not. A worktree is not an OS security sandbox.

No model is forced. `requestedModel` records an explicit alias/identifier or null; completed `models` lists actual identifiers reported by the CLI, if available. Do not assume a separate interactive Claude session's settings apply to restricted invocations. Authentication and usage remain with the official CLI's configured account/provider. The plugin has no separate remote service or telemetry and does not read credential files.

## Job management and retention

`status`, `result`, `wait`, and `cancel` take `--workspace ABSOLUTE_PATH --job UUID`. `list --workspace ABSOLUTE_PATH` returns metadata, scoped to the current thread when present.

Private records live under `~/.codex/claude-on-codex/<workspace-hash>/<job-id>/`. Requests, diagnostics, and patches may contain source code. They persist until explicitly removed. Save needed patches, then use `cleanup --workspace ABSOLUTE_PATH --job UUID --discard true` to permanently delete a finished job and its edit worktree. Active/interrupted jobs, live processes, or session-lock conflicts are refused. Claude's separate session history remains. Do not dump diagnostics or signal stale stored PIDs.

`CLAUDE_ON_CODEX_HOME` overrides the state root. `CLAUDE_ON_CODEX_CLI` accepts a trusted absolute executable. `CODEX_THREAD_ID` scopes jobs to a Codex conversation when present; it is not an OS-level authorization boundary.

## Provenance

Design reference: [OpenAI's Codex plugin for Claude Code](https://github.com/openai/codex-plugin-cc). This runtime is independently implemented. See LICENSE and NOTICE.md. The source distribution includes architecture, security, testing, contribution, and release guides.
