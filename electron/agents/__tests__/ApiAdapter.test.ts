import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiAdapter, type ApiAdapterOptions } from '../ApiAdapter'
import type { AgentEvent } from '../../../shared/agent-events'

interface RequestBody { reasoning_effort?: string; messages: Array<{ role: string; content?: string; tool_call_id?: string }>; tools: Array<{ function: { name: string } }>; model: string; stream_options: { include_usage: boolean } }
const roots: string[] = [], servers: http.Server[] = [], adapters: ApiAdapter[] = []
function sse(response: http.ServerResponse, records: unknown[], done = true) { response.setHeader('Content-Type', 'text/event-stream'); response.end(records.map(record => `data: ${JSON.stringify(record)}\r\n\r\n`).join('') + (done ? 'data: [DONE]\r\n\r\n' : '')) }
const answer = (content: string) => [{ choices: [{ index: 0, delta: { content }, finish_reason: null }] }, { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }, { choices: [], usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } }]
const toolCall = (name: string, args: unknown) => [{ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name, arguments: JSON.stringify(args).slice(0, 7) } }] }, finish_reason: null }] }, { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args).slice(7) } }] }, finish_reason: 'tool_calls' }] }]
async function fixture(handle: (body: RequestBody, response: http.ServerResponse, request: http.IncomingMessage) => void, overrides: Partial<ApiAdapterOptions> = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-api-adapter-'))); roots.push(root)
  const cwd = path.join(root, 'workspace'); fs.mkdirSync(cwd)
  const requests: RequestBody[] = []
  const server = http.createServer((request, response) => { let data = ''; request.on('data', chunk => data += chunk); request.on('end', () => { const body = JSON.parse(data) as RequestBody; requests.push(body); handle(body, response, request) }) })
  servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port, events: AgentEvent[] = [], logs: string[] = []
  const options: ApiAdapterOptions = { taskId: 'task', runId: 'run', worktreePath: cwd, historyDirectory: path.join(root, 'history'), connection: { id: 'local', name: 'Local fixture', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'fixture-model', enabled: true, hasApiKey: true, apiKey: 'fixture-secret-never-log' }, onEvent: event => events.push(event), onRawLog: (_stream, line) => logs.push(line), ...overrides }
  const adapter = new ApiAdapter(options); adapters.push(adapter)
  await adapter.start()
  return { adapter, options, events, logs, cwd, root, requests }
}
async function terminal(events: AgentEvent[], turnId: string) { await vi.waitFor(() => expect(events.some(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turnId && ['completed', 'error', 'stopped'].includes(event.status))).toBe(true)); return [...events].reverse().find(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turnId) }
afterEach(async () => { await Promise.all(adapters.splice(0).map(adapter => adapter.stop())); for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })

describe('real HTTP API adapter', () => {
  it('omits tools and rejects unsolicited API calls before any filesystem operation or approval', async () => {
    const { adapter, events, requests, cwd } = await fixture((_body, response) => sse(response, toolCall('write_file', { path: 'forbidden.txt', content: 'must not exist', expectedSha256: null })), { toolPolicy: 'none' })
    const turn = await adapter.sendPrompt({ taskId: 'task', text: 'Aggregate anonymous reports only' })
    expect(await terminal(events, turn.turnId)).toMatchObject({ status: 'error', error: expect.stringContaining('tool-free') })
    expect(requests).toHaveLength(1); expect(requests[0]).not.toHaveProperty('tools')
    expect(adapter.getCapabilities()).toMatchObject({ toolCalls: false, interactiveApprovals: false })
    expect(events.some(event => event.type === 'tool.started' || event.type === 'permission.requested')).toBe(false)
    expect(fs.existsSync(path.join(cwd, 'forbidden.txt'))).toBe(false)
  })

  it('sends explicit reasoning_effort and omits it after an explicit default reset on native context resume', async () => {
    const { adapter, options, events, requests } = await fixture((_body, response) => sse(response, answer('Done')), { reasoningEffort: 'none' })
    const first = await adapter.sendPrompt({ taskId: 'task', text: 'First' }); await terminal(events, first.turnId)
    expect(requests[0].reasoning_effort).toBe('none')
    await adapter.stop()
    const resumed = new ApiAdapter({ ...options, reasoningEffort: null, runId: 'run-default', resumeSessionId: adapter.getSessionId() }); adapters.push(resumed); await resumed.start()
    const next = await resumed.sendPrompt({ taskId: 'task', text: 'Next' }); await terminal(events, next.turnId)
    expect(requests[1]).not.toHaveProperty('reasoning_effort')
    expect(requests[1].messages).toContainEqual({ role: 'user', content: 'First' })
  })

  it('streams fragmented UTF-8, reports actual usage, and resumes two-turn context without an OS process', async () => {
    let call = 0
    const { adapter, options, events, logs, requests, root } = await fixture((body, response, request) => {
      expect(request.url).toBe('/v1/chat/completions'); expect(request.headers.authorization).toBe('Bearer fixture-secret-never-log'); expect(body.stream_options.include_usage).toBe(true)
      const content = ++call === 1 ? 'Ответ Ж🙂' : 'Remembered first prompt'
      const wire = Buffer.from(answer(content).map(record => `data: ${JSON.stringify(record)}\n\n`).join('') + 'data: [DONE]\n\n')
      const marker = wire.indexOf(Buffer.from('Ж'))
      response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.write(wire.subarray(0, marker < 0 ? 10 : marker + 1)); setTimeout(() => response.end(wire.subarray(marker < 0 ? 10 : marker + 1)), 2)
    })
    expect(adapter.getPid()).toBeUndefined()
    const first = await adapter.sendPrompt({ taskId: 'task', text: 'Remember unique word BASALT' }); expect(await terminal(events, first.turnId)).toMatchObject({ status: 'completed' })
    expect(events.filter(event => event.type === 'message.delta').map(event => event.content).join('')).toBe('Ответ Ж🙂')
    expect(events.find(event => event.type === 'usage.reported')).toMatchObject({ inputTokens: 11, outputTokens: 7, totalTokens: 18 })
    await adapter.stop()
    const resumed = new ApiAdapter({ ...options, runId: 'resumed-run', resumeSessionId: adapter.getSessionId() }); adapters.push(resumed); await resumed.start()
    const second = await resumed.sendPrompt({ taskId: 'task', text: 'What was the word?' }); await terminal(events, second.turnId)
    expect(requests[1].messages).toEqual(expect.arrayContaining([{ role: 'user', content: 'Remember unique word BASALT' }, { role: 'assistant', content: 'Ответ Ж🙂' }]))
    expect(logs.join('\n')).not.toContain('fixture-secret-never-log')
    expect(fs.readFileSync(path.join(root, 'history', `${adapter.getSessionId()}.json`), 'utf8')).not.toContain('fixture-secret-never-log')
  })
  it('waits for explicit write approval, streams tool results, and sends them back in the next API round', async () => {
    let round = 0
    const { adapter, events, cwd, requests } = await fixture((_body, response) => sse(response, ++round === 1 ? toolCall('write_file', { path: 'result.txt', content: 'approved content', expectedSha256: null }) : answer('Saved')))
    const turn = await adapter.sendPrompt({ taskId: 'task', text: 'Create a file' })
    await vi.waitFor(() => expect(events.some(event => event.type === 'permission.requested')).toBe(true))
    expect(fs.existsSync(path.join(cwd, 'result.txt'))).toBe(false)
    const approval = events.find(event => event.type === 'permission.requested')!
    await adapter.resolveApproval(approval.approvalId, 'allow')
    expect(await terminal(events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(fs.readFileSync(path.join(cwd, 'result.txt'), 'utf8')).toBe('approved content')
    expect(requests[1].messages.some(message => message.role === 'tool' && message.tool_call_id === 'call-1')).toBe(true)
    await expect(adapter.resolveApproval(approval.approvalId, 'allow')).rejects.toThrow('stale')
  })
  it('enforces reviewer read-only policy even when the endpoint injects an unadvertised write tool', async () => {
    let round = 0
    const { adapter, events, cwd, requests } = await fixture((_body, response) => sse(response, ++round === 1 ? toolCall('write_file', { path: 'forbidden.txt', content: 'no', expectedSha256: null }) : answer('Reviewed')), { readOnly: true })
    const turn = await adapter.sendPrompt({ taskId: 'task', text: 'Review only' }); await terminal(events, turn.turnId)
    expect(requests[0].tools.map(tool => tool.function.name)).not.toContain('write_file')
    expect(events.some(event => event.type === 'permission.requested')).toBe(false)
    expect(events.find(event => event.type === 'tool.completed')).toMatchObject({ isError: true, output: { error: 'Read-only policy forbids file writes' } })
    expect(fs.existsSync(path.join(cwd, 'forbidden.txt'))).toBe(false)
  })
  it('aborts a streaming request and permits a subsequent turn without late output or retries', async () => {
    let round = 0, closed = false
    const { adapter, events, requests } = await fixture((_body, response) => {
      if (++round === 1) { response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'partial' }, finish_reason: null }] })}\n\n`); response.on('close', () => { closed = true }) }
      else sse(response, answer('Second done'))
    })
    const turn = await adapter.sendPrompt({ taskId: 'task', text: 'Wait' })
    await vi.waitFor(() => expect(events.some(event => event.type === 'message.delta')).toBe(true))
    await adapter.interruptTurn(turn.turnId)
    expect(await terminal(events, turn.turnId)).toMatchObject({ status: 'stopped' })
    await vi.waitFor(() => expect(closed).toBe(true))
    const second = await adapter.sendPrompt({ taskId: 'task', text: 'Continue' }); expect(await terminal(events, second.turnId)).toMatchObject({ status: 'completed' })
    expect(requests).toHaveLength(2)
    expect(events.filter(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turn.turnId && event.status === 'stopped')).toHaveLength(1)
  })
  it.each(['http', 'truncated', 'invalid', 'limit'] as const)('reports %s failures honestly without retry or secrets in diagnostic errors', async mode => {
    const { adapter, events, requests, logs } = await fixture((_body, response) => {
      if (mode === 'http') { response.writeHead(401); response.end('fixture-secret-never-log provider-private-body') }
      else if (mode === 'truncated') sse(response, [{ choices: [{ index: 0, delta: { content: 'unfinished' }, finish_reason: null }] }], false)
      else if (mode === 'invalid') response.end('data: broken\n\n')
      else sse(response, answer('x'.repeat(1000)))
    }, { maxResponseBytes: mode === 'limit' ? 100 : undefined })
    const turn = await adapter.sendPrompt({ taskId: 'task', text: 'test' }); expect(await terminal(events, turn.turnId)).toMatchObject({ status: 'error' })
    expect(requests).toHaveLength(1)
    expect(JSON.stringify(events) + logs.join('')).not.toContain('fixture-secret-never-log')
    expect(events.some(event => event.type === 'usage.reported')).toBe(false)
  })
  it('Quit expires pending approval and closes the turn without writing the file', async () => {
    const { adapter, events, cwd } = await fixture((_body, response) => sse(response, toolCall('write_file', { path: 'never.txt', content: 'no', expectedSha256: null })))
    const turn = await adapter.sendPrompt({ taskId: 'task', text: 'Ask permission' })
    await vi.waitFor(() => expect(events.some(event => event.type === 'permission.requested')).toBe(true))
    await adapter.stop()
    expect(await terminal(events, turn.turnId)).toMatchObject({ status: 'stopped' })
    expect(events.find(event => event.type === 'permission.state.changed')).toMatchObject({ state: 'expired' })
    expect(adapter.getStatus()).toBe('stopped'); expect(fs.existsSync(path.join(cwd, 'never.txt'))).toBe(false)
  })
  it('rejects corrupt saved tool linkage locally without sending it to an endpoint', async () => {
    const { adapter, options, root, requests } = await fixture((_body, response) => sse(response, answer('unused')))
    await adapter.stop()
    const file = path.join(root, 'history', `${adapter.getSessionId()}.json`)
    fs.writeFileSync(file, JSON.stringify({ version: 1, taskId: 'task', turns: [{ messages: [{ role: 'user', content: 'history' }, { role: 'tool', content: 'unpaired output', tool_call_id: 'unknown' }] }] }))
    const resumed = new ApiAdapter({ ...options, resumeSessionId: adapter.getSessionId() }); adapters.push(resumed)
    await expect(resumed.start()).rejects.toThrow('Invalid saved API conversation messages')
    expect(requests).toHaveLength(0)
  })
})
