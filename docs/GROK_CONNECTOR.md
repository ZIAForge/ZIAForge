# Grok Connector v1

Grok Connector v1 is an explicit Responses profile for a privately operated connector backed by Grok Build. It does not replace ordinary OpenAI-compatible APIs, the Codex connector, or native CLI connections. A connector account and its subscription remain under the connector owner's control.

## Connect and select a model

1. Open Connections and enter the connector's HTTPS base URL ending in `/v1`, its separate API key, and a default model ID.
2. Select **Responses** and **Grok Connector v1**. Save the connection, then inspect its capabilities and model catalog.
3. Choose an advertised model and reasoning effort. Provider default omits an explicit effort. Context window choices come from the model catalog; the server must accept the value for the selected model. The optional native turn limit is 1–100.
4. Select the connection in the chat configuration and click Apply. Saving connection settings alone does not change an existing conversation. The chat header reports the profile pinned to that run.

Keys stay in the main process and supported OS credential storage. An unchanged endpoint with an empty key field retains its key. A changed endpoint requires re-entering or clearing the key. Normal TLS checks remain enabled; redirects and credential-bearing URLs are refused.

## Local work and provider tools

Every request and continuation carries the backend-selected task directory as `grok.clientWorkspace`. This is contextual information for the server, not permission to access the computer. Workspace file functions execute locally with their existing path checks. File writes and supported local commands still require a separate owner decision. Local commands are currently supported on macOS and Linux, not Windows; they use ordinary account permissions and are not an OS sandbox.

The Grok profile explicitly limits provider tools to supported web retrieval, image generation/editing, questions and capability-gated video generation. It does not enable the server terminal, filesystem, scheduler or subagents as substitutes for local project tools. Read-only review removes all image/video generation/editing and interactive questions from that provider allowlist and keeps local writes/commands unavailable. Tool-free Help or report-only architect sessions refuse this profile rather than quietly enabling hosted tools.

Provider activity is labelled separately from local functions. An observed `grok.tool` event is never executed as a local command. Hidden reasoning and raw internal thought events are not displayed.

## Questions and permissions

A native question appears as an interactive card with the exact question text and offered labels. Choose one or multiple options as requested, or enter a custom answer. Sending an answer continues the same native turn. Cancellation is a distinct action. Plan interviews can also offer explicit actions to discuss the plan or skip the interview. These actions do not grant tool permissions.

A provider permission card instead shows the exact native choices. By default, the owner selects and submits each choice manually. A choice that permits future actions has different scope from a one-time choice; read the native label before submitting it. Local file or command approvals remain separate cards.

In Connections, **Automatically approve one-time provider permissions** is an optional Grok setting (`GrokConnectionOptions.autoApproveNativePermissions`, default `false`). It is pinned to the chat run: saving the connection does not alter active chats. Start a new chat or explicitly reconfigure the existing chat with **Apply** to use the saved setting. In an eligible live, writable session, ZIAForge selects the exact offered `optionId` only when there is exactly one unexpired native `allow_once` choice. Multiple or missing one-time choices remain manual; `allow_always` is never selected automatically. Read-only sessions do not auto-approve provider permissions. Questions and local file/command approvals still require the owner's answer.

The automatic decision and its provenance are recorded durably before the native approval POST. The card identifies an automatic approval. A replayed or historical event cannot trigger automatic submission; expiry, Stop and uncertain delivery do not grant retries. This setting does not change the provider tool allowlist or authorize local tool execution.

Answers are bound to the current session, run, turn and interaction ID. The application records the submission before posting it, and never automatically repeats an uncertain answer. Expired, resolved and historical cards cannot submit actions. Stop cancels the current turn and expires its interaction cards; cancellation acknowledgement and confirmed remote completion are separate states. A lost connection or application restart does not revive an old native question.

## Images

Use the chat attachment button to choose PNG, JPEG or WebP images in the system file dialog. Selection makes a private copy scoped to the current chat run. The renderer receives opaque attachment IDs and safe metadata, never arbitrary filesystem access. Limits are four pending images, 16 MiB per image, 20 MiB combined and 32 million pixels per image. Input copies have a separate 128 MiB storage budget.

Images are sent as `input_image` data only after the owner sends the message. Failed or uncertain delivery preserves the same draft identities for inspection/retry. Image messages are not placed in the text-only message queue. Remove unsent images before changing or resuming the run; they are not silently transferred to a different model or connection.

Accepted input images and generated raster images use the existing private image cards, Save image and zoom viewer. Accepted input images remain in the history cache after the separate pending draft is discarded. The standard `image_generation_call` is the single image delivery path; the accompanying Grok artifact observation must not create duplicate cards. Opening or saving a cached image does not generate it again.

## Videos

Ask for a video in a writable Grok chat and describe the motion, reference image and desired parameters. Attach a PNG, JPEG or WebP reference with the normal image picker, or continue the conversation that produced an image and identify that image in your request. To choose an older image explicitly, use **Save image** and attach the saved file to the new message. Reopening, viewing or saving that image does not regenerate it. There is no separate video-parameter form in ZIAForge: the conversation uses `/responses`, with native questions and permission cards where the provider requires them.

