# Security and data handling

## Intended use

This is an independent alpha for trusted local repositories under the user's OS account. It is not a security sandbox or a multi-user authorization service. Node and Git run with the host session's permissions. Worktrees and post-edit allowed-path checks protect the normal editing workflow; they do not isolate a malicious same-account process or all Git configuration behavior.

## Data flow and retention

Requests, selected repository text, and file-tool reads are processed by the official Claude Code CLI and its configured provider. Existing API endpoint or authentication overrides can change that destination. The plugin has no separate hosted service or telemetry and does not implement credential extraction.

Job records live under `~/.codex/claude-on-codex/<workspace-hash>/<job-id>/` by default. State directories use mode 0700; state, requests, diagnostics, and patches use 0600. The enclosing private job directory also protects its worktree. Prompts, source code, and model output can appear in these files. Same-account access is not prevented.

Retention is indefinite until explicit cleanup. `cleanup --workspace ABSOLUTE_PATH --job UUID --discard true` deletes eligible finished jobs and their edit worktrees. Save needed patches first. It does not delete Claude's separately retained session history. Interrupted jobs require manual inspection; stale PIDs are never automatically signalled.

## Controls and limits

The runtime constrains tools, disables custom hooks/plugins through supported CLI modes, supplies empty strict MCP configuration, limits input/output/time/turns, and validates edit scope and patch applicability. Git hooks, external diff/textconv, and filesystem monitors are disabled for plugin Git operations. Environment forwarding uses an allowlist.

Model output and repository text remain untrusted. Review findings are not proof of correctness. Patch applicability is not a behavior test. No automatic patch application or shell/test tool is provided to Claude.

## Reporting a vulnerability

Before the first public release, the repository owner must enable GitHub private vulnerability reporting and publish the actual reporting link. This local alpha has no public reporting endpoint yet. Once enabled, use the repository's **Security → Report a vulnerability** flow rather than a public issue for sensitive details.

Provide a minimal synthetic reproduction, affected version, expected impact, and safe logs. Never include credentials, real account identifiers, private source, or complete job-state directories. No response-time or security-update SLA is currently offered. See the [release prerequisites](docs/RELEASE.md).
