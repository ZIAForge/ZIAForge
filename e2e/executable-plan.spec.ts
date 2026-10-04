import { readFile, writeFile } from 'node:fs/promises'
import { test, expect } from './fixtures'

test.use({ providerFixture: 'codex' })

test('three-step executable plan checks exit codes, requests review fixes, checkpoints and survives a full restart', async ({ app }, testInfo) => {
  test.setTimeout(180_000)
  const open = async () => {
    await app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    if (!await app.window.getByTestId('executable-plan').isVisible()) await app.window.getByTestId('tab-btn-todo').click()
    await expect(app.window.getByTestId('executable-plan')).toBeVisible()
  }
  const snapshot = () => app.window.evaluate(() => globalThis.window.ziafAPI.workflows.get({ taskId: 'task-e2e' }))
  const run = () => app.window.getByTestId('workflow-start').click()
  const waitAttempt = async (number: number) => {
    await expect.poll(async () => (await snapshot())?.steps[0].attempts.length).toBe(number)
    await expect.poll(async () => (await snapshot())?.status, { timeout: 30_000 }).toBe('paused')
  }
  await open()
  await app.window.getByTestId('workflow-coder').selectOption('E2E Codex')
  await app.window.getByTestId('workflow-reviewer').selectOption('E2E Codex')
  await expect(app.window.getByTestId('workflow-auto')).not.toBeChecked()
  for (let index = 0; index < 3; index++) {
    await app.window.getByTestId('workflow-add-title').fill(`Fixture step ${index + 1}`)
    await app.window.getByTestId('workflow-add-step').click()
    const step = app.window.getByTestId(`workflow-step-${index}`)
    await step.getByLabel('Instructions', { exact: true }).fill(`Produce fixture-step-${index + 1}.txt in the task workspace. Keep other steps unchanged.`)
    await step.getByLabel('Acceptance criteria (one per line)', { exact: true }).fill('The file contains ready and independent review approves.')
    await app.window.getByTestId(`workflow-check-${index}`).fill(`/usr/bin/grep -qx ready fixture-step-${index + 1}.txt`)
  }
  await app.window.getByTestId('workflow-save').click()
  await expect.poll(async () => (await snapshot())?.plan.steps.length).toBe(3)
  await expect(app.window.getByTestId('tab-btn-todo')).toContainText('0/3')
  await app.window.screenshot({ path: testInfo.outputPath('01-executable-plan-saved.png'), fullPage: true })

  await run()
  await waitAttempt(1)
  const failedCheck = (await snapshot())!
  expect(failedCheck.steps[0].failures).toBe(1)
  expect(failedCheck.steps[0].attempts[0]).toMatchObject({ status: 'failed', verification: [{ status: 'failed', exitCode: 1, cleanupVerified: true }] })
  expect(failedCheck.steps[0].attempts[0].output).toContain('all tests passed according to the agent')
  expect(failedCheck.steps[0].attempts[0].review).toBeUndefined()
  expect(failedCheck.steps.slice(1).every(step => step.attempts.length === 0)).toBe(true)
  await app.window.screenshot({ path: testInfo.outputPath('02-real-check-overrides-agent-success.png'), fullPage: true })

  await run()
  await waitAttempt(2)
  const failedReview = (await snapshot())!
  expect(failedReview.steps[0].failures).toBe(2)
  expect(failedReview.steps[0].attempts[1]).toMatchObject({ status: 'failed', review: { outcome: 'changes_requested' }, verification: [{ status: 'passed', exitCode: 0 }] })
  expect(failedReview.steps[0].status).not.toBe('completed')
  await app.window.screenshot({ path: testInfo.outputPath('03-independent-review-requires-fix.png'), fullPage: true })

  await run()
  await waitAttempt(3)
  const firstCompleted = (await snapshot())!
  expect(firstCompleted.steps[0]).toMatchObject({ status: 'completed', failures: 2 })
  expect(firstCompleted.steps[0].attempts[2]).toMatchObject({ status: 'completed', review: { outcome: 'approved' } })
  expect(firstCompleted.steps[1].attempts).toHaveLength(0)
  await expect(app.window.getByTestId('workflow-reason')).toContainText('Checkpoint after: Fixture step 1')
  const firstStepEvidence = structuredClone(firstCompleted.steps[0])

  // A user can select Auto for remaining work while keeping an explicit stop.
  await app.window.getByTestId('workflow-auto').check()
  const secondStep = app.window.getByTestId('workflow-step-1')
  if (!await app.window.getByTestId('workflow-check-1').isVisible()) await secondStep.getByRole('button').first().click()
  await secondStep.locator('summary').filter({ hasText: 'Step options' }).click()
  await secondStep.getByLabel('Stop after this step', { exact: true }).check()
  await run()
  await expect.poll(async () => (await snapshot())?.steps[1].status, { timeout: 30_000 }).toBe('completed')
  await expect.poll(async () => (await snapshot())?.status).toBe('paused')
  await expect(app.window.getByTestId('workflow-reason')).toContainText('Checkpoint after: Fixture step 2')
  expect((await snapshot())!.steps[2].attempts).toHaveLength(0)
  const beforeRestart = (await snapshot())!
  await app.window.screenshot({ path: testInfo.outputPath('04-auto-explicit-stop.png'), fullPage: true })
  const promptsBefore = (await app.transcript()).filter(entry => entry.event === 'prompt').length
  await app.restart()
  await open()
  const replay = (await snapshot())!
  expect(replay.runId).toBe(beforeRestart.runId)
  expect(replay.revision).toBe(beforeRestart.revision)
  expect(replay.steps[0]).toEqual(firstStepEvidence)
  expect(replay.steps[1]).toEqual(beforeRestart.steps[1])
  expect((await app.transcript()).filter(entry => entry.event === 'prompt')).toHaveLength(promptsBefore)
  await expect(app.window.getByTestId('tab-btn-todo')).toContainText('2/3')
  await app.window.screenshot({ path: testInfo.outputPath('05-plan-restored-after-full-restart.png'), fullPage: true })
  await run()
  await expect.poll(async () => (await snapshot())?.status, { timeout: 30_000 }).toBe('completed')
  const completed = (await snapshot())!
  expect(completed.steps.map(step => step.status)).toEqual(['completed', 'completed', 'completed'])
  expect(completed.steps.map(step => step.attempts.length)).toEqual([3, 1, 1])
  expect(completed.iterations).toBe(5)
  await expect(app.window.getByTestId('tab-btn-todo')).toContainText('3/3')
  expect(completed.steps[0]).toEqual(firstStepEvidence)
  const transcript = await app.transcript()
  const implementations = transcript.filter(entry => entry.event === 'workflow-implementation')
  const reviews = transcript.filter(entry => entry.event === 'workflow-review')
  expect(implementations).toHaveLength(5)
  expect(reviews).toHaveLength(4)
  const coderPids = new Set(implementations.map(entry => entry.pid))
  expect(reviews.every(entry => !coderPids.has(entry.pid)), 'Each reviewer is an independent native session').toBe(true)
  expect(transcript.filter(entry => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  for (const step of completed.steps) for (const attempt of step.attempts) for (const verification of attempt.verification) {
    const filename = verification.stdoutPath.replace(/stdout\.log$/, 'receipt.json')
    const receipt = JSON.parse(await readFile(filename, 'utf8'))
    expect(receipt).toMatchObject({ exitCode: verification.exitCode, cleanupVerified: true, inputFingerprint: verification.inputFingerprint, status: verification.status })
    expect(receipt.fingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(receipt.cwd).toContain('worktrees/task-e2e')
    expect(receipt.command.executable).toBe('/bin/sh')
  }
  await app.window.screenshot({ path: testInfo.outputPath('06-all-steps-verified.png'), fullPage: true })
  const completedPath = testInfo.outputPath('completed-workflow.json')
  await writeFile(completedPath, JSON.stringify(completed, null, 2))
  await testInfo.attach('completed-workflow.json', { path: completedPath, contentType: 'application/json' })
})
