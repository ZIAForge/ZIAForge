# Release engineering and provenance

## 1.0.3 Windows settings persistence patch

Version **1.0.3** corrects a Windows directory-flush failure that could reject settings saves, including interface-language changes. Regular-file writes and flushes remain required, while the shared storage helper uses directory flushes only where supported. Settings catches save failures and displays the error instead of leaving an unhandled rejected save. See [1.0.3 notes](releases/1.0.3.md).

Verification is being finalized. Focused storage/editor and Settings regressions are recorded separately from the planned native Windows filesystem probes. Native probe outcomes and fresh six-target compile/package receipts must be entered in the release notes before publication. Application launches, GUI, provider inference and a complete regression suite are outside this patch's planned verification scope; no such success is claimed. Allocate 1.0.3 only after the fixes and evidence are integrated into a clean committed source. Prior published versions and their ledger records remain unchanged.

## 1.0.2 maintenance release

Version **1.0.2** updates official project-site links to [ziaforge.studio](https://ziaforge.studio) and includes the refreshed multilingual documentation presentation. The canonical product guide remains on the separate documentation site; GitHub remains the source and package destination. Workflow behavior, model settings and review decisions retain the 1.0.1 contract. See [1.0.2 notes](releases/1.0.2.md).

The release receives fresh versioned packages from one frozen source commit through the existing compile/package-only route. No repeated native-provider, unit, E2E, PTY or GUI testing is claimed. Packages remain unsigned and use manual installation. The original 1.0.1 release policy below is retained for historical context and the shared engineering rules.

## 1.0.1 release policy

Version **1.0.1** is the first public stable release line. Stable describes the selected product/update channel; it does not imply a code-signing certificate, notarization or a newly completed native desktop test. macOS, Windows and Linux receive separate x64 and ARM64 packages, all compiled from the same clean `main` commit. No development package is relabelled as a release.

The version coordinator preserves the existing development reservation ledger and reserves this exact stable version once. Each platform attempt has a separate identity/output. Compilation, embedded version/source identity, binary architecture, notices and checksums are checked when packaging. This release’s build-only workflow deliberately does not repeat unit, E2E, native PTY or GUI tests; previous checks and their limits remain separate evidence. See [platform builds](PLATFORM_BUILDS.md), [release notes](releases/1.0.1.md) and the public release assets/manifest for actual completed outputs. A configured workflow is never evidence of a successful build.

## Source publication

Public `main` imports the reviewed current source onto the owner’s original Apache-2.0 LICENSE commit. The local development history and private research remain outside the public import. Public source excludes credentials, captures, personal projects, CLI histories, build caches and QA profiles. The current tree and the publication tree are inspected independently before pushing. [Asset provenance](ASSET_PROVENANCE.md) records the inherited project branding and the owner’s public-release authorization.

Workflow research can inform an original implementation without redistributing private third-party prompt captures. Optional user-imported workflow reference profiles remain local; the application does not ship the owner’s captured prompt archive.

## Dependencies and notices

The lock pins Electron 44.4.3 and the exact resolved build/runtime dependencies. Electron and Chromium ship their upstream notices, despite Electron being a development dependency in npm metadata. The package collector includes installed runtime notices and lock integrity.

`lazy-val@1.0.5` declares MIT in its published metadata but omits an upstream license file. Its exact package bytes, npm integrity and original metadata are retained in the [supplement provenance](licenses/supplemental-notices.json); the [declaration-based supplement](licenses/lazy-val-1.0.5-supplemental.txt) includes the MIT permission/warranty text without inventing a copyright holder. This is explicitly labelled supplemental text, not a recovered upstream file. Changed packages and new missing-notice exceptions fail collection.

The most recent dependency audit, performed on 2026-10-03, reported 17 high affected entries and zero critical entries from the braces and http-cache-semantics advisories in lint/download/packaging chains; the production-only npm audit reported zero. That result is historical and does not exclude the shipped Electron runtime from review. Builds run on disposable hosted workers without provider credentials, operate on trusted release source and do not use the vulnerable build tooling to process untrusted contributions with a privileged token. These findings remain tracked; no forced major migration is hidden in this version-only release. Security-sensitive dependency changes require their own regression pass.

## Signing, installation and updates

The packages are unsigned. macOS builds are not Developer ID signed or notarized; Windows installers do not have Authenticode signatures. Checksums verify that a download matches the published bytes, not that an independent authority has endorsed it. Install only assets obtained from the official repository and use the documented operating-system installation flow. Never disable a system security boundary globally to install the application.

The application can check GitHub stable/preview releases. Automatic installation requires compatible signed packages and published updater metadata; the current unsigned release uses manual installation. The existing installation/profile must be retained when checking or when a download fails. Native subscription authentication and live model availability belong to each user’s provider account and are not certified by a packaging result.

## Maintainer sequence

1. Update source, documentation, version metadata and release notes; inspect the exact publication tree.
2. Freeze a clean commit and reserve a stable release identity.
3. Compile/package each target from that commit; retain failures and exact artifact hashes.
4. Verify the complete asset matrix, embedded identities, notices and combined checksums.
5. Publish the tag, release and assets; verify their public availability and default branch.
6. Preserve the version ledger and small provenance receipts when removing obsolete generated build outputs.

See [Security](../SECURITY.md) for reports and [Contributing](../CONTRIBUTING.md) for change verification.
