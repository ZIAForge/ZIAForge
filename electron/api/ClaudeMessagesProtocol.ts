import { createHash } from 'node:crypto'
import type { ClaudeApprovalRequest, ClaudeQuestionRequest } from '../../shared/claude-interactions'

export const CLAUDE_RESPONSE_ID = /^resp_[a-f0-9]{32}$/
export const CLAUDE_FILE_ID = /^file_[a-f0-9]{32}$/
export const CLAUDE_LIMITS = Object.freeze({ transportBytes: 16 * 1024 * 1024, frameBytes: 2 * 1024 * 1024, contentBytes: 8 * 1024 * 1024, blocks: 256, calls: 16, artifactBytes: 128 * 1024 * 1024, artifacts: 32 })
export type ClaudeTerminalErrorCode = 'max_output_tokens' | 'native_timeout'
/** Only reviewed machine codes cross into the UI; provider error bodies remain private. */
export class ClaudeTerminalError extends Error {
  constructor(readonly code: ClaudeTerminalErrorCode, readonly responseId?: string) {
    super(code === 'max_output_tokens' ? 'Claude reached the model output token limit (max_output_tokens); partial output was not committed. Increase the connection output-token limit before starting a new conversation.' : 'Claude exceeded its native turn deadline (native_timeout); partial output was not committed.')
    this.name = 'ClaudeTerminalError'
  }
}
export interface ClaudeArtifactMetadata { id: string; kind: 'image' | 'video' | 'audio' | 'file'; filename: string; mime_type: string; bytes: number; sha256: string; api_url: string; revision?: number; supersedes_file_id?: string }
export type ClaudeContent = { type: 'text'; text: string; citations?: unknown[] } | { type: 'thinking'; thinking: string; signature?: string } | { type: 'redacted_thinking'; data: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
export type ClaudeExtension =
  | { type: 'claude.tool'; responseId: string; tool: { id: string; name: string; status: string; input?: unknown; output?: unknown } }
  | { type: 'claude.approval'; responseId: string; id: string; request: ClaudeApprovalRequest; expiresIn: number }
  | { type: 'claude.question'; responseId: string; id: string; request: ClaudeQuestionRequest }
  | { type: 'claude.artifact'; responseId: string; artifact: ClaudeArtifactMetadata }
export interface ClaudeMessageResult { id: string; responseId: string; content: ClaudeContent[]; text: string; stopReason: string; calls: Array<Extract<ClaudeContent, { type: 'tool_use' }>>; usage: { inputTokens: number; outputTokens: number; totalTokens: number }; artifacts: ClaudeArtifactMetadata[] }
export interface ClaudeStreamOptions { signal: AbortSignal; maxResponseBytes?: number; onText(text: string): void | Promise<void>; onThinking(text: string): void | Promise<void>; onResponseId(id: string): void | Promise<void>; onExtension(event: ClaudeExtension): void | Promise<void> }
export const claudeObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
function invalid(): never { throw new Error('Claude returned an invalid Messages protocol envelope') }
function parseJson(value: string): unknown { try { return JSON.parse(value) as unknown } catch { return invalid() } }
function string(value: unknown, max = 200, empty = false): string { if (typeof value !== 'string' || (!empty && !value) || value.length > max || value.includes('\0')) invalid(); return value }
function identity(value: unknown): string { const result = string(value); if (/[\s\u007f]/u.test(result) || [...result].some(char => char.charCodeAt(0) < 32)) invalid(); return result }
const number = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
function responseId(value: unknown): string { const id = string(value); if (!CLAUDE_RESPONSE_ID.test(id)) invalid(); return id }
export function claudeArtifact(value: unknown): ClaudeArtifactMetadata {
  if (!claudeObject(value)) invalid()
  const id = string(value.id), filename = string(value.filename, 160), mime = string(value.mime_type, 128)
  if (!CLAUDE_FILE_ID.test(id) || !['image', 'video', 'audio', 'file'].includes(value.kind as string) || /[/\\]/.test(filename) || filename === '.' || filename === '..' || [...filename].some(c => c.charCodeAt(0) < 32) || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) || !number(value.bytes) || value.bytes > CLAUDE_LIMITS.artifactBytes || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256) || value.api_url !== `/v1/files/${id}/content` || value.revision !== undefined && (!number(value.revision) || value.revision < 1) || value.supersedes_file_id !== undefined && (typeof value.supersedes_file_id !== 'string' || !CLAUDE_FILE_ID.test(value.supersedes_file_id) || value.supersedes_file_id === id)) invalid()
  return { id, kind: value.kind as ClaudeArtifactMetadata['kind'], filename, mime_type: mime, bytes: value.bytes, sha256: value.sha256, api_url: value.api_url, ...(value.revision !== undefined ? { revision: value.revision as number } : {}), ...(value.supersedes_file_id ? { supersedes_file_id: value.supersedes_file_id as string } : {}) }
}
/** No signatures, opaque reasoning or executable artifacts enter provider activity records. */
export function claudePublicValue(value: unknown): unknown {
  let nodes = 0
  const copy = (item: unknown, depth: number): unknown => {
    if (++nodes > 10_000 || depth > 12) invalid()
    if (item === undefined || item === null || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item)) return item
    if (typeof item === 'string') return string(item, 256 * 1024, true)
    if (Array.isArray(item)) return item.map(child => copy(child, depth + 1))
    if (!claudeObject(item)) invalid()
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) invalid()
      if (['thinking', 'signature', 'redacted_thinking', 'encrypted_content', 'base64', 'data'].includes(key)) continue
      result[key] = copy(child, depth + 1)
    }
    return result
  }
  const result = copy(value, 0)
  if (JSON.stringify(result ?? null).length > 512 * 1024) invalid()
  return result
}
function extension(value: Record<string, unknown>): ClaudeExtension | undefined {
  if (value.version !== 1) invalid()
  const id = responseId(value.response_id)
  if (value.type === 'claude.message') return undefined // Standard blocks are the sole text/thinking authority.
  if (value.type === 'claude.artifact.error') throw new Error('Claude could not validate its native artifact')
  if (value.type === 'claude.artifact') return { type: value.type, responseId: id, artifact: claudeArtifact(value.artifact) }
  if (value.type === 'claude.tool') {
    const tool = value.tool
    if (!claudeObject(tool) || !['in_progress', 'completed', 'failed', 'cancelled', 'error'].includes(tool.status as string)) invalid()
    return { type: value.type, responseId: id, tool: { id: identity(tool.id), name: string(tool.name, 150), status: tool.status as string, ...(tool.input !== undefined ? { input: claudePublicValue(tool.input) } : {}), ...(tool.output !== undefined ? { output: claudePublicValue(tool.output) } : {}) } }
  }
  if (value.type === 'claude.approval') {
    const item = value.approval
    if (!claudeObject(item) || !claudeObject(item.request) || !/^approval_[a-f0-9]{32}$/.test(string(item.id))) invalid()
    const request = item.request
    string(request.toolName, 150)
    if (request.description !== undefined) string(request.description, 16_384, true)
    if (request.defaultToNo !== undefined && typeof request.defaultToNo !== 'boolean' || request.suppressAlwaysAllowRule !== undefined && typeof request.suppressAlwaysAllowRule !== 'boolean') invalid()
    const expiresIn = item.expires_in ?? 120
    if (!number(expiresIn) || expiresIn < 1 || expiresIn > 120) invalid()
    return { type: value.type, responseId: id, id: item.id as string, request: claudePublicValue(request) as ClaudeApprovalRequest, expiresIn }
  }
  if (value.type === 'claude.question') {
    const item = value.question
    if (!claudeObject(item) || !claudeObject(item.request) || !/^question_[a-f0-9]{32}$/.test(string(item.id))) invalid()
    const request = item.request
    if (!Array.isArray(request.questions) || !request.questions.length || request.questions.length > 32) invalid()
    const texts = new Set<string>()
    for (const question of request.questions) {
      if (!claudeObject(question)) invalid()
      const text = string(question.question, 16_384)
      if (texts.has(text)) invalid(); texts.add(text)
      if (question.header !== undefined) string(question.header, 200)
      if (question.multiSelect !== undefined && typeof question.multiSelect !== 'boolean' || !Array.isArray(question.options) || question.options.length > 32) invalid()
      for (const option of question.options) { if (!claudeObject(option)) invalid(); string(option.label, 4096); if (option.description !== undefined) string(option.description, 16_384, true) }
    }
    return { type: value.type, responseId: id, id: item.id as string, request: claudePublicValue(request) as unknown as ClaudeQuestionRequest }
  }
  // Versioned status, task, subagent and rate-limit observations confer no authority.
  return undefined
}

