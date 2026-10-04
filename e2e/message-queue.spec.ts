import { test, expect } from './fixtures'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

test.use({ providerFixture: 'codex' })

test('durable queued messages survive Stop and full Quit, then resume once in the original native context', async ({ app }, testInfo) => {
  test.setTimeout(180_000)
  const openTask = () => app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const snapshot = () => app.window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
  const prompts = async () => (await app.transcript()).filter(item => item.event === 'prompt')
  const screenshot = async (name: string) => {
    const filename = testInfo.outputPath(`${name}.png`)
    await app.window.screenshot({ path: filename, fullPage: true })
    await testInfo.attach(name, { path: filename, contentType: 'image/png' })
  }
  const enqueue = async (text: string) => {
    await app.window.getByTestId('composer-input').fill(text)
    await app.window.getByTestId('composer-queue-button').click()
    await expect(app.window.getByTestId('composer-input')).toHaveValue('')
    await expect.poll(async () => (await snapshot())?.queue?.items.some(item => item.text === text)).toBe(true)
  }

  await openTask()
  await app.window.getByTestId('composer-input').fill('fixture-interrupt')
  await app.window.getByTestId('composer-send-button').click()
  await expect(app.window.getByTestId('composer-stop-button')).toBeVisible()
  await expect.poll(async () => (await prompts()).length).toBe(1)
  const first = (await prompts())[0]
  await enqueue('fixture-hello')
  await enqueue('fixture-after-stop')
  await enqueue('never-deliver-this-cancelled-message')
  const queued = (await snapshot())!.queue!.items
  expect(queued.map(item => item.status)).toEqual(['queued', 'queued', 'queued'])
  await app.window.getByTestId(`agent-queue-cancel-${queued[2].clientMessageId}`).click()
  await expect.poll(async () => (await snapshot())?.queue?.items.length).toBe(2)
  await expect(app.window.getByTestId('agent-message-queue')).not.toContainText('never-deliver-this-cancelled-message')
  expect(await prompts()).toHaveLength(1)
  await screenshot('01-active-turn-with-two-durable-messages')

  // Renderer reload must not start another native turn or lose the queued IDs.
  await app.window.reload()
  await openTask()
  await expect(app.window.getByTestId('agent-message-queue')).toContainText('fixture-after-stop')
  expect((await snapshot())!.queue!.items.map(item => item.clientMessageId)).toEqual(queued.slice(0, 2).map(item => item.clientMessageId))
  await app.window.getByTestId('composer-stop-button').click()
  await expect.poll(async () => (await snapshot())?.queue?.paused).toBe(true)
  await app.window.getByTestId('composer-input').fill('a separate unsent draft')
  await expect(app.window.getByTestId('composer-send-button')).toBeDisabled()
  await app.releaseCodex('finish-interrupt')
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('interrupted')
  await expect(app.window.getByTestId('composer-stop-button')).toHaveCount(0)
  expect(await prompts()).toHaveLength(1)

  await app.restart()
  await openTask()
  await expect(app.window.getByTestId('agent-message-queue')).toContainText('fixture-hello')
  await expect(app.window.getByTestId('composer-input')).toHaveValue('a separate unsent draft')
  const restored = (await snapshot())!
  expect(restored.queue!.paused).toBe(true)
  expect(restored.queue!.items.map(item => item.clientMessageId)).toEqual(queued.slice(0, 2).map(item => item.clientMessageId))
  expect(await prompts()).toHaveLength(1)
  await screenshot('02-queue-and-independent-draft-restored-paused')

  // Pending inputs belong to this saved provider/configuration, never a newly selected one.
  await expect(app.window.evaluate(async ref => globalThis.window.ziafAPI.agentSessions.reconfigure({
    ...ref, presetName: '', provider: 'claude', model: 'sonnet',
  }), { sessionId: restored.sessionId, runId: restored.runId })).rejects.toThrow(/queue|queued|messages/i)
  await expect(app.window.getByTestId('agent-session-resume')).toBeVisible()
  await app.window.getByTestId('agent-session-resume').click()
  await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
  expect(await prompts()).toHaveLength(1)
  expect((await snapshot())!.queue!.paused).toBe(true)
  await app.window.getByTestId('agent-queue-toggle').click()
  await expect.poll(async () => (await prompts()).length).toBe(3)
  await expect.poll(async () => (await snapshot())?.queue?.items.length).toBe(0)
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  const delivered = await prompts()
  expect(delivered.map(item => item.text)).toEqual(['fixture-interrupt', 'fixture-hello', 'fixture-after-stop'])
  expect(delivered.slice(1).every(item => item.threadId === first.threadId && item.pid !== first.pid)).toBe(true)
  expect(delivered[1].pid).toBe(delivered[2].pid)
  const feed = app.window.getByTestId('conversation-feed')
  await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(3)
  await expect(feed).toContainText('Codex fixture hello. 🌍')
  await expect(feed).toContainText('Codex fixture resumed on the same session. 🌍')
  await expect(app.window.getByTestId('composer-input')).toHaveValue('a separate unsent draft')
  await screenshot('03-queue-delivered-in-order-once')

  // Reload and another complete restart must not redispatch accepted or cancelled IDs.
  await app.restart()
  await openTask()
  expect((await snapshot())!.queue!.items).toEqual([])
  expect(await prompts()).toHaveLength(3)
  await expect(app.window.getByTestId('composer-input')).toHaveValue('a separate unsent draft')
  await testInfo.attach('queue-final-snapshot.json', { body: JSON.stringify(await snapshot(), null, 2), contentType: 'application/json' })
})

