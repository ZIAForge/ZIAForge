# Contributing

ZIAForge develops software through explicit plans, executable verification and independent review. Preserve both manual checkpoints and deliberate Auto mode. Native subscription CLIs and API providers are different capabilities; do not silently switch providers, transports or authentication paths.

## Local setup

Use Node 24 LTS and npm with the committed lockfile. The current CI definition pins Node 24.21.0. Packages target macOS, Windows and Linux on x64 and ARM64. Cross-built packages need separate execution and GUI checks on their target OS and architecture; building them does not certify that runtime. See [platform build instructions](docs/PLATFORM_BUILDS.md) for native prerequisites, container builds and the verification matrix. On macOS, install Xcode Command Line Tools for Git/native dependencies, then run:

```sh
npm ci
npm run qa:doctor
npm run qa:check -- --e2e
```

Run installation once, outside other tests/builds. Keep lifecycle scripts enabled: the root postinstall invokes Electron's vendor installer for the locked runtime, then repairs the scoped native PTY permissions. Electron exposes its installer separately from its package lifecycle scripts. The vendor installer validates the pinned runtime archive and reuses an already installed matching runtime. Do not copy `node_modules` or delete dependencies while another process is testing. Use a local checkout with reliable filesystem semantics; keep backups and retained evidence separately.

`npm run build:e2e` compiles without producing a numbered deliverable. `npm run package:mac` consumes a new release version even if packaging fails; reserve it for a frozen, reviewed tree. `npm run package:platform` consumes an identity already reserved in the same owner ledger and produces one target per invocation. `npm run package:source` exports the clean committed source with checksums. See [Mac build policy](docs/MACOS_BUILD.md) and [platform build instructions](docs/PLATFORM_BUILDS.md).

## Changes and evidence

- Add a regression for a reproduced behavior or boundary, especially session identity, stale callbacks, cancellation, approvals, replay or process ownership. Avoid tests that merely copy an implementation.
- Start with focused tests, then run the complete typechecks, lint and unit suites. Changes to UI/runtime integration need real Electron fixture coverage. Packaging changes also need a fresh packaged-app smoke after the tree is frozen.
- Preserve unsent drafts and exactly-once delivery identities across failed startup and retry. A transport acknowledgement is not turn completion. Keep CLI diagnostics separate from user-visible assistant content.
- Treat model assertions as unverified. Workflow success requires the recorded command exit status, cleanup and required reviewer outcome. Keep completed steps stable across restart.
- Include the source commit/fingerprint, command results, fixture/live classification, screenshot observations and any fallback cleanup in your PR. A screenshot, green unit test or test double alone does not prove the whole user flow.

No provider account is needed for fixture CI. Live calls use the contributor's native authentication only when explicitly intended; do not copy credentials into fixtures or CI secrets. Do not change global provider settings or reassign `HOME`/`CODEX_HOME` to manufacture a passing result. Keep temporary projects and app profiles isolated through the test helpers.

## Help and localization

Update user-facing instructions in the same change as the feature. [docs/help/en.json](docs/help/en.json) is the canonical English guide for the app, [Markdown manual](docs/USER_GUIDE.md) and offline website. Run `node scripts/help/generate.cjs` to regenerate, then `node scripts/help/generate.cjs --check` after integration; never edit generated outputs independently. [Help maintenance](docs/HELP_MAINTENANCE.md) explains locale scaffolds, explicit English fallback, source hashes and review. [Localization](docs/LOCALIZATION.md) governs interface dictionaries; machine/schema coverage is not a claim of native-language review. See [the current project map](docs/PROJECT_MAP.md) before using an older architectural document as a feature description.

## Licensing and publication

Contributions must be original or have a documented compatible provenance. Do not submit captured third-party prompts, private chat exports, proprietary app resources, credentials or generated QA profiles. The repository's Apache-2.0 license does not establish permission for unrelated third-party materials. Follow [release provenance](docs/RELEASE_READINESS.md) and inspect staged files before publishing.

Use a focused branch and explain the final behavior and validation. Do not include `node_modules`, app bundles, DMGs, research archives or live transcripts. CI definitions are prepared here; only an actual successful hosted run proves CI works on that runner.
