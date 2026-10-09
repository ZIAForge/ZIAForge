# Claude Connector v1

Claude Connector v1 is an explicitly selected API profile for a connector backed by the owner's native Claude subscription and Agent SDK. The application uses the connector's typed Anthropic Messages protocol; the connector owns its native authentication and server workspace. The API connection key is separate from native CLI authentication. ZIAForge does not copy that authentication, silently fall back to a CLI, or infer the connector's billing terms.

This document describes the implemented client contract. Discovery, fixture checks, live inference and packaged application checks are separate evidence categories. An advertised capability is not proof of a successful native operation on a particular deployment.

## Connection and controls

1. In Connections, enter the connector's HTTPS origin, without `/v1`, a model ID and its separate API key. Loopback HTTP is permitted for local development; ordinary TLS validation remains enabled for HTTPS.
2. Select **Anthropic Messages** and **Claude Connector v1**, save the connection, then use **Inspect connector**. Inspection reads model, capability, status and usage metadata without running inference.
3. Choose caller or provider-native execution, native permission mode and an explicit native tool selection. Configure the output-token limit, native turn limit, supported thinking controls, optional JSON output schema and history mode as needed.
4. Select the saved connection in the chat's CLI / API selector and click **Apply**. Saving connection settings alone does not alter an active chat. The run retains its protocol, endpoint, model, workspace grant and native controls.

Credentials stay in the main process and supported OS credential storage. An unchanged endpoint with a blank key field preserves its saved key; a changed endpoint requires re-entering or clearing the key. Credential-bearing URLs, queries, fragments and redirects are refused. No model-provided URL can change the endpoint or receive its credential.

Defaults are explicit: caller mode, manual native permissions, no native tools, 30 native turns, 128,000 maximum output tokens and rejected cold-history import. The output budget is a ZIAForge default for new connections, not a universal provider default or a model capability. Existing explicit budgets remain unchanged. The native turn limit accepts 1–100; the client output-token setting accepts 1–128,000 and is constrained by the discovered model. These are request controls, not subscription quotas. Thinking and the visible answer share the output budget: a small limit with a high reasoning effort can exhaust the budget before an answer or a complete tool call is produced. Adjust the limit in Connections and explicitly apply the changed connection in the chat. Manual thinking needs a budget of at least 1,024 tokens below the output-token limit; adaptive/manual availability and reasoning effort depend on the advertised model. Summarized or omitted thinking is public provider output; signatures remain opaque and hidden internal reasoning is not exposed.

The optional output schema is a bounded JSON object sent as the provider's JSON-schema output format. A syntactically valid final JSON response alone does not certify every schema constraint. Unavailable models, unsupported controls, invalid configuration or a changed pinned definition remain errors.

## Caller tools and native tools

Caller mode supplies typed workspace functions executed by the application in the backend-selected local task directory. Reads use the existing traversal/link checks. Every local write needs explicit owner approval and an unchanged expected revision. Local commands require the separate **Allow local commands** setting and explicit executable/argument approval. Command supervision is supported on macOS and Linux and unavailable on Windows, where the command tool is not advertised. These commands run with ordinary account permissions; they are not an OS sandbox.

Caller mode can additionally select native `WebSearch` and `WebFetch`. Other native tools require provider-native mode. Provider-native mode supplies no local caller functions: selected native tools execute in the connector's owned server workspace. `claude.clientWorkspace` describes the local task directory to the provider; it does not mount that directory or grant server access to the computer. Native writes do not edit local project files. Download an artifact explicitly when a server-created file is needed locally.

Native availability and permission are separate controls. The client sends the exact selected native-tool list, including an explicit empty list. The permission mode can be manual, plan, accept edits or do not ask; changing it deliberately changes how the server obtains or denies native permission. Manual is the default. Read-only sessions reject native editing/executable tools and accept-edits mode. Tool-free sessions require an empty native list and expose no caller tools. Unsupported isolation or a tool outside the current grant fails instead of silently widening access.

Only standard Messages `tool_use` blocks with exact caller IDs can invoke registered local functions. A `claude.tool` extension is a provider observation rendered as typed tool progress; it never invokes a local function, command or filesystem operation. Tool names in prose and generic output are not executable instructions. Duplicate native observations are reduced by their identities, and unknown local calls are rejected.

