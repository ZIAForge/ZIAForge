import type { AgentSessionRef } from './agent-session'
import type { VerificationCommand, WorkflowVerification, WorkflowReviewSource, WorkflowHelperSource } from './workflow'
import type { ReviewTeamPreset } from './review-team'

export type WorkKind = 'auto' | 'brainstorm' | 'deep-brainstorm' | 'research' | 'write'
export type WorkPhase = 'intake' | 'requirements' | 'planning' | 'execution' | 'divergence' | 'convergence' | 'research' | 'outline' | 'draft' | 'worker' | 'helper' | 'synthesis' | 'revision' | 'review' | 'review-architect' | 'delivery' | 'follow-up'
export interface WorkInputRef { id: string; name: string; sha256: string; sizeBytes: number; relativePath?: string }
export interface WorkPromptProfile { version: 1; sha256: string; documents: Record<string, string> }
export interface WorkFlowDefinition {
  version?: 1
  kind: WorkKind
  request: string
  advance: 'auto' | 'manual'
  executor: WorkflowReviewSource
  reviewers: WorkflowReviewSource[]
  review: boolean
  /** Frozen team snapshot. When review is enabled, replaces the plain reviewer list. */
  reviewTeam?: ReviewTeamPreset
  helpers?: WorkflowHelperSource[]
  deep?: { workers: WorkflowReviewSource[] }
  inputs: WorkInputRef[]
  limits: { maxTurns: number; maxFailures: number; maxFollowUps: number }
  promptProfile?: WorkPromptProfile
  roleLabels?: Record<string, string>
}
export interface WorkExecutionStep { id: string; title: string; instructions: string; acceptance: string[]; verification: VerificationCommand[]; status: 'pending' | 'completed' }
export interface WorkSourceReceipt { id: string; url: string; title: string; accessedAt: string; kind: 'primary' | 'secondary'; provenance: 'provided' | 'model-reported' }
export interface WorkArtifactDraft { name: string; content: string }
export interface WorkArtifactReceipt { id: string; name: string; path: string; sha256: string; bytes: number; version: number; stageId: string; invocationId: string; createdAt: number; binary?: boolean; sourcePath?: string }
export interface WorkInvocation {
  id: string
  clientMessageId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'interrupted' | 'uncertain'
  purpose: 'initial' | 'answer' | 'repair' | 'continuation'
  inputFingerprint: string
  prompt: string
  session?: AgentSessionRef & { chatId: string }
  output?: string
  result?: WorkPhaseResult
  error?: string
}
export interface WorkStageRecord {
  id: string
  phase: WorkPhase
  round: number
  sourceId?: string
  source: WorkflowReviewSource
  status: 'pending' | 'running' | 'waiting_input' | 'completed' | 'failed' | 'interrupted' | 'uncertain'
  configurationHash: string
  inputFingerprint: string
  invocations: WorkInvocation[]
  artifactIds: string[]
  reportRepairCount: 0 | 1
  verification: WorkflowVerification[]
  stepId?: string
  reportName?: string
  transitioned?: boolean
  reviewOf?: string
  /** Blind architect input: hash of the complete anonymous structured report set. */
  reportFingerprint?: string
  outputFingerprint?: string
  contextVersion?: number
  forceContinuation?: boolean
  error?: string
}
export interface WorkQuestion { id: string; question: string; options?: string[]; stageIds: string[] }
export type WorkGateAction = 'answer' | 'more' | 'evaluate' | 'approve' | 'approve-with-comments' | 'changes' | 'cancel' | 'finish' | 'continue'
export interface WorkGate {
  id: string
  kind: 'questions' | 'brainstorm-direction' | 'plan' | 'outline' | 'artifact-review' | 'continue' | 'recovery'
  stageId: string
  summary: string
  artifactIds: string[]
  actions: WorkGateAction[]
  questions?: WorkQuestion[]
  proposedSteps?: WorkExecutionStep[]
}
export interface WorkFlowResponse {
  taskId: string; runId: string; revision: number; gateId: string; commandId: string
  action: WorkGateAction
  text?: string
  answers?: Array<{ questionId: string; text: string }>
}
export interface WorkFollowUpRequest { taskId: string; runId: string; revision: number; commandId: string; artifactId?: string; text: string }
export interface WorkDecisionReceipt { commandId: string; gateId?: string; action: string; text?: string; answers?: WorkFlowResponse['answers']; questions?: WorkQuestion[]; at: number }
export interface WorkCommandReceipt { commandId: string; payloadHash: string }
/** Model output is data. Only this validated result can request a durable transition. */
export interface WorkPhaseResult {
  status: 'complete' | 'needs_input' | 'plan' | 'continue'
  summary: string
  complexity?: 'trivial' | 'small' | 'medium' | 'large'
  nextPhase?: WorkPhase
  followUpSize?: 'small' | 'large'
  questions: Array<{ id: string; question: string; options?: string[] }>
  artifacts: WorkArtifactDraft[]
  outputs?: Array<{ path: string }>
  sources: WorkSourceReceipt[]
  steps: Array<Omit<WorkExecutionStep, 'id' | 'status'>>
  review?: { outcome: 'approved' | 'changes_requested'; findings: string[] }
}
export interface WorkFlowSnapshot {
  schemaVersion: 1; taskId: string; runId: string; revision: number; sequence: number
  definition: WorkFlowDefinition
  status: 'draft' | 'running' | 'waiting' | 'paused' | 'completed' | 'cancelled' | 'blocked'
  stages: WorkStageRecord[]
  plan?: WorkExecutionStep[]
  artifacts: WorkArtifactReceipt[]
  sources: WorkSourceReceipt[]
  pending?: WorkGate
  decisions: WorkDecisionReceipt[]
  commandReceipts: WorkCommandReceipt[]
  round: number; turns: number; failures: number
  reason?: string
  recoveryGeneration?: number
  updatedAt: number
}
export interface WorkFlowAPI {
  get(request: { taskId: string }): Promise<WorkFlowSnapshot | null>
  save(request: { taskId: string; expectedRevision: number; definition: WorkFlowDefinition }): Promise<WorkFlowSnapshot>
  start(request: { taskId: string; revision: number; commandId: string }): Promise<WorkFlowSnapshot>
  respond(request: WorkFlowResponse): Promise<WorkFlowSnapshot>
  followUp(request: WorkFollowUpRequest): Promise<WorkFlowSnapshot>
  pause(request: { taskId: string }): Promise<WorkFlowSnapshot>
  readArtifact(request: { taskId: string; artifactId: string }): Promise<{ name: string; content: string; sha256: string; version: number }>
  openArtifact(request: { taskId: string; artifactId: string }): Promise<void>
  onEvent(listener: (snapshot: WorkFlowSnapshot) => void): () => void
}
