import { isReasoningEffort } from '../../shared/agent-models'
import { isPermissionLabel } from './AgentExecutionPolicy'
import { validGrokInteractionAnswer } from '../../shared/grok-interactions'
import { validInputImageId } from '../../shared/agent-input-images'
type Rule = (value: unknown) => boolean
const id: Rule = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,180}$/.test(value)
const label: Rule = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && ![...value].some(char => char.charCodeAt(0) < 32)
const presetName: Rule = value => value === '' || label(value)
const opaqueId: Rule = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && ![...value].some(char => char.charCodeAt(0) < 32)
const text: Rule = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 100_000 && !value.includes('\0')
const imageText: Rule = value => typeof value === 'string' && value.length <= 100_000 && !value.includes('\0')
const imageIds: Rule = value => Array.isArray(value) && value.length > 0 && value.length <= 4 && value.every(validInputImageId) && new Set(value).size === value.length

const schemas = {
  create: { required: { taskId: id, chatId: id }, optional: { presetName, reasoningEffort: (value: unknown) => value === null || isReasoningEffort(value), permissions: isPermissionLabel, model: label, provider: (value: unknown) => ['codex', 'claude', 'antigravity', 'api'].includes(value as string), apiConnectionId: id, requestId: id } },
  attach: { required: { taskId: id, chatId: id }, optional: {} },
  resume: { required: { sessionId: id, runId: id }, optional: {} },
  reconfigure: { required: { sessionId: id, runId: id, presetName }, optional: { reasoningEffort: (value: unknown) => value === null || isReasoningEffort(value), permissions: isPermissionLabel, model: label, provider: (value: unknown) => ['codex', 'claude', 'antigravity', 'api'].includes(value as string), apiConnectionId: id, requestId: id } },
  snapshot: { required: { sessionId: id, runId: id }, optional: {} },
  send: { required: { sessionId: id, runId: id, clientMessageId: id, text: imageText }, optional: { imageIds } },
  queue: { required: { sessionId: id, runId: id, clientMessageId: id, text }, optional: {} },
  setQueuePaused: { required: { sessionId: id, runId: id, paused: (value: unknown) => typeof value === 'boolean' }, optional: {} },
  cancelQueued: { required: { sessionId: id, runId: id, clientMessageId: id }, optional: {} },
  terminate: { required: { sessionId: id, runId: id }, optional: {} },
  interrupt: { required: { sessionId: id, runId: id, turnId: opaqueId }, optional: {} },
  resolveApproval: { required: { sessionId: id, runId: id, turnId: opaqueId, approvalId: opaqueId, decision: (value: unknown) => value === 'allow' || value === 'deny' }, optional: {} },
  resolveInteraction: { required: { sessionId: id, runId: id, turnId: opaqueId, interactionId: id, answer: validGrokInteractionAnswer }, optional: {} },
  pickImages: { required: { sessionId: id, runId: id }, optional: {} },
  listImages: { required: { sessionId: id, runId: id }, optional: {} },
  discardImages: { required: { sessionId: id, runId: id, imageIds }, optional: {} },
} satisfies Record<string, { required: Record<string, Rule>; optional: Record<string, Rule> }>

export type SessionCommand = keyof typeof schemas

export function validateSessionCommand(command: SessionCommand, payload: unknown): void {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Expected a session command object')
  const data = payload as Record<string, unknown>
  if (command === 'send' && (typeof data.text !== 'string' || !data.text.trim()) && !imageIds(data.imageIds)) throw new Error('A message needs text or owned input images')
  if ((command === 'create' || command === 'reconfigure') && data.presetName === '' && !['codex', 'claude', 'antigravity', 'api'].includes(data.provider as string)) throw new Error('Direct CLI selection requires a supported provider')
  const schema: { required: Record<string, Rule>; optional: Record<string, Rule> } = schemas[command]
  for (const [key, rule] of Object.entries(schema.required)) {
    if (!Object.prototype.hasOwnProperty.call(data, key) || !rule(data[key])) throw new Error(`Invalid session command field: ${key}`)
  }
  for (const [key, value] of Object.entries(data)) {
    if (Object.prototype.hasOwnProperty.call(schema.required, key)) continue
    if (!Object.prototype.hasOwnProperty.call(schema.optional, key) || (value !== undefined && !schema.optional[key](value))) {
      throw new Error(`Unsupported session command field: ${key}`)
    }
  }
}
