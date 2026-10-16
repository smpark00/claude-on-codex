# Authentication and model selection

## Which account is used?

The installed official Claude Code CLI handles authentication. The plugin does not create a new account, implement OAuth, read credential files, or export subscription tokens. An existing CLI login or supported environment-based authentication determines the provider and usage account.

Run `doctor` from the same execution environment as Codex. It reports authentication method and readiness while excluding email addresses, account IDs, and credentials. To inspect account identity yourself, use the official CLI's `claude auth status` directly and avoid sharing its output publicly.

`unauthenticated` means the CLI explicitly reported logged-out status; use its `claude auth login` flow. `unavailable` means the check failed or returned an invalid response; investigate the execution environment before changing login. The plugin does not automatically modify Codex permissions or account configuration.

## Which model is used?

The plugin adds `--model` only when a request includes `model`. Otherwise the CLI chooses its default under the invocation's restrictions and applicable managed policy. Do not assume this equals a model selected in a separate interactive Claude session: `--restricted` changes which user/project/local settings are loaded, and `ANTHROPIC_MODEL` is not forwarded.

Completed jobs expose:

| Field | Meaning |
| --- | --- |
| `requestedModel` | Explicit request identifier/alias, or null |
| `models` | Model identifiers reported in the CLI result's `modelUsage`; possibly several or empty |
| `costUsd` | CLI-reported estimate; not a promise of subscription billing |
| `numTurns` | Turn count reported by the CLI |

An omitted model is not a guarantee of a fixed model, price, or behavior. Explicit model support is ultimately determined by the official CLI and provider.

## Forwarded environment

The allowlist retains standard process paths/locale, `CLAUDE_CONFIG_DIR`, `XDG_CONFIG_HOME`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_OAUTH_TOKEN`, and common HTTP/HTTPS proxy variables. Existing API or endpoint overrides can change the account/provider; the plugin does not choose between those credentials itself.

Bedrock, Vertex, custom credential helpers, enterprise policies, and every proxy combination have not been validated. The current environment allowlist is not a promise of compatibility with all Claude authentication backends. Check the official [Claude setup documentation](https://code.claude.com/docs/en/setup) for your environment.

## Invocation restrictions

Calls use safe/restricted mode, an explicit tool list, disabled custom slash commands and Chrome integration, empty strict MCP configuration, and `dontAsk` permissions with no prompts. No Bash tool is provided. These settings reduce capabilities; they are not OS isolation. Managed policies remain applicable.
