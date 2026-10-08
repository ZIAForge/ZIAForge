# Testing and inspection

Run these commands from the repository root. They require Node and the repository's installed dependencies; they do not depend on a parent research directory or Python.

```sh
npm run qa:doctor
npm run qa:check
npm run qa:check -- --e2e
npm run build:e2e
npm run qa:inspect
```

`qa:doctor` prints read-only JSON diagnostics: source identity, OS/architecture, installed package versions, built files and provider availability on PATH. It reports each allowed `node-pty` spawn-helper's presence, mode and executability separately from native ABI compatibility, which remains unverified until an actual Electron PTY spawn. It does not launch the app, repair files, inspect authentication or write a profile. `npm run qa:doctor -- --cli` additionally runs each installed provider's `--version`; only the parsed version and exit status are retained. Neither command proves provider login or successful model execution.

## Clean installation and native PTY

Vitest uses at most four workers because lifecycle suites create real process trees. This keeps startup and cleanup checks reproducible without saturating the host; process-death and receipt assertions still run against actual child processes.

Use `npm ci` with the repository's `scripts/` directory present and lifecycle scripts enabled. The root `postinstall` first runs `node node_modules/electron/install.js`, the vendor's installer for the locked platform runtime. It validates the runtime archive and does not download a matching runtime again. This explicit step is necessary because the installed Electron package exposes `install-electron` separately and has no npm postinstall of its own. It then runs `scripts/fix-node-pty-helper.cjs`: on macOS this restores execute bits only for regular `node_modules/node-pty/build/Release/spawn-helper` and `node_modules/node-pty/prebuilds/darwin-*/spawn-helper` files. Other file permissions are preserved. The repair validates the local npm package name and refuses symlinked package paths or helpers; linked pnpm layouts are not supported by this repair. Other operating systems skip only the PTY permission repair.

The cause was reproduced on a fresh install: `npm ci` succeeded, but `node-pty`'s `darwin-x64/spawn-helper` was `0644` and real Electron PTY spawn failed with `posix_spawnp failed`. Changing only that helper to executable made the same native smoke succeed. Thus package installation success alone does not prove usable PTY execution. The scoped postinstall addresses that permission defect; it does not rebuild native modules or certify their ABI.

`qa:check` tooling also runs bounded helper-repair tests in disposable fixture directories, including idempotence, unrelated-file preservation and symlink refusal. These tests do not change the real installed dependency. A clean-install receipt should separately retain the `npm ci` result, `qa:doctor` helper state and a successful real Electron PTY/E2E run. Do not claim the postinstall or native runtime passed merely because the fixture tests passed.

If a previous installation skipped root lifecycle scripts, the scoped repair can be run explicitly with `node scripts/fix-node-pty-helper.cjs`, followed by `npm run qa:doctor` and real PTY validation. This does not replace other dependency lifecycle scripts that were skipped.

`qa:check` runs tooling syntax, application and E2E TypeScript checks, the **full** repository lint, Vitest and `build:e2e`, sequentially. `--e2e` adds the real Electron fixture suite. E2E is blocked if the build fails. Other failures remain failures even when later checks pass. It does not install dependencies or package/publish an installer.

Each invocation creates a fresh ignored `test-results/qa/<timestamp>-check-<id>/` directory containing:

- `manifest.json`: mode, commit, dirty flag, working-tree content SHA256, package versions, OS and architecture;
- `result.json`: actual per-check status, command, exit code, duration, source identity after the checks and whether it changed;
- separate check logs; for E2E, a Playwright report, traces, screenshots and isolated test profiles.

The check runner gives tests a fresh private directory under the system temporary directory, rather than placing fsynced scratch storage inside a cloud-synchronised checkout. Its exact `temporaryDirectory` is retained in both manifest and result for diagnosis; logs and reports remain in the run directory. This does not change application storage or relax test deadlines.

Unit suites run with one worker under `CI` (including `qa:check`) because they exercise real fsynced stores and child-process lifecycles. Local interactive runs keep four workers. Assertions and per-test deadlines are identical.