## Questions and permission decisions

Provider permission cards show the exact native tool input and require an explicit allow or deny decision when the server requests one. The answer cannot replace tool arguments or create a persistent blanket grant. The application's automatic one-time Grok approval setting does not apply to Claude. Native permission decisions never authorize local writes or commands; those keep their separate approvals.

Question cards retain the exact question text, offered labels and single/multiple selection rules. Choose the required answers or enter a custom answer, then submit once. Cancellation is a distinct answer. Native questions and permissions belong to the current session, run, turn, response and interaction ID; replies use only the pinned connector's protected `/v1/claude/questions/{id}` or `/v1/claude/approvals/{id}` endpoint.

The application records a submission before posting it. Only an acknowledgement for the exact interaction can resolve the card. Expiry, Stop, restart, owner changes and uncertain submission make old cards inactive. An ambiguous or lost acknowledgement does not authorize a retry, and historical cards cannot send another decision. No approval or question is answered from journal replay.

## Owned continuation and interruption

Standard Messages SSE supplies text, public thinking, caller tool blocks and usage. The versioned `claude.*` extension supplies native activity, interactive requests and protected artifact metadata. Native message observations do not duplicate standard text output. Caller results retain their exact `tool_use_id` values and are returned as `tool_result` content in the same owned continuation.

Every request and tool continuation retains the model, instructions, tool definitions, native controls, output settings and trusted workspace grant. Completed owned history stores the acknowledged `previous_response_id`. Resume requires the same task and pinned definition; changing endpoint, model, tools, workspace or native controls requires explicit reconfiguration. Cold-history context mode is an explicit lossy import, not native identity recovery or replay. The default rejects it.

An unfinished request, uncertain local effect or pending caller transaction is not resent after restart. Inspect the recorded effects and explicitly create a new context when ownership cannot be continued safely. Reopening history does not rerun tools, repeat questions, download files again or request inference. Completed owned continuation is still subject to the connector retaining that session; advertised restart support alone is not a recovery guarantee.

Stop aborts the owned client operation, cancels its response through `/v1/responses/{id}/cancel` when the response identity is known, and expires its pending interactions. Cancellation acknowledgement and confirmed remote completion remain distinct from an uncertain request that has no known response ID. Stop does not undo writes or commands already completed, restart the connector, or terminate unrelated processes. A failed or uncertain cancellation is visible and does not trigger automatic resend or a provider switch.

The client reads the connector's `capabilities.limits.turnTimeoutMs` in both caller and native mode. A valid advertised deadline is an integer from 1 to 3,600,000 milliseconds. Each Messages request uses that deadline plus five seconds of transport grace, so an actively streaming request is not cut off by an unrelated ten-minute client limit. Caller continuations receive a fresh request deadline; bounded caller rounds still apply. The deadline also bounds local handling until the next request. Older connectors that omit the limit retain the ten-minute whole-turn fallback; an explicitly supplied adapter timeout retains its whole-turn meaning. Native permission and question expiry, local command limits and startup timeouts remain separate. A deadline is a maximum, not a guarantee that the provider will run that long.

Known terminal `max_output_tokens` and `native_timeout` errors retain their safe machine code and an explanation instead of becoming a generic connection error. A matching failed response receipt can confirm that remote work has ended; it does not mark the turn successful or make its partial history resumable. Partial tool JSON is never executed, and an exhausted budget does not trigger an automatic retry or continuation. Inspect any recorded effects before explicitly creating a new context.

## Images and documents

The native attachment pickers accept PNG, JPEG, GIF and WebP images, PDF documents and UTF-8 text documents. The renderer receives opaque IDs, names, MIME, sizes and digests. It cannot stage arbitrary paths or send file bytes through an attachment reference. Selection makes an immutable private copy owned by the exact task, chat, session and run; source and cache reads reject links, pin file identity, bound allocation and verify content.

| Input | Client limit | Validation |
| --- | --- | --- |
| PNG, JPEG, GIF, WebP | 16 MiB each; four image drafts; 20 MiB per image draft batch | Raster signature and dimensions, at most 32 million pixels |
| PDF | 16 MiB each | PDF signature; raw base64 document source at send |
| UTF-8 text | 1 MiB each | Fatal UTF-8 validation; no NUL bytes; plain text document source at send |
| Documents together | Four document drafts; 20 MiB per document draft batch | Exact owned IDs, sizes and SHA-256 |

