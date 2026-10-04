import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowPlan, WorkflowReview, WorkflowSnapshot } from '../../../shared/workflow'
import type { CodeFlowResponse, CodePhaseResult } from '../../../shared/code-flow'
import { WorkflowEngine, type WorkflowAgentRequest } from '../WorkflowEngine'
import { CodeArtifactStore } from '../CodeArtifacts'
import { createWorkflowTemplate } from '../WorkflowTemplates'
import { validateStoredWorkflow } from '../WorkflowValidation'
import { reviewDecision } from '../MultiModelPipeline'

const roots: string[] = [], engines: WorkflowEngine[] = []
afterEach(async () => {
  await Promise.all(engines.splice(0).map(engine => engine.shutdown().catch(() => {})))
  roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true }))
})
const check = { executable: '/fixture/check', args: ['source'], timeoutMs: 1000 }
const approved: WorkflowReview = { outcome: 'approved', findings: [], summary: 'Checked the complete patch against the requested behavior.' }
const blocking: WorkflowReview = { outcome: 'changes_requested', summary: 'One boundary is wrong.', findings: [{ severity: 'blocking', location: 'code.ts:1', evidence: 'The changed implementation misses an accepted boundary.', action: 'Correct that boundary and verify it.' }] }
const suggestion: WorkflowReview = { outcome: 'approved', summary: 'Correct, with an optional naming improvement.', findings: [{ severity: 'suggestion', location: 'code.ts:1', evidence: 'The name could describe the result more precisely.', action: 'Consider clearer naming separately.' }] }
interface Options {
  root?: string
  decision?: 'auto' | 'always' | 'never'
  coordinator?: WorkflowReview[]
  malformed?: string
  transportFailure?: string
  waitForAbort?: string
  emptyPatch?: boolean
  drift?: string
  workerReview?: WorkflowReview
}
function fixture(options: Options = {}) {
  const root = options.root ?? fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-multi-')))
  const workspace = path.join(root, 'workspace'), artifactDirectory = path.join(root, 'artifacts')
  if (!options.root) {
    roots.push(root); fs.mkdirSync(workspace); fs.mkdirSync(artifactDirectory)
    fs.writeFileSync(path.join(workspace, 'code.ts'), 'original\n')
  }
  const store = new CodeArtifactStore(() => artifactDirectory)
  const calls: WorkflowAgentRequest[] = [], checks: string[] = []
  let implementationCount = 0, coordinatorCount = 0
  const proposal: CodePhaseResult = { status: 'ready', summary: 'One complete implementation pass and its check.', questions: [], artifacts: [{ name: 'final_plan.md', content: '# Final plan\nChange the boundary and run the accepted check.' }], steps: [{ title: 'Complete the change', instructions: 'Implement every numbered item in the final plan.', acceptance: ['The boundary is correct.'], verification: [check] }] }
  const stageOf = (request: WorkflowAgentRequest) => {
    const match = /^ZIAForge Multi-model ([\w-]+), worker (\d+), review\/fix cycle (\d+)\./.exec(request.prompt)
    return match ? { kind: match[1], index: Number(match[2]), cycle: Number(match[3]), key: `${match[1]}-${match[2]}` } : undefined
  }
  const engine = new WorkflowEngine({ directory: path.join(root, 'plans'), validateTask: id => { if (id !== 'task') throw new Error('Unknown task') },
    evidence: async () => JSON.stringify({ files: [{ path: 'code.ts', content: fs.readFileSync(path.join(workspace, 'code.ts'), 'utf8') }], diff: '-original\n+' + fs.readFileSync(path.join(workspace, 'code.ts'), 'utf8') }),
    reviewDiff: async () => options.emptyPatch ? '' : '-original\n+' + fs.readFileSync(path.join(workspace, 'code.ts'), 'utf8'),
    writeArtifacts: (request, signal) => store.write(request, signal), artifactContext: (id, receipts, referencesOnly) => store.context(id, receipts, referencesOnly),
    runAgent: async (request, signal, onSession) => {
      calls.push(request)
      await onSession({ sessionId: `session-${calls.length}`, runId: `run-${calls.length}`, chatId: request.chatId })
      const stage = stageOf(request)
      if (stage) {
        if (stage.key === options.waitForAbort) await new Promise<void>((_resolve, reject) => { if (signal.aborted) reject(new Error('paused')); else signal.addEventListener('abort', () => reject(new Error('paused')), { once: true }) })
        if (stage.key === options.transportFailure) throw new Error('Unknown transport delivery; no completed provider response')
        if (stage.key === options.drift) fs.writeFileSync(path.join(workspace, 'code.ts'), 'unreviewed worker mutation\n')
        if (stage.key === options.malformed) return 'Completed response omitted the required result object.'
        if (stage.kind === 'exploration' || stage.kind === 'design') {
          if (stage.kind === 'design') {
            expect(request.prompt).not.toContain('EXPLORATION_PRIVATE_BODY')
            const files = [...request.prompt.matchAll(/^File: (.+)$/gm)].map(item => item[1])
            expect(files.filter(file => path.basename(file).startsWith('exploration_'))).toHaveLength(2)
            for (const file of files) { expect(file.startsWith(artifactDirectory + path.sep)).toBe(true); expect(fs.existsSync(file)).toBe(true) }
          }
          return '```ziaforge-stage\n' + JSON.stringify({ summary: 'Checked actual source and its boundaries.', artifacts: [{ name: stage.kind === 'exploration' ? `exploration_${stage.index}.md` : `plan_draft_${stage.index}.md`, content: stage.kind === 'exploration' ? '# Evidence\nEXPLORATION_PRIVATE_BODY' : '# Alternative\nA concrete source-grounded design.' }] }) + '\n```'
        }
        if (stage.kind === 'synthesis') return '```ziaforge-phase\n' + JSON.stringify(proposal) + '\n```'
        if (stage.kind === 'review-worker' || stage.kind === 'review-coordinator') {
          const patches = [...request.prompt.matchAll(/^Artifact review_diff\.patch, version (\d+), SHA256 ([a-f0-9]{64})\nFile: (.+)$/gm)]
          expect(patches).toHaveLength(1)
          const actualPatch = fs.readFileSync(patches[0][3], 'utf8')
          expect(actualPatch).toBe('-original\n+' + fs.readFileSync(path.join(workspace, 'code.ts'), 'utf8'))
          expect(createHash('sha256').update(actualPatch).digest('hex')).toBe(patches[0][2])
          expect(request.prompt).toContain('Historical review and correction reports (context only, not approval of the current result)')
          if (stage.kind === 'review-coordinator') {
            expect(request.prompt).toContain('completedWorkers')
            expect(request.prompt).toContain('failedWorkers')
          }
        }
        if (stage.kind === 'review-worker') return JSON.stringify(options.workerReview ?? approved)
        if (stage.kind === 'review-coordinator') return JSON.stringify(options.coordinator?.[coordinatorCount++] ?? approved)
      }
      if (/^Phase: delivery$/m.test(request.prompt)) return '```ziaforge-phase\n' + JSON.stringify({ status: 'ready', summary: 'Recorded actual check and review outcomes.', questions: [], artifacts: [{ name: 'implementation_report.md', content: '# Delivery\nThe immutable previous implementation and review receipts are retained.' }], steps: [] }) + '\n```'
      if (!request.prompt.startsWith('Execute this approved ZIAForge Code implementation')) throw new Error('Unexpected agent prompt in the fixture')
      fs.writeFileSync(path.join(workspace, 'code.ts'), `changed-${++implementationCount}\n`)
      return `Implemented ${implementationCount}; verify the accepted command.`
    },
    verify: async request => {
      checks.push(request.id)
      const success = fs.readFileSync(path.join(workspace, 'code.ts'), 'utf8').startsWith('changed-')
      return { id: request.id, command: request.command, inputFingerprint: request.inputFingerprint, status: success ? 'passed' : 'failed', exitCode: success ? 0 : 1, cleanupVerified: true, stdoutPath: path.join(root, request.id + '.out'), stderrPath: path.join(root, request.id + '.err') }
    },
  })
  engines.push(engine)
  const plan = createWorkflowTemplate({ title: 'A complete native Multi task', description: 'Change one boundary.', mode: 'code', template: 'Multi-model', coderPreset: 'Chosen coder', reviewerPreset: 'Chosen reviewer' })
  plan.codeFlow!.multi!.reviewDecision = options.decision ?? 'always'
  return { root, workspace, engine, store, plan, calls, checks, stageOf, implementations: () => implementationCount }
}
async function wait(engine: WorkflowEngine, predicate: (state: WorkflowSnapshot) => boolean) {
  let result: WorkflowSnapshot | null = null
  await vi.waitFor(async () => { result = await engine.get('task'); expect(result && predicate(result), JSON.stringify({ status: result?.status, reason: result?.reason, steps: result?.steps.map(step => ({ status: step.status, error: step.attempts.at(-1)?.error })) })).toBe(true) }, { timeout: 25000, interval: 20 })
  return result!
}
async function gate(engine: WorkflowEngine, kind: string) { return wait(engine, state => state.status === 'paused' && state.codeFlow?.pending?.kind === kind) }
function response(state: WorkflowSnapshot, action: CodeFlowResponse['action'] = 'approve', text?: string): CodeFlowResponse {
  return { taskId: 'task', revision: state.revision, gateId: state.codeFlow!.pending!.id, commandId: `decision-${state.sequence}`, action, ...(text ? { text } : {}) }
}
async function start(context: ReturnType<typeof fixture>, plan: WorkflowPlan = context.plan) {
  const state = await context.engine.save('task', 0, plan)
  await context.engine.start('task', state.revision, 'start')
}
async function approvePlan(context: ReturnType<typeof fixture>) {
  const pending = await gate(context.engine, 'plan')
  expect(context.checks).toHaveLength(0)
  expect(context.implementations()).toBe(0)
  await context.engine.respond(response(pending))
}
function implementation(state: WorkflowSnapshot) { return state.steps.find(step => state.plan.steps.find(item => item.id === step.id)?.codePhase === 'implementation')! }

