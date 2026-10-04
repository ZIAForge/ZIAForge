import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkFlowDefinition, WorkFlowResponse, WorkFlowSnapshot, WorkPhaseResult } from '../../../shared/work-flow'
import type { WorkflowAgentRequest } from '../WorkflowEngine'
import { WorkFlowEngine, type WorkEngineOptions } from '../WorkTaskEngine'
import { WorkArtifactStore } from '../WorkArtifacts'
import { validateWorkSnapshot } from '../WorkTaskValidation'

const roots: string[] = []
const engines: WorkFlowEngine[] = []
afterEach(async () => { await Promise.all(engines.splice(0).map(engine => engine.shutdown())); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })
const result = (extra: Partial<WorkPhaseResult> = {}): WorkPhaseResult => ({ status: 'complete', summary: 'A concrete retained answer.', questions: [], artifacts: [], sources: [], steps: [], ...extra })
const encode = (value: WorkPhaseResult) => '```ziaforge-work\n' + JSON.stringify(value) + '\n```'
const phase = (request: WorkflowAgentRequest) => /; phase ([^;]+);/.exec(request.prompt)![1]
const source = (request: WorkflowAgentRequest) => /; source ([^.]+)\./.exec(request.prompt)![1]
const check = { executable: '/fixture/verify', args: ['output.txt'], timeoutMs: 1000 }
function definition(kind: WorkFlowDefinition['kind'] = 'auto'): WorkFlowDefinition {
  return { version: 1, kind, request: 'Produce a useful bounded result from the explicit task inputs.', advance: 'auto', executor: { id: 'executor', presetName: 'Same preset' }, reviewers: [{ id: 'reviewer', presetName: 'Same preset' }], review: false, inputs: [], limits: { maxTurns: 50, maxFailures: 3, maxFollowUps: 10 }, ...(kind === 'deep-brainstorm' ? { deep: { workers: [1, 2, 3].map(index => ({ id: `worker-${index}`, presetName: 'Same preset' })) } } : {}) }
}
function fixture(answer: (request: WorkflowAgentRequest, signal: AbortSignal) => Promise<WorkPhaseResult> | WorkPhaseResult, extra: Partial<WorkEngineOptions> = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-work-engine-'))); roots.push(root)
  const workspace = path.join(root, 'workspace'), archive = path.join(root, 'artifacts'); fs.mkdirSync(workspace); fs.mkdirSync(archive)
  fs.writeFileSync(path.join(workspace, 'input.txt'), 'Explicit task evidence.\n')
  const artifacts = new WorkArtifactStore(() => archive, () => workspace)
  const calls: WorkflowAgentRequest[] = []
  const verification = vi.fn<WorkEngineOptions['verify']>(async request => ({ id: request.id, command: request.command, inputFingerprint: request.inputFingerprint, status: 'passed', exitCode: 0, cleanupVerified: true, stdoutPath: path.join(root, 'stdout.log'), stderrPath: path.join(root, 'stderr.log') }))
  const abandon = vi.fn(async () => {})
  const options: WorkEngineOptions = {
    directory: path.join(root, 'plans'), validateTask: taskId => { if (taskId !== 'task') throw new Error('Unknown task') }, validateInputs: () => {}, acquireWorkspace: () => () => {},
    evidence: async () => JSON.stringify(fs.readdirSync(workspace).sort().map(name => [name, fs.readFileSync(path.join(workspace, name), 'utf8')])),
    writeArtifacts: (request, signal) => artifacts.write(request, signal), artifactContext: (taskId, receipts) => artifacts.context(taskId, receipts), verify: verification, abandonInvocation: abandon,
    runAgent: async (request, signal, onSession) => { calls.push(request); await onSession({ chatId: request.chatId, sessionId: `session-${calls.length}`, runId: `run-${calls.length}` }); return encode(await answer(request, signal)) }, ...extra,
  }
  const create = () => { const engine = new WorkFlowEngine(options); engines.push(engine); return engine }
  return { root, workspace, artifacts, calls, verification, abandon, create, engine: create() }
}
async function observed(engine: WorkFlowEngine, predicate: (snapshot: WorkFlowSnapshot) => boolean) {
  let snapshot: WorkFlowSnapshot | null = null
  await vi.waitFor(async () => { snapshot = await engine.get('task'); expect(snapshot && predicate(snapshot)).toBe(true) }, { timeout: 20000, interval: 10 })
  return snapshot!
}
function response(snapshot: WorkFlowSnapshot, action: WorkFlowResponse['action'], extra: Partial<WorkFlowResponse> = {}): WorkFlowResponse {
  return { taskId: 'task', runId: snapshot.runId, revision: snapshot.revision, gateId: snapshot.pending!.id, commandId: `decision-${snapshot.sequence}`, action, ...extra }
}
async function begin(engine: WorkFlowEngine, value = definition()) { const saved = await engine.save('task', 0, value); await engine.start({ taskId: 'task', revision: saved.revision, commandId: 'start' }) }
function teamDefinition(): WorkFlowDefinition {
  return { ...definition(), request: 'PRIVATE ORIGINAL TASK AND SOURCE CONTEXT', review: true, reviewTeam: { version: 1, id: 'team', name: 'Frozen team', reviewers: [1, 2].map(index => ({ id: `team-reviewer-${index}`, presetName: '@custom', configuration: { provider: 'codex', model: `secret-model-${index}`, permissions: 'Read only' } })), architect: { id: 'architect', presetName: '@custom', configuration: { provider: 'claude', model: 'architect-model', permissions: 'Read only' } } } }
}

