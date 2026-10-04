# Codex chat on macOS

The interactive Codex path uses the installed CLI's stdio App Server. It does not parse a terminal screen or require an API key in ZIAForge. The current compatibility gate accepts `codex-cli 0.153.x`, starting at `0.153.4`; other versions need a verified protocol update. The CLI uses its own normal authentication and configuration.

1. Check `codex --version` and `codex login status` in your terminal.
2. In ZIAForge settings, create a saved preset with agent **Codex**, a supported model or `auto`, and the intended permissions.
3. Create a Code task using that preset and a registered repository. **Start** saves and launches the selected managed workflow once; **Save draft** retains the request without inference. Its Forge discussion preserves questions and explicit document/plan acceptance. A separate ordinary chat draft is sent only through Send; never resend a managed task description just because Start was accepted.
4. Tool requests appear as approval cards when requested by the provider. Stop interrupts the current turn; the next message becomes available after the provider confirms turn completion.

`Read only` maps to `read-only` with approvals on request. A saved `Danger full access` or `Dangerously skip permissions` selection maps to `danger-full-access` without interactive approval. An absent setting uses workspace-write with approvals; unrecognized permission strings are rejected. ZIAForge does not silently infer stronger permissions from the preset's name.

The backend owns processes, message delivery and event history. Switching tabs, hiding the window or reloading the renderer does not restart a Codex session. Closing a chat view preserves its history and identity for reopening. Later preset edits do not silently change a session. Use the configuration controls below the ordinary chat composer to change its preset, model, effort, access or provider while idle, preserving the draft and visible history. Cross-provider changes use a disclosed bounded history handoff. Managed workflows retain their own role configuration and cannot be taken over through a free-chat control.

After a full application Quit or provider crash, saved history is shown as disconnected. **Resume session** starts a new App Server process and uses the saved `thread/resume` reference. A never-used empty thread may start fresh because Codex does not necessarily persist it. An explicit rejected turn-start can be retried with the preserved draft. A timed-out or otherwise uncertain submission is not automatically sent again, because delivery may have occurred. A missing rollout produces a recoverable error rather than silently choosing another thread.

Claude and Antigravity share the structured session service. [Executable plans](WORKFLOWS.md) coordinate implementation, actual checks and independent review through it. [Work workflows](WORK_WORKFLOWS.md) use the same session boundary for their own document/result phases. Git publication, live native account compatibility and final per-platform release certification remain separate checks. Disabled attachments reflect this adapter's actual current capabilities.

See [testing and inspection](TESTING.md) for deterministic Electron tests, isolated UI inspection and the distinction between fixture and live-provider evidence.