The source hash includes tracked files and non-ignored untracked files, including dirty edits; ignored build/test artifacts are excluded. Concurrent source edits or unavailable source hashes make the aggregate result `invalidated` with a nonzero exit status, even if individual checks passed: that run cannot certify one unchanged tree. Existing compiled outputs have their own content hash; a previous build is not assumed to match current sources. Build version is recorded from package metadata; compilation remains a separate result.

Useful focused commands:

```sh
npm run qa:check -- --only=tooling
npm run qa:check -- --only=typescript,typescript-e2e
npm run qa:check -- --only=e2e
npm run qa:check -- --e2e --dry-run
```

`--only=e2e` builds first. `--dry-run` records planned commands with status `planned`, never `passed`. `--only=tooling` checks syntax of the QA/setup scripts and runs the scoped helper-repair fixture tests. Use `--help` on any QA command for supported options.

## UI inspector

`qa:inspect` requires a completed `build:e2e`. It opens the compiled app through the same development-only bootstrap used by tests. It creates new `userData`, workspace, temporary and shell-history directories in `test-results/qa/<timestamp>-inspect-<id>/`; it does not reuse or copy the user's application profile or credentials. `HOME` and `CODEX_HOME` are not changed. The child receives a small explicit environment without inherited provider tokens.

Known provider command names (`agy`, `codex`, `claude`) are stubs that exit without contacting a provider. PTYs use a dedicated shell that resets PATH and starts bash with `--noprofile --norc`; user shell startup files are not sourced. Thus this inspector checks UI state, navigation and error handling, not successful AI answers.

This is application-state isolation, **not an OS or network sandbox**. Arbitrary commands, absolute executable paths and file access are not restricted by these stubs. Use only disposable projects and non-sensitive input. Do not describe inspector results as proof of provider functionality or sandbox security.

The inspector prints a random CDP port bound to `127.0.0.1`, suitable for a local Playwright/CDP client. Do not expose the debugging endpoint externally. It saves a startup screenshot, native window/work-area geometry, Electron output, a manifest and a result. On Ctrl+C it also attempts a final screenshot, accessibility snapshot and trace before invoking normal Electron Quit cleanup. It tracks its Electron descendants by PID and process start time and terminates surviving owned descendants after Quit, without matching process names or touching other app sessions. Explicit application Quit terminates the inspector too; final capture may be unavailable when the app has already closed. On macOS, closing the window alone hides the app, so use **Quit** or Ctrl+C to end the run.

A supervisor receives terminal `SIGINT`, `SIGTERM` and `SIGHUP` and requests shutdown over IPC from a detached Playwright worker. This prevents Playwright's own signal handler from exiting before the receipt is saved. A lost supervisor connection also requests worker cleanup, including when its output pipes are already closed. The supervisor waits for the worker and independently verifies cleanup of its observed descendants. Read both `cleanup` and `supervisor.cleanup` in `result.json`; a successful graceful run finishes with `status: closed`, zero live owned descendants and verified cleanup. If the supervisor itself is killed, the worker records `supervisor.disconnected: true` and its own cleanup result; independent supervisor verification is unavailable. Forced worker/app termination or unavailable process observation is a failure, not successful inspection. An explicit Quit may leave only the startup screenshot because the renderer has already exited.

The inspector and deterministic CLI fixture currently support macOS/Linux with bash. Electron still needs a graphical session. On Linux use an existing desktop or an appropriate virtual display; a failure to open a window is an unverified GUI path, not a passed test.

## Fixture, replay and live evidence

- **Fixture:** real Electron/main/preload/IPC/PTY, deterministic local CLI process. No model calls or subscription authentication.
- **Replay:** the fixture emits a sanitized captured terminal transcript, including sign-in animation and delayed redraws. This does not perform sign-in.
- **Live:** an explicitly selected provider run against an installed CLI and disposable project, within the task's authorized scope. The QA commands here do not run live LLM turns or claim they passed.

