import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from './fixtures'

test.use({ providerFixture: 'codex' })

interface CliReceipt {
  args: string[]
  exitCode: number | null
  signal: string | null
  stdout: string
  stderr: string
  records: unknown[]
}

test('real CLI runs the saved UI plan and resumes past a durable explicit checkpoint', async ({ app }, testInfo) => {
  test.setTimeout(150_000)
  const receipts: CliReceipt[] = []
  const cli = async (...command: string[]): Promise<CliReceipt> => {
    const args = [path.resolve('scripts/ziaf.cjs'), ...command, '--profile', testInfo.outputPath('profile/user-data'), '--json']
    const result = await new Promise<CliReceipt>((resolve, reject) => {
      execFile(process.execPath, args, { timeout: 60_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        const receipt: CliReceipt = {
          args,
          exitCode: error ? typeof error.code === 'number' ? error.code : null : 0,
          signal: error?.signal ?? null,
          stdout,
          stderr,
          records: [],
        }
        receipts.push(receipt)
        if (error && (error.killed || typeof error.code !== 'number')) return reject(error)
        try {
          receipt.records = stdout.trim() ? stdout.trim().split('\n').map(line => JSON.parse(line) as unknown) : []
          resolve(receipt)
        } catch (parseError) { reject(parseError) }
      })
    })
    return result
  }
  const snapshot = () => app.window.evaluate(() => globalThis.window.ziafAPI.workflows.get({ taskId: 'task-e2e' }))
  const openPlan = async () => {
    await app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    if (!await app.window.getByTestId('executable-plan').isVisible()) await app.window.getByTestId('tab-btn-todo').click()
    await expect(app.window.getByTestId('executable-plan')).toBeVisible()
  }
  try {
    await openPlan()
    await app.window.getByTestId('workflow-coder').selectOption('E2E Codex')
    await app.window.getByTestId('workflow-reviewer').selectOption('E2E Codex')
    await app.window.getByTestId('workflow-auto').check()
    for (let index = 0; index < 2; index++) {
      const fixtureStep = index + 2
      await app.window.getByTestId('workflow-add-title').fill(`Fixture step ${fixtureStep}`)
      await app.window.getByTestId('workflow-add-step').click()
      const step = app.window.getByTestId(`workflow-step-${index}`)
      await step.getByLabel('Instructions', { exact: true }).fill(`Produce fixture-step-${fixtureStep}.txt in the task workspace. Keep other steps unchanged.`)
      await step.getByLabel('Acceptance criteria (one per line)', { exact: true }).fill('The file contains ready and independent review approves.')
      await app.window.getByTestId(`workflow-check-${index}`).fill(`/usr/bin/grep -qx ready fixture-step-${fixtureStep}.txt`)
      if (index === 0) {
        await step.locator('summary').filter({ hasText: 'Step options' }).click()
        await step.getByLabel('Stop after this step', { exact: true }).check()
      }
    }
    await app.window.getByTestId('workflow-save').click()
    await expect.poll(async () => (await snapshot())?.plan.steps.length).toBe(2)
    const saved = (await snapshot())!
    expect(saved.plan.advance).toBe('auto')
    expect(saved.plan.steps[0].stopAfter).toBe(true)
    const listing = await cli('list')
    expect(listing.exitCode).toBe(0)
    expect(listing.records[0]).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'task-e2e', name: 'E2E Workspace' })]))
    const initialStatus = await cli('status', '--task', 'task-e2e')
    expect(initialStatus.exitCode).toBe(0)
    expect(initialStatus.records).toEqual([expect.objectContaining({ taskId: 'task-e2e', revision: saved.revision, status: saved.status, completed: 0, total: 2 })])
    const invalid = await cli('start', '--task', 'task-not-registered')
    expect(invalid.exitCode).toBe(1)
    expect(invalid.stdout).toBe('')
    expect(invalid.stderr).toMatch(/task.*(not found|missing|unavailable|registered)|unknown task/i)
    expect((await app.transcript()).filter(entry => entry.event === 'workflow-implementation')).toHaveLength(0)

    const started = await cli('start', '--task', 'task-e2e')
    expect(started.exitCode).toBe(0)
    expect(started.records).toHaveLength(1)
    await expect.poll(async () => (await snapshot())?.status, { timeout: 30_000 }).toBe('paused')
    const checkpoint = (await snapshot())!
    expect(checkpoint.steps.map(step => step.attempts.length)).toEqual([1, 0])
    expect(checkpoint.steps[0]).toMatchObject({ status: 'completed', attempts: [{ status: 'completed', review: { outcome: 'approved' }, verification: [{ status: 'passed', exitCode: 0, cleanupVerified: true }] }] })
    expect(checkpoint.reason).toContain('Checkpoint after: Fixture step 2')
    await expect(app.window.getByTestId('workflow-reason')).toContainText(checkpoint.reason!)
    await expect(app.window.getByTestId('tab-btn-todo')).toContainText('1/2')
    await app.window.screenshot({ path: testInfo.outputPath('01-cli-start-explicit-checkpoint.png'), fullPage: true })
    const firstVerification = checkpoint.steps[0].attempts[0].verification[0]
    const receiptPath = firstVerification.stdoutPath.replace(/stdout\.log$/, 'receipt.json')
    const firstReceiptBytes = await readFile(receiptPath, 'utf8')
    expect(JSON.parse(firstReceiptBytes)).toMatchObject({ status: 'passed', exitCode: 0, cleanupVerified: true, inputFingerprint: firstVerification.inputFingerprint })
    const promptsBefore = (await app.transcript()).filter(entry => entry.event === 'prompt').length

    await app.restart()
    await openPlan()
    const restored = (await snapshot())!
    expect(restored.runId).toBe(checkpoint.runId)
    expect(restored.steps).toEqual(checkpoint.steps)
    expect((await app.transcript()).filter(entry => entry.event === 'prompt')).toHaveLength(promptsBefore)
    const resumedStatus = await cli('status', '--task', 'task-e2e')
    expect(resumedStatus.exitCode).toBe(0)
    expect(resumedStatus.records).toEqual([expect.objectContaining({ taskId: 'task-e2e', status: 'paused', completed: 1, total: 2, reason: checkpoint.reason })])

    const continued = await cli('--task', 'task-e2e', '--until-success')
    expect(continued.exitCode).toBe(0)
    expect(continued.records.at(-1)).toMatchObject({ taskId: 'task-e2e', status: 'completed', completed: 2, total: 2, iterations: 2 })
    const completed = (await snapshot())!
    expect(completed.runId).toBe(checkpoint.runId)
    expect(completed.steps[0]).toEqual(checkpoint.steps[0])
    expect(completed.steps.map(step => step.attempts.length)).toEqual([1, 1])
    expect(completed.steps[1]).toMatchObject({ status: 'completed', attempts: [{ status: 'completed', review: { outcome: 'approved' }, verification: [{ status: 'passed', exitCode: 0, cleanupVerified: true }] }] })
    expect(await readFile(receiptPath, 'utf8')).toBe(firstReceiptBytes)
    const transcript = await app.transcript()
    expect(transcript.filter(entry => entry.event === 'workflow-implementation')).toHaveLength(2)
    expect(transcript.filter(entry => entry.event === 'workflow-review')).toHaveLength(2)
    expect(transcript.filter(entry => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
    await expect(app.window.getByTestId('tab-btn-todo')).toContainText('2/2')
    await app.window.screenshot({ path: testInfo.outputPath('02-cli-until-success-completed.png'), fullPage: true })
    const workflowPath = testInfo.outputPath('cli-completed-workflow.json')
    await writeFile(workflowPath, JSON.stringify(completed, null, 2))
    await testInfo.attach('cli-completed-workflow.json', { path: workflowPath, contentType: 'application/json' })
  } finally {
    const filename = testInfo.outputPath('cli-subprocess-receipts.json')
    await writeFile(filename, JSON.stringify({ executable: process.execPath, receipts }, null, 2))
    await testInfo.attach('cli-subprocess-receipts.json', { path: filename, contentType: 'application/json' })
  }
})
