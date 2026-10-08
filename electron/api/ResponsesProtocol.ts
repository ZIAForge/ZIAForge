import { createHash } from 'node:crypto'
import { GROK_RESPONSE_ID, GROK_STREAM_EVENTS, grokErrorDetails, grokArtifact, parseGrokEvent, type GrokEvent, type GrokArtifact } from './GrokProtocol'

export const RESPONSES_LIMITS = Object.freeze({
  textBytes: 1024 * 1024,
  argumentBytes: 300_000,
  calls: 16,
  images: 4,
  imageBytes: 32 * 1024 * 1024,
  totalImageBytes: 64 * 1024 * 1024,
  frameBytes: 48 * 1024 * 1024,
  transportBytes: 160 * 1024 * 1024,
})

export interface ResponsesFunctionCall { id: string; callId: string; name: string; arguments: string }
export interface ResponsesUsage { inputTokens: number; outputTokens: number; totalTokens: number }
export interface ResponsesHostedEvent {
  type: 'codex.tool'
  method: string
  params: Record<string, unknown>
  sequence_number: number
}
export interface ResponsesStreamOptions {
  signal: AbortSignal
  /** An optional smaller transport bound; it cannot raise the fixed media-aware limit. */
  maxResponseBytes?: number
  onText(delta: string): void | Promise<void>
  onHosted(event: ResponsesHostedEvent): void | Promise<void>
  onImage(itemId: string, base64: string): void | Promise<void>
  onResponseId(id: string): void | Promise<void>
  /** Opt-in native v1 parser; generic and Codex streams keep their existing contract. */
  onGrok?(event: GrokEvent): void | Promise<void>
  onGrokArtifacts?(artifacts: GrokArtifact[]): void | Promise<void>
}
export interface ResponsesStreamResult { id: string; text: string; calls: ResponsesFunctionCall[]; usage?: ResponsesUsage }

type ObjectValue = Record<string, unknown>
interface TextPart { text: string; done: boolean }
interface ItemState {
  id?: string
  index?: number
  order: number
  type?: 'message' | 'function_call' | 'image_generation_call'
  parts: Map<number, TextPart>
  arguments: string
  argumentsDone: boolean
  callId?: string
  name?: string
  done: boolean
}

function object(value: unknown): value is ObjectValue { return !!value && typeof value === 'object' && !Array.isArray(value) }
function invalid(): never { throw new Error('API returned an invalid Responses stream') }
function identity(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value || value.length > max || !/^[A-Za-z0-9_-]+$/.test(value)) invalid()
  return value
}
function callIdentity(value: unknown): string {
  // call_id is an opaque provider string, never a path or a locally generated ID.
  // Preserve punctuation for function_call_output and durable continuation.
  // eslint-disable-next-line no-control-regex -- Opaque IDs remain verbatim while excluding control/space characters.
  if (typeof value !== 'string' || !value || value.length > 200 || /[\u0000-\u0020\u007f]/.test(value)) invalid()
  return value
}
function nonnegative(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function imageSize(base64: string): number {
  // Check encoded length before scanning or handing a large value to a decoder.
  if (!base64 || base64.length % 4 || base64.length > Math.ceil(RESPONSES_LIMITS.imageBytes / 3) * 4) throw new Error('API image exceeds its bounded limit or has invalid base64')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) invalid()
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const size = base64.length / 4 * 3 - padding
  // Padding bits must be canonical, so equivalent encodings cannot evade deduplication.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  if (padding && alphabet.indexOf(base64[base64.length - padding - 1]) % (padding === 2 ? 16 : 4)) invalid()
  if (!size || size > RESPONSES_LIMITS.imageBytes) throw new Error('API image exceeds its bounded limit')
  return size
}

const hostedMethods = new Set(['item/started', 'item/completed', 'item/commandExecution/outputDelta', 'item/fileChange/outputDelta', 'item/mcpToolCall/progress'])
const hostedItems = new Set(['commandExecution', 'fileChange', 'webSearch', 'mcpToolCall', 'imageGeneration'])
const privateFields = new Set(['encrypted_content', 'encryptedContent', 'reasoning', 'reasoningText', 'rawReasoning', 'base64', 'b64_json', 'data'])
const streamEvents = new Set(['response.created', 'response.in_progress', 'response.output_item.added', 'response.output_item.done', 'response.output_text.delta', 'response.output_text.done', 'response.function_call_arguments.delta', 'response.function_call_arguments.done', 'response.completed', 'response.failed', 'response.incomplete', 'error', 'codex.tool'])

