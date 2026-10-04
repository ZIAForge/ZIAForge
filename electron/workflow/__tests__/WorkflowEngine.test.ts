import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowPlan, WorkflowSnapshot, WorkflowVerification } from '../../../shared/workflow'
import { WorkflowEngine, verificationExcerpt, type WorkflowEngineOptions } from '../WorkflowEngine'
import { parseWorkflowReview, validatePlan, validateWorkflowCommand } from '../WorkflowValidation'

const directories: string[] = []
const engines: WorkflowEngine[] = []
afterEach(async () => { await Promise.all(engines.splice(0).map(engine => engine.shutdown().catch(() => {}))); for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })
const plan = (count = 3): WorkflowPlan => ({ title: 'Ship a small feature', coderPreset: 'Coding', reviewerPreset: 'Review', review: true, advance: 'auto', maxFailures: 3, maxIterations: 50,
  steps: Array.from({ length: count }, (_, index) => ({ id: `step-${index}`, title: `Step ${index}`, instructions: `Implement requirement ${index}`, acceptance: ['Actual checks pass'], dependsOn: index ? [`step-${index - 1}`] : [], newContext: true, stopAfter: false, verification: [{ executable: '/usr/bin/true', args: [], timeoutMs: 1000 }] })) })
function setup(overrides: Partial<WorkflowEngineOptions> = {}, directory?: string) {
  const root = directory ?? fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-workflow-')))
  if (!directory) directories.push(root)
  const calls: Parameters<WorkflowEngineOptions['runAgent']>[0][] = []
  const engine = new WorkflowEngine({ directory: root, validateTask: () => {}, evidence: async () => 'immutable diff',
    runAgent: async (request, _signal, session) => {
      calls.push(request)
      await session({ chatId: request.chatId, runId: `run-${calls.length}`, sessionId: `session-${calls.length}` })
      return request.role === 'reviewer' ? JSON.stringify({ outcome: 'approved', findings: [], summary: 'Reviewed actual evidence' }) : 'Implemented'
    },
    verify: async request => ({ id: request.id, status: 'passed', command: request.command, exitCode: 0, cleanupVerified: true, stdoutPath: '/receipt/stdout', stderrPath: '/receipt/stderr', inputFingerprint: request.inputFingerprint }), ...overrides })
  engines.push(engine)
  return { engine, directory: root, calls }
}
async function finished(engine: WorkflowEngine, status: WorkflowSnapshot['status']) {
  await vi.waitFor(async () => expect((await engine.get('task'))?.status).toBe(status), { timeout: 15000 })
  return (await engine.get('task'))!
}
// These exercise fsynced recovery checkpoints, including several retry turns.
// Their deadline must cover durable I/O under parallel QA load, not just mocks.
describe('durable executable plan', { timeout: 20000 }, () => {
  it('persists Custom roles across a checkpoint and restart with distinct native contexts and frozen completed policy', async () => {
    const configured = plan(2)
    configured.advance = 'manual'
    configured.coderPreset = '@custom'; configured.coderConfiguration = { provider: 'codex', model: 'coder-model', reasoningEffort: null, permissions: 'Workspace write' }
    configured.reviewerPreset = '@custom'; configured.reviewerConfiguration = { provider: 'antigravity', model: 'review-model', reasoningEffort: 'low', permissions: 'CLI settings' }
    configured.helpers = [{ id: 'research', presetName: '@custom', configuration: { provider: 'api', model: 'research-model', apiConnectionId: 'connection', permissions: 'Read only' }, instructions: 'Research references' }]
    configured.steps.forEach(step => { step.newContext = false })
    configured.steps[1].presetName = '@custom'; configured.steps[1].configuration = { provider: 'claude', model: 'second-coder', reasoningEffort: 'high', permissions: 'Read & Write' }
    const first = setup()
    await first.engine.save('task', 0, configured); await first.engine.start('task', 1, 'first-custom')
    const paused = await finished(first.engine, 'paused')
    expect(first.calls.map(call => call.configuration)).toEqual([configured.helpers[0].configuration, configured.coderConfiguration, configured.reviewerConfiguration])
    expect(new Set(first.calls.map(call => call.chatId)).size).toBe(3)
    expect(paused.steps[0].attempts[0].reviewSources?.[0].configuration).toEqual(configured.reviewerConfiguration)
    await first.engine.shutdown()
    const next = setup({}, first.directory)
    expect((await next.engine.get('task'))?.plan).toEqual(configured)
    await expect(next.engine.save('task', 1, { ...configured, reviewerConfiguration: { ...configured.reviewerConfiguration, model: 'different-reviewer' } })).rejects.toThrow(/execution and review policies/)
    await next.engine.start('task', 1, 'second-custom')
    const completed = await finished(next.engine, 'completed')
    expect(completed.steps.every(step => step.status === 'completed')).toBe(true)
    expect(next.calls.map(call => call.configuration)).toEqual([configured.helpers[0].configuration, configured.steps[1].configuration, configured.reviewerConfiguration])
    expect(next.calls.every(call => !first.calls.some(old => old.chatId === call.chatId))).toBe(true)
    expect(completed.steps[0]).toEqual(paused.steps[0])
  })

  it('persists per-role effort and access, keeps default distinct from inheritance and freezes completed policy', async () => {
    const configured = plan(3)
    configured.coderReasoningEffort = 'high'; configured.coderPermissions = 'Read only'; configured.reviewerReasoningEffort = 'medium'
    configured.steps.forEach(step => { step.newContext = false })
    configured.steps[0].reasoningEffort = undefined
    configured.steps[1].reasoningEffort = null
    configured.steps[2].presetName = 'Coding'; configured.steps[2].permissions = 'Read only'
    const { engine, calls, directory } = setup()
    await engine.save('task', 0, configured); await engine.start('task', 1, 'effort-start')
    const completed = await finished(engine, 'completed')
    expect(calls[0]).toMatchObject({ role: 'coder', reasoningEffort: 'high', permissions: 'Read only' })
    expect(calls[1]).toMatchObject({ role: 'reviewer', reasoningEffort: 'medium' })
    expect(calls[2]).toMatchObject({ role: 'coder', reasoningEffort: null, permissions: 'Read only' })
    expect(calls[2].chatId).not.toBe(calls[0].chatId)
    expect(calls[4]).toMatchObject({ role: 'coder', reasoningEffort: undefined, permissions: 'Read only' })
    expect(calls[4].chatId).not.toBe(calls[2].chatId)
    await expect(engine.save('task', completed.revision, { ...configured, coderReasoningEffort: 'low' })).rejects.toThrow(/execution and review policies/)
    await engine.shutdown()
    const restored = setup({}, directory)
    expect((await restored.engine.get('task'))?.plan).toMatchObject({ coderReasoningEffort: 'high', coderPermissions: 'Read only', reviewerReasoningEffort: 'medium' })
  })

  it('keeps binary verification output in its raw file and a reloadable text excerpt in the plan', async () => {
    const first = setup({ verify: async request => {
      const output = path.join(first.directory, 'binary-output')
      fs.writeFileSync(output, Buffer.from([65, 0, 66, 10]))
      return { id: request.id, status: 'passed', command: request.command, exitCode: 0, cleanupVerified: true,
        stdoutPath: output, stderrPath: '/receipt/stderr', stdout: await verificationExcerpt(output), inputFingerprint: request.inputFingerprint }
    } })
    await first.engine.save('task', 0, plan(1)); await first.engine.start('task', 1, 'start')
    await finished(first.engine, 'completed'); await first.engine.shutdown()
    const second = setup({}, first.directory)
    const loaded = await second.engine.get('task')
    expect(loaded?.status).toBe('completed')
    expect(loaded?.steps[0].attempts[0].verification[0].stdout).toBe('A\uFFFDB\n')
    expect(fs.readFileSync(path.join(first.directory, 'binary-output'))).toEqual(Buffer.from([65, 0, 66, 10]))
  })
  it('runs three ordered steps, real verification receipts and isolated review before advancing', async () => {
    const { engine, calls } = setup()
    const saved = await engine.save('task', 0, plan())
    await engine.start('task', saved.revision, 'start-1')
    const result = await finished(engine, 'completed')
    expect(result.steps.map(step => step.status)).toEqual(['completed', 'completed', 'completed'])
    expect(calls.map(call => call.role)).toEqual(['coder', 'reviewer', 'coder', 'reviewer', 'coder', 'reviewer'])
    expect(new Set(calls.map(call => call.chatId)).size).toBe(6)
    expect(result.steps.every(step => step.attempts[0].verification[0].inputFingerprint?.length === 64)).toBe(true)
    expect(calls[1].prompt).toContain('immutable diff')
    expect(calls[1].prompt).toContain('Actual verification receipts')
  }, 20000)
  it('does not bypass a failed check or blocking review; correction attempts preserve evidence', async () => {
    let checks = 0, reviews = 0
    const prompts: string[] = []
    const { engine } = setup({
      verify: async request => ({ id: request.id, status: ++checks === 1 ? 'failed' : 'passed', command: request.command, exitCode: checks === 1 ? 1 : 0, cleanupVerified: true, stdoutPath: '/out', stderrPath: '/err', stderr: checks === 1 ? 'Expected 2, received 1' : '' }),
      runAgent: async request => {
        prompts.push(request.prompt)
        return request.role === 'coder' ? 'Claimed tests pass' : JSON.stringify(++reviews === 1 ? { outcome: 'changes_requested', findings: [{ severity: 'blocking', location: 'logic.ts:1', evidence: 'Off by one', action: 'Fix the boundary' }], summary: 'Fix required' } : { outcome: 'approved', findings: [], summary: 'Fixed' })
      },
    })
    await engine.save('task', 0, plan(1)); await engine.start('task', 1, 'start')
    const result = await finished(engine, 'completed')
    expect(result.steps[0].attempts.map(attempt => attempt.status)).toEqual(['failed', 'failed', 'completed'])
    expect(result.steps[0].failures).toBe(2)
    expect(prompts.some(prompt => prompt.includes('Expected 2, received 1'))).toBe(true)
    expect(prompts.some(prompt => prompt.includes('Fix the boundary'))).toBe(true)
  }, 20000)
  it('persists checkpoints, revisions and completion across a full engine restart without replaying completed steps', async () => {
    const first = setup()
    const value = plan(); value.advance = 'manual'
    await first.engine.save('task', 0, value); await first.engine.start('task', 1, 'same-start')
    await finished(first.engine, 'paused'); await first.engine.shutdown()
    const second = setup({}, first.directory)
    const loaded = await second.engine.get('task')
    expect(loaded?.steps[0].status).toBe('completed')
    await second.engine.start('task', 1, 'same-start')
    expect(second.calls).toHaveLength(0)
    const changed = structuredClone(value); changed.advance = 'auto'; changed.steps[1].stopAfter = true
    await second.engine.save('task', 1, changed)
    await second.engine.start('task', 2, 'continue-2'); await finished(second.engine, 'paused')
    expect(second.calls.filter(call => call.role === 'coder').map(call => call.prompt)).toEqual([expect.stringContaining('Step 1')])
    await second.engine.start('task', 2, 'continue-3'); await finished(second.engine, 'completed')
    expect(second.calls.filter(call => call.role === 'coder')).toHaveLength(2)
  }, 20000)
  it('pauses an active attempt, waits for cancellation and permits only explicit retry', async () => {
    let entered = false
    const { engine } = setup({ runAgent: async (_request, signal) => new Promise<string>((_resolve, reject) => { entered = true; signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) }) })
    await engine.save('task', 0, plan(1)); await engine.start('task', 1, 'start')
    await vi.waitFor(() => expect(entered).toBe(true))
    const stopped = await engine.pause('task')
    expect(stopped.status).toBe('paused')
    expect(stopped.steps[0]).toMatchObject({ status: 'pending', failures: 0, attempts: [{ status: 'interrupted' }] })
    expect((await engine.get('task'))?.iterations).toBe(1)
  })
  it('recovers a persisted running attempt as interrupted; a crash does not trigger automatic replay', async () => {
    const first = setup()
    await first.engine.save('task', 0, plan(1))
    const file = path.join(first.directory, 'task/workflow.json')
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as WorkflowSnapshot
    raw.status = 'running'; raw.iterations = 1; raw.steps[0].status = 'running'
    raw.steps[0].attempts.push({ id: 'attempt-before-crash', number: 1, startedAt: Date.now(), stage: 'implementation', status: 'running', verification: [] })
    fs.writeFileSync(file, JSON.stringify(raw))
    const second = setup({}, first.directory)
    const recovered = await second.engine.get('task')
    expect(recovered?.status).toBe('paused'); expect(recovered?.steps[0].attempts[0].status).toBe('interrupted')
    expect(second.calls).toHaveLength(0)
  })
  it('enforces saved failure and total iteration limits instead of trusting model success', async () => {
    const { engine } = setup({ verify: async request => ({ id: request.id, command: request.command, status: 'failed', exitCode: 7, cleanupVerified: true, stdoutPath: '/out', stderrPath: '/err' }) })
    await engine.save('task', 0, plan(1)); await engine.start('task', 1, 'start')
    const blocked = await finished(engine, 'blocked')
    expect(blocked.iterations).toBe(3); expect(blocked.steps[0].attempts.every(attempt => attempt.review === undefined)).toBe(true)
    await expect(engine.start('task', 1, 'retry')).rejects.toThrow('failure limit')
    const other = setup(); const one = plan(); one.maxIterations = 1
    await other.engine.save('task', 0, one); await other.engine.start('task', 1, 'start')
    const limited = await finished(other.engine, 'blocked')
    expect(limited.steps.filter(step => step.status === 'completed')).toHaveLength(1)
  })
  it('does not allow stale edits, edits to completed steps or a false manual completion checkbox', async () => {
    const { engine } = setup(); const value = plan(1)
    await engine.save('task', 0, value); await expect(engine.save('task', 0, value)).rejects.toThrow('changed elsewhere')
    await engine.start('task', 1, 'start'); await finished(engine, 'completed')
    value.steps[0].title = 'Different work'
    await expect(engine.save('task', 1, value)).rejects.toThrow('Completed steps')
    expect(() => validateWorkflowCommand('save', { taskId: 'task', expectedRevision: 1, plan: value, status: 'completed' })).toThrow('fields')
  })
  it('requires a actual check or independent review and rejects malformed review verdicts', async () => {
    const { engine } = setup(); const value = plan(1); value.review = false; value.steps[0].verification = []
    await engine.save('task', 0, value); await expect(engine.start('task', 1, 'start')).rejects.toThrow('verification command')
    expect(() => parseWorkflowReview('Looks good!')).toThrow()
    expect(() => parseWorkflowReview(JSON.stringify({ outcome: 'approved', summary: '', findings: [{ severity: 'blocking', location: 'a:1', evidence: 'Bug', action: 'Fix' }] }))).toThrow('blocking')
  })
  it('rejects cyclic dependencies, injected fields, commands without bounds and symlinked storage', async () => {
    const value = plan(); value.steps[0].dependsOn = ['step-2']
    expect(() => validatePlan(value)).toThrow('earlier steps')
    const { engine, directory } = setup()
    fs.mkdirSync(path.join(directory, 'task')); fs.symlinkSync(path.join(directory, 'outside'), path.join(directory, 'task/workflow.json'))
    await expect(engine.save('task', 0, plan())).rejects.toThrow('Unsafe')
    expect(() => validatePlan({ ...plan(), binary: '/tmp/injected' })).toThrow('fields')
  })
  it('runs Red before implementation, then requires Green and review', async () => {
    const order: string[] = []
    const { engine } = setup({ runAgent: async request => { order.push(request.prompt.startsWith('Implement only') ? 'write-red' : request.role); return request.role === 'reviewer' ? '{"outcome":"approved","summary":"OK","findings":[]}' : 'Done' },
      verify: async request => { const red = request.id.includes('-red-'); order.push(red ? 'red-check' : 'green-check'); return { id: request.id, command: request.command, status: red ? 'failed' : 'passed', exitCode: red ? 1 : 0, cleanupVerified: true, stdoutPath: '/out', stderrPath: '/err' } as Omit<WorkflowVerification, 'phase'> } })
    const value = plan(1); value.steps[0].red = value.steps[0].verification[0]
    await engine.save('task', 0, value); await engine.start('task', 1, 'start'); await finished(engine, 'completed')
    expect(order).toEqual(['write-red', 'red-check', 'coder', 'green-check', 'reviewer'])
  })
  it('never skips an unproven Red phase on retry', async () => {
    const phases: string[] = []
    const { engine } = setup({ verify: async request => {
      phases.push(request.id.includes('-red-') ? 'red' : 'green')
      return { id: request.id, command: request.command, status: 'passed', exitCode: 0, cleanupVerified: true, stdoutPath: '/out', stderrPath: '/err' }
    } })
    const value = plan(1); value.steps[0].red = value.steps[0].verification[0]
    await engine.save('task', 0, value); await engine.start('task', 1, 'start')
    const blocked = await finished(engine, 'blocked')
    expect(blocked.steps[0].status).toBe('blocked'); expect(phases).toEqual(['red', 'red', 'red'])
  })
  it('does not reuse old Red evidence after the paused step definition changes', async () => {
    const phases: string[] = []
    const { engine } = setup({ verify: async request => {
      phases.push(request.id.includes('-red-') ? 'red' : 'green')
      return { id: request.id, command: request.command, status: 'failed', exitCode: 1, cleanupVerified: true, stdoutPath: '/out', stderrPath: '/err' }
    } })
    const value = plan(1); value.advance = 'manual'; value.steps[0].red = value.steps[0].verification[0]
    await engine.save('task', 0, value); await engine.start('task', 1, 'first'); await finished(engine, 'paused')
    value.steps[0].instructions = 'Changed requirement: add a new boundary test'
    await engine.save('task', 1, value); await engine.start('task', 2, 'second'); await finished(engine, 'paused')
    expect(phases).toEqual(['red', 'green', 'red', 'green'])
  })
  it('refuses corrupt persisted receipts and invented completion instead of resuming them', async () => {
    const first = setup()
    await first.engine.save('task', 0, plan(1)); await first.engine.start('task', 1, 'start')
    const completed = await finished(first.engine, 'completed'); await first.engine.shutdown()
    const file = path.join(first.directory, 'task/workflow.json')
    const invalidReceipt = structuredClone(completed)
    Object.assign(invalidReceipt.steps[0].attempts[0].verification[0], { exitCode: '0' })
    fs.writeFileSync(file, JSON.stringify(invalidReceipt))
    await expect(setup({}, first.directory).engine.get('task')).rejects.toMatchObject({ code: 'RECOVERY_REQUIRED' })
    const inventedCompletion = structuredClone(completed)
    inventedCompletion.steps[0].status = 'pending'
    fs.writeFileSync(file, JSON.stringify(inventedCompletion))
    await expect(setup({}, first.directory).engine.get('task')).rejects.toMatchObject({ code: 'RECOVERY_REQUIRED' })
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(inventedCompletion)
    fs.writeFileSync(file, JSON.stringify(completed))
    expect(await setup({}, first.directory).engine.get('task')).toEqual(completed)
  })
  it('invalidates checks when the workspace changes during verification', async () => {
    let source = 0
    const { engine } = setup({ evidence: async () => `source-${source}`, verify: async request => {
      source++
      return { id: request.id, command: request.command, status: 'passed', exitCode: 0, cleanupVerified: true, stdoutPath: '/out', stderrPath: '/err' }
    } })
    await engine.save('task', 0, plan(1)); await engine.start('task', 1, 'start')
    const blocked = await finished(engine, 'blocked')
    expect(blocked.steps[0].attempts.every(attempt => attempt.error?.includes('stale'))).toBe(true)
    expect(blocked.steps[0].attempts.every(attempt => !attempt.review)).toBe(true)
  })
  it('does not start an agent when Quit overtakes asynchronous task validation', async () => {
    let release!: () => void
    let delay = false
    const barrier = new Promise<void>(resolve => { release = resolve })
    const { engine, calls } = setup({ validateTask: async () => { if (delay) await barrier } })
    await engine.save('task', 0, plan(1)); delay = true
    const start = engine.start('task', 1, 'start')
    await new Promise(resolve => setTimeout(resolve, 10))
    const stopping = engine.shutdown()
    release()
    await expect(start).rejects.toThrow('shutting down')
    await stopping; expect(calls).toHaveLength(0)
  })
})
