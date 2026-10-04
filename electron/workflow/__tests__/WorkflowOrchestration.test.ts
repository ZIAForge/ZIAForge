import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitOperationReceipt } from '../../../shared/git'
import type { WorkflowGitReceipt, WorkflowPlan, WorkflowSnapshot } from '../../../shared/workflow'
import { WorkflowEngine, type WorkflowEngineOptions } from '../WorkflowEngine'
import { validatePlan, validateStoredWorkflow } from '../WorkflowValidation'
import { createWorkflowTemplate } from '../WorkflowTemplates'
import { RecoveryStore } from '../../runtime/RecoveryStore'

const directories: string[] = []
const engines: WorkflowEngine[] = []
afterEach(async () => { for (const engine of engines.splice(0)) await engine.shutdown().catch(() => {}); for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })
const approved = JSON.stringify({ outcome: 'approved', findings: [], summary: 'Verified acceptance' })
const plan = (): WorkflowPlan => ({ title: 'Verified work', coderPreset: 'Coder', reviewers: [{ id: 'correctness', presetName: 'Correctness reviewer' }, { id: 'security', presetName: 'Security reviewer' }], reviewPolicy: 'all', review: true, advance: 'auto', maxFailures: 1, maxIterations: 5,
  steps: [{ id: 'one', title: 'One change', instructions: 'Implement one bounded change', acceptance: ['Verified output'], dependsOn: [], newContext: true, stopAfter: false, verification: [] }] })
function setup(options: Partial<WorkflowEngineOptions> = {}, directory?: string) {
  const root = directory ?? fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-orchestration-')))
  if (!directory) directories.push(root)
  const calls: Parameters<WorkflowEngineOptions['runAgent']>[0][] = []
  const engine = new WorkflowEngine({ directory: root, validateTask: () => {}, evidence: async () => 'same verified workspace',
    runAgent: async (request, _signal, onSession) => { calls.push(request); await onSession({ sessionId: `session-${calls.length}`, runId: `run-${calls.length}`, chatId: request.chatId }); return request.role === 'reviewer' ? approved : 'bounded report' },
    verify: async request => ({ id: request.id, status: 'passed', command: request.command, exitCode: 0, cleanupVerified: true, stdoutPath: '/stdout', stderrPath: '/stderr' }), ...options })
  engines.push(engine)
  return { root, engine, calls }
}
async function until(engine: WorkflowEngine, status: WorkflowSnapshot['status']) {
  await vi.waitFor(async () => expect((await engine.get('task'))!.status).toBe(status), { timeout: 15000 })
  return (await engine.get('task'))!
}
const operation = (kind: 'commit' | 'push', suffix: string): GitOperationReceipt => ({ schemaVersion: 1, taskId: 'task', operationId: `git-${suffix}`, kind, signature: 'verified-operation', status: 'succeeded', startedAt: 1, finishedAt: 2, beforeHead: 'a'.repeat(40), afterHead: 'b'.repeat(40), stdout: '', stderr: '' })

