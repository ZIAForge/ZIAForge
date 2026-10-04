/**
 * Typed Agent Streaming Event Contracts
 * Used across Electron backend (EventJournal, RunService, Adapters) and React Frontend (ConversationFeed, Store)
 */

export type AgentRole = 'user' | 'assistant' | 'system'

export interface BaseAgentEvent {
  eventId: string
  taskId: string
  runId: string
  timestamp: number
  /** Provider turn identity, when the event belongs to a particular turn. */
  turnId?: string
  /** Coordinator-owned user input identity; never inferred from provider text. */
  clientMessageId?: string
}

// 1. Message Events
export interface MessageStartedEvent extends BaseAgentEvent {
  type: 'message.started'
  messageId: string
  role: AgentRole
}

export interface MessageDeltaEvent extends BaseAgentEvent {
  type: 'message.delta'
  messageId: string
  deltaType: 'text' | 'thinking'
  content: string
}

export interface MessageCompletedEvent extends BaseAgentEvent {
  type: 'message.completed'
  messageId: string
  fullContent?: string
  contentType?: 'text' | 'thinking'
  finishReason?: 'stop' | 'tool_calls' | 'interrupted' | 'error'
}

// 2. Tool Invocation Events
export interface ToolStartedEvent extends BaseAgentEvent {
  type: 'tool.started'
  toolCallId: string
  toolName: string
  input?: unknown
  parentMessageId?: string
}

export interface ToolOutputDeltaEvent extends BaseAgentEvent {
  type: 'tool.output.delta'
  toolCallId: string
  delta: string
  stream?: 'stdout' | 'stderr'
}

export interface ToolCompletedEvent extends BaseAgentEvent {
  type: 'tool.completed'
  toolCallId: string
  output?: unknown
  isError?: boolean
  exitCode?: number
  signal?: string
  outcome?: 'completed' | 'failed' | 'cancelled' | 'declined'
}

// 3. Permission & Approval Events
export type ApprovalState = 'pending' | 'submitting' | 'resolved' | 'expired'
export type ApprovalDecision = 'allow' | 'deny'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface PermissionRequestedEvent extends BaseAgentEvent {
  type: 'permission.requested'
  approvalId: string
  command?: string
  toolCallId?: string
  description?: string
  riskLevel?: RiskLevel
  decisionOptions?: string[]
}

export interface PermissionStateChangedEvent extends BaseAgentEvent {
  type: 'permission.state.changed'
  approvalId: string
  state: ApprovalState
  decision?: ApprovalDecision
  resolvedBy?: 'user' | 'auto' | 'timeout'
}

// 4. Verification & TDD Events
export interface VerificationCompletedEvent extends BaseAgentEvent {
  type: 'verification.completed'
  phase: 'red' | 'green' | 'test' | 'lint'
  success: boolean
  command: string
  output?: string
  errorCount?: number
}

// 5. Workflow Step Events
export interface WorkflowStepChangedEvent extends BaseAgentEvent {
  type: 'workflow.step.changed'
  stepId: string
  stepName: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  error?: string
}

// 6. Agent Run Status
export type AgentRunStatus = 'idle' | 'starting' | 'running' | 'waiting_for_approval' | 'stopping' | 'completed' | 'error' | 'stopped'

export interface AgentStatusChangedEvent extends BaseAgentEvent {
  type: 'agent.status.changed'
  status: AgentRunStatus
  /** A terminal turn outcome does not imply the provider process has exited. */
  scope?: 'turn' | 'session'
  error?: string
}

// 7. Raw Log Stream
export interface RawLogEvent extends BaseAgentEvent {
  type: 'raw.log'
  stream: 'stdout' | 'stderr'
  line: string
}

export interface UsageReportedEvent extends BaseAgentEvent {
  type: 'usage.reported'
  requestId: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

// Union of all events
export type AgentEvent =
  | MessageStartedEvent
  | MessageDeltaEvent
  | MessageCompletedEvent
  | ToolStartedEvent
  | ToolOutputDeltaEvent
  | ToolCompletedEvent
  | PermissionRequestedEvent
  | PermissionStateChangedEvent
  | VerificationCompletedEvent
  | WorkflowStepChangedEvent
  | AgentStatusChangedEvent
  | RawLogEvent
  | UsageReportedEvent

export type AgentEventType = AgentEvent['type']

// 8. Reconstructed Feed Models (Projections from EventJournal)
export interface ReconstructedToolItem {
  callId: string
  toolName: string
  input?: unknown
  output?: unknown
  outputStream?: 'stdout' | 'stderr'
  isError?: boolean
  status: 'running' | 'completed' | 'error' | 'cancelled'
  exitCode?: number
  signal?: string
  outcome?: ToolCompletedEvent['outcome']
}

export interface ReconstructedApprovalItem {
  approvalId: string
  command?: string
  toolCallId?: string
  description?: string
  riskLevel?: RiskLevel
  state: ApprovalState
  decision?: ApprovalDecision
  decisionOptions?: string[]
}

export interface ReconstructedMessage {
  turnId?: string
  id: string
  role: 'user' | 'assistant' | 'system'
  thinking: string
  text: string
  status: 'streaming' | 'completed' | 'error' | 'interrupted'
  timestamp: number
  revision?: number
  tools?: ReconstructedToolItem[]
  approvals?: ReconstructedApprovalItem[]
}