The startup regression asserts native initial window bounds against the actual display `workArea`; on macOS it requires the window to fill that area without native fullscreen. It checks resize → activate and close → reopen preserve the renderer/session and restore that geometry. It also observes that Stop never flashes during authentication/idle. After sending `long-generation`, it verifies **exactly one matching message received by the intended CLI PID before checking Stop**. A subsequent request after Stop must reach the same PID exactly once and produce a response. A chat bubble alone cannot prove delivery.

### Codex structured-session fixture

`e2e/codex-session.spec.ts` selects `providerFixture: 'codex'`. Its isolated profile contains a real disposable Git repository and worktree, a saved Codex preset and a `bin/codex` wrapper placed first on the app's explicit PATH. The normal backend executable/version resolver is exercised: there is no renderer-supplied executable or production fixture switch. The fixture reports `codex-cli 0.153.4`; its stdio messages follow that installed version's generated JSON schemas. Other provider names remain blocked, and no credentials are copied or model requests made.

The test drives the actual Composer and approval cards. A separate JSONL transcript records the fixture process, received RPCs, prompts and responses. It requires one `app-server --listen stdio://` process, one initialization/thread, three exactly-once turns, tool output, a decision returning as `accept`, and intact Unicode split across pipe chunks. The interrupted turn receives an immediate RPC acknowledgement but cannot finish until the test releases a local file barrier. Thus a new send must stay disabled until the matching `turn/completed` arrives; the next turn must reuse the same process and thread.

Window hide/reopen and renderer replay are checked separately. Page reload during pending approval must reconstruct the same actionable card and user message without spawning another process. A final reload must restore completed history without duplicate messages or approvals. The negative scenario rejects a renderer cwd override, an unknown preset and a `file:` external URL; it also checks the child frame has no privileged preload bridge and disallowed navigation preserves the document. Direct sender-frame validation has separate backend unit tests.

The creation scenario selects a repository and Codex preset through the actual New task form. It checks that the description remains an unsent Composer draft, then reaches the app-server exactly once after Send. A custom chat is closed and reopened through recent history after Settings and renderer reload. Editing and then deleting the saved preset through configuration IPC must preserve the task's Codex binding: subsequent UI sends use that same custom session, PID and thread. A fixture shell sentinel fails the test if these actions silently start a legacy PTY. Production Quit must terminate every owned app-server before any emergency test cleanup.

To rebuild and run only these cases:

```sh
npm run test:e2e -- e2e/codex-session.spec.ts
```

This is real Electron/backend/IPC integration with a deterministic protocol peer. It does not certify Codex login, model availability, subscription billing or live inference. The existing Antigravity terminal fixture remains a separate regression suite.

### Claude structured-session fixture

`e2e/claude-session.spec.ts` selects `providerFixture: 'claude'`. The actual Electron application resolves the fixture through PATH and its version preflight, then initializes the persistent stream-json control channel. Tests drive native-shaped permissions through approval cards, split UTF-8, tools, multiple turns in one PID, pending approval replay and interruption. The fixture acknowledges interrupt immediately but delays the terminal result behind an explicit barrier: Send must remain disabled until that result arrives. A later turn must reuse the same process and provider session. The transcript and screenshots distinguish UI output from bytes actually received by the protocol peer; no real provider or credentials are used.

### Antigravity native stream fixture

Workspace regressions distinguish the process directory from the native tool workspace. The fixture's `init.cwd` still reports the process directory, while tools use a separate workspace selected by `--add-dir`; omitting that flag selects a disposable decoy directory. The test executes `/bin/pwd` and a relative marker read in that tool workspace and compares the result with the canonical task worktree, both on first send and after full Quit/Resume. A transcript containing the expected spawn `cwd` alone cannot pass this check. Missing or mismatched `init.cwd` must fail before any user record reaches the CLI, with the unsent draft retained. A missing registered project must not launch a provider in HOME.

