import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from './fixtures'

test.use({ providerFixture: 'codex' })

test('Legacy Work preserves its three-step plan, verifies real artifacts, and resumes after full Quit', async ({ app }, testInfo) => {
  test.setTimeout(180_000)
  // Seed the supported pre-v1 creation contract. New Work uses workOptions and
  // is covered through its ordinary form in work-flows.spec.ts. Everything
  // after this compatibility setup uses the same real UI and production Quit.
  const folder = testInfo.outputPath('profile', 'Work')
  await mkdir(folder)
  const created = await app.window.evaluate(() => window.ziafAPI.createTask({
    name: 'Fixture Work document', description: 'Fixture Work document',
    repoId: 'work-folder', branchType: 'Folder', branchName: 'Work',
    model: 'E2E Codex', workflow: 'Draft & Document',
  }))
  expect(created.workFlowVersion).toBeUndefined()
  await app.window.reload()
  await app.window.getByRole('button', { name: created.name, exact: true }).click()
  await expect(app.window.getByTestId('structured-codex-chat')).toBeVisible()
  await expect(app.window.getByTestId('composer-input')).toHaveValue('Fixture Work document')
  const tasks = await app.window.evaluate(() => window.ziafAPI.getTasks())
  const task = tasks.find(item => item.name === 'Fixture Work document')!
  expect(task).toMatchObject({ mode: 'work', branchType: 'Folder', branchName: 'Work', workflow: 'Draft & Document', agentProvider: 'codex' })
  expect(task.worktreePath).toBe(path.join(folder, 'worktrees', task.id))
  const repositories = await app.window.evaluate(() => window.ziafAPI.getRepositories())
  expect(repositories.find(item => item.id === task.repoId)).toMatchObject({ kind: 'folder', path: folder, repoPath: folder })
  const snapshot = () => app.window.evaluate(taskId => window.ziafAPI.workflows.get({ taskId }), task.id)
  const openPlan = async () => {
    if (!await app.window.getByTestId('executable-plan').isVisible()) await app.window.getByTestId('tab-btn-todo').click()
    await expect(app.window.getByTestId('executable-plan')).toBeVisible()
  }
  await openPlan()
  const proposal = (await snapshot())!
  expect(proposal.status).toBe('draft')
  expect(proposal.plan.steps.map(step => step.title)).toEqual(['Prepare', 'Create artifact', 'Review and deliver'])
  expect(proposal.plan.steps.every(step => step.verification.length === 0)).toBe(true)
  expect(proposal.steps.every(step => step.attempts.length === 0)).toBe(true)
  expect((await app.transcript()).filter(entry => entry.event === 'prompt')).toEqual([])
  await app.window.screenshot({ path: testInfo.outputPath('01-work-template-draft.png'), fullPage: true })

  await app.window.getByTestId('workflow-coder').selectOption('E2E Codex')
  await app.window.getByTestId('workflow-reviewer').selectOption('E2E Codex')
  await app.window.getByTestId('workflow-auto').uncheck()
  const artifacts = ['outline.md', 'document.md', 'handoff.md']
  for (const [index, filename] of artifacts.entries()) {
    if (!await app.window.getByTestId(`workflow-check-${index}`).isVisible()) await app.window.getByTestId(`workflow-step-${index}`).getByRole('button').first().click()
    await app.window.getByTestId(`workflow-check-${index}`).fill(`/usr/bin/grep -qx 'fixture work evidence' ${filename}`)
  }
  await app.window.getByTestId('workflow-start').click()
  await expect.poll(async () => (await snapshot())?.steps[0].status, { timeout: 30_000 }).toBe('completed')
  await expect.poll(async () => (await snapshot())?.status).toBe('paused')
  const checkpoint = (await snapshot())!
  expect(checkpoint.steps[1].attempts).toHaveLength(0)
  await expect(app.window.getByTestId('tab-btn-todo')).toContainText('1/3')
  const outline = await readFile(path.join(task.worktreePath!, 'outline.md'), 'utf8')
  expect(outline).toContain('fixture work evidence')
  await app.window.screenshot({ path: testInfo.outputPath('02-work-artifact-verified.png'), fullPage: true })
  await app.restart()
  await app.window.getByRole('button', { name: task.name, exact: true }).click()
  await openPlan()
  const resumed = (await snapshot())!
  expect(resumed.runId).toBe(checkpoint.runId)
  expect(resumed.steps[0]).toEqual(checkpoint.steps[0])
  expect((await app.transcript()).filter(entry => entry.event === 'work-implementation')).toHaveLength(1)
  await app.window.getByTestId('workflow-auto').check()
  await app.window.getByTestId('workflow-start').click()
  await expect.poll(async () => (await snapshot())?.status, { timeout: 40_000 }).toBe('completed')
  const completed = (await snapshot())!
  expect(completed.steps.map(step => step.attempts.length)).toEqual([1, 1, 1])
  expect(completed.steps[0]).toEqual(checkpoint.steps[0])
  for (const filename of artifacts) expect(await readFile(path.join(task.worktreePath!, filename), 'utf8')).toContain('fixture work evidence')
  for (const directory of [folder, task.worktreePath!]) await expect(access(path.join(directory, '.git'))).rejects.toMatchObject({ code: 'ENOENT' })
  const gitResult = await app.window.evaluate(async taskId => {
    try { await window.ziafAPI.git.prepare({ taskId }); return 'unexpected Git binding' } catch (error) { return String(error) }
  }, task.id)
  expect(gitResult).toContain('without Git')
  const transcript = await app.transcript()
  const coders = transcript.filter(entry => entry.event === 'work-implementation')
  const reviewers = transcript.filter(entry => entry.event === 'work-review')
  expect(coders).toHaveLength(3); expect(reviewers).toHaveLength(3)
  expect([...coders, ...reviewers].every(entry => entry.cwd === task.worktreePath)).toBe(true)
  expect(reviewers.every(entry => !coders.some(coder => coder.pid === entry.pid))).toBe(true)
  expect(transcript.filter(entry => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  for (const step of completed.steps) for (const verification of step.attempts[0].verification) {
    const receipt = JSON.parse(await readFile(verification.stdoutPath.replace(/stdout\.log$/, 'receipt.json'), 'utf8'))
    expect(receipt).toMatchObject({ status: 'passed', exitCode: 0, cleanupVerified: true, cwd: task.worktreePath, command: { executable: '/bin/sh' } })
  }
  await expect(app.window.getByTestId('tab-btn-todo')).toContainText('3/3')
  await app.window.screenshot({ path: testInfo.outputPath('03-work-completed-after-restart.png'), fullPage: true })
  await writeFile(testInfo.outputPath('completed-workflow.json'), JSON.stringify(completed, null, 2))
})
