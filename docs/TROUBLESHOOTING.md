# Troubleshooting

## Skills are missing or use an old version

Check `codex plugin list`, confirm the local marketplace points to the intended checkout, and start a new Codex conversation. Installed plugins run from a cache. Re-run the documented installation for the updated version; inspect the install result rather than assuming edited source files are live. See [installation](../README.md#quick-start).

## Doctor is not ready

| Result | Next step |
| --- | --- |
| `ENOENT` | Make the official CLI available on Codex's PATH or set a trusted absolute executable path |
| `missingFlags` is nonempty | Update the official Claude CLI using its supported installation procedure |
| `authStatus: unauthenticated` | Use `claude auth login` in the intended account/environment |
| `authStatus: unavailable` | Inspect the safe diagnostic check/code; compare the same command and executable in the intended environment |
| `EACCES` or `EPERM` | Investigate executable or credential-store access; do not assume the account is logged out |
| `supportedRuntime: false` | Use Node.js 22+ on macOS or Linux |

On the previously tested macOS setup, authentication worked in a full-permission Codex session and failed in a more restricted session. The underlying credential-access cause was not established. This is evidence about that environment, not a reason to globally weaken permissions. Use a user-authorized environment and diagnose the actual access problem.

## Review refuses to run

Empty diffs, binary/submodule changes, oversized input, and unsafe untracked files are explicit failures. They do not mean a clean review. A `base` review includes committed changes only. Narrow scope explicitly with the user or review unsupported content separately; do not silently drop changes.

## Edit fails or returns no changes

Edit requires a clean repository root with a commit. Submodule dirtiness counts even when Git configuration normally hides it. Inspect the preserved worktree after path, symlink, or patch-verification failure. A completed zero-byte patch means no changes were produced. A verified patch still needs review and relevant behavioral checks before application.

## A job is interrupted or a session lock remains

`interrupted` does not confirm that descendants stopped. Do not signal a stored PID without independently identifying the live process. Inspect the owning job and actual process state before manually removing a stale `sessions/<session-id>` lock. Automatic cleanup refuses interrupted jobs.

For ordinary finished jobs, save any needed patch and use the explicit `cleanup ... --discard true` command. If it reports a live worker immediately after completion, allow the worker to finish writing diagnostics and retry. Active or stale session locks are not removed automatically.

## Reporting a problem

Include versions, OS, mode, expected behavior, and a minimal synthetic reproduction. Redact paths, prompts, account data, and source. Never attach credentials or an entire private state directory. See [security reporting](../SECURITY.md#reporting-a-vulnerability).
