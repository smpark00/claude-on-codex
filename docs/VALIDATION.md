# Validation evidence

## Candidate and environment

Candidate: `0.2.0-alpha.1`. Verification date: 2026-10-16.

| Component | Observed version/environment |
| --- | --- |
| OS | macOS (`darwin`) |
| Supported Node test runtimes | 22.23.3 and 24.22.0 |
| Default local Node | 26.5.0 |
| Git | 2.50.1 (Apple Git-155) |
| Codex CLI | 0.163.0 |
| Claude Code CLI | 2.1.301 |

## Local results

| Check | Evidence |
| --- | --- |
| `npm run check` on Node 22.23.3 | 32 tests passed, 0 failed; manifest/path/version and 17-module syntax checks passed; 19 public documents passed |
| `npm run check` on Node 24.22.0 | The same 32 tests and validation checks passed |
| Both plugin skills | `skill-creator` quick validation passed |
| Staged document hook | All 45 release files staged into a temporary Git index; 19 documents and whitespace checks passed; real index unchanged |
| `npm run test:install` | Isolated Codex installation, cached runtime diagnosis, and enabled discovery of both skills passed |
| `npm run test:artifacts` | Source ZIP installation and extracted standalone runtime passed with mock Claude |
| Secret canary regression | Ignored `.env`, unlisted JSON, and local-note canaries absent from both ZIPs; exact file inventories and SHA-256 checks passed |
| Existing local installation | Updated through the official Codex CLI to the candidate; enabled state and every distributed plugin file matched the source |
| Real CLI doctor after login | Official CLI authentication and the installed plugin both passed: `authStatus: authenticated`, `loggedIn: true`, `ready: true`; no missing capabilities or diagnostic errors |
| Upstream plugin schema | Candidate manifest passed JSON Schema Draft 2020-12 validation against its declared `agent-plugins.org` schema on 2026-10-16 |

The document regression test stages Korean content and then writes an unstaged English replacement; the hook still rejects the staged Korean content. It also rejects forced staging of local notes. Non-English strings remain only as necessary source test data.

## Reproduced defect coverage

- Git color, prefix, relative-path, and output-indicator settings cannot corrupt the delivered patch; real indexes remain unchanged.
- Patch verification uses the recorded base even if the original checkout has advanced.
- Dirty tracked/untracked submodule content and staged/committed gitlink changes are rejected despite ignore settings.
- Dangling edited symlinks are rejected; ordinary deletions still produce applicable patches.
- CLI authentication failures and invalid responses are distinct from a valid logged-out response, with raw auth output omitted.
- Cleanup refuses active/interrupted jobs and resumed-session locks; successful edit cleanup removes only its registered worktree and private job records.

## Live-provider results

After CLI login, all three candidate smoke tests passed on 2026-10-16 using synthetic temporary repositories. Each requested the `haiku` alias; the CLI reported `claude-haiku-5-5`. These calls used the existing Claude CLI account and consumed provider usage. The plugin did not change account configuration or Codex permission policy.

| Command | Observed result |
| --- | --- |
| `npm run test:live -- advise` | Completed with the exact expected response |
| `npm run test:live -- review` | Identified the deliberately introduced arithmetic bug at the expected file and line |
| `npm run test:live -- edit` | Returned a verified patch affecting only the allowed file; original checkout unchanged; applying the patch in a separate fixture passed five arithmetic checks |

The edit behavior checks ran in the test harness after patch creation. Claude itself had no shell or test tool. These small smoke tests do not establish reliability across arbitrary repositories, models, or providers.

The earlier 0.1.0 prototype completed real advise, review, and edit smoke requests and a Codex skill-to-Claude round trip. That historical result is not a live-provider certification of this candidate. Its private account/job records are intentionally absent from this public document.

## Remote CI

The [Checks run for commit `b55ee43`](https://github.com/smpark00/claude-on-codex/actions/runs/38902415226) passed in all four environments on 2026-10-16:

| Runner | Node.js | Regression tests | Codex installation | Distribution artifacts |
| --- | --- | --- | --- | --- |
| Ubuntu | 22 | 32 passed | Passed | Passed |
| Ubuntu | 24 | 32 passed | Passed | Passed |
| macOS | 22 | 32 passed | Passed | Passed |
| macOS | 24 | 32 passed | Passed | Passed |

Manifest, syntax, public-document, and staged-document checks passed in every job. The first run exposed a test-fixture difference: Git on the runners skipped staging a submodule configured with `ignore=all`. The fixture now explicitly forces that staging operation and asserts that the index contains the intended change. No runtime restriction or test assertion was removed.

CI uses the mock Claude executable and makes no model requests. Live-provider results above are separate from CI evidence.

## Source publication review

Before opening source access, all three existing commits (48 unique file blobs) and their three Actions logs were checked for common credential patterns, the local user's home path, and their personal email. No matches were found. Public Markdown contained no Hangul, and ignored local notes, environment files, and generated archives were absent from committed history. Commit authorship used a GitHub noreply address.

This was a targeted content review, not a comprehensive security audit or a guarantee that no secret can exist. The explicit distribution inventory, exclusion regressions, and English documentation checks remain enforced.

## Remaining verification

- Manual Codex app UI onboarding, invocation, cancellation, and error-message flows for this candidate.
- Real-provider resume/cancellation, enterprise authentication backends, large repositories, and organization-specific policies.

Windows is unsupported. This record supports public source access as an independent community alpha. It does not establish a stable release, directory approval, or vendor endorsement.