// These cases intentionally retain real fsynced state, archives and task files.
// Native transport and Electron UI are covered by their own independent suites.
describe('durable Work orchestration', { timeout: 30000 }, () => {
  it('runs every team reviewer in parallel and sends only anonymous reports to a conservative tool-free architect', async () => {
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const context = fixture(async request => {
      if (request.role === 'reviewer') {
        await barrier
        const first = request.configuration?.model === 'secret-model-1'
        return result({ summary: `I am ${first ? 'team-reviewer-1 using secret-model-1 Codex' : 'team-reviewer-2 using secret-model-2'}.`, review: { outcome: first ? 'changes_requested' : 'approved', findings: first ? ['Required correction remains unresolved.'] : [] } })
      }
      if (request.role === 'architect') return result({ summary: 'The reports disagree.', review: { outcome: 'approved', findings: [] } })
      return result({ artifacts: [{ name: 'answer.md', content: '# PRIVATE DELIVERABLE BYTES\n' }] })
    })
    await begin(context.engine, teamDefinition())
    await observed(context.engine, state => state.stages.filter(stage => stage.phase === 'review' && stage.status === 'running').length === 2 && context.calls.filter(call => call.role === 'reviewer').length === 2)
    expect(context.calls.some(call => call.role === 'architect')).toBe(false)
    release()
    const waiting = await observed(context.engine, state => state.pending?.kind === 'artifact-review')
    expect(waiting.pending!.actions).toEqual(['changes', 'cancel'])
    const request = context.calls.find(call => call.role === 'architect')!
    expect(request.toolPolicy).toBe('none')
    for (const secret of ['PRIVATE ORIGINAL', 'PRIVATE DELIVERABLE', 'Explicit task evidence', 'team-reviewer-1', 'secret-model-', 'Codex', 'input.txt', context.workspace]) expect(request.prompt).not.toContain(secret)
    expect(request.prompt).toContain('report-1'); expect(request.prompt).toContain('report-2')
    const stage = waiting.stages.find(item => item.phase === 'review-architect')!
    expect(stage.reportFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(stage.invocations.at(-1)!.result!.review).toMatchObject({ outcome: 'changes_requested', findings: ['Required correction remains unresolved.'] })
    expect(new Set(context.calls.map(call => call.chatId)).size).toBe(4)
    await expect(context.engine.respond(response(waiting, 'approve'))).rejects.toThrow(/checkpoint/)
    await context.engine.shutdown(); expect((await context.create().get('task'))!.pending!.id).toBe(waiting.pending!.id)
  })

  it('retains a completed peer report across a failed team review and restart without giving it to another reviewer', async () => {
    let attempts = 0
    const context = fixture(request => {
      if (request.role === 'reviewer' && request.configuration?.model === 'secret-model-1') return result({ summary: 'PRIVATE PEER REPORT', artifacts: [{ name: 'peer.md', content: 'PRIVATE PEER ARTIFACT' }], review: { outcome: 'approved', findings: [] } })
      if (request.role === 'reviewer') { expect(request.prompt).not.toContain('PRIVATE PEER'); attempts++; return result(attempts === 1 ? {} : { review: { outcome: 'approved', findings: [] } }) }
      return result(request.role === 'architect' ? { review: { outcome: 'approved', findings: [] } } : {})
    })
    await begin(context.engine, teamDefinition())
    const blocked = await observed(context.engine, state => state.status === 'blocked')
    expect(blocked.reason).toMatch(/explicit outcome/); expect(context.calls.some(call => call.role === 'architect')).toBe(false)
    expect(context.calls.filter(call => call.configuration?.model === 'secret-model-1')).toHaveLength(1)
    await context.engine.shutdown()
    const restarted = context.create(), current = (await restarted.get('task'))!
    await restarted.start({ taskId: 'task', revision: current.revision, commandId: 'retry-failed-review' })
    const complete = await observed(restarted, state => state.status === 'completed')
    expect(attempts).toBe(2); expect(context.calls.filter(call => call.configuration?.model === 'secret-model-1')).toHaveLength(1)
    expect(context.calls.filter(call => call.role === 'architect')).toHaveLength(1)
    const tampered = structuredClone(complete); delete tampered.stages.find(stage => stage.phase === 'review-architect')!.reportFingerprint
    expect(() => validateWorkSnapshot(tampered, 'task')).toThrow(/fingerprint/)
  })

  it('continues an explicitly interrupted architect after restart without replaying reviewers or leaking workspace context', async () => {
    let aggregationCalls = 0
    const context = fixture(async (request, signal) => {
      if (request.role === 'architect' && ++aggregationCalls === 1) return new Promise<WorkPhaseResult>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Known stopped turn')), { once: true }))
      return result(request.role === 'reviewer' || request.role === 'architect' ? { review: { outcome: 'approved', findings: [] } } : {})
    }, { recoverInvocation: async () => ({ status: 'interrupted' }) })
    await begin(context.engine, teamDefinition())
    await observed(context.engine, state => state.stages.some(stage => stage.phase === 'review-architect' && stage.status === 'running') && aggregationCalls === 1)
    const paused = await context.engine.pause('task'); expect(paused.status).toBe('paused')
    await context.engine.shutdown()
    const restarted = context.create(), restored = (await restarted.get('task'))!
    await restarted.start({ taskId: 'task', revision: restored.revision, commandId: 'continue-architect' })
    const completed = await observed(restarted, state => state.status === 'completed')
    expect(context.calls.filter(call => call.role === 'reviewer')).toHaveLength(2)
    const calls = context.calls.filter(call => call.role === 'architect')
    expect(calls).toHaveLength(2); expect(calls[1].clientMessageId).not.toBe(calls[0].clientMessageId)
    expect(calls[1].prompt).toBe(calls[0].prompt); expect(calls.every(call => call.toolPolicy === 'none')).toBe(true)
    expect(completed.stages.find(stage => stage.phase === 'review-architect')!.invocations.map(call => call.status)).toEqual(['interrupted', 'completed'])
  })
  it.each(['auto', 'research', 'write'] as const)('keeps %s direct answers free of manufactured plan steps and publishes genuine artifacts', async kind => {
    const context = fixture(() => result(kind === 'auto' ? {} : { artifacts: [{ name: kind === 'write' ? 'draft.md' : 'findings.md', content: '# Evidence-backed output\n' }] }))
    await begin(context.engine, definition(kind))
    let final = await observed(context.engine, state => ['completed', 'waiting'].includes(state.status))
    if (kind === 'write') { expect(final.pending!.kind).toBe('artifact-review'); await context.engine.respond(response(final, 'approve')); final = await observed(context.engine, state => state.status === 'completed') }
    expect(final.plan).toBeUndefined(); expect(context.calls).toHaveLength(1)
    for (const artifact of final.artifacts) { expect(fs.readFileSync(path.join(context.workspace, artifact.name), 'utf8')).toBe((await context.artifacts.read('task', artifact)).content); expect(path.basename(await context.artifacts.verifiedPath('task', artifact))).toBe(artifact.name) }
  })

  it('gates proposed commands and preserves a failed check until an explicit corrective invocation', async () => {
    let execution = 0
    const context = fixture(request => phase(request) === 'intake' ? result({ status: 'plan', steps: [{ title: 'Write output', instructions: 'Write output.txt.', acceptance: ['The exact approved check passes.'], verification: [check] }] }) : result({ artifacts: [{ name: 'output.txt', content: `corrective attempt ${++execution}\n` }] }))
    context.verification.mockImplementationOnce(async request => ({ id: request.id, command: request.command, inputFingerprint: request.inputFingerprint, status: 'failed', exitCode: 1, cleanupVerified: true, stdoutPath: '/retained/out', stderrPath: '/retained/err', error: 'The required assertion failed.' }))
    await begin(context.engine)
    const proposal = await observed(context.engine, state => state.pending?.kind === 'plan')
    expect(context.verification).not.toHaveBeenCalled(); expect(execution).toBe(0)
    const damaged = structuredClone(proposal); damaged.pending!.proposedSteps![0].verification[0].args = ['x\0bad']
    expect(() => validateWorkSnapshot(damaged, 'task')).toThrow()
    await context.engine.respond(response(proposal, 'approve'))
    const failed = await observed(context.engine, state => state.pending?.kind === 'artifact-review')
    expect(failed.pending!.actions).toEqual(['changes', 'cancel']); expect(failed.plan![0].status).toBe('pending')
    await expect(context.engine.start({ taskId: 'task', revision: failed.revision, commandId: 'bypass-check' })).rejects.toThrow(/decision/)
    await context.engine.respond(response(failed, 'changes', { text: 'Correct the output and rerun the approved check.' }))
    const complete = await observed(context.engine, state => state.status === 'completed')
    expect(complete.plan![0].status).toBe('completed'); expect(execution).toBe(2)
    expect(context.verification.mock.calls).toHaveLength(2)
    expect(context.verification.mock.calls[0][0].id).not.toBe(context.verification.mock.calls[1][0].id)
    expect(complete.stages.flatMap(stage => stage.verification).map(receipt => receipt.status)).toEqual(['failed', 'passed'])
  })

  it('retains Brainstorm breadth before review and starts the selected separate reviewer only on Finish', async () => {
    const context = fixture(request => result(phase(request) === 'review' ? { review: { outcome: 'approved', findings: [] } } : { artifacts: [{ name: 'ideas.md', content: '# Broad ideas\nSeveral distinct directions.\n' }] }))
    await begin(context.engine, { ...definition('brainstorm'), review: true })
    const breadth = await observed(context.engine, state => state.pending?.kind === 'brainstorm-direction')
    expect(context.calls.map(phase)).toEqual(['intake'])
    await context.engine.respond(response(breadth, 'finish'))
    await observed(context.engine, state => state.status === 'completed')
    expect(context.calls.map(phase)).toEqual(['intake', 'review']); expect(context.calls[1].role).toBe('reviewer'); expect(context.calls[1].chatId).not.toBe(context.calls[0].chatId)
  })

  it('resumes only asking Deep workers, repairs a report once, discloses partial results and updates small follow-ups without fan-out', async () => {
    const counts = new Map<string, number>()
    const context = fixture(request => {
      const key = `${phase(request)}:${source(request)}`, count = (counts.get(key) ?? 0) + 1; counts.set(key, count)
      if (phase(request) === 'worker') {
        if (source(request) === 'worker-1' && count === 1) return result({ status: 'needs_input', questions: [{ id: 'scope', question: 'Which audience?' }] })
        if (source(request) === 'worker-3' || source(request) === 'worker-2' && count === 1) return result()
        return result({ artifacts: [{ name: `brainstormer_${source(request).at(-1)}_report.md`, content: `# Independent ${source(request)}\nEvidence and limitations.\n` }] })
      }
      if (phase(request) === 'synthesis') { expect(request.prompt).toContain('failed'); return result({ artifacts: [{ name: 'brainstorm_report.md', content: '# Synthesis\nWorkers 1 and 2 supplied reports; worker 3 remained invalid.\n' }] }) }
      if (phase(request) === 'follow-up') return result({ followUpSize: 'small', artifacts: [{ name: 'brainstorm_report.md', content: '# Synthesis\nSmall clarification with unchanged research scope.\n' }] })
      return result()
    })
    await begin(context.engine, definition('deep-brainstorm'))
    const waiting = await observed(context.engine, state => state.pending?.kind === 'questions')
    expect(counts.get('worker:worker-2')).toBe(2); expect(counts.get('worker:worker-3')).toBe(2)
    await context.engine.shutdown()
    const restored = context.create(), restoredGate = (await restored.get('task'))!
    const answer = response(restoredGate, 'answer', { answers: restoredGate.pending!.questions!.map(question => ({ questionId: question.id, text: 'A small professional audience.' })) })
    await restored.respond(answer); await restored.respond(answer)
    const report = await observed(restored, state => state.pending?.kind === 'artifact-review')
    expect(counts.get('worker:worker-1')).toBe(2); expect(counts.get('worker:worker-2')).toBe(2); expect(counts.get('worker:worker-3')).toBe(2)
    expect(report.failures).toBe(0); expect(report.artifacts.filter(item => /brainstormer_/.test(item.name))).toHaveLength(2)
    expect(context.calls.filter(request => phase(request) === 'worker').every(request => !request.prompt.includes('Artifact brainstormer_'))).toBe(true)
    await expect(restored.respond({ ...answer, commandId: 'stale' })).rejects.toThrow(/changed/)
    await restored.respond(response(report, 'approve-with-comments', { text: 'Keep the failed-worker limitation visible.' }))
    const complete = await observed(restored, state => state.status === 'completed')
    const previousCalls = context.calls.length
    await restored.followUp({ taskId: 'task', runId: complete.runId, revision: complete.revision, commandId: 'follow-up', text: 'Clarify the existing recommendation without expanding the analysis.' })
    const update = await observed(restored, state => state.pending?.kind === 'artifact-review')
    expect(context.calls.slice(previousCalls).map(phase)).toEqual(['follow-up']); expect(update.artifacts.filter(item => item.name === 'brainstorm_report.md').map(item => item.version)).toEqual([1, 2])
    expect(waiting.pending!.questions![0].stageIds).toHaveLength(1)
  })

  it('requires explicit recovery for an unknown delivery and never reuses its client message or chat identity', async () => {
    let first = true
    const context = fixture(() => { if (first) { first = false; throw new Error('Transport closed without a completion receipt') } return result() }, { recoverInvocation: async () => ({ status: 'uncertain' }) })
    await begin(context.engine)
    const blocked = await observed(context.engine, state => state.status === 'blocked')
    await context.engine.start({ taskId: 'task', revision: blocked.revision, commandId: 'inspect-delivery' })
    const gate = await observed(context.engine, state => state.pending?.kind === 'recovery')
    expect(context.calls).toHaveLength(1)
    await context.engine.respond(response(gate, 'continue'))
    await observed(context.engine, state => state.status === 'completed')
    expect(context.abandon).toHaveBeenCalledOnce(); expect(context.calls).toHaveLength(2)
    expect(context.calls[1].clientMessageId).not.toBe(context.calls[0].clientMessageId); expect(context.calls[1].chatId).not.toBe(context.calls[0].chatId)
  })

  it('records a semantic transition rejection without poisoning subsequent get, pause or save', async () => {
    // A valid generic result is not a valid Brainstorm transition. Its rejected
    // state clone must not poison the durable queue or leave a phantom run.
    const release = vi.fn()
    const context = fixture(() => result({ status: 'plan', steps: [{ title: 'Invented step', instructions: 'This mode may not create an execution plan.', acceptance: [], verification: [] }] }), { acquireWorkspace: () => release })
    await begin(context.engine, definition('brainstorm'))
    const blocked = await observed(context.engine, state => state.status === 'blocked')
    expect(blocked.reason).toMatch(/does not create an execution plan/)
    expect((await context.engine.pause('task')).status).toBe('paused')
    expect(release).toHaveBeenCalledOnce()
    const saved = await context.engine.save('task', blocked.revision, { ...definition('brainstorm'), advance: 'manual' })
    expect(saved.definition.advance).toBe('manual'); expect(saved.stages[0].transitioned).not.toBe(true)
  })

  it('quarantines a restored pre-invocation backup across restart until explicit fresh-context recovery', async () => {
    const context = fixture(() => result({ artifacts: [{ name: 'result.md', content: '# Real delivered work\n' }] }))
    const draft = await context.engine.save('task', 0, definition())
    const draftIdentity = (await context.engine.inspectRecovery('task')).fingerprint!
    await context.engine.start({ taskId: 'task', revision: draft.revision, commandId: 'initial-start' })
    await observed(context.engine, state => state.status === 'completed')
    await context.engine.pause('task') // Observe owned execution cleanup before recovery.
    expect(context.calls).toHaveLength(1)
    const primary = path.join(context.root, 'plans', 'task', 'work-flow.json')
    fs.writeFileSync(primary, '{"damaged":')
    const damaged = await context.engine.inspectRecovery('task')
    expect(damaged.backups.some(backup => backup.id === draftIdentity)).toBe(true)
    await context.engine.restoreRecovery('task', { expectedFingerprint: damaged.fingerprint!, backupId: draftIdentity })
    await context.engine.shutdown()
    const restarted = context.create()
    const gate = (await restarted.get('task'))!
    expect(gate.pending!.kind).toBe('recovery'); expect(gate.recoveryGeneration).toBe(1); expect(gate.turns).toBe(0)
    expect(gate.pending!.summary).toMatch(/Newer calls may already have run/)
    await expect(restarted.start({ taskId: 'task', revision: gate.revision, commandId: 'unsafe-start' })).rejects.toThrow(/decision/)
    expect(context.calls).toHaveLength(1)
    await restarted.respond(response(gate, 'continue'))
    const completed = await observed(restarted, state => state.status === 'completed')
    expect(context.calls).toHaveLength(2)
    expect(context.calls[1].clientMessageId).not.toBe(context.calls[0].clientMessageId); expect(context.calls[1].chatId).not.toBe(context.calls[0].chatId)
    expect(context.calls[1].prompt).toContain('Do not repeat already completed actions')
    expect(fs.readFileSync(path.join(context.workspace, 'result.md'), 'utf8')).toBe('# Real delivered work\n')
    expect((await restarted.get('task'))!.sequence).toBe(completed.sequence)
    expect(fs.readdirSync(path.join(context.root, 'plans', 'task', 'restore-generations'))).toEqual(['000000000001'])
  })

  it('prepares inputs only after save ownership checks and exposes the actual locked draft to relocation', async () => {
    const prepare = vi.fn<NonNullable<WorkEngineOptions['prepareDefinition']>>((_taskId, value) => value)
    const context = fixture(() => result(), { prepareDefinition: prepare })
    const saved = await context.engine.save('task', 0, definition())
    const relocated = await context.engine.withDraftWorkspace('task', current => ({ runId: current.runId, revision: current.revision }))
    expect(relocated).toEqual({ runId: saved.runId, revision: saved.revision })
    await expect(context.engine.save('task', 0, definition())).rejects.toThrow(/changed/); expect(prepare).toHaveBeenCalledOnce()
    await context.engine.start({ taskId: 'task', revision: saved.revision, commandId: 'start' }); await observed(context.engine, state => state.status === 'completed')
    await expect(context.engine.save('task', saved.revision, { ...definition(), request: 'Replace the original immutable input.' })).rejects.toThrow(/original inputs/)
    await expect(context.engine.withDraftWorkspace('task', () => {})).rejects.toThrow(/first invocation/); expect(prepare).toHaveBeenCalledOnce()
  })

  it('refuses changed archived artifacts and never overwrites an unrelated existing deliverable', async () => {
    const context = fixture(() => result({ artifacts: [{ name: 'draft.md', content: '# Owned draft\n' }] }))
    await begin(context.engine, definition('write'))
    const gate = await observed(context.engine, state => state.pending?.kind === 'artifact-review')
    fs.writeFileSync(gate.artifacts[0].path, 'Changed archive')
    await expect(context.engine.respond(response(gate, 'approve'))).rejects.toThrow(/changed/)
    expect((await context.engine.get('task'))!.pending!.id).toBe(gate.pending!.id)
    const other = fixture(() => result({ artifacts: [{ name: 'draft.md', content: '# Unapproved overwrite\n' }] }))
    fs.writeFileSync(path.join(other.workspace, 'draft.md'), 'Existing personal content\n')
    await begin(other.engine, definition('write')); await observed(other.engine, state => state.status === 'blocked')
    expect(fs.readFileSync(path.join(other.workspace, 'draft.md'), 'utf8')).toBe('Existing personal content\n')
  })
})
