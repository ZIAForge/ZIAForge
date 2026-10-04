# Platform packages and source builds

The platform packager produces separate artifacts for each operating system and CPU architecture. A successful cross-build proves that files were packaged for the selected target; it does not prove that the installer or application works on target hardware. Read the retained receipts for that particular build before describing it as verified.

| Target | Architecture | Distribution formats | Build route |
| --- | --- | --- | --- |
| macOS | Intel x64, Apple Silicon arm64 | DMG, ZIP | macOS host; matching architecture is required for native PTY and GUI checks |
| Windows | x64, arm64 | NSIS installer EXE, ZIP | Native Windows CI; Linux with Wine can package the reviewed shipped native prebuilds |
| Linux | x64, arm64 | DEB, RPM, AppImage, tar.gz, ZIP | Matching Linux architecture, native or emulated; native modules are rebuilt for Electron |

These are build targets, not a claim that every target has passed native testing. The local development environment has macOS Intel and Linux x64 Docker execution. ARM hardware and a Windows desktop are separate verification requirements. An emulated Linux ARM build is identified as emulated evidence by its operator, not physical ARM certification. A CI workflow definition is also not a successful hosted run.

These commands produce unsigned artifacts. A development build and a stable release use different identity channels; a stable version does not imply macOS notarization, Windows Authenticode or new runtime certification. Signing and automatic updates are not configured by this pipeline. Publication is a separate authorized step. Do not replace an existing installation or dismiss a security prompt without first checking the artifact's source identity and checksum.

## Install a matching package

- **macOS:** the locked Electron 44 runtime requires macOS 13 or later. Use the arm64 package on Apple Silicon and x64 on Intel. Open the DMG and copy the complete application bundle, or extract the ZIP. Keep the bundle intact. Unsigned downloads may require explicit macOS user approval; these instructions do not disable Gatekeeper.
- **Windows:** use a supported Windows version for the bundled Electron runtime and the package matching your CPU. Run the NSIS installer or extract the entire ZIP to a writable application location. Install Git and place it on PATH. A ZIP contains the complete runtime; `ZIAForge.exe` cannot be separated from its resources and native libraries. ARM package availability is not a claim of a completed ARM desktop test.
- **Ubuntu/Debian:** install the local DEB with `sudo apt install ./ZIAForge-<build>-Linux-<arch>.deb`. The package manager resolves declared system dependencies. [Linux verification](LINUX.md) describes the isolated Ubuntu desktop checks and their limits.
- **RPM distributions:** install the local RPM through the distribution's package manager, for example `sudo dnf install ./ZIAForge-<build>-Linux-<arch>.rpm`. Distribution compatibility must be checked on the target release; a generated RPM does not certify every RPM-based distribution.
- **AppImage:** set the file executable and launch it as your ordinary user. The system must provide compatible Electron libraries and FUSE 2; on systems without FUSE, `./ZIAForge-<build>.AppImage --appimage-extract-and-run` is an alternative supported by AppImage runtimes. Never use `--no-sandbox` as an installation workaround.
- **Linux tar.gz/ZIP:** extract the complete directory and start `ziaforge` as an ordinary desktop user. These archives do not install system libraries or desktop entries. A working graphical session and compatible Electron libraries are required.

Git is required for Code repositories. Native providers require their own installed CLI and authentication; packages do not include accounts, API keys or subscriptions. Linux remote-control credentials require a functioning Secret Service/KWallet backend. `basic_text` is refused because it does not provide OS-protected storage. The Ubuntu test environment uses a private unlocked GNOME keyring and records `gnome_libsecret`; that does not configure the user's machine.

## Build prerequisites

Use Git and Node 24 LTS (the native CI matrix pins 24.21.0). Clone with automatic line-ending conversion disabled so committed bytes stay identical, then run `npm ci --no-audit --no-fund`. Keep lifecycle scripts enabled: the root postinstall runs Electron's vendor installer for the exact locked runtime and repairs scoped macOS PTY helper permissions. Never copy `node_modules` between operating systems or architectures.

- macOS needs Xcode Command Line Tools. Only a macOS host can produce the supported Mac build route.
- Linux needs Python, a C/C++ compiler, make, pkg-config and packaging utilities. `scripts/platform/Dockerfile` provides a pinned Ubuntu 22.04 multiarch baseline, checksum-verified Node and DEB/RPM/AppImage tools. Runtime verification is separate from this build baseline.
- Native Windows rebuilding needs Python and Visual Studio C++ build tools with an appropriate Windows SDK and the libraries required by node-pty. The GitHub Windows runners provide a build environment, but successful use must be evidenced by that workflow run.
- Windows cross-packaging needs Wine and the exact reviewed node-pty prebuilds. The packager rejects an unreviewed node-pty version or additional native runtime dependency rather than assuming ABI compatibility.

