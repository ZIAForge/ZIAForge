import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test, expect } from './fixtures'

type ApiRequest = { model: string; messages: Array<{ role: string; content?: string }>; tools: Array<{ function: { name: string } }> }
const { startApiFixture } = createRequire(import.meta.url)('./fixtures/api-server.cjs') as {
  startApiFixture(): Promise<{ baseUrl: string; requests: ApiRequest[]; interrupted: string[]; close(): Promise<void> }>
}

test.use({ providerFixture: 'codex' })

test('uses a saved API connection through stream, approved file edit, Stop and full restart with local context', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const api = await startApiFixture()
  const snapshot = () => app.window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
  const open = () => app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const send = async (text: string) => { await app.window.getByTestId('composer-input').fill(text); await app.window.getByTestId('composer-send-button').click() }
  try {
    await app.window.getByRole('button', { name: 'Connections', exact: true }).first().click()
    await expect(app.window.getByTestId('api-connections')).toBeVisible()
    await app.window.getByTestId('api-connection-name').fill('Local API fixture')
    await app.window.getByTestId('api-connection-url').fill(api.baseUrl)
    await app.window.getByTestId('api-connection-model').fill('api-fixture-model')
    // No OS credential dialog is required for a loopback no-key gateway.
    // Encrypted key persistence and failure-closed behavior have separate backend tests.
    await app.window.getByTestId('api-connection-save').click()
    await expect(app.window.locator('strong').filter({ hasText: 'Local API fixture' })).toBeVisible()
    await app.window.getByRole('button', { name: 'Check model catalog', exact: true }).click()
    await expect(app.window.getByTestId('api-connections')).toContainText('Models endpoint responded: api-fixture-model, api-fixture-next')
    const connections = await app.window.evaluate(() => globalThis.window.ziafAPI.apiConnections.list())
    expect(connections).toHaveLength(1); expect(connections[0]).toMatchObject({ name: 'Local API fixture', hasApiKey: false })
    await app.window.screenshot({ path: testInfo.outputPath('01-api-connection-catalog.png'), fullPage: true })

    await open(); await send('fixture-hello')
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    const native = (await snapshot())!
    await app.window.getByTestId('composer-input').fill('remember BASALT')
    await app.window.getByTestId('composer-preset-button').click()
    await app.window.getByTestId('composer-custom-option').click()
    await app.window.getByTestId('composer-provider-button').click()
    await app.window.getByTestId('agent-chat-provider').selectOption('api')
    await app.window.getByTestId('agent-chat-api-connection').selectOption(connections[0].id)
    await app.window.getByTestId('composer-model-button').click()
    await expect(app.window.getByTestId('agent-chat-model-catalog-status')).toContainText('GET /models')
    await app.window.getByTestId('agent-chat-model-catalog').selectOption('api-fixture-next')
    await app.window.getByTestId('agent-chat-apply').click()
    await expect.poll(async () => (await snapshot())?.provider).toBe('api')
    await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
    await expect(app.window.getByTestId('composer-input')).toHaveValue('remember BASALT')
    expect((await snapshot())!.sessionId).toBe(native.sessionId)
    expect(api.requests).toHaveLength(0)
    await app.window.getByTestId('composer-send-button').click()
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    await expect(app.window.getByTestId('conversation-feed')).toContainText('API fixture remembers the supplied word. Ж🙂')
    expect(api.requests).toHaveLength(1); expect(api.requests[0].model).toBe('api-fixture-next')
    expect(api.requests[0].messages.some(message => message.content?.includes('Codex fixture hello.'))).toBe(true)
    expect((await snapshot())!.usage).toEqual({ inputTokens: 14, outputTokens: 6, totalTokens: 20, requests: 1 })
    await expect(app.window.getByTestId('agent-usage')).toContainText('20')

    await send('fixture-api-write')
    await expect.poll(async () => (await snapshot())?.pendingApprovals.length).toBe(1)
    const file = testInfo.outputPath('profile/project/worktrees/task-e2e/api-approved.txt')
    await expect(fs.stat(file)).rejects.toThrow()
    const approval = (await snapshot())!.pendingApprovals[0]
    await app.window.getByTestId(`approval-allow-${approval.approvalId}`).click()
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    expect(await fs.readFile(file, 'utf8')).toBe('Approved by the real user-facing card.\n')
    await app.window.screenshot({ path: testInfo.outputPath('02-api-tool-permission-and-feed.png'), fullPage: true })

    await send('fixture-api-wait')
    await expect(app.window.getByTestId('conversation-feed')).toContainText('API fixture is waiting for Stop.')
    await app.window.getByTestId('composer-stop-button').click()
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('interrupted')
    await expect.poll(() => api.interrupted.length).toBe(1)
    const beforeQuit = (await snapshot())!
    const count = api.requests.length
    await app.window.getByTestId('composer-input').fill('fixture-api-recall')
    await app.restart(); await open()
    const disconnected = (await snapshot())!
    expect(disconnected).toMatchObject({ provider: 'api', sessionId: beforeQuit.sessionId, apiConnectionId: connections[0].id, resumeAvailable: true, usage: beforeQuit.usage })
    expect(disconnected.feed.map(message => message.text)).toEqual(beforeQuit.feed.map(message => message.text))
    expect(api.requests).toHaveLength(count)
    await app.window.getByTestId('agent-session-resume').click()
    await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
    expect(api.requests).toHaveLength(count)
    await expect(app.window.getByTestId('composer-input')).toHaveValue('fixture-api-recall')
    await app.window.getByTestId('composer-send-button').click()
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    await expect(app.window.getByTestId('conversation-feed')).toContainText('The remembered word is BASALT.')
    await expect(app.window.getByTestId('conversation-feed')).not.toContainText('MISSING_CONTEXT')
    expect(api.requests).toHaveLength(count + 1)
    expect((await app.transcript()).filter(entry => entry.event === 'prompt')).toHaveLength(1)
    expect((await app.transcript()).filter(entry => entry.event === 'pty-shell-start')).toEqual([])
    await app.window.screenshot({ path: testInfo.outputPath('03-api-full-restart-context-resume.png'), fullPage: true })
    await testInfo.attach('api-session-snapshot.json', { body: JSON.stringify(await snapshot(), null, 2), contentType: 'application/json' })
  } finally {
    await testInfo.attach('local-http-requests.json', { body: JSON.stringify({ provider: 'local deterministic HTTP fixture; no external API calls or keys', requests: api.requests, interrupted: api.interrupted }, null, 2), contentType: 'application/json' })
    await api.close()
  }
})
