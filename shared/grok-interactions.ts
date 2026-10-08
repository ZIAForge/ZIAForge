/** Grok Connector v1 native decisions. These are never local allow/deny permissions. */
export interface GrokApprovalOption {
  optionId: string
  name: string
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always'
}
export interface GrokApprovalRequest {
  sessionId: string
  toolCall: { toolCallId: string; title?: string; kind?: string; status?: string; rawInput?: unknown; content?: unknown }
  options: GrokApprovalOption[]
  threadId?: string
}
export interface GrokQuestionOption { label: string; description: string; preview?: string; id?: string }
export interface GrokQuestion {
  question: string
  options: GrokQuestionOption[]
  multiSelect: boolean
  id?: string
}
export interface GrokQuestionRequest {
  sessionId: string
  toolCallId: string
  mode: 'default' | 'plan'
  questions: GrokQuestion[]
  expiresAt?: string
  threadId?: string
  turnId?: string
}
export type GrokInteractionAnswer =
  | { kind: 'approval'; optionId: string }
  | { kind: 'question'; outcome: 'accepted'; answers: Record<string, string[]>; annotations?: Record<string, { notes?: string; preview?: string }> }
  | { kind: 'question'; outcome: 'cancelled' }
  | { kind: 'question'; outcome: 'chat_about_this'; partial_answers?: Record<string, string> }
  | { kind: 'question'; outcome: 'skip_interview'; partial_answers?: Record<string, string> }
export type GrokInteractionState = 'pending' | 'submitting' | 'resolved' | 'expired' | 'failed'
interface GrokInteractionBase {
  interactionId: string
  responseId: string
  state: GrokInteractionState
  expiresAt: number
  answer?: GrokInteractionAnswer
  resolvedBy?: 'auto' | 'user'
  error?: string
}
export type GrokInteraction = GrokInteractionBase & (
  | { kind: 'approval'; request: GrokApprovalRequest }
  | { kind: 'question'; request: GrokQuestionRequest }
)

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key))
const string = (value: unknown, max = 256): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\0')

/** Structural IPC bound; matching an actual offered option happens in the owning adapter. */
export function validGrokInteractionAnswer(value: unknown): value is GrokInteractionAnswer {
  if (!object(value)) return false
  if (value.kind === 'approval') return keys(value, ['kind', 'optionId']) && string(value.optionId)
  if (value.kind !== 'question') return false
  if (value.outcome === 'cancelled') return keys(value, ['kind', 'outcome'])
  if (value.outcome === 'chat_about_this' || value.outcome === 'skip_interview') {
    if (!keys(value, ['kind', 'outcome', 'partial_answers']) || value.partial_answers !== undefined && (!object(value.partial_answers) || Object.keys(value.partial_answers).length > 32)) return false
    return Object.entries(value.partial_answers ?? {}).every(([question, label]) => string(question, 16_384) && string(label, 4096)) && JSON.stringify(value).length <= 262_144
  }
  if (value.outcome !== 'accepted' || !keys(value, ['kind', 'outcome', 'answers', 'annotations']) || !object(value.answers) || Object.keys(value.answers).length > 32) return false
  for (const [question, labels] of Object.entries(value.answers)) {
    if (!string(question, 16_384) || !Array.isArray(labels) || labels.length < 1 || labels.length > 32 || labels.some(label => !string(label, 4096)) || new Set(labels).size !== labels.length) return false
  }
  if (value.annotations !== undefined) {
    if (!object(value.annotations) || Object.keys(value.annotations).length > 32) return false
    for (const [question, annotation] of Object.entries(value.annotations)) {
      if (!Object.hasOwn(value.answers, question) || !object(annotation) || !keys(annotation, ['notes', 'preview']) || annotation.notes !== undefined && (typeof annotation.notes !== 'string' || annotation.notes.length > 16_384 || annotation.notes.includes('\0')) || annotation.preview !== undefined && (typeof annotation.preview !== 'string' || annotation.preview.length > 65_536 || annotation.preview.includes('\0'))) return false
    }
  }
  return JSON.stringify(value).length <= 262_144
}

/** Exact native question text and labels are the protocol identity, not array indexes. */
export function answerMatchesInteraction(interaction: GrokInteraction, answer: GrokInteractionAnswer): boolean {
  if (!validGrokInteractionAnswer(answer) || interaction.kind !== answer.kind) return false
  if (interaction.kind === 'approval' && answer.kind === 'approval') return interaction.request.options.some(option => option.optionId === answer.optionId)
  if (interaction.kind !== 'question' || answer.kind !== 'question') return false
  if (answer.outcome === 'cancelled') return true
  if (answer.outcome === 'chat_about_this' || answer.outcome === 'skip_interview') return interaction.request.mode === 'plan' && Object.entries(answer.partial_answers ?? {}).every(([text, label]) => interaction.request.questions.some(question => question.question === text && (label === 'Other' || question.options.some(option => option.label === label))))
  if (Object.keys(answer.answers).length !== interaction.request.questions.length) return false
  for (const question of interaction.request.questions) {
    if (!Object.hasOwn(answer.answers, question.question)) return false
    const labels = answer.answers[question.question]
    if (!Array.isArray(labels) || !question.multiSelect && labels.length !== 1 || labels.some(label => label !== 'Other' && !question.options.some(option => option.label === label))) return false
    const annotation = answer.annotations && Object.hasOwn(answer.annotations, question.question) ? answer.annotations[question.question] : undefined
    if (annotation?.preview !== undefined && (question.multiSelect || annotation.preview !== question.options.find(option => option.label === labels[0])?.preview)) return false
    if (labels.includes('Other') && !annotation?.notes?.trim()) return false
  }
  return true
}

/** The native option kind, never its display label, is the authority for one-time consent. */
export function singleNativeAllowOnce(interaction: GrokInteraction): GrokApprovalOption | undefined {
  if (interaction.kind !== 'approval') return undefined
  const options = interaction.request.options.filter(option => option.kind === 'allow_once')
  return options.length === 1 ? options[0] : undefined
}
