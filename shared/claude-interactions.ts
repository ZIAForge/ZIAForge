/** Claude Connector decisions are separate from local tools and Grok options. */
export interface ClaudeApprovalRequest {
  threadId?: string
  toolName: string
  toolUseID?: string
  requestId?: string
  input?: unknown
  description?: string
  defaultToNo?: boolean
  suppressAlwaysAllowRule?: boolean
}
export interface ClaudeQuestion {
  question: string
  header?: string
  options: Array<{ label: string; description?: string }>
  multiSelect?: boolean
}
export interface ClaudeQuestionRequest { threadId?: string; toolCallId?: string; mode?: string; questions: ClaudeQuestion[] }
export type ClaudeInteractionAnswer =
  | { provider: 'claude'; kind: 'approval'; behavior: 'allow' | 'deny'; message?: string }
  | { provider: 'claude'; kind: 'question'; outcome: 'accepted'; answers: Record<string, string> }
  | { provider: 'claude'; kind: 'question'; outcome: 'cancelled' }
export type ClaudeInteractionState = 'pending' | 'submitting' | 'resolved' | 'expired' | 'failed'
export type ClaudeInteraction = {
  provider: 'claude'
  interactionId: string
  responseId: string
  state: ClaudeInteractionState
  expiresAt: number
  answer?: ClaudeInteractionAnswer
  resolvedBy?: 'user'
  error?: string
} & ({ kind: 'approval'; request: ClaudeApprovalRequest } | { kind: 'question'; request: ClaudeQuestionRequest })

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key))
const string = (value: unknown, max: number, empty = false): value is string => typeof value === 'string' && (empty || value.length > 0) && value.length <= max && !value.includes('\0')
export function validClaudeInteractionAnswer(value: unknown): value is ClaudeInteractionAnswer {
  if (!object(value) || value.provider !== 'claude') return false
  if (value.kind === 'approval') return keys(value, ['provider', 'kind', 'behavior', 'message']) && ['allow', 'deny'].includes(value.behavior as string) && (value.message === undefined || string(value.message, 4000, true))
  if (value.kind !== 'question') return false
  if (value.outcome === 'cancelled') return keys(value, ['provider', 'kind', 'outcome'])
  return value.outcome === 'accepted' && keys(value, ['provider', 'kind', 'outcome', 'answers']) && object(value.answers) && Object.keys(value.answers).length > 0 && Object.keys(value.answers).length <= 32 && Object.entries(value.answers).every(([question, answer]) => string(question, 16_384) && string(answer, 16_384) && answer.trim().length > 0) && JSON.stringify(value).length <= 262_144
}
export function claudeAnswerMatchesInteraction(interaction: ClaudeInteraction, answer: unknown): answer is ClaudeInteractionAnswer {
  if (!validClaudeInteractionAnswer(answer) || answer.kind !== interaction.kind) return false
  if (answer.kind === 'approval' || answer.outcome === 'cancelled') return true
  return interaction.kind === 'question' && Object.keys(answer.answers).length === interaction.request.questions.length && interaction.request.questions.every(question => Object.hasOwn(answer.answers, question.question))
}
