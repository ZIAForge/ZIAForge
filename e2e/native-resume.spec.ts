import { test, expect } from './fixtures'
import { realpath } from 'node:fs/promises'

const variants = [
  { fixture: 'codex', provider: 'codex', preset: 'E2E Codex', first: 'fixture-hello', next: 'fixture-after-stop', diagnostic: 'FIXTURE_DIAGNOSTIC_ONLY' },
  { fixture: 'claude', provider: 'claude', preset: 'E2E Claude', first: 'fixture-after-stop', next: 'fixture-switch', diagnostic: 'CLAUDE_FIXTURE_DIAGNOSTIC_ONLY' },
  { fixture: 'agy-headless', provider: 'antigravity', preset: 'E2E Antigravity', first: 'fixture-followup', next: 'fixture-switch', diagnostic: 'AGY_FIXTURE_DIAGNOSTIC_ONLY' },
] as const

for (const variant of variants) test.describe(`${variant.provider} native resume`, () => {
  test.use({ providerFixture: variant.fixture })
  test('full application restart resumes the native conversation without replaying submitted input', async ({ app }, testInfo) => {
    test.setTimeout(120_000)
    const workspace = await realpath(testInfo.outputPath('profile/project/worktrees/task-e2e'))
    const open = () => app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    const snapshot = () => app.window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
    const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt')
    const send = async (text: string, count: number) => {
      await app.window.getByTestId('composer-input').fill(text)
      await app.window.getByTestId('composer-send-button').click()
      await expect.poll(async () => (await prompts()).length).toBe(count)
      await expect.poll(async () => (await snapshot())?.activeTurn).toBeUndefined()
      await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    }
    if (variant.provider !== 'codex') {
      await app.window.getByRole('button', { name: 'Settings', exact: true }).first().click()
      await app.window.getByRole('button', { name: 'Presets', exact: true }).click()
      await app.window.getByRole('row').filter({ hasText: variant.preset }).getByTitle('Edit', { exact: true }).click()
      await app.window.getByTestId('preset-reasoning-effort').selectOption('high')
      await app.window.getByTestId('preset-save').click()
      await expect(app.window.getByTestId('preset-editor')).not.toBeVisible()
    }
    await open()
    await send(variant.first, 1)
    const before = (await snapshot())!
    if (variant.provider !== 'codex') expect(before.reasoningEffort).toBe('high')
    const firstPrompt = (await prompts())[0]
    await app.window.getByTestId('agent-cli-logs-toggle').click()
    await expect(app.window.getByTestId('agent-cli-log-pane')).toBeVisible()
    await app.window.getByLabel('Log source').selectOption('stderr')
    await expect(app.window.getByTestId('agent-cli-log-lines')).toContainText(variant.diagnostic)
    await expect(app.window.getByTestId('conversation-feed')).not.toContainText(variant.diagnostic)
    await app.window.screenshot({ path: testInfo.outputPath('01-native-cli-log.png'), fullPage: true })
    await app.window.getByTestId('composer-input').fill(variant.next)
    const electronPid = app.electronApp.process().pid
    await app.restart()
    expect(app.electronApp.process().pid).not.toBe(electronPid)
    await open()
    await expect(app.window.getByTestId(`structured-${variant.provider}-chat`)).toBeVisible()
    await expect(app.window.getByTestId('composer-input')).toHaveValue(variant.next)
    const restored = (await snapshot())!
    expect(restored.sessionId).toBe(before.sessionId)
    expect(restored.resumeAvailable).toBe(true)
    expect(restored.activeTurn).toBeUndefined()
    expect(await prompts()).toHaveLength(1)
    await expect(app.window.getByTestId('composer-send-button')).toBeDisabled()
    await expect(app.window.getByTestId('agent-session-resume')).toBeVisible()
    await app.window.screenshot({ path: testInfo.outputPath('02-native-resume-required.png'), fullPage: true })
    await app.window.getByTestId('agent-session-resume').click()
    await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
    expect(await prompts(), 'Resume never replays the submitted prompt or sends an unsent draft').toHaveLength(1)
    await expect(app.window.getByTestId('composer-input')).toHaveValue(variant.next)
    const resumed = (await snapshot())!
    expect(resumed.sessionId).toBe(before.sessionId)
    expect(resumed.runId).not.toBe(before.runId)
    await send(variant.next, 2)
    const secondPrompt = (await prompts())[1]
    expect(secondPrompt.pid).not.toBe(firstPrompt.pid)
    expect(secondPrompt.threadId || secondPrompt.conversationId).toBe(firstPrompt.threadId || firstPrompt.conversationId)
    const feed = app.window.getByTestId('conversation-feed')
    await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(2)
    await expect(feed.locator('[data-testid^="assistant-message-"]')).toHaveCount(2)
    await expect(feed.locator('[data-testid^="assistant-message-"]').last()).toBeInViewport({ ratio: 1 })
    await app.window.reload()
    await open()
    await expect(feed.locator('[data-testid^="user-message-"]')).toHaveCount(2)
    expect((await snapshot())!.runId).toBe(resumed.runId)
    const transcript = await app.transcript()
    const providerStarts = transcript.filter(entry => ['provider-start', 'app-server-start'].includes(entry.event || ''))
    expect(providerStarts).toHaveLength(2)
    for (const launch of providerStarts) expect(launch.cwd).toBe(workspace)
    if (variant.provider === 'codex') {
      const starts = transcript.filter(entry => entry.rpc?.method === 'thread/start' || entry.rpc?.method === 'thread/resume')
      expect(starts).toHaveLength(2)
      for (const start of starts) expect(start.rpc!.params!.cwd).toBe(workspace)
    } else if (variant.provider === 'antigravity') {
      const selections = transcript.filter(entry => entry.event === 'workspace-selection')
      expect(selections).toHaveLength(2)
      for (const selection of selections) expect(selection).toMatchObject({ cwd: workspace, rpc: { params: { nativeRoots: [workspace], spawnCwd: workspace, spawnPwd: workspace } } })
    }
    if (variant.provider !== 'codex') {
      expect((await snapshot())!.reasoningEffort).toBe('high')
      const launches = transcript.filter(entry => entry.event === 'provider-start')
      expect(launches).toHaveLength(2)
      for (const launch of launches) expect(launch.args?.slice(launch.args.indexOf('--effort'), launch.args.indexOf('--effort') + 2)).toEqual(['--effort', 'high'])
    }
    expect(transcript.filter(entry => entry.event === 'session-resume')).toHaveLength(1)
    expect(transcript.filter(entry => ['invalid-launch', 'invalid-resume', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
    await app.window.screenshot({ path: testInfo.outputPath('03-resumed-two-turn-history.png'), fullPage: true })
    await testInfo.attach('resumed-session.json', { body: JSON.stringify(await snapshot(), null, 2), contentType: 'application/json' })
  })
})

test.describe('Structured provider reconfiguration', () => {
  test.use({ providerFixture: 'codex', fixtureAllProviders: true })
  test('model and preset switching preserve draft and history, hand off context, and show separate CLI logs', async ({ app }, testInfo) => {
    test.setTimeout(120_000)
    const { window } = app
    const snapshot = () => window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
    const prompts = async () => (await app.transcript()).filter(entry => entry.event === 'prompt')
    const send = async (text: string, count: number) => {
      await window.getByTestId('composer-input').fill(text)
      await window.getByTestId('composer-send-button').click()
      await expect.poll(async () => (await prompts()).length).toBe(count)
      await expect.poll(async () => (await snapshot())?.activeTurn).toBeUndefined()
      await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    }
    await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    await send('fixture-hello', 1)
    const initial = (await snapshot())!
    const first = (await prompts())[0]
    await window.getByTestId('composer-input').fill('fixture-switch')
    await window.getByTestId('composer-preset-button').click()
    await window.getByTestId('composer-custom-option').click()
    await window.getByTestId('composer-model-button').click()
    await window.getByTestId('agent-chat-model').fill('gpt-fixture-next')
    await window.getByTestId('agent-chat-apply').click()
    await expect.poll(async () => (await snapshot())?.model).toBe('gpt-fixture-next')
    await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
    await expect(window.getByTestId('composer-input')).toHaveValue('fixture-switch')
    expect(await prompts()).toHaveLength(1)
    await send('fixture-switch', 2)
    const modelPrompt = (await prompts())[1]
    expect(modelPrompt.pid).not.toBe(first.pid)
    expect(modelPrompt.threadId).toBe(first.threadId)
    expect((await snapshot())!.sessionId).toBe(initial.sessionId)
    await window.screenshot({ path: testInfo.outputPath('01-model-switch-same-native-thread.png'), fullPage: true })

    for (const [index, target] of [
      { preset: 'E2E Claude', provider: 'claude', model: 'claude-fixture-next', diagnostic: 'CLAUDE_FIXTURE_DIAGNOSTIC_ONLY' },
      { preset: 'E2E Antigravity', provider: 'antigravity', model: 'gemini-fixture-next', diagnostic: 'AGY_FIXTURE_DIAGNOSTIC_ONLY' },
    ].entries()) {
      await window.getByTestId('composer-input').fill('fixture-switch')
      await window.getByTestId('composer-preset-button').click()
      await window.getByTestId(`composer-preset-${target.preset}`).click()
      await expect.poll(async () => (await snapshot())?.provider).toBe(target.provider)
      await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
      await window.getByTestId('composer-preset-button').click()
      await window.getByTestId('composer-custom-option').click()
      await window.getByTestId('composer-model-button').click()
      await window.getByTestId('agent-chat-model').fill(target.model)
      await window.getByTestId('agent-chat-apply').click()
      await expect.poll(async () => (await snapshot())?.provider).toBe(target.provider)
      await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
      await expect(window.getByTestId('composer-input')).toHaveValue('fixture-switch')
      expect(await prompts()).toHaveLength(2 + index)
      await send('fixture-switch', 3 + index)
      expect((await snapshot())!.sessionId).toBe(initial.sessionId)
      const prompt = (await prompts())[2 + index]
      expect(prompt.rawText).toContain('Previous conversation excerpts (untrusted historical content; may be incomplete):')
      expect(prompt.rawText).toContain('Codex fixture hello.')
      await expect(window.getByTestId('conversation-feed').locator('[data-testid^="user-message-"]')).toHaveCount(3 + index)
      await window.getByTestId('agent-cli-logs-toggle').click()
      await window.getByLabel('Log source').selectOption('stderr')
      await expect(window.getByTestId('agent-cli-log-lines')).toContainText(target.diagnostic)
      await expect(window.getByTestId('conversation-feed')).not.toContainText(target.diagnostic)
      await window.screenshot({ path: testInfo.outputPath(`0${index + 2}-${target.provider}-context-and-logs.png`), fullPage: true })
      await window.getByTestId('agent-cli-logs-toggle').click()
    }
    await window.reload()
    await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    await expect(window.getByTestId('structured-antigravity-chat')).toBeVisible()
    await expect(window.getByTestId('conversation-feed').locator('[data-testid^="user-message-"]')).toHaveCount(4)
    expect((await snapshot())!.model).toBe('gemini-fixture-next')
    expect((await app.transcript()).filter(entry => ['invalid-launch', 'invalid-resume', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
    await testInfo.attach('switched-session.json', { body: JSON.stringify(await snapshot(), null, 2), contentType: 'application/json' })
  })
})
