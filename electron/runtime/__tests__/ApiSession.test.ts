import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RunService } from '../RunService'
import { SessionRegistry } from '../SessionRegistry'
import { ProcessSupervisor } from '../ProcessSupervisor'
import type { TrustedAgentSessionConfig } from '../SessionManager'
import type { AgentSessionSnapshot } from '../../../shared/agent-session'

const services: RunService[] = [], roots: string[] = [], servers: http.Server[] = []
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.sessions.shutdown())); for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })
describe('API vertical session integration', () => {
  it('keeps image bytes private and authorizes current/ancestor media without another provider request', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-responses-media-'))); roots.push(root)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64')
    let requests = 0
    const server = http.createServer((request, response) => { request.resume(); request.on('end', () => {
      requests++
      const item = { id: 'image-fixture', type: 'image_generation_call', result: png.toString('base64') }
      response.end(`data: ${JSON.stringify({ type: 'response.created', response: { id: 'resp-fixture' } })}\n\ndata: ${JSON.stringify({ type: 'response.output_item.done', item, output_index: 0 })}\n\ndata: ${JSON.stringify({ type: 'response.completed', response: { id: 'resp-fixture', status: 'completed', output: [item] } })}\n\n`)
    }) })
    servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const config: TrustedAgentSessionConfig = { taskId: 'task', chatId: 'chat-main', presetName: '', cwd: root, provider: 'api', model: 'media-model', apiConnectionId: 'media-api', apiReadOnly: true, apiConnection: { id: 'media-api', name: 'Media fixture', model: 'media-model', enabled: true, hasApiKey: false, transport: 'responses', baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1` } }
    const create = () => { const service = new RunService({ sessionRegistry: new SessionRegistry(), processSupervisor: new ProcessSupervisor(), baseStorageDir: path.join(root, 'state') }); services.push(service); return service }
    const first = create(), original = await first.sessions.create(config)
    await first.sessions.send({ ...original, text: 'Return an image', clientMessageId: 'image-input' })
    await vi.waitFor(async () => expect((await first.sessions.snapshot(original)).lastTurn?.status).toBe('completed'))
    const completed = await first.sessions.snapshot(original)
    const media = completed.feed.flatMap(message => message.tools ?? []).flatMap(tool => tool.media ?? [])
    expect(media).toHaveLength(1)
    const request = { sessionId: original.sessionId, runId: original.runId, mediaId: media[0].id }
    expect(Buffer.from((await first.sessions.readMedia(request)).bytes)).toEqual(png)
    await expect(first.sessions.readMedia({ ...request, mediaId: 'foreign-image' })).rejects.toThrow('unavailable')
    await expect(first.sessions.readMedia({ ...request, runId: 'other-run' })).rejects.toThrow('stale')
    expect(JSON.stringify(completed)).not.toContain(png.toString('base64'))
    const journal = fs.readFileSync(first.getJournal(original.taskId, original.runId).filePath, 'utf8')
    expect(journal).not.toContain(png.toString('base64'))
    await first.sessions.shutdown()
    const second = create(), attached = await second.sessions.attach(config)
    expect(attached?.sessionStatus).toBe('disconnected')
    expect(Buffer.from((await second.sessions.readMedia(request)).bytes)).toEqual(png)
    expect(requests).toBe(1)
    const resumed = await second.sessions.resume(attached!, config)
    expect(resumed.runId).not.toBe(original.runId)
    await expect(second.sessions.readMedia(request)).rejects.toThrow('stale')
    expect(Buffer.from((await second.sessions.readMedia({ ...request, runId: resumed.runId })).bytes)).toEqual(png)
    expect(requests).toBe(1)
    const pin = second.sessions.persistedLaunch(resumed)
    expect(pin).toMatchObject({ apiTransport: 'responses', apiBaseUrl: config.apiConnection!.baseUrl, apiAllowCommands: false })
    await second.sessions.terminate(resumed)
    await expect(second.sessions.resume(resumed, { ...config, apiConnection: { ...config.apiConnection!, baseUrl: 'https://changed.invalid/v1' } })).rejects.toThrow('changed')
    expect(requests).toBe(1)
  })

  it('journals actual usage, owns no PID and restores local context after complete service restart', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-api-session-'))); roots.push(root)
    const requests: Array<{ messages: Array<{ role: string; content: string }>; model: string }> = []
    const server = http.createServer((request, response) => { let data = ''; request.on('data', chunk => data += chunk); request.on('end', () => { requests.push(JSON.parse(data)); response.end(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Actual HTTP fixture answer' }, finish_reason: 'stop' }] })}\n\ndata: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } })}\n\ndata: [DONE]\n\n`) }) })
    servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const config: TrustedAgentSessionConfig = { taskId: 'task', chatId: 'chat-main', presetName: '', cwd: root, provider: 'api', model: 'actual-model', apiConnectionId: 'connection', apiReadOnly: true, apiConnection: { id: 'connection', name: 'Private fixture', baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`, enabled: true, hasApiKey: true, apiKey: 'fixture-key-never-persist', model: 'stored-default' } }
    const create = () => { const registry = new SessionRegistry(); const service = new RunService({ sessionRegistry: registry, processSupervisor: new ProcessSupervisor(), baseStorageDir: path.join(root, 'state') }); services.push(service); return { service, registry } }
    const first = create(), original = await first.service.sessions.create(config)
    expect(first.registry.getAgentSession(original.sessionId)?.pid).toBeUndefined()
    expect(original.capabilities).toMatchObject({ interruptTurn: true, interactiveApprovals: false })
    const send = async (service: RunService, session: AgentSessionSnapshot, text: string, clientMessageId: string) => { await service.sessions.send({ ...session, text, clientMessageId }); await vi.waitFor(async () => expect((await service.sessions.snapshot(session)).lastTurn?.status).toBe('completed')); return service.sessions.snapshot(session) }
    const completed = await send(first.service, original, 'Remember CEDAR', 'first')
    expect(completed.usage).toEqual({ inputTokens: 12, outputTokens: 8, totalTokens: 20, requests: 1 })
    const journal = await first.service.getJournal(original.taskId, original.runId).readEvents()
    expect(journal.some(event => event.type === 'usage.reported')).toBe(true)
    const metadataFile = path.join(path.dirname(first.service.getJournal(original.taskId, original.runId).filePath), 'session.json')
    expect(fs.readFileSync(metadataFile, 'utf8')).not.toContain('fixture-key-never-persist')
    await first.service.sessions.shutdown()
    const second = create(), disconnected = await second.service.sessions.attach(config)
    expect(disconnected).toMatchObject({ sessionStatus: 'disconnected', apiConnectionId: 'connection', presetName: '', resumeAvailable: true, usage: completed.usage })
    expect(second.service.sessions.persistedLaunch(disconnected!)).toMatchObject({ apiConnectionId: 'connection', apiReadOnly: true, model: 'actual-model' })
    const resumed = await second.service.sessions.resume(disconnected!, config)
    expect(resumed.sessionId).toBe(original.sessionId); expect(resumed.runId).not.toBe(original.runId)
    const after = await send(second.service, resumed, 'Recall the remembered word', 'second')
    expect(after.feed.filter(message => message.role === 'user').map(message => message.text)).toEqual(['Remember CEDAR', 'Recall the remembered word'])
    expect(requests[1].messages).toEqual(expect.arrayContaining([{ role: 'user', content: 'Remember CEDAR' }, { role: 'assistant', content: 'Actual HTTP fixture answer' }]))
    expect(requests.map(request => request.model)).toEqual(['actual-model', 'actual-model'])
    expect(second.registry.getAgentSession(resumed.sessionId)?.pid).toBeUndefined()
  })
})
