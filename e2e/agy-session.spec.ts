import { test, expect } from './fixtures'
import { readFile, realpath, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

test.use({ providerFixture: 'agy-headless' })

test('Antigravity native stream preserves turns and resumes the conversation after Composer Stop', async ({ app }, testInfo) => {
  const { window } = app
  const composer = window.getByTestId('composer-input')
  const feed = window.getByTestId('conversation-feed')
  const openTask = () => window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const snapshot = () => window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
  const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt')
  const screenshot = async (name: string) => {
    const filename = testInfo.outputPath(`${name}.png`)
    await window.screenshot({ path: filename, fullPage: true })
    await testInfo.attach(name, { path: filename, contentType: 'image/png' })
  }
  const send = async (text: string, count: number) => {
    await composer.fill(text)
    await window.getByTestId('composer-send-button').click()
    await expect.poll(async () => (await prompts()).length).toBe(count)
  }
  await openTask()
  await expect(window.getByTestId('structured-antigravity-chat')).toBeVisible()
  expect((await app.transcript()).filter(entry => entry.event === 'provider-start')).toEqual([])
  await send('fixture-tools', 1)
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  await expect(feed).toContainText('Antigravity fixture: Привет 🌍')
  const tool = feed.locator('[data-testid^="tool-item-"]').filter({ hasText: 'view_file' })
  await tool.getByRole('button', { name: 'Output', exact: true }).click()
  await expect(tool.locator('pre')).toHaveText('fixture-file-content\n')
  const initial = await snapshot()
  expect(initial!.capabilities).toMatchObject({ interactiveApprovals: false, interruptTurn: true, attachments: false })
  const sessionRef = { sessionId: initial!.sessionId, runId: initial!.runId }
  const firstPrompt = (await prompts())[0]
  await screenshot('01-agy-tool-completed')

  await send('fixture-followup', 2)
  await expect(feed).toContainText('Antigravity fixture remembers this conversation. 🌍')
  await expect.poll(async () => (await snapshot())?.activeTurn).toBeUndefined()
  await window.reload()
  await openTask()
  await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(2)
  await expect(feed.locator('[data-testid^="assistant-message-"]').last()).toBeInViewport({ ratio: 1 })
  const replay = await snapshot()
  expect({ sessionId: replay!.sessionId, runId: replay!.runId }).toEqual(sessionRef)
  await expect(feed).not.toContainText('AGY_FIXTURE_DIAGNOSTIC_ONLY')
  await screenshot('02-agy-replayed-two-turns')

  await send('fixture-wait', 3)
  await expect(feed).toContainText('Antigravity fixture is working.')
  await expect(window.getByTestId('composer-stop-button')).toBeVisible()
  await expect(window.getByTestId('agent-session-terminate')).toHaveCount(0)
  await expect(window.getByTestId('composer-process-status')).toHaveAttribute('data-state', 'running')
  await screenshot('03-agy-native-stop')
  await composer.fill('fixture-followup')
  await window.getByTestId('composer-stop-button').click()
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('interrupted')
  await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
  await expect(composer).toHaveValue('fixture-followup')
  await expect(window.getByTestId('composer-send-button')).toBeEnabled()
  await expect.poll(() => { try { process.kill(firstPrompt.pid, 0); return true } catch { return false } }).toBe(false)
  await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(3)
  await window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await prompts()).length).toBe(4)
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  const afterStop = (await prompts())[3]
  expect(afterStop.pid).not.toBe(firstPrompt.pid)
  expect(afterStop.conversationId).toBe(firstPrompt.conversationId)
  const restored = (await snapshot())!
  expect({ sessionId: restored.sessionId, runId: restored.runId }).toEqual(sessionRef)
  await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(4)
  const transcript = await app.transcript()
  expect(transcript.filter(entry => entry.event === 'provider-start')).toHaveLength(2)
  for (const prompt of (await prompts()).slice(0, 3)) expect({ pid: prompt.pid, conversationId: prompt.conversationId }).toEqual({ pid: firstPrompt.pid, conversationId: firstPrompt.conversationId })
  expect(transcript.filter(entry => entry.event === 'signal')).toEqual([expect.objectContaining({ signal: 'SIGINT', pid: firstPrompt.pid })])
  expect(transcript.filter(entry => ['pty-shell-start', 'invalid-launch', 'protocol-error'].includes(entry.event || ''))).toEqual([])
  await screenshot('04-agy-next-turn-history-retained')
})

