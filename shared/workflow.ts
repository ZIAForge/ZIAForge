import type { CodeFlowDefinition, CodePhase, CodePreparationReceipt, CodeFlowState, CodeFlowResponse, CodeFlowDiscussion, CodeMultiStage } from './code-flow'
import type { AgentExecutionOptions, ReasoningEffort } from './agent-models'
import type { AgentSessionProvider, AgentSessionRef } from './agent-session'
import type { GitOperationReceipt } from './git'
import type { ReviewTeamPreset } from './review-team'
import type { SpecializationSelection } from './specializations'

/** Saved Custom role settings; paths, executables and credentials remain backend-owned. */
export interface WorkflowCustomAgentConfiguration extends AgentExecutionOptions {
  provider: AgentSessionProvider
  model: string
  apiConnectionId?: string
}
export interface WorkflowReviewSource extends AgentExecutionOptions { id: string; presetName: string; reasoningEffort?: ReasoningEffort | null; configuration?: WorkflowCustomAgentConfiguration; specialization?: SpecializationSelection }
export interface WorkflowHelperSource extends WorkflowReviewSource { instructions: string }
export interface WorkflowGitPolicy { commit: 'manual' | 'after-plan'; merge: 'manual' | 'after-plan'; push: 'manual' | 'after-plan'; targetBranch?: string; remote?: string }
export interface WorkflowGitReceipt { operations: GitOperationReceipt[]; status: 'completed' | 'blocked'; error?: string }
export interface WorkflowFinalization { id: string; status: 'pending' | 'running' | 'blocked' | 'completed'; inputFingerprint: string; receipt?: WorkflowGitReceipt; error?: string }

export interface VerificationCommand { executable: string; args: string[]; timeoutMs: number }
export interface WorkflowStep extends AgentExecutionOptions {
  specialization?: SpecializationSelection
  id: string
  codePhase?: CodePhase
  /** Host-owned foundation generation. Prior completed implementation keeps its generation. */
  codeBasis?: number
  title: string
  instructions: string
  acceptance: string[]
  dependsOn: string[]
  presetName?: string
  /** Used only with presetName = '@custom'. */
  configuration?: WorkflowCustomAgentConfiguration
  newContext: boolean
  stopAfter: boolean
  /** Explicit user-selected checks. Provider output cannot add executable commands. */
  verification: VerificationCommand[]
  red?: VerificationCommand
}
export interface WorkflowPlan {
  reviewTeam?: ReviewTeamPreset
  coderSpecialization?: SpecializationSelection
  reviewerSpecialization?: SpecializationSelection
  codeFlow?: CodeFlowDefinition
  title: string
  coderPreset: string
  /** Used only with coderPreset = '@custom'. */
  coderConfiguration?: WorkflowCustomAgentConfiguration
  coderReasoningEffort?: ReasoningEffort | null
  coderPermissions?: string
  reviewerReasoningEffort?: ReasoningEffort | null
  reviewerPreset?: string
  /** Used only with reviewerPreset = '@custom'. */
  reviewerConfiguration?: WorkflowCustomAgentConfiguration
  /** When supplied, every named reviewer must approve; no vote can erase a finding. */
  reviewers?: WorkflowReviewSource[]
  reviewPolicy?: 'all'
  helpers?: WorkflowHelperSource[]
  git?: WorkflowGitPolicy
  review: boolean
  advance: 'auto' | 'manual'
  maxFailures: number
  maxIterations: number
  steps: WorkflowStep[]
}
export interface WorkflowFinding { severity: 'blocking' | 'suggestion'; location: string; evidence: string; action: string }
export interface WorkflowReview { outcome: 'approved' | 'changes_requested'; findings: WorkflowFinding[]; summary: string }
export interface WorkflowSourceResult {
  specialization?: SpecializationSelection
  sourceId: string
  reasoningEffort?: ReasoningEffort | null
  presetName: string
  configuration?: WorkflowCustomAgentConfiguration
  status: 'running' | 'completed' | 'failed' | 'interrupted'
  targetFingerprint: string
  session?: AgentSessionRef & { chatId: string }
  review?: WorkflowReview
  output?: string
  error?: string
}
export interface WorkflowVerification {
  phase: 'red' | 'green'
  id: string
  status: string
  command: VerificationCommand
  exitCode: number | null
  cleanupVerified: boolean
  stdoutPath: string
  stderrPath: string
  inputFingerprint?: string
  stdout?: string
  stderr?: string
  error?: string
}
export interface WorkflowAttempt {
  /** The architect sees only anonymous reports, never repository context. */
  architect?: WorkflowSourceResult & { inputFingerprint: string }
  /** A failed owned shutdown must be retried before any new workflow invocation. */
  cleanupPending?: Array<AgentSessionRef & { chatId: string }>
  multiStages?: CodeMultiStage[]
  reusedVerificationFromAttemptId?: string
  reusedReviewFromAttemptId?: string
  multiCompletion?: { kind: 'reviewed' | 'skipped' | 'fix'; cycle: number; reason?: string; reviewAttemptId?: string }
  preparation?: CodePreparationReceipt
  id: string
  number: number
  startedAt: number
  finishedAt?: number
  stage: 'helper' | 'red' | 'implementation' | 'verification' | 'review' | 'finished'
  status: 'running' | 'completed' | 'failed' | 'interrupted'
  error?: string
  session?: AgentSessionRef & { chatId: string }
  reviewerSession?: AgentSessionRef & { chatId: string }
  verification: WorkflowVerification[]
  review?: WorkflowReview
  reviewSources?: WorkflowSourceResult[]
  helperSources?: WorkflowSourceResult[]
  output?: string
  targetFingerprint?: string
  /** Raw workspace evidence at implementation, independent of later policy revisions. */
  workspaceFingerprint?: string
  definitionFingerprint?: string
}
export interface WorkflowStepState {
  id: string
  status: 'pending' | 'running' | 'completed' | 'blocked'
  failures: number
  attempts: WorkflowAttempt[]
}
export interface WorkflowSnapshot {
  codeFlow?: CodeFlowState
  schemaVersion: 1
  taskId: string
  runId: string
  revision: number
  sequence: number
  plan: WorkflowPlan
  status: 'draft' | 'running' | 'paused' | 'blocked' | 'completed'
  reason?: string
  iterations: number
  steps: WorkflowStepState[]
  updatedAt: number
  commandIds: string[]
  finalization?: WorkflowFinalization
}
export interface WorkflowAPI {
  discuss(request: CodeFlowDiscussion): Promise<WorkflowSnapshot>
  respond(request: CodeFlowResponse): Promise<WorkflowSnapshot>
  readArtifact(request: { taskId: string; artifactId: string }): Promise<{ name: string; content: string; sha256: string; version: number }>
  get(request: { taskId: string }): Promise<WorkflowSnapshot | null>
  save(request: { taskId: string; expectedRevision: number; plan: WorkflowPlan }): Promise<WorkflowSnapshot>
  start(request: { taskId: string; revision: number; commandId: string }): Promise<WorkflowSnapshot>
  pause(request: { taskId: string }): Promise<WorkflowSnapshot>
  onEvent(callback: (snapshot: WorkflowSnapshot) => void): () => void
}