// These cases intentionally exercise fsynced snapshots and immutable artifacts.
// No subprocess, model or network call is made by this suite.
describe('Native Multi-model durable pipeline', { timeout: 40000 }, () => {
  it('does not infer a small documentation change from an empty tracked-only diff', () => {
    const context = fixture({ decision: 'auto' })
    const evidence = JSON.stringify({ files: [{ path: 'untracked.md' }], diff: '' })
    expect(reviewDecision(context.plan, evidence, '+' + 'untracked document '.repeat(3000)).decision).toBe('review')
    expect(reviewDecision(context.plan, evidence, '+' + 'line\n+'.repeat(80)).decision).toBe('ask')
  })

  it('retains planning workers and their own contexts across restart; completed stages are not repeated', async () => {
    const first = fixture({ waitForAbort: 'exploration-2' })
    await start(first)
    const active = await wait(first.engine, state => state.steps[0].attempts[0]?.multiStages?.some(stage => stage.kind === 'exploration' && stage.index === 1 && stage.status === 'completed') ?? false)
    const savedStage = active.steps[0].attempts[0].multiStages!.find(stage => stage.index === 1)!
    await first.engine.pause('task'); await first.engine.shutdown()
    const next = fixture({ root: first.root })
    const recovered = (await next.engine.get('task'))!
    expect(recovered.steps[0].attempts[0].multiStages!.find(stage => stage.id === savedStage.id)).toEqual(savedStage)
    await next.engine.start('task', recovered.revision, 'continue')
    await approvePlan(next)
    const complete = await wait(next.engine, state => state.status === 'completed')
    expect(next.calls.filter(call => next.stageOf(call)?.key === 'exploration-1')).toHaveLength(0)
    expect(complete.steps[0].attempts).toHaveLength(1)
    expect(complete.steps[0].attempts[0].multiStages?.filter(stage => stage.status === 'completed')).toHaveLength(6)
    expect(next.calls.filter(call => next.stageOf(call)?.kind === 'design')).toHaveLength(3)
    expect(next.calls.filter(call => next.stageOf(call)?.kind === 'review-worker')).toHaveLength(3)
    expect(new Set(next.calls.map(call => call.chatId)).size).toBe(next.calls.length)
    expect(next.checks).toHaveLength(1)
    validateStoredWorkflow(complete, 'task')
  })

  it('saves review choice and suggestions gates; acknowledgement never repeats the models or checks', async () => {
    const context = fixture({ decision: 'auto', coordinator: [suggestion] })
    await start(context); await approvePlan(context)
    const choice = await gate(context.engine, 'review-decision')
    expect(context.calls.filter(call => context.stageOf(call)?.kind === 'review-worker')).toHaveLength(0)
    await context.engine.respond(response(choice))
    const review = await gate(context.engine, 'review')
    const calls = context.calls.length
    expect(review.codeFlow?.pending?.reviewOutcome).toBe('approved')
    await context.engine.respond(response(review))
    const complete = await wait(context.engine, state => state.status === 'completed')
    expect(context.calls.length).toBe(calls + 1) // delivery only
    expect(context.checks).toHaveLength(1)
    expect(implementation(complete).attempts).toHaveLength(1)
    expect(implementation(complete).attempts[0].multiCompletion?.kind).toBe('reviewed')
  })

  it('fixes only after Gate B, never auto-reviews the fix, and records a later explicit review/fix cycle', async () => {
    const context = fixture({ coordinator: [blocking, blocking, blocking] })
    // Three deliberately blocking reviews precede the second explicit correction.
    context.plan.maxFailures = 4
    await start(context); await approvePlan(context)
    const firstGate = await gate(context.engine, 'review')
    await context.engine.respond(response(firstGate, 'changes', 'Check this finding against the unchanged command receipt.'))
    const reconsidered = await wait(context.engine, state => state.codeFlow?.pending?.kind === 'review' && state.codeFlow.pending.id !== firstGate.codeFlow!.pending!.id)
    expect(reconsidered.codeFlow!.multi!.reviewCycle).toBe(2)
    await context.engine.respond(response(reconsidered))
    const fixed = await wait(context.engine, state => state.status === 'completed')
    expect(context.implementations()).toBe(2)
    expect(context.calls.filter(call => context.stageOf(call)?.kind === 'review-worker')).toHaveLength(3)
    expect(context.checks).toHaveLength(2)
    expect(implementation(fixed).attempts.at(-1)?.multiCompletion).toMatchObject({ kind: 'fix', cycle: 1 })
    const rereview: CodeFlowResponse = { taskId: 'task', revision: fixed.revision, gateId: 'completed-review', commandId: 'explicit-review-2', action: 'rereview' }
    await context.engine.respond(rereview)
    const nextGate = await gate(context.engine, 'review')
    expect(context.implementations()).toBe(2)
    expect(context.checks).toHaveLength(2)
    expect(implementation(nextGate).attempts.at(-1)?.reusedVerificationFromAttemptId).toBe(implementation(fixed).attempts.at(-1)?.id)
    await context.engine.respond(response(nextGate))
    const final = await wait(context.engine, state => state.status === 'completed')
    expect(context.implementations()).toBe(3)
    expect(context.checks).toHaveLength(3)
    expect(final.codeFlow?.artifacts.map(item => item.name)).toEqual(expect.arrayContaining(['fix_report.md', 'fix_report_2.md', 'final_review_2.md', 'final_review_3.md']))
    expect(final.codeFlow?.multi).toMatchObject({ reviewCycle: 3, fixCycle: 2 })
    validateStoredWorkflow(final, 'task')
    const total = context.calls.length
    await context.engine.respond(rereview)
    expect(context.calls).toHaveLength(total)
    fs.appendFileSync(path.join(context.workspace, 'code.ts'), 'unverified external change\n')
    await expect(context.engine.respond({ ...rereview, revision: final.revision, commandId: 'refused-review' })).rejects.toThrow(/changed/)
    expect(context.calls).toHaveLength(total)
  })

  it('reconsiders Gate B comments with one fresh coordinator and the exact retained worker evidence', async () => {
    const context = fixture({ coordinator: [blocking, approved] })
    await start(context); await approvePlan(context)
    const retained = await gate(context.engine, 'review')
    await context.engine.respond(response(retained, 'changes', 'The existing regression already covers this case; verify the cited line.'))
    const complete = await wait(context.engine, state => state.status === 'completed')
    expect(context.calls.filter(call => context.stageOf(call)?.kind === 'review-worker')).toHaveLength(3)
    expect(context.calls.filter(call => context.stageOf(call)?.kind === 'review-coordinator')).toHaveLength(2)
    expect(context.implementations()).toBe(1)
    expect(context.checks).toHaveLength(1)
    const attempts = implementation(complete).attempts
    expect(attempts[1].reusedReviewFromAttemptId).toBe(attempts[0].id)
    expect(attempts[1].reviewSources).toEqual(attempts[0].reviewSources)
    validateStoredWorkflow(complete, 'task')
  })

  it.each(['design-2', 'review-worker-2'])('retains a malformed completed %s after one repair and delegates only with the surviving evidence', async malformed => {
    const context = fixture({ malformed })
    await start(context); await approvePlan(context)
    const complete = await wait(context.engine, state => state.status === 'completed')
    expect(context.calls.filter(call => context.stageOf(call)?.key === malformed)).toHaveLength(2)
    const failed = complete.steps.flatMap(step => step.attempts.flatMap(attempt => attempt.multiStages ?? [])).filter(stage => stage.status === 'failed')
    expect(failed).toHaveLength(1); expect(failed[0].error).toMatch(/Completed format failure/)
    const coordinator = context.calls.find(call => context.stageOf(call)?.kind === (malformed.startsWith('design') ? 'synthesis' : 'review-coordinator'))!
    expect(coordinator.prompt).toContain('Completed format failure')
    validateStoredWorkflow(complete, 'task')
  })

  it('does not waive explicitly configured failed reviewers and does not repair uncertain transport delivery', async () => {
    const custom = fixture({ malformed: 'review-worker-1' })
    custom.plan.reviewers = [{ id: 'exact-1', presetName: 'Chosen coder' }, { id: 'exact-2', presetName: 'Chosen coder' }]
    await start(custom); await approvePlan(custom)
    const failed = await wait(custom.engine, state => state.status === 'paused' && implementation(state)?.attempts.at(-1)?.status === 'failed')
    expect(custom.calls.filter(call => custom.stageOf(call)?.kind === 'review-coordinator')).toHaveLength(0)
    expect(implementation(failed).attempts.at(-1)?.reviewSources?.some(source => source.sourceId === 'exact-1' && source.status === 'failed')).toBe(true)
    const uncertain = fixture({ transportFailure: 'design-2' })
    await start(uncertain)
    await wait(uncertain.engine, state => state.status === 'paused' && state.steps[0].attempts[0]?.status === 'failed')
    expect(uncertain.calls.filter(call => uncertain.stageOf(call)?.key === 'design-2')).toHaveLength(1)
    expect(uncertain.calls.some(call => uncertain.stageOf(call)?.kind === 'synthesis')).toBe(false)
  })

  it('records an empty complete diff without fabricated reviewer approval or worker calls; mutation is fatal', async () => {
    const empty = fixture({ emptyPatch: true })
    await start(empty); await approvePlan(empty)
    const complete = await wait(empty.engine, state => state.status === 'completed')
    expect(empty.calls.some(call => empty.stageOf(call)?.kind.startsWith('review-'))).toBe(false)
    expect(implementation(complete).attempts[0].review).toBeUndefined()
    expect(implementation(complete).attempts[0].multiCompletion).toMatchObject({ kind: 'skipped', reason: expect.stringContaining('empty') })
    expect(complete.codeFlow?.artifacts.some(item => item.name === 'review_diff.patch')).toBe(false)
    const changed = fixture({ drift: 'design-1' })
    await start(changed)
    const paused = await wait(changed.engine, state => state.status === 'paused' && state.steps[0].attempts[0]?.status === 'failed')
    expect(paused.reason).toMatch(/changed the workspace|inputs changed/)
    expect(changed.calls.some(call => changed.stageOf(call)?.kind === 'synthesis')).toBe(false)
  })
})