test('Antigravity rejects unenforceable read-only policy without sending or losing the draft', async ({ app }, testInfo) => {
  const { window } = app
  await window.evaluate(async () => {
    const presets = await globalThis.window.ziafAPI.getPresets()
    await globalThis.window.ziafAPI.savePresets(presets.map(preset => preset.name === 'E2E Antigravity' ? { ...preset, permissions: 'Read only' } : preset))
  })
  await window.reload()
  await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const composer = window.getByTestId('composer-input')
  await composer.fill('fixture-wait')
  await window.getByTestId('composer-send-button').click()
  await expect(window.getByRole('alert')).toBeVisible()
  await expect(composer).toHaveValue('fixture-wait')
  expect((await app.transcript()).filter(entry => ['provider-start', 'prompt', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  const failure = testInfo.outputPath('01-agy-policy-rejected-draft-retained.png')
  await window.screenshot({ path: failure, fullPage: true })
  await testInfo.attach('policy rejection', { path: failure, contentType: 'image/png' })
  await window.evaluate(async () => {
    const presets = await globalThis.window.ziafAPI.getPresets()
    await globalThis.window.ziafAPI.savePresets(presets.map(preset => preset.name === 'E2E Antigravity' ? { ...preset, permissions: 'CLI settings' } : preset))
  })
  await window.reload()
  await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  await expect(composer).toHaveValue('fixture-wait')
  expect((await app.transcript()).filter(entry => entry.event === 'prompt')).toEqual([])
  await window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await app.transcript()).filter(entry => entry.event === 'prompt').length).toBe(1)
  await expect(window.getByTestId('conversation-feed')).toContainText('Antigravity fixture is working.')
  // Deliberately leave the session busy: fixture teardown exercises production Quit.
})

test('Antigravity binds real relative tool operations to the task workspace before and after full Quit', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const workspace = await realpath(testInfo.outputPath('profile/project/worktrees/task-e2e'))
  const marker = 'TASK_WORKSPACE_MARKER_ONLY'
  await writeFile(path.join(workspace, 'workspace-marker.txt'), marker)
  const open = () => app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const snapshot = () => app.window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
  const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt')
  const prove = async (count: number) => {
    await app.window.getByTestId('composer-input').fill('fixture-workspace-proof')
    await app.window.getByTestId('composer-send-button').click()
    await expect.poll(async () => (await app.transcript()).filter(entry => entry.event === 'workspace-proof').length).toBe(count)
    await expect.poll(async () => (await snapshot())?.activeTurn).toBeUndefined()
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    const proof = (await app.transcript()).filter(entry => entry.event === 'workspace-proof').at(-1)!
    expect(proof).toMatchObject({ cwd: workspace, text: marker })
    const feed = app.window.getByTestId('conversation-feed')
    await expect(feed.locator('[data-testid^="assistant-message-"]').last()).toContainText(`Workspace proof: ${workspace}`)
    await expect(feed.locator('[data-testid^="assistant-message-"]').last()).toContainText(`Marker: ${marker}`)
    await expect(feed).not.toContainText('WRONG_DEFAULT_PROJECT')
    return proof
  }
  await open()
  const first = await prove(1)
  const original = (await snapshot())!
  await app.window.getByTestId('composer-input').fill('fixture-workspace-proof')
  await app.window.screenshot({ path: testInfo.outputPath('01-agy-native-workspace-proof.png'), fullPage: true })
  await app.restart()
  await open()
  await expect(app.window.getByTestId('composer-input')).toHaveValue('fixture-workspace-proof')
  await expect(app.window.getByTestId('agent-session-resume')).toBeVisible()
  expect(await prompts()).toHaveLength(1)
  await app.window.getByTestId('agent-session-resume').click()
  await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
  expect(await prompts(), 'Native Resume must not send the unsent workspace probe').toHaveLength(1)
  const second = await prove(2)
  expect(second.pid).not.toBe(first.pid)
  expect(second.conversationId).toBe(first.conversationId)
  expect((await snapshot())!.sessionId).toBe(original.sessionId)
  expect((await snapshot())!.runId).not.toBe(original.runId)
  const transcript = await app.transcript()
  const selections = transcript.filter(entry => entry.event === 'workspace-selection')
  expect(selections).toHaveLength(2)
  for (const selection of selections) {
    expect(selection.cwd).toBe(workspace)
    expect(selection.rpc?.params).toMatchObject({ spawnCwd: workspace, spawnPwd: workspace, nativeRoots: [workspace] })
  }
  const launches = transcript.filter(entry => entry.event === 'provider-start')
  expect(launches).toHaveLength(2)
  for (const launch of launches) {
    const index = launch.args!.indexOf('--add-dir')
    expect(index).toBeGreaterThanOrEqual(0)
    expect(launch.args!.slice(index, index + 2)).toEqual(['--add-dir', workspace])
  }
  expect(await readFile(testInfo.outputPath('profile/agy-default-workspace/workspace-marker.txt'), 'utf8')).toBe('WRONG_DEFAULT_PROJECT')
  expect(transcript.filter(entry => ['invalid-launch', 'invalid-resume', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  await app.window.screenshot({ path: testInfo.outputPath('02-agy-resumed-native-workspace-proof.png'), fullPage: true })
  await testInfo.attach('workspace-proof.json', { body: JSON.stringify({ expectedWorkspace: workspace, selections, proofs: [first, second] }, null, 2), contentType: 'application/json' })
})

for (const initCwd of ['missing', 'mismatched'] as const) {
  test(`Antigravity rejects ${initCwd} init cwd before user input and retains the draft`, async ({ app }, testInfo) => {
    await writeFile(testInfo.outputPath('profile/agy-workspace-fixture.json'), JSON.stringify({ initCwd }))
    const { window } = app
    await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    const composer = window.getByTestId('composer-input')
    await composer.fill('fixture-workspace-proof')
    await window.getByTestId('composer-send-button').click()
    await expect(window.getByRole('alert').first()).toBeVisible()
    await expect(composer).toHaveValue('fixture-workspace-proof')
    const transcript = await app.transcript()
    const launches = transcript.filter(entry => entry.event === 'provider-start')
    expect(launches).toHaveLength(1)
    expect(transcript.filter(entry => ['input', 'prompt', 'workspace-proof', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
    await expect.poll(() => { try { process.kill(launches[0].pid, 0); return true } catch { return false } }).toBe(false)
    await window.reload()
    await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    await expect(composer).toHaveValue('fixture-workspace-proof')
    expect((await app.transcript()).filter(entry => ['input', 'prompt'].includes(entry.event || ''))).toEqual([])
    await window.screenshot({ path: testInfo.outputPath(`01-agy-${initCwd}-workspace-draft-retained.png`), fullPage: true })
  })
}

test('Antigravity refuses a missing registered project before launch and retains the draft', async ({ app }, testInfo) => {
  const { window } = app
  const project = testInfo.outputPath('profile/project')
  const moved = testInfo.outputPath('profile/project-preserved')
  await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const composer = window.getByTestId('composer-input')
  await composer.fill('fixture-workspace-proof')
  await rename(project, moved)
  try {
    await window.getByTestId('composer-send-button').click()
    await expect(window.getByRole('alert').first()).toBeVisible()
    await expect(composer).toHaveValue('fixture-workspace-proof')
    expect((await app.transcript()).filter(entry => ['provider-start', 'input', 'prompt', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
    await app.window.screenshot({ path: testInfo.outputPath('01-agy-missing-project-draft-retained.png'), fullPage: true })
  } finally {
    await rename(moved, project)
  }
})
