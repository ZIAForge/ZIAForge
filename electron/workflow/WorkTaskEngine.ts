import path from 'node:path'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import type { WorkArtifactReceipt, WorkExecutionStep, WorkFlowDefinition, WorkFlowResponse, WorkFlowSnapshot, WorkFollowUpRequest, WorkGate, WorkInvocation, WorkPhase, WorkPhaseResult, WorkStageRecord } from '../../shared/work-flow'
import type { WorkflowAgentRequest, WorkflowEngineOptions } from './WorkflowEngine'
import { RecoveryStore } from '../runtime/RecoveryStore'
import { ensurePrivateDirectory } from '../runtime/privateStorage'
import { workflowId } from './WorkflowValidation'
import { validateWorkCommand, validateWorkDefinition, validateWorkSnapshot } from './WorkTaskValidation'
import { parseWorkResult } from './WorkTaskProtocol'
import { anonymousWorkReports, conservativeWorkAggregation, workArchitectPrompt, workStagePrompt } from './WorkTaskPrompts'

export interface WorkEngineOptions {
  directory: string
  runAgent: WorkflowEngineOptions['runAgent']
  recoverInvocation?(request: WorkflowAgentRequest): Promise<{ status: 'completed'; output: string } | { status: 'interrupted' | 'uncertain' }>
  abandonInvocation?(request: WorkflowAgentRequest): Promise<void>
  verify: WorkflowEngineOptions['verify']
  evidence(taskId: string): Promise<string>
  validateTask(taskId: string): void | Promise<void>
  prepareDefinition?(taskId: string, definition: WorkFlowDefinition, previous?: WorkFlowDefinition): WorkFlowDefinition
  validateInputs(taskId: string, inputs: WorkFlowDefinition['inputs']): void | Promise<void>
  acquireWorkspace(taskId: string): (() => void) | Promise<() => void>
  writeArtifacts(request: { taskId: string; stageId: string; invocationId: string; result: WorkPhaseResult; previous: WorkArtifactReceipt[]; publish?: boolean }, signal: AbortSignal): Promise<WorkArtifactReceipt[]>
  artifactContext(taskId: string, receipts: WorkArtifactReceipt[]): Promise<string>
}
interface Entry { state: WorkFlowSnapshot; writes: Promise<void>; active?: Promise<void>; controller?: AbortController; release?: () => void }
const copy = <T>(value: T): T => structuredClone(value)
const hash = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).replaceAll('\0', '\uFFFD').slice(0, 20000)
const abort = (signal: AbortSignal) => { if (signal.aborted) throw new Error('Work paused by user') }
const lastResult = (stage: WorkStageRecord) => stage.invocations.at(-1)?.result
class WorkCompletedFormatError extends Error {}
class WorkVerificationError extends Error { constructor(readonly stageId: string, reason: string) { super(reason) } }
class WorkUncertainDeliveryError extends Error { constructor(readonly stageId: string) { super('The previous delivery has an unknown outcome. Inspect its phase chat and files. Continue explicitly closes that owned session and creates a fresh recovery context; partial work is preserved and no old message is replayed.') } }

