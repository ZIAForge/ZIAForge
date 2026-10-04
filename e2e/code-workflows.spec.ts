import { readFile, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { test, expect } from './fixtures'
import type { CodeArtifactReceipt, CodeFlowGate, CodeFlowKind } from '../shared/code-flow'

test.use({ providerFixture: 'codex' })

const flows: Array<{ kind: CodeFlowKind; card: string; phases: string[]; artifacts: string[] }> = [
  { kind: 'auto', card: 'auto', phases: ['discovery', 'implementation', 'delivery'], artifacts: ['planning.md', 'report.md'] },
  { kind: 'fix-bug', card: 'fix-a-bug', phases: ['investigation', 'implementation', 'delivery'], artifacts: ['investigation.md', 'report.md'] },
  { kind: 'spec-first', card: 'spec-first', phases: ['specification', 'implementation', 'delivery'], artifacts: ['spec.md', 'report.md'] },
  { kind: 'requirements-first', card: 'requirements-first', phases: ['requirements', 'specification', 'planning', 'implementation', 'delivery'], artifacts: ['requirements.md', 'spec.md', 'planning.md', 'report.md'] },
  { kind: 'multi-model', card: 'multi-model', phases: ['planning', 'implementation', 'delivery'], artifacts: ['exploration_1.md', 'exploration_2.md', 'plan_draft_1.md', 'plan_draft_2.md', 'plan_draft_3.md', 'final_plan.md', 'implementation_report.md', 'review_diff.patch', 'review_worker_1.json', 'review_worker_2.json', 'review_worker_3.json', 'final_review.md', 'fix_report.md'] },
]

for (const flow of flows) test(`Code Start ${flow.kind}: actual documents, accepted checks and isolated phase contexts`, async ({ app }, testInfo) => {
  test.setTimeout(flow.kind === 'multi-model' ? 300_000 : 180_000)
  const title = `Code flow fixture ${flow.kind}`
  // Disposable fixture inputs, committed before ordinary UI task creation so
  // the production worktree contains a real defect and an executable check.
  const repository = testInfo.outputPath('profile', 'project', 'repo')
  const initialSource = "'use strict'\nmodule.exports = () => true\n"
  const initialSha = createHash('sha256').update(initialSource).digest('hex')
  await writeFile(path.join(repository, 'identifier.cjs'), initialSource)
  await writeFile(path.join(repository, 'check-identifier.cjs'), "const assert = require('node:assert/strict')\nconst valid = require('./identifier.cjs')\nassert.equal(valid('valid_id'), true)\nassert.equal(valid('not valid'), false)\nassert.equal(valid('2invalid'), false)\nassert.equal(valid(null), false)\nconsole.log('CODE_FLOW_REAL_CHECK_OK')\n")
  const git = async (cwd: string, args: string[]) => (await promisify(execFile)('/usr/bin/git', args, { cwd, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } })).stdout.trim()
  await git(repository, ['add', '--', 'identifier.cjs', 'check-identifier.cjs'])
  await git(repository, ['-c', 'user.name=ZIAForge E2E', '-c', 'user.email=e2e@ziaforge.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Code workflow fixture inputs'])
  const initialHead = await git(repository, ['rev-parse', 'HEAD'])

  await app.window.getByRole('button', { name: 'New task', exact: true }).first().click()
  const form = app.window.locator('form')
  await form.getByRole('button', { name: 'E2E Project', exact: true }).click()
  await form.getByRole('button', { name: 'E2E Project', exact: true }).last().click()
  await form.getByTestId('new-task-agent-preset').selectOption('E2E Codex')
  await form.getByTestId('new-task-agent-permissions').selectOption('Workspace write')
  await form.getByPlaceholder('new-task-xxxx').fill(`code-flow-${flow.kind}`)
  await app.window.getByTestId(`new-workflow-${flow.card}`).click()
  await form.getByTestId('new-code-options').locator(':scope > summary').click()
  await form.getByTestId('new-code-reviewer').selectOption('E2E Codex')
  if (flow.kind !== 'auto') await form.getByTestId('new-code-auto').check()
  if (flow.kind === 'multi-model') {
    // Deliberately choose a different model/effort for planning and an explicit
    // fixer effort. Every spawned stage must retain its actual selected config.
    await form.getByTestId('new-code-reviewer-execution-options').locator(':scope > summary').click()
    await form.getByTestId('new-code-reviewer-reasoning-effort').selectOption('medium')
    await form.getByTestId('new-code-planner').selectOption('@custom')
    await form.getByTestId('new-code-planner-model').fill('codex-fixture-next')
    await form.getByTestId('new-code-planner-execution-options').locator(':scope > summary').click()
    await form.getByTestId('new-code-planner-reasoning-effort').selectOption('xhigh')
    await form.getByTestId('new-code-fixer').selectOption('E2E Codex')
    await form.getByTestId('new-code-fixer-execution-options').locator(':scope > summary').click()
    await form.getByTestId('new-code-fixer-reasoning-effort').selectOption('high')
    await form.getByTestId('new-code-fixer-permissions').selectOption('Workspace write')
  }
  await form.locator('textarea').first().fill(title)
  await app.window.screenshot({ path: testInfo.outputPath('01-selected-flow-and-roles.png'), fullPage: true })
  await form.getByTestId('new-task-start').click()
  await expect(app.window.getByTestId('code-dialogue')).toBeVisible()
  if (!await app.window.getByTestId('executable-plan').isVisible()) await app.window.getByTestId('tab-btn-todo').click()
  await expect(app.window.getByTestId('executable-plan')).toBeVisible()
  await expect.poll(async () => (await app.window.evaluate(() => window.ziafAPI.getTasks())).filter(item => item.name === title).length).toBe(1)
  const task = (await app.window.evaluate(() => window.ziafAPI.getTasks())).find(item => item.name === title)!
  expect(task).toMatchObject({ codeFlowVersion: 1, repoId: 'repo-e2e', agentProvider: 'codex', permissions: 'Workspace write' })
  expect(task.startupError).toBeUndefined()
  const workspace = task.worktreePath!
  expect(workspace).toContain('worktrees')
  const snapshot = () => app.window.evaluate(taskId => window.ziafAPI.workflows.get({ taskId }), task.id)
  const openPlan = async () => {
    await app.window.getByRole('button', { name: title, exact: true }).click()
    if (!await app.window.getByTestId('executable-plan').isVisible()) await app.window.getByTestId('tab-btn-todo').click()
    await expect(app.window.getByTestId('executable-plan')).toBeVisible()
  }
  const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt')
  const gate = async (kind: 'questions' | 'document' | 'plan' | 'review' | 'review-decision') => {
    await expect.poll(async () => (await snapshot())?.codeFlow?.pending?.kind, { timeout: 40_000 }).toBe(kind)
    await app.window.getByTestId('open-code-dialogue').click()
    await expect(app.window.getByTestId('code-flow-gate')).toBeVisible()
    await expect(app.window.getByTestId('workflow-start')).toBeDisabled()
  }
  await expect(app.window.getByTestId('composer-input')).toHaveValue('')
  expect(await app.window.evaluate(taskId => window.ziafAPI.agentSessions.attach({ taskId, chatId: 'chat-main' }), task.id)).toBeNull()

  // First preparation stays alive behind an isolated fixture barrier. These
  // are durable real sessions; opening their tabs must not send chat-main.
  await expect.poll(async () => (await prompts()).length).toBe(flow.kind === 'multi-model' ? 2 : 1)
  const firstAttempt = (await snapshot())!.steps[0].attempts[0]
  const firstChats = flow.kind === 'multi-model'
    ? firstAttempt.multiStages!.filter(stage => stage.kind === 'exploration').map(stage => stage.session!.chatId)
    : [firstAttempt.session!.chatId]
  await expect(app.window.getByTestId('central-tab-forge-discussion')).toHaveClass(/border-\[#ff6b00\]/)
  expect(await app.window.evaluate(taskId => window.ziafAPI.agentSessions.attach({ taskId, chatId: 'forge-discussion' }), task.id)).toBeNull()
  await app.window.getByTestId('code-dialogue-execution').click()
  await expect.poll(async () => (await app.window.evaluate(taskId => window.ziafAPI.getChatHistory(taskId), task.id)).activeTabId).toMatch(/^wf-/)
  const followed = (await app.window.evaluate(taskId => window.ziafAPI.getChatHistory(taskId), task.id)).activeTabId!
  expect(firstChats).toContain(followed)
  await expect(app.window.getByTestId(`central-tab-${followed}`)).toHaveClass(/border-\[#ff6b00\]/)
  await app.window.getByTestId('tab-btn-todo').click()
  await expect(app.window.getByTestId('executable-plan')).not.toBeVisible()
  await expect(app.window.getByTestId('agent-chat-plan-owned')).toBeVisible()
  await expect(app.window.getByTestId('conversation-feed')).toContainText(title)
  await expect(app.window.getByTestId('composer-send-button')).toBeDisabled()
  const stageInstructions = app.window.getByTestId('conversation-feed').locator('[data-testid^="workflow-instructions-"]')
  await expect(stageInstructions).toBeVisible()
  await expect(stageInstructions.locator('pre')).not.toBeVisible()
  await stageInstructions.locator('summary').click()
  await expect(stageInstructions.locator('pre')).toBeVisible()
  const phaseSession = await app.window.evaluate(ref => window.ziafAPI.agentSessions.attach(ref), { taskId: task.id, chatId: followed })
  expect(await stageInstructions.locator('pre').textContent()).toBe(phaseSession!.feed.find(item => item.role === 'user')!.text)
  await stageInstructions.locator('summary').click()
  await app.window.screenshot({ path: testInfo.outputPath('02-live-stage-chat-plan-closed.png'), fullPage: true })
  // A manually viewed conversation and an unsent draft win over later phase events.
  await app.window.getByTestId('central-tab-chat-main').click()
  await app.window.getByTestId('composer-input').fill('Unsent task question; do not execute.')
  await app.releaseCodex('code-flow-preparation')
  await expect.poll(async () => (await snapshot())?.codeFlow?.pending?.kind, { timeout: 40_000 }).toBe(flow.kind === 'requirements-first' ? 'questions' : 'plan')
  await expect(app.window.getByTestId('composer-input')).toBeFocused()
  await expect(app.window.getByTestId('composer-input')).toHaveValue('Unsent task question; do not execute.')
  await openPlan()

  if (flow.kind === 'requirements-first') {
    await gate('questions')
    await app.window.getByTestId('follow-workflow-chat').click()
    const waiting = (await snapshot())!
    expect(waiting.steps[0].failures).toBe(0)
    expect(await prompts()).toHaveLength(1)
    await app.window.getByTestId('code-question-identifier-scope').fill('Accept letters, digits, and underscores')
    await app.window.screenshot({ path: testInfo.outputPath('02-question-before-full-quit.png'), fullPage: true })
    await app.restart()
    await openPlan()
    expect((await snapshot())!.codeFlow!.pending).toEqual(waiting.codeFlow!.pending)
    expect((await snapshot())!.steps[0].attempts).toEqual(waiting.steps[0].attempts)
    await expect(app.window.getByTestId('central-tab-forge-discussion')).toHaveClass(/border-\[#ff6b00\]/)
    await expect(app.window.getByTestId('code-dialogue')).toBeVisible()
    await expect(app.window.getByTestId('code-question-identifier-scope')).toHaveValue('Accept letters, digits, and underscores')
    expect(await prompts(), 'Reloading a question neither answers it nor repeats the initial prompt').toHaveLength(1)
    await app.window.getByTestId('code-gate-answer').click()
    for (const phase of ['requirements', 'specification']) {
      await gate('document')
      const waitingDocument = (await snapshot())!
      expect(waitingDocument.codeFlow!.pending!.phase).toBe(phase)
      expect(waitingDocument.plan.steps.some(step => step.codePhase === 'implementation')).toBe(false)
      const receipt = waitingDocument.codeFlow!.artifacts.find(item => item.id === waitingDocument.codeFlow!.pending!.artifactIds[0])!
      await app.window.getByTestId(`code-artifact-open-${receipt.id}`).click()
      await expect(app.window.getByTestId(`code-artifact-content-${receipt.id}`)).toContainText(`Code fixture ${receipt.name}`)
      expect(createHash('sha256').update(await readFile(receipt.path)).digest('hex')).toBe(receipt.sha256)
      await app.window.getByTestId('code-gate-approve').click()
    }
  }

  await gate('plan')
  const proposal = (await snapshot())!
  expect(proposal.plan.codeFlow?.kind).toBe(flow.kind)
  expect(proposal.plan.advance).toBe(flow.kind === 'auto' ? 'manual' : 'auto')
  expect(proposal.plan.steps.every(step => step.codePhase !== 'implementation')).toBe(true)
  expect((await app.transcript()).filter(entry => entry.event === 'code-flow-implementation')).toHaveLength(0)
  expect(await readFile(path.join(workspace, 'identifier.cjs'), 'utf8')).toBe(initialSource)
  await expect(app.window.getByTestId('code-proposed-step-0')).toContainText(process.execPath)
  await expect(app.window.getByTestId('code-proposed-step-0')).toContainText('check-identifier.cjs')
  await expect(app.window.getByTestId('code-proposed-step-0')).toContainText('15000')
  await expect(app.window.getByTestId('code-proposed-step-0')).toContainText(workspace)
  const document = proposal.codeFlow!.artifacts.at(-1)!
  await app.window.getByTestId(`code-artifact-open-${document.id}`).click()
  await expect(app.window.getByTestId(`code-artifact-content-${document.id}`)).toContainText(`# Code fixture ${document.name}`.slice(2))
  await app.window.screenshot({ path: testInfo.outputPath('03-document-and-command-consent.png'), fullPage: true })
  if (flow.kind === 'auto') {
    const bytes = await readFile(document.path)
    const promptCount = (await prompts()).length
    try {
      await writeFile(document.path, Buffer.concat([bytes, Buffer.from('\nUnreviewed fixture modification.\n')]))
      await expect(app.window.evaluate(request => window.ziafAPI.workflows.respond(request), {
        taskId: task.id, revision: proposal.revision, gateId: proposal.codeFlow!.pending!.id, commandId: randomUUID(), action: 'approve' as const,
      })).rejects.toThrow(/Artifact changed/)
      const rejected = (await snapshot())!
      expect(rejected.status).not.toBe('running')
      expect(rejected.codeFlow!.pending).toEqual(proposal.codeFlow!.pending)
      expect((await app.window.evaluate(() => window.ziafAPI.getTasks())).find(item => item.id === task.id)?.status).not.toBe('running')
      expect(await prompts(), 'Rejected changed documents must not launch implementation').toHaveLength(promptCount)
    } finally { await writeFile(document.path, bytes) }
    expect(createHash('sha256').update(await readFile(document.path)).digest('hex')).toBe(document.sha256)
  }
  // Closing a historical phase is a durable user view choice. Later workflow
  // events must not put it back among the open tabs.
  if (flow.kind === 'auto') await app.window.getByTestId(`close-tab-${followed}`).click()
  // Clicking approve is the authorization for the concrete displayed checks.
  await app.window.getByTestId('code-gate-approve').click()

  if (flow.kind === 'multi-model') {
    await gate('review-decision')
    expect((await app.transcript()).filter(entry => entry.stage === 'review-worker')).toHaveLength(0)
    await app.window.getByTestId('code-gate-approve').click()
    await gate('review')
    const review = (await snapshot())!
    expect(review.codeFlow!.pending!.reviewOutcome).toBe('changes_requested')
    expect(review.codeFlow!.artifacts.some(item => item.name === 'final_review.md')).toBe(true)
    expect((await app.transcript()).filter(entry => entry.event === 'code-flow-fixer')).toHaveLength(0)
    await expect(app.window.getByTestId('code-gate-approve')).toContainText('one correction')
    const firstGateId = review.codeFlow!.pending!.id
    await app.window.getByTestId('code-gate-comments').fill('Reconsider the correction note against the unchanged passing checks.')
    await app.window.getByTestId('code-gate-review-feedback').click()
    await expect.poll(async () => {
      const next = (await snapshot())?.codeFlow?.pending
      return next?.kind === 'review' && next.id !== firstGateId
    }, { timeout: 40_000 }).toBe(true)
    await gate('review')
    expect((await app.transcript()).filter(entry => entry.stage === 'review-worker')).toHaveLength(3)
    expect((await app.transcript()).filter(entry => entry.stage === 'review-coordinator')).toHaveLength(2)
    expect((await app.transcript()).filter(entry => entry.event === 'code-flow-implementation')).toHaveLength(1)
    await app.window.screenshot({ path: testInfo.outputPath('04-review-gate-before-one-fix.png'), fullPage: true })
    await app.window.getByTestId('code-gate-comments').fill('Make the one review correction and preserve passing checks.')
    await app.window.getByTestId('code-gate-approve').click()
  } else if (flow.kind === 'auto') {
    await expect.poll(async () => {
      const current = await snapshot()
      return current?.status === 'paused' && !current.codeFlow?.pending && current.steps.some(item => item.status === 'completed' && current.plan.steps.find(step => step.id === item.id)?.codePhase === 'implementation')
    }, { timeout: 40_000 }).toBe(true)
    const checkpoint = (await snapshot())!
    expect(checkpoint.codeFlow!.pending).toBeUndefined()
    expect(checkpoint.steps.find(item => checkpoint.plan.steps.find(step => step.id === item.id)?.codePhase === 'implementation')?.status).toBe('completed')
    expect(checkpoint.steps.at(-1)?.attempts).toEqual([])
    await expect(app.window.getByTestId('workflow-reason')).toContainText('Checkpoint after:')
    await app.window.getByTestId('workflow-start').click()
  }

  await expect.poll(async () => (await snapshot())?.status, { timeout: 40_000 }).toBe('completed')
  if (flow.kind === 'multi-model') {
    const beforeRereview = (await snapshot())!
    const beforeTranscript = await app.transcript()
    expect(beforeTranscript.filter(entry => entry.stage === 'review-worker')).toHaveLength(3)
    expect(beforeTranscript.filter(entry => entry.stage === 'review-coordinator')).toHaveLength(2)
    expect(beforeTranscript.filter(entry => entry.event === 'code-flow-fixer')).toHaveLength(1)
    const implementationBefore = beforeRereview.steps.find(item => beforeRereview.plan.steps.find(step => step.id === item.id)?.codePhase === 'implementation')!
    const verificationBefore = implementationBefore.attempts.flatMap(attempt => attempt.verification)
    await expect(app.window.getByTestId('code-rereview')).toBeVisible()
    await app.window.screenshot({ path: testInfo.outputPath('05-corrected-without-automatic-review.png'), fullPage: true })
    await app.window.getByTestId('code-rereview').click()
    await gate('review')
    const suggestions = (await snapshot())!
    expect(suggestions.codeFlow!.pending!.reviewOutcome).toBe('approved')
    const rerun = suggestions.steps.find(item => suggestions.plan.steps.find(step => step.id === item.id)?.codePhase === 'implementation')!.attempts.at(-1)!
    const currentReviewer = rerun.multiStages!.find(stage => stage.kind === 'review-coordinator')!.session!.chatId
    await app.window.getByTestId(`central-tab-${currentReviewer}`).click()
    await expect(app.window.getByTestId(`central-tab-${currentReviewer}`)).toHaveClass(/border-\[#ff6b00\]/)
    await expect(app.window.getByTestId('conversation-feed')).toContainText('Verified implementation accepted with one nonblocking suggestion.')
    expect(rerun.reusedVerificationFromAttemptId).toBeTruthy()
    expect(verificationBefore).toEqual(expect.arrayContaining(rerun.verification))
    await app.window.getByTestId('open-code-dialogue').click()
    await expect(app.window.getByTestId('code-gate-approve')).toContainText('Acknowledge and continue')
    const noNewExecution = await app.transcript()
    expect(noNewExecution.filter(entry => entry.stage === 'review-worker')).toHaveLength(6)
    expect(noNewExecution.filter(entry => entry.stage === 'review-coordinator')).toHaveLength(3)
    expect(noNewExecution.filter(entry => entry.event === 'code-flow-implementation')).toHaveLength(1)
    expect(noNewExecution.filter(entry => entry.event === 'code-flow-fixer')).toHaveLength(1)
    await app.window.screenshot({ path: testInfo.outputPath('06-explicit-fresh-review-suggestions.png'), fullPage: true })
    await app.window.getByTestId('code-gate-approve').click()
    await expect.poll(async () => (await snapshot())?.status, { timeout: 40_000 }).toBe('completed')
  }
  const completed = (await snapshot())!
  expect(completed.plan.steps.map(step => step.codePhase)).toEqual(flow.phases)
  expect(completed.steps.every(step => step.status === 'completed')).toBe(true)
  expect(completed.codeFlow!.pending).toBeUndefined()
  for (const name of flow.artifacts) expect(completed.codeFlow!.artifacts.some(item => item.name === name), name).toBe(true)
  for (const receipt of completed.codeFlow!.artifacts) {
    const bytes = await readFile(receipt.path)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(receipt.sha256)
    expect(bytes.length).toBe(receipt.bytes)
    expect(path.relative(workspace, receipt.path).startsWith('..'), 'Documents are versioned outside the mutable source worktree').toBe(true)
  }
  const implementation = completed.steps.find(item => completed.plan.steps.find(step => step.id === item.id)?.codePhase === 'implementation')!
  const checks = implementation.attempts.flatMap(attempt => attempt.verification)
  expect(checks.some(check => check.phase === 'green' && check.exitCode === 0 && check.cleanupVerified && check.stdout?.includes('CODE_FLOW_REAL_CHECK_OK'))).toBe(true)
  if (flow.kind === 'fix-bug') expect(checks.some(check => check.phase === 'red' && check.exitCode !== 0 && check.cleanupVerified)).toBe(true)
  const transcript = await app.transcript()
  const preparations = transcript.filter(entry => entry.event === 'code-flow-preparation')
  expect(new Set(preparations.map(entry => entry.threadId)).size, 'Each preparation attempt has its own native context').toBe(preparations.length)
  expect(preparations.filter(entry => entry.text !== 'delivery').every(entry => (entry as unknown as { sourceSha256: string }).sourceSha256 === initialSha)).toBe(true)
  expect(transcript.filter(entry => entry.event === 'code-flow-fixer')).toHaveLength(flow.kind === 'multi-model' ? 1 : 0)
  const chats = await app.window.evaluate(taskId => window.ziafAPI.getChatHistory(taskId), task.id)
  await app.window.getByTestId('central-tab-chat-main').click()
  await expect(app.window.getByTestId('composer-input')).toHaveValue('Unsent task question; do not execute.')
  await app.window.getByTestId('follow-workflow-chat').click()
  expect(await app.window.evaluate(taskId => window.ziafAPI.agentSessions.attach({ taskId, chatId: 'chat-main' }), task.id)).toBeNull()
  if (flow.kind === 'auto') {
    expect(chats.centralTabs.some(tab => tab.id === followed)).toBe(false)
    expect(chats.recentTabs?.some(tab => tab.id === followed)).toBe(true)
  }
  if (flow.kind === 'multi-model') {
    const stages = transcript.filter(entry => entry.event === 'code-flow-multi-stage')
    expect(stages.filter(entry => entry.stage === 'exploration')).toHaveLength(2)
    expect(stages.filter(entry => entry.stage === 'design')).toHaveLength(3)
    expect(stages.filter(entry => entry.stage === 'synthesis')).toHaveLength(1)
    expect(new Set(stages.map(entry => entry.threadId)).size).toBe(stages.length)
    const planning = stages.filter(entry => ['exploration', 'design', 'synthesis'].includes(entry.stage!))
    expect(planning.every(entry => entry.sourceSha256 === initialSha)).toBe(true)
    for (const [cycle, count] of [[1, 4], [2, 1], [3, 4]]) {
      const reviews = stages.filter(entry => entry.cycle === cycle && ['review-worker', 'review-coordinator'].includes(entry.stage!))
      expect(reviews).toHaveLength(count)
      expect(new Set(reviews.map(entry => entry.sharedDiffSha256)).size).toBe(1)
    }
    expect(stages.find(entry => entry.cycle === 2)?.sharedDiffSha256).toBe(stages.find(entry => entry.cycle === 1)?.sharedDiffSha256)
    expect(stages.find(entry => entry.cycle === 3)?.sharedDiffSha256).not.toBe(stages.find(entry => entry.cycle === 1)?.sharedDiffSha256)
    const invocations = [...planning, ...stages.filter(entry => ['review-worker', 'review-coordinator'].includes(entry.stage!)), ...transcript.filter(entry => entry.event === 'code-flow-fixer')]
    for (const invocation of invocations) {
      const start = transcript.find(entry => entry.pid === invocation.pid && entry.event === 'rpc-in' && entry.rpc?.method === 'thread/start')!
      const turn = transcript.find(entry => entry.pid === invocation.pid && entry.event === 'rpc-in' && entry.rpc?.method === 'turn/start')!
      const isPlanning = ['exploration', 'design', 'synthesis'].includes(invocation.stage!)
      const isFix = invocation.event === 'code-flow-fixer'
      expect(start.rpc?.params?.model).toBe(isPlanning ? 'codex-fixture-next' : 'gpt-fixture')
      expect(turn.rpc?.params?.effort).toBe(isPlanning ? 'xhigh' : isFix ? 'high' : 'medium')
      expect(start.rpc?.params?.sandbox).toBe(isFix ? 'workspace-write' : 'read-only')
    }
    const stageSessions = completed.steps.flatMap(step => step.attempts.flatMap(attempt => attempt.multiStages ?? [])).flatMap(stage => stage.session ? [stage.session.chatId] : [])
    expect(stageSessions.length).toBeGreaterThanOrEqual(stages.length)
    for (const chatId of new Set(stageSessions)) expect(chats.centralTabs.some(tab => tab.id === chatId) || chats.recentTabs?.some(tab => tab.id === chatId), chatId).toBe(true)
  }
  expect(transcript.filter(entry => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  expect(await git(workspace, ['rev-parse', 'HEAD']), 'No implicit platform commit').toBe(initialHead)
  expect(await readFile(path.join(repository, 'identifier.cjs'), 'utf8'), 'Source checkout remains unchanged').toBe(initialSource)
  await expect(app.window.getByTestId('tab-btn-todo')).toContainText(`${completed.steps.length}/${completed.steps.length}`)
  const deliveryChat = completed.steps.find(item => completed.plan.steps.find(step => step.id === item.id)?.codePhase === 'delivery')!.attempts.at(-1)!.session!.chatId
  await app.window.getByTestId(`central-tab-${deliveryChat}`).click()
  const phaseResult = app.window.getByTestId('conversation-feed').locator('[data-testid^="workflow-result-"]')
  await expect(phaseResult).toContainText('Prepared delivery from real fixture repository evidence.')
  await expect(phaseResult.locator('details[data-testid^="workflow-raw-"] pre')).not.toBeVisible()
  await phaseResult.locator('details[data-testid^="workflow-document-"] summary').first().click()
  await expect(phaseResult.getByRole('heading').first()).toContainText('Code fixture')
  const finalDocument = completed.codeFlow!.artifacts.at(-1)!
  await app.window.getByTestId('open-code-dialogue').click()
  await app.window.getByTestId(`code-artifact-open-${finalDocument.id}`).click()
  await expect(app.window.getByTestId(`code-artifact-content-${finalDocument.id}`)).toBeVisible()
  await app.window.screenshot({ path: testInfo.outputPath('05-completed-flow-and-real-artifacts.png'), fullPage: true })
  await writeFile(testInfo.outputPath('completed-code-workflow.json'), JSON.stringify(completed, null, 2))
  await testInfo.attach('completed-code-workflow', { path: testInfo.outputPath('completed-code-workflow.json'), contentType: 'application/json' })
})

test('Forge Full SDD: iterative decisions, revised documents, restart and human-edited executable plan', async ({ app }, testInfo) => {
  test.setTimeout(240_000)
  const title = 'Forge Full SDD fixture'
  const audience = 'Audience: local developers'
  const contract = 'Contract: ASCII letters, digits, and underscores; reject a leading digit'
  const amendment = 'Manual copy fallback must work without clipboard permission.'
  const stack = 'Choose HTML and vanilla JavaScript; support Safari and Chrome; use a manual copy fallback.'
  const repository = testInfo.outputPath('profile', 'project', 'repo')
  const initialSource = "'use strict'\nmodule.exports = () => true\n"
  const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')
  const checks = {
    'check-identifier.cjs': "const assert = require('node:assert/strict')\nconst fs = require('node:fs')\nconst valid = require('./identifier.cjs')\nassert.equal(valid('valid_id'), true)\nassert.equal(valid('not valid'), false)\nassert.equal(valid('2invalid'), false)\nassert.equal(valid(null), false)\nconst html = fs.readFileSync('index.html', 'utf8')\nassert.ok(html.includes('id=\"manual-copy\"'))\nassert.ok(html.includes('readonly'))\nassert.ok(html.includes('<script>'))\nconsole.log('FORGE_BROWSER_CHECK_OK')\n",
    'check-handoff.cjs': `const assert = require('node:assert/strict')\nconst fs = require('node:fs')\nassert.ok(fs.readFileSync('handoff.md', 'utf8').includes(${JSON.stringify(amendment)}))\nconsole.log('FORGE_HANDOFF_CHECK_OK')\n`,
  }
  await writeFile(path.join(repository, 'identifier.cjs'), initialSource)
  for (const [name, content] of Object.entries(checks)) await writeFile(path.join(repository, name), content)
  const git = async (cwd: string, args: string[]) => (await promisify(execFile)('/usr/bin/git', args, { cwd, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } })).stdout.trim()
  await git(repository, ['add', '--', 'identifier.cjs', ...Object.keys(checks)])
  await git(repository, ['-c', 'user.name=ZIAForge E2E', '-c', 'user.email=e2e@ziaforge.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Forge immutable scenario checks'])
  const initialHead = await git(repository, ['rev-parse', 'HEAD'])

  await app.window.getByRole('button', { name: 'New task', exact: true }).first().click()
  const form = app.window.locator('form')
  await form.getByRole('button', { name: 'E2E Project', exact: true }).click()
  await form.getByRole('button', { name: 'E2E Project', exact: true }).last().click()
  await form.getByTestId('new-task-agent-preset').selectOption('E2E Codex')
  await form.getByTestId('new-task-agent-permissions').selectOption('Workspace write')
  await form.getByPlaceholder('new-task-xxxx').fill('forge-iterative-sdd')
  await app.window.getByTestId('new-workflow-requirements-first').click()
  await form.getByTestId('new-code-options').locator(':scope > summary').click()
  await form.getByTestId('new-code-auto').check()
  await form.getByTestId('new-code-review').check()
  await form.getByTestId('new-code-reviewer').selectOption('E2E Codex')
  await form.locator('textarea').first().fill(`${title}\nBuild an offline identifier utility. Discuss product choices and the interface/stack before implementation; preserve the existing immutable checks.`)
  await form.getByTestId('new-task-start').click()
  await expect(app.window.getByTestId('code-dialogue')).toBeVisible()
  await expect.poll(async () => (await app.window.evaluate(() => window.ziafAPI.getTasks())).filter(item => item.name === title).length).toBe(1)
  const task = (await app.window.evaluate(() => window.ziafAPI.getTasks())).find(item => item.name === title)!
  const snapshot = async () => (await app.window.evaluate(taskId => window.ziafAPI.workflows.get({ taskId }), task.id))!
  const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt')
  const events = async () => (await app.transcript()).filter(entry => entry.event === 'forge-fixture')
  const gate = async (kind: CodeFlowGate['kind'], phase?: string) => {
    await expect.poll(async () => {
      const current = (await snapshot()).codeFlow?.pending
      return current?.kind === kind && (!phase || current.phase === phase)
    }, { timeout: 40_000 }).toBe(true)
    await app.window.getByTestId('open-code-dialogue').click()
    await expect(app.window.getByTestId('code-flow-gate')).toBeVisible()
    return snapshot()
  }
  const latest = async (name: string) => (await snapshot()).codeFlow!.artifacts.filter(item => item.name === name).at(-1)!
  const openArtifact = async (receipt: CodeArtifactReceipt) => {
    const toggle = app.window.getByTestId(`code-artifact-open-${receipt.id}`)
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
    await expect(app.window.getByTestId(`code-artifact-content-${receipt.id}`)).toBeVisible()
  }
  const say = async (text: string) => {
    await app.window.getByTestId('composer-input').fill(text)
    await expect(app.window.getByTestId('composer-send-button')).toBeEnabled()
    await app.window.getByTestId('composer-send-button').click()
  }
  await app.releaseCodex('code-flow-preparation')
  await gate('questions', 'requirements')
  expect((await snapshot()).plan.codeFlow?.interaction).toEqual({ version: 1 })
  expect(await app.window.evaluate(taskId => window.ziafAPI.agentSessions.attach({ taskId, chatId: 'chat-main' }), task.id)).toBeNull()
  expect(await app.window.evaluate(taskId => window.ziafAPI.agentSessions.attach({ taskId, chatId: 'forge-discussion' }), task.id)).toBeNull()
  await app.window.getByTestId('code-question-forge-audience').fill(audience)
  await app.window.getByTestId('code-gate-answer').click()
  await expect.poll(async () => (await snapshot()).codeFlow!.pending?.questions?.[0]?.id).toBe('forge-contract')
  const beforeRestart = await gate('questions', 'requirements')
  await app.window.getByTestId('code-question-forge-contract').fill(contract)
  await app.window.getByTestId('composer-input').fill('Keep this unsent Forge question across restart.')
  const requestsBeforeRestart = (await prompts()).length
  expect(requestsBeforeRestart).toBe(2)
  await app.window.screenshot({ path: testInfo.outputPath('forge-01-second-question-with-draft.png'), fullPage: true })
  await app.restart()
  await app.window.getByRole('button', { name: title, exact: true }).click()
  await app.window.getByTestId('open-code-dialogue').click()
  await expect(app.window.getByTestId('code-question-forge-contract')).toHaveValue(contract)
  await expect(app.window.getByTestId('composer-input')).toHaveValue('Keep this unsent Forge question across restart.')
  expect((await snapshot()).codeFlow!.pending).toEqual(beforeRestart.codeFlow!.pending)
  expect((await snapshot()).steps).toEqual(beforeRestart.steps)
  expect(await prompts(), 'Opening a saved question must not replay the native phase').toHaveLength(requestsBeforeRestart)
  await app.window.getByTestId('code-gate-answer').click()

  const originalDocumentGate = await gate('document', 'requirements')
  const originalPrd = await latest('requirements.md')
  await openArtifact(originalPrd)
  await expect(app.window.getByTestId(`code-artifact-content-${originalPrd.id}`)).toContainText(audience)
  await expect(app.window.getByTestId(`code-artifact-content-${originalPrd.id}`)).toContainText(contract)
  expect(originalDocumentGate.plan.steps.map(step => step.codePhase)).toEqual(['requirements'])
  expect((await events()).filter(entry => entry.stage?.startsWith('implementation-'))).toHaveLength(0)
  const originalBytes = await readFile(originalPrd.path)
  expect(sha(originalBytes)).toBe(originalPrd.sha256)
  await app.window.getByTestId('code-gate-approve').click()

  const beforeCounterquestion = await gate('questions', 'specification')
  expect(beforeCounterquestion.codeFlow!.acceptedDocuments).toHaveLength(1)
  await say('Explain HTML versus CLI before I choose. This is a counterquestion, not a decision.')
  await expect.poll(async () => (await events()).filter(entry => entry.stage === 'specification-counterquestion').length).toBe(1)
  const afterCounterquestion = await gate('questions', 'specification')
  expect(afterCounterquestion.plan.steps.map(step => [step.id, step.codePhase])).toEqual(beforeCounterquestion.plan.steps.map(step => [step.id, step.codePhase]))
  expect(afterCounterquestion.steps.map(step => [step.id, step.status])).toEqual(beforeCounterquestion.steps.map(step => [step.id, step.status]))
  expect(afterCounterquestion.codeFlow!.artifacts.some(item => item.name === 'spec.md')).toBe(false)
  await expect(app.window.getByTestId('code-dialogue-feed')).toContainText('No stack has been chosen by this counterquestion')
  await app.window.screenshot({ path: testInfo.outputPath('forge-02-counterquestion-no-spec.png'), fullPage: true })

  // Amend a previously accepted PRD through the actual document editor. The
  // original accepted bytes remain immutable; its acceptance becomes history.
  await openArtifact(originalPrd)
  await app.window.getByTestId(`code-artifact-edit-${originalPrd.id}`).click()
  await app.window.getByTestId(`code-artifact-editor-${originalPrd.id}`).fill(`${originalBytes.toString('utf8')}\n${amendment}\n`)
  await app.window.getByTestId(`code-artifact-save-${originalPrd.id}`).click()
  const amendedGate = await gate('document', 'requirements')
  const amendedPrd = await latest('requirements.md')
  expect(amendedPrd.version).toBeGreaterThan(originalPrd.version)
  expect(amendedPrd.sha256).not.toBe(originalPrd.sha256)
  expect(await readFile(originalPrd.path)).toEqual(originalBytes)
  expect(amendedGate.codeFlow!.acceptedDocuments![0].invalidatedAt).toBeTruthy()
  expect(amendedGate.codeFlow!.retiredSteps?.some(item => item.step.codePhase === 'specification' && item.state.attempts.length > 0)).toBe(true)
  expect(amendedGate.steps.find(item => item.id === originalPrd.stepId)?.status, 'Completed requirement evidence is retained').toBe('completed')
  const beforeStale = (await prompts()).length
  await expect(app.window.evaluate(request => window.ziafAPI.workflows.respond(request), {
    taskId: task.id, revision: originalDocumentGate.revision, gateId: originalDocumentGate.codeFlow!.pending!.id, commandId: randomUUID(), action: 'approve' as const,
  })).rejects.toThrow(/checkpoint changed|decision changed|revision/i)
  await expect(app.window.evaluate(request => window.ziafAPI.workflows.discuss(request), {
    taskId: task.id, revision: amendedGate.revision, commandId: randomUUID(), text: 'Do not accept a stale artifact edit.', artifactEdits: [{ artifactId: amendedPrd.id, expectedSha256: originalPrd.sha256, content: 'stale editor contents' }],
  })).rejects.toThrow(/changed|version|hash|sha/i)
  expect((await snapshot()).codeFlow!.pending).toEqual(amendedGate.codeFlow!.pending)
  expect(await prompts(), 'Stale approval/edit cannot launch another model or implementation').toHaveLength(beforeStale)
  await openArtifact(amendedPrd)
  await expect(app.window.getByTestId(`code-artifact-content-${amendedPrd.id}`)).toContainText(amendment)
  await app.window.getByTestId('code-gate-approve').click()

  await gate('questions', 'specification')
  await say(stack)
  const specificationGate = await gate('document', 'specification')
  const specification = await latest('spec.md')
  await openArtifact(specification)
  await expect(app.window.getByTestId(`code-artifact-content-${specification.id}`)).toContainText(stack)
  await expect(app.window.getByTestId(`code-artifact-content-${specification.id}`)).toContainText(amendment)
  expect(specificationGate.plan.steps.some(step => step.codePhase === 'implementation')).toBe(false)
  await app.window.getByTestId('code-gate-approve').click()

  const proposal = await gate('plan', 'planning')
  expect(await readFile(path.join(task.worktreePath!, 'identifier.cjs'), 'utf8')).toBe(initialSource)
  expect((await events()).filter(entry => entry.stage?.startsWith('implementation-'))).toHaveLength(0)
  await app.window.getByTestId('code-proposal-title-0').fill('Implement browser identifier with manual fallback')
  await app.window.getByTestId('code-proposal-instructions-0').fill('FORGE_BROWSER_STEP: Implement identifier.cjs and index.html from the accepted PRD/spec, preserving the manual copy fallback and immutable checks.')
  await app.window.getByTestId('code-proposal-add').click()
  await expect(app.window.getByTestId('code-gate-approve')).toBeDisabled()
  await app.window.getByTestId('code-proposal-title-1').fill('Document manual fallback')
  await app.window.getByTestId('code-proposal-instructions-1').fill('FORGE_HANDOFF_STEP: Create handoff.md describing manual copy when clipboard permission is unavailable. Preserve the accepted behavior and checks.')
  await app.window.getByTestId('code-proposal-acceptance-1').fill(amendment)
  await app.window.getByTestId('code-proposed-step-1').getByRole('button', { name: 'Add check', exact: true }).click()
  const executable = proposal.codeFlow!.pending!.proposedSteps![0].verification[0].executable
  const quotedExecutable = `'${executable.replace(/'/g, `'"'"'`)}'`
  await app.window.getByTestId('code-proposal-check-1-0').fill(`${quotedExecutable} check-handoff.cjs`)
  // Exercise removal without executing an empty/obsolete temporary step.
  await app.window.getByTestId('code-proposal-add').click()
  await app.window.getByTestId('code-proposed-step-2').getByRole('button', { name: 'Remove', exact: true }).click()
  await app.window.getByRole('button', { name: 'Move step 2 up', exact: true }).click()
  await expect(app.window.getByTestId('code-proposal-title-0')).toHaveValue('Document manual fallback')
  await expect(app.window.getByTestId('code-proposal-title-1')).toHaveValue('Implement browser identifier with manual fallback')
  await expect(app.window.getByTestId('code-proposed-step-0')).toContainText('check-handoff.cjs')
  await expect(app.window.getByTestId('code-proposed-step-1')).toContainText('check-identifier.cjs')
  await app.window.screenshot({ path: testInfo.outputPath('forge-03-human-ordered-plan-before-approval.png'), fullPage: true })
  await app.window.getByTestId('code-gate-approve').click()
  await expect.poll(async () => (await snapshot()).status, { timeout: 60_000 }).toBe('completed')

  const completed = await snapshot()
  expect(completed.plan.review).toBe(true)
  expect(completed.plan.steps.map(step => step.codePhase)).toEqual(['requirements', 'requirements', 'specification', 'planning', 'implementation', 'implementation', 'delivery'])
  const implementations = completed.plan.steps.filter(step => step.codePhase === 'implementation')
  expect(implementations.map(step => step.title)).toEqual(['Document manual fallback', 'Implement browser identifier with manual fallback'])
  expect(implementations[1].dependsOn).toEqual([implementations[0].id])
  expect(completed.codeFlow!.acceptedPlans!.at(-1)!.stepIds).toEqual(implementations.map(step => step.id))
  expect(completed.codeFlow!.acceptedDocuments!.filter(item => !item.invalidatedAt).map(item => item.artifacts[0].sha256)).toEqual([amendedPrd.sha256, specification.sha256])
  expect(completed.steps.every(step => step.status === 'completed')).toBe(true)
  const nativeEvents = await events()
  expect(nativeEvents.filter(entry => entry.stage?.startsWith('implementation-')).map(entry => entry.stage)).toEqual(['implementation-handoff', 'implementation-browser'])
  expect(nativeEvents.filter(entry => entry.stage?.startsWith('review-')).map(entry => entry.stage)).toEqual(['review-handoff', 'review-browser'])
  for (const [index, expected] of ['FORGE_HANDOFF_CHECK_OK', 'FORGE_BROWSER_CHECK_OK'].entries()) {
    const attempts = completed.steps.find(item => item.id === implementations[index].id)!.attempts
    expect(attempts.some(attempt => attempt.verification.some(receipt => receipt.phase === 'green' && receipt.status === 'passed' && receipt.cleanupVerified && receipt.stdout?.includes(expected)))).toBe(true)
    expect(attempts.some(attempt => attempt.review?.outcome === 'approved')).toBe(true)
  }
  for (const receipt of completed.codeFlow!.artifacts) expect(sha(await readFile(receipt.path))).toBe(receipt.sha256)
  for (const [name, content] of Object.entries(checks)) expect(sha(await readFile(path.join(task.worktreePath!, name)))).toBe(sha(content))
  expect(await readFile(path.join(repository, 'identifier.cjs'), 'utf8')).toBe(initialSource)
  expect(await git(task.worktreePath!, ['rev-parse', 'HEAD'])).toBe(initialHead)
  const transcript = await app.transcript()
  expect(transcript.filter(entry => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(entry.event ?? ''))).toEqual([])
  const phasePids = nativeEvents.map(entry => entry.pid)
  expect(new Set(phasePids).size, 'Each actual phase/review receives its own native context').toBe(phasePids.length)
  for (const pid of phasePids) {
    const start = transcript.find(entry => entry.pid === pid && entry.event === 'rpc-in' && entry.rpc?.method === 'thread/start')!
    expect(start.rpc?.params?.cwd).toBe(task.worktreePath)
    expect(start.rpc?.params?.model).toBe('gpt-fixture')
  }
  await app.window.screenshot({ path: testInfo.outputPath('forge-04-completed-dialogue.png'), fullPage: true })
  const promptCount = (await prompts()).length
  await app.restart()
  await app.window.getByRole('button', { name: title, exact: true }).click()
  await app.window.getByTestId('open-code-dialogue').click()
  const reopened = await snapshot()
  expect(reopened.status).toBe('completed')
  expect(reopened.codeFlow).toEqual(completed.codeFlow)
  expect(reopened.steps).toEqual(completed.steps)
  expect(await prompts(), 'Reopening a completed workflow does not replay its discussion or implementation').toHaveLength(promptCount)
  await expect(app.window.getByTestId('code-dialogue-feed')).toContainText('Explain HTML versus CLI before I choose')
  const deliveryChat = reopened.steps.at(-1)!.attempts.at(-1)!.session!.chatId
  await app.window.getByTestId(`central-tab-${deliveryChat}`).click()
  await expect(app.window.getByTestId('agent-chat-plan-owned')).toBeVisible()
  await app.window.getByTestId('open-code-dialogue').click()
  await expect(app.window.getByTestId('code-dialogue')).toBeVisible()
  expect(await app.window.evaluate(taskId => window.ziafAPI.agentSessions.attach({ taskId, chatId: 'chat-main' }), task.id)).toBeNull()
  await app.window.screenshot({ path: testInfo.outputPath('forge-05-reopened-completed-checkpoint.png'), fullPage: true })
  await writeFile(testInfo.outputPath('completed-forge-dialogue.json'), JSON.stringify({ beforeCounterquestion, afterCounterquestion, amendedGate, completed, reopened }, null, 2))
  await testInfo.attach('completed-forge-dialogue', { path: testInfo.outputPath('completed-forge-dialogue.json'), contentType: 'application/json' })
})