function hostedEnvelope(event: ObjectValue): ResponsesHostedEvent | undefined {
  if (typeof event.method !== 'string' || !hostedMethods.has(event.method)) return undefined
  if (!object(event.params) || !nonnegative(event.sequence_number)) invalid()
  const item = event.params.item
  if (event.method === 'item/started' || event.method === 'item/completed') {
    if (!object(item) || typeof item.type !== 'string' || !hostedItems.has(item.type)) return undefined
    identity(item.id)
  } else identity(event.params.itemId)
  // Only the image sink receives image bytes. Native reasoning and caller-tool
  // events are not part of this extension callback, even if the server emits them.
  let nodes = 0
  const copy = (value: unknown, depth: number, image: boolean): unknown => {
    if (++nodes > 10_000 || depth > 12) invalid()
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'number') { if (!Number.isFinite(value)) invalid(); return value }
    if (typeof value === 'string') { if (Buffer.byteLength(value) > 128 * 1024) throw new Error('API hosted-tool output exceeds its bounded limit'); return value }
    if (Array.isArray(value)) return value.map(entry => copy(entry, depth + 1, image))
    if (!object(value)) invalid()
    const isImage = image || value.type === 'imageGeneration'
    const result: ObjectValue = {}
    for (const [key, entry] of Object.entries(value)) {
      if (privateFields.has(key) || isImage && ['result', 'bytes', 'output'].includes(key)) continue
      if (key.length > 100 || ['__proto__', 'constructor', 'prototype'].includes(key)) invalid()
      result[key] = copy(entry, depth + 1, isImage)
    }
    return result
  }
  const params = copy(event.params, 0, false) as ObjectValue
  if (Buffer.byteLength(JSON.stringify(params)) > 256 * 1024) throw new Error('API hosted-tool output exceeds its bounded limit')
  return { type: 'codex.tool', method: event.method, params, sequence_number: event.sequence_number }
}