test('a damaged saved queue is explicitly restored as uncertain inputs without automatic redelivery', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const openTask = () => app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const snapshot = () => app.window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
  const prompts = async () => (await app.transcript()).filter(item => item.event === 'prompt')
  await openTask()
  await app.window.getByTestId('composer-input').fill('fixture-interrupt')
  await app.window.getByTestId('composer-send-button').click()
  await expect(app.window.getByTestId('composer-stop-button')).toBeVisible()
  await app.window.getByTestId('composer-input').fill('fixture-hello')
  await app.window.getByTestId('composer-queue-button').click()
  await expect.poll(async () => (await snapshot())?.queue?.items.length).toBe(1)
  await app.window.getByTestId('composer-stop-button').click()
  await app.releaseCodex('finish-interrupt')
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('interrupted')
  const before = (await snapshot())!
  expect(before.queue!.paused).toBe(true)
  const filename = path.join(testInfo.outputPath('profile'), 'user-data', 'agent-sessions', 'task-e2e', 'queues', `${before.sessionId}.json`)
  const saved = await readFile(filename)
  const backupId = createHash('sha256').update(saved).digest('hex')
  const damaged = Buffer.from('{"version":1,"items":')
  // The queue is already paused: normal Quit has no newer input state to write.
  await writeFile(filename, damaged)
  await app.restart()
  expect(await readFile(filename)).toEqual(damaged)
  await expect(app.window.getByTestId('recovery-panel')).toBeVisible()
  const documents = await app.window.evaluate(() => globalThis.window.ziafAPI.recovery.list())
  const target = { domain: 'message-queue', taskId: 'task-e2e', sessionId: before.sessionId }
  expect(documents).toEqual(expect.arrayContaining([expect.objectContaining({ target, state: 'corrupt', backups: expect.arrayContaining([expect.objectContaining({ id: backupId })]) })]))
  if (await app.window.getByTestId('recovery-document').count()) await app.window.getByTestId('recovery-document').selectOption(JSON.stringify(target))
  await expect(snapshot()).rejects.toThrow(/damaged|queue|recover/i)
  expect(await prompts()).toHaveLength(1)
  await app.window.getByTestId('recovery-backup').selectOption(backupId)
  await app.window.getByTestId('recovery-restore').click()
  await expect(app.window.getByTestId('recovery-panel')).toBeHidden()
  const damagedId = createHash('sha256').update(damaged).digest('hex')
  expect(await readFile(path.join(`${filename}.recovery`, `${damagedId}.damaged`))).toEqual(damaged)
  await openTask()
  await expect(app.window.getByTestId('agent-message-queue')).toContainText('fixture-hello')
  const restored = (await snapshot())!
  expect(restored.queue).toMatchObject({ paused: true, items: [{ clientMessageId: before.queue!.items[0].clientMessageId, text: 'fixture-hello', status: 'uncertain' }] })
  await expect(app.window.getByTestId('agent-queue-toggle')).toBeDisabled()
  expect(await prompts()).toHaveLength(1)
  await app.window.screenshot({ path: testInfo.outputPath('04-restored-queue-quarantines-uncertain-delivery.png'), fullPage: true })
  await app.window.getByTestId(`agent-queue-cancel-${restored.queue!.items[0].clientMessageId}`).click()
  await expect.poll(async () => (await snapshot())?.queue?.items.length).toBe(0)
  expect(await prompts()).toHaveLength(1)
  expect((await app.transcript()).filter(item => item.event === 'app-server-start')).toHaveLength(1)
})