The locked node-pty package includes N-API binaries for macOS and Windows x64/arm64. Cross-builds verify their file hashes and binary architecture, then retain `native-pty.json` as **unverified**. Linux has no bundled target prebuild and must compile on the target Linux architecture. By default, native builds load node-pty from the actual packaged Electron ASAR and execute a harmless local shell marker before package success. Explicit `--build-only` skips that runtime check and records **not-run-build-only**; rebuilding and structural architecture checks remain mandatory.

## Stable release: one version, six native targets

`.github/workflows/release-packages.yml` is the official compile/package-only route. It runs on native macOS Intel and Apple Silicon, Windows x64 and ARM64, and Ubuntu x64 and ARM64 runners. Every target compiles the same clean source commit and embeds the same release version, such as `1.0.1`. It uses no Wine, QEMU, account credentials or live provider requests. Hosted runner availability and repository billing still apply.

First commit the intended version in both `package.json` and `package-lock.json`, together with all release sources, on `main`. On the owner's machine, with the existing retained release ledger available, allocate the version exactly once:

```sh
node scripts/platform/release.cjs prepare --version 1.0.1 \
  --output /absolute/new-release-preparation-directory
```

This atomically reserves `release/macos/.versions/1.0.1`. Existing development reservations remain untouched. A failed preparation still consumes a reservation if allocation already occurred; inspect and retain its metadata rather than deleting it. The resulting compact `release-plan.json` binds that one version to the exact source commit, portable digest, release UUID and six targets. It contains no owner-machine filename, home directory or private branch. Preserve the separate local reservation receipt; do not publish it.

Dispatch **Stable release packages** from the exact `main` commit, supplying the plan as the `release_plan` input. With authenticated GitHub CLI, passing JSON through standard input avoids shell interpolation of its contents:

```sh
node -e 'const fs=require("node:fs");process.stdout.write(JSON.stringify({release_plan:fs.readFileSync(process.argv[1],"utf8")}))' \
  /absolute/new-release-preparation-directory/release-plan.json | \
  gh workflow run release-packages.yml --ref main --json
```

Each job verifies the dispatch commit and committed bytes, runs `npm ci`, rebuilds native dependencies, compiles TypeScript/Vite and generates all formats for its target. It verifies ASAR version, executable/native-library architecture, retained bundle inventory and archive hashes. macOS also validates its bundle metadata and DMG structure. Stable packaging uses `store` compression (gzip for DEB/RPM) to bound packaging work; archives may be larger. Signing and publication are disabled. TypeScript/Vite retain bounded 20-minute command limits; the native builder has a 60-minute limit and each hosted job a 100-minute limit.

The release workflow deliberately runs **no unit tests, native PTY execution, GUI, installer, upgrade or provider checks**. Receipts declare `verificationScope: compile-and-package-integrity-only`, `nativeExecution: not-run-build-only` and GUI unverified. A passing package job must not be described as a new platform runtime certification. The separate verification workflow below remains available when such checks are requested.

Artifacts named `stable-<platform>-<arch>-<run>-<attempt>` contain the complete distributable archives, notices, checksums and diagnostic receipts. The DMG/ZIP preserves a complete Mac `.app`; the unarchived staging bundle is not uploaded a second time. Artifact names inside each retained attempt use `ZIAForge-1.0.1-<OS>-<arch>.<format>`. GitHub artifacts expire: download and retain all six target results and checksums before publication.

Retrying a failed job against the same frozen source creates a new build identity from its GitHub run/attempt while keeping the reserved public version. If an **unpublished candidate** needs a source correction, commit that correction at the same package/lock version and append a revision on the owner's machine:

```sh
node scripts/platform/release.cjs revise --plan /absolute/previous-release-plan.json \
  --output /absolute/new-candidate-directory \
  --reason "Correct the failed candidate packaging configuration"
```

`revise` requires the exact latest plan and matching release/reservation UUIDs in the existing owner ledger. It never replaces the base reservation, earlier plans or failed artifacts. It exclusively appends `.versions/<version>/revisions/<commit>-<uuid>.json`, chaining the prior plan SHA256 and commit to the new commit, portable digest, revision number and reason. The complete new plan is retained in that record before external output is written, so an interrupted output copy does not destroy the revision. The private local receipt and reason are not embedded in packages; target build identities retain the public revision ID and chain metadata.

