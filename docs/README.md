# Documentation index

Start with the [English user guide](USER_GUIDE.md), generated from [the canonical help source](help/en.json). It includes the complete product tour, task-oriented instructions, recovery, permissions, limitations and links to technical contracts. In-app Help and the [offline website guide](../website/guide.html) use the same source. [Help translation coverage](help/LOCALES.md) is separate from interface localization.

Current patch: [1.0.10 release notes](releases/1.0.10.md), with verification status and distribution limits.

## Contribute or work as an AI agent

- [Agent contract](../AGENTS.md) and [contributor setup](../CONTRIBUTING.md)
- [Current project map](PROJECT_MAP.md): source boundaries, implemented behavior and protected invariants
- [Help maintenance](HELP_MAINTENANCE.md): update the guide with code, generate/check outputs and review language contributions
- [Localization](LOCALIZATION.md): interface keys, placeholders, locale style and review
- [Provider extension](PROVIDER_EXTENSION.md): add capabilities without changing a transport or access boundary silently

## Current feature contracts

| Topic | Instructions |
| --- | --- |
| Code, Forge discussion, To-dos and review | [WORKFLOWS.md](WORKFLOWS.md) |
| Work: Auto, Brainstorm, Deep, Research, Write | [WORK_WORKFLOWS.md](WORK_WORKFLOWS.md) |
| Native provider sessions, effort and workspace | [PROVIDER_COMPATIBILITY.md](PROVIDER_COMPATIBILITY.md) |
| Codex conversation startup, model changes and resume | [CODEX_CHAT.md](CODEX_CHAT.md) |
| Explicit API endpoints and secrets | [API_CONNECTIONS.md](API_CONNECTIONS.md) |
| Grok Connector v1, native questions, permissions, images and video | [GROK_CONNECTOR.md](GROK_CONNECTOR.md) |
| Claude Connector v1, caller/native tools, attachments, file versions and owned continuation | [CLAUDE_CONNECTOR_V1.md](CLAUDE_CONNECTOR_V1.md) |
| Code reference profile import | [CODE_WORKFLOW_PROMPTS.md](CODE_WORKFLOW_PROMPTS.md) |
| Saved chat input and unknown delivery | [MESSAGE_QUEUE.md](MESSAGE_QUEUE.md) |
| Corruption and chosen backups | [DATA_RECOVERY.md](DATA_RECOVERY.md) |
| Local workflow dispatcher | [CLI.md](CLI.md) |
| Browser, multi-instance, architect, Telegram, MCP, OpenClaw and Hermes | [AGENT_CONTROL.md](AGENT_CONTROL.md) |
| Reproducible checks and current UI identity | [TESTING.md](TESTING.md) |
| Immutable macOS package and smoke | [MACOS_BUILD.md](MACOS_BUILD.md) |
| Mac/Windows/Linux x64/arm64 packages, clean source archives and native CI | [PLATFORM_BUILDS.md](PLATFORM_BUILDS.md) |
| Build entry points and platform-specific packaging | [BUILD.md](BUILD.md) |
| Debian package and two Ubuntu desktop instances | [LINUX.md](LINUX.md) |
| GitHub checks, verified downloads and application updates | [UPDATES.md](UPDATES.md) |
| Stable/preview release requirements and provenance | [RELEASE_READINESS.md](RELEASE_READINESS.md), [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md) |

The editor, review-team configuration and specialization catalog also have source contracts in [shared/editor.ts](../shared/editor.ts), [shared/review-team.ts](../shared/review-team.ts) and [shared/specializations.ts](../shared/specializations.ts). General help explains their user-facing behavior; the typed definitions govern arguments.

## Website and documentation

The official project landing is [ziaforge.studio](https://ziaforge.studio); source code, issues and release downloads remain on [GitHub](https://github.com/ZIAForge/ZIAForge). The separate [public documentation site](https://ziaforge.github.io/ZIAForge/) provides the generated product guide in all 56 languages. [Website delivery](WEBSITE.md) explains presentation, source boundaries and the independent publication scopes. See [local reading and portable documentation build](../website/README.md) for commands.

## Historical material

| Historical file | Purpose and interpretation |
| --- | --- |
| [CONCEPT.md](CONCEPT.md) | Original product principles; use current contracts for implemented mechanics |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Design history and earlier architecture; confirm current paths in PROJECT_MAP |
| [OPERATIONAL_LOOP.md](OPERATIONAL_LOOP.md) | Original execution-loop proposal, not an automatic grant to publish Git |
| [ROADMAP.md](ROADMAP.md) | Planned milestones, not completed release certification |
| [STOP_BUTTON_AUDIT.md](STOP_BUTTON_AUDIT.md) | Earlier Stop investigation; check current matching-turn and process-cleanup behavior |
| [plans/EXPANSION_2026-10-03.md](plans/EXPANSION_2026-10-03.md) | Expansion implementation plan; individual features need their current contracts and evidence |

`docs/licenses/` holds supplemental runtime license notices and packaging metadata, governed by [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md). `docs/help/en.json` is canonical product help; `help/locales.json` and `help/translations/README.md` govern translation coverage and contributions. Generated `USER_GUIDE.md` and `help/LOCALES.md` are outputs, governed by [HELP_MAINTENANCE.md](HELP_MAINTENANCE.md). This index and PROJECT_MAP are contributor navigation. Historical material is not current feature or release certification; read its status and confirm current state before adopting an instruction. Private research bodies and account credentials are not public project documentation.
