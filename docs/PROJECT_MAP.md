# Current project map for contributors and AI agents

ZIAForge is a local Electron application for deliberate, specification-led Code and Work tasks: **FORGE. DON'T VIBE.** A short human idea begins discussion; important product and technical choices, accepted artifacts, executable plans and review remain visible decisions. Models propose content and perform accepted steps. The application owns task identity, authorization, gates, versioned artifacts, verification receipts and process cleanup.

Read [the user guide](USER_GUIDE.md) for the product vocabulary, [../AGENTS.md](../AGENTS.md) and [../CONTRIBUTING.md](../CONTRIBUTING.md) for change policy. This map reflects the current source boundaries, not a statement that every platform, account or external integration has passed release checks.

## Source boundaries

| Boundary | Current source | What it owns |
| --- | --- | --- |
| Desktop trust | `electron/main.ts`, `electron/preload.ts` | Validated handlers, sender checks, native grants, app lifecycle and narrow renderer API |
| Public contracts | `shared/legacy-ipc.ts`, `shared/agent-session.ts`, `shared/workflow.ts`, `shared/code-flow.ts`, `shared/work-flow.ts`, `shared/control.ts`, `shared/editor.ts` | Typed arguments, snapshots, state and event identities shared by UI, CLI and control |
| Renderer | `src/components/`, `src/store.ts`, `src/i18n.ts`, `src/locales/` | User decisions, drafts, navigation, projection, locale text and presentation; never filesystem authority |
| Provider sessions | `electron/agents/`, `electron/runtime/SessionManager.ts`, `ProviderLaunch.ts`, `EventJournal.ts`, `ApprovalRegistry.ts` | Version-gated structured transports, native resume, exactly-once delivery identities, approvals, replay and cleanup |
| Code/Forge | `electron/workflow/WorkflowEngine.ts`, `CodeFlowDialogue.ts`, `CodeFlowProtocol.ts`, `CodeFlowPrompts.ts`, `MultiModelPipeline.ts`, `WorkflowHost.ts` | Code preparation, discussion, foundation revisions, accepted implementation and review cycles |
| Work | `electron/workflow/WorkTaskEngine.ts`, `WorkTaskHost.ts`, `WorkTaskProtocol.ts`, `WorkTaskPrompts.ts`, `WorkArtifacts.ts` | Auto/Brainstorm/Deep/Research/Write phases, questions, input copies, sources and document versions |
| Verification/review | `VerificationRunner.ts`, `WorkflowAgentRunner.ts`, `ReviewAggregation.ts`, `ReviewTeamStore.ts`, `shared/review-team.ts` | Real check receipts, bounded process groups, independent report sources and anonymous report-only architect |
| Permissions/storage | `electron/runtime/ProjectAccess.ts`, `FolderWorkspace.ts`, `WorkInputGrants.ts`, `RecoveryStore.ts`, `RecoveryWriteLock.ts`, `StoredTasks.ts`, `TaskChatHistory.ts`, `QueueStore.ts` | Registered canonical folders, exclusive Work leases, atomic validated records, recovery and task-local history/queues |
| Git/editor | `electron/git/`, `WorkflowGitFinalizer.ts`, `electron/editor/EditorService.ts`, `src/features/workspace/FileEditor.tsx` | Guarded exact-byte Git operations, conflict-safe encoded editing, large-file windows and file-manager reveal |
| App control | `electron/control/ControlPolicy.ts`, `CommandCatalog.ts`, `ControlService.ts`, `RemoteServer.ts`, `ControlStore.ts` | Typed local/remote permissions, exact catalog, authenticated current UI, SSE and multi-instance proxy |
| Architect/integrations | `AssistantEngine.ts`, `runAssistant.ts`, `TelegramBot.ts`, `NativeControlRunner.ts`, `UpdateService.ts` | Bounded assistant actions, private owner bot, local-only native rights, explicit update states |
| External clients | `scripts/ziaf.cjs`, `scripts/ziaforge-mcp.cjs`, `electron/runtime/CliDispatcher.ts` | Local workflow dispatcher and authenticated MCP bridge; no second hidden workflow engine |
| Help | `docs/help/en.json`, `docs/help/locales.json`, `src/components/Help.tsx`, `scripts/help/generate.cjs` | Canonical English guide, source-bound machine/human translation status and generated locale manuals/offline pages |
| Help AI | `electron/control/HelpAssistantEngine.ts`, `src/components/HelpAssistant.tsx`, `shared/help-assistant.ts` | Local knowledge-only connected AI, separate bounded history, source citations and owner-gated native provider access; no application command executor |
| Evidence/distribution | `e2e/`, colocated `__tests__/`, `scripts/qa/`, `scripts/mac/`, `scripts/platform/`, [platform instructions](PLATFORM_BUILDS.md) | Isolated fixtures, source/build identity, lifecycle cleanup, clean source archives and immutable Mac/Windows/Linux artifacts; native target execution is a separate claim |

