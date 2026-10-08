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

The Grok profile explicitly limits provider tools to supported web retrieval, image generation/editing and questions. It does not enable the server terminal, filesystem, scheduler or subagents as substitutes for local project tools. Read-only review removes image generation/editing and interactive questions from that provider allowlist and keeps local writes/commands unavailable. Tool-free Help or report-only architect sessions refuse this profile rather than quietly enabling hosted tools.

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

## Discovery and current limitations

The inspector reports the provider's versioned capability document and advertised models. It distinguishes discovery from verified deployment availability. A listed tool alone does not certify that it works. Video generation requires the connector to report verified and enabled availability; the currently evaluated deployment reports a privacy/output-storage restriction and no usable video result. This client does not offer video generation or playback. There is no supported audio contract in this profile.

Usage fields remain unknown when absent. The usage period end is not a payment date or subscription expiration. Do not infer a zero charge, unused quota or unlimited requests from missing values. Capability/model/usage inspection performs authenticated reads and does not run a model.

## Protocol and lifecycle

- Standard Responses handles text, `function_call`, exact `function_call_output` IDs, images and reported usage. All caller results for a round are returned together.
- Each continuation retains instructions, tool definitions, native profile options and `previous_response_id`. An unfinished transaction with uncertain effects is not replayed after restart.
- Only version 1 of the explicitly selected `grok.*` extension can create actionable cards. Response identities, sequences, bounds and interaction state are checked before publication or reply.
- `grok.approval` is answered through `/grok/approvals/{id}` with an offered `optionId`. `grok.question` is answered through `/grok/questions/{id}` using exact question texts and labels. Free answers use the reserved `Other` label plus notes; neither request can choose another URL or expose the credential to the renderer.
- Stop uses the pinned connector's `/responses/{id}/cancel` for the owned response. Failures are surfaced without a hidden retry or provider switch.
- Model rejection, queue saturation, expired native turns and unsupported capabilities remain errors. A failed POST is not automatically repeated when it may have performed an action.

See [API connections](API_CONNECTIONS.md), [agent runtime](PROJECT_MAP.md) and [testing](TESTING.md). Unit fixtures, current-build UI checks, live inference and native packaged execution are separate evidence categories.
