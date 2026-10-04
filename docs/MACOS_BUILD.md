# macOS development builds

For a shared stable version across Intel, Apple Silicon, Windows and Linux, use the [stable release pipeline](PLATFORM_BUILDS.md#stable-release-one-version-six-native-targets). It reserves one release family and supports an explicit compile/package-only scope. The commands below are the separate, incrementing development pipeline; do not use them to allocate the six jobs of one stable release.

Run `npm ci`, then complete `npm run qa:check -- --e2e` against the source to be packaged. Commit the reviewed tree before producing a deliverable.

```sh
npm run package:mac
```

`npm run build` and `npm run build:dev` use the same macOS development pipeline. It compiles current sources and creates a fresh directory under `release/macos/`, containing the `.app`, DMG, logs, build identity, bundle inventory, and `SHA256SUMS`. It never removes or overwrites an earlier build and never updates a `latest` alias. The retired `post-build.cjs` cannot delete old archives. `--dry-run` reports provenance without building; `--allow-dirty` explicitly permits a development build from uncommitted sources, whose complete content fingerprint is still recorded.

Mutable electron-builder artifacts are created in a fresh canonical `/private/tmp/ziaforge-package-*` staging directory, outside the synced release folder. The `afterPack` hook and post-builder check require the complete application identity: names, app identifier, executable, both versions, build/source identity, reviewed icon and the actual ASAR header integrity. Stock Electron executable/icon/default archive entries fail the check. Finished artifacts are copied with `ditto` into the exclusively allocated release output; file bytes, modes and symlink targets must match the staging inventory, and the retained app identity is checked again. The staging directory is recorded and retained, including on failure; packaging never repairs a failed bundle or reuses its reserved version.

## Versions and reservations

The committed `package.json` version is the development allocator's lower bound. Each new development invocation reserves the next unused patch version at or above that bound, including repeat builds of the same commit. A failed or cancelled development packaging attempt permanently consumes its number. Skipping a number is intentional; reusing an identity would make evidence ambiguous. Stable release families use the explicit coordinator described above instead of this per-invocation increment.

Reservations live in the ignored, append-only `release/macos/.versions/<version>/reservation.json`. An atomic directory allocation reserves the number before compilation, and directory names remain authoritative even if a crash prevents the JSON write. The allocator also scans retained output names, and never goes below the source base version or a newer retained release line. A lock at `release/macos/.packaging-lock` covers the whole build because compilation writes shared `dist` directories. A second invocation fails before beginning a build while the lock is held. Preview/help and rejected preflight calls do not consume a version.

Back up the ledger together with the immutable outputs. Do not delete `.versions`, restore only an older ledger, or run official delivery builds from independent empty checkouts: there is no cross-machine central allocation service. Use one retained release directory as the delivery authority for both architectures. If an operator confirms that a crashed lock's recorded owner **and its children** have exited, only `.packaging-lock` may be removed; never remove the associated version reservation. An unknown owner or damaged lock requires inspection, not automatic PID killing.

The reserved version is supplied through electron-builder `extraMetadata.version` and `buildVersion`. Source `package.json` and `package-lock.json` remain untouched during packaging. The generated ASAR package version, `CFBundleShortVersionString`, `CFBundleVersion` and embedded identity must match; the existing About/version UI reads that packaged version. Build IDs additionally retain source commit, content fingerprint and time. The source base version is a floor, not the last delivered version.

`npm run package:mac -- --ci-verify` is explicitly for disposable CI validation. It uses the source base version with a unique `-ci` build identity under `release/macos-ci/`; it does not allocate or distribute an official delivery version. These outputs must never be handed to a user as a release. The prepared GitHub workflow uploads verification evidence only, not those `.app`/DMG files. Its optional package job also runs `e2e/model-catalog.spec.ts` against the exact packaged app on each configured architecture, using local CLI fixtures. This covers model discovery, direct model selection and full restart from ASAR, including failures that an unpackaged development launch would miss; it does not test live provider authentication.

The command builds only the current macOS host architecture. The currently verified machine is Intel `x64`; an Apple Silicon build must be built and tested separately on that architecture. It does not claim a universal binary. Artifact names include version, commit, working-tree fingerprint, timestamp and architecture; each output directory also has a unique suffix. This is a repeatable build procedure, not a claim of byte-identical DMGs (timestamps and disk-image metadata can differ).

The package embeds `Contents/Resources/build-identity.json`, and `Info.plist` records `ZIAForgeBuildId`, `ZIAForgeSourceCommit` and `ZIAForgeSourceSHA256`. The source fingerprint covers tracked and non-ignored untracked paths, modes and bytes. A commit or source change during packaging fails the run. A previous compiled bundle is never reused in place of compiling current sources.

Packaging also copies the exact project `LICENSE`, generated runtime `THIRD_PARTY_NOTICES.txt`, lock-derived `dependency-inventory.json`, Electron's license and Chromium notices into Resources. Runtime npm package names/versions must match the lock and have a notice file; missing notices fail unless an exact, hash-bound declaration-based preview supplement is recorded in `docs/licenses/supplemental-notices.json`. This metadata is not a legal clearance or complete binary SBOM. See [release readiness](RELEASE_READINESS.md).

`node-pty` is explicitly unpacked from ASAR. An `afterPack` hook validates and repairs only its staged macOS spawn-helper modes before DMG creation, then asserts bundle identity without rewriting it. A separate smoke launches the packaged Electron executable in Node mode, loads `node-pty` from that exact staged `app.asar`, and verifies a real bounded shell spawn. It makes no provider call. Packaging additionally checks executable permission, architecture, plist syntax and DMG integrity. `app-inventory.json` covers bundle files, modes and symlink targets; `SHA256SUMS` covers the DMG, identity and inventory. `artifact-retention.json` records the matching staging and retained artifact inventories.

Verify the recorded files from the generated build directory:

```sh
shasum -a 256 -c SHA256SUMS
```

## Run the actual app before delivery

```sh
npm run qa:package -- "/absolute/path/to/artifacts/mac/ZIAForge.app"
# Keep the same isolated visible app open for agent-browser; Ctrl+C finishes:
npm run qa:package -- "/absolute/path/to/artifacts/mac/ZIAForge.app" --hold
```

The command records separate evidence under `test-results/qa/`, verifies that it is running the packaged app with isolated userData, captures screenshots/geometry, and performs normal Quit plus owned-descendant verification. It hashes the bundle before and after the run so runtime mutation fails the check. It does not exercise provider inference or create a production debug API.

Run the executable-plan regression from the actual ASAR before delivering workflow changes:

```sh
node scripts/mac/workflow-smoke.cjs "/absolute/path/to/artifacts/mac/ZIAForge.app"
```

This launches the production `.app` with a fresh profile, isolated shell configuration, and local CLI protocol fixtures. It executes real verification commands through the packaged supervisor, checks a failed command and a rejected review, completes three steps across a full app restart, and verifies normal Quit. Receipts include `app.isPackaged`, the ASAR path, screenshots, command exit codes, process cleanup and unchanged bundle hashes. It never rebuilds or installs the app and makes no real provider request. The ordinary E2E fixture also accepts `ZIAFORGE_E2E_PACKAGED_APP=/absolute/path/ZIAForge.app` for focused packaged regressions.

Check profile continuity between two retained app builds:

```sh
node scripts/mac/upgrade-smoke.cjs "/absolute/previous/ZIAForge.app" "/absolute/new/ZIAForge.app"
```

The upgrade harness creates a task through the old app's ordinary UI in an isolated profile, leaves a partially completed plan, then opens that same profile in the new app and resumes the remaining work. Local fixtures supply provider responses. Its receipt checks both bundle hashes, retained task/session history, the resumed plan, screenshots and normal Quit cleanup. The command neither builds nor reserves a version; a successful run is required evidence, not implied by the harness being present.

Packaging reports GUI verification as pending. Launch the generated `.app` using a fresh, explicit `--user-data-dir` and seed only that profile's settings/workspace. Confirm `app.isPackaged`, application path, version and userData before testing. Capture the real window and relevant UI states; check native window visibility, no renderer exceptions, reload/reopen and normal Quit. Do not install over an existing application or reuse a person's default profile for testing. Loopback CDP may be enabled explicitly for this isolated launch; no production debug server or arbitrary-evaluation IPC is added.

Opening the `.app` or DMG manually is supported. These artifacts are **unsigned development builds**, with no notarization, publishing, updater certification or Apple Silicon certification implied. The command disables signing identity discovery, strips signing/publishing credential environment variables from child build processes and sets `--publish never`. A public macOS release needs a separate authorized signing/notarization and installation verification step. Existing installed apps and user profiles remain untouched by this build command.
