# Security

ZIAForge runs local development tools with the permissions of the signed-in operating-system user. A task folder, a CLI sandbox option and an isolated QA profile are different boundaries; none makes an untrusted project an operating-system sandbox. Review provider permissions and requested file changes before approving them.

The maintained release line is **1.0.x**, with architecture-specific packages for macOS, Windows and Linux. Releases are currently unsigned; signing and notarization status is stated with each release. Report the exact application version, source/build identity and provider version. A successful fixture test does not certify an external provider account or service.

## Reporting a vulnerability

Do not post credentials, private prompts, full provider transcripts or an exploitable private project in a public issue. If the repository offers private vulnerability reporting, use its Security tab. Otherwise contact a repository maintainer through an established private channel before sharing sensitive reproduction details. Public issues can describe non-sensitive symptoms without exploit material.

Include the affected version, relevant permission boundary, minimal reproduction in a disposable project, expected and actual behavior, and impact. Review logs and screenshots yourself before attaching them. Do not test against another person's files, accounts or services.

## Contributor expectations

Keep privileged operations in the main process behind validated typed commands and saved task ownership. Preserve path/symlink checks, private credential storage, bounded output, explicit approval and cancellation semantics. Recovery must preserve damaged data. Release evidence must distinguish deterministic fixtures, live inference and the actual packaged application.

Debugging and CDP endpoints are local, opt-in testing facilities. Do not expose them to a network. Keep dependencies supported, retain third-party notices, and run the regression and packaged-app checks after security-sensitive changes.
