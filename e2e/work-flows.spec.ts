import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { test, expect } from './fixtures'
import type { WorkFlowSnapshot, WorkGate } from '../shared/work-flow'

test.use({ providerFixture: 'codex' })
const cases = ['auto-trivial', 'auto-medium', 'brainstorm', 'research', 'write', 'deep-brainstorm'] as const

for (const scenario of cases) test(`Work ${scenario}: ordinary Start, actual artifacts and durable user decisions`, async ({ app }, testInfo) => {
  test.setTimeout(scenario === 'deep-brainstorm' ? 300_000 : 180_000)
  const kind = scenario.startsWith('auto-') ? 'auto' : scenario
  const title = `Work flow fixture ${scenario}`
  await app.window.getByRole('button', { name: 'New task', exact: true }).first().click()
  await app.window.getByRole('button', { name: 'Work', exact: true }).click()
  const form = app.window.getByTestId('new-work-form')
  await form.getByTestId(`new-workflow-${kind}`).click()
  await form.getByTestId('new-work-agent-0-preset').selectOption('E2E Codex')
  await form.getByTestId('new-work-agent-0-permissions').selectOption('Workspace write')
  await form.getByTestId('new-work-description').fill(title)
  await form.getByTestId('new-work-options').locator(':scope > summary').click()
  await form.getByTestId('new-work-reviewer-0').selectOption('E2E Codex')
  if (scenario === 'write') await form.getByTestId('new-work-auto').uncheck()
  if (scenario === 'deep-brainstorm') {
    for (let index = 0; index < 3; index++) await form.getByTestId(`new-work-worker-${index}`).selectOption('E2E Codex')
  }
  let customFolder: string | undefined
  if (scenario === 'research') {
    // The platform picker is controlled fixture input; the renderer still uses
    // the real native-picker IPC, grant validation and source materialization.
    customFolder = testInfo.outputPath('profile', 'selected-work-folder')
    await mkdir(customFolder)
    const source = testInfo.outputPath('profile', 'provided-source.md')
    await writeFile(source, '# Provided source\nhttps://example.invalid/fixture-source\nSmall pilots give reversible feedback.\n')
    await app.electronApp.evaluate(({ dialog }, choices) => {
      dialog.showOpenDialog = (async (_window: unknown, options: { properties?: string[] }) => ({ canceled: false, filePaths: [options.properties?.includes('openDirectory') ? choices.folder : choices.source] })) as typeof dialog.showOpenDialog
    }, { folder: customFolder, source })
    await form.getByTestId('new-work-pick-folder').click()
    await expect(form.getByTestId('new-work-folder')).toHaveText(customFolder)
    await form.getByTestId('new-work-attach').click()
    await form.getByTestId('new-work-mention').click()
    await form.getByTestId('new-work-source-menu').getByRole('button', { name: 'provided-source.md' }).click()
    // Keep the fixture marker on its own line, retaining the actual source ID.
    const withSource = await form.getByTestId('new-work-description').inputValue()
    await form.getByTestId('new-work-description').fill(withSource.replace(title, `${title}\n`))
  }
  if (scenario === 'auto-trivial') {
    await form.getByTestId('new-work-copies').selectOption('2')
    await form.getByTestId('new-work-agent-1-model').fill('codex-fixture-next')
  }
  await app.window.screenshot({ path: testInfo.outputPath('01-work-selection.png'), fullPage: true })
  await form.getByTestId(scenario === 'auto-trivial' ? 'new-work-save-draft' : 'new-task-start').click()
  await expect(app.window.getByTestId('work-flow-panel')).toBeVisible()
  await expect.poll(async () => (await app.window.evaluate(() => window.ziafAPI.getTasks())).filter(item => item.name.startsWith(title)).length).toBe(scenario === 'auto-trivial' ? 2 : 1)
  const tasks = (await app.window.evaluate(() => window.ziafAPI.getTasks())).filter(item => item.name.startsWith(title))
  const task = tasks[0]
  expect(task).toMatchObject({ mode: 'work', branchType: 'Folder', workFlowVersion: 1, workflow: kind, agentProvider: 'codex', permissions: 'Workspace write' })
  expect(task.startupError).toBeUndefined()
  if (customFolder) expect(task.worktreePath).toBe(customFolder)
  else expect(task.worktreePath).toContain('worktrees')
  await expect(access(path.join(task.worktreePath!, '.git'))).rejects.toMatchObject({ code: 'ENOENT' })
  const snapshot = async (): Promise<WorkFlowSnapshot> => {
    const value = await app.window.evaluate(taskId => window.ziafAPI.workFlows.get({ taskId }), task.id)
    expect(value).not.toBeNull(); return value!
  }
  const prompts = async () => (await app.transcript()).filter(item => item.event === 'prompt')
  const phaseEvents = async () => (await app.transcript()).filter(item => item.event === 'work-flow-phase')
  const openPanel = async () => {
    if (!await app.window.getByTestId('work-flow-panel').isVisible()) await app.window.getByTestId('tab-btn-todo').click()
    await expect(app.window.getByTestId('work-flow-panel')).toBeVisible()
  }
  const gate = async (expected: WorkGate['kind']) => {
    await expect.poll(async () => (await snapshot()).pending?.kind, { timeout: 45_000 }).toBe(expected)
    await expect(app.window.getByTestId('work-flow-gate')).toBeVisible()
    await expect(app.window.getByTestId('work-flow-start')).toBeDisabled()
  }
  const completed = async () => {
    await expect.poll(async () => (await snapshot()).status, { timeout: 60_000 }).toBe('completed')
    await expect(app.window.getByTestId('work-flow-status')).toHaveAttribute('data-status', 'completed')
    return snapshot()
  }
  const restartAtDecision = async () => {
    const before = await snapshot(); const beforePrompts = (await prompts()).length
    await app.restart()
    await app.window.getByRole('button', { name: task.name, exact: true }).click()
    await openPanel()
    const after = await snapshot()
    expect(after.runId).toBe(before.runId); expect(after.pending).toEqual(before.pending)
    expect(after.artifacts).toEqual(before.artifacts)
    expect((await prompts()).length).toBe(beforePrompts)
    return before
  }
  if (scenario === 'auto-trivial') {
    expect((await snapshot()).status).toBe('draft')
    expect(await prompts()).toEqual([])
    expect(new Set(tasks.map(item => item.worktreePath)).size).toBe(2)
    expect(tasks.map(item => item.providerModel)).toEqual(['gpt-fixture', 'codex-fixture-next'])
    await app.restart()
    await app.window.getByRole('button', { name: task.name, exact: true }).click(); await openPanel()
    expect(await prompts()).toEqual([])
    await app.window.getByTestId('work-flow-start').click()
  }
  await expect.poll(async () => (await phaseEvents()).filter(item => item.stage === 'intake').length).toBe(1)
  const initial = await snapshot()
  expect(initial.definition.executor.configuration?.model).toBe('gpt-fixture')
  expect(initial.definition.roleLabels?.['executor:executor']).toBe('E2E Codex')
  expect(initial.definition.reviewers[0].configuration?.provider).toBe('codex')
  expect(await app.window.evaluate(taskId => window.ziafAPI.agentSessions.attach({ taskId, chatId: 'chat-main' }), task.id)).toBeNull()
  const firstChat = initial.stages[0].invocations[0].session!.chatId
  await expect(app.window.getByTestId(`central-tab-${firstChat}`)).toHaveClass(/border-\[#ff6b00\]/)
  await app.window.getByTestId('tab-btn-todo').click()
  await expect(app.window.getByTestId('work-flow-panel')).not.toBeVisible()
  await expect(app.window.getByTestId('agent-chat-plan-owned')).toBeVisible()
  await expect(app.window.getByTestId('conversation-feed')).toContainText(title)
  await expect(app.window.getByTestId('composer-send-button')).toBeDisabled()
  await app.window.screenshot({ path: testInfo.outputPath('02-work-stage-chat-panel-closed.png'), fullPage: true })
  await app.window.getByTestId('central-tab-chat-main').click()
  await app.window.getByTestId('composer-input').fill('Unsent ordinary Work discussion draft')
  await app.releaseCodex('work-flow-start')
  await expect.poll(async () => (await snapshot()).status, { timeout: 45_000 }).not.toBe('running')
  await expect(app.window.getByTestId('composer-input')).toHaveValue('Unsent ordinary Work discussion draft')
  await expect(app.window.getByTestId('composer-input')).toBeFocused()
  await openPanel()

  if (scenario === 'auto-trivial') {
    const done = await completed()
    expect(done.plan ?? []).toEqual([]); expect(done.artifacts).toEqual([])
    expect(done.stages.map(stage => stage.phase)).toEqual(['intake', 'review'])
    expect((await app.window.evaluate(taskId => window.ziafAPI.workFlows.get({ taskId }), tasks[1].id))?.status).toBe('draft')
    await expect(app.window.getByTestId('work-flow-no-plan')).toBeVisible()
  } else if (scenario === 'auto-medium') {
    await gate('plan')
    expect((await snapshot()).pending?.proposedSteps).toHaveLength(2)
    await expect(app.window.getByTestId('work-proposed-command')).toHaveCount(2)
    const before = await restartAtDecision()
    await app.window.getByTestId('work-gate-approve').click()
    const done = await completed()
    expect(done.decisions.filter(item => item.gateId === before.pending!.id)).toHaveLength(1)
    expect(done.plan?.map(step => step.status)).toEqual(['completed', 'completed'])
    const executions = done.stages.filter(stage => stage.phase === 'execution')
    expect(executions).toHaveLength(2)
    for (const [index, stage] of executions.entries()) {
      expect(stage.verification).toHaveLength(1)
      expect(stage.verification[0]).toMatchObject({ status: 'passed', exitCode: 0, cleanupVerified: true })
      const name = ['notes', 'handoff'][index]
      expect(await readFile(path.join(task.worktreePath!, `${name}.md`), 'utf8')).toContain(`WORK_FIXTURE_${name.toUpperCase()}`)
    }
  } else if (scenario === 'brainstorm') {
    await gate('brainstorm-direction')
    expect((await phaseEvents()).some(item => item.stage === 'review' || item.stage === 'convergence')).toBe(false)
    const originalGate = (await snapshot()).pending!.id
    await app.window.getByTestId('work-gate-more').click()
    await expect.poll(async () => (await snapshot()).pending?.id).not.toBe(originalGate)
    await gate('brainstorm-direction')
    expect((await snapshot()).artifacts.filter(item => item.name === 'ideas.md')).toHaveLength(2)
    await app.window.getByTestId('work-gate-evaluate').click()
    const done = await completed()
    expect(done.plan ?? []).toEqual([])
    expect(done.stages.map(stage => stage.phase)).toEqual(['intake', 'divergence', 'convergence', 'review'])
    expect(await readFile(path.join(task.worktreePath!, 'ideas.md'), 'utf8')).toContain('Selected:')
  } else if (scenario === 'research') {
    await gate('questions')
    const before = await restartAtDecision()
    for (const question of before.pending!.questions!) await app.window.getByTestId(`work-question-${question.id}`).fill('Independent creators')
    await app.window.getByTestId('work-gate-answer').click()
    const done = await completed()
    expect(done.sources).toHaveLength(1); expect(done.sources[0].provenance).toBe('provided')
    expect(done.definition.inputs).toHaveLength(1)
    expect(done.stages[0].invocations).toHaveLength(2)
    expect(done.stages[0].invocations[1].session?.chatId).toBe(before.stages[0].invocations[0].session?.chatId)
    const deliveries = (await phaseEvents()).filter(item => item.stage === 'intake')
    expect(deliveries).toHaveLength(2); expect(deliveries[1].pid).not.toBe(deliveries[0].pid)
    expect(deliveries[1].threadId).toBe(deliveries[0].threadId)
    await expect(app.window.getByTestId('work-flow-sources')).toContainText('Provided source')
    expect(await readFile(path.join(task.worktreePath!, 'findings.md'), 'utf8')).toContain('did not browse')
  } else if (scenario === 'write') {
    await gate('outline')
    expect((await snapshot()).artifacts.map(item => item.name)).toEqual(['outline.md'])
    await app.window.getByTestId('work-gate-approve').click()
    await gate('artifact-review')
    const firstDraft = (await snapshot()).artifacts.find(item => item.name === 'draft.md')!
    await app.window.getByTestId('work-gate-comments').fill('Shorten the introduction and keep the main message.')
    await app.window.getByTestId('work-gate-changes').click()
    await expect.poll(async () => (await snapshot()).artifacts.filter(item => item.name === 'draft.md').length).toBe(2)
    await gate('artifact-review')
    await restartAtDecision()
    await app.window.getByTestId('work-gate-comments').fill('Accepted with a future stylistic suggestion; no new revision.')
    await app.window.getByTestId('work-gate-approve-with-comments').click()
    const done = await completed()
    const versions = done.artifacts.filter(item => item.name === 'draft.md')
    expect(versions.map(item => item.version)).toEqual([1, 2]); expect(versions[0]).toEqual(firstDraft)
    expect(versions[1].sha256).not.toBe(firstDraft.sha256)
    expect(await readFile(path.join(task.worktreePath!, 'draft.md'), 'utf8')).toContain('Short introduction.')
    expect(done.stages.filter(stage => stage.phase === 'revision')).toHaveLength(1)
  } else {
    await gate('questions')
    const before = await restartAtDecision()
    const workers = before.stages.filter(stage => stage.phase === 'worker')
    expect(workers).toHaveLength(3)
    expect(new Set(workers.map(stage => stage.invocations[0].session?.chatId)).size).toBe(3)
    expect(workers.every(stage => stage.source.configuration?.model === 'gpt-fixture')).toBe(true)
    expect(workers[1].reportRepairCount).toBe(1); expect(workers[1].status).toBe('completed')
    expect(workers[2].reportRepairCount).toBe(1); expect(workers[2].status).toBe('failed')
    for (const question of before.pending!.questions!) await app.window.getByTestId(`work-question-${question.id}`).fill('Independent creators')
    await app.window.getByTestId('work-gate-answer').click()
    await gate('artifact-review')
    const reported = await snapshot()
    const currentWorkers = reported.stages.filter(stage => stage.phase === 'worker')
    expect(currentWorkers.map(stage => stage.invocations.length)).toEqual([2, 2, 2])
    expect(currentWorkers[0].invocations[1].session?.chatId).toBe(workers[0].invocations[0].session?.chatId)
    expect(reported.plan ?? []).toEqual([])
    expect(await readFile(path.join(task.worktreePath!, 'brainstorm_report.md'), 'utf8')).toContain('Worker 3 failed')
    await app.window.getByTestId('work-gate-approve').click(); await completed()
    const workerCalls = (await phaseEvents()).filter(item => item.stage === 'worker')
    await app.window.getByTestId('work-follow-up-text').fill('Briefly clarify how to start in the first week.')
    await app.window.getByTestId('work-follow-up-send').click()
    await expect.poll(async () => (await snapshot()).artifacts.filter(item => item.name === 'brainstorm_report.md').length).toBe(2)
    await gate('artifact-review')
    await app.window.getByTestId('work-gate-approve').click(); await completed()
    expect((await phaseEvents()).filter(item => item.stage === 'worker')).toEqual(workerCalls)
    expect(await readFile(path.join(task.worktreePath!, 'brainstorm_report.md'), 'utf8')).toContain('one week')
  }
  const final = await completed()
  for (const receipt of final.artifacts) {
    const bytes = await readFile(receipt.path)
    expect(bytes.length).toBe(receipt.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(receipt.sha256)
    if (!receipt.binary) {
      const displayed = await app.window.evaluate(request => window.ziafAPI.workFlows.readArtifact(request), { taskId: task.id, artifactId: receipt.id })
      expect(displayed.content).toBe(bytes.toString('utf8'))
    }
  }
  const latest = final.artifacts.at(-1)
  if (latest) {
    await app.window.getByTestId(`work-artifact-${latest.id}`).getByRole('button', { name: 'Read document', exact: true }).click()
    await expect(app.window.getByTestId(`work-artifact-content-${latest.id}`)).toBeVisible()
  }
  const finalPromptCount = (await prompts()).length
  await app.window.screenshot({ path: testInfo.outputPath('03-completed-work-results.png'), fullPage: true })
  await app.restart()
  await app.window.getByRole('button', { name: task.name, exact: true }).click(); await openPanel()
  expect(await snapshot()).toEqual(final)
  expect((await prompts()).length).toBe(finalPromptCount)
  await app.window.getByTestId('central-tab-chat-main').click()
  await expect(app.window.getByTestId('composer-input')).toHaveValue('Unsent ordinary Work discussion draft')
  expect(await app.window.evaluate(taskId => window.ziafAPI.agentSessions.attach({ taskId, chatId: 'chat-main' }), task.id)).toBeNull()
  const transcript = await app.transcript()
  expect(transcript.filter(item => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(item.event ?? ''))).toEqual([])
  expect((await phaseEvents()).every(item => item.cwd === task.worktreePath)).toBe(true)
  await app.window.screenshot({ path: testInfo.outputPath('04-restored-work-history.png'), fullPage: true })
  await writeFile(testInfo.outputPath('work-flow-receipt.json'), JSON.stringify({ scenario, task, tasks, final, promptCount: finalPromptCount, verification: 'Deterministic local Codex fixture; no inference or network calls' }, null, 2))
})