The composer shares four attachment slots across images and documents. The Messages adapter also enforces a 32 MiB combined decoded attachment limit; the connector's bounded encoded HTTP request can impose a tighter limit after base64/JSON overhead. Image and document drafts each have a separate 128 MiB private cache budget. The client PDF limit is deliberately below the connector's 20 MiB PDF allowance.

Attachments are transmitted only when Send is accepted. Failed or uncertain delivery retains the same draft identities; it does not silently choose new files. Attachment messages cannot enter the durable text-only queue. Remove or explicitly discard pending attachments before changing or resuming the run. Discarding a draft does not undo an already delivered message. Accepted images retain private raster cards and Blob previews with owned URL cleanup; accepted documents retain safe metadata rather than inline PDF or HTML rendering.

GIF support belongs to Claude Messages input. It does not widen another connector's image picker or imply a new image-generation capability.

## Generated files and versions

A native write can produce a protected file artifact. Usable metadata contains a connector file ID, safe filename, normalized MIME, exact byte count and SHA-256, with optional `revision` and `supersedes_file_id`. This describes a file produced by server tools; it is not a claim that Claude offers native photo, video, audio or speech generation. A generated PNG or MP4 remains a downloadable artifact in this client profile.

The main-process transport accepts only the pinned origin and exact `/v1/files/{id}/content` route. It attaches the connection's saved credential, refuses redirects, and checks the response MIME, exact size and digest before publication. Text claiming that a file is ready, a model-supplied storage URL or a Markdown image is not a download instruction. Repeated streamed/final metadata for one immutable file ID creates one cached reference; conflicting metadata for the same identity fails.

The private artifact cache allows 128 MiB per file, 1 GiB total and 10,000 metadata records. Orphaned/interrupted copies count toward the byte budget. It preserves earlier files and reports a full cache rather than evicting chat history or silently requesting another generation. Save needed files before manually clearing private storage. Directories use private permissions and file copies use `0600` where supported. Saved reads recheck owner metadata, pinned file identity, size, digest and known format signatures.

Unknown formats and HTML, XHTML or SVG are stored as download-only `application/octet-stream`. Known raster, PDF, video, audio and archive formats have signature checks; these are integrity boundaries, not full document/codec certification. All artifact cards in this version are Save-only. PDF, HTML and SVG are never embedded or executed. No renderer fetches an arbitrary remote image or receives a cache path.

Each normalized `AgentArtifactRef` contains only `id`, `sourceRunId`, `filename`, `mime`, `bytes`, `sha256`, `providerFileId` and optional `revision`/`supersedesFileId`. Journals and snapshots retain those bounded references, never binary bytes, provider URLs, local paths, keys or Blob URLs. Artifact references are limited to 32 per event and 16 KiB serialized metadata per event; the adapter separately limits one turn's artifact batch to 32 files and 256 MiB. Existing journal limits remain in force.

The file card stays visible outside collapsed generic tool output, with its name, size, type, version metadata and **Save**. A superseding file has a new immutable identity; its earlier version remains available. Revision numbers and supersession links are retained as supplied; the client does not invent a global revision order across responses. **Save** sends only the current session, run and opaque artifact ID. Main verifies membership in the current conversation or its retained ancestor feed, opens the system destination dialog, rechecks ownership and writes the verified private bytes. The renderer never supplies a destination path. Cancelling the dialog or retrying a failed save does not run inference or redownload the provider file.

## Inspection and usage limits

Inspect connector separates discovered, enabled and verified native tool states, and reports typed image/document/artifact support, model options, owned-session status and available usage windows. Inspection does not launch inference, enable a listed tool or certify an actual result. Missing percentages, renewal dates, status counts and unavailable windows remain unknown, not zero or unlimited. A window reset is not a subscription payment or expiration date. A separately labelled manual renewal date is owner-provided information, not provider verification.

The connector owner remains responsible for server authentication, subscription availability, storage and service lifecycle. Unsupported or unavailable operations remain visible limitations; the client does not install plugins, alter server settings, or change native authentication to recover them.

See [API connections](API_CONNECTIONS.md), [help maintenance](HELP_MAINTENANCE.md), [project map](PROJECT_MAP.md) and [testing](TESTING.md).
