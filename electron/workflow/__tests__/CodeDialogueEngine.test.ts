import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CodeFlowDiscussion, CodeFlowGate, CodePhase, CodePhaseResult, CodeProposedStep } from '../../../shared/code-flow'
import type { WorkflowSnapshot } from '../../../shared/workflow'
import { CodeArtifactStore } from '../CodeArtifacts'
import { WorkflowAgentCleanupError } from '../WorkflowAgentRunner'
import { WorkflowEngine, type WorkflowAgentRequest, type WorkflowEngineOptions } from '../WorkflowEngine'
import { createWorkflowTemplate } from '../WorkflowTemplates'
import { parseCodeImplementationQuestion } from '../CodeFlowProtocol'
import { validateStoredWorkflow } from '../WorkflowValidation'

const roots: string[] = [], engines: WorkflowEngine[] = []
afterEach(async () => {
  await Promise.all(engines.splice(0).map(engine => engine.shutdown().catch(() => {})))
  roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true }))
})
const check = { executable: '/fixture/check', args: ['approved'], timeoutMs: 1000 }
const proposal = (title = 'Implement accepted boundary'): CodeProposedStep => ({ title, instructions: `Implement ${title} in code.txt.`, acceptance: ['The observable boundary passes its check.'], verification: [check] })
const result = (phase: CodePhase, steps?: CodeProposedStep[]): CodePhaseResult => ({
  status: 'ready', summary: `Prepared ${phase}`, questions: [],
  artifacts: phase === 'requirements' ? [{ name: 'requirements.md', content: '# Agreed requirements\nRespect the saved user decisions.' }]
    : phase === 'specification' ? [{ name: 'spec.md', content: '# Agreed specification\nRespect the selected stack.' }]
      : phase === 'delivery' ? [{ name: 'report.md', content: '# Delivery\nActual check receipts are retained.' }]
        : [{ name: 'plan.md', content: '# Plan\nOnly the accepted remaining scope.' }],
  steps: steps ?? (phase === 'planning' || phase === 'discovery' ? [proposal()] : []),
  ...(phase === 'discovery' ? { intent: 'implement', complexity: 'small' } as const : {}),
})
const question = (summary: string): CodePhaseResult => ({ status: 'needs_input', summary, questions: [{ id: 'stack', question: 'Which storage matches your offline requirement?', options: ['Local SQLite', 'Remote PostgreSQL'] }], artifacts: [], steps: [] })
const framed = (value: CodePhaseResult) => '```ziaforge-phase\n' + JSON.stringify(value) + '\n```'
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(accept => { resolve = accept }); return { promise, resolve } }
interface Setup {
  root?: string
  template?: string
  phase?(phase: CodePhase, request: WorkflowAgentRequest, call: number): CodePhaseResult
  coder?(request: WorkflowAgentRequest, call: number): string | undefined
  runAgent?: WorkflowEngineOptions['runAgent']
  settle?: WorkflowEngineOptions['settleAgentCleanup']
}
function fixture(config: Setup = {}) {
  const root = config.root ?? fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-code-dialogue-')))
  if (!config.root) { roots.push(root); fs.mkdirSync(path.join(root, 'workspace')); fs.mkdirSync(path.join(root, 'artifacts')); fs.writeFileSync(path.join(root, 'workspace', 'code.txt'), 'original\n') }
  const store = new CodeArtifactStore(() => path.join(root, 'artifacts'))
  const calls: WorkflowAgentRequest[] = [], checks: Parameters<WorkflowEngineOptions['verify']>[0][] = []
  const counts = new Map<string, number>()
  const code = path.join(root, 'workspace', 'code.txt')
  const engine = new WorkflowEngine({ directory: path.join(root, 'plans'), validateTask: id => { if (id !== 'task') throw new Error('Unknown task') },
    evidence: async () => fs.readFileSync(code, 'utf8'),
    writeArtifacts: (request, signal) => store.write(request, signal), artifactContext: (taskId, records, refs) => store.context(taskId, records, refs),
    settleAgentCleanup: config.settle,
    runAgent: async (request, signal, onSession) => {
      calls.push(request)
      if (config.runAgent) return config.runAgent(request, signal, onSession)
      await onSession({ sessionId: `session-${calls.length}`, runId: `run-${calls.length}`, chatId: request.chatId })
      const phase = /^Phase: (\S+)$/m.exec(request.prompt)?.[1] as CodePhase | undefined
      const key = phase ?? 'coder', count = (counts.get(key) ?? 0) + 1; counts.set(key, count)
      if (phase) return framed(config.phase?.(phase, request, count) ?? result(phase))
      const answer = config.coder?.(request, count)
      if (answer !== undefined) return answer
      fs.appendFileSync(code, `implemented ${count}\n`)
      return 'Implemented the accepted scope. The host must verify it.'
    },
    verify: async request => {
      checks.push(request)
      const passed = fs.readFileSync(code, 'utf8').includes('implemented')
      return { id: request.id, command: request.command, inputFingerprint: request.inputFingerprint, status: passed ? 'passed' : 'failed', exitCode: passed ? 0 : 1, cleanupVerified: true, stdoutPath: path.join(root, 'check.out'), stderrPath: path.join(root, 'check.err') }
    },
  })
  engines.push(engine)
  const plan = createWorkflowTemplate({ title: 'Offline notes', description: 'Create a notes application; discuss the important choices first.', mode: 'code', template: config.template ?? 'Requirements first', coderPreset: 'Coder', reviewerPreset: 'Reviewer' })
  plan.review = false
  plan.codeFlow!.planner = { id: 'planner', presetName: 'Planner', reasoningEffort: 'high' }
  return { root, code, engine, store, calls, checks, plan }
}
async function wait(engine: WorkflowEngine, predicate: (snapshot: WorkflowSnapshot) => boolean): Promise<WorkflowSnapshot> {
  let snapshot: WorkflowSnapshot | null = null
  await vi.waitFor(async () => { snapshot = await engine.get('task'); expect(snapshot && predicate(snapshot), JSON.stringify({ status: snapshot?.status, reason: snapshot?.reason, gate: snapshot?.codeFlow?.pending?.kind })).toBe(true) }, { timeout: 20000, interval: 20 })
  return snapshot!
}
const gate = (engine: WorkflowEngine, kind: CodeFlowGate['kind']) => wait(engine, snapshot => snapshot.status === 'paused' && snapshot.codeFlow?.pending?.kind === kind)
async function begin(context: ReturnType<typeof fixture>) { const saved = await context.engine.save('task', 0, context.plan); await context.engine.start('task', saved.revision, 'start') }
const discussion = (snapshot: WorkflowSnapshot, commandId: string, text: string, extra: Partial<CodeFlowDiscussion> = {}): CodeFlowDiscussion => ({ taskId: 'task', revision: snapshot.revision, commandId, text, ...extra })
const approve = (snapshot: WorkflowSnapshot, commandId = `approve-${snapshot.sequence}`) => ({ taskId: 'task', revision: snapshot.revision, gateId: snapshot.codeFlow!.pending!.id, commandId, action: 'approve' as const })

