import { test, expect } from './fixtures'

test.use({ providerFixture: 'codex' })

test('Codex app-server reaches the UI with approval, same-session interruption and journal replay', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const { window } = app
  const feed = window.getByTestId('conversation-feed')
  const composer = window.getByTestId('composer-input')
  const stop = window.getByTestId('composer-stop-button')
  const openTask = () => window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const snapshot = () => window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
  const screenshot = async (name: string) => {
    const filename = testInfo.outputPath(`${name}.png`)
    await window.screenshot({ path: filename, fullPage: true })
    await testInfo.attach(name, { path: filename, contentType: 'image/png' })
  }
  const prompts = async (text: string) => (await app.transcript()).filter(entry => entry.event === 'prompt' && entry.text === text)
  const send = async (text: string) => {
    await composer.fill(text)
    await window.getByTestId('composer-send-button').click()
    await expect.poll(async () => (await prompts(text)).length, { message: `The app-server receives ${text} exactly once` }).toBe(1)
  }
  const userRows = (text: string) => feed.locator('[data-testid^="user-message-"]').filter({ hasText: text })
  const assistantRows = (text: string) => feed.locator('[data-testid^="assistant-message-"]').filter({ hasText: text })

  await openTask()
  await expect(composer).toBeVisible()
  await expect(stop).toHaveCount(0)
  expect((await app.transcript()).filter(entry => entry.event === 'app-server-start')).toHaveLength(0)
  await screenshot('01-codex-idle')

  await send('fixture-approval')
  const firstPrompt = (await prompts('fixture-approval'))[0]
  const pid = firstPrompt.pid
  const threadId = firstPrompt.threadId
  const firstTurnId = firstPrompt.turnId!
  const first = await snapshot()
  expect(first).not.toBeNull()
  const sessionRef = { sessionId: first!.sessionId, runId: first!.runId }
  const approval = feed.locator('[data-testid^="approval-card-"]').filter({ hasText: 'Fixture command needs your decision' })
  await expect(approval).toHaveCount(1)
  await expect(approval.locator('[data-testid^="approval-allow-"]')).toBeVisible()
  await expect(userRows('fixture-approval')).toHaveCount(1)
  await expect.poll(async () => (await snapshot())?.activeTurn?.status).toBe('waiting_for_approval')
  await screenshot('02-codex-pending-approval')

  // Reload destroys the renderer document: this must rebuild from backend state.
  await window.reload()
  await openTask()
  await expect(approval).toHaveCount(1)
  await expect(approval.locator('[data-testid^="approval-allow-"]')).toBeVisible()
  await expect(userRows('fixture-approval')).toHaveCount(1)
  const pendingReplay = await snapshot()
  expect({ sessionId: pendingReplay!.sessionId, runId: pendingReplay!.runId }).toEqual(sessionRef)
  expect(pendingReplay!.pendingApprovals).toHaveLength(1)
  expect((await app.transcript()).filter(entry => entry.event === 'app-server-start')).toHaveLength(1)
  await screenshot('03-codex-pending-replayed')

  await approval.locator('[data-testid^="approval-allow-"]').click()
  await expect.poll(async () => (await app.transcript()).filter(entry => entry.event === 'approval-response' && entry.decision === 'accept').length).toBe(1)
  await expect(assistantRows('Codex fixture approved: Привет 🌍')).toHaveCount(1)
  const tool = feed.getByTestId(`tool-item-${firstTurnId}-command`)
  await expect(tool).toContainText('command_exec')
  await tool.getByRole('button', { name: 'Output', exact: true }).click()
  await expect(tool.locator('pre')).toHaveText('fixture-tool-output\n')
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  await expect(stop).toHaveCount(0)
  await expect(feed).not.toContainText('FIXTURE_DIAGNOSTIC_ONLY')
  await screenshot('04-codex-approved-tool-completed')

  await send('fixture-interrupt')
  const longPrompt = (await prompts('fixture-interrupt'))[0]
  expect(longPrompt.pid).toBe(pid)
  expect(longPrompt.threadId).toBe(threadId)
  await expect(stop).toBeVisible()
  await expect(assistantRows('Codex fixture is still generating.')).toHaveCount(1)
  if (process.platform === 'darwin') {
    await app.electronApp.evaluate(({ BrowserWindow, app }) => {
      BrowserWindow.getAllWindows().find(candidate => candidate.isVisible())!.close()
      app.emit('activate')
    })
    await expect.poll(() => app.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(candidate => candidate.isVisible()))).toBe(true)
    await expect(stop).toBeVisible()
    expect((await app.transcript()).filter(entry => entry.event === 'app-server-start')).toHaveLength(1)
  }
  await screenshot('05-codex-generating-reopened')
  await stop.click()
  await expect.poll(async () => (await app.transcript()).filter(entry => entry.event === 'interrupt-ack').length).toBe(1)
  await expect.poll(async () => (await snapshot())?.activeTurn?.status).toBe('interrupting')
  // Acknowledgement must not release the next send; only turn/completed can do so.
  const interruptedPending = await snapshot()
  expect(interruptedPending!.activeTurn!.turnId).toBe(longPrompt.turnId)
  expect(interruptedPending!.sessionStatus).toBe('ready')
  expect((await app.transcript()).filter(entry => entry.event === 'signal')).toHaveLength(0)
  await composer.fill('fixture-after-stop')
  await expect(window.getByTestId('composer-send-button')).toBeDisabled()
  expect(await prompts('fixture-after-stop')).toHaveLength(0)
  await screenshot('06-codex-interrupt-ack-still-busy')

  await app.releaseCodex('finish-interrupt')
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('interrupted')
  await expect(stop).toHaveCount(0)
  // The draft entered during interrupt is preserved for the next actual send.
  await expect(composer).toHaveValue('fixture-after-stop')
  await window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await prompts('fixture-after-stop')).length).toBe(1)
  const lastPrompt = (await prompts('fixture-after-stop'))[0]
  expect(lastPrompt.pid).toBe(pid)
  expect(lastPrompt.threadId).toBe(threadId)
  await expect(assistantRows('Codex fixture resumed on the same session. 🌍')).toHaveCount(1)
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  await expect(stop).toHaveCount(0)
  await expect(assistantRows('Codex fixture resumed on the same session. 🌍')).toBeInViewport({ ratio: 1 })
  await screenshot('07-codex-next-turn-same-session')

  await window.reload()
  await openTask()
  await expect(assistantRows('Codex fixture approved: Привет 🌍')).toHaveCount(1)
  await expect(assistantRows('Codex fixture resumed on the same session. 🌍')).toHaveCount(1)
  for (const text of ['fixture-approval', 'fixture-interrupt', 'fixture-after-stop']) await expect(userRows(text)).toHaveCount(1)
  await expect(feed.locator('[data-testid^="approval-card-"]')).toHaveCount(1)
  await expect(feed.locator('[data-testid^="approval-allow-"]')).toHaveCount(0)
  await expect(stop).toHaveCount(0)
  const replay = await snapshot()
  expect({ sessionId: replay!.sessionId, runId: replay!.runId }).toEqual(sessionRef)
  expect(replay!.sessionStatus).toBe('ready')
  expect(replay!.activeTurn).toBeUndefined()
  expect(replay!.pendingApprovals).toHaveLength(0)
  await expect(assistantRows('Codex fixture resumed on the same session. 🌍')).toBeInViewport({ ratio: 1 })
  await screenshot('08-codex-completed-history-replayed')

  const transcript = await app.transcript()
  const starts = transcript.filter(entry => entry.event === 'app-server-start')
  expect(starts).toHaveLength(1)
  expect(starts[0].args).toEqual(['app-server', '--listen', 'stdio://'])
  const incoming = transcript.filter(entry => entry.event === 'rpc-in' && entry.pid === pid)
  const catalogPids = new Set(transcript.filter(entry => entry.event === 'model-discovery-start').map(entry => entry.pid))
  expect(transcript.filter(entry => catalogPids.has(entry.pid) &&
    (entry.event === 'prompt' || entry.event === 'rpc-in' && entry.rpc?.method === 'turn/start'))).toEqual([])
  for (const method of ['initialize', 'initialized', 'thread/start', 'turn/interrupt']) {
    expect(incoming.filter(entry => entry.rpc?.method === method), method).toHaveLength(1)
  }
  expect(incoming.filter(entry => entry.rpc?.method === 'turn/start')).toHaveLength(3)
  const threadStart = incoming.find(entry => entry.rpc?.method === 'thread/start')!.rpc!.params!
  expect(threadStart.cwd).toBe(starts[0].cwd)
  expect(threadStart.model).toBe('gpt-fixture')
  expect(threadStart.sandbox).toBe('read-only')
  expect(threadStart.approvalPolicy).toBe('on-request')
  expect(transcript.filter(entry => entry.event === 'invalid-launch' || entry.event === 'protocol-error')).toEqual([])
  await testInfo.attach('codex-session-snapshot.json', { body: JSON.stringify(replay, null, 2), contentType: 'application/json' })
})

