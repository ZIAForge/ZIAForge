import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CodeFlowKind, CodeFlowResponse, CodePhase, CodePhaseResult } from '../../../shared/code-flow'
import type { WorkflowPlan, WorkflowReview, WorkflowSnapshot } from '../../../shared/workflow'
import { CodeArtifactStore } from '../CodeArtifacts'
import { WorkflowEngine, type WorkflowAgentRequest, type WorkflowEngineOptions } from '../WorkflowEngine'
import { createWorkflowTemplate } from '../WorkflowTemplates'
import { validateStoredWorkflow } from '../WorkflowValidation'

const roots: string[] = []
const engines: WorkflowEngine[] = []
afterEach(async () => {
  await Promise.all(engines.splice(0).map(engine => engine.shutdown().catch(() => {})))
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})
const green = { executable: '/fixture/check', args: ['green'], timeoutMs: 1000 }
const red = { executable: '/fixture/check', args: ['red'], timeoutMs: 1000 }
const approved: WorkflowReview = { outcome: 'approved', findings: [], summary: 'The selected acceptance criteria are supported by file and check evidence.' }
const blocking: WorkflowReview = { outcome: 'changes_requested', findings: [{ severity: 'blocking', location: 'code.ts:1', evidence: 'The boundary case needs correction.', action: 'Correct the boundary and rerun the check.' }], summary: 'A correction is required.' }
const suggestions: WorkflowReview = { outcome: 'approved', findings: [{ severity: 'suggestion', location: 'code.ts:1', evidence: 'The explanatory name could be clearer.', action: 'Consider a clearer name in follow-up work.' }], summary: 'Correct, with a non-blocking suggestion.' }
const templateNames: Record<CodeFlowKind, string> = { auto: 'Auto', 'fix-bug': 'Fix a bug', 'spec-first': 'Spec first', 'requirements-first': 'Requirements first', 'multi-model': 'Multi-model' }
interface FixtureOptions {
  kind?: CodeFlowKind
  root?: string
  large?: boolean
  answer?: boolean
  questionFirst?: boolean
  reviews?: WorkflowReview[]
  steps?: number
  prepMutation?: boolean
}
function fixture(config: FixtureOptions = {}) {
  const root = config.root ?? fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-code-flow-')))
  const workspace = path.join(root, 'workspace')
  const artifactRoot = path.join(root, 'artifacts')
  if (!config.root) {
    roots.push(root)
    fs.mkdirSync(workspace); fs.mkdirSync(artifactRoot)
    fs.writeFileSync(path.join(workspace, 'code.ts'), 'original source\n')
  }
  const store = new CodeArtifactStore(() => artifactRoot)
  const kind = config.kind ?? 'spec-first'
  const calls: WorkflowAgentRequest[] = []
  const checks: Parameters<WorkflowEngineOptions['verify']>[0][] = []
  const phases: CodePhase[] = []
  const finalize = vi.fn<NonNullable<WorkflowEngineOptions['finalize']>>(async () => ({ status: 'completed', operations: [] }))
  let questions = 0, reviewIndex = 0, implementations = 0
  const proposed = () => Array.from({ length: config.steps ?? 1 }, (_, index) => ({ title: `Concrete part ${index + 1}`, instructions: `Implement concrete boundary ${index + 1} in code.ts.`, acceptance: [`Boundary ${index + 1} passes its regression.`], verification: [green], ...(kind === 'fix-bug' && index === 0 ? { red } : {}) }))
  const phaseResult = (phase: CodePhase): CodePhaseResult => {
    if (config.questionFirst && ++questions === 1) return { status: 'needs_input', summary: 'Clarify the intended separator.', questions: [{ id: 'separator', question: 'Which separator should be supported?', options: ['Dash', 'Underscore'] }], artifacts: [], steps: [] }
    const artifacts: CodePhaseResult['artifacts'] = []
    if (phase === 'investigation') artifacts.push({ name: 'investigation.md', content: '# Investigation\nConcrete source evidence and reproduction.' })
    if (phase === 'requirements') artifacts.push({ name: 'requirements.md', content: '# Requirements\nAn observable boundary and its non-goals.' })
    if (phase === 'specification') artifacts.push({ name: 'spec.md', content: '# Specification\nChange code.ts and verify the existing boundary.' })
    if (phase === 'planning') artifacts.push({ name: kind === 'multi-model' ? 'final_plan.md' : 'planning.md', content: '# Plan\nImplement the explicit boundary and its regression.' })
    if (phase === 'delivery') {
      artifacts.push({ name: kind === 'multi-model' ? 'implementation_report.md' : 'report.md', content: '# Report\nImplementation and selected check receipts are recorded by the application.' })
      if (kind === 'fix-bug') artifacts.push({ name: 'investigation.md', content: '# Investigation\nThe regression failed before the fix and passed afterwards.' })
    }
    const producesSteps = phase === 'planning' || phase === 'investigation' || phase === 'specification' && kind === 'spec-first' || phase === 'discovery' && !config.large && !config.answer
    return { status: 'ready', summary: `Completed ${phase} from concrete repository evidence.`, questions: [], artifacts, steps: producesSteps ? proposed() : [], preamble: 'Preserve the existing boundary.', ...(phase === 'discovery' ? { complexity: config.large ? 'large' : 'small', intent: config.answer ? 'answer' : 'implement' } as const : {}) }
  }
  const engine = new WorkflowEngine({ directory: path.join(root, 'plans'), validateTask: taskId => { if (taskId !== 'task') throw new Error('Unknown task') },
    evidence: async () => createHash('sha256').update(JSON.stringify(fs.readdirSync(workspace).sort().map(name => [name, fs.readFileSync(path.join(workspace, name), 'utf8')]))).digest('hex'),
    writeArtifacts: (request, signal) => store.write(request, signal), artifactContext: (taskId, receipts) => store.context(taskId, receipts), finalize,
    runAgent: async (request, _signal, onSession) => {
      calls.push(request)
      await onSession({ chatId: request.chatId, sessionId: `session-${calls.length}`, runId: `run-${calls.length}` })
      const phase = /^Phase: (\S+)$/m.exec(request.prompt)?.[1] as CodePhase | undefined
      if (phase) {
        phases.push(phase)
        if (config.prepMutation) fs.writeFileSync(path.join(workspace, 'code.ts'), 'Unreviewed preparation mutation\n')
        return '```ziaforge-phase\n' + JSON.stringify(phaseResult(phase)) + '\n```'
      }
      if (request.role === 'reviewer') {
        if (kind === 'multi-model') expect(request.prompt).toContain('Saved implementation report:\nArtifact implementation_report.md')
        return JSON.stringify(config.reviews?.[reviewIndex++] ?? approved)
      }
      if (request.prompt.startsWith('Implement only the failing test')) {
        fs.writeFileSync(path.join(workspace, 'regression.txt'), 'A failing boundary assertion\n')
        return 'Added the failing regression only.'
      }
      fs.writeFileSync(path.join(workspace, 'code.ts'), `changed source ${++implementations}\n`)
      return `Implemented concrete boundary ${implementations}; the application must verify it.`
    },
    verify: async request => {
      checks.push(request)
      const failingRegression = request.command.args[0] === 'red' && fs.existsSync(path.join(workspace, 'regression.txt')) && fs.readFileSync(path.join(workspace, 'code.ts'), 'utf8') === 'original source\n'
      const passed = request.command.args[0] === 'green' && fs.readFileSync(path.join(workspace, 'code.ts'), 'utf8').startsWith('changed source ')
      return { id: request.id, command: request.command, inputFingerprint: request.inputFingerprint, status: passed ? 'passed' : 'failed', exitCode: passed ? 0 : failingRegression ? 1 : 2, cleanupVerified: true, stdoutPath: path.join(root, `${request.id}.out`), stderrPath: path.join(root, `${request.id}.err`), stdout: passed ? 'Boundary assertion passed' : 'Boundary assertion failed' }
    },
  })
  engines.push(engine)
  const plan = createWorkflowTemplate({ title: 'Preserve the boundary', description: 'Add one explicit configurable boundary.', mode: 'code', template: templateNames[kind], coderPreset: 'Coder', reviewerPreset: 'Reviewer' })
  // These retained cases cover saved pre-pipeline flows; native Multi has its own suite.
  delete plan.codeFlow!.multi
  delete plan.codeFlow!.interaction
  plan.codeFlow!.planner = { id: 'planner', presetName: 'Planner', reasoningEffort: 'medium', permissions: 'Read only' }
  plan.codeFlow!.fixer = { id: 'fixer', presetName: 'Fixer', reasoningEffort: 'high', permissions: 'Workspace write' }
  return { root, workspace, engine, store, plan, calls, checks, phases, finalize }
}
async function state(engine: WorkflowEngine, predicate: (snapshot: WorkflowSnapshot) => boolean): Promise<WorkflowSnapshot> {
  let result: WorkflowSnapshot | null = null
  await vi.waitFor(async () => { result = await engine.get('task'); expect(result && predicate(result)).toBe(true) }, { timeout: 15000, interval: 10 })
  return result!
}
async function gate(engine: WorkflowEngine, kind: 'questions' | 'plan' | 'review') {
  return state(engine, snapshot => snapshot.status === 'paused' && snapshot.codeFlow?.pending?.kind === kind)
}
function response(snapshot: WorkflowSnapshot, action: CodeFlowResponse['action'] = 'approve', commandId = `respond-${snapshot.sequence}`, text?: string): CodeFlowResponse {
  return { taskId: 'task', revision: snapshot.revision, gateId: snapshot.codeFlow!.pending!.id, commandId, action, ...(text !== undefined ? { text } : {}) }
}
async function begin(context: ReturnType<typeof fixture>, plan: WorkflowPlan = context.plan) {
  const saved = await context.engine.save('task', 0, plan)
  await context.engine.start('task', saved.revision, 'start')
}