Before each new writable user turn, the client reads `/grok/capabilities` with a bounded timeout. It adds only advertised `image_to_video` and/or `reference_to_video` tools when `media.video.available`, `enabled` and `verified` are all true. A failed check leaves video tools unavailable for that turn; normal text/image work can continue. Read-only sessions never enable these tools. The chosen definitions stay fixed throughout caller-tool continuations. When capabilities change between user turns, ZIAForge starts a fresh native context with the visible chat history and eligible cached raster references, preserving the local conversation. It does not replay interrupted operations. Images omitted by attachment limits are reported; attach the intended reference explicitly if needed.

The connector's video modes have different parameters. `image_to_video` requires an image and supports 6 or 10 seconds at a `480p` or `720p` preset. `reference_to_video` supports 1–15 seconds and aspect ratios `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2` or `2:3`. If a reference has not been supplied, the agent may need to generate an image first. This is not a separate verified text-to-video tool. Explain your requirements in chat; the selected native tool and provider determine what can be fulfilled. Resolution labels are provider presets, not a guarantee of exact pixel height, and the container duration may differ by a frame. These supported contract options do not certify every model, duration or artistic result.

The connector also offers its own dedicated `/grok/media` API. ZIAForge's chat does not call that endpoint or expose its `auto` mode as a separate setting. Dedicated media endpoint validation and parameter-mismatch guarantees must not be inferred for a conversational `/responses` request. Audio generation, transcription and realtime voice are not available through this client profile; an MP4 may nevertheless contain its normal audio track.

A usable result must be a version 1 `grok.artifact` or final `response.grok.artifacts[]` entry with a video file ID, `video/mp4`, byte count and SHA-256. The main process constructs `/files/{id}/content` under the pinned connection base URL, attaches its saved Bearer credential, refuses redirects, and verifies MIME, exact size and digest before caching the file. Model-supplied storage URLs, HTML and textual claims are not downloaded or treated as a video. Repeated streamed/final metadata yields one media card. Failed retrieval, invalid MP4 or an artifact error is visible; it does not trigger replacement generation or an image fallback.

Videos have native play, pause, seek and volume controls, do not autoplay, and use a local Blob URL after download. **Save video** opens the system destination dialog and writes the cached MP4. A full application Quit/restart preserves the media reference and local bytes; playing or saving an existing card does not request inference or re-download the provider file. Playback still depends on the Electron/operating-system decoder supporting the MP4's codecs. Unsupported media shows an error instead of a working-player claim.

The limit is 128 MiB per MP4, with MP4 structure/dimension checks and a shared 512 MiB private media cache for accepted images and generated image/video results. Raster limits remain 32 MiB and 32 million pixels; pending input-image copies keep their separate 128 MiB budget. Cache quota or integrity failures preserve chat history and report the unavailable media. Save needed files before manually clearing private cached media. Journals and snapshots contain references, not video bytes, local paths, credentials or Blob URLs.

## Discovery and current limitations

The inspector reports the provider's versioned capability document and advertised models. It distinguishes discovery from verified deployment availability. A listed tool alone does not certify that it works. Video needs the enabled, verified deployment capabilities and actual native tool names described above. Availability, privacy/output storage and quotas remain the connector owner's responsibility. Unsupported or unavailable modes remain visible limitations; ZIAForge does not silently change provider, configure server storage or install plugins.

Usage fields remain unknown when absent. The usage period end is not a payment date or subscription expiration. Do not infer a zero charge, unused quota or unlimited requests from missing values. Capability/model/usage inspection performs authenticated reads and does not run a model.

## Protocol and lifecycle

- Standard Responses handles text, `function_call`, exact `function_call_output` IDs, images and reported usage. All caller results for a round are returned together.
- Each continuation retains instructions, tool definitions, native profile options and `previous_response_id`. An unfinished transaction with uncertain effects is not replayed after restart.
- Only version 1 of the explicitly selected `grok.*` extension can create actionable cards. Response identities, sequences, bounds and interaction state are checked before publication or reply.
- `grok.approval` is answered through `/grok/approvals/{id}` with an offered `optionId`. `grok.question` is answered through `/grok/questions/{id}` using exact question texts and labels. Free answers use the reserved `Other` label plus notes; neither request can choose another URL or expose the credential to the renderer.
- Stop uses the pinned connector's `/responses/{id}/cancel` for the owned response. Failures are surfaced without a hidden retry or provider switch.
- Model rejection, queue saturation, expired native turns and unsupported capabilities remain errors. A failed POST is not automatically repeated when it may have performed an action.

See [API connections](API_CONNECTIONS.md), [agent runtime](PROJECT_MAP.md) and [testing](TESTING.md). Unit fixtures, current-build UI checks, live inference and native packaged execution are separate evidence categories.
