import { mkdir, writeFile } from 'node:fs/promises'
import { test, expect } from './fixtures'

test.use({ providerFixture: 'agy-headless' })

test('Legacy Work chats keep task-specific Open and Recent tabs, recover a denied tool, and retain history and drafts after full Quit', async ({ app }, testInfo) => {
  test.setTimeout(150_000)
  // Seed the supported pre-v1 creation contract, as in work-mode.spec.ts.
  // New Work creation is covered through its form in work-flows.spec.ts.
  // Tabs, navigation, every send and full Quit still use the ordinary UI.
  await mkdir(testInfo.outputPath('profile', 'Work'))
  const composer = () => app.window.getByTestId('composer-input')
  const feed = () => app.window.getByTestId('conversation-feed')
  const chats = () => app.window.locator('[data-testid^="central-tab-chat-"]')
  const snapshot = (taskId: string, chatId: string) => app.window.evaluate(identity => window.ziafAPI.agentSessions.attach(identity), { taskId, chatId })
  const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt')
  const starts = async () => (await app.transcript()).filter(entry => entry.event === 'provider-start')
  const createWork = async (name: string) => {
    await app.window.getByRole('button', { name: 'New task', exact: true }).first().click()
    const created = await app.window.evaluate(title => window.ziafAPI.createTask({
      name: title, description: title,
      repoId: 'work-folder', branchType: 'Folder', branchName: 'Work',
      model: 'E2E Antigravity', workflow: 'Draft & Document',
    }), name)
    expect(created.workFlowVersion).toBeUndefined()
    await app.window.reload()
    await app.window.getByRole('button', { name, exact: true }).click()
    await expect(app.window.getByTestId('structured-antigravity-chat')).toBeVisible()
    await expect(composer()).toHaveValue(name)
    await expect(chats()).toHaveCount(1)
    const task = await app.window.evaluate(async title => (await window.ziafAPI.getTasks()).find(item => item.name === title), name)
    expect(task).toMatchObject({ mode: 'work', branchType: 'Folder', agentProvider: 'antigravity', workflow: 'Draft & Document' })
    return task!
  }
  const newChat = async () => {
    await app.window.getByTestId('btn-new-chat').click()
    await expect(chats()).toHaveCount(2)
    await expect(composer()).toHaveValue('')
    const ids = await chats().evaluateAll(tabs => tabs.map(tab => tab.getAttribute('data-testid')!))
    const id = ids.find(value => value !== 'central-tab-chat-main')!.replace('central-tab-', '')
    return { id, title: (await app.window.getByTestId(`central-tab-${id}`).innerText()).trim() }
  }
  const send = async (text: string, count: number) => {
    await composer().fill(text)
    await expect(app.window.getByTestId('composer-send-button')).toBeEnabled()
    await app.window.getByTestId('composer-send-button').click()
    // Cold provider startup and durable journal writes reached the 15s polling
    // boundary in retained evidence; still require exactly one recorded send.
    await expect.poll(async () => (await prompts()).length, { timeout: 40_000 }).toBe(count)
  }
  const openTask = (name: string) => app.window.getByRole('button', { name, exact: true }).click()
  const history = async () => {
    await app.window.getByTestId('chat-history-button').click()
    const dropdown = app.window.getByTestId('chat-history-dropdown')
    await expect(dropdown).toBeVisible()
    await expect(dropdown).toBeInViewport({ ratio: 1 })
    return dropdown
  }

  const taskA = await createWork('Work chat isolation A')
  if (!await app.window.getByTestId('executable-plan').isVisible()) await app.window.getByTestId('tab-btn-todo').click()
  await app.window.getByTestId('workflow-review').uncheck()
  await expect(app.window.getByTestId('workflow-start')).toBeDisabled()
  await expect(app.window.getByTestId('workflow-start-requirements')).toContainText('Add a verification command to each step, or enable independent review')
  const plan = await app.window.evaluate(taskId => window.ziafAPI.workflows.get({ taskId }), taskA.id)
  expect(plan?.status).toBe('draft')
  expect(plan?.steps.every(step => step.attempts.length === 0)).toBe(true)
  await app.window.getByRole('button', { name: 'Close plan', exact: true }).click()
  const chatA = await newChat()
  expect(await starts(), 'Task creation and opening an empty tab do not start a provider').toHaveLength(0)
  await send('fixture-denied-tool', 1)
  await expect.poll(async () => (await snapshot(taskA.id, chatA.id))?.lastTurn?.status).toBe('failed')
  const denied = (await snapshot(taskA.id, chatA.id))!
  expect(denied).toMatchObject({ taskId: taskA.id, chatId: chatA.id, sessionStatus: 'ready', permissions: 'CLI settings' })
  expect(denied.activeTurn).toBeUndefined()
  expect(denied.feed.flatMap(message => message.tools || [])).toEqual([
    expect.objectContaining({ toolName: 'run_command', status: 'error', output: 'permission check failed: user denied permission to run command' }),
  ])
  const structured = app.window.getByTestId('structured-antigravity-chat')
  await expect(structured.getByRole('alert')).toContainText('Antigravity denied a required tool action.')
  await expect(structured.getByRole('alert')).toContainText('Review permissions in Composer options or native CLI settings')
  await expect(app.window.getByTestId('agent-session-status')).toHaveText('Request failed')
  const tool = feed().locator('[data-testid^="tool-item-"]')
  await expect(tool).toContainText('Error')
  await tool.getByRole('button', { name: 'Output', exact: true }).click()
  await expect(tool.locator('pre')).toHaveText('permission check failed: user denied permission to run command')
  await expect(app.window.getByTestId('composer-stop-button')).toHaveCount(0)
  await expect(app.window.getByTestId('agent-session-resume')).toHaveCount(0)
  await app.window.screenshot({ path: testInfo.outputPath('01-work-denied-tool-visible.png'), fullPage: true })
  await composer().fill('fixture-followup')
  expect(await prompts(), 'Inspecting a denial never retries the request or sends the new draft').toHaveLength(1)
  await app.window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await snapshot(taskA.id, chatA.id))?.lastTurn?.status).toBe('completed')
  await expect(structured.getByRole('alert')).toHaveCount(0)
  await expect(feed()).toContainText('Antigravity fixture remembers this conversation. 🌍')
  const firstPrompts = await prompts()
  expect(firstPrompts.map(entry => entry.text)).toEqual(['fixture-denied-tool', 'fixture-followup'])
  expect(firstPrompts[1]).toMatchObject({ pid: firstPrompts[0].pid, conversationId: firstPrompts[0].conversationId })
  expect((await snapshot(taskA.id, chatA.id))!.permissions).toBe('CLI settings')
  const draftA = 'Unsent notes belonging only to task A'
  await composer().fill(draftA)

  const taskB = await createWork('Work chat isolation B')
  await expect(app.window.getByTestId(`central-tab-${chatA.id}`)).toHaveCount(0)
  const chatB = await newChat()
  expect(chatB.id).not.toBe(chatA.id)
  await send('fixture-switch', 3)
  await expect.poll(async () => (await snapshot(taskB.id, chatB.id))?.lastTurn?.status).toBe('completed')
  await expect(feed()).toContainText('Antigravity fixture switched with preserved history. 🌍')
  await expect(feed()).not.toContainText('fixture-denied-tool')
  const draftB = 'Unsent notes belonging only to task B'
  await composer().fill(draftB)

  await openTask(taskA.name)
  await expect(chats()).toHaveCount(2)
  await expect(app.window.getByTestId(`central-tab-${chatB.id}`)).toHaveCount(0)
  await expect(composer()).toHaveValue(draftA)
  await expect(feed()).toContainText('fixture-denied-tool')
  await expect(feed()).not.toContainText('fixture-switch')
  await app.window.getByTestId(`close-tab-${chatA.id}`).click()
  await expect(chats()).toHaveCount(1)
  await expect(composer()).toHaveValue(taskA.name)
  const recentA = await history()
  await expect(recentA.getByTestId('open-chat-chat-main')).toBeVisible()
  await expect(recentA.getByTestId(`recent-chat-${chatA.id}`)).toBeVisible()
  await expect(recentA.getByTestId(`recent-chat-${chatB.id}`)).toHaveCount(0)
  await app.window.screenshot({ path: testInfo.outputPath('02-task-scoped-open-and-recent.png'), fullPage: true })
  await recentA.getByTestId('chat-history-search').fill('no matching chat')
  await expect(recentA.locator('[data-testid^="open-chat-"], [data-testid^="recent-chat-"]')).toHaveCount(0)
  await recentA.getByTestId('chat-history-search').fill(chatA.title)
  await expect(recentA.getByTestId('open-chat-chat-main')).toHaveCount(0)
  await recentA.getByTestId(`recent-chat-${chatA.id}`).click()
  await expect(composer()).toHaveValue(draftA)
  expect((await snapshot(taskA.id, chatA.id))!.runId).toBe(denied.runId)

  await openTask(taskB.name)
  await expect(composer()).toHaveValue(draftB)
  const openB = await history()
  await expect(openB.getByTestId(`open-chat-${chatB.id}`)).toBeVisible()
  await expect(openB.getByTestId(`open-chat-${chatA.id}`)).toHaveCount(0)
  await openB.getByTestId('chat-history-search').fill('Discussion')
  await expect(openB.getByTestId(`open-chat-${chatB.id}`)).toHaveCount(0)
  await openB.getByTestId('open-chat-chat-main').click()
  await expect(composer()).toHaveValue(taskB.name)
  const closeB = await history()
  await closeB.getByTestId('chat-history-close-all').click()
  await expect(chats()).toHaveCount(1)
  await expect(app.window.getByTestId('central-tab-chat-main')).toBeVisible()

  const beforeA = (await snapshot(taskA.id, chatA.id))!
  const beforeB = (await snapshot(taskB.id, chatB.id))!
  expect(beforeA.sessionId).not.toBe(beforeB.sessionId)
  expect(await snapshot(taskA.id, 'chat-main')).toBeNull()
  expect(await snapshot(taskB.id, 'chat-main')).toBeNull()
  expect(await starts()).toHaveLength(2)
  await app.restart()
  await openTask(taskA.name)
  await expect(chats()).toHaveCount(2)
  await expect(composer()).toHaveValue(draftA)
  await expect(feed().locator('[data-testid^="user-message-"]')).toHaveCount(2)
  await expect(feed()).not.toContainText('fixture-switch')
  const restoredA = (await snapshot(taskA.id, chatA.id))!
  expect(restoredA.feed).toEqual(beforeA.feed)
  expect(restoredA.sessionId).toBe(beforeA.sessionId)
  await expect(app.window.getByTestId('agent-session-resume')).toBeVisible()

  await openTask(taskB.name)
  await expect(chats()).toHaveCount(1)
  await expect(composer()).toHaveValue(taskB.name)
  const restoredRecent = await history()
  await expect(restoredRecent.getByTestId(`recent-chat-${chatA.id}`)).toHaveCount(0)
  await restoredRecent.getByTestId('chat-history-search').fill(chatB.title)
  await restoredRecent.getByTestId(`recent-chat-${chatB.id}`).click()
  await expect(composer()).toHaveValue(draftB)
  await expect(feed().locator('[data-testid^="user-message-"]')).toHaveCount(1)
  await expect(feed()).not.toContainText('fixture-denied-tool')
  const restoredB = (await snapshot(taskB.id, chatB.id))!
  expect(restoredB.feed).toEqual(beforeB.feed)
  expect(restoredB.sessionId).toBe(beforeB.sessionId)
  await expect(app.window.getByTestId('agent-session-resume')).toBeVisible()
  await app.window.screenshot({ path: testInfo.outputPath('03-restarted-task-B-history-and-draft.png'), fullPage: true })

  const transcript = await app.transcript()
  expect((await prompts()).map(entry => entry.text)).toEqual(['fixture-denied-tool', 'fixture-followup', 'fixture-switch'])
  const launches = await starts()
  expect(launches, 'Navigation, recent-chat reopen and full restart never auto-send or start native processes').toHaveLength(2)
  expect(launches.map(entry => entry.cwd)).toEqual([taskA.worktreePath, taskB.worktreePath])
  expect(launches.every(entry => entry.args?.includes('--sandbox'))).toBe(true)
  expect(transcript.filter(entry => entry.event === 'denied-tool')).toHaveLength(1)
  expect(transcript.filter(entry => ['invalid-launch', 'invalid-resume', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  await writeFile(testInfo.outputPath('work-chat-isolation.json'), JSON.stringify({
    tasks: [taskA.id, taskB.id], chats: [chatA, chatB],
    sessions: [beforeA.sessionId, beforeB.sessionId],
    denial: { status: denied.lastTurn?.status, error: denied.lastTurn?.error, permissions: denied.permissions },
    prompts: await prompts(), launches,
    restored: [{ taskId: taskA.id, chatId: chatA.id, historyMessages: restoredA.feed.length, draft: draftA }, { taskId: taskB.id, chatId: chatB.id, historyMessages: restoredB.feed.length, draft: draftB }],
  }, null, 2))
})
