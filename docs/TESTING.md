# Testing

## Offline checks

```sh
npm run check
```

This runs real Git/process integration tests with a mock Claude executable, validates manifest paths and JavaScript syntax, and checks public documentation. It requires Node.js 22+, Git, `zip`, and `unzip`; no model calls or runtime dependencies are needed.

Coverage includes review scope, binary/submodule rejection, patch applicability under user Git settings, symlinks, isolated edits, authentication failure classification, process termination, concurrent sessions, environment filtering, UTF-8 boundaries, model reporting, retention, exact archive inventories, and the staged-document gate.

The tests intentionally include non-English strings as data to exercise UTF-8 and language-policy behavior. They are source fixtures, not public documents.

## Codex installation and artifacts

```sh
npm run test:install
npm run test:artifacts
```

These require the real Codex CLI but use a mock Claude executable. `test:install` creates a temporary `CODEX_HOME`, installs the marketplace/plugin, runs the cached runtime, and discovers enabled skills through Codex app-server. It does not alter the usual Codex configuration.

`test:artifacts` builds both archives, extracts them, checks the standalone runtime, and runs the source archive's installation smoke. Regression tests also inject synthetic secrets into ignored and unlisted files and assert exact ZIP membership and checksum validity.

CI runs Node.js 22 and 24 on macOS and Linux, with a pinned Codex CLI for installation checks. A workflow definition is not evidence of a successful remote run; see [validation](VALIDATION.md).

## Opt-in live provider checks

```sh
npm run test:live -- advise
npm run test:live -- review
npm run test:live -- edit
```

These commands make real requests and consume account usage. They use temporary synthetic repositories, a 90-second timeout, six turns, and a $0.20 CLI budget flag per request. The default smoke model is the `haiku` alias; `CLAUDE_ON_CODEX_SMOKE_MODEL` overrides it. Normal plugin use does not inherit this smoke default.

Advice checks an exact response. Review checks a deliberately introduced arithmetic defect. Edit applies the patch in a separate synthetic repository and checks five arithmetic cases. Successful temporary files are removed; failure artifacts are retained for local diagnosis. Real-provider cancellation/resume and app UI interaction need separate testing.
