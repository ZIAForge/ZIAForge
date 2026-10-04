# Linux x64 packages and Ubuntu desktop verification

The Linux delivery target is a Debian `.deb` for x64/amd64. A successful package build and successful installed-app tests are separate requirements. Ubuntu 24.04 X11 desktop containers are the initial validation environment; this does not certify every Debian release, GNOME, Wayland, ARM64, GPU driver or host AppArmor policy. An unexecuted helper or successful macOS run is not Linux certification.

## Isolated runtime

Docker Desktop or Docker Engine must be available. Inspect available memory and disk before starting. The two desktop instances use up to 2 GiB each; the build container is capped at 3 GiB and should be idle during desktop checks. Keep several GiB of host disk available for dependencies, Electron, unpacked output and the `.deb`. Do not prune or stop unrelated Docker resources.

Build the runtime image:

```sh
docker build --platform linux/amd64 \
  -t ziaforge-ubuntu-lab:node24-20261003 \
  -f scripts/linux/Dockerfile scripts/linux
```

The default base is the pinned amd64 [official Ubuntu 24.04 image](https://hub.docker.com/_/ubuntu). Node 24.21.0 comes from nodejs.org and its archive SHA256 is checked before extraction. Ubuntu repositories supply desktop and native compilation dependencies. A previously inspected local Ubuntu desktop image can be supplied with `--build-arg BASE_IMAGE=<immutable-image-id>` to reuse cached layers; record its exact identity and installed OS/packages. Never reuse another user's container or profile.

The image creates an ordinary `ziaf` user. Application processes inherit that user's normal HOME. Host HOME, provider configuration, keys, Docker socket and unrelated host folders are never mounted. Each GUI container has its own private profile and workspace. A read-only volume supplies only this run's exported source, test runtime and Linux-built dependencies.

The smoke uses Xvfb, Fluxbox and a private DBus session. It starts GNOME Keyring for the disposable container user, unlocks it with a generated password sent only through stdin, and checks a store/lookup/clear round trip. The password is not written to arguments, logs or receipts. Each actual app launch, including restart, explicitly selects `gnome-libsecret` and must report `safeStorage.getSelectedStorageBackend() === "gnome_libsecret"` after readiness. The selected backend name is retained; secrets are not. Chromium sandboxing stays enabled (`chromiumSandbox: true`), with the versioned Playwright seccomp profile permitting user namespaces. It uses neither `--privileged`, `--no-sandbox` nor host IPC. Ubuntu host AppArmor can impose additional restrictions; those must be tested on a real host separately, not bypassed globally.

## Freeze, export and package

Commit the reviewed tree first. `prepare` refuses a dirty source tree and exports the Git commit, excluding ignored dependencies, research, profiles and generated outputs. It creates its own labelled build container/volume and installs Linux dependencies from the committed lockfile with `npm ci`; it does not copy macOS `node_modules`.

```sh
node scripts/linux/docker.cjs prepare /absolute/new/Linux-build-run
```

The release owner must first reserve the next version in the project's single authoritative release ledger. Supply an identity JSON with `version`, `buildId` and the exact `source` recorded by `prepare`; do not invent a second Linux counter or reuse a consumed build number. The helper verifies that this identity matches the unchanged clean source.

```sh
node scripts/linux/docker.cjs package /absolute/Linux-build-run /absolute/reserved-build-identity.json
```

Compilation and electron-builder run inside Ubuntu. The root source version and host `dist` remain unchanged. The app's ASAR version, embedded build identity and Debian metadata use the reserved version. A real packaged Electron/node-pty spawn checks the Linux native module. Logs, dependency notices, `.deb` metadata, complete unpacked file inventory and checksums are retained in the fresh output directory. The transient unpacked application is removed only after the native check and verified `.deb` retention; the installed smoke compares the full original inventory. No signing, publication, update repository configuration or installation over a host app occurs.

## Two installed desktop instances

```sh
node scripts/linux/docker.cjs smoke /absolute/Linux-build-run
```

The smoke creates a fresh internal Docker network and two new Ubuntu containers, installs the actual `.deb` with `dpkg`, then starts each installed ASAR app as the nonroot user. Only control HTTP ports are published, bound to host loopback; CDP is not exposed. The application control token stays in private memory/profile files and is omitted from retained public receipts.

The bounded fixture scenario checks:

- Actual package/version/profile identity, renderer sandbox and full desktop screenshots.
- Missing/wrong authentication denied; tokens redacted; native command grants cannot be escalated remotely.
- Separate task stores; a read-only destination denies mutation; owner-enabled operate access creates a task and sends one deterministic CLI turn in the other instance.
- Proxied events originate from the selected instance; the local stream does not receive the other task's events.
- Distinct histories and unsent drafts survive each instance's normal Quit/restart; one app's Quit does not stop the other; restart does not send a new prompt.
- Normal Electron exit, no renderer errors or emergency process cleanup, and unchanged installed bundle contents.

This is real Linux Electron/HTTP/CLI-fixture integration, without provider authentication or live inference. Provider names are local deterministic/blocked executables; the Docker network has no external route. Screenshot inspection remains a separate human/agent step. A test failure remains in its unique `smoke-*` directory.

After retaining the package and receipts, remove only the build resources owned by this run:

```sh
node scripts/linux/docker.cjs cleanup /absolute/Linux-build-run
```

The output directory and previous builds are preserved. The smoke itself normally removes only its own two disposable desktop containers/network after recording their normal application shutdown. If interrupted before its cleanup, inspect `docker-run.json` and labels; never use a name wildcard or global prune.

## Installing on an Ubuntu desktop

After the specific `.deb` has passed installed verification:

```sh
sudo apt install ./ZIAForge-<build>-linux-amd64.deb
```

Launch ZIAForge from the application menu as your ordinary desktop user. Credential-bearing control features require a supported unlocked desktop secret store, such as GNOME Keyring/Secret Service or KWallet. Installing `libsecret` alone does not provide a keyring. Electron's `basic_text` fallback does not provide OS-backed protection and must not be treated as a working secure store; see [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage). Native subscription clients must be installed and authenticated on that Linux machine; container fixture success says nothing about their availability or login. Keep remote control disabled unless needed; use owner-selected read/operate scope and a trusted network or TLS tunnel. The built-in HTTP service does not itself provide TLS.
