import type { SpecializationSelection } from './specializations'
import type { VerificationCommand, WorkflowHelperSource, WorkflowReviewSource, WorkflowStep, WorkflowStepState } from './workflow'
import type { AgentSessionRef } from './agent-session'

/** Optional and versioned: legacy Code plans and Work keep their existing semantics. */
export type CodeFlowKind = 'auto' | 'fix-bug' | 'spec-first' | 'requirements-first' | 'multi-model'
export type CodePhase = 'discovery' | 'investigation' | 'requirements' | 'specification' | 'planning' | 'implementation' | 'delivery'
export type CodeComplexity = 'trivial' | 'small' | 'medium' | 'large'
/** User-owned local instruction pack, frozen with the plan; never bundled credentials. */
export interface CodePromptProfile { version: 1; sha256: string; documents: Record<string, string> }
export interface CodeFlowDefinition {
  version: 1
  kind: CodeFlowKind
  request: string
  /** Document acceptance and a persisted stage conversation; absent on legacy plans. */
  interaction?: { version: 1 }
  planner?: WorkflowReviewSource
  fixer?: WorkflowReviewSource
  promptProfile?: CodePromptProfile
  multi?: {
    version: 1
    explorers?: WorkflowHelperSource[]
    designers?: WorkflowReviewSource[]
    reviewCoordinator?: WorkflowReviewSource
    reviewDecision?: 'auto' | 'always' | 'never'
  }
}
export type MultiStageKind = 'exploration' | 'design' | 'synthesis' | 'review-worker' | 'review-coordinator' | 'fix'
export interface CodeMultiStage {
  id: string
  kind: MultiStageKind
  index: number
  cycle: number
  status: 'running' | 'completed' | 'failed' | 'interrupted'
  targetFingerprint: string
  workspaceFingerprint?: string
  source?: WorkflowReviewSource
  session?: AgentSessionRef & { chatId: string }
  output?: string
  artifactIds?: string[]
  error?: string
  retries?: number
}
export interface CodeQuestion { id: string; question: string; options?: string[] }
export interface CodeArtifactDraft { name: string; content: string }
export interface CodeProposedStep {
  /** Prompt-only proposal, adopted at the human plan gate. */
  specialization?: SpecializationSelection
  title: string
  instructions: string
  acceptance: string[]
  /** A proposal only; the human gate must accept these commands before execution. */
  verification: VerificationCommand[]
  red?: VerificationCommand
}
export interface CodePhaseResult {
  status: 'ready' | 'needs_input'
  summary: string
  preamble?: string
  complexity?: CodeComplexity
  intent?: 'answer' | 'implement'
  questions: CodeQuestion[]
  artifacts: CodeArtifactDraft[]
  steps: CodeProposedStep[]
}
export interface CodeArtifactReceipt {
  id: string
  name: string
  path: string
  version: number
  sha256: string
  bytes: number
  stepId: string
  attemptId: string
  createdAt: number
}
export interface CodePreparationReceipt {
  summary: string
  artifactIds: string[]
}
export interface CodeFlowGate {
  id: string
  kind: 'questions' | 'document' | 'plan' | 'review' | 'review-decision'
  stepId: string
  attemptId: string
  summary: string
  artifactIds: string[]
  /** Exact immutable document versions presented for acceptance. */
  artifactHashes?: Array<{ id: string; sha256: string }>
  phase?: CodePhase
  questions?: CodeQuestion[]
  reviewOutcome?: 'approved' | 'changes_requested'
  proposedSteps?: WorkflowStep[]
}
export interface CodeFlowState {
  artifacts: CodeArtifactReceipt[]
  answers: Array<{ stepId: string; kind: 'answer' | 'changes' | 'approve'; text: string; at: number }>
  preamble?: string
  complexity?: CodeComplexity
  pending?: CodeFlowGate
  basisRevision?: number
  dialogue?: CodeDialogueEntry[]
  discussions?: Array<Omit<CodeFlowDiscussion, 'taskId'>>
  acceptedDocuments?: Array<{ commandId: string; stepId: string; phase: CodePhase; basisRevision: number; artifacts: Array<{ id: string; sha256: string }>; at: number; invalidatedAt?: number }>
  acceptedPlans?: Array<{ commandId: string; basisRevision: number; stepIds: string[]; artifacts: Array<{ id: string; sha256: string }>; workspaceFingerprint: string; at: number; invalidatedAt?: number }>
  /** Removed future/superseded preparation stages remain visible with their evidence. */
  retiredSteps?: Array<{ step: WorkflowStep; state: WorkflowStepState; commandId: string; reason: string; at: number }>
  responses?: Array<Omit<CodeFlowResponse, 'taskId'>>
  acceptedReviewAttemptIds?: string[]
  /** One correction per explicit review decision; earlier cycles remain in attempts/artifacts. */
  fix?: { stepId: string; reviewAttemptId: string; authorized: boolean; attemptId?: string; cycle?: number }
  multi?: { reviewCycle: number; fixCycle: number; decision?: 'review' | 'skip'; decisionReason?: string }
}
export interface CodeFlowResponse {
  taskId: string
  revision: number
  gateId: string
  commandId: string
  action: 'answer' | 'approve' | 'changes' | 'cancel' | 'rereview'
  text?: string
  /** Only approve + plan. Order is authoritative; identities and dependencies are host-owned. */
  proposedSteps?: CodeProposedStep[]
}
export interface CodeDialogueEntry {
  id: string
  stepId: string
  role: 'user' | 'assistant'
  text: string
  questions?: CodeQuestion[]
  at: number
  artifactIds?: string[]
}
export interface CodeFlowDiscussion {
  taskId: string
  revision: number
  commandId: string
  text: string
  /** Omit both to discuss the pending/current stage. */
  stepId?: string
  phase?: Exclude<CodePhase, 'delivery'>
  artifactEdits?: Array<{ artifactId: string; expectedSha256: string; content: string }>
}