// Real fsynced workflow/backup and artifact files are intentional. These bounds
// allow durable multi-phase I/O without replacing ordering assertions by sleeps.
describe('Code flow orchestration with real artifact storage', { timeout: 25000 }, () => {
  it.each([
    ['auto', ['discovery', 'requirements', 'specification', 'planning', 'delivery']],
    ['fix-bug', ['investigation', 'delivery']],
    ['spec-first', ['specification', 'delivery']],
    ['requirements-first', ['requirements', 'specification', 'planning', 'delivery']],
    ['multi-model', ['planning', 'delivery']],
  ] as const)('completes %s through its real preparation sequence and an accepted dynamic plan', async (kind, expectedPhases) => {
    const context = fixture({ kind, large: kind === 'auto', steps: kind === 'requirements-first' ? 2 : 1 })
    await begin(context)
    const proposal = await gate(context.engine, 'plan')
    expect(context.checks).toHaveLength(0)
    expect(context.calls.every(call => /^Phase:/m.test(call.prompt))).toBe(true)
    await expect(context.engine.start('task', proposal.revision, 'bypass')).rejects.toThrow(/decision/)
    expect(proposal.codeFlow!.pending!.proposedSteps!.filter(step => step.codePhase === 'implementation')).toHaveLength(kind === 'requirements-first' ? 2 : 1)
    await context.engine.respond(response(proposal))
    const completed = await state(context.engine, snapshot => snapshot.status === 'completed')
    expect(context.phases).toEqual(expectedPhases)
    expect(completed.steps.every(step => step.status === 'completed')).toBe(true)
    expect(context.checks.map(item => item.command.args[0])).toEqual(kind === 'fix-bug' ? ['red', 'green'] : kind === 'requirements-first' ? ['green', 'green'] : ['green'])
    const preparationCalls = context.calls.filter(call => /^Phase:/m.test(call.prompt))
    expect(new Set(preparationCalls.map(call => call.chatId)).size).toBe(preparationCalls.length)
    expect(preparationCalls.at(-1)?.presetName).toBe('Coder')
    expect(new Set(context.calls.map(call => call.clientMessageId)).size).toBe(context.calls.length)
    for (const artifact of completed.codeFlow!.artifacts) expect((await context.store.read('task', artifact)).content).not.toHaveLength(0)
    for (const step of completed.steps.filter(item => completed.plan.steps.find(definition => definition.id === item.id)?.codePhase !== 'implementation')) {
      expect(step.attempts.at(-1)?.preparation).toBeDefined()
      expect(step.attempts.at(-1)?.verification).toEqual([])
      expect(step.attempts.at(-1)?.review).toBeUndefined()
    }
    await context.engine.shutdown()
    const restarted = fixture({ root: context.root, kind })
    expect(await restarted.engine.get('task')).toEqual(completed)
    expect(restarted.calls).toHaveLength(0)
  })

  it('retains questions across restart, accepts one idempotent answer and rejects stale or altered decisions', async () => {
    const first = fixture({ questionFirst: true })
    await begin(first)
    const question = await gate(first.engine, 'questions')
    expect(question.steps[0].attempts[0].status).toBe('interrupted')
    await first.engine.shutdown()
    const restored = fixture({ root: first.root })
    const persisted = (await restored.engine.get('task'))!
    expect(persisted.codeFlow?.pending).toEqual(question.codeFlow?.pending)
    expect(restored.calls).toHaveLength(0)
    const answer = response(persisted, 'answer', 'same-answer', 'Underscore, while preserving the dash default.')
    await expect(restored.engine.respond({ ...answer, revision: answer.revision + 1 })).rejects.toThrow(/changed/)
    await restored.engine.respond(answer)
    const planGate = await gate(restored.engine, 'plan')
    const count = restored.calls.length
    expect(await restored.engine.respond(answer)).toEqual(planGate)
    expect(restored.calls).toHaveLength(count)
    await expect(restored.engine.respond({ ...answer, text: 'Different answer' })).rejects.toThrow(/different response/)
    await expect(restored.engine.respond({ ...answer, commandId: 'stale-answer' })).rejects.toThrow(/changed/)
    expect(restored.calls[0].prompt).toContain('Underscore, while preserving the dash default.')
    expect(restored.calls[0].chatId).not.toBe(first.calls[0].chatId)
    expect(restored.checks).toHaveLength(0)
    await restored.engine.respond(response(planGate))
    await state(restored.engine, snapshot => snapshot.status === 'completed')
    expect(restored.checks).toHaveLength(1)
  })

  it('rejects changed artifact bytes before approving commands and can cancel the retained gate', async () => {
    const context = fixture()
    await begin(context)
    const planGate = await gate(context.engine, 'plan')
    const artifact = planGate.codeFlow!.artifacts[0]
    fs.appendFileSync(artifact.path, '\nUnreviewed external edit')
    const approve = response(planGate, 'approve', 'changed-artifact')
    await expect(context.engine.respond(approve)).rejects.toThrow(/Artifact changed/)
    const after = (await context.engine.get('task'))!
    expect(after.commandIds).not.toContain(approve.commandId)
    expect(after.codeFlow?.pending).toEqual(planGate.codeFlow?.pending)
    expect(context.checks).toHaveLength(0)
    expect(context.calls).toHaveLength(1)
    expect((await context.engine.respond(response(after, 'cancel'))).status).toBe('paused')
  })

  it('gates blocking Multi review, uses one fresh fixer and never repeats an accepted suggestions review', async () => {
    const context = fixture({ kind: 'multi-model', reviews: [blocking, suggestions] })
    await begin(context)
    await context.engine.respond(response(await gate(context.engine, 'plan')))
    const blocked = await gate(context.engine, 'review')
    expect(blocked.codeFlow!.pending!.reviewOutcome).toBe('changes_requested')
    expect(context.calls.map(call => call.presetName)).toEqual(['Planner', 'Coder', 'Reviewer'])
    expect(blocked.codeFlow!.artifacts.map(item => item.name)).toEqual(['final_plan.md', 'implementation_report.md', 'final_review.md'])
    await context.engine.respond(response(blocked, 'approve', 'authorize-fixer'))
    const suggested = await gate(context.engine, 'review')
    expect(suggested.codeFlow!.pending!.reviewOutcome).toBe('approved')
    expect(context.calls.map(call => call.presetName)).toEqual(['Planner', 'Coder', 'Reviewer', 'Fixer', 'Reviewer'])
    expect(context.calls[3].chatId).not.toBe(context.calls[1].chatId)
    expect(suggested.codeFlow!.artifacts.some(item => item.name === 'fix_report.md')).toBe(true)
    const attemptCount = suggested.iterations
    const before = context.calls.length
    const accepted = await context.engine.respond(response(suggested, 'approve', 'accept-report'))
    expect(accepted.revision).toBe(suggested.revision)
    const completed = await state(context.engine, snapshot => snapshot.status === 'completed')
    expect(context.calls.length).toBe(before + 1) // Only the delivery report, no repeated implementation/review.
    expect(context.phases.at(-1)).toBe('delivery')
    expect(completed.iterations).toBe(attemptCount + 1)
    expect(context.calls.filter(call => call.role === 'reviewer')).toHaveLength(2)
    expect(context.checks).toHaveLength(2)
    expect(completed.codeFlow!.acceptedReviewAttemptIds).toEqual([suggested.codeFlow!.pending!.attemptId])
    expect(completed.steps.find(step => step.id === blocked.codeFlow!.pending!.stepId)!.attempts.map(attempt => attempt.status)).toEqual(['failed', 'completed'])
  })

  it('retains repeated blocking findings after the single fixer instead of entering another correction loop', async () => {
    const context = fixture({ kind: 'multi-model', reviews: [blocking, blocking] })
    await begin(context)
    await context.engine.respond(response(await gate(context.engine, 'plan')))
    await context.engine.respond(response(await gate(context.engine, 'review'), 'approve', 'one-fix'))
    const repeated = await gate(context.engine, 'review')
    const count = context.calls.length
    await expect(context.engine.respond(response(repeated, 'approve', 'second-fix'))).rejects.toThrow(/already authorized its fixer/)
    expect(context.calls).toHaveLength(count)
    expect(context.calls.filter(call => call.presetName === 'Fixer')).toHaveLength(1)
    expect(repeated.codeFlow!.artifacts.some(item => item.name === 'fix_report.md')).toBe(true)
  })

  it('blocks a changed workspace before delivery inference or Git publication and retains manual checkpoints', async () => {
    const context = fixture()
    context.plan.advance = 'manual'
    context.plan.git = { commit: 'after-plan', merge: 'manual', push: 'manual' }
    await begin(context)
    const planGate = await gate(context.engine, 'plan')
    await context.engine.respond(response(planGate))
    const checked = await state(context.engine, snapshot => snapshot.status === 'paused' && !snapshot.codeFlow?.pending)
    expect(checked.plan.steps.at(-1)?.codePhase).toBe('delivery')
    expect(checked.steps.at(-1)?.status).toBe('pending')
    expect(context.phases).toEqual(['specification'])
    fs.writeFileSync(path.join(context.workspace, 'code.ts'), 'External unverified source change\n')
    await context.engine.start('task', checked.revision, 'delivery-after-drift')
    const paused = await state(context.engine, snapshot => snapshot.status === 'paused' && snapshot.steps.at(-1)?.status === 'blocked')
    expect(paused.reason).toMatch(/Workspace changed after verified implementation/)
    expect(context.phases).toEqual(['specification'])
    expect(context.finalize).not.toHaveBeenCalled()
    expect(paused.finalization).toBeUndefined()
  })

  it('does not certify source changes made in preparation or an answer as verified implementation', async () => {
    const changed = fixture({ prepMutation: true })
    await begin(changed)
    const paused = await state(changed.engine, snapshot => snapshot.status === 'paused' && snapshot.steps[0].status === 'blocked')
    expect(paused.reason).toMatch(/preparation agent changed/)
    expect(paused.codeFlow!.pending).toBeUndefined()
    expect(changed.checks).toHaveLength(0)
    const answer = fixture({ kind: 'auto', answer: true })
    answer.plan.git = { commit: 'after-plan', merge: 'manual', push: 'manual' }
    await begin(answer)
    const completed = await state(answer.engine, snapshot => snapshot.status === 'completed')
    expect(completed.plan.steps.map(step => step.codePhase)).toEqual(['discovery'])
    expect(answer.finalize).not.toHaveBeenCalled()
    await expect(answer.engine.save('task', completed.revision, completed.plan)).rejects.toThrow(/no verified implementation/)
    const forged = structuredClone(completed)
    forged.steps[0].attempts[0].preparation = undefined
    expect(() => validateStoredWorkflow(forged, 'task')).toThrow(/no verified result/)
  })
})
