import { MAX_VIDEO_BYTES } from '../../shared/agent-media'
import type { GrokApprovalRequest, GrokInteraction, GrokQuestionRequest } from '../../shared/grok-interactions'

export interface GrokImageArtifact {
  id: string
  kind: 'image'
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  bytes: number
  sha256: string
}
export interface GrokVideoArtifact { id: string; kind: 'video'; mime: 'video/mp4'; bytes: number; sha256: string }
export type GrokArtifact = GrokImageArtifact | GrokVideoArtifact
export type GrokEvent =
  | { type: 'grok.tool'; responseId: string; sequence: number; tool: { id: string; name: string; status: string; input?: unknown; output?: unknown } }
  | { type: 'grok.artifact'; responseId: string; sequence: number; artifact: GrokArtifact }
  | { type: 'grok.approval' | 'grok.question'; responseId: string; sequence: number; interaction: GrokInteraction }
  | { type: 'grok.status'; responseId: string; sequence: number; status: string }

export const GROK_STREAM_EVENTS = new Set(['grok.tool', 'grok.artifact', 'grok.artifact.error', 'grok.approval', 'grok.question', 'grok.status'])
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
function invalid(): never { throw new Error('Grok Connector returned an invalid v1 event') }
const string = (value: unknown, max = 256, empty = false): string => {
  if (typeof value !== 'string' || value.length > max || !empty && !value || value.includes('\0')) invalid()
  return value as string
}
const identifier = (value: unknown, pattern: RegExp): string => { const id = string(value); if (!pattern.test(id)) invalid(); return id }
export const GROK_RESPONSE_ID = /^resp_[a-f0-9]{32}$/
const sensitive = /^(?:access.?token|refresh.?token|api.?key|password|authorization|secret|encrypted.?content|reasoning|reasoningText|rawReasoning|base64|b64_json|data)$/i

/** Observation-only public JSON; never raw reasoning, credentials or inline media. */
function publicValue(value: unknown): unknown {
  let count = 0
  const copy = (input: unknown, depth: number): unknown => {
    if (++count > 10_000 || depth > 12) invalid()
    if (input === undefined || input === null) return null
    if (typeof input === 'boolean') return input
    if (typeof input === 'number') { if (!Number.isFinite(input)) invalid(); return input }
    if (typeof input === 'string') {
      if (Buffer.byteLength(input) > 65_536) invalid()
      return input.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/(?:xai-|sk-)[A-Za-z0-9_-]{16,}/g, '[redacted]')
    }
    if (Array.isArray(input)) { if (input.length > 1024) invalid(); return input.map(entry => copy(entry, depth + 1)) }
    if (!object(input)) invalid()
    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(input)) {
      if (key.length > 100 || ['__proto__', 'constructor', 'prototype'].includes(key)) invalid()
      if (!sensitive.test(key)) result[key] = copy(entry, depth + 1)
    }
    return result
  }
  const result = copy(value, 0)
  if (Buffer.byteLength(JSON.stringify(result)) > 262_144) invalid()
  return result
}

function approvalRequest(value: unknown): GrokApprovalRequest {
  if (!object(value) || !object(value.toolCall) || !Array.isArray(value.options) || !value.options.length || value.options.length > 32) invalid()
  const tool = value.toolCall as Record<string, unknown>
  const options = (value.options as unknown[]).map(option => {
    if (!object(option) || !['allow_once', 'allow_always', 'reject_once', 'reject_always'].includes(option.kind as string)) invalid()
    return { optionId: string(option.optionId), name: string(option.name, 4096), kind: option.kind as GrokApprovalRequest['options'][number]['kind'] }
  })
  if (new Set(options.map(option => option.optionId)).size !== options.length) invalid()
  return {
    sessionId: string(value.sessionId),
    toolCall: { toolCallId: string(tool.toolCallId), ...(tool.title !== undefined ? { title: string(tool.title, 16_384) } : {}), ...(tool.kind !== undefined ? { kind: string(tool.kind, 100) } : {}), ...(tool.status !== undefined ? { status: string(tool.status, 100) } : {}), ...(tool.rawInput !== undefined ? { rawInput: publicValue(tool.rawInput) } : {}), ...(tool.content !== undefined ? { content: publicValue(tool.content) } : {}) },
    options,
    ...(value.threadId !== undefined ? { threadId: string(value.threadId) } : {}),
  }
}
function questionRequest(value: unknown): GrokQuestionRequest {
  if (!object(value) || !['default', 'plan'].includes(value.mode as string) || !Array.isArray(value.questions) || !value.questions.length || value.questions.length > 32 || Buffer.byteLength(JSON.stringify(value)) > 262_144) invalid()
  const questions = (value.questions as unknown[]).map(question => {
    if (!object(question) || !Array.isArray(question.options) || question.options.length > 32 || question.multiSelect !== undefined && typeof question.multiSelect !== 'boolean') invalid()
    const options = (question.options as unknown[]).map(option => {
      if (!object(option)) invalid()
      return { label: string(option.label, 4096), description: string(option.description, 16_384, true), ...(option.preview !== undefined ? { preview: string(option.preview, 65_536, true) } : {}), ...(option.id !== undefined ? { id: string(option.id) } : {}) }
    })
    if (new Set(options.map(option => option.label)).size !== options.length) invalid()
    return { question: string(question.question, 16_384), options, multiSelect: question.multiSelect === true, ...(question.id !== undefined ? { id: string(question.id) } : {}) }
  })
  if (new Set(questions.map(question => question.question)).size !== questions.length) invalid()
  if (value.expiresAt !== undefined && (typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)))) invalid()
  return { sessionId: string(value.sessionId), toolCallId: string(value.toolCallId), mode: value.mode as 'default' | 'plan', questions, ...(value.expiresAt !== undefined ? { expiresAt: string(value.expiresAt, 80) } : {}), ...(value.threadId !== undefined ? { threadId: string(value.threadId) } : {}), ...(value.turnId !== undefined ? { turnId: string(value.turnId) } : {}) }
}
export function grokImageArtifact(value: unknown): GrokImageArtifact {
  if (!object(value) || value.object !== 'file' || value.kind !== 'image' || !['image/png', 'image/jpeg', 'image/webp'].includes(value.mime_type as string) || !Number.isSafeInteger(value.bytes) || (value.bytes as number) <= 0 || (value.bytes as number) > 16 * 1024 * 1024) invalid()
  const id = identifier(value.id, /^file_[a-f0-9]{32}$/)
  if (value.api_url !== `/v1/files/${id}/content` || value.owner_url !== `/api/artifacts/${id}/content`) invalid()
  return { id, kind: 'image', mime: value.mime_type as GrokImageArtifact['mime'], bytes: value.bytes as number, sha256: identifier(value.sha256, /^[a-f0-9]{64}$/) }
}

