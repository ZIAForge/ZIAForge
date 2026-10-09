import type { ApprovalDecision, ReconstructedApprovalItem, ReconstructedMessage } from './agent-events'
import type { AgentExecutionOptions } from './agent-models'
import type { ApiProfile, ApiTransport } from './api-provider'

export type AgentSessionProvider = 'codex' | 'claude' | 'antigravity' | 'api'

export interface AgentChatIdentity { taskId: string; chatId: string }
export interface AgentSessionRef { sessionId: string; runId: string }
export interface AgentSessionCreateRequest extends AgentChatIdentity, AgentExecutionOptions { presetName?: string; model?: string; provider?: AgentSessionProvider; apiConnectionId?: string; requestId?: string }
export interface AgentSessionReconfigureRequest extends AgentSessionRef, AgentExecutionOptions { presetName: string; model?: string; provider?: AgentSessionProvider; apiConnectionId?: string; requestId?: string }
export interface AgentSessionDiagnostic { id: string; timestamp: number; level: 'info' | 'warning' | 'error'; source: 'session' | 'stdout' | 'stderr'; message: string }
export interface AgentSendRequest extends AgentSessionRef { clientMessageId: string; text: string; imageIds?: string[]; documentIds?: string[] }
export interface AgentQueueControlRequest extends AgentSessionRef { paused: boolean }
export interface AgentQueueCancelRequest extends AgentSessionRef { clientMessageId: string }
export interface AgentQueuedMessage {
  clientMessageId: string
  text: string
  createdAt: number
  status: 'queued' | 'dispatching' | 'uncertain'
  error?: string
}
/** Durable inputs, separate from messages already delivered to the provider. */
export interface AgentMessageQueue {
  /** Independent from the append-only conversation journal cursor. */
  revision: number
  paused: boolean
  items: AgentQueuedMessage[]
  error?: string
}
export interface AgentTurnRequest extends AgentSessionRef { turnId: string }
export interface AgentApprovalRequest extends AgentTurnRequest { approvalId: string; decision: ApprovalDecision }
export interface AgentInteractionRequest extends AgentTurnRequest { interactionId: string; answer: import('./provider-interactions').ProviderInteractionAnswer }
export interface AgentSendReceipt extends AgentSessionRef {
  clientMessageId: string
  turnId?: string
  cursor: number
  /** Rejected means the provider explicitly refused turn/start before any turn activity. */
  outcome?: 'accepted' | 'rejected'
  error?: string
}
export type AgentSessionStatus = 'starting' | 'ready' | 'stopping' | 'stopped' | 'error' | 'disconnected'
export interface AgentActiveTurn {
  turnId?: string
  clientMessageId: string
  status: 'starting' | 'running' | 'waiting_for_approval' | 'interrupting'
}
export interface AgentFinishedTurn {
  turnId?: string
  clientMessageId: string
  status: 'completed' | 'interrupted' | 'failed'
  error?: string
}
export interface AgentSessionSnapshot extends AgentChatIdentity, AgentSessionRef, AgentExecutionOptions {
  cursor: number
  provider: AgentSessionProvider
  presetName: string
  model?: string
  apiConnectionId?: string
  /** Effective protocol pinned to this run, not the connection's latest settings. */
  apiTransport?: ApiTransport
  apiProfile?: ApiProfile
  apiClaudeConfig?: import('./api-provider').ClaudeConnectionOptions
  apiGrokConfig?: import('./api-provider').ApiConnection['grok']
  /** Actual reported usage only; absent when the provider has not reported it. */
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number; requests: number }
  resumeAvailable?: boolean
  diagnostics?: AgentSessionDiagnostic[]
  diagnosticsRevision?: number
  capabilities: { attachments: boolean; interactiveApprovals: boolean; interruptTurn: boolean }
  sessionStatus: AgentSessionStatus
  activeTurn?: AgentActiveTurn
  lastTurn?: AgentFinishedTurn
  queue?: AgentMessageQueue
  error?: string
  feed: ReconstructedMessage[]
  pendingApprovals: Array<ReconstructedApprovalItem & { turnId?: string }>
  pendingInteractions?: Array<import('./provider-interactions').ProviderInteraction & { turnId?: string }>
}
/** Ordered, coalesced snapshots projected in memory after journal writes finish. */
export interface AgentSessionUpdate { snapshot: AgentSessionSnapshot }
export interface AgentSessionsAPI {
  create(request: AgentSessionCreateRequest): Promise<AgentSessionSnapshot>
  resume(request: AgentSessionRef): Promise<AgentSessionSnapshot>
  reconfigure(request: AgentSessionReconfigureRequest): Promise<AgentSessionSnapshot>
  attach(request: AgentChatIdentity): Promise<AgentSessionSnapshot | null>
  snapshot(request: AgentSessionRef): Promise<AgentSessionSnapshot>
  send(request: AgentSendRequest): Promise<AgentSendReceipt>
  /** Acknowledges only after the queued input is saved; does not await a provider turn. */
  queue(request: AgentSendRequest): Promise<AgentSessionSnapshot>
  setQueuePaused(request: AgentQueueControlRequest): Promise<AgentSessionSnapshot>
  cancelQueued(request: AgentQueueCancelRequest): Promise<AgentSessionSnapshot>
  interrupt(request: AgentTurnRequest): Promise<void>
  /** Ends the owned process; history and native resume reference remain available. */
  terminate(request: AgentSessionRef): Promise<void>
  resolveApproval(request: AgentApprovalRequest): Promise<void>
  resolveInteraction?(request: AgentInteractionRequest): Promise<void>
  pickImages?(request: AgentSessionRef): Promise<import('./agent-input-images').AgentInputImageRef[]>
  listImages?(request: AgentSessionRef): Promise<import('./agent-input-images').AgentInputImageRef[]>
  discardImages?(request: AgentSessionRef & { imageIds: string[] }): Promise<void>
  pickDocuments?(request: AgentSessionRef): Promise<import('./agent-input-documents').AgentInputDocumentRef[]>
  listDocuments?(request: AgentSessionRef): Promise<import('./agent-input-documents').AgentInputDocumentRef[]>
  discardDocuments?(request: AgentSessionRef & { documentIds: string[] }): Promise<void>
  onEvent(callback: (update: AgentSessionUpdate) => void): () => void
}
