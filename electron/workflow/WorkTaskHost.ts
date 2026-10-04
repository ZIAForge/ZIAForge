import path from 'node:path'
import fs from 'node:fs'
import type { WorkFlowDefinition } from '../../shared/work-flow'
import type { WorkflowAgentRunnerOptions } from './WorkflowAgentRunner'
import { createWorkflowAgentRunner } from './WorkflowAgentRunner'
import { WorkFlowEngine } from './WorkTaskEngine'
import { WorkArtifactStore } from './WorkArtifacts'
import { VerificationRunner, type VerificationReceipt } from './VerificationRunner'
import { folderEvidence, resolveExecutable } from './WorkflowHost'
import { verificationExcerpt } from './WorkflowEngine'

export interface WorkFlowHostOptions extends WorkflowAgentRunnerOptions {
  directory: string
  taskCwd(taskId: string): string
  artifactRoot(taskId: string): string
  validateTask(taskId: string): void | Promise<void>
  prepareDefinition?(taskId: string, definition: WorkFlowDefinition, previous?: WorkFlowDefinition): WorkFlowDefinition
  validateInputs(taskId: string, inputs: WorkFlowDefinition['inputs']): void | Promise<void>
  acquireWorkspace(taskId: string): (() => void) | Promise<() => void>
  env(): NodeJS.ProcessEnv
}
export function createWorkFlowHost(options: WorkFlowHostOptions) {
  const runner = new VerificationRunner({ directory: path.join(options.directory, 'verification'), env: options.env() })
  const artifacts = new WorkArtifactStore(options.artifactRoot, options.taskCwd)
  const engine = new WorkFlowEngine({
    directory: path.join(options.directory, 'plans'),
    validateTask: options.validateTask, prepareDefinition: options.prepareDefinition, validateInputs: options.validateInputs, acquireWorkspace: options.acquireWorkspace,
    runAgent: createWorkflowAgentRunner(options),
    async recoverInvocation(request) {
      const snapshot = await options.sessions().attach(request)
      if (!snapshot?.lastTurn || snapshot.lastTurn.clientMessageId !== request.clientMessageId) return { status: 'uncertain' }
      if (snapshot.lastTurn.status === 'interrupted' && !snapshot.activeTurn) return { status: 'interrupted' }
      if (snapshot.lastTurn.status !== 'completed') return { status: 'uncertain' }
      const index = snapshot.feed.findIndex(item => item.id === `user-${request.clientMessageId}`)
      if (index < 0) return { status: 'uncertain' }
      return { status: 'completed', output: snapshot.feed.slice(index + 1).filter(item => item.role === 'assistant').map(item => item.text).join('\n') }
    },
    async abandonInvocation(request) {
      const snapshot = await options.sessions().attach(request)
      if (snapshot && !['stopped', 'disconnected'].includes(snapshot.sessionStatus)) await options.sessions().terminate(snapshot)
    },
    evidence: taskId => folderEvidence(options.taskCwd(taskId)),
    writeArtifacts: (request, signal) => artifacts.write(request, signal),
    artifactContext: (taskId, receipts) => artifacts.context(taskId, receipts),
    async verify(request, signal) {
      await options.validateTask(request.taskId)
      const command = { executable: resolveExecutable(request.command.executable, options.env()), args: [...request.command.args] }
      const cwd = options.taskCwd(request.taskId)
      const directory = path.join(options.directory, 'verification', request.id)
      let receipt: VerificationReceipt | undefined
      // A command may have finished before its engine checkpoint. Reuse only the
      // exact durable runner receipt, never rerun the command under that identity.
      let descriptor: number | undefined
      try {
        descriptor = fs.openSync(path.join(directory, 'receipt.json'), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
        if (fs.fstatSync(descriptor).size > 100000) throw new Error('Work verification receipt is oversized')
        const saved = JSON.parse(fs.readFileSync(descriptor, 'utf8')) as VerificationReceipt
        if (saved.schemaVersion !== 1 || saved.verificationId !== request.id || saved.cwd !== cwd || saved.inputFingerprint !== request.inputFingerprint || JSON.stringify(saved.command) !== JSON.stringify(command) || saved.timeoutMs !== request.command.timeoutMs || !['passed', 'failed', 'cancelled', 'timed_out', 'output_limit', 'cleanup_failed'].includes(saved.status) || typeof saved.cleanupVerified !== 'boolean' || saved.exitCode !== null && !Number.isInteger(saved.exitCode) || saved.stdoutPath !== path.join(directory, 'stdout.log') || saved.stderrPath !== path.join(directory, 'stderr.log') || fs.realpathSync(directory) !== directory) throw new Error('Work verification receipt does not match this invocation')
        receipt = saved
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      finally { if (descriptor !== undefined) fs.closeSync(descriptor) }
      receipt ??= await runner.run({ verificationId: request.id, cwd, command, timeoutMs: request.command.timeoutMs, inputFingerprint: request.inputFingerprint }, signal)
      return { id: receipt.verificationId, status: receipt.status, command: request.command, exitCode: receipt.exitCode, cleanupVerified: receipt.cleanupVerified, stdoutPath: receipt.stdoutPath, stderrPath: receipt.stderrPath, inputFingerprint: receipt.inputFingerprint, error: receipt.error, stdout: await verificationExcerpt(receipt.stdoutPath), stderr: await verificationExcerpt(receipt.stderrPath) }
    },
  })
  return { engine, artifacts, async shutdown() { try { await engine.shutdown() } finally { await runner.dispose() } } }
}
