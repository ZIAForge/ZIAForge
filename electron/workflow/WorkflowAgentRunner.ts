import { randomUUID } from 'node:crypto'
import type { AgentSessionRef, AgentSessionSnapshot } from '../../shared/agent-session'
import type { PersistedAgentLaunch, SessionManager, TrustedAgentSessionConfig } from '../runtime/SessionManager'
import type { WorkflowAgentRequest, WorkflowEngineOptions } from './WorkflowEngine'

export interface WorkflowAgentRunnerOptions {
  sessions(): SessionManager
  resolveLaunch(request: WorkflowAgentRequest, frozen?: PersistedAgentLaunch): Promise<TrustedAgentSessionConfig>
  beforeLaunch?(request: WorkflowAgentRequest): void
}
const failIfAborted = (signal: AbortSignal) => { if (signal.aborted) throw new Error('Workflow paused') }
export class WorkflowAgentCleanupError extends Error {
  constructor(readonly session: AgentSessionRef & { chatId: string }, cause: unknown) {
    super(`Owned agent cleanup failed; no new context may start until termination succeeds: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}
/** Shared native delivery/ownership path for Code and Work. */
export function createWorkflowAgentRunner(options: WorkflowAgentRunnerOptions): WorkflowEngineOptions['runAgent'] {
  return async (request, signal, onSession) => {
      failIfAborted(signal)
      const sessions = options.sessions()
      let snapshot = await sessions.attach(request)
      if (!snapshot) {
        const launch = await options.resolveLaunch(request)
        failIfAborted(signal); options.beforeLaunch?.(request)
        snapshot = await sessions.create(launch)
      } else if (snapshot.sessionStatus !== 'ready') {
        const launch = await options.resolveLaunch(request, sessions.persistedLaunch(snapshot))
        failIfAborted(signal); options.beforeLaunch?.(request)
        snapshot = await sessions.resume(snapshot, launch)
      }
      if (request.toolPolicy === 'none' && sessions.persistedLaunch(snapshot).toolPolicy !== 'none') throw new Error('Architect context does not have enforced tool isolation')
      const ref = { sessionId: snapshot.sessionId, runId: snapshot.runId }
      const terminate = async () => {
        try { await sessions.terminate(ref) }
        catch (error) { throw new WorkflowAgentCleanupError({ ...ref, chatId: request.chatId }, error) }
      }
      // A pause while CLI startup was pending still owns and stops the new process.
      if (signal.aborted) { await terminate(); failIfAborted(signal) }
      try { await onSession({ ...ref, chatId: request.chatId }) }
      catch (error) { await terminate(); throw error }
      const clientMessageId = request.clientMessageId ?? `wf-message-${randomUUID()}`
      let finish!: (value: string) => void
      let fail!: (error: Error) => void
      let settled = false
      const completed = new Promise<string>((resolve, reject) => { finish = resolve; fail = reject })
      const reject = (error: Error) => { if (!settled) { settled = true; fail(error) } }
      const inspect = (current: AgentSessionSnapshot) => {
        if (current.sessionId !== ref.sessionId || current.runId !== ref.runId) return
        if (current.lastTurn?.clientMessageId === clientMessageId) {
          if (current.lastTurn.status !== 'completed') { reject(new Error(current.lastTurn.error ?? `Agent turn ${current.lastTurn.status}`)); return }
          const userIndex = current.feed.findIndex(item => item.id === `user-${clientMessageId}`)
          if (userIndex < 0) { reject(new Error('Agent completion has no matching persisted input')); return }
          const output = current.feed.slice(userIndex + 1).filter(item => item.role === 'assistant').map(item => item.text).join('\n')
          if (!settled) { settled = true; finish(output) }
        } else if (['error', 'stopped', 'disconnected'].includes(current.sessionStatus)) reject(new Error(current.error ?? 'Agent session ended before completion'))
      }
      const off = sessions.onEvent(update => inspect(update.snapshot))
      const abort = () => reject(new Error('Workflow paused'))
      signal.addEventListener('abort', abort, { once: true })
      const timeout = setTimeout(() => reject(new Error('Agent step timed out after 30 minutes')), 30 * 60 * 1000)
      try {
        failIfAborted(signal)
        // A completed invocation can be replayed by identity without a second
        // send. An interrupted process/unknown delivery is left to the engine's
        // explicit resume boundary, never silently retried as a new message.
        inspect(await sessions.snapshot(ref))
        if (settled) return await completed
        options.beforeLaunch?.(request)
        const delivery = sessions.send({ ...ref, clientMessageId, text: request.prompt })
        // Attach rejection handling immediately even when an abort wins the race.
        void delivery.then(async receipt => {
          if (receipt.outcome === 'rejected') reject(new Error(receipt.error ?? 'Agent rejected the step'))
          else inspect(await sessions.snapshot(ref))
        }).catch(error => reject(error instanceof Error ? error : new Error(String(error))))
        return await completed
      } catch (error) {
        await terminate()
        throw error
      } finally {
        clearTimeout(timeout); signal.removeEventListener('abort', abort); off()
      }
    }
}
