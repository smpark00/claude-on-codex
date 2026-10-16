# Design references

## Direction and provenance

OpenAI's [Codex plugin for Claude Code](https://github.com/openai/codex-plugin-cc) delegates in the direction Claude Code → Codex. It was examined as an architectural reference at version 1.0.6, commit `db52e28f4d9ded852ab3942cea316258ae4ef346`.

This independent implementation delegates in the reverse direction, Codex → Claude Code, using the official Claude CLI for authentication and model execution. No upstream source, prompts, or assets are copied. See [NOTICE.md](../NOTICE.md) for attribution.

## Primary references

- [OpenAI plugin authoring](https://developers.openai.com/plugins/build/plugins): portable manifest, skills, local execution requirements, and installed plugin structure.
- [Agent Plugins manifest schema 1.0.0](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json): manifest schema reference.
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference): official CLI interface; local feature detection remains authoritative for this implementation.
- [Claude Code setup](https://code.claude.com/docs/en/setup): installation and authentication.
- [Git diff reference](https://git-scm.com/docs/git-diff): explicit color/prefix, binary patch, and submodule controls.
- [Git apply reference](https://git-scm.com/docs/git-apply): patch checking with an isolated index.

## Design decisions

The plugin uses skill instructions plus a dependency-free local runtime rather than exposing an MCP server. Authentication stays inside the official Claude CLI. Requests and jobs have explicit identities instead of using a global last-session pointer. Review sends a bounded complete text snapshot; edit produces an inspectable patch from a separate worktree.

CLI capabilities are detected rather than inferred from a fabricated minimum version. Official formats and successful local installation do not imply directory approval, vendor endorsement, or stable-version support. Sources and CLI behavior should be rechecked before a public release.