/** Consume a bounded Responses SSE stream. Hosted progress never becomes a caller function. */
export async function consumeResponsesStream(response: Response, options: ResponsesStreamOptions): Promise<ResponsesStreamResult> {
  if (options.maxResponseBytes !== undefined && (!Number.isSafeInteger(options.maxResponseBytes) || options.maxResponseBytes <= 0)) {
    await response.body?.cancel().catch(() => {})
    throw new Error('Invalid Responses transport limit')
  }
  const maxTransportBytes = Math.min(options.maxResponseBytes ?? RESPONSES_LIMITS.transportBytes, RESPONSES_LIMITS.transportBytes)
  if (options.signal.aborted) await response.body?.cancel().catch(() => {})
  options.signal.throwIfAborted()
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {})
    throw new Error(`API returned HTTP ${response.status}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const items: ItemState[] = []
  const byId = new Map<string, ItemState>(), byIndex = new Map<number, ItemState>()
  const images = new Map<string, { digest: string; bytes: number }>()
  let anonymous: ItemState | undefined, responseId = '', completed = false, usage: ResponsesUsage | undefined
  let finalText: string | undefined
  let textBytes = 0, imageBytes = 0, transportBytes = 0, hostedBytes = 0, hostedCount = 0
  let frameBytes = 0, lineParts: string[] = [], data: string[] = [], eventName = ''
  const check = () => options.signal.throwIfAborted()
  const abort = () => { void reader.cancel().catch(() => {}) }
  options.signal.addEventListener('abort', abort, { once: true })

  const state = (id: unknown, index: unknown, type: ItemState['type']): ItemState => {
    const itemId = id === undefined ? undefined : identity(id)
    if (index !== undefined && (!nonnegative(index) || index >= 128)) invalid()
    const outputIndex = index as number | undefined
    let value = itemId ? byId.get(itemId) : undefined
    const indexed = outputIndex === undefined ? undefined : byIndex.get(outputIndex)
    if (value && indexed && value !== indexed) invalid()
    value ??= indexed
    if (!value && !itemId && outputIndex === undefined && type === 'message') value = [...items].reverse().find(entry => entry.type === 'message' && !entry.done)
    if (!value && type === 'message' && anonymous && !anonymous.id) value = anonymous
    if (!value && !itemId && outputIndex === undefined && type === 'message') value = anonymous
    if (!value) {
      if (items.length >= 128) throw new Error('API output-item limit reached')
      value = { order: items.length, parts: new Map(), arguments: '', argumentsDone: false, done: false }
      items.push(value)
    }
    if (value.type && value.type !== type || value.id && itemId && value.id !== itemId || value.index !== undefined && outputIndex !== undefined && value.index !== outputIndex) invalid()
    value.type = type
    if (itemId) { value.id = itemId; byId.set(itemId, value) }
    if (outputIndex !== undefined) { value.index = outputIndex; byIndex.set(outputIndex, value) }
    if (!value.id && type === 'message') anonymous = value
    if (type === 'function_call' && items.filter(entry => entry.type === 'function_call').length > RESPONSES_LIMITS.calls) throw new Error('API tool-call limit reached')
    return value
  }
  const responseIdentity = async (value: unknown) => {
    const id = identity(value)
    if (options.onGrok && !GROK_RESPONSE_ID.test(id)) invalid()
    if (responseId && responseId !== id) invalid()
    if (!responseId) { responseId = id; await options.onResponseId(id); check() }
  }
  const text = async (item: ItemState, index: unknown, value: unknown, final: boolean) => {
    if (index !== undefined && (!nonnegative(index) || index >= 128) || typeof value !== 'string') invalid()
    const partIndex = (index as number | undefined) ?? 0
    const part = item.parts.get(partIndex) ?? { text: '', done: false }
    let delta = value
    if (final) {
      if (!value.startsWith(part.text) || part.done && part.text !== value) invalid()
      delta = value.slice(part.text.length)
    } else if (part.done) invalid()
    textBytes += Buffer.byteLength(delta)
    if (textBytes > RESPONSES_LIMITS.textBytes) throw new Error('API text exceeds its bounded limit')
    part.text += delta; part.done ||= final; item.parts.set(partIndex, part)
    if (delta) { check(); await options.onText(delta); check() }
  }
  const argumentsValue = (item: ItemState, value: unknown, final: boolean) => {
    if (typeof value !== 'string') invalid()
    if (final) {
      if (!value.startsWith(item.arguments) || item.argumentsDone && item.arguments !== value) invalid()
      item.arguments = value; item.argumentsDone = true
    } else {
      if (item.argumentsDone) invalid()
      item.arguments += value
    }
    if (Buffer.byteLength(item.arguments) > RESPONSES_LIMITS.argumentBytes) throw new Error('API tool arguments exceed their bounded limit')
  }
  const outputItem = async (value: unknown, index: unknown, final: boolean) => {
    if (!object(value) || typeof value.type !== 'string') invalid()
    if (!['message', 'function_call', 'image_generation_call'].includes(value.type)) return
    if (final && finalText !== undefined && value.type === 'message' && anonymous && !anonymous.id) {
      const content = value.content
      const samePhase = Array.isArray(content) && [...anonymous.parts].every(([partIndex, part]) => {
        const entry: unknown = content[partIndex]
        return object(entry) && entry.type === 'output_text' && typeof entry.text === 'string' && entry.text.startsWith(part.text) && (!part.done || entry.text === part.text)
      })
      if (!samePhase) {
        // Identity-free connector commentary is not the newly identified final
        // item. Keep its public deltas, but do not impose a same-item prefix on it.
        if (anonymous.index !== undefined && byIndex.get(anonymous.index) === anonymous) byIndex.delete(anonymous.index)
        anonymous = undefined
      }
    }
    const item = state(value.id, index, value.type as ItemState['type'])
    if (!item.id) invalid()
    if (final && value.status !== undefined && value.status !== 'completed') invalid()
    if (item.type === 'function_call') {
      const callId = callIdentity(value.call_id), name = identity(value.name, 100)
      if (item.callId && item.callId !== callId || item.name && item.name !== name || items.some(entry => entry !== item && entry.callId === callId)) invalid()
      item.callId = callId; item.name = name
      if (final) argumentsValue(item, value.arguments, true)
      else if (value.arguments !== undefined) {
        if (typeof value.arguments !== 'string' || !value.arguments.startsWith(item.arguments)) invalid()
        argumentsValue(item, value.arguments.slice(item.arguments.length), false)
      }
    } else if (item.type === 'message') {
      if (!Array.isArray(value.content) || value.content.length > 128) invalid()
      for (const [contentIndex, content] of value.content.entries()) {
        if (!object(content)) invalid()
        if (content.type === 'output_text') await text(item, contentIndex, content.text, final)
      }
    } else if (final) {
      if (typeof value.result !== 'string') invalid()
      const bytes = imageSize(value.result), digest = createHash('sha256').update(value.result).digest('hex')
      const previous = images.get(item.id)
      if (previous) { if (previous.digest !== digest || previous.bytes !== bytes) invalid() }
      else {
        if (images.size >= RESPONSES_LIMITS.images || imageBytes + bytes > RESPONSES_LIMITS.totalImageBytes) throw new Error('API images exceed their bounded limit')
        images.set(item.id, { digest, bytes }); imageBytes += bytes
        check(); await options.onImage(item.id, value.result); check()
      }
    }
    item.done ||= final
  }
  const dispatch = async () => {
    if (!data.length) { eventName = ''; return }
    const content = data.join('\n'), name = eventName
    data = []; eventName = ''
    if (name && !streamEvents.has(name) && !(options.onGrok && GROK_STREAM_EVENTS.has(name))) return
    if (content === '[DONE]') return
    let event: unknown
    try { event = JSON.parse(content) } catch { throw new Error('API returned invalid streaming JSON') }
    if (!object(event)) invalid()
    const type = typeof event.type === 'string' ? event.type : name
    if (name && type !== name) invalid()
    check()
    if (type === 'error' || type === 'response.failed' || type === 'response.incomplete') {
      const details = options.onGrok ? grokErrorDetails(event.response ?? event.error ?? event) : ''
      throw new Error(`API response failed or stopped before completing${details ? ` (${details})` : ''}`)
    }
    if (options.onGrok && GROK_STREAM_EVENTS.has(type)) {
      const grok = parseGrokEvent(event, responseId)
      hostedBytes += Buffer.byteLength(JSON.stringify(grok))
      if (++hostedCount > 4096 || hostedBytes > 4 * 1024 * 1024) throw new Error('Grok progress exceeds its bounded stream limit')
      await options.onGrok(grok); check()
    } else if (type === 'codex.tool') {
      const hosted = hostedEnvelope(event)
      if (hosted) {
        hostedBytes += Buffer.byteLength(JSON.stringify(hosted))
        if (++hostedCount > 4096 || hostedBytes > 4 * 1024 * 1024) throw new Error('API hosted-tool output exceeds its bounded limit')
        await options.onHosted(hosted); check()
      }
    } else if (type === 'response.created' || type === 'response.in_progress') {
      if (!object(event.response)) invalid()
      await responseIdentity(event.response.id)
      if (options.onGrok && (!object(event.response.grok) || event.response.grok.version !== 1)) invalid()
    } else if (type === 'response.output_item.added' || type === 'response.output_item.done') {
      await outputItem(event.item, event.output_index, type === 'response.output_item.done')
    } else if (type === 'response.output_text.delta' || type === 'response.output_text.done') {
      await text(state(event.item_id, event.output_index, 'message'), event.content_index, type.endsWith('.done') ? event.text : event.delta, type.endsWith('.done'))
    } else if (type === 'response.function_call_arguments.delta' || type === 'response.function_call_arguments.done') {
      identity(event.item_id)
      argumentsValue(state(event.item_id, event.output_index, 'function_call'), type.endsWith('.done') ? event.arguments : event.delta, type.endsWith('.done'))
    } else if (type === 'response.completed') {
      if (!object(event.response) || event.response.status !== 'completed' || !Array.isArray(event.response.output) || event.response.output.length > 128) invalid()
      if (event.response.error !== undefined && event.response.error !== null || event.response.incomplete_details !== undefined && event.response.incomplete_details !== null) throw new Error('API response failed or stopped before completing')
      if (event.response.output_text !== undefined) {
        if (typeof event.response.output_text !== 'string') invalid()
        if (Buffer.byteLength(event.response.output_text) > RESPONSES_LIMITS.textBytes) throw new Error('API text exceeds its bounded limit')
        // The connector's final-phase text may differ from its public commentary.
        // Return it for message.completed; emitting it as another delta would
        // append or duplicate content before the feed's authoritative replacement.
        finalText = event.response.output_text
      }
      await responseIdentity(event.response.id)
      if (options.onGrok) {
        if (!object(event.response.grok) || event.response.grok.version !== 1 || !Array.isArray(event.response.grok.artifacts) || event.response.grok.artifacts.length > RESPONSES_LIMITS.images) invalid()
        const artifacts = event.response.grok.artifacts.map(grokArtifact)
        if (new Set(artifacts.map(artifact => artifact.id)).size !== artifacts.length) invalid()
        await options.onGrokArtifacts?.(artifacts); check()
      }
      const finalIds = new Set<string>()
      for (const value of event.response.output) {
        if (!object(value) || typeof value.type !== 'string') invalid()
        if (['message', 'function_call', 'image_generation_call'].includes(value.type)) {
          const id = identity(value.id)
          if (finalIds.has(id)) invalid()
          finalIds.add(id)
        }
      }
      for (const [index, item] of event.response.output.entries()) await outputItem(item, index, true)
      if (items.some(item => item.type === 'function_call' && (!item.id || !finalIds.has(item.id) || !item.callId || !item.name || !item.argumentsDone || !item.done))) invalid()
      if (object(event.response.usage)) {
        const value = event.response.usage
        if ([value.input_tokens, value.output_tokens, value.total_tokens].every(nonnegative)) usage = { inputTokens: value.input_tokens as number, outputTokens: value.output_tokens as number, totalTokens: value.total_tokens as number }
      }
      completed = true
    }
    // Unknown extensions and all reasoning events/items are intentionally ignored.
  }
  const line = async (value: string) => {
    if (value.endsWith('\r')) value = value.slice(0, -1)
    if (!value) { frameBytes = 0; await dispatch(); return }
    if (value.startsWith(':')) return
    const colon = value.indexOf(':'), field = colon < 0 ? value : value.slice(0, colon)
    const raw = colon < 0 ? '' : value.slice(colon + 1), entry = raw.startsWith(' ') ? raw.slice(1) : raw
    if (field === 'data') data.push(entry)
    else if (field === 'event') eventName = entry
  }
  const decoded = async (value: string) => {
    let start = 0
    while (start < value.length && !completed) {
      const end = value.indexOf('\n', start), segment = value.slice(start, end < 0 ? undefined : end)
      frameBytes += Buffer.byteLength(segment) + (end < 0 ? 0 : 1)
      if (frameBytes > RESPONSES_LIMITS.frameBytes) throw new Error('API SSE frame exceeds its bounded limit')
      lineParts.push(segment)
      if (end < 0) break
      const current = lineParts.join(''); lineParts = []
      await line(current); start = end + 1
    }
  }
  try {
    while (!completed) {
      check()
      const chunk = await reader.read(); check()
      if (chunk.done) break
      transportBytes += chunk.value.byteLength
      if (transportBytes > maxTransportBytes) throw new Error('API response exceeds its bounded transport limit')
      let value: string
      try { value = decoder.decode(chunk.value, { stream: true }) } catch { invalid() }
      await decoded(value)
    }
    if (!completed) {
      let tail: string
      try { tail = decoder.decode() } catch { invalid() }
      await decoded(tail)
      if (lineParts.length) { await line(lineParts.join('')); lineParts = [] }
      await dispatch()
    }
    check()
    if (!completed || !responseId) throw new Error('API stream ended before response.completed; nothing was retried automatically')
    const ordered = [...items].sort((left, right) => (left.index ?? left.order) - (right.index ?? right.order))
    return {
      id: responseId,
      text: finalText ?? ordered.filter(item => item.type === 'message').flatMap(item => [...item.parts].sort(([left], [right]) => left - right).map(([, part]) => part.text)).join(''),
      calls: ordered.filter(item => item.type === 'function_call').map(item => ({ id: item.id!, callId: item.callId!, name: item.name!, arguments: item.arguments })),
      ...(usage ? { usage } : {}),
    }
  } finally {
    options.signal.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** A completed JSON result (including a GET poll) shares the streaming validators and callbacks. */
export async function consumeGrokResponseResult(value: unknown, options: ResponsesStreamOptions): Promise<ResponsesStreamResult> {
  if (!options.onGrok || !object(value) || !GROK_RESPONSE_ID.test(value.id as string)) throw new Error('Invalid Grok response result')
  const body = JSON.stringify({ type: 'response.completed', response: value })
  if (Buffer.byteLength(body) > RESPONSES_LIMITS.transportBytes) throw new Error('Grok result exceeds its bounded transport limit')
  return consumeResponsesStream(new Response(`data: ${body}\n\n`), options)
}