Paths in engine rows are relative to `electron/workflow/`; integration rows are relative to `electron/control/` unless fully qualified. Confirm actual files before changing code. New provider and protocol capabilities require explicit contracts rather than a silent terminal-parsing fallback.

## Behavior that must survive a change

- **Forge foundations:** answers, counterquestions and model `ready` output are not acceptance. Requirements/specification documents and executable plans bind the exact gate, revision and artifact hashes. New foundations invalidate dependent approvals without rewriting completed history.
- **Directory identity:** launch uses the registered task worktree/branch/Work folder, not arbitrary renderer strings or HOME fallback. Antigravity needs an explicit native workspace in addition to process cwd. Coordination and fingerprints are not an OS sandbox.
- **Sessions and queues:** a transport acknowledgement is not a terminal result. Stop waits for the matching end and owned cleanup. Unknown delivery remains uncertain; resume or app restart cannot silently resend. History/drafts belong to one task and chat.
- **Review:** every required source matters. Preset reuse does not mean shared context. The separate report architect has no repository/tools or reviewer identities and cannot waive blocking reports. Supported tool-free architect providers are distinct from supported coder/reviewer providers.
- **Access:** read scope cannot mutate tasks. Ordinary operate access cannot grant native computer rights, change local root/folder grants or reveal credentials. Native permission is local-owner-only and initially disabled.
- **Evidence:** real command exit/cleanup and structured review certify the checked input. Model prose, a screenshot, a citation or a file merely existing cannot substitute. Fixture, live provider, package and external-service evidence remain separate.
- **Git publication:** commit/merge/push are explicit policies against reviewed bytes. Auto does not grant publishing, unknown Git mutation cannot be repeated as fresh work, and Work has no Git finalization.

## Capabilities and material limits

The editor enables full syntax up to 8 MiB, 256 KiB windows for larger text, optional full plain-text loading through 64 MiB and bounded window/search operations above that. It is not unlimited Sublime Text equivalence. Binary viewing belongs to the file's native application. Unsaved drafts and external modification conflicts require an explicit save/discard/reload decision.

The application architect can display screenshots and use typed application tools; displaying an image is not model vision. Native Codex/Antigravity assistant execution needs local-owner permission. The report-only review architect currently requires a verified Claude/API tool-free path.

`system.commands` includes `documentation.guide`, the canonical English help, with its source path and hash. Both the application architect and external MCP/API agents can read this same reference. It describes capabilities; it does not grant permission, approve a workflow gate or replace the owner's instruction.

The Automations panel currently stores UI definitions/counters rather than proving a recurring scheduler. Actual workflow control exists through the workflow engine, local CLI and authenticated API. Telegram needs an owner-configured token/private numeric ID and independent connectivity validation. OpenClaw/Hermes need installed external clients. GitHub release checks, verified downloads, prepared installation and confirmed restart are distinct states; see [UPDATES.md](UPDATES.md) for platform and local-owner boundaries.

## Where to read next

- [Code workflows and Forge gates](WORKFLOWS.md) · [Work modes](WORK_WORKFLOWS.md) · [Code prompt profiles](CODE_WORKFLOW_PROMPTS.md)
- [Provider compatibility](PROVIDER_COMPATIBILITY.md) · [Provider extension](PROVIDER_EXTENSION.md) · [API connections](API_CONNECTIONS.md)
- [Queues](MESSAGE_QUEUE.md) · [Recovery](DATA_RECOVERY.md) · [App control, Telegram, MCP](AGENT_CONTROL.md) · [Local CLI](CLI.md)
- [Testing and inspection](TESTING.md) · [macOS packaging](MACOS_BUILD.md) · [Release readiness](RELEASE_READINESS.md)
- [Help maintenance](HELP_MAINTENANCE.md) · [Localization](LOCALIZATION.md) · [Documentation index](README.md)

The documentation index classifies every remaining guide by purpose: [build entry points](BUILD.md), [Linux/Ubuntu package verification](LINUX.md), [Codex conversation lifecycle](CODEX_CHAT.md), current legal/provenance records, and historical audits/implementation plans. Generated `USER_GUIDE.md`, `help/LOCALES.md`, the offline website guide and the in-app source hash come from the canonical help package; edit the source and generator rather than those outputs.

`CONCEPT.md`, early `ARCHITECTURE.md` sections, `OPERATIONAL_LOOP.md`, roadmaps and old audits preserve intent or historical evidence. Their claimed paths or planned features are not automatically implemented. Prefer current typed contracts and retained evidence for a specific build. Private task data, local guide packs and native authentication are outside distributable source.
