# Provider integration contract

A provider is a backend adapter plus an explicit launch/selection policy, projected through the shared session API. Extending the adapter factory alone does not make a new provider selectable or certified in the desktop app.

## Boundaries

- `electron/agents/AgentAdapterFactory.ts` defines lifecycle methods and capability flags. Native adapters own their child process tree; API adapters own abortable HTTP work and have no synthetic PID.
- `electron/runtime/SessionManager.ts` owns task/chat/run identity, exactly-once client message IDs, queues, journal order, approvals and explicit resume/reconfigure transitions. Do not create an independent UI-owned provider process.
- `shared/agent-events.ts`, `shared/agent-feed.ts` and `shared/agent-session.ts` define normalized events, projection and public snapshots. The renderer receives these contracts, not arbitrary native RPC access.
- Main resolves saved project/task grants, cwd, binaries, native preflight, API connection and permissions. IPC accepts logical identities and reviewed selections. A renderer must not choose arbitrary cwd, executable paths, environment or credentials.

Public provider unions, validation, launch policy, factory capabilities, saved metadata, model discovery, selection UI and test peers must agree. A provider's model catalog must come from its real supported interface or be explicitly unavailable; a fallback placeholder is not discovered availability. Preserve provider-specific permission semantics. Never advertise read-only enforcement, approvals, attachments or interruption that the transport does not implement.

## Lifecycle rules

`start` establishes a usable transport/conversation and returns its real identity. `sendPrompt` returns an acceptance/turn identity; this is not terminal completion. Every turn event carries the matching identity where the protocol supplies it. `scope: 'turn'` and `scope: 'session'` distinguish a finished or interrupted answer from a dead process/connection. Fence stale callbacks by run/generation and turn, including completion arriving before the start-response acknowledgement.

`interruptTurn` acknowledges an interrupt. Keep the current turn unavailable for another send until the terminal event is confirmed. A provider may require owned-process cleanup and a new native process to reuse the same conversation; model that explicitly and retain the user's draft. `stop` must finish cleanup of work the adapter owns. Never signal unrelated provider processes or modify global authentication/permission settings.

Persist user input before output can arrive. Approval decisions must be durably recorded before executing the approved action. Reject stale/duplicate approvals and expire interrupted pending approvals. Distinguish definitive delivery rejection from uncertain transport failure: explicit retry can use a new identity after definite rejection; an ambiguous timeout must not silently replay a potentially executed prompt.

Full application restart attaches saved history without spawning. Resume is a separate command with a validated native/local conversation reference. An invalid reference must not select another conversation. Reconfigure preserves visible history, freezes the new effective selection and records any bounded history handoff honestly. Stored connection/preset edits do not silently reconfigure a running session.

## Limits and evidence

Bound line/stream buffers, accumulated output, tool calls, context, discovery requests, startup/turn duration and cleanup. Keep raw stdout/stderr separate from assistant text. Redact likely credential forms, but treat logs and screenshots as private until reviewed; redaction is not a guarantee. Model prose cannot mint verification receipts, enable executable commands or certify a workflow step.

Add an independent deterministic peer that speaks the actual provider protocol. Include fragmented Unicode, pre-ready/stale events, completion-before-acknowledgement, two turns on one session, queue/Stop timing, approval/denial/replay, malformed output, process/HTTP failure, full Quit/restart/resume, reconfiguration failure, and shutdown descendants. Exercise the ordinary New task form, chat settings and composer in Electron; confirm both structured content and visible screenshots. See the native peers in `e2e/fixtures/` and API loopback peer in `e2e/fixtures/api-server.cjs`.

Record gates separately: unit protocol, real local transport peer, main/IPC integration, Electron UI, native authenticated inference, and packaged artifact. Fixture success does not prove a hosted account, live model, architecture or signing/notarization path. Extend the [compatibility document](PROVIDER_COMPATIBILITY.md) only with support justified by these boundaries.
