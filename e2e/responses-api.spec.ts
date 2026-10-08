import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import type { AgentMediaRef } from '../shared/agent-media'
import { test, expect } from './fixtures'

interface ResponsesRequest {
  model: string
  instructions: string
  previous_response_id?: string
  input: Array<{ role?: string; content?: string; type?: string; call_id?: string; output?: string }>
  tools: Array<{ type: string; name: string }>
}
interface ResponsesFixture {
  baseUrl: string
  requests: ResponsesRequest[]
  cancellations: string[]
  interrupted: string[]
  errors: string[]
  media: { bytes: number; sha256: string; encodedPrefix: string }
  nativeCwd: string
  nativeSentinel: string
  close(): Promise<void>
}
const { startResponsesFixture } = createRequire(import.meta.url)('./fixtures/responses-server.cjs') as { startResponsesFixture(): Promise<ResponsesFixture> }

test.use({ providerFixture: 'codex' })

test('migrates a saved API connection and preserves Responses tools, image zoom and cancellation across Quit and Resume', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const api = await startResponsesFixture()
  const profile = testInfo.outputPath('profile')
  const taskCwd = await fs.realpath(path.join(profile, 'project/worktrees/task-e2e'))
  const sessionRoot = path.join(profile, 'user-data/agent-sessions')
  const snapshot = () => app.window.evaluate(() => window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
  const open = () => app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const send = async (text: string) => { await app.window.getByTestId('composer-input').fill(text); await app.window.getByTestId('composer-send-button').click() }
  const history = async () => {
    const directory = path.join(sessionRoot, 'api-conversations')
    const files = (await fs.readdir(directory)).filter(file => /^api-[a-f0-9-]+\.json$/.test(file))
    expect(files).toHaveLength(1)
    return JSON.parse(await fs.readFile(path.join(directory, files[0]), 'utf8')) as { version: number; lastResponseId: string; pending?: unknown; seenCallIds: string[] }
  }
  const readOwned = async (media: AgentMediaRef) => {
    const current = (await snapshot())!
    return app.window.evaluate(async request => {
      const value = await window.ziafAPI.agentMedia!.read(request)
      const bytes = new Uint8Array(value.bytes)
      const digest = await crypto.subtle.digest('SHA-256', bytes.buffer)
      return { bytes: bytes.length, mime: value.mime, sha256: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') }
    }, { sessionId: current.sessionId, runId: current.runId, mediaId: media.id })
  }
  const assertRaster = async (media: AgentMediaRef) => {
    const raster = app.window.getByTestId(`generated-image-${media.id}`)
    await raster.scrollIntoViewIfNeeded()
    await expect(raster).toBeVisible()
    await expect.poll(() => raster.evaluate(node => { const image = node as HTMLImageElement; return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 })).toBe(true)
    await expect(app.window.getByTestId(`generated-media-save-${media.id}`)).toBeEnabled()
  }
  try {
    await app.window.getByRole('button', { name: 'Connections', exact: true }).first().click()
    await app.window.getByTestId('api-connection-name').fill('Local Responses fixture')
    await app.window.getByTestId('api-connection-url').fill(api.baseUrl)
    await app.window.getByTestId('api-connection-model').fill('responses-fixture-model')
    // Start with the legacy transport. Saving a connection must not switch an
    // existing chat; explicit Apply later reloads the saved policy.
    await expect(app.window.getByTestId('api-connection-transport')).toHaveValue('chat-completions')
    await app.window.getByTestId('api-connection-save').click()
    await expect(app.window.locator('strong').filter({ hasText: 'Local Responses fixture' })).toBeVisible()
    let connections = await app.window.evaluate(() => window.ziafAPI.apiConnections.list())
    expect(connections).toHaveLength(1)
    expect(connections[0]).toMatchObject({ transport: 'chat-completions', profile: 'openai-compatible', allowCommands: false, hasApiKey: false })

    await open(); await send('fixture-hello')
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    await app.window.getByTestId('composer-preset-button').click()
    await app.window.getByTestId('composer-custom-option').click()
    await app.window.getByTestId('composer-provider-button').click()
    await app.window.getByTestId('agent-chat-provider').selectOption('api')
    await app.window.getByTestId('agent-chat-api-connection').selectOption(connections[0].id)
    await app.window.getByTestId('agent-chat-apply').click()
    await expect.poll(async () => (await snapshot())?.provider).toBe('api')
    await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
    expect((await snapshot())?.permissions).toBe('Read & Write')
    expect(api.requests).toHaveLength(0)

    const legacy = (await snapshot())!
    expect(legacy.apiTransport).toBe('chat-completions')
    await expect(app.window.getByTestId('agent-chat-api-transport')).toContainText('Chat Completions')
    await app.window.getByRole('button', { name: 'Connections', exact: true }).first().click()
    await app.window.getByTestId(`api-connection-responses-${connections[0].id}`).click()
    await expect(app.window.getByTestId('api-connection-transport')).toHaveValue('responses')
    await expect(app.window.getByTestId('api-connection-commands')).not.toBeChecked()
    expect((await app.window.evaluate(() => window.ziafAPI.apiConnections.list()))[0].transport).toBe('chat-completions')
    await app.window.getByTestId('api-connection-profile').selectOption('codex-connector')
    await app.window.getByTestId('api-connection-commands').check()
    await app.window.getByTestId('api-connection-save').click()
    await expect(app.window.getByTestId('api-connection-saved')).toBeVisible()
    connections = await app.window.evaluate(() => window.ziafAPI.apiConnections.list())
    expect(connections[0]).toMatchObject({ transport: 'responses', profile: 'codex-connector', allowCommands: true, hasApiKey: false })
    await app.window.screenshot({ path: testInfo.outputPath('01-responses-saved-connection.png'), fullPage: true })
    await open()
    expect((await snapshot())!.apiTransport).toBe('chat-completions')
    expect((await snapshot())!.runId).toBe(legacy.runId)
    await app.window.getByTestId('composer-provider-button').click()
    await expect(app.window.getByTestId('agent-chat-api-connection-protocol')).toContainText('Responses')
    // Same selected connection/model, no artificial change needed to Apply.
    await app.window.getByTestId('agent-chat-apply').click()
    await expect.poll(async () => (await snapshot())?.apiTransport).toBe('responses')
    await expect(app.window.getByTestId('agent-chat-api-transport')).toContainText('Responses')
    const migrated = (await snapshot())!
    expect(migrated.sessionId).toBe(legacy.sessionId)
    expect(migrated.runId).not.toBe(legacy.runId)
    expect(migrated.feed).toEqual(legacy.feed)
    expect(api.requests).toHaveLength(0)

    await send('fixture-responses-media')
    await expect.poll(async () => (await snapshot())?.pendingApprovals.length).toBe(1)
    expect(api.requests).toHaveLength(2)
    const waiting = (await snapshot())!
    expect(waiting.pendingApprovals[0].command).toContain('/bin/pwd')
    const providerCard = app.window.getByTestId('tool-item-provider-native_command')
    await expect(providerCard).toContainText(api.nativeCwd)
    await expect(app.window.getByTestId('tool-provider-provider-native_command')).toHaveText('Provider tool')
    await providerCard.getByRole('button', { name: 'Output', exact: true }).click()
    await expect(providerCard).toContainText('Synthetic provider stdout from its own workspace.')
    const listOutput = JSON.parse(api.requests[1].input[0].output!)
    expect(api.requests[1]).toMatchObject({ previous_response_id: 'resp_fixture_list', input: [{ type: 'function_call_output', call_id: 'call_fixture_list' }] })
    expect(listOutput).toMatchObject({ entries: [], truncated: false })
    expect(api.requests[0].instructions).toContain(taskCwd)
    expect(api.requests[0].instructions).toContain('local command requires')
    expect(api.requests[0].input.every(item => item.role !== 'system' && item.role !== 'developer')).toBe(true)
    expect(api.requests[0].tools.filter(tool => tool.name === 'run_command')).toHaveLength(1)
    await app.window.getByTestId(`approval-allow-${waiting.pendingApprovals[0].approvalId}`).click()
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    const finished = (await snapshot())!
    expect(api.errors).toEqual([])
    expect(api.requests).toHaveLength(3)
    expect(api.requests[2]).toMatchObject({ previous_response_id: 'resp_fixture_command', input: [{ type: 'function_call_output', call_id: 'call_fixture_command' }] })
    const commandOutput = JSON.parse(api.requests[2].input[0].output!)
    expect(commandOutput).toMatchObject({ status: 'passed', exitCode: 0, cleanupVerified: true, stdout: `${taskCwd}\n` })
    await expect(fs.stat(path.join(taskCwd, api.nativeSentinel))).rejects.toThrow()
    const callerTools = finished.feed.flatMap(item => item.tools ?? []).filter(tool => tool.executor === 'caller')
    expect(callerTools.map(tool => tool.toolName)).toEqual(['list_files', 'run_command'])
    expect(callerTools[0].input).toEqual({ path: '.' })
    expect(callerTools[1].input).toEqual({ executable: '/bin/pwd', args: [], timeoutMs: null })
    expect(callerTools.every(tool => tool.status === 'completed')).toBe(true)
    expect(finished.usage).toEqual({ inputTokens: 14, outputTokens: 6, totalTokens: 20, requests: 3 })
    const mediaMessage = finished.feed.find(item => item.tools?.some(tool => tool.media?.length))!
    const refs = finished.feed.flatMap(item => item.tools ?? []).flatMap(tool => tool.media ?? [])
    expect(refs).toHaveLength(1)
    const media = refs[0]
    expect(media).toMatchObject({ mime: 'image/png', bytes: api.media.bytes, sha256: api.media.sha256, sourceRunId: finished.runId })
    await assertRaster(media)
    const previewURL = await app.window.getByTestId(`generated-image-${media.id}`).getAttribute('src')
    await app.window.getByTestId(`generated-media-open-${media.id}`).click()
    await expect(app.window.getByTestId('image-viewer')).toBeVisible()
    await expect(app.window.getByTestId('image-viewer-image')).toHaveAttribute('src', previewURL!)
    await app.window.getByTestId('image-viewer-actual-size').click()
    await expect(app.window.getByTestId('image-viewer-scale')).toHaveText('100%')
    await app.window.getByTestId('image-viewer-zoom-in').click()
    await expect(app.window.getByTestId('image-viewer-scale')).toHaveText('125%')
    await app.window.getByTestId('image-viewer-zoom-out').click()
    await expect(app.window.getByTestId('image-viewer-scale')).toHaveText('100%')
    await app.window.getByTestId('image-viewer-zoom-in').click()
    await app.window.getByTestId('image-viewer-zoom-in').click()
    const viewport = app.window.getByTestId('image-viewer-viewport')
    const beforePan = await viewport.evaluate(node => ({ left: node.scrollLeft, top: node.scrollTop }))
    if (beforePan.left > 50 && beforePan.top > 50) {
      const box = (await viewport.boundingBox())!
      await app.window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await app.window.mouse.down()
      await app.window.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 40, { steps: 4 })
      await app.window.mouse.up()
      expect(await viewport.evaluate(node => node.scrollLeft)).toBeLessThan(beforePan.left)
      expect(await viewport.evaluate(node => node.scrollTop)).toBeLessThan(beforePan.top)
    }
    await app.window.getByTestId('image-viewer-fit').click()
    await app.window.screenshot({ path: testInfo.outputPath('03-image-viewer-fit.png'), fullPage: true })
    await app.window.keyboard.press('Escape')
    await expect(app.window.getByTestId('image-viewer')).toHaveCount(0)
    await expect(app.window.getByTestId(`generated-media-open-${media.id}`)).toBeFocused()
    expect(api.requests).toHaveLength(3)
    const tools = app.window.getByTestId(`tools-block-${mediaMessage.id}`)
    await tools.getByRole('button', { name: /^Tools \(/i }).first().click()
    await expect(app.window.getByTestId('tool-item-provider-ig_fixture_image')).toHaveCount(0)
    await assertRaster(media)
    expect(await readOwned(media)).toEqual({ mime: 'image/png', bytes: api.media.bytes, sha256: api.media.sha256 })
    const denied = await app.window.evaluate(async request => {
      try { await window.ziafAPI.agentMedia!.read(request); return false } catch { return true }
    }, { sessionId: finished.sessionId, runId: 'run-foreign', mediaId: media.id })
    expect(denied, 'A foreign run cannot read the cached image').toBe(true)
    const cacheFile = path.join(sessionRoot, 'api-conversations/media', `${media.id}.bin`)
    expect(createHash('sha256').update(await fs.readFile(cacheFile)).digest('hex')).toBe(api.media.sha256)
    expect((await fs.stat(cacheFile)).mode & 0o777).toBe(0o600)
    const journal = await fs.readFile(path.join(sessionRoot, 'artifacts/worktrees/task-e2e/runs', finished.runId, 'events.ndjson'), 'utf8')
    expect(journal.includes(api.media.encodedPrefix), 'Encoded image bytes never enter the event journal').toBe(false)
    expect(/"(?:base64|b64_json|encrypted_content)"/.test(journal), 'No private media or reasoning fields enter the event journal').toBe(false)
    expect((await history())).toMatchObject({ version: 2, lastResponseId: 'resp_fixture_media', seenCallIds: ['call_fixture_list', 'call_fixture_command'] })

    // The isolated fixture intercepts only native dialog selection; the real
    // renderer button and authenticated save handler still execute.
    await app.electronApp.evaluate(({ dialog }) => {
      const state = globalThis as unknown as { responsesSaveDialog?: { original: typeof dialog.showSaveDialog; calls: number } }
      state.responsesSaveDialog = { original: dialog.showSaveDialog, calls: 0 }
      dialog.showSaveDialog = (async () => { state.responsesSaveDialog!.calls++; return { canceled: true, filePath: '' } }) as typeof dialog.showSaveDialog
    })
    try {
      await app.window.getByTestId(`generated-media-save-${media.id}`).click()
      await expect(app.window.getByTestId(`generated-media-${media.id}`).getByRole('status')).toHaveText('Image save cancelled')
      expect(await app.electronApp.evaluate(() => (globalThis as unknown as { responsesSaveDialog: { calls: number } }).responsesSaveDialog.calls)).toBe(1)
      expect(await readOwned(media)).toMatchObject({ sha256: api.media.sha256, bytes: api.media.bytes })
      const savedImage = testInfo.outputPath('saved-response-image.png')
      await app.electronApp.evaluate(({ dialog }, filePath) => {
        const state = globalThis as unknown as { responsesSaveDialog: { calls: number } }
        dialog.showSaveDialog = (async () => { state.responsesSaveDialog.calls++; return { canceled: false, filePath } }) as typeof dialog.showSaveDialog
      }, savedImage)
      await app.window.getByTestId(`generated-media-save-${media.id}`).click()
      await expect(app.window.getByTestId(`generated-media-${media.id}`).getByRole('status')).toHaveText('Image saved')
      expect(createHash('sha256').update(await fs.readFile(savedImage)).digest('hex')).toBe(api.media.sha256)
      expect((await fs.stat(savedImage)).mode & 0o777).toBe(0o600)
      expect(await app.electronApp.evaluate(() => (globalThis as unknown as { responsesSaveDialog: { calls: number } }).responsesSaveDialog.calls)).toBe(2)
    } finally {
      await app.electronApp.evaluate(({ dialog }) => {
        const state = globalThis as unknown as { responsesSaveDialog?: { original: typeof dialog.showSaveDialog } }
        if (state.responsesSaveDialog) { dialog.showSaveDialog = state.responsesSaveDialog.original; delete state.responsesSaveDialog }
      })
    }

    await send('fixture-responses-wait')
    await expect(app.window.getByTestId('conversation-feed')).toContainText('Responses fixture is waiting for Stop.')
    await app.window.getByTestId('composer-stop-button').click()
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('interrupted')
    await expect.poll(() => api.cancellations).toEqual(['resp_fixture_wait'])
    await expect.poll(() => api.interrupted).toEqual(['resp_fixture_wait'])
    expect((await history()).pending).toBeUndefined()
    expect((await history()).lastResponseId).toBe('resp_fixture_media')
    const beforeQuit = (await snapshot())!
    const requestCount = api.requests.length
    await app.restart(); await open()
    const disconnected = (await snapshot())!
    expect(disconnected).toMatchObject({ provider: 'api', sessionId: beforeQuit.sessionId, apiConnectionId: connections[0].id, resumeAvailable: true, usage: beforeQuit.usage })
    expect(api.requests).toHaveLength(requestCount)
    expect(await app.window.evaluate(() => window.ziafAPI.apiConnections.list())).toEqual(connections)
    await assertRaster(media)
    expect(await readOwned(media)).toMatchObject({ sha256: api.media.sha256, bytes: api.media.bytes })
    await app.window.getByTestId('agent-session-resume').click()
    await expect.poll(async () => (await snapshot())?.sessionStatus).toBe('ready')
    expect(api.requests).toHaveLength(requestCount)
    expect((await snapshot())!.runId).not.toBe(beforeQuit.runId)
    await assertRaster(media)
    expect(await readOwned(media)).toMatchObject({ sha256: api.media.sha256, bytes: api.media.bytes })
    await send('fixture-responses-recall')
    await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
    expect(api.requests).toHaveLength(requestCount + 1)
    expect(api.requests.at(-1)?.previous_response_id).toBe('resp_fixture_media')
    await expect(app.window.getByTestId('conversation-feed')).toContainText('Responses context resumed without replaying caller tools or generating another image.')
    expect((await snapshot())!.feed.flatMap(item => item.tools ?? []).flatMap(tool => tool.media ?? [])).toEqual([media])
    expect(api.errors).toEqual([])
    expect((await app.transcript()).filter(entry => entry.event === 'prompt')).toHaveLength(1)
    expect((await app.transcript()).filter(entry => entry.event === 'pty-shell-start')).toEqual([])
    const retainedImageTool = app.window.getByTestId('tool-item-provider-ig_fixture_image')
    if (await retainedImageTool.count()) await app.window.locator('[data-testid^="tools-block-"]').filter({ has: retainedImageTool }).getByRole('button', { name: /^Tools \(/i }).first().click()
    await assertRaster(media)
    await app.window.screenshot({ path: testInfo.outputPath('02-responses-private-image-after-restart.png'), fullPage: true })
    await testInfo.attach('responses-session-snapshot.json', { body: JSON.stringify(await snapshot(), null, 2), contentType: 'application/json' })
  } finally {
    await testInfo.attach('responses-fixture-receipt.json', {
      body: JSON.stringify({ mode: 'loopback deterministic fixture; no external inference or credentials', image: { bytes: api.media.bytes, sha256: api.media.sha256 }, requests: api.requests, cancellations: api.cancellations, interrupted: api.interrupted, errors: api.errors }, null, 2), contentType: 'application/json',
    })
    await api.close()
  }
})
