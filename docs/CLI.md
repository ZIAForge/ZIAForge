# Local command dispatcher

The `ziaf` command controls the running application's saved tasks and WorkflowEngine. It does not run a second planner, accept arbitrary executable/cwd arguments or infer completion from model prose. The app and CLI use the same plan revision, command identities, checkpoints, repair limits and durable receipts.

From a source checkout:

```sh
npm run ziaf -- list
npm run ziaf -- status --task TASK_ID --json
npm run ziaf -- start --task TASK_ID
npm run ziaf -- --task TASK_ID --until-success
npm run ziaf -- pause --task TASK_ID
npm run ziaf -- quit
```

Save a plan in the UI first. `start` starts that saved revision and reports its state. `--until-success` deliberately changes advancement to Auto and observes updates until the engine leaves `running`; it does not remove step checkpoints, bypass review, reset counters or loop without bounds. Use `pause` to cancel the current owned attempt. Ctrl+C exits the observing CLI only; it does not silently stop the application's workflow.

Exit codes for `--until-success` are 0 for completed, 3 for an explicit pause/checkpoint, and 2 for another non-completed terminal state. Invalid requests, connection failures or command errors use 1. `--json` prints newline-delimited state updates. A normal `start` returning 0 means the command was accepted, not that the task has finished.

On macOS, `--launch` starts the installed `ZIAForge.app` without opening a window when no application is reachable. It uses the normal app profile, the bundled launcher path or `/Applications/ZIAForge.app`; it does not install anything. The packaged helper is `ZIAForge.app/Contents/Resources/ziaf.cjs` and requires a local Node runtime. `--profile /absolute/userData` connects to an already opened isolated test profile; automatic launch with a custom profile is intentionally refused. `quit` asks the application to perform its normal owned-process shutdown.

The transport is a private local Unix socket with an owner-only endpoint file and a per-run token. The token is not a provider credential and must not be copied into logs or source. The client checks endpoint ownership/permissions; the server validates commands, sizes and task identities. Endpoint state is removed only if it still belongs to that process. This is local owner access, not a network API, multi-user service or OS sandbox against the same user.

CLI startup/status tests, fixture workflows and actual packaged headless launch are separate gates. Do not report headless packaged success from a parser test. See [testing](TESTING.md), [plans](WORKFLOWS.md) and [Mac packaging](MACOS_BUILD.md).