describe('durable multi-source review and explicit Git finalization', () => {
  it('runs the same preset as coder and repeated reviewers in independent contexts without waiving a blocking finding', async () => {
    let reviews = 0
    const calls: Parameters<WorkflowEngineOptions['runAgent']>[0][] = []
    const fixture = setup({ runAgent: async request => {
      calls.push(request)
      if (request.role !== 'reviewer') return 'Implementation report'
      return ++reviews === 1 ? approved : JSON.stringify({ outcome: 'changes_requested', findings: [{ severity: 'blocking', location: 'source.ts:4', evidence: 'Acceptance condition is absent', action: 'Implement it' }], summary: 'Correction required' })
    } })
    const value = plan(); value.reviewers = [{ id: 'first', presetName: 'Coder' }, { id: 'second', presetName: 'Coder' }]
    await fixture.engine.save('task', 0, value); await fixture.engine.start('task', 1, 'same-preset')
    const blocked = await until(fixture.engine, 'blocked')
    expect(calls.map(call => call.presetName)).toEqual(['Coder', 'Coder', 'Coder'])
    expect(new Set(calls.map(call => call.chatId)).size).toBe(3)
    expect(blocked.steps[0].attempts[0].reviewSources?.map(source => source.review?.outcome)).toEqual(['approved', 'changes_requested'])
    expect(blocked.steps[0].attempts[0].review?.findings[0].action).toBe('Implement it')
    expect(blocked.steps[0].status).toBe('blocked')
  }, 20000)

  it('retains every independent outcome and blocking finding, including disagreements, after a read-only helper', async () => {
    const roles: string[] = []
    const fixture = setup({ runAgent: async request => {
      roles.push(`${request.role}:${request.presetName}`)
      if (request.role === 'helper') return 'Evidence at source.ts:7'
      if (request.role === 'coder') { expect(request.prompt).toContain('Evidence at source.ts:7'); return 'Implemented' }
      return request.presetName === 'Security reviewer' ? JSON.stringify({ outcome: 'changes_requested', findings: [{ severity: 'blocking', location: 'source.ts:9', evidence: 'Unvalidated input reaches a command', action: 'Validate the command input' }], summary: 'Security correction required' }) : approved
    } })
    const value = plan(); value.helpers = [{ id: 'research', presetName: 'Researcher', instructions: 'Locate the entrypoint and existing validation' }]
    await fixture.engine.save('task', 0, value); await fixture.engine.start('task', 1, 'start')
    const result = await until(fixture.engine, 'blocked')
    expect(roles).toEqual(['helper:Researcher', 'coder:Coder', 'reviewer:Correctness reviewer', 'reviewer:Security reviewer'])
    const attempt = result.steps[0].attempts[0]
    expect(attempt.helperSources?.[0]).toMatchObject({ status: 'completed', output: 'Evidence at source.ts:7' })
    expect(attempt.reviewSources?.map(source => source.review?.outcome)).toEqual(['approved', 'changes_requested'])
    expect(attempt.review?.findings[0].action).toBe('Validate the command input')
    expect(attempt.status).toBe('failed')
    expect(() => validateStoredWorkflow(result, 'task')).not.toThrow()
  }, 20000)

  it('resumes interrupted Custom reviews from durable configurations without repeating the coder or completed reviewer', async () => {
    let reviewingSecond = false
    const first = setup({ runAgent: async (request, signal) => {
      if (request.role !== 'reviewer') return 'Implemented once'
      if (request.configuration?.model === 'correctness-model') return approved
      reviewingSecond = true
      return new Promise<string>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled review')), { once: true }))
    } })
    const value = plan(); value.maxIterations = 1
    value.reviewers = [
      { id: 'correctness', presetName: '@custom', configuration: { provider: 'codex', model: 'correctness-model', reasoningEffort: null, permissions: 'Workspace write' } },
      { id: 'security', presetName: '@custom', configuration: { provider: 'antigravity', model: 'security-model', reasoningEffort: 'high', permissions: 'CLI settings' } },
    ]
    await first.engine.save('task', 0, value); await first.engine.start('task', 1, 'start')
    // Reviews run concurrently: the second starting no longer implies that the first receipt is durable.
    await vi.waitFor(async () => {
      expect(reviewingSecond).toBe(true)
      expect((await first.engine.get('task'))?.steps[0].attempts[0].reviewSources?.find(source => source.sourceId === 'correctness')?.status).toBe('completed')
    }, { timeout: 15000 })
    const paused = await first.engine.pause('task')
    expect(paused.steps[0].attempts[0].reviewSources?.map(source => source.status)).toEqual(['completed', 'interrupted'])
    await first.engine.shutdown()
    const next = setup({}, first.root)
    await next.engine.start('task', 1, 'continue')
    const completed = await until(next.engine, 'completed')
    expect(next.calls.map(call => `${call.role}:${call.configuration?.model}`)).toEqual(['reviewer:security-model'])
    expect(next.calls[0].configuration).toEqual(value.reviewers[1].configuration)
    expect(completed.steps[0].attempts[0].reviewSources?.[0]).toEqual(paused.steps[0].attempts[0].reviewSources?.[0])
    expect(completed.iterations).toBe(1)
    expect(completed.steps[0].attempts).toHaveLength(1)
    expect(completed.steps[0].attempts[0].reviewSources).toHaveLength(2)
  }, 20000)

  it('detects a helper changing workspace content before any coder execution', async () => {
    let evidence = 'before'; let coder = false
    const fixture = setup({ evidence: async () => evidence, runAgent: async request => { if (request.role === 'coder') coder = true; evidence = 'mutated'; return 'I only inspected' } })
    const value = plan(); value.helpers = [{ id: 'helper', presetName: '@custom', configuration: { provider: 'antigravity', model: 'agy-model', permissions: 'CLI settings' }, instructions: 'Read the relevant code' }]
    await fixture.engine.save('task', 0, value); await fixture.engine.start('task', 1, 'start')
    const blocked = await until(fixture.engine, 'blocked')
    expect(blocked.reason).toContain('Helper helper changed the workspace')
    expect(blocked.steps[0].attempts[0].helperSources?.[0].status).toBe('failed')
    expect(coder).toBe(false)
  }, 20000)

  it('does not accept an approved Antigravity review after it changes workspace evidence', async () => {
    let evidence = 'verified implementation'
    const fixture = setup({ evidence: async () => evidence, runAgent: async request => {
      if (request.role === 'reviewer') { evidence = 'reviewer changed files'; return approved }
      return 'Implemented'
    } })
    const value = plan(); value.reviewers = [{ id: 'native', presetName: '@custom', configuration: { provider: 'antigravity', model: 'agy-model', permissions: 'CLI settings' } }]
    await fixture.engine.save('task', 0, value); await fixture.engine.start('task', 1, 'native-review')
    const blocked = await until(fixture.engine, 'blocked')
    expect(blocked.reason).toContain('Workspace changed during verification or review')
    expect(blocked.steps[0].status).toBe('blocked')
    expect(blocked.steps[0].attempts[0].status).toBe('failed')
    expect(blocked.steps[0].attempts[0].reviewSources?.[0].review?.outcome).toBe('approved')
    expect(blocked.steps[0].attempts[0].review).toBeUndefined()
  }, 20000)

  it('checks even the final manual checkpoint before Git, then restarts directly into finalization at the iteration limit', async () => {
    const finalize = vi.fn<NonNullable<WorkflowEngineOptions['finalize']>>(async (request, _signal, save) => {
      await request.assertVerified()
      const receipt: WorkflowGitReceipt = { status: 'completed', operations: [operation('commit', 'commit')] }
      await save(receipt); return receipt
    })
    const first = setup({ finalize }); const value = plan(); value.advance = 'manual'; value.maxIterations = 1; value.git = { commit: 'after-plan', merge: 'manual', push: 'manual' }
    await first.engine.save('task', 0, value); await first.engine.start('task', 1, 'start')
    const paused = await until(first.engine, 'paused')
    expect(paused.steps[0].status).toBe('completed')
    expect(paused.finalization?.status).toBe('pending')
    expect(finalize).not.toHaveBeenCalled()
    await first.engine.shutdown()
    const next = setup({ finalize }, first.root)
    await next.engine.start('task', 1, 'continue')
    const completed = await until(next.engine, 'completed')
    expect(next.calls).toEqual([])
    expect(finalize.mock.calls[0][0].id).toBe(paused.finalization!.id)
    expect(completed.finalization?.receipt?.operations).toHaveLength(1)
  }, 20000)

  it('blocks publication if files change after the last checkpoint while preserving completed steps', async () => {
    let evidence = 'before'
    const finalize = vi.fn<NonNullable<WorkflowEngineOptions['finalize']>>(async request => { await request.assertVerified(); return { status: 'completed', operations: [] } })
    const fixture = setup({ finalize, evidence: async () => evidence }); const value = plan(); value.steps[0].stopAfter = true; value.git = { commit: 'after-plan', merge: 'manual', push: 'manual' }
    await fixture.engine.save('task', 0, value); await fixture.engine.start('task', 1, 'start'); await until(fixture.engine, 'paused')
    evidence = 'unexpected edit'
    await fixture.engine.start('task', 1, 'continue')
    const blocked = await until(fixture.engine, 'blocked')
    expect(blocked.reason).toContain('Workspace changed')
    expect(blocked.steps[0].status).toBe('completed')
    expect(blocked.steps[0].attempts).toHaveLength(1)
  }, 20000)

  it('keeps successful Git receipts and stable identity when failed publication is repaired and explicitly continued', async () => {
    const commit = operation('commit', 'once')
    const first = setup({ finalize: async (_request, _signal, save) => { const receipt: WorkflowGitReceipt = { status: 'blocked', operations: [commit], error: 'Remote unavailable' }; await save(receipt); return receipt } })
    const value = plan(); value.git = { commit: 'after-plan', merge: 'manual', push: 'after-plan', remote: 'origin' }
    await first.engine.save('task', 0, value); await first.engine.start('task', 1, 'start')
    const blocked = await until(first.engine, 'blocked'); await first.engine.shutdown()
    const next = setup({ finalize: async request => { expect(request.previousReceipt?.operations).toEqual([commit]); expect(request.id).toBe(blocked.finalization!.id); expect(request.policy.remote).toBe('repaired-remote'); return { status: 'completed', operations: [commit, operation('push', 'retry')] } } }, first.root)
    const edited = structuredClone(value); edited.git!.remote = 'repaired-remote'
    await next.engine.save('task', 1, edited)
    await next.engine.start('task', 2, 'retry-publication')
    const completed = await until(next.engine, 'completed')
    expect(next.calls).toEqual([])
    expect(completed.finalization?.receipt?.operations.map(receipt => receipt.kind)).toEqual(['commit', 'push'])
  }, 20000)

  it('allows Git selection after a policy-only save without changing completed verification or review proof', async () => {
    const finalize = vi.fn<NonNullable<WorkflowEngineOptions['finalize']>>(async request => { await request.assertVerified(); return { status: 'completed', operations: [operation('commit', 'after-policy-edit')] } })
    const first = setup({ finalize }); const value = plan()
    await first.engine.save('task', 0, value); await first.engine.start('task', 1, 'start')
    const completed = await until(first.engine, 'completed')
    const originalStep = structuredClone(completed.steps[0])
    const edited = { ...value, advance: 'manual' as const }
    await first.engine.save('task', 1, edited)
    await first.engine.shutdown()
    const next = setup({ finalize }, first.root)
    const selected = await next.engine.save('task', 2, { ...edited, git: { commit: 'after-plan', merge: 'manual', push: 'manual' } })
    expect(selected.status).toBe('paused')
    expect(selected.steps[0]).toEqual(originalStep)
    expect(selected.finalization?.inputFingerprint).toBe(originalStep.attempts[0].workspaceFingerprint)
    expect(finalize).not.toHaveBeenCalled()
    await next.engine.start('task', 3, 'explicit-publication')
    expect((await until(next.engine, 'completed')).steps[0]).toEqual(originalStep)
    expect(next.calls).toEqual([])
    expect(finalize).toHaveBeenCalledTimes(1)
  }, 20000)

  it('does not use a policy revision to bind completed reviews to changed workspace bytes', async () => {
    let evidence = 'verified files'
    const finalize = vi.fn<NonNullable<WorkflowEngineOptions['finalize']>>(async () => ({ status: 'completed', operations: [] }))
    const fixture = setup({ finalize, evidence: async () => evidence }); const value = plan()
    await fixture.engine.save('task', 0, value); await fixture.engine.start('task', 1, 'start')
    const completed = await until(fixture.engine, 'completed')
    const edited = { ...value, advance: 'manual' as const }
    evidence = 'new unverified files'
    const saved = await fixture.engine.save('task', 1, edited)
    expect(saved.steps).toEqual(completed.steps)
    await expect(fixture.engine.save('task', 2, { ...edited, git: { commit: 'after-plan', merge: 'manual', push: 'manual' } })).rejects.toThrow(/Completed workspace changed/)
    expect((await fixture.engine.get('task'))!.revision).toBe(2)
    expect((await fixture.engine.get('task'))!.steps).toEqual(completed.steps)
    expect(finalize).not.toHaveBeenCalled()
  }, 20000)

  it.each([false, true])('upgrades legacy evidence only while its recorded target still matches (already changed revision: %s)', async changedRevision => {
    const first = setup(); const value = plan()
    await first.engine.save('task', 0, value); await first.engine.start('task', 1, 'start')
    const completed = await until(first.engine, 'completed'); await first.engine.shutdown()
    const legacy = structuredClone(completed)
    delete legacy.steps[0].attempts[0].workspaceFingerprint
    if (changedRevision) legacy.revision++
    fs.writeFileSync(path.join(first.root, 'task', 'workflow.json'), JSON.stringify(legacy))
    const next = setup({}, first.root)
    const edited = { ...value, advance: 'manual' as const }
    const migrated = await next.engine.save('task', legacy.revision, edited)
    expect(migrated.steps[0].attempts[0].targetFingerprint).toBe(legacy.steps[0].attempts[0].targetFingerprint)
    expect(migrated.steps[0].attempts[0].reviewSources).toEqual(legacy.steps[0].attempts[0].reviewSources)
    const selected = next.engine.save('task', migrated.revision, { ...edited, git: { commit: 'after-plan', merge: 'manual', push: 'manual' } })
    if (changedRevision) {
      expect(migrated.steps[0].attempts[0].workspaceFingerprint).toBeUndefined()
      await expect(selected).rejects.toThrow(/original evidence cannot be verified/)
    } else {
      expect(migrated.steps[0].attempts[0].workspaceFingerprint).toBe(completed.steps[0].attempts[0].workspaceFingerprint)
      expect((await selected).finalization?.status).toBe('pending')
    }
    expect(next.calls).toEqual([])
  }, 20000)

  it('requires explicit recovery and preserves the corrupt file rather than overwriting it from cache', async () => {
    const fixture = setup(); await fixture.engine.save('task', 0, plan())
    const file = path.join(fixture.root, 'task', 'workflow.json')
    fs.writeFileSync(file, '{damaged bytes')
    const unhandled: unknown[] = []
    const onUnhandled = (error: unknown) => { unhandled.push(error) }
    process.on('unhandledRejection', onUnhandled)
    try {
      await expect(fixture.engine.save('task', 1, plan())).rejects.toMatchObject({ code: 'RECOVERY_REQUIRED' })
      // Let the rejection notification run before another API call can observe the internal queue.
      await new Promise<void>(resolve => setImmediate(resolve))
      expect(unhandled).toEqual([])
      // Observing the rejected write must not turn damaged cached state into a usable snapshot.
      await expect(fixture.engine.get('task')).rejects.toMatchObject({ code: 'RECOVERY_REQUIRED' })
      await expect(fixture.engine.save('task', 1, plan())).rejects.toMatchObject({ code: 'RECOVERY_REQUIRED' })
      expect(fs.readFileSync(file, 'utf8')).toBe('{damaged bytes')
      const inspection = await fixture.engine.inspectRecovery('task')
      expect(inspection.state).toBe('corrupt'); expect(inspection.backups.length).toBeGreaterThan(0)
      await fixture.engine.restoreRecovery('task', { expectedFingerprint: inspection.fingerprint!, backupId: inspection.backups[0].id })
      expect((await fixture.engine.get('task'))!.revision).toBe(1)
      expect(fs.readdirSync(`${file}.recovery`).some(name => name.endsWith('.damaged'))).toBe(true)
    } finally { process.off('unhandledRejection', onUnhandled) }
  }, 20000)

  it('keeps a failed write poisoned across already queued parallel planning receipts', async () => {
    const fixture = setup({ writeArtifacts: async () => [], artifactContext: async () => '' })
    const value = createWorkflowTemplate({ title: 'Concurrent planning', description: 'Inspect the existing boundary.', mode: 'code', template: 'Multi-model', coderPreset: 'Coder', reviewerPreset: 'Reviewer' })
    await fixture.engine.save('task', 0, value)
    const file = path.join(fixture.root, 'task', 'workflow.json')
    const failure = new Error('Fixture storage unavailable while publishing the first planning stage')
    let failed = false, laterWrites = 0
    const write = RecoveryStore.prototype.write
    const spy = vi.spyOn(RecoveryStore.prototype, 'write').mockImplementation(function (this: RecoveryStore<unknown>, state, expected) {
      if (this.filename === file) {
        if (failed) laterWrites++
        else if ((state as WorkflowSnapshot).steps.some(step => step.attempts.some(attempt => attempt.multiStages?.length))) {
          failed = true
          throw failure
        }
      }
      return write.call(this, state, expected)
    })
    try {
      await fixture.engine.start('task', 1, 'start-parallel-planning')
      await vi.waitFor(() => expect(failed).toBe(true), { timeout: 15000 })
      await fixture.engine.stopTasks(['task']).catch(error => { expect(error).toBe(failure) })
      await expect(fixture.engine.get('task')).rejects.toBe(failure)
      await expect(fixture.engine.save('task', 1, value)).rejects.toBe(failure)
      expect(laterWrites).toBe(0)
      expect(fixture.calls).toEqual([])
      const persisted = JSON.parse(fs.readFileSync(file, 'utf8')) as WorkflowSnapshot
      expect(persisted.steps[0].attempts[0].multiStages).toBeUndefined()
    } finally { spy.mockRestore() }
  }, 20000)

  it('marks an interrupted finalization after a crash and reuses its durable identity without rerunning steps', async () => {
    const first = setup(); const value = plan(); value.advance = 'manual'; value.git = { commit: 'after-plan', merge: 'manual', push: 'manual' }
    await first.engine.save('task', 0, value); await first.engine.start('task', 1, 'start')
    const paused = await until(first.engine, 'paused'); await first.engine.shutdown()
    const raw = structuredClone(paused); raw.status = 'running'; raw.finalization!.status = 'running'
    raw.finalization!.receipt = { status: 'blocked', operations: [operation('commit', 'already-recorded')], error: 'Commit finished, acknowledgement pending' }
    fs.writeFileSync(path.join(first.root, 'task', 'workflow.json'), JSON.stringify(raw))
    const next = setup({ finalize: async request => { expect(request.id).toBe(raw.finalization!.id); return { status: 'completed', operations: request.previousReceipt!.operations } } }, first.root)
    const restored = (await next.engine.get('task'))!
    expect(restored.status).toBe('paused'); expect(restored.finalization?.status).toBe('blocked')
    expect(restored.finalization?.receipt?.operations).toHaveLength(1)
    expect(next.calls).toEqual([])
    await next.engine.start('task', 1, 'resume-git')
    await until(next.engine, 'completed')
    expect(next.calls).toEqual([])
  }, 20000)

  it('rejects restoring even a valid backup while an owned workflow process is active', async () => {
    let active = false
    const fixture = setup({ runAgent: async (_request, signal) => new Promise<string>((_resolve, reject) => { active = true; signal.addEventListener('abort', () => reject(new Error('stop')), { once: true }) }) })
    await fixture.engine.save('task', 0, plan()); await fixture.engine.start('task', 1, 'start')
    await vi.waitFor(() => expect(active).toBe(true), { timeout: 15000 })
    await expect(fixture.engine.restoreRecovery('task', { expectedFingerprint: 'a'.repeat(64), backupId: 'b'.repeat(64) })).rejects.toThrow(/Stop the workflow/)
    expect((await fixture.engine.get('task'))!.status).toBe('running')
    await fixture.engine.pause('task')
  }, 20000)

  it('rejects voting, duplicate reviewer identities and implicit publication destinations', () => {
    const value = plan()
    expect(() => validatePlan({ ...value, reviewPolicy: 'majority' })).toThrow(/voting/)
    expect(() => validatePlan({ ...value, reviewers: [value.reviewers![0], { id: value.reviewers![0].id, presetName: 'Another preset' }] })).toThrow(/distinct/)
    expect(() => validatePlan({ ...value, git: { commit: 'manual', merge: 'after-plan', push: 'manual' } })).toThrow(/destinations/)
  })
})