test('Codex launch uses saved configuration and the renderer keeps its navigation boundary', async ({ app }) => {
  const { window } = app
  await expect(window.evaluate(() => globalThis.window.ziafAPI.agentSessions.create({
    taskId: 'task-e2e', chatId: 'chat-security', presetName: 'E2E Codex', cwd: '/tmp',
  } as Parameters<typeof globalThis.window.ziafAPI.agentSessions.create>[0]))).rejects.toThrow()
  await expect(window.evaluate(() => globalThis.window.ziafAPI.agentSessions.create({
    taskId: 'task-e2e', chatId: 'chat-security', presetName: 'Unknown E2E Preset',
  }))).rejects.toThrow(/preset/i)
  await expect(window.evaluate(() => globalThis.window.ziafAPI.openExternal('file:///tmp/ziaforge-fixture-disallowed'))).rejects.toThrow()
  expect((await app.transcript()).filter(entry => entry.event === 'app-server-start')).toHaveLength(0)

  // Child frames must not get the privileged preload bridge. The main-process
  // sender validation itself also has direct contract tests with subframe senders.
  await window.evaluate(() => {
    const frame = document.createElement('iframe')
    frame.id = 'fixture-child-frame'
    frame.srcdoc = '<p>Unprivileged fixture frame</p>'
    document.body.append(frame)
  })
  const childFrame = await window.locator('#fixture-child-frame').elementHandle().then(element => element!.contentFrame())
  expect(childFrame).not.toBeNull()
  expect(await childFrame!.evaluate(() => typeof globalThis.window.ziafAPI)).toBe('undefined')
  await window.locator('#fixture-child-frame').evaluate(frame => frame.remove())

  const originalUrl = window.url()
  await window.evaluate(() => {
    Object.assign(window, { codexNavigationSentinel: 'same-renderer' })
    location.href = 'data:text/html,This-navigation-must-be-blocked'
  })
  await window.waitForTimeout(250)
  expect(window.url()).toBe(originalUrl)
  expect(await window.evaluate(() => (window as unknown as { codexNavigationSentinel?: string }).codexNavigationSentinel)).toBe('same-renderer')
  await expect(window.getByRole('button', { name: 'E2E Workspace', exact: true })).toBeVisible()
})