/** Work orchestration owns decisions and receipts; the shared runner owns native delivery. */
export class WorkFlowEngine {
  private entries = new Map<string, Entry>()
  private commands = new Map<string, Promise<unknown>>()
  private listeners = new Set<(state: WorkFlowSnapshot) => void>()
  private closing = false
  private stoppedTasks = new Set<string>()
  constructor(private readonly options: WorkEngineOptions) {}
  onEvent(listener: (snapshot: WorkFlowSnapshot) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private storage(taskId: string) { workflowId(taskId); return new RecoveryStore<WorkFlowSnapshot>({ filename: path.join(this.options.directory, taskId, 'work-flow.json'), validate: (value): asserts value is WorkFlowSnapshot => validateWorkSnapshot(value, taskId) }) }
  private recoveryGeneration(taskId: string, reserve = false): number {
    workflowId(taskId)
    const directory = path.join(this.options.directory, taskId, 'restore-generations')
    ensurePrivateDirectory(directory)
    const highest = () => {
      const names = fs.readdirSync(directory)
      if (names.length > 10000) throw new Error('Work recovery history exceeds its bounded limit')
      let latest = 0
      for (const name of names) {
        const filename = path.join(directory, name), stat = fs.lstatSync(filename)
        if (!/^[0-9]{12}$/.test(name) || !Number.isSafeInteger(Number(name)) || Number(name) < 1 || stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(filename) !== filename) throw new Error('Work recovery ownership marker is unsafe')
        latest = Math.max(latest, Number(name))
      }
      return latest
    }
    if (!reserve) return highest()
    const parent = fs.openSync(path.dirname(directory), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
    try { fs.fsyncSync(parent) } finally { fs.closeSync(parent) }
    for (let attempt = 0; attempt < 8; attempt++) {
      const generation = highest() + 1
      if (generation > 999999999999) throw new Error('Work recovery identity limit reached')
      try { fs.mkdirSync(path.join(directory, String(generation).padStart(12, '0')), { mode: 0o700 }) }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue; throw error }
      const descriptor = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW)
      try { fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }
      return generation
    }
    throw new Error('Concurrent Work recovery changed its ownership; inspect again')
  }
  async inspectRecovery(taskId: string) { return this.storage(taskId).inspect() }
  async restoreRecovery(taskId: string, request: { expectedFingerprint: string; backupId: string }) {
    return this.serial(taskId, async () => {
      if (this.closing || this.entries.get(taskId)?.active) throw new Error('Pause Work before recovery')
      await this.options.validateTask(taskId)
      const inspection = this.storage(taskId).inspect()
      if (inspection.state !== 'corrupt' || inspection.fingerprint !== request.expectedFingerprint || !inspection.backups.some(item => item.id === request.backupId)) throw new Error('Work recovery selection changed. Inspect the damaged document again.')
      // This irreversible intent precedes the metadata rollback and is never
      // part of its backup. A crash before/after restore therefore cannot erase
      // the explicit fresh-context decision for possibly delivered old calls.
      this.recoveryGeneration(taskId, true)
      this.entries.delete(taskId)
      return this.storage(taskId).restore(request)
    })
  }
  private async serial<T>(taskId: string, operation: () => Promise<T>): Promise<T> {
    workflowId(taskId)
    const next = (this.commands.get(taskId) ?? Promise.resolve()).catch(() => {}).then(operation)
    this.commands.set(taskId, next)
    try { return await next } finally { if (this.commands.get(taskId) === next) this.commands.delete(taskId) }
  }
  private async change(entry: Entry, mutate: (state: WorkFlowSnapshot) => void) {
    let entered = false, persisting = false
    const write = entry.writes.then(() => {
      entered = true
      const state = copy(entry.state); mutate(state); state.sequence++; state.updatedAt = Date.now()
      validateWorkSnapshot(state, state.taskId)
      persisting = true
      this.storage(state.taskId).write(state); entry.state = state
      for (const listener of this.listeners) { try { listener(copy(state)) } catch { /* UI observers cannot invalidate a persisted transition. */ } }
    })
    // Invalid transitions are recoverable application errors. Only an actual
    // uncertain durable write (or a previously poisoned chain) fences storage.
    entry.writes = write.catch(error => { if (!entered || persisting) throw error })
    void entry.writes.catch(() => {})
    await write
  }
  private async load(taskId: string): Promise<Entry | undefined> {
    const current = this.entries.get(taskId)
    const generation = this.recoveryGeneration(taskId)
    if (current && (current.state.recoveryGeneration ?? 0) === generation) { await current.writes; return current }
    if (current?.active) throw new Error('Work recovery changed while an invocation was active; pause before inspecting')
    const state = this.storage(taskId).read(); if (!state) return
    const entry: Entry = { state, writes: Promise.resolve() }
    if ((state.recoveryGeneration ?? 0) !== generation) {
      if (!generation || generation < (state.recoveryGeneration ?? 0)) throw new Error('Work recovery ownership marker is missing; restored actions cannot be resumed')
      await this.change(entry, next => {
        next.recoveryGeneration = generation; next.revision++
        // Retain evidence as history, but never schedule a restored old delivery.
        for (const stage of next.stages) { stage.transitioned = true; if (['pending', 'running', 'waiting_input', 'uncertain'].includes(stage.status)) { stage.status = 'interrupted'; stage.error = 'Superseded by explicit metadata recovery; retained as history.' } }
        const recovery = this.stage(next, 'intake', next.definition.executor, { id: `work-restore-${generation}`, forceContinuation: true, contextVersion: generation })
        next.stages.push(recovery)
        this.gate(next, recovery, 'recovery', 'A workflow backup was restored. Newer calls may already have run. Inspect the current files and retained chats. Continue explicitly starts a fresh context from those files; it never replays restored messages or assumes that old actions did not happen.', { id: `work-restore-decision-${generation}`, artifactIds: [] })
      })
    }
    if (entry.state.status === 'running') await this.change(entry, next => {
      next.status = 'paused'; next.reason = 'Work was interrupted by application restart. Continue explicitly; uncertain deliveries will not be resent.'
      for (const stage of next.stages) if (stage.status === 'running') {
        stage.status = 'interrupted'
        const invocation = stage.invocations.at(-1)
        if (invocation?.status === 'running') invocation.status = 'uncertain'
      }
    })
    this.entries.set(taskId, entry); return entry
  }
  private available(taskId: string) { if (this.closing || this.stoppedTasks.has(taskId)) throw new Error('Work task is shutting down or being removed') }
  async get(taskId: string): Promise<WorkFlowSnapshot | null> { return this.serial(taskId, async () => { await this.options.validateTask(taskId); return copy((await this.load(taskId))?.state ?? null) }) }
  async withDraftWorkspace<T>(taskId: string, operation: (snapshot: WorkFlowSnapshot) => T): Promise<T> {
    return this.serial(taskId, async () => {
      this.available(taskId); await this.options.validateTask(taskId)
      const entry = await this.load(taskId)
      if (!entry || entry.active || entry.state.status !== 'draft' || entry.state.stages.some(stage => stage.invocations.length)) throw new Error('Work folder can only change before the first invocation')
      return operation(copy(entry.state))
    })
  }
  async save(taskId: string, expectedRevision: number, definition: WorkFlowDefinition): Promise<WorkFlowSnapshot> {
    validateWorkCommand('save', { taskId, expectedRevision, definition }); const supplied = copy(definition)
    return this.serial(taskId, async () => {
      this.available(taskId); await this.options.validateTask(taskId)
      let entry = await this.load(taskId)
      if ((entry?.state.revision ?? 0) !== expectedRevision) throw new Error('Work definition changed. Reload before saving.')
      if (entry?.active) throw new Error('Pause Work before changing its configuration')
      if ((entry?.state.turns || entry?.state.recoveryGeneration) && hash({ ...entry.state.definition, advance: undefined }) !== hash({ ...supplied, advance: undefined })) throw new Error('Started Work retains its original inputs and role configurations. Create a new task to change them.')
      const frozen = this.options.prepareDefinition?.(taskId, supplied, entry ? copy(entry.state.definition) : undefined) ?? supplied
      validateWorkDefinition(frozen)
      await this.options.validateInputs(taskId, frozen.inputs)
      if (!entry) entry = { writes: Promise.resolve(), state: { schemaVersion: 1, taskId, runId: `work-${randomUUID()}`, revision: 0, sequence: 0, definition: frozen, status: 'draft', stages: [], artifacts: [], sources: [], decisions: [], commandReceipts: [], round: 0, turns: 0, failures: 0, updatedAt: Date.now() } }
      await this.change(entry, state => { state.definition = frozen; state.revision++ })
      this.entries.set(taskId, entry); return copy(entry.state)
    })
  }
  private replay(state: WorkFlowSnapshot, request: { commandId: string }): boolean {
    const previous = state.commandReceipts.find(item => item.commandId === request.commandId)
    if (!previous) return false
    if (previous.payloadHash !== hash(request)) throw new Error('Work command identity was reused with different input')
    return true
  }
  private receipt(state: WorkFlowSnapshot, request: { commandId: string }) { state.commandReceipts.push({ commandId: request.commandId, payloadHash: hash(request) }) }
  private stage(state: WorkFlowSnapshot, phase: WorkPhase, source = state.definition.executor, extra: Partial<WorkStageRecord> = {}): WorkStageRecord {
    return { id: `work-stage-${randomUUID()}`, phase, round: state.round, source: copy(source), sourceId: source.id, status: 'pending', configurationHash: hash(source), inputFingerprint: hash(''), invocations: [], artifactIds: [], reportRepairCount: 0, verification: [], ...extra }
  }
  async start(request: { taskId: string; revision: number; commandId: string }): Promise<WorkFlowSnapshot> {
    validateWorkCommand('start', request)
    return this.serial(request.taskId, async () => {
      this.available(request.taskId); await this.options.validateTask(request.taskId)
      const entry = await this.load(request.taskId); if (!entry) throw new Error('Save Work before starting')
      if (this.replay(entry.state, request)) return copy(entry.state)
      if (entry.state.revision !== request.revision) throw new Error('Work revision changed')
      if (entry.state.pending) throw new Error('Resolve the current Work decision before continuing')
      if (entry.active || ['completed', 'cancelled'].includes(entry.state.status)) return copy(entry.state)
      if (entry.state.turns >= entry.state.definition.limits.maxTurns || entry.state.failures >= entry.state.definition.limits.maxFailures) throw new Error('Work reached its explicit execution budget. Inspect the retained results before starting a new task.')
      await this.options.validateInputs(request.taskId, entry.state.definition.inputs)
      const release = await this.options.acquireWorkspace(request.taskId)
      try {
        this.available(request.taskId)
        await this.change(entry, state => {
          this.receipt(state, request); state.status = 'running'; state.reason = undefined
          if (!state.stages.length) { for (const [index, source] of (state.definition.helpers ?? []).entries()) state.stages.push(this.stage(state, 'helper', source, { reportName: `helper_${index + 1}.md` })); state.stages.push(this.stage(state, 'intake')) }
          for (const stage of state.stages) if (['failed', 'interrupted', 'uncertain'].includes(stage.status) && stage.phase !== 'worker') stage.status = 'pending'
        })
      } catch (error) { release(); throw error }
      this.launch(entry, release); return copy(entry.state)
    })
  }
  private launch(entry: Entry, release: () => void) {
    const controller = new AbortController(); entry.controller = controller; entry.release = release
    entry.active = this.execute(entry, controller.signal).finally(() => { release(); if (entry.controller === controller) { entry.active = undefined; entry.controller = undefined; entry.release = undefined } })
    void entry.active.catch(() => {})
  }
  private async runAfterDecision(entry: Entry) {
    if (entry.state.status !== 'running') return
    this.available(entry.state.taskId)
    try {
      const release = await this.options.acquireWorkspace(entry.state.taskId)
      if (this.closing) { release(); throw new Error('Work is shutting down') }
      this.launch(entry, release)
    } catch (error) { await this.change(entry, state => { state.status = 'paused'; state.reason = message(error) }); throw error }
  }
  async respond(request: WorkFlowResponse): Promise<WorkFlowSnapshot> {
    validateWorkCommand('respond', request)
    return this.serial(request.taskId, async () => {
      this.available(request.taskId); await this.options.validateTask(request.taskId)
      const entry = await this.load(request.taskId); if (!entry) throw new Error('Work task is missing')
      if (this.replay(entry.state, request)) return copy(entry.state)
      const gate = entry.state.pending
      if (!gate || entry.active || entry.state.runId !== request.runId || entry.state.revision !== request.revision || gate.id !== request.gateId || !gate.actions.includes(request.action)) throw new Error('Work checkpoint changed. Reload before responding.')
      if (request.action !== 'cancel') { await this.options.validateInputs(request.taskId, entry.state.definition.inputs); await this.options.artifactContext(request.taskId, entry.state.artifacts.filter(item => gate.artifactIds.includes(item.id))) }
      if (request.action === 'changes' && !request.text?.trim()) throw new Error('Describe the requested changes')
      const owner = entry.state.stages.find(stage => stage.id === gate.stageId)!
      if (['approve', 'approve-with-comments', 'finish', 'continue', 'evaluate'].includes(request.action) && owner.outputFingerprint && owner.outputFingerprint !== hash(await this.options.evidence(request.taskId))) throw new Error('Work files changed since this decision. The retained result cannot authorize changed inputs.')
      if (request.action === 'answer') {
        const answers = request.answers ?? []
        if (!gate.questions || answers.length !== gate.questions.length || new Set(answers.map(item => item.questionId)).size !== answers.length || gate.questions.some(question => !answers.some(answer => answer.questionId === question.id && answer.text.trim()))) throw new Error('Answer every current Work question exactly once')
      }
      if (gate.kind === 'recovery' && request.action === 'continue') { const call = owner.invocations.at(-1); if (call) await this.options.abandonInvocation?.(this.request(entry.state, owner, call)); this.available(request.taskId) }
      await this.change(entry, state => {
        this.receipt(state, request); state.revision++; state.decisions.push({ commandId: request.commandId, gateId: gate.id, action: request.action, text: request.text, answers: request.answers, questions: gate.questions, at: Date.now() }); state.pending = undefined; state.reason = undefined
        state.status = request.action === 'cancel' ? 'cancelled' : 'running'
        const stage = state.stages.find(item => item.id === gate.stageId)!
        if (request.action === 'cancel') return
        if (gate.kind === 'recovery') { stage.contextVersion = (stage.contextVersion ?? 0) + 1; stage.forceContinuation = true; stage.status = 'pending'; stage.transitioned = false }
        else if (request.action === 'answer') { for (const id of new Set(gate.questions!.flatMap(question => question.stageIds))) { const target = state.stages.find(item => item.id === id)!; target.status = 'pending'; target.transitioned = false } }
        else if (gate.kind === 'plan') {
          if (request.action === 'changes') state.stages.push(this.stage(state, 'planning'))
          else { state.plan = copy(gate.proposedSteps!); state.stages.push(this.stage(state, 'execution', state.definition.executor, { stepId: state.plan[0].id })) }
        } else if (gate.kind === 'brainstorm-direction') {
          if (request.action === 'finish') this.finish(state, stage, false, true)
          else state.stages.push(this.stage(state, request.action === 'more' ? 'divergence' : 'convergence'))
        } else if (gate.kind === 'artifact-review') {
          if (request.action === 'changes') {
            if (state.round >= state.definition.limits.maxFollowUps) throw new Error('Work follow-up limit reached')
            state.round++; state.stages.push(this.stage(state, stage.stepId ? 'execution' : state.definition.kind === 'deep-brainstorm' ? 'follow-up' : 'revision', state.definition.executor, { stepId: stage.stepId, reportName: state.definition.kind === 'deep-brainstorm' ? undefined : stage.reportName }))
          } else state.status = 'completed'
        } else if (gate.kind === 'outline') state.stages.push(this.stage(state, request.action === 'changes' ? 'outline' : 'draft'))
        // continue gate retains already prepared pending next stages.
      })
      await this.runAfterDecision(entry); return copy(entry.state)
    })
  }
  async followUp(request: WorkFollowUpRequest): Promise<WorkFlowSnapshot> {
    validateWorkCommand('followUp', request)
    return this.serial(request.taskId, async () => {
      this.available(request.taskId); await this.options.validateTask(request.taskId)
      const entry = await this.load(request.taskId); if (!entry) throw new Error('Work task is missing')
      if (this.replay(entry.state, request)) return copy(entry.state)
      if (entry.active || entry.state.status !== 'completed' || entry.state.pending || entry.state.runId !== request.runId || entry.state.revision !== request.revision) throw new Error('Follow-up requires the current completed Work result')
      if (entry.state.round >= entry.state.definition.limits.maxFollowUps) throw new Error('Work follow-up limit reached')
      if (request.artifactId && !entry.state.artifacts.some(item => item.id === request.artifactId)) throw new Error('Follow-up artifact is not part of this task')
      await this.options.validateInputs(request.taskId, entry.state.definition.inputs); await this.options.artifactContext(request.taskId, entry.state.artifacts)
      await this.change(entry, state => { this.receipt(state, request); state.revision++; state.round++; state.status = 'running'; state.decisions.push({ commandId: request.commandId, action: 'follow-up', text: request.text, at: Date.now() }); state.stages.push(this.stage(state, 'follow-up')) })
      await this.runAfterDecision(entry); return copy(entry.state)
    })
  }
  async pause(taskId: string): Promise<WorkFlowSnapshot> {
    return this.serial(taskId, async () => {
      const entry = await this.load(taskId); if (!entry) throw new Error('Work task is missing')
      entry.controller?.abort(); await entry.active?.catch(() => {})
      await this.change(entry, state => { if (!['completed', 'cancelled'].includes(state.status)) { state.status = 'paused'; state.reason = 'Paused by user' } })
      return copy(entry.state)
    })
  }
  async stopTasks(taskIds: string[]) { taskIds.forEach(id => { workflowId(id); this.stoppedTasks.add(id); this.entries.get(id)?.controller?.abort() }); await Promise.allSettled(taskIds.map(async id => { const entry = this.entries.get(id); if (entry?.active) await entry.active })); }
  async shutdown() { this.closing = true; for (const entry of this.entries.values()) entry.controller?.abort(); await Promise.allSettled([...this.commands.values()]); for (const entry of this.entries.values()) entry.controller?.abort(); await Promise.allSettled([...this.entries.values()].map(entry => entry.active)); }
  private gate(state: WorkFlowSnapshot, stage: WorkStageRecord, kind: WorkGate['kind'], summary: string, extra: Partial<WorkGate> = {}) {
    const actions: Record<WorkGate['kind'], WorkGate['actions']> = { questions: ['answer', 'cancel'], 'brainstorm-direction': ['more', 'evaluate', 'finish', 'cancel'], plan: ['approve', 'changes', 'cancel'], outline: ['approve', 'changes', 'cancel'], 'artifact-review': ['approve', 'approve-with-comments', 'changes', 'cancel'], continue: ['continue', 'cancel'], recovery: ['continue', 'cancel'] }
    state.pending = { id: `work-gate-${randomUUID()}`, kind, stageId: stage.id, summary, artifactIds: [...stage.artifactIds], actions: actions[kind], ...extra }; state.status = 'waiting'; state.reason = summary
  }
  private async context(entry: Entry, stage: WorkStageRecord): Promise<string> {
    const state = entry.state
    const receipts = stage.phase === 'worker' ? state.round === 0 ? [] : state.artifacts.filter(item => item.name === 'brainstorm_report.md' && state.stages.find(origin => origin.id === item.stageId)!.round < stage.round) : stage.phase === 'review' ? state.artifacts.filter(item => !['review', 'review-architect'].includes(state.stages.find(origin => origin.id === item.stageId)!.phase)) : state.artifacts
    const artifacts = await this.options.artifactContext(state.taskId, receipts)
    const outcomes = stage.phase === 'worker' ? [] : state.stages.filter(item => item.round === state.round && item.id !== stage.id && (stage.phase !== 'review' || !['review', 'review-architect'].includes(item.phase))).map(item => ({ id: item.id, phase: item.phase, sourceId: item.sourceId, status: item.status, error: item.error, summary: lastResult(item)?.summary }))
    return `Explicit input manifest (relative paths are under the assigned cwd):\n${JSON.stringify(state.definition.inputs)}\nUser decisions and follow-up request:\n${JSON.stringify(state.decisions).slice(-80000)}\nVerified artifacts:\n${artifacts}\nStage outcomes:\n${JSON.stringify(outcomes).slice(-50000)}`
  }
  private request(state: WorkFlowSnapshot, stage: WorkStageRecord, invocation: WorkInvocation): WorkflowAgentRequest {
    return { taskId: state.taskId, chatId: `wf-${stage.id}${stage.contextVersion ? `-v${stage.contextVersion}` : ''}`, clientMessageId: invocation.clientMessageId, presetName: stage.source.presetName, configuration: stage.source.configuration, reasoningEffort: stage.source.reasoningEffort, permissions: stage.source.permissions, role: stage.phase === 'review-architect' ? 'architect' : stage.phase === 'review' ? 'reviewer' : ['worker', 'helper'].includes(stage.phase) ? 'helper' : 'coder', ...(stage.phase === 'review-architect' ? { toolPolicy: 'none' as const } : {}), prompt: invocation.prompt }
  }
  private async invoke(entry: Entry, stageId: string, signal: AbortSignal): Promise<void> {
    abort(signal); this.available(entry.state.taskId)
    await this.options.validateTask(entry.state.taskId); await this.options.validateInputs(entry.state.taskId, entry.state.definition.inputs)
    const stage = entry.state.stages.find(item => item.id === stageId)!
    if (stage.status === 'completed' || stage.status === 'waiting_input') return
    if (stage.configurationHash !== hash(stage.source)) throw new Error('Work role configuration changed')
    const before = await this.options.evidence(entry.state.taskId)
    const reports = stage.phase === 'review-architect' ? anonymousWorkReports(entry.state, stage.reviewOf!) : undefined
    if (reports && stage.reportFingerprint !== hash(reports)) throw new Error('Anonymous Work report inputs changed before aggregation')
    if (stage.reviewOf) { const parent = entry.state.stages.find(item => item.id === stage.reviewOf)!; if (parent.outputFingerprint !== hash(before)) throw new Error('Work output changed before independent review') }
    let invocation = stage.invocations.at(-1)
    let recovered: string | null = null
    let continuation = Boolean(stage.forceContinuation)
    if (!continuation && invocation && ['running', 'uncertain', 'interrupted'].includes(invocation.status)) {
      const recovery = await this.options.recoverInvocation?.(this.request(entry.state, stage, invocation))
      if (recovery?.status === 'completed') {
        if (['worker', 'helper', 'review', 'review-architect'].includes(stage.phase) && invocation.inputFingerprint !== hash(before)) throw new WorkUncertainDeliveryError(stage.id)
        recovered = recovery.output
      }
      else if (recovery?.status === 'interrupted') continuation = true
      else throw new WorkUncertainDeliveryError(stage.id)
    }
    if (recovered === null && (continuation || !invocation || invocation.status !== 'pending')) {
      if (entry.state.turns >= entry.state.definition.limits.maxTurns) throw new Error('Work turn limit reached')
      const context = reports ? '' : await this.context(entry, stage)
      if (before.length > 400000) throw new Error('Work evidence exceeds the bounded phase context; reduce the selected folder scope')
      const step = entry.state.plan?.find(item => item.id === stage.stepId)
      const instruction = [step ? `Execute ONLY this user-approved step: ${JSON.stringify(step)}` : '', stage.phase === 'follow-up' ? 'Classify the latest user follow-up as small or large. For a large Deep request return followUpSize large without doing the worker analysis yourself. For a small request answer/update the existing report.' : '', stage.phase === 'synthesis' ? 'Synthesize the actual valid worker reports. Name remaining evidence gaps; do not claim failed workers agreed. If every worker had completed but invalid reports, do real coordinator research with at least five differentiated search queries using available research tools, disclose this fallback, and stop with questions if tools are unavailable.' : '', stage.reportRepairCount ? `Repair the missing/invalid result once in this same context. Return the complete required ${stage.reportName ?? 'report'} in the structured contract; do not redo unrelated work.` : ''].filter(Boolean).join('\n')
      const observed = stage.phase === 'worker' ? 'Only the explicit supplied inputs and canonical prior report are shared. Do not inspect peer worker reports or unrelated workspace files.' : `Current task filesystem evidence:\n${before}`
      invocation = { id: `work-inv-${randomUUID()}`, clientMessageId: `work-message-${randomUUID()}`, status: 'pending', purpose: continuation ? 'continuation' : stage.reportRepairCount ? 'repair' : stage.invocations.length ? 'answer' : 'initial', inputFingerprint: hash(before), prompt: workStagePrompt(entry.state, stage, `${context}\n${observed}`, instruction + (continuation ? '\nThe previous invocation was stopped or had an explicitly acknowledged unknown outcome. Continue from the CURRENT files. Do not repeat already completed actions, reset changes, or claim the old invocation never ran.' : '') + ('instructions' in stage.source ? `\nHelper assignment: ${String(stage.source.instructions)}` : '')) }
      // This branch deliberately bypasses the normal task/phase/reference prompt.
      if (reports) invocation.prompt = workArchitectPrompt(entry.state, reports)
      await this.change(entry, state => {
        abort(signal)
        // Parallel workers reserve their turn in the serialized durable write,
        // not against the same pre-await snapshot of the remaining budget.
        if (state.turns >= state.definition.limits.maxTurns) throw new Error('Work turn limit reached')
        const target = state.stages.find(item => item.id === stageId)!; target.invocations.push(invocation!); target.inputFingerprint = hash(before); target.status = 'running'; target.forceContinuation = undefined; state.turns++
      })
    }
    if (!invocation) throw new Error('Work invocation identity is missing')
    const identity = invocation.id
    const request = this.request(entry.state, stage, invocation)
    await this.change(entry, state => { state.stages.find(item => item.id === stageId)!.invocations.find(item => item.id === identity)!.status = 'running' })
    let output: string
    try {
      output = recovered ?? await this.options.runAgent(request, signal, async session => {
        abort(signal)
        await this.change(entry, state => { state.stages.find(item => item.id === stageId)!.invocations.find(item => item.id === identity)!.session = session })
      })
    } catch (error) {
      await this.change(entry, state => { const target = state.stages.find(item => item.id === stageId)!; const call = target.invocations.find(item => item.id === identity)!; call.status = signal.aborted ? 'interrupted' : 'uncertain'; call.error = message(error); target.status = signal.aborted ? 'interrupted' : 'uncertain'; target.error = message(error) })
      throw error
    }
    abort(signal); await this.options.validateInputs(entry.state.taskId, entry.state.definition.inputs)
    const after = await this.options.evidence(entry.state.taskId)
    if (['worker', 'helper', 'review', 'review-architect'].includes(stage.phase) && after !== before) throw new Error('A Work research worker or reviewer changed task files. Inspect the changes; its result cannot be accepted.')
    if (reports && hash(anonymousWorkReports(entry.state, stage.reviewOf!)) !== stage.reportFingerprint) throw new Error('Anonymous Work reports changed during aggregation')
    let result: WorkPhaseResult
    try {
      result = parseWorkResult(output)
      if (reports) result = conservativeWorkAggregation(result, reports, entry.state)
      if ((stage.stepId || ['worker', 'helper', 'review'].includes(stage.phase)) && !['complete', 'needs_input'].includes(result.status)) throw new Error('This assigned Work role must return its result or questions; it cannot replace the approved plan or schedule other roles')
      if (stage.phase === 'review' && !result.review) throw new Error('Independent Work review needs an explicit outcome')
      if (stage.reportName && result.status !== 'needs_input' && !result.artifacts.some(item => item.name === stage.reportName && item.content.trim())) throw new Error(`Work report ${stage.reportName} is missing`)
      if (stage.stepId && result.status === 'complete' && !result.artifacts.length && !result.outputs?.length && !entry.state.plan!.find(item => item.id === stage.stepId)!.verification.length) throw new Error('This execution step has no actual deliverable receipt or verification command')
    } catch (error) {
      await this.change(entry, state => { const target = state.stages.find(item => item.id === stageId)!; const call = target.invocations.find(item => item.id === identity)!; call.status = 'failed'; call.output = output.slice(0, 1000000); call.error = message(error); target.status = 'failed'; target.error = message(error) })
      throw new WorkCompletedFormatError(message(error))
    }
    const receipts = await this.options.writeArtifacts({ taskId: entry.state.taskId, stageId, invocationId: identity, result, previous: entry.state.artifacts, publish: !['worker', 'helper', 'review', 'review-architect'].includes(stage.phase) }, signal)
    const publishedEvidence = await this.options.evidence(entry.state.taskId)
    abort(signal)
    await this.change(entry, state => {
      const target = state.stages.find(item => item.id === stageId)!; const call = target.invocations.find(item => item.id === identity)!
      call.status = 'completed'; call.output = output; call.result = result
      target.status = result.status === 'needs_input' ? 'waiting_input' : 'completed'; target.outputFingerprint = hash(publishedEvidence); target.error = undefined
      for (const receipt of receipts) { if (!state.artifacts.some(item => item.id === receipt.id)) state.artifacts.push(receipt); if (!target.artifactIds.includes(receipt.id)) target.artifactIds.push(receipt.id) }
      for (const source of result.sources) { const previous = state.sources.findIndex(item => item.id === source.id); if (previous >= 0) state.sources[previous] = source; else state.sources.push(source) }
    })
  }
  private async verifyStage(entry: Entry, stageId: string, signal: AbortSignal) {
    const stage = entry.state.stages.find(item => item.id === stageId)!
    if (stage.stepId && lastResult(stage)?.status === 'complete') {
      if (hash(await this.options.evidence(entry.state.taskId)) !== stage.outputFingerprint) throw new Error('Work deliverable changed before verification')
      const step = entry.state.plan!.find(item => item.id === stage.stepId)!
      for (const [index, command] of step.verification.entries()) {
        if (stage.verification[index]?.status === 'passed' && stage.verification[index]?.cleanupVerified && stage.verification[index]?.exitCode === 0) continue
        const check = await this.options.verify({ taskId: entry.state.taskId, id: `work-check-${hash(`${stage.id}:${index}`).slice(0, 32)}`, command, inputFingerprint: stage.outputFingerprint! }, signal)
        await this.change(entry, state => { state.stages.find(item => item.id === stageId)!.verification[index] = { ...check, phase: 'green' } })
        if (check.status !== 'passed' || check.exitCode !== 0 || !check.cleanupVerified) throw new WorkVerificationError(stage.id, check.error ?? 'Work verification failed. Describe the correction before starting a fresh attempt; the failed result has been retained.')
      }
      if (hash(await this.options.evidence(entry.state.taskId)) !== stage.outputFingerprint) throw new Error('Work verification changed the deliverable evidence')
    }
  }
  private async workers(entry: Entry, stages: WorkStageRecord[], signal: AbortSignal) {
    const settled = await Promise.allSettled(stages.map(async stage => {
      try { await this.invoke(entry, stage.id, signal) }
      catch (error) {
        if (!(error instanceof WorkCompletedFormatError)) throw error
        const current = entry.state.stages.find(item => item.id === stage.id)!
        if (current.reportRepairCount === 0) {
          await this.change(entry, state => { const item = state.stages.find(item => item.id === stage.id)!; item.reportRepairCount = 1; item.status = 'pending' })
          try { await this.invoke(entry, stage.id, signal) } catch (retryError) { if (!(retryError instanceof WorkCompletedFormatError)) throw retryError }
        }
      }
    }))
    const failed = settled.find(item => item.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
  }
  private questions(state: WorkFlowSnapshot, stages: WorkStageRecord[]) {
    const grouped = new Map<string, NonNullable<WorkGate['questions']>[number]>()
    for (const stage of stages) for (const question of lastResult(stage)?.questions ?? []) {
      const key = JSON.stringify({ question: question.question.trim().replace(/\s+/g, ' ').toLowerCase(), options: question.options })
      const previous = grouped.get(key)
      if (previous) previous.stageIds.push(stage.id)
      else grouped.set(key, { ...question, id: `work-question-${hash(`${stage.id}:${question.id}`).slice(0, 32)}`, stageIds: [stage.id] })
    }
    const questions = [...grouped.values()]
    this.gate(state, stages[0], 'questions', 'Answer the outstanding Work questions. Only the asking contexts will continue.', { questions })
  }
  private addWorkers(state: WorkFlowSnapshot) {
    for (const [index, source] of state.definition.deep!.workers.entries()) state.stages.push(this.stage(state, 'worker', source, { reportName: state.round ? `brainstorm_followup_${state.round}_${index + 1}.md` : `brainstormer_${index + 1}_report.md` }))
  }
  private queueNext(state: WorkFlowSnapshot, parent: WorkStageRecord, next: WorkStageRecord) {
    const outlineGate = state.definition.advance === 'manual' && next.phase === 'draft' && parent.artifactIds.some(id => state.artifacts.find(item => item.id === id)?.name === 'outline.md')
    if (!outlineGate) state.stages.push(next)
    if (state.definition.advance === 'manual') this.gate(state, parent, outlineGate ? 'outline' : 'continue', 'This phase is complete. Review the result before continuing.')
  }
  private finish(state: WorkFlowSnapshot, stage: WorkStageRecord, reviewed = false, finishIdeas = false) {
    if (state.definition.kind === 'brainstorm' && stage.phase !== 'convergence' && !reviewed && !finishIdeas) { this.gate(state, stage, 'brainstorm-direction', 'Explore more ideas, evaluate the current options, or finish with this set.'); return }
    if (state.definition.review && !reviewed) {
      for (const source of state.definition.reviewTeam?.reviewers ?? state.definition.reviewers) state.stages.push(this.stage(state, 'review', source, { reviewOf: stage.id }))
      return
    }
    if (stage.stepId) {
      const step = state.plan!.find(item => item.id === stage.stepId)!; step.status = 'completed'
      const next = state.plan!.find(item => item.status === 'pending')
      if (next) { this.queueNext(state, stage, this.stage(state, 'execution', state.definition.executor, { stepId: next.id })); return }
    }
    if (state.definition.kind === 'deep-brainstorm' || state.definition.kind === 'write') this.gate(state, stage, 'artifact-review', lastResult(stage)?.summary ?? 'Review the resulting artifact.')
    else state.status = 'completed'
  }
  private async transition(entry: Entry, stageId: string) {
    const current = entry.state.stages.find(stage => stage.id === stageId)!
    if (current.outputFingerprint && current.outputFingerprint !== hash(await this.options.evidence(entry.state.taskId))) throw new Error('Work evidence changed before the phase transition; the retained result cannot certify changed files')
    await this.change(entry, state => {
      const stage = state.stages.find(item => item.id === stageId)!; if (stage.transitioned) return
      const result = lastResult(stage)!
      stage.transitioned = true
      if (result.status === 'needs_input') { this.questions(state, [stage]); return }
      if (stage.phase === 'helper') return
      if (stage.phase === 'review') {
        const reviews = state.stages.filter(item => item.phase === 'review' && item.reviewOf === stage.reviewOf)
        if (reviews.some(item => item.status !== 'completed')) return
        const parent = state.stages.find(item => item.id === stage.reviewOf)!
        for (const review of reviews) review.transitioned = true
        if (state.definition.reviewTeam) {
          if (!state.stages.some(item => item.phase === 'review-architect' && item.reviewOf === parent.id)) state.stages.push(this.stage(state, 'review-architect', state.definition.reviewTeam.architect, { reviewOf: parent.id, reportFingerprint: hash(anonymousWorkReports(state, parent.id)) }))
          return
        }
        if (reviews.some(item => lastResult(item)?.review?.outcome !== 'approved')) this.gate(state, parent, 'artifact-review', 'Independent review requested changes. Review the findings before explicitly revising.', { actions: ['changes', 'cancel'] })
        else this.finish(state, parent, true)
        return
      }
      if (stage.phase === 'review-architect') {
        const parent = state.stages.find(item => item.id === stage.reviewOf)!
        if (hash(anonymousWorkReports(state, parent.id)) !== stage.reportFingerprint) throw new Error('Anonymous Work reports changed before the final decision')
        if (result.review?.outcome !== 'approved') this.gate(state, parent, 'artifact-review', result.summary, { actions: ['changes', 'cancel'] })
        else this.finish(state, parent, true)
        return
      }
      if (result.status === 'plan') {
        if (state.definition.kind === 'brainstorm' || state.definition.kind === 'deep-brainstorm') throw new Error('This Work mode does not create an execution plan')
        const steps: WorkExecutionStep[] = result.steps.map(item => ({ ...item, id: `work-step-${randomUUID()}`, status: 'pending' }))
        this.gate(state, stage, 'plan', result.summary, { proposedSteps: steps }); return
      }
      if (state.definition.kind === 'deep-brainstorm') {
        if (stage.phase === 'intake' || stage.phase === 'follow-up' && result.followUpSize === 'large') { this.addWorkers(state); if (state.definition.advance === 'manual') this.gate(state, stage, 'continue', 'The common question is ready. Continue to run the selected independent workers.'); return }
        if (stage.phase === 'follow-up' && !result.artifacts.some(item => item.name === 'brainstorm_report.md')) { this.queueNext(state, stage, this.stage(state, 'revision', state.definition.executor, { reportName: 'brainstorm_report.md' })); return }
      }
      if (result.status === 'continue') {
        if (!['requirements', 'planning', 'execution', 'divergence', 'convergence', 'research', 'outline', 'draft', 'revision', 'delivery'].includes(result.nextPhase!)) throw new Error('Work cannot schedule that next phase')
        if (state.definition.kind === 'brainstorm' && result.nextPhase === 'convergence') { this.gate(state, stage, 'brainstorm-direction', 'Choose whether to evaluate these ideas.'); return }
        if (result.nextPhase === 'execution') throw new Error('Execution requires a user-approved Work plan')
        this.queueNext(state, stage, this.stage(state, result.nextPhase!)); return
      }
      this.finish(state, stage)
    })
  }
  private async execute(entry: Entry, signal: AbortSignal) {
    try {
      while (entry.state.status === 'running') {
        abort(signal); this.available(entry.state.taskId)
        const firstReview = entry.state.stages.find(stage => stage.phase === 'review' && !stage.transitioned)
        if (firstReview) {
          const reviews = entry.state.stages.filter(stage => stage.phase === 'review' && stage.reviewOf === firstReview.reviewOf && !stage.transitioned)
          // Every configured reviewer is required. Unlike advisory Deep workers,
          // a missing/failed review has no synthesis fallback or majority waiver.
          const settled = await Promise.allSettled(reviews.filter(stage => !['completed', 'waiting_input'].includes(stage.status)).map(stage => this.invoke(entry, stage.id, signal)))
          abort(signal)
          const rejected = settled.find(item => item.status === 'rejected')
          if (rejected?.status === 'rejected') throw rejected.reason
          const current = entry.state.stages.filter(stage => reviews.some(review => review.id === stage.id))
          const questions = current.filter(stage => stage.status === 'waiting_input')
          if (questions.length) { await this.change(entry, state => this.questions(state, questions)); return }
          if (current.some(stage => stage.status !== 'completed')) throw new Error('Every configured Work reviewer must complete before aggregation')
          await this.transition(entry, firstReview.id)
          continue
        }
        const group = entry.state.stages.filter(stage => stage.phase === 'worker' && stage.round === entry.state.round && !stage.transitioned)
        if (group.length) {
          const pending = group.filter(stage => ['pending', 'running', 'interrupted', 'uncertain'].includes(stage.status))
          if (pending.length) await this.workers(entry, pending, signal)
          const current = entry.state.stages.filter(stage => group.some(item => item.id === stage.id))
          const questions = current.filter(stage => stage.status === 'waiting_input')
          if (questions.length) { await this.change(entry, state => this.questions(state, questions)); return }
          if (current.some(stage => !['completed', 'failed'].includes(stage.status))) throw new Error('Worker delivery must be resolved before synthesis')
          await this.change(entry, state => { for (const stage of state.stages.filter(item => current.some(worker => worker.id === item.id))) stage.transitioned = true; state.stages.push(this.stage(state, 'synthesis', state.definition.executor, { reportName: 'brainstorm_report.md' })); if (state.definition.advance === 'manual') this.gate(state, current.find(stage => stage.status === 'completed') ?? current[0], 'continue', 'Worker reports are retained. Continue to synthesize the result, including any failed-report limitations.', { artifactIds: current.flatMap(stage => stage.artifactIds) }) })
          continue
        }
        const stage = entry.state.stages.find(item => !item.transitioned && item.status !== 'failed')
        if (!stage) throw new Error('Work has no pending stage or final receipt')
        if (stage.status === 'waiting_input') { await this.change(entry, state => this.questions(state, [stage])); return }
        if (stage.status !== 'completed') await this.invoke(entry, stage.id, signal)
        abort(signal)
        await this.verifyStage(entry, stage.id, signal)
        await this.transition(entry, stage.id)
      }
    } catch (error) {
      await this.change(entry, state => {
        if (error instanceof WorkUncertainDeliveryError && !signal.aborted) this.gate(state, state.stages.find(stage => stage.id === error.stageId)!, 'recovery', message(error), { artifactIds: [] })
        else if (error instanceof WorkVerificationError && !signal.aborted) { const stage = state.stages.find(item => item.id === error.stageId)!; stage.transitioned = true; this.gate(state, stage, 'artifact-review', message(error), { actions: ['changes', 'cancel'] }) }
        else { state.status = signal.aborted ? 'paused' : 'blocked'; state.reason = message(error); if (!signal.aborted) state.failures++ }
      })
    }
  }
}
