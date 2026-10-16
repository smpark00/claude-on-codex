# Contributing

## Local development

Use Node.js 22+ and Git on macOS or Linux. `zip` and `unzip` are needed for distribution checks. The project has no runtime npm dependencies. Enable the repository's document gate once:

```sh
npm run setup:hooks
npm run check
```

Use `npm run test:install` and `npm run test:artifacts` when changing plugin layout or distribution. These need the Codex CLI but do not make model calls. Live provider tests are opt-in and consume account usage; see [testing](docs/TESTING.md).

## Documentation policy

Commit structured English documentation only. Keep Korean or personal working notes under the ignored `.local-notes/` directory, never in public documents or release archives. Markdown must have a top-level heading. Do not include machine-specific home paths, account identities, real job IDs, credentials, or private diagnostics in examples.

`check:docs` checks public working files; `check:staged` reads actual index contents. The pre-commit hook runs the latter, so replacing a staged Korean document with an unstaged English copy does not bypass the gate. CI runs the public document check. This automated check detects Hangul and basic structure; it does not prove that prose is correct English. Other languages without Hangul still require human review.

Non-English text in test fixtures is allowed when it is necessary to verify behavior. Do not move documentation into source files to evade the policy. Git hooks can be bypassed; reviewers and required CI checks remain part of enforcement.

## Changes and pull requests

Explain the concrete problem, resulting behavior, and validation. Add regression coverage for reproducible defects or risky lifecycle changes; avoid tests that merely mirror implementation. Maintain the explicit release inventory when adding or removing public files. Keep package/plugin versions consistent and record user-visible changes in the changelog.

Do not add shell execution, broaden authentication environment forwarding, or claim stronger isolation without a specific design and tests. Existing users' account configuration must remain under their control. Never commit credentials or provider diagnostics. Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).
