import { readFile, writeFile } from 'node:fs/promises'
import { test, expect } from './fixtures'

test.use({ providerFixture: 'codex' })

test('workflow roles offer every preset and retain Custom model and effort in independent execution contexts', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const { window: page } = app
  const snapshot = () => page.evaluate(() => window.ziafAPI.workflows.get({ taskId: 'task-e2e' }))
  const open = async () => {
    await page.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    if (!await page.getByTestId('executable-plan').isVisible()) await page.getByTestId('tab-btn-todo').click()
    await expect(page.getByTestId('workflow-coder')).toBeEnabled()
  }
  const options = async (role: 'coder' | 'reviewer', open: boolean) => {
    const details = page.getByTestId(`workflow-${role}-execution-options`)
    if ((await details.getAttribute('open') !== null) !== open) await details.locator('summary').click()
  }
  const custom = async (role: 'coder' | 'reviewer', model: string, effort: string) => {
    const prefix = `workflow-${role}`
    await page.getByTestId(prefix).selectOption('@custom')
    await page.getByTestId(`${prefix}-provider`).selectOption('codex')
    await expect(page.getByTestId(`${prefix}-model-catalog`).locator(`option[value="${model}"]`)).toHaveCount(1)
    await page.getByTestId(`${prefix}-model-catalog`).selectOption(model)
    await expect(page.getByTestId(`${prefix}-model`)).toHaveValue(model)
    await options(role, true)
    const reasoning = page.getByTestId(`${prefix}-reasoning-effort`)
    await expect(reasoning.locator(`option[value="${effort}"]`)).toHaveCount(1)
    await reasoning.selectOption(effort)
    if (role === 'coder') await page.getByTestId(`${prefix}-permissions`).selectOption('Workspace write')
    else await expect(page.getByTestId(`${prefix}-permissions`)).toHaveCount(0)
    await options(role, false)
  }

  await open()
  await page.getByTestId('workflow-review').check()
  const presets = await page.evaluate(() => window.ziafAPI.getPresets())
  const presetNames = presets.map(preset => preset.name)
  expect(presets.some(preset => preset.agent === 'Google Antigravity')).toBe(true)
  for (const role of ['coder', 'reviewer'] as const) {
    const choices = await page.getByTestId(`workflow-${role}`).locator('option').evaluateAll(nodes => nodes.map(node => ({ value: (node as HTMLOptionElement).value, disabled: (node as HTMLOptionElement).disabled })))
    expect(choices.map(choice => choice.value)).toEqual(expect.arrayContaining([...presetNames, '@custom']))
    expect(choices.filter(choice => presetNames.includes(choice.value)).every(choice => !choice.disabled)).toBe(true)
  }
  await expect(page.getByTestId('workflow-coder').locator('option[value="@task"]')).toHaveCount(1)
  // The same saved preset remains selectable for both roles, including agy.
  // Native agy policy is covered by backend tests; this scenario runs Codex only.
  for (const preset of ['E2E Antigravity', 'E2E Codex']) {
    await page.getByTestId('workflow-coder').selectOption(preset)
    await page.getByTestId('workflow-reviewer').selectOption(preset)
    await expect(page.getByTestId('workflow-coder')).toHaveValue(preset)
    await expect(page.getByTestId('workflow-reviewer')).toHaveValue(preset)
  }
  await custom('coder', 'codex-fixture', 'none')
  await custom('reviewer', 'codex-fixture-next', 'xhigh')

  // Reuse the existing fixture's immediately successful step. Step 1 deliberately
  // fails twice in a different test; no new provider behavior is needed here.
  await page.getByTestId('workflow-add-title').fill('Fixture step 2')
  await page.getByTestId('workflow-add-step').click()
  const step = page.getByTestId('workflow-step-0')
  await step.getByLabel('Instructions', { exact: true }).fill('Produce fixture-step-2.txt containing ready. Change no other files.')
  await step.getByLabel('Acceptance criteria (one per line)', { exact: true }).fill('The saved file contains ready and an independent reviewer approves.')
  await page.getByTestId('workflow-check-0').fill('/usr/bin/grep -qx ready fixture-step-2.txt')
  await page.getByTestId('workflow-save').click()
  await expect.poll(async () => (await snapshot())?.revision).toBe(1)
  const saved = (await snapshot())!
  expect(saved.plan).toMatchObject({
    coderPreset: '@custom', coderConfiguration: { provider: 'codex', model: 'codex-fixture', reasoningEffort: 'none', permissions: 'Workspace write' },
    reviewerPreset: '@custom', reviewerConfiguration: { provider: 'codex', model: 'codex-fixture-next', reasoningEffort: 'xhigh' },
    review: true,
  })
  await page.reload()
  await open()
  expect((await snapshot())!.plan).toEqual(saved.plan)
  for (const [role, model, effort] of [['coder', 'codex-fixture', 'none'], ['reviewer', 'codex-fixture-next', 'xhigh']] as const) {
    await expect(page.getByTestId(`workflow-${role}`)).toHaveValue('@custom')
    await expect(page.getByTestId(`workflow-${role}-provider`)).toHaveValue('codex')
    await expect(page.getByTestId(`workflow-${role}-model`)).toHaveValue(model)
    await options(role, true)
    await expect(page.getByTestId(`workflow-${role}-reasoning-effort`)).toHaveValue(effort)
    if (role === 'coder') await expect(page.getByTestId('workflow-coder-permissions')).toHaveValue('Workspace write')
    await options(role, false)
  }
  expect((await app.transcript()).filter(entry => entry.event === 'prompt')).toHaveLength(0)
  await page.getByTestId('workflow-coder').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('01-custom-workflow-roles-restored.png'), fullPage: true })

  await page.getByTestId('workflow-start').click()
  await expect.poll(async () => (await snapshot())?.status, { timeout: 40_000 }).toBe('completed')
  const completed = (await snapshot())!
  expect(completed.steps).toHaveLength(1)
  expect(completed.steps[0].attempts).toHaveLength(1)
  const attempt = completed.steps[0].attempts[0]
  expect(attempt).toMatchObject({ status: 'completed', review: { outcome: 'approved' }, verification: [{ status: 'passed', exitCode: 0, cleanupVerified: true }] })
  expect(attempt.session?.sessionId).toBeTruthy()
  expect(attempt.reviewerSession?.sessionId).toBeTruthy()
  expect(attempt.reviewerSession!.sessionId).not.toBe(attempt.session!.sessionId)
  expect(attempt.reviewerSession!.chatId).not.toBe(attempt.session!.chatId)
  const transcript = await app.transcript()
  const prompts = transcript.filter(entry => entry.event === 'prompt')
  expect(prompts).toHaveLength(2)
  expect(prompts[0].text).toMatch(/^Implement this one plan step/)
  expect(prompts[1].text).toMatch(/^Independently review only this plan step/)
  expect(prompts[1].pid).not.toBe(prompts[0].pid)
  expect(prompts[1].threadId).not.toBe(prompts[0].threadId)
  const wire = prompts.map((prompt, index) => {
    const launches = transcript.filter(entry => entry.pid === prompt.pid && entry.event === 'rpc-in' && entry.rpc?.method === 'thread/start')
    const turns = transcript.filter(entry => entry.pid === prompt.pid && entry.event === 'rpc-in' && entry.rpc?.method === 'turn/start')
    expect(launches).toHaveLength(1)
    expect(turns).toHaveLength(1)
    const model = index === 0 ? 'codex-fixture' : 'codex-fixture-next'
    const effort = index === 0 ? 'none' : 'xhigh'
    expect(launches[0].rpc?.params).toMatchObject({ model, sandbox: index === 0 ? 'workspace-write' : 'read-only', approvalPolicy: index === 0 ? 'on-request' : 'never', config: { model_reasoning_effort: effort } })
    expect(turns[0].rpc?.params).toMatchObject({ effort, threadId: prompt.threadId })
    return { role: index === 0 ? 'coder' : 'reviewer', pid: prompt.pid, threadId: prompt.threadId, launch: launches[0].rpc?.params, turn: { threadId: turns[0].rpc?.params?.threadId, effort: turns[0].rpc?.params?.effort } }
  })
  const verification = JSON.parse(await readFile(attempt.verification[0].stdoutPath.replace(/stdout\.log$/, 'receipt.json'), 'utf8'))
  expect(verification).toMatchObject({ status: 'passed', exitCode: 0, cleanupVerified: true })
  expect(transcript.filter(entry => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  await expect(page.getByTestId('workflow-step-status-0')).toHaveText('completed')
  await expect(page.getByTestId('tab-btn-todo')).toContainText('1/1')
  await page.getByTestId('workflow-step-0').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('02-custom-workflow-independent-contexts.png'), fullPage: true })
  await writeFile(testInfo.outputPath('workflow-agent-selection.json'), JSON.stringify({ savedPlan: saved.plan, completed, wire, verification }, null, 2))
})
