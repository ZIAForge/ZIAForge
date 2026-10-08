# Application updates

Open **Settings → Updates** and choose **Check for updates**. The default source is the official `ZIAForge/ZIAForge` GitHub repository, with the Stable channel selected. The panel shows the running version and the newer available version. The **Update** action downloads the matching package and starts its installation after a normal application Quit.

Save file edits before installing. Updating closes application sessions through the same shutdown path as Quit. The updater does not resend interrupted prompts or remove user profiles, projects, settings or conversation history.

## Checking and downloading

- Stable excludes draft and prerelease versions. Preview includes prereleases. Semantic version comparison prevents a normal check from offering the same version or a downgrade.
- Release metadata, the release manifest and package hashes must agree. A package must match the current operating system and architecture. Downloads are bounded and checked for size and SHA-256 before an installer can run.
- A failed check, cancelled download or integrity mismatch never replaces the existing installation. A downloaded file alone is not proof that installation succeeded.
- Optional automatic checks run immediately and every six hours. They may download an update, but installation/restart remains an explicit local owner action.
- Advanced settings allow an explicit public repository and Stable/Preview selection. A custom source needs the same release-manifest format and uses manual installation; in-place installation is restricted to the official repository. Changing a source is a trust decision: checksums cannot establish the trustworthiness of the repository owner.

## Platform installation

| Installation | Update path |
| --- | --- |
| Writable macOS `.app` bundle | Prepare the verified ZIP, then replace the bundle after the old process exits; retain a backup for rollback on a failed replacement. |
| Windows installer | Run the verified NSIS installer after application shutdown. Required operating-system prompts remain visible. |
| Linux AppImage | Replace the owned AppImage after exit with a backup and relaunch. |
| Linux DEB or RPM | Hand the verified package to the distribution installer, with its normal authentication and dependency handling. |
| Development checkout, read-only/translocated app or unsupported portable layout | Use the release link and the platform's manual installation flow. The UI must not present this as an automatic in-place update. |

On macOS, copy the complete app from the mounted DMG into a writable installation location before using in-place updates. The updater never removes quarantine attributes or globally disables Gatekeeper. Windows and Linux authentication requirements are not bypassed. Current packages remain unsigned, and macOS packages are not notarized; SHA-256 verification is not a substitute for signing.

Versions before this updater was introduced need a normal manual upgrade once. Their existing code cannot acquire this feature merely by checking for a newer version.

## Lifecycle and control boundaries

`UpdateService` owns the saved source/channel and serializes checking, downloading, preparation and installation. The renderer receives status and progress, never an arbitrary executable or installation-path override. Update commands are local-owner IPC operations; remote control, Telegram and external agents can inspect status only.

An install request first prepares the verified artifact. Unsaved editor changes prevent Quit. Only successful completion of application shutdown can arm the detached installer, which waits for the Electron parent process to exit. A failed shutdown must leave the old installation intact. Abandoned staging must not become an automatic installation on the next ordinary startup.

The installed version shown after restart is the user's confirmation of completion. Release packaging, unit tests and an installer process starting are separate evidence; none alone certifies a native upgrade on every supported platform.

See [platform packages](PLATFORM_BUILDS.md), [release readiness](RELEASE_READINESS.md), and [testing](TESTING.md).