Hosted jobs cannot revise the owner ledger. Dispatch the new plan from its exact `main` commit and **rebuild all six targets**. Never combine packages from different source commits or revisions into one release. Old candidates remain evidence, not replacements for the new builds. Revisions are only for a release that has not been published; after publication, reserve a new semantic version. An owner-recorded `.versions/<version>/published.json` also makes the revision command refuse changes; the coordinator does not query GitHub or publish that marker automatically.

Never replace a published release asset with a retry. The workflow does not allocate additional versions, delete failed artifacts, tag commits or publish a GitHub Release. Publication should include only intended packages, checksums, licenses and a sanitized source/version/platform summary, not raw command logs or local reservation paths.

For an equivalent local native build, materialize a new attempt and pass it to the same packager:

```sh
node scripts/platform/release.cjs materialize --plan /absolute/release-plan.json \
  --target darwin-arm64 --attempt local-unique-attempt --output /absolute/new-identity-directory
node scripts/platform/package.cjs --build-only --platform darwin --arch arm64 \
  --identity /absolute/new-identity-directory/build-identity.json \
  --source-manifest /absolute/new-identity-directory/source-manifest.json \
  --output /absolute/new-package-directory
```

The identity uses `mode: release` and `distribution: stable-release`; application metadata and About/version UI use the stable semantic version. The unique release/target/attempt build ID remains embedded for provenance. No previously compiled or differently numbered development artifact is relabelled as the stable release.

## Immutable official delivery

Freeze and commit source first. Development deliveries reserve increasing versions in the one retained `release/macos/.versions` ledger; the stable release coordinator above reserves one version for its frozen six-target family. A failed attempt keeps its reservation and evidence. The generic packager does not allocate versions, mutate `package.json`, sign, publish, or overwrite an output directory. Its input identity must contain the reserved semantic version, unique build ID and exact clean source commit. Supply a distinct identity/output for each official invocation.

```sh
node scripts/platform/source-manifest.cjs /absolute/evidence/source-manifest.json
node scripts/platform/package.cjs --platform darwin --arch arm64 \
  --identity /absolute/evidence/reserved-identity.json \
  --output /absolute/new-delivery-directory
```

Use `--platform win32 --arch x64` for Windows or `--platform linux --arch arm64` for Linux ARM. `--formats` can select a comma-separated subset of the matrix, such as `deb,rpm,AppImage`. Linux packaging refuses a different host architecture; use a matching native runner or an explicitly labelled emulated container. macOS output uses the existing staged identity and helper-permission hook.

For a clean exported source tree without `.git`, pass `--source-manifest /absolute/evidence/source-manifest.json`. Create the manifest from the same clean commit before export. The manifest checks committed path, Git mode and exact content hashes independently of host filesystem permissions. Do not add unreviewed source files or a `.env` file to the export. Keep dependencies, build directories and retained evidence outside the source archive.

Verification rejects unlisted files, including additional source modules or environment files. Only the exact root dependency/generated directories `.git`, `node_modules`, `dist`, `dist-electron`, `release`, `test-results`, `playwright-report`, `screenshots` and ordinary `.DS_Store` files are excluded. This is source-input verification, not dependency integrity or an operating-system sandbox.

The output retains build identity, source manifest, compile logs and compiled fingerprint, dependency notices, native binary inventory, native execution result, full bundle inventory, final artifact hashes and `result.json`. The semantic version is written into application metadata and embedded identity. GUI checks remain separate even when package generation passes. Compiler entrypoints share the existing local packaging lock because they write `dist`; do not run them concurrently in the same checkout. A stale lock requires checking its recorded owner before any manual recovery.

```sh
node scripts/platform/smoke.cjs /absolute/delivery/result.json
# Linux CI with an isolated virtual display:
xvfb-run -a dbus-run-session -- node scripts/platform/smoke.cjs /absolute/delivery/result.json
```

The native smoke requires matching OS/CPU, starts a fresh application profile without provider calls, verifies packaged identity and sandboxed renderer, captures the real window, reloads, invokes normal Quit and checks birth-bound owned processes and unchanged bundle bytes. It does not prove provider authentication, installer integration, upgrade compatibility, Secret Service configuration or every workflow. Those are separate target-specific checks. Existing [Mac](MACOS_BUILD.md) and [Ubuntu](LINUX.md) procedures cover their stated installed-app boundaries.

## Docker build environment

