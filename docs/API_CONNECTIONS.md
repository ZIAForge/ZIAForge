# Explicit API connections

API connections use a saved endpoint and key separately from native CLI authentication. Existing connections default to Chat Completions; selecting Responses is explicit. There is no automatic transport, CLI or credential fallback. Both adapters report actual returned usage and bound context, streams, tool rounds and duration. HTTP errors, malformed streams and premature EOF are failures. Raw headers and server error bodies are not retained.

## Authentication and transport

Use a base URL including `/v1` where required. HTTPS is required except for loopback HTTP. Userinfo, query strings, fragments and redirects are refused. Main encrypts keys with supported OS credential storage; renderer metadata contains only `hasApiKey`. A blank edit preserves a key, an explicit empty key removes it, and changing the endpoint requires re-entry or clearing.

For a saved Chat Completions connection, **Set up Responses** opens an unsaved draft for the same connection. Review its transport and profile, then **Save connection**. The endpoint is not inferred from its hostname; commands remain off unless explicitly enabled. Leaving the key blank keeps its encrypted value when the endpoint is unchanged.

Existing chats keep their pinned protocol after saving. Their header reports that effective protocol from the backend snapshot, separately from the current connection settings. Open the chat's CLI / API selector and **Apply** the same connection to deliberately reload its saved configuration. This keeps the chat identity and history and starts a new run; it does not replay interrupted requests or turn old Markdown image links into image cards. Resume still enforces the old pinned policy and refuses a changed endpoint/transport until explicit reconfiguration.

Responses uses top-level `instructions`, `previous_response_id` and `function_call_output` with the original `call_id`. Output item IDs are separate from execution IDs. Only completed live function calls enter local execution; replayed history does not dispatch tools. Raw reasoning is neither rendered nor persisted. Changing transport creates an explicit history handoff rather than interpreting Chat history as Responses state. Saved launch/queue policies pin the selected Responses endpoint and profile.

## Caller tools and owner approval

`read_file`, `list_files`, `search_text` and `write_file` operate relative to the canonical backend task cwd. Traversal, symlinks, special files and excluded credential directories remain forbidden. Writes require approval and an expected file digest or null for a new file, rechecked immediately before replacement. Tool output is untrusted data. Instructions distinguish this local workspace from any provider-native workspace.

Responses connections may explicitly enable `run_command`. On macOS/Linux it accepts a bounded executable/argument request with the fixed local task cwd, always asks the owner, and uses the existing owned verification runner for output/time limits and descendant cleanup. Read-only sessions do not receive this tool. Windows command supervision is unavailable and the tool is not advertised there. An approved executable can access resources outside the task: this is process supervision, not an OS sandbox.

Execution intent is saved before a side effect and its outcome afterward. Uncertain execution blocks automatic replay; inspect and deliberately start a new context. Stop drains owned work. Cancellation of an HTTP stream is not evidence that a provider operation stopped: the connector profile also requests its owned response cancellation and reports failures. Generic OpenAI Responses streams are aborted without claiming cancellation of a server-side background operation.

## Provider observations and images

The explicit Codex connector profile consumes the documented, unversioned `codex.tool` method/params extension only for known hosted operations. Other extensions and raw reasoning are ignored. Provider cards never execute local file or command tools, create caller function outputs or expose local per-tool Stop. Local read-only policy does not restrict the remote server. This connector cannot enforce `toolPolicy: none`, so tool-free architect startup fails closed. A compatible provider that enforces that policy must be selected.

Standard `image_generation_call.result` is decoded into a private cache and replaced with metadata-only journal references. PNG/JPEG/WebP headers, encoded/decoded size, dimensions and digest are checked. Limits: 32 MiB/32 million pixels per image, 128 MiB private cache. Unknown MIME, SVG, arbitrary URLs and automatic Markdown image downloads are rejected. A protected file read uses only a validated file ID under the pinned saved base URL with Bearer in main and no redirects. It never performs a replacement generation.

Images appear independently of collapsed tool output. Clicking a preview opens a modal viewer with bounded zoom, fit, actual size and pan. The viewer reuses its authenticated Blob URL, keeps it alive while open, and closes when the media owner changes. It never downloads model-supplied links or requests inference. Loading and Save verify current session ownership plus ancestor history, and recheck cache integrity. Save uses the native owner-selected destination; renderer does not supply a path. Binary bytes/base64 are absent from history, event journals, snapshots and normal diagnostic logs. Reopen/retry/Save use cached bytes and no inference. Cache quota failures preserve history; export needed images before clearing private cached media.

## Evidence

Loopback protocol/Electron tests, real protected-file retrieval, live inference and packaged execution are separate results. Synthetic credentials and fixture output never certify a live endpoint. Retain private evidence outside source control. See [provider contracts](PROVIDER_EXTENSION.md) and [testing](TESTING.md).

## Grok Connector v1

Select the separate Grok Connector v1 profile with Responses to retain native questions, exact permission choices, model reasoning/context metadata and provider progress. Its file tools still execute in the local task workspace; hosted tools are explicitly bounded. See [the Grok profile contract](GROK_CONNECTOR.md) for image inputs, lifecycle, cancellation and availability limits. Existing OpenAI-compatible and Codex profiles are unchanged.