test('Code Start runs its workflow once and separate Codex chats survive closed tabs and changed presets', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const { window } = app
  const composer = window.getByTestId('composer-input')
  const feed = window.getByTestId('conversation-feed')
  const screenshot = async (name: string) => {
    const filename = testInfo.outputPath(`${name}.png`)
    await window.screenshot({ path: filename, fullPage: true })
    await testInfo.attach(name, { path: filename, contentType: 'image/png' })
  }
  const preparationPrefix = 'You are carrying out one preparation phase of a ZIAForge Code task.'
  const preparations = async () => (await app.transcript()).filter(entry => entry.event === 'code-flow-preparation')
  const starts = async () => {
    const transcript = await app.transcript()
    const workflowPids = new Set(transcript.filter(entry => entry.event === 'code-flow-preparation').map(entry => entry.pid))
    return transcript.filter(entry => entry.event === 'app-server-start' && !workflowPids.has(entry.pid))
  }
  const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt' && !entry.text?.startsWith(preparationPrefix))
  const openTask = () => window.getByRole('button', { name: 'fixture-hello', exact: true }).click()

  // Select the registered repository and preset in the actual creation form.
  await window.getByRole('button', { name: 'New task', exact: true }).first().click()
  const form = window.locator('form')
  await form.getByRole('button', { name: 'E2E Project', exact: true }).click()
  await form.getByRole('button', { name: 'E2E Project', exact: true }).last().click()
  await form.getByTestId('new-task-agent-preset').selectOption('E2E Codex')
  await form.getByPlaceholder('new-task-xxxx').fill('fixture-created-task')
  await form.locator('textarea').fill('fixture-hello')
  await form.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(window.getByTestId('code-dialogue')).toBeVisible()
  await expect(composer).toHaveValue('')
  await expect(window.getByTestId('composer-send-button')).toBeDisabled()
  const task = await window.evaluate(async () => (await globalThis.window.ziafAPI.getTasks()).find(candidate => candidate.name === 'fixture-hello'))
  expect(task).toMatchObject({ repoId: 'repo-e2e', model: 'E2E Codex', agentProvider: 'codex', description: 'fixture-hello', codeFlowVersion: 1 })
  const taskId = task!.id
  const snapshot = (chatId: string) => window.evaluate(args => globalThis.window.ziafAPI.agentSessions.attach(args), { taskId, chatId })
  await expect.poll(async () => (await window.evaluate(taskId => globalThis.window.ziafAPI.workflows.get({ taskId }), taskId))?.status).toBe('completed')
  expect(await preparations(), 'Code Start runs the actual answer-only preparation once').toHaveLength(1)
  expect(await starts(), 'Code Start does not also launch an ordinary chat').toHaveLength(0)
  expect(await prompts(), 'The initial description is not duplicated into an ordinary chat').toHaveLength(0)
  expect(await snapshot('chat-main')).toBeNull()
  await screenshot('01-code-start-completed-separate-chat-idle')
  // Forge's composer continues the workflow discussion. An ordinary send must
  // explicitly select the separate conversation whose isolation is under test.
  await window.getByTestId('central-tab-chat-main').click()
  await expect(window.getByTestId('structured-codex-chat')).toBeVisible()
  await composer.fill('fixture-hello')
  await window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await prompts()).length).toBe(1)
  await expect.poll(async () => (await snapshot('chat-main'))?.lastTurn?.status).toBe('completed')
  await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(1)
  await expect(feed.locator('[data-testid^="assistant-message-"]')).toContainText('Codex fixture hello. 🌍')
  expect((await prompts())[0].text).toBe('fixture-hello')
  const mainSnapshot = await snapshot('chat-main')
  await screenshot('02-new-task-first-send')

  const previousTabs = await window.locator('[data-testid^="central-tab-chat-"]').evaluateAll(tabs => tabs.map(tab => tab.getAttribute('data-testid')))
  await window.getByTestId('btn-new-chat').click()
  await expect(composer).toHaveValue('')
  const customTab = window.locator('[data-testid^="central-tab-chat-"]')
  await expect(customTab).toHaveCount(previousTabs.length + 1)
  const customTabId = (await customTab.evaluateAll(tabs => tabs.map(tab => tab.getAttribute('data-testid'))))
    .find(id => !previousTabs.includes(id))!.replace('central-tab-', '')
  expect(customTabId).not.toBe('chat-main')
  expect(await starts(), 'An empty custom chat stays idle').toHaveLength(1)
  await composer.fill('fixture-after-stop')
  await window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await prompts()).length).toBe(2)
  await expect.poll(async () => (await snapshot(customTabId))?.lastTurn?.status).toBe('completed')
  const customSnapshot = await snapshot(customTabId)
  const customPrompt = (await prompts())[1]
  expect(customPrompt.pid).not.toBe((await prompts())[0].pid)
  expect(customSnapshot!.sessionId).not.toBe(mainSnapshot!.sessionId)
  const sessionRef = { sessionId: customSnapshot!.sessionId, runId: customSnapshot!.runId }

  const closeCustomTab = async () => {
    await window.getByTestId(`close-tab-${customTabId}`).click()
    await expect(window.getByTestId(`central-tab-${customTabId}`)).toHaveCount(0)
    await expect.poll(() => window.evaluate(key => localStorage.getItem(key), `ziaf-recent-chats:${taskId}`)).toContain(customTabId)
  }
  const reopenCustomTab = async () => {
    await window.getByTestId('chat-history-button').click()
    await window.getByTestId(`recent-chat-${customTabId}`).click()
    await expect(window.getByTestId(`central-tab-${customTabId}`)).toBeVisible()
    await expect(window.getByTestId('structured-codex-chat')).toBeVisible()
    const replay = await snapshot(customTabId)
    expect({ sessionId: replay!.sessionId, runId: replay!.runId }).toEqual(sessionRef)
    expect(await starts()).toHaveLength(2)
    expect((await app.transcript()).filter(entry => entry.event === 'pty-shell-start'), 'Codex never falls back to a legacy PTY').toEqual([])
  }
  await closeCustomTab()
  await window.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await expect(window.getByTestId('structured-codex-chat')).toHaveCount(0)
  await openTask()
  await reopenCustomTab()
  await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(1)
  await expect(feed.locator('[data-testid^="assistant-message-"]')).toContainText('Codex fixture resumed on the same session. 🌍')
  await screenshot('03-custom-chat-reopened-after-settings')

  // Saved presets are controlled input here; all subsequent sends still use UI.
  // Changing/deleting the preset must not reinterpret an established task as PTY.
  for (const change of ['edit', 'delete'] as const) {
    await window.evaluate(async operation => {
      const presets = await globalThis.window.ziafAPI.getPresets()
      await globalThis.window.ziafAPI.savePresets(operation === 'delete'
        ? presets.filter(preset => preset.name !== 'E2E Codex')
        : presets.map(preset => preset.name === 'E2E Codex' ? { ...preset, agent: 'Google Antigravity', model: 'gemini-fixture' } : preset))
    }, change)
    await closeCustomTab()
    await window.reload()
    await openTask()
    await window.getByTestId('central-tab-chat-main').click()
    await expect(window.getByTestId('structured-codex-chat')).toBeVisible()
    await reopenCustomTab()
    const prompt = change === 'edit' ? 'fixture-hello' : 'fixture-after-stop'
    const expectedCount = change === 'edit' ? 3 : 4
    await composer.fill(prompt)
    await window.getByTestId('composer-send-button').click()
    await expect.poll(async () => (await prompts()).length).toBe(expectedCount)
    const received = await prompts()
    const latest = received[received.length - 1]
    await expect.poll(async () => (await snapshot(customTabId))?.lastTurn).toMatchObject({ turnId: latest.turnId, status: 'completed' })
    expect({ pid: latest.pid, threadId: latest.threadId }).toEqual({ pid: customPrompt.pid, threadId: customPrompt.threadId })
    await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(expectedCount - 1)
    await expect(feed.locator('[data-testid^="assistant-message-"]').last()).toContainText(change === 'edit' ? 'Codex fixture hello. 🌍' : 'Codex fixture resumed on the same session. 🌍')
    await expect(feed.locator('[data-testid^="assistant-message-"]').last()).toBeInViewport({ ratio: 1 })
    expect((await window.evaluate(() => globalThis.window.ziafAPI.getTasks())).find(candidate => candidate.id === taskId)?.agentProvider).toBe('codex')
    await screenshot(`04-preset-${change}-same-custom-session`)
  }
  const transcript = await app.transcript()
  expect(await starts()).toHaveLength(2)
  expect(await preparations()).toHaveLength(1)
  expect(transcript.filter(entry => entry.event === 'app-server-start')).toHaveLength(3)
  expect(transcript.filter(entry => entry.event === 'prompt')).toHaveLength(5)
  expect(transcript.filter(entry => ['pty-shell-start', 'invalid-launch', 'protocol-error'].includes(entry.event || ''))).toEqual([])
  const customRPCs = transcript.filter(entry => entry.pid === customPrompt.pid && entry.event === 'rpc-in')
  expect(customRPCs.filter(entry => entry.rpc?.method === 'thread/start')).toHaveLength(1)
  expect(customRPCs.filter(entry => entry.rpc?.method === 'turn/start')).toHaveLength(3)
  await testInfo.attach('created-task.json', { body: JSON.stringify(task, null, 2), contentType: 'application/json' })
  await testInfo.attach('reopened-custom-snapshot.json', { body: JSON.stringify(await snapshot(customTabId), null, 2), contentType: 'application/json' })
})
