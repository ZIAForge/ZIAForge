/**
 * Typed Agent Command Contracts
 * Used for IPC communication between React UI and Electron RunService
 */

import { AgentRunStatus, ApprovalDecision } from './agent-events'
export type { AgentRunStatus, ApprovalDecision }

export type AgentProviderType = 'codex' | 'antigravity' | 'claude' | 'api' | 'custom'

export interface StartTaskRequest {
  taskId: string
  runId?: string
  worktreePath: string
  agentProvider?: AgentProviderType
  model?: string
  prompt?: string
  useMockData?: boolean
}

export interface StopTaskRequest {
  taskId: string
  runId?: string
  force?: boolean
}

export interface SendPromptRequest {
  taskId: string
  runId?: string
  text: string
  attachments?: string[]
}

export interface ResolveApprovalRequest {
  taskId: string
  runId?: string
  approvalId: string
  decision: ApprovalDecision | string
}

export interface RunVerificationRequest {
  taskId: string
  runId?: string
  command: string
  cwd: string
  phase: 'red' | 'green' | 'test' | 'lint'
}

export interface TaskSessionState {
  taskId: string
  runId: string
  sessionId: string
  agentProvider: AgentProviderType
  model?: string
  status: AgentRunStatus
  worktreePath: string
  pid?: number
  startedAt: number
  endedAt?: number
  error?: string
}

export interface CommandResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