`e2e/agy-session.spec.ts` selects `agy-headless`, backed by the separate `e2e/fixtures/agy-headless.cjs` executable. It reports the verified local CLI version `1.2.7`, accepts only the expected structured argv and uses `init`, `step_update` and terminal `result` records. Two completed turns, tool output, split UTF-8, renderer replay, native policy rejection with a preserved draft, and explicit whole-session termination are tested through the real UI. A final busy session is left for production Quit to close; every recorded provider PID must disappear before emergency cleanup.

The native Antigravity preflight allows exactly `1.2.2` and `1.2.7`; other patches require a compatibility check. The installed `1.2.7` help preserves structured input/output and conversation-resume flags. Its bundled changelog and the [official release notes](https://antigravity.google/changelog/) currently describe changes through `1.2.6`, including unlimited default print-mode timeout and structured `AGY_ERROR` stderr with exit code `3`. Workflow agent calls have a separate 30-minute host deadline.

Composer Stop sends native SIGINT for the active Antigravity turn. Installed `1.2.7` emits `result.status=ERROR,error="interrupted"`, then exits. The adapter waits for the terminal result, stream closure and owned-process cleanup, then starts `--conversation` with the same native ID. Input stays disabled until the new `init`; the next turn uses a new PID and the same chat/history. A failed resume keeps the draft and exposes the error and Resume action. Deterministic tests cover delayed close, stale callbacks, failure and Quit during that restart; the Electron fixture verifies Stop and the next actual send. A signal acknowledgement alone never completes the turn. Live interruption and native context recall are separate evidence, never implied by fixture success.

Antigravity's headless protocol has no interactive approval/control exchange. The `CLI settings` preset inherits native policy and adds terminal sandboxing; it does not promise read-only access. Existing terminal tests deliberately seed `agentTransport: 'legacy-pty'` to preserve their separate coverage. These deterministic tests do not authenticate or contact an LLM. Protocol reference: [official headless documentation](https://antigravity.google/docs/cli/headless/).

Model selection uses the selected installed client: Codex `model/list` with all pages and `includeHidden`, Claude's stream-json initialization model catalog, and `agy models`. Discovery starts no user turn and owns its short-lived process through application Quit. The UI shows catalog provenance or an unavailable error and always accepts a manual model ID; refresh never changes a deliberate selection. `e2e/model-catalog.spec.ts` verifies each fixture catalog in the preset editor, a direct CLI choice with no saved preset, a hidden model, draft preservation and full application restart. Fixture model IDs are protocol test data, not a live catalog.

`e2e/composer-focus.spec.ts` sends from the keyboard and mouse while the Codex fixture deliberately delays the RPC acknowledgement. It uses `keyboard.type`, which cannot silently refocus a blurred textarea, to enter the next draft. It verifies that Enter cannot duplicate the pending send, the new text survives acknowledgement, and intentional focus on CLI logs is not stolen by an asynchronous completion. After the next successful send, typing without another click must still reach the Composer. This tests real Electron focus behavior; component tests separately cover rejected sends and unmounts.

`e2e/composer-configuration.spec.ts` configures an explicit `none` effort and workspace access in the preset dialog, changes to Custom with another model, `xhigh` and read-only access, saves a new preset from the footer, and performs a full Quit/Resume. It verifies the actual thread and turn RPCs, preserved native identity and unsent draft, and upward popover bounds. A final explicit default reset must query the actual model catalog and send its advertised default; a null snapshot by itself is not sufficient evidence. The native-resume fixtures additionally verify Claude and Antigravity `--effort` arguments before and after application restart. These are local protocol peers, not live model execution.

Per-test `manifest.json`, `result.json` and CLI transcript identify the fixture and source tree. The UI scenario preserves full-page screenshots after pauses; failed tests retain a Playwright trace. Agents should open and inspect screenshots, then compare UI state with the CLI transcript and backend evidence. DOM assertions and visual inspection are distinct checks.

Direct `npx playwright test` uses `test-results/e2e/` and may replace that directory. Prefer `qa:check -- --e2e` for a fresh retained evidence bundle. See [the scenario guide](../e2e/README.md) for existing test cases.

## Restart, selection and executable-plan regressions

`e2e/native-resume.spec.ts` performs a full production Quit and launches a new Electron process with the same isolated profile for each structured provider. It checks native conversation references, new process identity, exact history and deliberate model/preset/provider switches through UI. CLI stdout/stderr are checked separately from the assistant feed. Fixtures persist their own deterministic native context; they do not claim to authenticate a real subscription.

`e2e/executable-plan.spec.ts` creates three steps through the actual Plan panel. A fixture falsely claims success while a real check exits 1; the engine must preserve that failure. A later reviewer rejects the implementation, requiring another attempt. The test then exercises manual checkpoints, Auto with an explicit stop, full application restart and completion without replaying earlier steps. Reviewer processes are distinct from coder processes. Actual verification receipts and screenshots are retained.

Workflow unit tests cover Red proof, durable restart/cancel/limits, stale revisions, storage boundaries and source changes during verification. VerificationRunner tests use real disposable child processes, including output limits, timeout, cancellation and an ordinary orphan that ignores SIGTERM. Model discovery and version preflight are included in production Quit ownership. Test cleanup records any emergency signals separately; production cleanup is certified only when no fallback was required.

## Windows settings persistence regression

The manual **Native Windows settings storage regression** workflow runs `scripts/qa/windows-settings-save.cjs` on native Windows x64 and Windows 11 ARM64 with Node 24.21.0. It requires the Git history containing the pinned 1.0.2 baseline. It reproduces the baseline directory-open/flush failure without changing the original settings, then checks patched saves, repeated reads, dead-owner recovery and another cold process using the same disposable profile. It also checks exclusive metadata creation, replacement, regular-file flushes, bounded backups and temporary-file cleanup.

This is native Windows **source-storage** evidence. The UI component regression separately checks rejected saves, draft retention, retry, pending submissions and acknowledged language changes. Neither result certifies a packaged Electron GUI, a provider or a full desktop restart. The workflow only retains its bounded JSON receipt and does not build, upload or publish a release.

## Application diagnostic log policy

The application diagnostic writer limits the current file to 512 KiB, retains at most three archives, caps each entry at 8 KiB and creates log files with mode `0600`. Known credential patterns are redacted; prompt bodies are omitted at the logging call sites. This is best-effort redaction, not a guarantee that arbitrary secrets can be detected. Keep diagnostic logging disabled unless needed and review any evidence before sharing it.

These limits apply to the application's diagnostic writer. QA command output, Playwright traces and screenshots are separate local evidence and can contain disposable-project content or text entered during inspection. They should not contain real account credentials; they are not automatically safe to publish.

## Packaged upgrade regression

After producing a new, frozen macOS package, run the previous and new bundles directly:

```sh
node scripts/mac/upgrade-smoke.cjs "/absolute/previous/ZIAForge.app" "/absolute/new/ZIAForge.app"
```

This command does not build, reserve a version, modify either bundle or use a personal app profile. It creates a fresh profile containing only a disposable registered repository and a synthetic Codex preset. The **previous packaged app** then creates the task through New task, sends one Composer message, saves a two-step plan through the plan editor and executes the first step to a manual checkpoint. Both real command verification and independent fixture review must succeed. The second step remains unstarted and a Composer draft remains unsent.

After normal Quit, the **new packaged app** opens that same profile. Read-only snapshots must preserve the task, chat feed, native resume availability, workflow identity, completed step and original command receipt bytes. Merely opening the app or clicking Resume must not deliver another prompt. UI Resume followed by Send must deliver the retained draft once, using a new fixture PID and the same native thread; UI Continue must execute only the remaining plan step. The test finishes with normal Quit and checks that neither package changed and no owned provider survives before emergency cleanup.

Each invocation saves a fresh `test-results/qa/*-packaged-upgrade-*/` manifest/result, both embedded build identities, bundle hashes, phase runtime/exit/cleanup receipts, full-interface screenshots, accessibility snapshots and traces. The supervisor handles terminal cancellation separately from Playwright and records forced cleanup as failure. Source changes during a run invalidate the result. The profile and screenshots contain synthetic test data, remain ignored and still require visual review. This is a fixture compatibility test, not proof of live provider authentication or every historical profile migration; a prepared harness is not a passed upgrade until it has actually run against both packages.

## Optional saved-history UI scale check

Run this separately from other GUI tests, against a finished build with no concurrent source edits. It needs macOS or Linux with a graphical session and `/bin/sh`:

```sh
npm run build:e2e
npm run qa:scale
```

The reproducible entry point is `scripts/qa/history-scale.cjs`; it does not require a parent research directory. The command creates a fresh fixture profile with **50 Work projects, two tasks per project and one main chat per task**. Each of the 100 chats contains 20 synthetic completed turns (40 messages), with eight approximately 512-character chunks per assistant reply. It seeds the documented application metadata and event-journal formats before launch; the production backend performs validation and replay. No personal profile, credentials or live conversation is copied. `HOME` stays inherited without reassignment; provider names and the PTY shell point to refusal stubs. A catalog may probe a stub, which is counted explicitly; the test never clicks Resume or Send and never calls a real provider.

The first pass selects all 100 tasks through the ordinary sidebar, checks each history and waits for React to paint. The second pass measures the same switches with the backend session cache populated. A full production Quit and new Electron process then reopen three tasks spread across the projects. The result records p50/p95/maximum switch latency, individual samples, matching rendered message IDs, DOM row counts and viewport intersection counts. It also retains raw Electron `app.getAppMetrics()` CPU/memory samples, logical journal and UTF-8 snapshot sizes, screenshots, process exits, owned-descendant cleanup and source/compiled hashes. Open the screenshots for a separate visual review.

Every invocation writes a new ignored `test-results/qa/*-history-scale-*/` evidence directory, including `manifest.json` and `result.json`. Both Electron phases and the supervisor must report verified cleanup with no fallback signals. Terminal cancellation requests normal Quit; an overall 12-minute deadline, forced termination, changed source/build, lost history, renderer exception or surviving owned process makes the run fail. The profile and synthetic journals remain available for diagnosis; the short temporary directory is removed after verified cleanup.

This is a **saved-history and UI workload**, not a test of 100 active CLI processes, parallel model execution or provider capacity. “Cold” means a fresh application/session cache; the OS file cache is not flushed. Logical payload sizes are not kernel I/O or IPC wire-byte measurements. Process metrics include automation/observer overhead and are collected without forced garbage collection. Latencies are observations on the recorded host, not machine-independent limits. A prepared helper or successful syntax check does not count as a passed Electron scale run.

Worktree removal must reserve the saved task against new session startup and sending, and reject even idle attached native adapters or PTYs. The removal guard is tested with active/startup/failed-cleanup sessions, delayed removal, a terminal in a worktree descendant, and real Git receipt replay after removal. PTY startup revalidates the canonical directory and its device/inode immediately before spawning. Closing or replacing a terminal retains its directory ownership until the process supervisor confirms the entire owned tree has exited; failed cleanup stays reserved for an explicit retry, project removal, or Quit. Deferred and failed retirement tests assert that worktree deletion remains blocked.

## Application updates

`e2e/updates.spec.ts` uses the current compiled Electron application with an isolated profile. Its main-process network fixture serves a deterministic GitHub release catalog, manifest and inert package. It checks the official default source, current package version, verified download, unsupported-install boundary, unsaved-editor guard and retained configuration after full Quit/restart. This fixture does not contact GitHub or a model, replace the user’s application or claim a native OS upgrade.

Focused `UpdateService`, release/download and installer tests cover trust checks and lifecycle failures. The installer helper fixture uses a disposable application tree and real child-process exit; it must preserve its profile marker and original bundle on failed replacement. A historical official ZIP can be used to verify archive format compatibility, clearly labelled as input data rather than the current UI under test. Windows/Linux installer execution remains separate from compiling those packages.
