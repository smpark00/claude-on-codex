# CLI reference

Run `node plugins/claude-on-codex/scripts/companion.mjs COMMAND` from a source checkout. In installed skills, resolve the entrypoint relative to `SKILL.md`.

## Commands

| Command | Arguments | Behavior |
| --- | --- | --- |
| `doctor` | None | Version, feature, and authentication checks; no inference |
| `start` | JSON stdin or `--request FILE` | Submit a task |
| `status`, `result` | `--workspace ABSOLUTE_PATH --job UUID` | Read job state or completed result |
| `wait` | Same as status | Wait up to 610 seconds; a wait deadline does not cancel the task |
| `cancel` | Same as status | Request process-group termination and report confirmation |
| `list` | `--workspace ABSOLUTE_PATH` | List job metadata for this workspace and, when present, current thread |
| `cleanup` | `--workspace ABSOLUTE_PATH --job UUID --discard true` | Permanently delete a finished job's records, patch, and worktree |
| `help` | None | Machine-readable command summary |

Save any patch you need before cleanup. Cleanup refuses active or interrupted jobs, live recorded processes, and session-lock conflicts. It never signals a stale PID or removes the Claude CLI's own history. Unreadable records are reported by `list.unreadableJobs` for manual investigation.

## Start request

Unknown fields are rejected. Paths must be explicit; text is never interpolated into a shell command.

| Field | Type/default | Constraints |
| --- | --- | --- |
| `workspace` | Absolute directory | Required; canonicalized with realpath |
| `mode` | `advise` | `advise`, `review`, or `edit` |
| `prompt` | String | Required except for review; maximum 128 KiB |
| `background` | `true` | `false` waits for the same detached worker |
| `base` | Git reference | Review only; committed merge-base-to-HEAD diff |
| `adversarial` | Boolean | Requests a critical review perspective |
| `allowedPaths` | Relative file/directory array | Edit only; 1–100 entries; no traversal, glob, Git, or agent-settings paths |
| `resumeJobId` | Job UUID | Completed advice only, same workspace/thread |
| `model` | CLI model identifier | Optional; no default is injected |
| `effort` | String | `low`, `medium`, `high`, `xhigh`, `max`; provider support varies |
| `timeoutMs` | `300000` | Integer 100–600000; termination can take additional time |
| `maxTurns` | `8` | Integer 1–30 |
| `maxBudgetUsd` | Number | Greater than 0 and at most 100; CLI estimate/limit, not a billing guarantee |

Request JSON and the combined prompt each have a 512 KiB limit. An untracked text file has a 128 KiB limit. Combined Claude stdout and stderr have a 4 MiB limit. Inputs are not silently truncated.

## Results and states

Normal progression is `submitted → running → completed | failed`. A stop request introduces `stopping`, followed by `cancelled`, `timed_out`, `interrupted`, or `failed`. A controller that detects a missing worker reports `interrupted` without claiming cancellation.

All jobs include `id`, `workspace`, `mode`, timestamps, session identity, and `requestedModel` (null when omitted). Completed jobs add `models`, `numTurns`, and the CLI-reported `costUsd`. Multiple model identifiers may be present; do not label the requested alias as the actual model. Old retained jobs may lack new fields.

- Advice: `result` is text.
- Review: `result.summary` and `result.findings[]`. Findings contain `severity` (`critical`, `high`, `medium`, `low`), `file`, positive `line`, `title`, and `description`. `review` records scope, files, hash, and `complete` for the supplied snapshot only.
- Edit: text plus `baseHead`, `worktree`, `patchPath`, `changedFiles`, `patchSha256`, `patchBytes`, and `patchVerified`. Verification means the patch applies to the recorded base, not that tests pass. A zero-byte patch is a successful no-op and must be reported as such.

Failed edits preserve their worktree for inspection. No patch is applied to the original workspace.

Successful/background queries write JSON to stdout and exit 0. Invocation errors write JSON to stderr and exit 1. Completed failure, cancellation, timeout, and interrupted results exit 1. An ongoing `result` has `ready:false` and exits 0. An unready `doctor` exits 1.

## Doctor result

`authStatus` is `authenticated`, `unauthenticated`, or `unavailable`. `loggedIn` is respectively true, false, or null. `diagnostics[]` includes a check name, safe error code, exit code, and signal, never raw authentication output. `missingFlags` lists unsupported CLI capabilities. See [troubleshooting](TROUBLESHOOTING.md).

## Local environment

- `CLAUDE_ON_CODEX_HOME`: private state root; default `~/.codex/claude-on-codex`.
- `CLAUDE_ON_CODEX_CLI`: trusted absolute executable override; default `claude` on PATH.
- `CODEX_THREAD_ID`: limits job access and listing when provided by Codex. Without it, direct CLI use is workspace-scoped.
- `CLAUDE_ON_CODEX_DEPTH`: internal recursion guard; do not set it for normal use.

Authentication/provider/proxy variables are selectively forwarded; unrelated environment variables and `ANTHROPIC_MODEL` are not. See [authentication and models](AUTHENTICATION.md).