// These are real fsynced workflow, backup and immutable artifact files. The
// deadline bounds complete multi-phase scenarios, not a sleep-based assertion.
describe('Forge discussion through durable Code workflow state', { timeout: 45000 }, () => {
  it('retains question options, counterquestions and exact decisions across fresh contexts and restart', async () => {
    const first = fixture({ phase: (_phase, _request, call) => question(call === 1 ? 'Choose storage after discussing the tradeoffs.' : 'SQLite works offline; confirm that tradeoff or ask another question.') })
    await begin(first)
    const asked = await gate(first.engine, 'questions')
    const counter = discussion(asked, 'counterquestion', 'Why would remote PostgreSQL be preferable offline?')
    await first.engine.discuss(counter)
    const explained = await gate(first.engine, 'questions')
    expect(explained.codeFlow!.pending!.stepId).toBe(asked.codeFlow!.pending!.stepId)
    expect(first.calls[1].prompt).toContain('Which storage matches your offline requirement?')
    expect(first.calls[1].prompt).toContain('Remote PostgreSQL')
    expect(first.calls[1].prompt).toContain(counter.text)
    expect(first.calls[1].chatId).not.toBe(first.calls[0].chatId)
    expect(first.checks).toEqual([])
    await first.engine.shutdown()
    const restored = fixture({ root: first.root })
    expect((await restored.engine.get('task'))!.codeFlow!.dialogue).toEqual(explained.codeFlow!.dialogue)
    const answer = discussion(explained, 'decide-storage', 'Use local SQLite; no account or cloud service.')
    await restored.engine.discuss(answer)
    const document = await gate(restored.engine, 'document')
    expect(restored.calls[0].prompt).toContain('SQLite works offline; confirm')
    expect(restored.calls[0].prompt).toContain(answer.text)
    expect(restored.calls[0].prompt).toContain(first.plan.codeFlow!.request)
    expect(await restored.engine.discuss(counter)).toEqual(document)
    await expect(restored.engine.discuss({ ...counter, text: 'Different text' })).rejects.toThrow(/different/)
    await expect(restored.engine.discuss({ ...answer, commandId: 'stale' })).rejects.toThrow(/changed/)
    expect(restored.calls).toHaveLength(1)
    expect(document.codeFlow!.acceptedDocuments).toBeUndefined()
    const updated = structuredClone(document.plan); updated.codeFlow!.planner = { id: 'planner', presetName: 'Other planner', reasoningEffort: 'medium' }
    const selected = await restored.engine.save('task', document.revision, updated)
    await restored.engine.respond(approve(selected))
    const spec = await gate(restored.engine, 'document')
    expect(spec.codeFlow!.pending!.phase).toBe('specification')
    expect(restored.calls.at(-1)).toMatchObject({ presetName: 'Other planner', reasoningEffort: 'medium', role: 'helper' })
  })

  it('binds document approval to exact bytes, rejects stale edits and invalidates dependent acceptance on a requirement edit', async () => {
    const context = fixture()
    await begin(context)
    const req = await gate(context.engine, 'document')
    const artifact = req.codeFlow!.artifacts[0], original = fs.readFileSync(artifact.path)
    expect(req.codeFlow!.pending!.artifactHashes).toEqual([{ id: artifact.id, sha256: artifact.sha256 }])
    fs.appendFileSync(artifact.path, '\nchanged outside approval')
    await expect(context.engine.respond(approve(req))).rejects.toThrow(/Artifact changed/)
    expect(context.calls).toHaveLength(1)
    fs.writeFileSync(artifact.path, original)
    await context.engine.respond(approve(req))
    const spec = await gate(context.engine, 'document')
    const edit = discussion(spec, 'edit-requirements', 'Require offline export too.', { phase: 'requirements', artifactEdits: [{ artifactId: artifact.id, expectedSha256: '0'.repeat(64), content: '# Requirements\nOffline notes and export.' }] })
    await expect(context.engine.discuss(edit)).rejects.toThrow(/current requirements/)
    edit.artifactEdits![0].expectedSha256 = artifact.sha256
    await context.engine.discuss(edit)
    const revised = await gate(context.engine, 'document')
    expect(revised.codeFlow!.acceptedDocuments![0].invalidatedAt).toBeTypeOf('number')
    expect(revised.codeFlow!.artifacts.some(item => item.id === artifact.id)).toBe(true)
    expect(context.calls.at(-1)!.prompt).toContain('Offline notes and export.')
    expect(context.checks).toEqual([])
    await expect(context.engine.respond({ ...approve(spec), commandId: 'old-document' })).rejects.toThrow(/changed/)
    validateStoredWorkflow(revised, 'task')
  })

  it('always gates small Auto proposals, executes edited order only after approval and answers implementation questions naturally', async () => {
    const context = fixture({ template: 'Auto', coder: (_request, call) => call === 1 ? '```ziaforge-implementation\n' + JSON.stringify({ status: 'needs_input', summary: 'One detail remains.', questions: [{ id: 'export', question: 'Which export encoding?', options: ['UTF-8', 'UTF-16'] }] }) + '\n```' : undefined })
    await begin(context)
    const proposed = await gate(context.engine, 'plan')
    expect(context.checks).toEqual([]); expect(context.calls).toHaveLength(1)
    await expect(context.engine.start('task', proposed.revision, 'skip-gate')).rejects.toThrow(/decision/)
    const edited = [proposal('User first'), proposal('User second')]
    edited[0].verification[0] = { ...check, args: ['human-first'] }
    await context.engine.respond({ ...approve(proposed), proposedSteps: edited })
    const asked = await gate(context.engine, 'questions')
    expect(asked.codeFlow!.pending!.phase).toBe('implementation')
    expect(context.checks).toEqual([])
    const accepted = structuredClone(asked.codeFlow!.acceptedPlans)
    await context.engine.discuss(discussion(asked, 'encoding', 'UTF-8. Preserve the accepted two-part plan.'))
    const completed = await wait(context.engine, state => state.status === 'completed')
    expect(completed.codeFlow!.acceptedPlans).toEqual(accepted)
    expect(completed.plan.steps.filter(step => step.codePhase === 'implementation').map(step => step.title)).toEqual(['User first', 'User second'])
    expect(context.checks.map(item => item.command.args[0])).toEqual(['human-first', 'approved'])
    expect(context.calls.filter(item => /^Phase: discovery$/m.test(item.prompt))).toHaveLength(1)
    expect(context.calls[2].prompt).toContain('Which export encoding?')
    expect(context.calls[2].prompt).toContain('UTF-16')
    expect(context.calls[2].prompt).toContain('UTF-8. Preserve')
  })

  it('drains an active attempt, persists failed cleanup and never launches a new context before retrying exact owned termination', async () => {
    const aborted = deferred<void>(), cleanup = deferred<void>()
    const settle = vi.fn<NonNullable<WorkflowEngineOptions['settleAgentCleanup']>>(async () => { throw new Error('owned process still present') })
    const first = fixture({ settle, runAgent: async (request, signal, onSession) => {
      const session = { sessionId: 'session-active', runId: 'run-active', chatId: request.chatId }
      await onSession(session)
      await new Promise<void>(resolve => { signal.addEventListener('abort', () => { aborted.resolve(); resolve() }, { once: true }) })
      await cleanup.promise
      throw new WorkflowAgentCleanupError(session, new Error('termination failed'))
    } })
    await begin(first)
    const active = await wait(first.engine, state => Boolean(state.steps[0].attempts[0]?.session))
    const message = discussion(active, 'during-generation', 'Do not use a remote account.')
    const operation = first.engine.discuss(message)
    const rejected = expect(operation).rejects.toThrow(/owned process still present/)
    await aborted.promise
    expect(first.calls).toHaveLength(1); expect(settle).not.toHaveBeenCalled()
    cleanup.resolve(); await rejected
    const stopped = (await first.engine.get('task'))!
    expect(stopped.codeFlow!.discussions).toBeUndefined()
    const pending = stopped.steps[0].attempts[0].cleanupPending!
    expect(pending).toHaveLength(1); expect(first.calls).toHaveLength(1)
    await first.engine.shutdown()
    const recoveredCleanup = vi.fn<NonNullable<WorkflowEngineOptions['settleAgentCleanup']>>(async () => {})
    const restored = fixture({ root: first.root, settle: recoveredCleanup })
    await restored.engine.discuss(message)
    const document = await gate(restored.engine, 'document')
    expect(recoveredCleanup).toHaveBeenCalledExactlyOnceWith('task', pending)
    expect(document.steps[0].attempts[0].cleanupPending).toBeUndefined()
    expect(document.codeFlow!.discussions).toHaveLength(1)
    expect(restored.calls).toHaveLength(1)
  })

  it('keeps completed code proof active while retiring unfinished scope and replanning across a restart', async () => {
    const first = fixture({ template: 'Spec first', phase: phase => result(phase, phase === 'specification' ? [proposal('Completed part'), proposal('Superseded part')] : undefined) })
    first.plan.advance = 'manual'
    await begin(first)
    const proposed = await gate(first.engine, 'plan')
    await first.engine.respond(approve(proposed))
    const checkpoint = await wait(first.engine, snapshot => snapshot.status === 'paused' && !snapshot.codeFlow!.pending)
    const implementation = checkpoint.plan.steps.find(step => step.codePhase === 'implementation')!
    const proof = structuredClone(checkpoint.steps.find(step => step.id === implementation.id)!)
    const rewind = discussion(checkpoint, 'reconsider-requirements', 'Keep the completed part. Add offline export instead of the remaining part.', { phase: 'requirements' })
    await first.engine.discuss(rewind)
    const document = await gate(first.engine, 'document')
    expect(document.plan.steps.find(step => step.id === implementation.id)).toEqual(implementation)
    expect(document.steps.find(step => step.id === implementation.id)).toEqual(proof)
    expect(document.codeFlow!.retiredSteps?.map(item => item.step.title)).toContain('Superseded part')
    expect(document.codeFlow!.acceptedPlans![0].invalidatedAt).toBeTypeOf('number')
    await first.engine.shutdown()
    const restored = fixture({ root: first.root })
    expect(await restored.engine.discuss(rewind)).toEqual(document)
    expect(restored.calls).toEqual([])
    await restored.engine.respond(approve(document))
    await restored.engine.respond(approve(await gate(restored.engine, 'document')))
    const remaining = await gate(restored.engine, 'plan')
    expect(restored.calls.at(-1)!.prompt).toContain('Completed part')
    expect(restored.calls.at(-1)!.prompt).toContain('Superseded part')
    await restored.engine.respond({ ...approve(remaining), proposedSteps: [proposal('Offline export')] })
    const checked = await wait(restored.engine, snapshot => snapshot.status === 'paused' && !snapshot.codeFlow!.pending)
    expect(checked.steps.find(step => step.id === implementation.id)).toEqual(proof)
    expect(restored.checks).toHaveLength(1)
    await restored.engine.start('task', checked.revision, 'finish-delivery')
    const completed = await wait(restored.engine, snapshot => snapshot.status === 'completed')
    validateStoredWorkflow(completed, 'task')
    expect(completed.steps.find(step => step.id === implementation.id)).toEqual(proof)
  })

  it('accepts only the explicit semantic implementation-question contract', () => {
    expect(parseCodeImplementationQuestion('Ordinary implementation summary')).toBeUndefined()
    for (const value of [{ status: 'ready', summary: 'Finished', questions: [] }, { status: 'needs_input', summary: 'Missing choices', questions: [] }, { status: 'needs_input', summary: 'Wrong options', questions: [{ id: 'q', question: 'Choose', options: ['only'] }] }]) {
      expect(() => parseCodeImplementationQuestion('```ziaforge-implementation\n' + JSON.stringify(value) + '\n```')).toThrow()
    }
  })
})
