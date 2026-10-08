# Build entry points

Use Node 24 with the committed lockfile and lifecycle scripts enabled: `npm ci`. Builds compile the current source; never rename an old development package into a stable release.

| Command | Result |
| --- | --- |
| `npm run dev` | Development server and Electron app |
| `npm run build:e2e` | TypeScript and Vite compilation, without packaging or a release reservation |
| `npm run package:mac` | Version-reserving unsigned macOS development `.app` and DMG |
| `npm run package:mac -- --dry-run` | Inspect the development build plan without reserving a version |
| `npm run package:mac -- --ci-verify` | Disposable CI verification package, never a published deliverable |
| `npm run package:platform -- --help` | Generic macOS/Windows/Linux x64/ARM64 packaging options |
| `node scripts/platform/release.cjs prepare --version 1.0.3 --output /absolute/new-release-directory` | Reserve a shared stable version and freeze a release plan for all six targets |
| `npm run package:source -- --help` | Clean committed source archives and source manifest |

The manual **Stable release packages** GitHub Actions workflow compiles/packages all six native targets from the release plan. Build-only mode performs artifact-integrity checks and deliberately skips runtime/GUI regression tests. Maintainers must retain the actual receipts and avoid claiming skipped checks passed. See [platform builds](PLATFORM_BUILDS.md) for release-plan inputs and reproduction.

[macOS builds](MACOS_BUILD.md) explains the development allocator and Mac checks. [Linux](LINUX.md) describes the earlier Ubuntu desktop verification. [Testing](TESTING.md) is the separate contributor regression contract.

Keep version reservations and source provenance when removing generated outputs. Stable releases, development previews and CI verification packages have different identities. Current public packages are unsigned. Supported installed layouts use the verified [application updater](UPDATES.md); unsupported layouts retain the manual installation path.