export async function readClaudeJson(response: Response, maxBytes = 1024 * 1024): Promise<unknown> {
  if (!response.body) throw new Error(`Claude returned HTTP ${response.status} without a body`)
  const reader = response.body.getReader(), chunks: Buffer[] = []; let bytes = 0
  try { for (;;) { const item = await reader.read(); if (item.done) break; bytes += item.value.byteLength; if (bytes > maxBytes) throw new Error('Claude JSON response exceeds its limit'); chunks.push(Buffer.from(item.value)) } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  return parseJson(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
}

/** Complete one consolidated Anthropic message; partial streams never authorize caller tools. */
export async function consumeClaudeMessagesStream(response: Response, options: ClaudeStreamOptions): Promise<ClaudeMessageResult> {
  if (!response.ok || !response.body || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')) { await response.body?.cancel(); throw new Error(`Claude Messages stream unavailable (HTTP ${response.status})`) }
  const max = Math.min(options.maxResponseBytes ?? CLAUDE_LIMITS.transportBytes, CLAUDE_LIMITS.transportBytes)
  if (!Number.isSafeInteger(max) || max < 1) { await response.body.cancel(); throw new Error('Invalid Claude stream limit') }
  const blocks: Array<{ content: ClaudeContent; done: boolean; json: string }> = []
  let id = '', rid = '', stopReason = '', started = false, deltaSeen = false, ended = false, buffer = '', bytes = 0, contentBytes = 0, inputTokens = 0, outputTokens = 0
  const artifacts = new Map<string, ClaudeArtifactMetadata>()
  const addArtifact = (artifact: ClaudeArtifactMetadata) => { if (artifacts.has(artifact.id) && JSON.stringify(artifacts.get(artifact.id)) !== JSON.stringify(artifact)) invalid(); artifacts.set(artifact.id, artifact); if (artifacts.size > CLAUDE_LIMITS.artifacts) invalid() }
  const bindId = async (next: string) => { if (rid && rid !== next) invalid(); if (!rid) { rid = next; await options.onResponseId(next) } }
  const frame = async (raw: string) => {
    if (Buffer.byteLength(raw) > CLAUDE_LIMITS.frameBytes) invalid()
    let name = ''; const data: string[] = []
    for (const line of raw.split('\n')) { if (line.startsWith('event:')) name = line.slice(6).trim(); else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, '')) }
    if (!data.length) return
    const value = parseJson(data.join('\n'))
    if (!claudeObject(value) || typeof value.type !== 'string' || name && name !== value.type || ended) invalid()
    if (value.type === 'ping') return
    if (value.type === 'error') {
      if (claudeObject(value.error) && (value.error.code === 'max_output_tokens' || value.error.code === 'native_timeout')) throw new ClaudeTerminalError(value.error.code, rid || undefined)
      throw new Error('Claude reported a terminal Messages stream error; partial output was not committed')
    }
    if (value.type.startsWith('claude.')) {
      if (!started) invalid()
      await bindId(responseId(value.response_id))
      const event = extension(value)
      if (event) { await bindId(event.responseId); if (event.type === 'claude.artifact') addArtifact(event.artifact); await options.onExtension(event) }
      return
    }
    if (value.type === 'message_start') {
      if (started || !claudeObject(value.message) || value.message.type !== 'message' || value.message.role !== 'assistant' || !Array.isArray(value.message.content) || value.message.content.length) invalid()
      id = identity(value.message.id); if (!/^msg_[a-f0-9]{32}$/.test(id)) invalid()
      if (!claudeObject(value.message.usage) || !number(value.message.usage.input_tokens) || !number(value.message.usage.output_tokens)) invalid()
      inputTokens = value.message.usage.input_tokens; outputTokens = value.message.usage.output_tokens
      await bindId(id.replace(/^msg_/, 'resp_')); started = true; return
    }
    if (!started) invalid()
    if (value.type === 'content_block_start') {
      if (deltaSeen || value.index !== blocks.length || blocks.length >= CLAUDE_LIMITS.blocks || blocks.some(block => !block.done) || !claudeObject(value.content_block)) invalid()
      const part = value.content_block; let content: ClaudeContent
      if (part.type === 'text') {
        if (part.citations !== undefined && (!Array.isArray(part.citations) || part.citations.length > 128 || Buffer.byteLength(JSON.stringify(part.citations)) > 256 * 1024)) invalid()
        content = { type: 'text', text: string(part.text, CLAUDE_LIMITS.contentBytes, true), ...(part.citations !== undefined ? { citations: part.citations as unknown[] } : {}) }
      }
      else if (part.type === 'thinking') content = { type: 'thinking', thinking: string(part.thinking, CLAUDE_LIMITS.contentBytes, true), ...(part.signature !== undefined ? { signature: string(part.signature, CLAUDE_LIMITS.frameBytes, true) } : {}) }
      else if (part.type === 'redacted_thinking') content = { type: 'redacted_thinking', data: string(part.data, CLAUDE_LIMITS.frameBytes) }
      else if (part.type === 'tool_use') { if (!claudeObject(part.input)) invalid(); content = { type: 'tool_use', id: identity(part.id), name: string(part.name, 64), input: part.input } }
      else invalid()
      contentBytes += Buffer.byteLength(JSON.stringify(content)); if (contentBytes > CLAUDE_LIMITS.contentBytes) invalid()
      blocks.push({ content, done: false, json: '' })
      if (content.type === 'text' && content.text) await options.onText(content.text)
      if (content.type === 'thinking' && content.thinking) await options.onThinking(content.thinking)
      return
    }
    if (value.type === 'content_block_delta') {
      if (deltaSeen || !number(value.index) || !blocks[value.index] || blocks[value.index].done || !claudeObject(value.delta)) invalid()
      const block = blocks[value.index], part = block.content, delta = value.delta
      if (delta.type === 'text_delta' && part.type === 'text') { const text = string(delta.text, CLAUDE_LIMITS.frameBytes, true); part.text += text; await options.onText(text) }
      else if (delta.type === 'thinking_delta' && part.type === 'thinking') { const text = string(delta.thinking, CLAUDE_LIMITS.frameBytes, true); part.thinking += text; await options.onThinking(text) }
      else if (delta.type === 'signature_delta' && part.type === 'thinking') part.signature = (part.signature ?? '') + string(delta.signature, CLAUDE_LIMITS.frameBytes, true)
      else if (delta.type === 'input_json_delta' && part.type === 'tool_use') { block.json += string(delta.partial_json, 300_000, true); if (block.json.length > 300_000) invalid() }
      else invalid()
      contentBytes += Buffer.byteLength(JSON.stringify(delta)); if (contentBytes > CLAUDE_LIMITS.contentBytes) invalid(); return
    }
    if (value.type === 'content_block_stop') {
      if (deltaSeen || !number(value.index) || !blocks[value.index] || blocks[value.index].done) invalid()
      const block = blocks[value.index]
      if (block.content.type === 'tool_use' && block.json) { const input = parseJson(block.json); if (!claudeObject(input)) invalid(); block.content.input = input }
      block.done = true; return
    }
    if (value.type === 'message_delta') {
      if (deltaSeen || blocks.some(block => !block.done) || !claudeObject(value.delta) || !claudeObject(value.usage) || (value.usage.input_tokens !== undefined && !number(value.usage.input_tokens)) || !number(value.usage.output_tokens)) invalid()
      stopReason = string(value.delta.stop_reason, 64); if (value.usage.input_tokens !== undefined) inputTokens = value.usage.input_tokens as number; outputTokens = value.usage.output_tokens; if (!Number.isSafeInteger(inputTokens + outputTokens)) invalid(); deltaSeen = true; return
    }
    if (value.type === 'message_stop') {
      if (!deltaSeen || !claudeObject(value.claude) || value.claude.version !== 1) invalid()
      await bindId(responseId(value.claude.response_id))
      if (!Array.isArray(value.claude.artifacts) || value.claude.artifacts.length > CLAUDE_LIMITS.artifacts) invalid()
      for (const valueArtifact of value.claude.artifacts) addArtifact(claudeArtifact(valueArtifact))
      ended = true; return
    }
    invalid()
  }
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }), abort = () => { void reader.cancel().catch(() => {}) }
  options.signal.addEventListener('abort', abort, { once: true })
  try {
    options.signal.throwIfAborted()
    for (;;) {
      const next = await reader.read(); options.signal.throwIfAborted(); if (next.done) break
      bytes += next.value.byteLength; if (bytes > max) throw new Error('Claude stream exceeds its bounded limit')
      buffer += decoder.decode(next.value, { stream: true }); buffer = buffer.replace(/\r\n/g, '\n')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) { const raw = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2); await frame(raw) }
      if (Buffer.byteLength(buffer) > CLAUDE_LIMITS.frameBytes) invalid()
    }
    buffer += decoder.decode(); if (buffer.trim()) await frame(buffer)
    if (!ended || !rid) invalid()
    const content = blocks.map(block => block.content), calls = content.filter((part): part is Extract<ClaudeContent, { type: 'tool_use' }> => part.type === 'tool_use')
    if (stopReason === 'max_tokens') throw new ClaudeTerminalError('max_output_tokens', rid)
    if (calls.length > CLAUDE_LIMITS.calls || new Set(calls.map(call => call.id)).size !== calls.length || (calls.length > 0) !== (stopReason === 'tool_use') || !['end_turn', 'tool_use', 'stop_sequence'].includes(stopReason)) throw new Error('Claude Messages result is incomplete or has inconsistent tool calls')
    return { id, responseId: rid, content, text: content.filter((part): part is Extract<ClaudeContent, { type: 'text' }> => part.type === 'text').map(part => part.text).join(''), stopReason, calls, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }, artifacts: [...artifacts.values()] }
  } finally { options.signal.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock() }
}