Build only a new owned image/container. Do not mount the host home directory, authentication directories or Docker socket. Export the clean Git source; install target dependencies inside the container. Use a private output volume/directory and copy out receipts and artifacts before removing only owned temporary resources.

```sh
ziaforge_context=$(mktemp -d)
mkdir -p "$ziaforge_context/scripts/platform"
cp scripts/platform/Dockerfile "$ziaforge_context/Dockerfile"
cp scripts/platform/extract-tar.py "$ziaforge_context/scripts/platform/extract-tar.py"
docker build --platform linux/amd64 -f "$ziaforge_context/Dockerfile" \
  --build-arg TARGETARCH=amd64 -t ziaforge-platform-build:local "$ziaforge_context"
# Linux ARM: --platform linux/arm64 --build-arg TARGETARCH=arm64
# Windows cross-packaging on Linux x64: additionally --build-arg WITH_WINE=1
rm -r "$ziaforge_context"
```

This minimal context sends only the Dockerfile and reviewed archive extractor to Docker. Do not use a development workspace containing ignored profiles, credentials, transcripts or dependencies as the build context.

The Dockerfile pins the official Ubuntu multiarch index and verifies the downloaded Node archive SHA256. Record the resulting image ID, architecture and whether execution is emulated in delivery evidence. Dependency availability and runtime behavior must still be observed. Docker availability is not authorization to stop unrelated containers, reset the daemon or prune shared resources.

The build image extracts verified Node/source archives with `extract-tar.py`. It validates all paths and links, refuses special files, existing files and symlink ancestors, then preserves ordinary executable modes. This avoids a reproduced Docker QEMU incompatibility where Ubuntu's hardened GNU tar calls `openat2(RESOLVE_BENEATH)` and receives `EINVAL` on ARM. Checksums and the strict source manifest remain mandatory; no sandbox or global emulator setting is changed.

After reserving an official identity, the owned-container coordinator performs the clean source export, target `npm ci`, package invocation, artifact copy and cleanup without any host mounts:

```sh
node scripts/platform/container.cjs --image ziaforge-platform-build:local \
  --platform linux --arch x64 --identity /absolute/reserved-identity.json \
  --output /absolute/new-container-delivery-directory
```

Use the ARM image with `--platform linux --arch arm64`, or the x64 Wine image with `--platform win32 --arch x64` / `--arch arm64`. It validates the image architecture and non-root user, records its immutable image ID and daemon architecture, retains the original child package receipt plus host artifact paths, and removes only its labelled container. Build failures remain in their own output directories. Do not reuse an official identity for another attempt.

Each build container is limited to 3 CPUs, 3 GiB memory and 1,024 processes, with two native compiler jobs. Schedule builds sequentially on an 8 GiB Docker VM that also hosts other applications. These limits do not reserve resources or stop unrelated workloads.

Windows cross-packaging uses an isolated temporary Wine prefix and a virtual display. Optional Wine Gecko/.NET installers are disabled because resource editing does not require them; the native Windows artifact is not run in this preparation check. Standard `HOME` is inherited, never reassigned. No existing contributor Wine profile is read or updated.

## Native CI and source archive

`.github/workflows/platform-packages.yml` is a manually dispatched, read-only-token native matrix for macOS Intel/ARM, Windows x64/ARM and Ubuntu x64/ARM. It uses `--ci-verify`, builds the source base version with a unique CI identity, runs native PTY and a real isolated window check, and retains receipts/screenshots only. It does not consume an official delivery version or publish installers. Runner availability, permissions and billed minutes depend on the repository's GitHub plan.

```sh
node scripts/platform/source.cjs /absolute/new-source-delivery-directory
```

The source command produces tar.gz and ZIP archives from one clean Git commit, plus a portable manifest, SHA256SUMS and receipt. Only tracked committed files enter the archive: no `node_modules`, `.git`, private research, accounts, profiles or previous build outputs. The archive includes this guide, the committed lockfile, contributor instructions and packaging scripts. Extract, read `CONTRIBUTING.md`, install prerequisites, run `npm ci`, then use the documented checks/build route. A local verification build can use `--ci-verify --source-manifest ...`; it is not an official numbered deliverable.

## Primary references

- [Electron Builder: multi-platform builds](https://www.electron.build/v26/docs/features/multi-platform-build/)
- [Electron: native Node modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [GitHub: hosted runner platforms and availability](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Electron: safeStorage and Linux backends](https://www.electronjs.org/docs/latest/api/safe-storage)

These explain tooling support. Actual project verification is recorded per artifact and must not be inferred from the upstream support matrix.
