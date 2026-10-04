import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReviewTeamPreset } from '../../../shared/review-team'
import type { WorkflowPlan } from '../../../shared/workflow'
import { WorkflowEngine, type WorkflowEngineOptions, type WorkflowAgentRequest } from '../WorkflowEngine'
import { validateStoredWorkflow } from '../WorkflowValidation'
import { ReviewTeamStore } from '../ReviewTeamStore'
import { parseCodePhaseResult, validateCodeProposals } from '../CodeFlowProtocol'
import { specializationPrompt, validateSpecialization } from '../../../shared/specializations'

const roots: string[] = [], engines: WorkflowEngine[] = []
afterEach(async () => { for (const engine of engines.splice(0)) await engine.shutdown(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })
const approved = JSON.stringify({ outcome: 'approved', summary: 'Criteria supported', findings: [] })
const root = () => { const value = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'review-teams-'))); roots.push(value); return value }
const team = (): ReviewTeamPreset => ({ version: 1, id: 'team-one', name: 'Mixed team', reviewers: [
  { id: 'source-private-one', presetName: '@custom', configuration: { provider: 'codex', model: 'secret-model-one', permissions: 'Read only' }, specialization: { mode: 'manual', ids: ['security'] } },
  { id: 'source-private-two', presetName: '@custom', configuration: { provider: 'antigravity', model: 'secret-model-two', permissions: 'CLI settings' } },
], architect: { id: 'architect-private', presetName: '@custom', configuration: { provider: 'claude', model: 'architect-model', permissions: 'Read only' } } })
const plan = (): WorkflowPlan => ({ title: 'PRIVATE TASK TITLE', coderPreset: 'Coder', review: true, reviewTeam: team(), advance: 'auto', maxFailures: 1, maxIterations: 3,
  steps: [{ id: 'step', title: 'Private source change', instructions: 'PRIVATE IMPLEMENTATION INSTRUCTIONS', acceptance: ['Meets requirement'], dependsOn: [], verification: [], newContext: true, stopAfter: false }] })
function setup(runAgent: WorkflowEngineOptions['runAgent'], directory = root()) {
  const engine = new WorkflowEngine({ directory, validateTask: () => {}, evidence: async () => 'PRIVATE DIFF CONTENT', runAgent, verify: async () => { throw new Error('No command authorized') } })
  engines.push(engine); return { engine, directory }
}
const until = async (engine: WorkflowEngine, status: string) => { await vi.waitFor(async () => expect((await engine.get('task'))?.status).toBe(status), { timeout: 15000 }); return (await engine.get('task'))! }
function deferred() { let resolve!: (value: string) => void; const promise = new Promise<string>(ok => { resolve = ok }); return { promise, resolve } }

