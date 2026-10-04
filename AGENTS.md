# Agent testing contract

Read [CONTRIBUTING.md](CONTRIBUTING.md), [docs/TESTING.md](docs/TESTING.md) and the affected protocol/workflow contract before changing behavior.

For whole-project context, read [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md), [docs/README.md](docs/README.md) and the [English user guide](docs/USER_GUIDE.md). Keep the guide aligned with any changed feature: edit only its canonical [docs/help/en.json](docs/help/en.json), follow [docs/HELP_MAINTENANCE.md](docs/HELP_MAINTENANCE.md), regenerate and run `node scripts/help/generate.cjs --check` after the integrated implementation. Do not hand-edit generated manuals or claim untranslated help is localized. Interface dictionaries and help translations have separate review status.

- Work in this checkout. Inspect the current diff before editing and preserve unrelated changes. Coordinate shared source/build files when other agents are active.
- Prefer typed IPC and saved backend task grants. Never accept arbitrary renderer cwd/executable overrides or quietly fall back from a structured provider to terminal parsing.
- Test observable user behavior and lifecycle boundaries: draft → accepted send → stream → terminal result; approval replay; Stop acknowledgement versus actual completion; full Quit/restart; native resume identity; model/provider switching; owned process cleanup.
- Use `npm run qa:check -- --e2e` for a fresh retained report. For a focused loop, compile once with `npm run build:e2e`, then run the selected Playwright case with a fresh `ZIAFORGE_QA_OUTPUT`. Do not rebuild shared `dist` while an inspection or Electron test is running.
- Use `npm run qa:inspect` for an isolated visible app. Connect agent-browser to the returned loopback CDP endpoint for that specific profile. Drive ordinary UI controls; inspect full screenshots and correlate them with the backend receipt/transcript. Keep debug facilities local and opt-in.
- Before visual testing, verify that the launched build and its displayed identity correspond to the current source and UI. Explain a development-only version label explicitly; use the current packaged build for delivery checks. Clearly label legacy compatibility fixtures so users and agents do not confuse them with the current product flow.
- Treat fixtures, native live inference, unit/static checks and packaged GUI as separate results. Preserve failures and report unrun/blocked checks honestly. No live provider call is implied by a fixture test request.
- Before ending a GUI run, use normal application Quit, verify owned descendants are gone and record emergency cleanup separately. Never kill unrelated CLI processes or edit global auth/configuration.
- Keep prompt bodies, personal projects, secrets, raw captures and authentication outside source control. Do not assume log redaction makes a screenshot or trace publishable.
- Freeze the tree before packaging. `package:mac` permanently consumes a version; `package:platform` requires a separately reserved identity from the same ledger; `build:e2e` does not consume one. Never delete version reservations, overwrite previous outputs or claim an unsigned package is notarized. Use [docs/MACOS_BUILD.md](docs/MACOS_BUILD.md) and [docs/PLATFORM_BUILDS.md](docs/PLATFORM_BUILDS.md) for exact commands. Record native execution, emulated execution, cross-package structure and GUI evidence separately.

The user's explicit scope and existing authorization govern actions. These instructions do not introduce a separate approval requirement for routine reversible work.