/** Both streaming observations and final/polled Responses use this same file contract. */
export function grokArtifact(value: unknown): GrokArtifact {
  if (object(value) && value.kind === 'image') return grokImageArtifact(value)
  if (!object(value) || value.object !== 'file' || value.kind !== 'video' || value.mime_type !== 'video/mp4' || !Number.isSafeInteger(value.bytes) || (value.bytes as number) <= 0 || (value.bytes as number) > MAX_VIDEO_BYTES) invalid()
  const id = identifier(value.id, /^file_[a-f0-9]{32}$/)
  if (value.api_url !== `/v1/files/${id}/content` || value.owner_url !== undefined && value.owner_url !== `/api/artifacts/${id}/content`) invalid()
  return { id, kind: 'video', mime: 'video/mp4', bytes: value.bytes as number, sha256: identifier(value.sha256, /^[a-f0-9]{64}$/) }
}

/** Only the explicitly selected Grok profile calls this parser. */
export function parseGrokEvent(value: Record<string, unknown>, expectedResponseId: string, now = Date.now()): GrokEvent {
  if (value.version !== 1 || !GROK_RESPONSE_ID.test(expectedResponseId) || value.response_id !== expectedResponseId || !Number.isSafeInteger(value.sequence_number) || (value.sequence_number as number) < 0) invalid()
  const common = { responseId: expectedResponseId, sequence: value.sequence_number as number }
  if (value.type === 'grok.artifact.error') throw new Error('Grok generated media failed native artifact verification')
  if (value.type === 'grok.artifact') return { type: 'grok.artifact', ...common, artifact: grokArtifact(value.artifact) }
  if (value.type === 'grok.status') return { type: 'grok.status', ...common, status: string(value.status, 100) }
  if (value.type === 'grok.tool') {
    if (!object(value.tool)) invalid()
    const tool = value.tool as Record<string, unknown>
    return { type: 'grok.tool', ...common, tool: { id: string(tool.id), name: string(tool.name, 150), status: string(tool.status, 100), ...(tool.input !== undefined ? { input: publicValue(tool.input) } : {}), ...(tool.output !== undefined ? { output: publicValue(tool.output) } : {}) } }
  }
  if (value.type === 'grok.approval') {
    if (!object(value.approval) || !Number.isSafeInteger(value.approval.expires_in) || (value.approval.expires_in as number) <= 0 || (value.approval.expires_in as number) > 120) invalid()
    return { type: 'grok.approval', ...common, interaction: { kind: 'approval', interactionId: identifier(value.approval.id, /^approval_[a-f0-9]{32}$/), responseId: expectedResponseId, state: 'pending', expiresAt: now + (value.approval.expires_in as number) * 1000, request: approvalRequest(value.approval.request) } }
  }
  if (value.type === 'grok.question') {
    if (!object(value.question)) invalid()
    const request = questionRequest(value.question.request)
    const expiresAt = Math.min(request.expiresAt ? Date.parse(request.expiresAt) : now + 600_000, now + 600_000)
    return { type: 'grok.question', ...common, interaction: { kind: 'question', interactionId: identifier(value.question.id, /^question_[a-f0-9]{32}$/), responseId: expectedResponseId, state: 'pending', expiresAt, request } }
  }
  return invalid()
}

export function grokErrorDetails(value: unknown): string {
  if (!object(value)) return ''
  const error = object(value.error) ? value.error : value
  const code = typeof error.code === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(error.code) ? error.code : undefined
  const id = typeof value.request_id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value.request_id) ? value.request_id : undefined
  return [code, id ? `request ${id}` : undefined].filter(Boolean).join('; ')
}
export async function readGrokJson(response: Response, maxBytes = 65_536): Promise<unknown> {
  if (!response.body) throw new Error('Grok returned an empty acknowledgement')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > maxBytes) throw new Error('Grok acknowledgement exceeded its bounded limit'); chunks.push(chunk.value) }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
