import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { GitAPI, GitCommitRequest, GitMergeRequest, GitOperationReceipt, GitPushRequest, GitStatus } from '../../shared/git'
import type { WorkflowGitPolicy, WorkflowGitReceipt } from '../../shared/workflow'
import { readPrivateMetadata, replacePrivateMetadata } from '../runtime/privateStorage'
import { gitId, validateGitCommand } from '../git/GitValidation'

export interface FinalizeGitRequest {
  taskId: string; workflowRunId: string; id: string; policy: WorkflowGitPolicy; inputFingerprint: string
  previousReceipt?: WorkflowGitReceipt
  assertVerified(): Promise<void>
}
type Operation = { kind: 'commit'; request: GitCommitRequest; receipt?: GitOperationReceipt } | { kind: 'merge'; request: GitMergeRequest; receipt?: GitOperationReceipt } | { kind: 'push'; request: GitPushRequest; receipt?: GitOperationReceipt }
interface Ledger { version: 1; taskId: string; id: string; workflowRunId: string; inputFingerprint: string; initialHead: string; initialStatus: string; paths: string[]; operations: Operation[] }
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

/** Separates verified task commits, local integration and remote publication with durable intents. */
export class WorkflowGitFinalizer {
  constructor(private readonly options: { directory: string; git: GitAPI; validateTask(taskId: string): void }) {}
  async run(request: FinalizeGitRequest, signal: AbortSignal, onReceipt: (receipt: WorkflowGitReceipt) => Promise<void>): Promise<WorkflowGitReceipt> {
    gitId(request.taskId); gitId(request.id); gitId(request.workflowRunId)
    this.options.validateTask(request.taskId)
    const file = path.join(this.options.directory, request.taskId, `${request.id}.json`)
    let ledger: Ledger | undefined
    const assertActive = () => { if (signal.aborted) throw new Error('Git finalization paused'); this.options.validateTask(request.taskId) }
    const save = async () => { await replacePrivateMetadata(file, ledger) }
    const publish = async (status: WorkflowGitReceipt['status'], error?: string): Promise<WorkflowGitReceipt> => {
      const receipt = { operations: ledger?.operations.flatMap(item => item.receipt ? [item.receipt] : []) || [], status, ...(error ? { error } : {}) }
      await onReceipt(receipt)
      return receipt
    }
    try {
      assertActive()
      try { ledger = await readPrivateMetadata(file) as Ledger } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      if (ledger) {
        if (ledger.version !== 1 || ledger.id !== request.id || ledger.taskId !== request.taskId || ledger.workflowRunId !== request.workflowRunId || ledger.inputFingerprint !== request.inputFingerprint || !Array.isArray(ledger.operations) || ledger.operations.length > 30 || !Array.isArray(ledger.paths)) throw new Error('Invalid saved Git finalization; existing evidence was preserved')
        for (const operation of ledger.operations) {
          if (!['commit', 'merge', 'push'].includes(operation.kind)) throw new Error('Invalid saved Git phase')
          validateGitCommand(operation.kind, operation.request)
          if (operation.request.taskId !== request.taskId) throw new Error('Git finalization task ownership changed')
        }
      } else {
        await request.assertVerified()
        const state = await this.options.git.status({ taskId: request.taskId })
        await request.assertVerified()
        assertActive()
        ledger = { version: 1, taskId: request.taskId, id: request.id, workflowRunId: request.workflowRunId, inputFingerprint: request.inputFingerprint, initialHead: state.head, initialStatus: state.fingerprint, paths: state.changes.flatMap(change => [change.path, ...(change.originalPath ? [change.originalPath] : [])]).filter((name, index, all) => all.indexOf(name) === index), operations: [] }
        await save()
      }
      const complete = (kind: Operation['kind']) => ledger!.operations.find(item => item.kind === kind && item.receipt?.status === 'succeeded')
      const invoke = async (operation: Operation) => {
        assertActive()
        // An intent predates this continuation's policy. Replaying its identity
        // can still perform the action when the prior process never reached Git.
        // Keep uncertain intents and completed receipts; a policy edit cannot
        // authorize a removed phase or its former publication destination.
        if (request.policy[operation.kind] !== 'after-plan' ||
          operation.kind === 'merge' && operation.request.targetBranch !== request.policy.targetBranch ||
          operation.kind === 'push' && operation.request.remote !== request.policy.remote) {
          throw new Error(`Saved Git ${operation.kind} intent is not authorized by the current policy. Inspect its durable operation receipt before continuing.`)
        }
        const receipt = operation.kind === 'commit' ? await this.options.git.commit(operation.request) : operation.kind === 'merge' ? await this.options.git.merge(operation.request) : await this.options.git.push(operation.request)
        operation.receipt = receipt
        await save()
        await publish('blocked', receipt.status === 'succeeded' ? 'Git finalization is continuing' : receipt.error || receipt.stderr || `Git ${receipt.kind}: ${receipt.status}`)
        if (receipt.status !== 'succeeded') throw new Error(receipt.error || receipt.stderr || `Git ${receipt.kind}: ${receipt.status}`)
        assertActive()
      }
      // Recover an intent without a local result by replaying its exact identity.
      // GitService inspects pending durable receipts and never blindly repeats uncertain mutations.
      for (const operation of ledger.operations.filter(item => !item.receipt)) await invoke(operation)
      if (ledger.operations.some(item => item.receipt?.status === 'pending' || item.receipt?.status === 'interrupted')) throw new Error('A previous Git operation has an uncertain result. Inspect its receipt before continuing.')
      const expectedHead = () => complete('commit')?.receipt?.afterHead || ledger!.initialHead
      const inspected = async (requireClean: boolean): Promise<GitStatus> => {
        assertActive()
        const state = await this.options.git.status({ taskId: request.taskId })
        if (state.head !== expectedHead() || state.removed) throw new Error('Task HEAD changed after verification; automatic publication stopped')
        if (state.conflicts.length || requireClean && !state.clean) throw new Error('The verified task must be clean before merge or push; inspect its changes')
        if (!complete('commit')) { await request.assertVerified(); if (state.fingerprint !== ledger!.initialStatus) throw new Error('Task files or index changed after verification') }
        return state
      }
      const add = async (operation: Operation) => {
        if (ledger!.operations.filter(item => item.kind === operation.kind).length >= 10) throw new Error('Git phase retry limit reached; inspect the recorded operations')
        ledger!.operations.push(operation); await save(); await invoke(operation)
      }
      if (request.policy.commit === 'after-plan' && !complete('commit') && ledger.paths.length) {
        await inspected(false)
        await add({ kind: 'commit', request: { taskId: request.taskId, operationId: `wf-commit-${randomUUID()}`, expectedHead: ledger.initialHead, expectedStatusFingerprint: ledger.initialStatus, message: `ZIAForge verified plan ${request.workflowRunId}`, paths: ledger.paths } })
      }
      if (request.policy.merge === 'after-plan') {
        const prior = complete('merge')
        if (prior && prior.kind === 'merge' && prior.request.targetBranch !== request.policy.targetBranch) throw new Error('This plan already merged into another target; inspect the saved receipt')
        if (!prior) {
          const state = await inspected(true)
          const branch = state.branches?.find(item => item.name === request.policy.targetBranch)
          if (!branch || branch.name === state.branch) throw new Error('Select another existing local target branch for automatic merge')
          await add({ kind: 'merge', request: { taskId: request.taskId, operationId: `wf-merge-${randomUUID()}`, expectedHead: state.head, targetBranch: branch.name, expectedTargetHead: branch.head } })
        }
      }
      if (request.policy.push === 'after-plan') {
        const prior = complete('push')
        if (prior && prior.kind === 'push' && prior.request.remote !== request.policy.remote) throw new Error('This plan already pushed to another remote; inspect the saved receipt')
        if (!prior) {
          const state = await inspected(true)
          if (!request.policy.remote || !state.remotes?.includes(request.policy.remote)) throw new Error('Select an existing remote for automatic push')
          await add({ kind: 'push', request: { taskId: request.taskId, operationId: `wf-push-${randomUUID()}`, expectedHead: state.head, remote: request.policy.remote } })
        }
      }
      await inspected(Boolean(complete('commit') || request.policy.merge === 'after-plan' || request.policy.push === 'after-plan'))
      return await publish('completed')
    } catch (error) { return publish('blocked', errorText(error)) }
  }
}
