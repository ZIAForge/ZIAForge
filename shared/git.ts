export type GitTaskMode = 'worktree' | 'branch'
export interface GitTaskRequest { taskId: string }
export interface GitTaskBinding {
  schemaVersion: 1
  taskId: string
  mode: GitTaskMode
  branch: string
  baseBranch: string
  baseRevision: string
  repoPath: string
  cwd: string
  createdAt: number
  /** Migration records the exact existing state without staging or discarding it. */
  adopted?: { head: string; fingerprint: string }
}
export interface GitChange { path: string; originalPath?: string; index: string; worktree: string }
export interface GitStatus extends GitTaskBinding {
  remotes?: string[]
  branches?: Array<{ name: string; head: string }>
  head: string
  changes: GitChange[]
  /** Includes HEAD, index, tracked and untracked content; protects review-to-action races. */
  fingerprint: string
  clean: boolean
  conflicts: string[]
  removed: boolean
  receipts: GitOperationReceipt[]
}
export interface GitDiffRequest extends GitTaskRequest { scope: 'working' | 'staged' | 'base'; path?: string }
export interface GitDiff { text: string; truncated: boolean; head: string; fingerprint: string }
export interface GitOperationRequest extends GitTaskRequest { operationId: string; expectedHead: string }
export interface GitCommitRequest extends GitOperationRequest { expectedStatusFingerprint: string; message: string; paths: string[] }
export interface GitPushRequest extends GitOperationRequest { remote: string }
export interface GitMergeRequest extends GitOperationRequest { targetBranch: string; expectedTargetHead: string }
export interface GitRemoveWorktreeRequest extends GitOperationRequest { expectedStatusFingerprint: string }
export type GitOperationKind = 'commit' | 'push' | 'merge' | 'remove-worktree'
export interface GitOperationReceipt {
  reviewedTree?: string
  schemaVersion: 1
  taskId: string
  operationId: string
  kind: GitOperationKind
  signature: string
  status: 'pending' | 'succeeded' | 'failed' | 'conflicted' | 'interrupted'
  startedAt: number
  finishedAt?: number
  beforeHead: string
  afterHead?: string
  targetBranch?: string
  targetBeforeHead?: string
  targetPath?: string
  remote?: string
  recoveryRef?: string
  stdout: string
  stderr: string
  error?: string
  recovered?: boolean
}
export interface GitAPI {
  prepare(request: GitTaskRequest): Promise<GitTaskBinding>
  status(request: GitTaskRequest): Promise<GitStatus>
  diff(request: GitDiffRequest): Promise<GitDiff>
  commit(request: GitCommitRequest): Promise<GitOperationReceipt>
  push(request: GitPushRequest): Promise<GitOperationReceipt>
  merge(request: GitMergeRequest): Promise<GitOperationReceipt>
  removeWorktree(request: GitRemoveWorktreeRequest): Promise<GitOperationReceipt>
}
