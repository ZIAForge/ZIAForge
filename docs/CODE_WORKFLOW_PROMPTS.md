# Code workflow instructions and local guide packs

New Code tasks use detailed phase-specific native instructions in `CodeFlowPrompts.ts`: source investigation, product requirements, technical contracts, concrete planning, implementation and evidence-based delivery. Work and saved legacy workflows retain their behavior.

Import user-owned local guide documents without redistributing them in the repository or app bundle:

```sh
node scripts/import-workflow-prompts.cjs /absolute/local-guides /absolute/app-userData/code-workflow-prompts.json
```

The source directory contains `templates/{auto,fix-a-bug,spec-first,requirements-first,multi-model}.md` and `installed-skills/{planner,codebase-explorer,plan-designer,plan-orchestrator,implementer,review-worker,review-orchestrator,fixer}.md`. Only these thirteen user-owned text documents are imported, never account config, env, headers or credentials. An existing destination receives a content-addressed backup. Malformed, oversized or hash-mismatched profiles fail task creation explicitly.

Each new Code plan freezes exact guide text plus SHA256. Changing the import file affects subsequent tasks only. Task history, role settings and permissions are not migrated. The template and relevant worker guide are included verbatim; unrelated worker guides and proprietary host system/developer policies are not replayed. Native bindings supersede incompatible tool names/output forms. Without a pack, the complete source-owned instructions remain usable.

| Guide operation | Native binding |
| --- | --- |
| Get/create/update plan or checkboxes | Validated phase result and durable checklist |
| Ask the user | Multi-turn Forge discussion, complete question/options context, persisted answers and exactly-once decision identity |
| Discuss a product or technical choice | Preparation continues without implied document acceptance or implementation permission |
| Revise requirements/specification | Versioned document edit, dependent approval invalidation and retained historical evidence |
| Write artifact then Done | Full structured content; host atomic write, receipt, version and SHA |
| Spawn worker / cloud model defaults | Separate native sessions with selected presets/Custom settings |
| Review source | Complete shared patch, isolated workers, source-verifying coordinator |
| Plan proceed/comments/cancel | Gate A; proposed checks require explicit acceptance |
| Review acceptance/correction | Gate B; acknowledge suggestions without unwanted fix |
| Another review/fix | Explicit cycle, fresh authorized fixer and numbered reports |

Preparation is read-only and cannot grant new commands or mark implementation complete. Auto scope assessment precedes an implementation action; a proposed verification command still needs the app's grant even if the guide says implement directly. This is an explicit native execution boundary. Custom advancement, review, access, reasoning effort and Git policies remain authoritative.

Interactive preparation distinguishes important unresolved choices, explicit user decisions, delegated recommendations and minor stated assumptions. It never interprets an unanswered question as delegation. Questions and technical tradeoffs can span several turns. The host separately accepts Requirements/Specification and the concrete execution proposal. Free-form discussion preserves the complete retained decision context; bounded storage fails explicitly instead of dropping earlier decisions. A native implementation turn may return a `ziaforge-implementation` question result, which pauses before verification and completion.

These human document checkpoints and revision receipts are ZIAForge's execution contract. A user-owned guide can direct phase content, but it cannot bypass the application's decisions, alter selected model settings or certify execution.

New Multi-model plans: scoped exploration → alternative designs → synthesis → Gate A → one implementation pass with real checks → review decision → common-diff workers/coordinator → Gate B. Default workers may use separate contexts of the same selected model; they are not labelled different models. Roles allows distinct CLI/model configurations. Invalid completed worker output allows one format repair; uncertain interrupted delivery pauses instead of a new automatic send. Follow-up review reuses verification only when source and implementation definition still match.

Local guide contents and native authentication remain outside public source and application bundles. Deterministic fixtures and live provider execution are separate evidence categories.