describe('parallel teams and blind architect', () => {
  it('starts independent reviewers together, waits for both reports, strips identities and persists the architect separately', async () => {
    const gates = [deferred(), deferred()], calls: WorkflowAgentRequest[] = []
    const { engine, directory } = setup(async (request, signal, onSession) => {
      calls.push(request); await onSession({ sessionId: `session-${calls.length}`, runId: `run-${calls.length}`, chatId: request.chatId })
      if (request.role === 'coder') return 'PRIVATE CODER OUTPUT'
      if (request.role === 'reviewer') return new Promise<string>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Paused')), { once: true })
        void gates[request.configuration?.model === 'secret-model-one' ? 0 : 1].promise.then(resolve, reject)
      })
      expect(request.toolPolicy).toBe('none')
      for (const privateText of ['PRIVATE TASK TITLE', 'PRIVATE DIFF CONTENT', 'PRIVATE CODER OUTPUT', 'PRIVATE IMPLEMENTATION INSTRUCTIONS', 'source-private-one', 'source-private-two', 'secret-model-one', 'secret-model-two', 'codex', 'antigravity']) expect(request.prompt).not.toContain(privateText)
      expect(request.prompt).toContain('report-1'); expect(request.prompt).toContain('report-2')
      expect(request.prompt).toContain('Reviewed acceptance boundary')
      return approved
    })
    await engine.save('task', 0, plan()); await engine.start('task', 1, 'start')
    await vi.waitFor(() => expect(calls.filter(call => call.role === 'reviewer')).toHaveLength(2), { timeout: 15000 })
    expect(calls.some(call => call.role === 'architect')).toBe(false)
    expect(calls.find(call => call.configuration?.model === 'secret-model-one')?.prompt).toContain('trust boundaries')
    gates[0].resolve(JSON.stringify({ outcome: 'approved', summary: 'source-private-one using secret-model-one (codex): Reviewed acceptance boundary', findings: [] }))
    await vi.waitFor(async () => expect((await engine.get('task'))?.steps[0].attempts[0].reviewSources?.filter(source => source.status === 'completed')).toHaveLength(1), { timeout: 15000 })
    expect(calls.some(call => call.role === 'architect')).toBe(false)
    gates[1].resolve(JSON.stringify({ outcome: 'approved', summary: 'source-private-two using secret-model-two (antigravity): adequate proof', findings: [] }))
    const completed = await until(engine, 'completed')
    expect(new Set(calls.map(call => call.chatId)).size).toBe(4)
    expect(completed.steps[0].attempts[0].architect).toMatchObject({ status: 'completed', review: JSON.parse(approved), session: { chatId: calls[3].chatId } })
    validateStoredWorkflow(completed, 'task')
    await engine.shutdown()
    const forbidden = vi.fn(async () => { throw new Error('Restored history must not invoke models') })
    const restarted = setup(forbidden, directory).engine
    expect((await restarted.get('task'))?.steps[0].attempts[0].architect).toEqual(completed.steps[0].attempts[0].architect)
    expect(forbidden).not.toHaveBeenCalled()
  }, 20000)

  it('retains a blocking minority finding even when the architect returns approval', async () => {
    const calls: string[] = []
    const { engine } = setup(async request => {
      calls.push(request.role)
      return request.role === 'reviewer' && request.configuration?.model === 'secret-model-one'
        ? JSON.stringify({ outcome: 'changes_requested', summary: 'Boundary absent', findings: [{ severity: 'blocking', location: 'input.ts:7', evidence: 'Unvalidated path reaches writer', action: 'Validate containment' }] })
        : request.role === 'coder' ? 'Implemented' : approved
    })
    await engine.save('task', 0, plan()); await engine.start('task', 1, 'start')
    const blocked = await until(engine, 'blocked'), attempt = blocked.steps[0].attempts[0]
    expect(calls.filter(role => role === 'architect')).toHaveLength(1)
    expect(attempt.review).toMatchObject({ outcome: 'changes_requested', findings: [{ severity: 'blocking', action: 'Validate containment' }] })
    expect(attempt.architect?.review).toEqual(attempt.review)
    expect(attempt.reviewSources).toHaveLength(2)
    expect(attempt.status).toBe('failed')
  }, 20000)

  it('never invokes the architect when one required report is malformed', async () => {
    const calls: string[] = []
    const { engine } = setup(async request => { calls.push(request.role); return request.role === 'reviewer' && request.configuration?.model === 'secret-model-two' ? 'No structured result' : request.role === 'coder' ? 'Implemented' : approved })
    await engine.save('task', 0, plan()); await engine.start('task', 1, 'start')
    const blocked = await until(engine, 'blocked')
    expect(calls.filter(role => role === 'reviewer')).toHaveLength(2)
    expect(calls).not.toContain('architect')
    expect(blocked.steps[0].attempts[0].reviewSources?.some(source => source.status === 'completed')).toBe(true)
    expect(blocked.steps[0].attempts[0].review).toBeUndefined()
  }, 20000)

  it('stores detached team snapshots and fails closed on invalid architect or specialization configuration', () => {
    const directory = root(), store = new ReviewTeamStore(directory), selected = team()
    store.save({ team: selected }); selected.reviewers[0].configuration!.model = 'later-change'
    expect(new ReviewTeamStore(directory).list()[0].reviewers[0].configuration?.model).toBe('secret-model-one')
    const read = store.list(); read[0].reviewers.splice(0)
    expect(store.list()[0].reviewers).toHaveLength(2)
    const invalid = team(); invalid.architect.configuration!.provider = 'codex'
    expect(() => store.save({ team: invalid })).toThrow(/architect/)
    expect(() => validateSpecialization({ mode: 'none', instructions: 'unexpected' })).toThrow()
    expect(() => validateSpecialization({ mode: 'manual', ids: ['unrecognized'] })).toThrow()
    store.remove({ id: selected.id }); expect(store.list()).toEqual([])
  })

  it('permits catalog-only planning suggestions, editable guidance and deterministic auto selection without granting tools', () => {
    const proposal = { title: 'Validate path', instructions: 'Reject escaped paths', acceptance: ['Containment holds'], verification: [], specialization: { mode: 'manual', ids: ['security'] } }
    const phase = { status: 'ready', summary: 'Plan ready', questions: [], artifacts: [], steps: [proposal] }
    expect(parseCodePhaseResult('```ziaforge-phase\n' + JSON.stringify(phase) + '\n```', 'planning', 'spec-first').steps[0].specialization).toEqual(proposal.specialization)
    const edited = { ...proposal, specialization: { mode: 'manual', instructions: 'Check Unicode path normalization' } }
    expect(() => validateCodeProposals([edited])).not.toThrow()
    expect(() => parseCodePhaseResult('```ziaforge-phase\n' + JSON.stringify({ ...phase, steps: [edited] }) + '\n```', 'planning', 'spec-first')).toThrow(/catalog/)
    expect(specializationPrompt({ mode: 'auto' }, 'permission boundary')).toContain('trust boundaries')
    expect(specializationPrompt({ mode: 'none' }, 'permission boundary')).toBe('')
  })
})
