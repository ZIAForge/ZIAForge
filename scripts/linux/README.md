# Linux packaging helpers

See [docs/LINUX.md](../../docs/LINUX.md). Run the host coordinator from this repository. These helpers never reserve release versions or modify host dependency installations. They manage only resources bearing their exact `org.ziaforge.run` label; they never prune Docker.

`seccomp.json` is an unchanged copy of Microsoft's Apache-2.0 Playwright v1.63.0 Docker seccomp profile, retrieved from <https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/utils/docker/seccomp_profile.json>. SHA256: `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`. It extends Docker's syscall allowlist for Chromium user namespaces. It does not disable Chromium's sandbox. See <https://playwright.dev/docs/docker#crawling-and-scraping> and the upstream [license](https://github.com/microsoft/playwright/blob/v1.63.0/LICENSE).