/** Only exact authenticated file routes on the configured connector; never a model URL. */
export async function downloadClaudeArtifact(origin: string, artifact: ClaudeArtifactMetadata, apiKey: string | undefined, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Buffer> {
  const safe = claudeArtifact(artifact), url = new URL(safe.api_url, origin)
  if (url.origin !== new URL(origin).origin || url.pathname !== `/v1/files/${safe.id}/content` || url.search || url.hash) throw new Error('Invalid Claude artifact origin')
  const response = await fetcher(url, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, signal, redirect: 'error' })
  if (!response.ok || !response.body || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== safe.mime_type || response.headers.has('content-length') && Number(response.headers.get('content-length')) !== safe.bytes) { await response.body?.cancel(); throw new Error('Claude artifact download metadata mismatch') }
  const reader = response.body.getReader(), chunks: Buffer[] = []; let bytes = 0
  try { for (;;) { const item = await reader.read(); signal.throwIfAborted(); if (item.done) break; bytes += item.value.byteLength; if (bytes > safe.bytes || bytes > CLAUDE_LIMITS.artifactBytes) throw new Error('Claude artifact exceeded its declared size'); chunks.push(Buffer.from(item.value)) } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const result = Buffer.concat(chunks)
  if (bytes !== safe.bytes || createHash('sha256').update(result).digest('hex') !== safe.sha256) throw new Error('Claude artifact integrity mismatch')
  return result
}
