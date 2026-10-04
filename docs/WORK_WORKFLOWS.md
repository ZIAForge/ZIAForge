# Work tasks

New Work tasks use a versioned workflow separate from Code and legacy Work plans. They run in an ordinary folder, without creating Git branches, commits or merges. The selected CLI, model, permissions and reasoning effort apply to real provider sessions. The model does not own the application state machine.

## Starting and configuring

The Work form offers Auto, Brainstorm, Deep Brainstorm, Research and Write. Save draft stores a task without inference. Start sends the request once to its first managed phase. The default creates an application-owned task folder; a native folder picker can select an existing working directory. A saved, unstarted draft can change its folder. Missing or changed folder grants stop launch rather than falling back to HOME.

The form supports one to four copies with independent executor settings and stable creation IDs. Each accepted copy is retained if another copy fails; retry resolves its receipt before attempting creation again. Copies using an overlapping folder cannot write concurrently. File inputs are selected through a native picker, retained as immutable copies and referenced through `@` in the description. The backend validates their identity and hash before a run.

All saved presets, including the executor's own preset, and Custom are available for reviewers. Custom includes CLI/API, current model catalog, reasoning and access. Independent helpers and Deep workers have their own selected configurations. Resolved settings are frozen at task creation or explicit draft save, so editing a global preset cannot silently change a later phase. The original role labels remain visible. After the first invocation only automatic/manual advancement may change; use a new task for different model settings.

## Modes and decisions

| Mode | Progression | Persistent outputs and decisions |
| --- | --- | --- |
| Auto | Assess scope; answer simple requests directly; clarify or plan only when needed; execute approved steps | A To-do plan exists only when the model proposes actual steps. Verification commands require plan acceptance. Required checks and selected independent review must pass before completion. |
| Brainstorm | Broad generation before evaluation; user chooses more ideas or evaluation | Substantial results use `ideas.md`. The direction decision is explicit. Evaluation, review and follow-ups retain prior results. |
| Deep Brainstorm | Independent workers on one common question; per-worker clarification; reports; coordinator synthesis | Default three workers, individually configurable, with a bounded maximum of eight explicit UI entries. Duplicate questions retain their asking-worker origins. One format repair per worker report; partial failure is disclosed. The canonical `brainstorm_report.md` always requires user review. Small follow-ups stay with the coordinator; major changes start a new frozen-worker round. |
| Research | Scope/depth clarification where needed; actual source work; findings and limitations | `findings.md` for substantial results, source records and linked citations. Model-reported source access is labelled as such; the application does not certify browsing from a citation alone. |
| Write | Audience/purpose/length; outline for substantial pieces; draft; review; revision | `outline.md` and a descriptive document or `draft.md`. Automatic mode proceeds through outline; manual mode pauses. Revision retains the existing document and adds a new immutable version. |

Questions, plan acceptance, Brainstorm direction and Deep report review remain user decisions even in automatic mode. Independent review is optional and separate from these decisions. Review sessions use the existing read-only role policy and separate context. Manual advancement pauses between eligible phases. Failed verification is retained and requires an explicit corrective decision; it cannot become success merely through Continue.

The panel shows current phases, managed chats, real To-dos when present, pending decisions, saved documents and their versions, sources, selected roles and subsequent requests. Text artifacts have a Markdown preview. Bounded real binary outputs can be retained and opened in a native viewer; retaining a file is not proof that its contents or rendering are correct.

## Runtime contract

- `shared/work-flow.ts` contains typed IPC snapshots, decisions, role configuration and result records. New tasks carry `workFlowVersion: 1`; old Work tasks continue to use their existing executable plans.
- `WorkTaskEngine.ts` owns durable phases, gates, stable command IDs, plan approval, verification and recovery. `WorkTaskHost.ts` binds it to the shared structured session runner and real verification supervisor.
- Providers return one validated `ziaforge-work` fenced JSON object. Its summary is rendered as user-facing Markdown; technical protocol details are folded. Invalid output cannot advance the workflow. An interrupted native turn and an unknown delivery outcome have different recovery paths; an unknown result requires an explicit new-context decision rather than replaying the old request.
- `WorkArtifacts.ts` retains immutable bytes and SHA256/version receipts. Publication refuses unrelated or externally edited target files. File paths cannot leave the task folder or traverse symlinks. Worker intermediate files are archived without publication into a shared writing directory.
- `WorkInputGrants.ts` owns native file/folder grants and immutable task inputs. Renderer-supplied arbitrary paths are not authority. A folder lease excludes overlapping Work runs and interactive writers. This is application coordination, not an OS sandbox; actual provider access follows its selected permissions and capabilities.
- Draft saving and folder reassignment serialize with Start. Root integration resolves real role configurations and materializes input copies inside that transaction. Final launch/send fences recheck folder ownership after asynchronous provider preparation.
- Quit waits for workflow cancellation and owned provider/supervisor cleanup. Saved completed results can be recovered from the structured session journal without duplicate inference; uncertain outcomes remain explicit.

## Workflow instructions and local guide packs

The distributable source contains independently written workflow instructions. A local optional `work-workflow-prompts.json` in application userData can supply version-1 user-owned guide documents for `auto`, `brainstorm`, `deep-brainstorm`, `research`, `write` and `brainstormer`. The validated profile is hashed and frozen into each new task; replacing the file does not change already accepted tasks. Local guide contents, private task data and authentication are not included in public source or application bundles.

Deep Brainstorm uses independently configured workers and a coordinator through the user's selected providers. Its questions, per-worker results, synthesis and required report decision are owned by ZIAForge's durable engine. Each independent task copy retains its own configuration and creation identity. These source contracts remain separate from fixture, live-provider and packaged-application evidence.

## Validation

Implement the complete flow before running its tests. `e2e/work-flows.spec.ts` exercises the real Electron app with deterministic Codex protocol fixtures; it is not live model evidence. `e2e/work-mode.spec.ts` retains the legacy plan/restart path. The shared runner also requires the existing Code regression. Keep fixture, native provider and packaged-app receipts separate, retain screenshots and normal Quit cleanup, and report any unrun provider or platform honestly.
