import { mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { test, expect } from './fixtures'

test.use({ providerFixture: 'codex' })
test('damaged settings block execution and restore only a chosen validated backup while preserving damage', async ({ app }, testInfo) => {
  const filename = path.join(testInfo.outputPath('profile'), 'user-data', 'settings.json')
  const { window } = app
  const settings = await window.evaluate(async () => {
    const value = await globalThis.window.ziafAPI.getSettings()
    await globalThis.window.ziafAPI.saveSettings(value)
    return value
  })
  const saved = await readFile(filename)
  const backupId = createHash('sha256').update(saved).digest('hex')
  const damaged = Buffer.from('{"uiLanguage":')
  await writeFile(filename, damaged)
  await window.reload()
  await expect(window.getByTestId('recovery-panel')).toBeVisible()
  await expect(window.getByTestId('recovery-restore')).toBeDisabled()
  await expect(window.evaluate(() => globalThis.window.ziafAPI.agentSessions.create({ taskId: 'task-e2e', chatId: 'chat-main', presetName: 'E2E Codex' }))).rejects.toThrow(/Saved data is damaged/)
  await expect(window.evaluate(value => globalThis.window.ziafAPI.saveSettings(value), settings)).rejects.toThrow(/Saved data is damaged/)
  expect(await readFile(filename)).toEqual(damaged)
  expect((await app.transcript()).filter(entry => entry.event === 'app-server-start')).toHaveLength(0)
  await window.screenshot({ path: testInfo.outputPath('01-damaged-settings-blocked.png'), fullPage: true })

  await window.getByTestId('recovery-backup').selectOption(backupId)
  await window.getByTestId('recovery-restore').click()
  await expect(window.getByTestId('recovery-panel')).toBeHidden()
  expect(await readFile(filename)).toEqual(saved)
  const damagedId = createHash('sha256').update(damaged).digest('hex')
  expect(await readFile(path.join(`${filename}.recovery`, `${damagedId}.damaged`))).toEqual(damaged)
  expect(await window.evaluate(() => globalThis.window.ziafAPI.getSettings())).toEqual(settings)
  await window.screenshot({ path: testInfo.outputPath('02-settings-recovered.png'), fullPage: true })
})

test('damaged session metadata is recovered after full Quit without losing history, native identity or the unsent draft', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const identity = { taskId: 'task-e2e', chatId: 'chat-main' }
  const open = () => app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const snapshot = () => app.window.evaluate(request => globalThis.window.ziafAPI.agentSessions.attach(request), identity)
  const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt')
  const starts = async () => (await app.transcript()).filter(entry => entry.event === 'app-server-start')
  const screenshot = async (name: string) => {
    const filename = testInfo.outputPath(`${name}.png`)
    await app.window.screenshot({ path: filename, fullPage: true })
    await testInfo.attach(name, { path: filename, contentType: 'image/png' })
  }

  await open()
  await app.window.getByTestId('composer-input').fill('fixture-hello')
  await app.window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  expect(await prompts()).toHaveLength(1)
  const before = (await snapshot())!
  const firstPrompt = (await prompts())[0]
  const runDirectory = path.join(testInfo.outputPath('profile'), 'user-data', 'agent-sessions', 'artifacts', 'worktrees', identity.taskId, 'runs', before.runId)
  const filename = path.join(runDirectory, 'session.json')
  const saved = await readFile(filename)
  const backupId = createHash('sha256').update(saved).digest('hex')
  expect(await readFile(path.join(`${filename}.recovery`, `${backupId}.json`))).toEqual(saved)
  const nativeReference = await readFile(path.join(runDirectory, 'provider.json'))
  expect(JSON.parse(nativeReference.toString('utf8'))).toMatchObject({ provider: 'codex', id: firstPrompt.threadId })
  await app.window.getByTestId('composer-input').fill('fixture-after-stop')
  await expect(app.window.getByTestId('composer-input')).toHaveValue('fixture-after-stop')
  await screenshot('01-session-history-and-unsent-draft')

  // The fixture restart performs production Quit before launching the new app.
  // Session metadata is immutable during Quit; the journal drains separately.
  // Corrupt only this completed run, then verify the exact damage survives Quit.
  const damaged = Buffer.from('{"version":1,"taskId":')
  await writeFile(filename, damaged)
  const electronPid = app.electronApp.process().pid
  await app.restart()
  expect(app.electronApp.process().pid).not.toBe(electronPid)
  expect(await readFile(filename)).toEqual(damaged)
  await expect(app.window.getByTestId('recovery-panel')).toBeVisible()
  await expect(app.window.getByTestId('recovery-panel')).toContainText('session')
  const documents = await app.window.evaluate(() => globalThis.window.ziafAPI.recovery.list())
  const target = { domain: 'session', taskId: identity.taskId, runId: before.runId }
  expect(documents).toEqual(expect.arrayContaining([expect.objectContaining({ target, state: 'corrupt', fingerprint: createHash('sha256').update(damaged).digest('hex'), backups: expect.arrayContaining([expect.objectContaining({ id: backupId })]) })]))
  const document = documents.find(item => item.target.domain === 'session' && item.target.taskId === identity.taskId && item.target.runId === before.runId)!
  if (await app.window.getByTestId('recovery-document').count()) await app.window.getByTestId('recovery-document').selectOption(JSON.stringify(document.target))
  await expect(app.window.getByTestId('recovery-restore')).toBeDisabled()
  await expect(snapshot(), 'A corrupt persisted session must fail visibly instead of becoming an empty new chat').rejects.toThrow(/damaged|recover/i)
  await expect(app.window.evaluate(request => globalThis.window.ziafAPI.agentSessions.create(request), { ...identity, presetName: 'E2E Codex' })).rejects.toThrow(/damaged|recover/i)
  expect(await starts()).toHaveLength(1)
  expect(await prompts()).toHaveLength(1)
  expect(await readFile(filename)).toEqual(damaged)
  await screenshot('02-session-corruption-visible-before-attach')

  await app.window.getByTestId('recovery-backup').selectOption(backupId)
  await app.window.getByTestId('recovery-restore').click()
  await expect(app.window.getByTestId('recovery-panel')).toBeHidden()
  expect(await readFile(filename)).toEqual(saved)
  const damagedId = createHash('sha256').update(damaged).digest('hex')
  expect(await readFile(path.join(`${filename}.recovery`, `${damagedId}.damaged`))).toEqual(damaged)
  expect(await readFile(path.join(runDirectory, 'provider.json'))).toEqual(nativeReference)
  await open()
  await expect(app.window.getByTestId('composer-input')).toHaveValue('fixture-after-stop')
  await expect(app.window.getByTestId('composer-send-button')).toBeDisabled()
  await expect(app.window.getByTestId('agent-session-resume')).toBeVisible()
  const restored = (await snapshot())!
  expect(restored).toMatchObject({ sessionId: before.sessionId, runId: before.runId, resumeAvailable: true, sessionStatus: 'disconnected' })
  expect(restored.feed).toEqual(before.feed)
  await expect(app.window.getByTestId('conversation-feed').locator('[data-testid^="user-message-"]')).toHaveCount(1)
  await expect(app.window.getByTestId('conversation-feed').locator('[data-testid^="assistant-message-"]')).toContainText('Codex fixture hello. 🌍')
  expect(await starts(), 'Restoration and attaching history do not launch a provider').toHaveLength(1)
  expect(await prompts(), 'Recovery does not replay old input or send the draft').toHaveLength(1)
  await screenshot('03-session-restored-with-explicit-resume')

  await app.window.getByTestId('agent-session-resume').click()
  await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
  const resumed = (await snapshot())!
  expect(resumed.sessionId).toBe(before.sessionId)
  expect(resumed.runId).not.toBe(before.runId)
  expect(await starts()).toHaveLength(2)
  expect(await prompts(), 'Resume itself leaves the draft unsent').toHaveLength(1)
  await expect(app.window.getByTestId('composer-input')).toHaveValue('fixture-after-stop')
  await app.window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await prompts()).length).toBe(2)
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  const secondPrompt = (await prompts())[1]
  expect(secondPrompt.pid).not.toBe(firstPrompt.pid)
  expect(secondPrompt.threadId).toBe(firstPrompt.threadId)
  expect(secondPrompt.text).toBe('fixture-after-stop')
  await expect(app.window.getByTestId('conversation-feed').locator('[data-testid^="user-message-"]')).toHaveCount(2)
  await expect(app.window.getByTestId('conversation-feed').locator('[data-testid^="assistant-message-"]')).toHaveCount(2)
  await expect(app.window.getByTestId('conversation-feed').locator('[data-testid^="assistant-message-"]').last()).toBeInViewport({ ratio: 1 })
  await screenshot('04-recovered-native-thread-continues')
  const transcript = await app.transcript()
  expect(transcript.filter(entry => entry.event === 'session-resume')).toHaveLength(1)
  expect(transcript.filter(entry => ['invalid-launch', 'invalid-resume', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  await testInfo.attach('session-recovery-receipt.json', { body: JSON.stringify({ target, backupId, damagedId, originalSession: { sessionId: before.sessionId, runId: before.runId }, resumedSession: { sessionId: resumed.sessionId, runId: resumed.runId }, originalPid: firstPrompt.pid, resumedPid: secondPrompt.pid, originalThread: firstPrompt.threadId, resumedThread: secondPrompt.threadId, promptCount: (await prompts()).length }, null, 2), contentType: 'application/json' })
})


test('an unsafe session directory does not hide another document that can be recovered', async ({ app }, testInfo) => {
  const userData = testInfo.outputPath('profile/user-data')
  const settingsFile = path.join(userData, 'settings.json')
  await app.window.evaluate(async () => {
    const settings = await globalThis.window.ziafAPI.getSettings()
    await globalThis.window.ziafAPI.saveSettings(settings)
  })
  const saved = await readFile(settingsFile)
  const backupId = createHash('sha256').update(saved).digest('hex')
  const runs = path.join(userData, 'agent-sessions/artifacts/worktrees/task-e2e/runs')
  await mkdir(runs, { recursive: true })
  const unsafe = path.join(runs, 'unsafe-run')
  await symlink(testInfo.outputPath('profile'), unsafe, 'dir')
  await writeFile(settingsFile, '{"uiLanguage":')
  await app.window.reload()
  await expect(app.window.getByTestId('recovery-panel')).toBeVisible()
  const reports = await app.window.evaluate(() => globalThis.window.ziafAPI.recovery.list())
  expect(reports).toEqual(expect.arrayContaining([
    expect.objectContaining({ target: { domain: 'settings' }, state: 'corrupt' }),
    expect.objectContaining({ target: { domain: 'session-index', taskId: 'task-e2e' }, state: 'unavailable' }),
  ]))
  await app.window.getByTestId('recovery-document').selectOption(JSON.stringify({ domain: 'settings' }))
  await app.window.getByTestId('recovery-backup').selectOption(backupId)
  await app.window.getByTestId('recovery-restore').click()
  await expect.poll(() => readFile(settingsFile, 'utf8')).toBe(saved.toString('utf8'))
  await expect(app.window.getByTestId('recovery-panel')).toContainText('session-index')
  expect((await app.transcript()).filter(entry => entry.event === 'app-server-start')).toHaveLength(0)
  await app.window.screenshot({ path: testInfo.outputPath('unsafe-session-index-does-not-hide-settings.png'), fullPage: true })
  await unlink(unsafe)
  await app.window.getByTestId('recovery-refresh').click()
  await expect(app.window.getByTestId('recovery-panel')).toBeHidden()
})
