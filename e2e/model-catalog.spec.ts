import { test, expect } from './fixtures'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'

test.use({ providerFixture: 'codex', fixtureAllProviders: true })

test('loads each installed CLI catalog in presets and creates a direct-CLI task that survives restart', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const window = app.window
  await window.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await window.getByRole('button', { name: 'Presets', exact: true }).click()
  await window.getByRole('row').filter({ hasText: 'E2E Codex' }).getByTitle('Edit', { exact: true }).click()
  const agent = window.getByRole('combobox', { name: 'Coding Agent', exact: true })
  for (const [name, model, source] of [
    ['codex', 'codex-fixture-next', 'model/list'],
    ['claude', 'claude-fixture-next', 'initialize.models'],
    ['antigravity', 'gemini-fixture-next', 'agy models'],
  ]) {
    await agent.selectOption(name)
    await expect(window.getByTestId('preset-model-catalog-status')).toContainText(source)
    await expect(window.getByTestId('preset-model-catalog').locator('option')).toContainText([/auto/i, /fixture/, model, /manual|custom/i])
    await window.getByTestId('preset-model-catalog').selectOption(model)
    await expect(window.getByTestId('preset-model')).toHaveValue(model)
    await window.getByTestId('preset-model').fill('my/future-model')
    await window.getByTestId('preset-model-refresh').click()
    await expect(window.getByTestId('preset-model-catalog-status')).toContainText(source)
    await expect(window.getByTestId('preset-model')).toHaveValue('my/future-model')
  }
  const userData = await app.electronApp.evaluate(({ app }) => app.getPath('userData'))
  const catalogDirectory = await realpath(path.join(userData, 'model-catalog'))
  expect((await stat(catalogDirectory)).mode & 0o777).toBe(0o700)
  const codexCatalogStarts = (await app.transcript()).filter(entry => entry.event === 'model-discovery-start' && entry.args?.[0] === 'app-server')
  expect(codexCatalogStarts.length).toBeGreaterThan(0)
  for (const entry of codexCatalogStarts) expect(entry.cwd).toBe(catalogDirectory)
  expect((await app.transcript()).filter(entry => ['prompt', 'provider-start', 'app-server-start'].includes(entry.event || ''))).toEqual([])
  await window.screenshot({ path: testInfo.outputPath('01-preset-catalog-and-manual-id.png'), fullPage: true })

  await window.getByTestId('preset-editor').getByRole('button', { name: 'Cancel', exact: true }).click()
  await window.getByRole('button', { name: 'New task', exact: true }).first().click()
  const form = window.locator('form')
  await form.getByRole('button', { name: 'E2E Project', exact: true }).click()
  await form.getByRole('button', { name: 'E2E Project', exact: true }).last().click()
  await form.getByTestId('new-task-agent-provider').selectOption('codex')
  await expect(form.getByTestId('new-task-agent-preset')).toHaveValue('')
  await expect(form.getByTestId('new-task-agent-model-catalog-status')).toContainText('model/list')
  await form.getByTestId('new-task-agent-model-catalog').selectOption('codex-fixture-next')
  await form.getByPlaceholder('new-task-xxxx').fill('direct-cli-task')
  await form.locator('textarea').fill('fixture-hello')
  await form.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(window.getByTestId('code-dialogue')).toBeVisible()
  await expect(window.getByTestId('composer-input')).toHaveValue('')
  const task = await window.evaluate(async () => (await globalThis.window.ziafAPI.getTasks()).find(candidate => candidate.name === 'fixture-hello'))
  expect(task).toMatchObject({ model: '', agentProvider: 'codex', providerModel: 'codex-fixture-next', codeFlowVersion: 1 })
  const taskId = task!.id
  const snapshot = () => app.window.evaluate(id => globalThis.window.ziafAPI.agentSessions.attach({ taskId: id, chatId: 'chat-main' }), taskId)
  await expect.poll(async () => (await window.evaluate(taskId => globalThis.window.ziafAPI.workflows.get({ taskId }), taskId))?.status).toBe('completed')
  expect((await app.transcript()).filter(entry => entry.event === 'code-flow-preparation')).toHaveLength(1)
  expect(await snapshot(), 'Direct CLI Code Start leaves the ordinary chat unstarted').toBeNull()
  await window.getByTestId('central-tab-chat-main').click()
  await expect(window.getByTestId('structured-codex-chat')).toBeVisible()
  await window.getByTestId('composer-input').fill('fixture-hello')
  await window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  const before = (await snapshot())!
  expect(before).toMatchObject({ presetName: '', model: 'codex-fixture-next' })
  await app.restart()
  await app.window.getByRole('button', { name: 'fixture-hello', exact: true }).click()
  await app.window.getByTestId('central-tab-chat-main').click()
  await expect(app.window.getByTestId('structured-codex-chat')).toBeVisible()
  expect((await snapshot())!.sessionId).toBe(before.sessionId)
  await expect(app.window.getByTestId('agent-session-resume')).toBeVisible()
  await app.window.getByTestId('agent-session-resume').click()
  await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
  expect((await snapshot())!.presetName).toBe('')
  const prompts = (await app.transcript()).filter(entry => entry.event === 'prompt')
  expect(prompts).toHaveLength(2)
  expect(prompts.filter(entry => entry.text === 'fixture-hello')).toHaveLength(1)
  expect(prompts.filter(entry => entry.text?.startsWith('You are carrying out one preparation phase of a ZIAForge Code task.'))).toHaveLength(1)
  await app.window.screenshot({ path: testInfo.outputPath('02-direct-cli-resumed-without-preset.png'), fullPage: true })
  expect((await app.transcript()).filter(entry => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
})
