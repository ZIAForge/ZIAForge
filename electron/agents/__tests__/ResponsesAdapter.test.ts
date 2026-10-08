import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponsesAdapter, type ResponsesAdapterOptions } from '../ResponsesAdapter'
import { ApiFileTools } from '../../api/ApiFileTools'
import { LOCAL_COMMAND_SUPPORTED } from '../LocalCommandTool'
import type { AgentEvent } from '../../../shared/agent-events'
import type { AgentMediaRef } from '../../../shared/agent-media'

type Body = { model: string; instructions: string; input: Array<{ type?: string; call_id?: string; output?: string; role?: string; content?: string }>; previous_response_id?: string; tools?: Array<{ type: string; name: string; function?: unknown }>; tool_choice?: string; reasoning?: { effort: string } }
const roots: string[] = [], adapters: ResponsesAdapter[] = []
const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`
const message = (text: string) => ({ id: 'msg_answer', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text }] })
const call = (name: string, input: unknown) => ({ id: 'fc_item', call_id: 'original.call/id', type: 'function_call', status: 'completed', name, arguments: JSON.stringify(input) })
const finished = (id: string, output: unknown[], usage?: Record<string, number>) => ({ type: 'response.completed', response: { id, status: 'completed', output, ...(usage ? { usage } : {}) } })
const wire = (id: string, output: unknown[], extra: unknown[] = []) => new Response(frame({ type: 'response.created', response: { id, status: 'in_progress' } }) + extra.map(frame).join('') + frame(finished(id, output, { input_tokens: 9, output_tokens: 4, total_tokens: 13 })), { headers: { 'Content-Type': 'text/event-stream' } })
function deferred() { let resolve!: () => void; const promise = new Promise<void>(accept => { resolve = accept }); return { promise, resolve } }
async function fixture(handle: (body: Body, init: RequestInit, url: string) => Response | Promise<Response>, overrides: Partial<ResponsesAdapterOptions> = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-responses-'))); roots.push(root)
  const cwd = path.join(root, 'workspace'); fs.mkdirSync(cwd)
  const events: AgentEvent[] = [], requests: Body[] = [], urls: string[] = [], logs: string[] = []
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    urls.push(String(url)); const body = init?.body ? JSON.parse(String(init.body)) as Body : undefined
    if (body) requests.push(body)
    return handle(body as Body, init!, String(url))
  }) as unknown as typeof fetch
  const options: ResponsesAdapterOptions = { taskId: 'task', runId: 'run', worktreePath: cwd, historyDirectory: path.join(root, 'history'), connection: { id: 'fixture', name: 'Fixture', baseUrl: 'https://fixture.invalid/v1', model: 'fixture-model', enabled: true, hasApiKey: true, apiKey: 'fixture-secret', transport: 'responses' }, fetch: fetcher, onEvent: event => events.push(event), onRawLog: (_stream, line) => logs.push(line), ...overrides }
  const adapter = new ResponsesAdapter(options); adapters.push(adapter); await adapter.start()
  const history = path.join(options.historyDirectory, `${adapter.getSessionId()}.json`)
  return { adapter, options, events, requests, urls, logs, cwd, root, history }
}
async function terminal(events: AgentEvent[], turnId: string, timeoutMs = 1000) {
  await vi.waitFor(() => expect(events.some(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turnId && ['completed', 'error', 'stopped'].includes(event.status))).toBe(true), { timeout: timeoutMs })
  return [...events].reverse().find(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turnId)
}
afterEach(async () => { await Promise.all(adapters.splice(0).map(adapter => adapter.stop())); vi.restoreAllMocks(); roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })

describe('ResponsesAdapter caller execution and durable continuation', () => {
  it('flattens standard functions, returns original call_id and resumes only the last acknowledged response', async () => {
    let round = 0
    const state = await fixture(() => ++round === 1 ? wire('resp_first', [call('list_files', { path: '.' })]) : wire(`resp_${round}`, [message('Ответ 🙂')]), { reasoningEffort: 'high' })
    const first = await state.adapter.sendPrompt({ taskId: 'task', text: 'Inspect files' })
    expect(await terminal(state.events, first.turnId)).toMatchObject({ status: 'completed' })
    expect(state.requests[0].tools?.every(tool => tool.type === 'function' && !tool.function)).toBe(true)
    expect(state.requests[0].instructions).toContain(state.cwd)
    expect(state.requests[0].reasoning).toEqual({ effort: 'high' })
    expect(state.requests[1].previous_response_id).toBe('resp_first')
    expect(state.requests[1].input).toEqual([{ type: 'function_call_output', call_id: 'original.call/id', output: expect.stringContaining('entries') }])
    expect(state.events.find(event => event.type === 'usage.reported')).toMatchObject({ inputTokens: 9, outputTokens: 4, totalTokens: 13 })
    await state.adapter.stop()
    const resumed = new ResponsesAdapter({ ...state.options, runId: 'resumed', resumeSessionId: state.adapter.getSessionId() }); adapters.push(resumed); await resumed.start()
    expect(state.requests).toHaveLength(2)
    const second = await resumed.sendPrompt({ taskId: 'task', text: 'Continue' }); await terminal(state.events, second.turnId)
    expect(state.requests[2]).toMatchObject({ previous_response_id: 'resp_2', input: [{ role: 'user', content: 'Continue' }] })
    expect(state.urls.every(url => url.endsWith('/responses'))).toBe(true)
    expect(state.logs.join('') + fs.readFileSync(state.history, 'utf8')).not.toContain('fixture-secret')
  })

  it('replaces transient streamed commentary with the authoritative completed final answer', async () => {
    const state = await fixture(() => new Response(frame({ type: 'response.created', response: { id: 'resp_snapshot', status: 'in_progress' } }) + frame({ type: 'response.output_text.delta', delta: 'Checking the project first...' }) + frame({ type: 'response.completed', response: { id: 'resp_snapshot', status: 'completed', output: [message('Final answer')], output_text: 'Final answer' } }), { headers: { 'Content-Type': 'text/event-stream' } }))
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Inspect' })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.events.find(event => event.type === 'message.delta')).toMatchObject({ content: 'Checking the project first...' })
    expect(state.events.find(event => event.type === 'message.completed')).toMatchObject({ fullContent: 'Final answer' })
  })

  it('persists write intent before touching disk and result before requesting the next round', async () => {
    let round = 0, historyFile = ''
    const state = await fixture(() => {
      if (++round === 1) return wire('resp_write', [call('write_file', { path: 'result.txt', content: 'approved', expectedSha256: null })])
      const saved = JSON.parse(fs.readFileSync(historyFile, 'utf8'))
      expect(saved.seenCallIds).toContain('original.call/id')
      return wire('resp_done', [message('Saved')])
    })
    historyFile = state.history
    const execute = ApiFileTools.prototype.execute
    const spy = vi.spyOn(ApiFileTools.prototype, 'execute').mockImplementation(function (this: ApiFileTools, name, input) {
      const saved = JSON.parse(fs.readFileSync(historyFile, 'utf8'))
      expect(saved.pending).toMatchObject({ state: 'executing', calls: [{ name: 'write_file', state: 'executing' }] })
      return execute.call(this, name, input)
    })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Write a file' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'permission.requested')).toBe(true))
    expect(fs.existsSync(path.join(state.cwd, 'result.txt'))).toBe(false)
    const approval = state.events.find(event => event.type === 'permission.requested')!
    await state.adapter.resolveApproval(approval.approvalId, 'allow')
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(path.join(state.cwd, 'result.txt'), 'utf8')).toBe('approved')
    await expect(state.adapter.resolveApproval(approval.approvalId, 'allow')).rejects.toThrow('stale')
    expect(JSON.parse(fs.readFileSync(state.history, 'utf8'))).not.toHaveProperty('pending')
  })

  it('denial never executes and read-only policy forbids an injected command or write', async () => {
    let round = 0
    const state = await fixture(() => ++round === 1 ? wire('resp_denied', [call('write_file', { path: 'denied.txt', content: 'no', expectedSha256: null })]) : wire('resp_done', [message('Denied')]))
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Write' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'permission.requested')).toBe(true))
    await state.adapter.resolveApproval(state.events.find(event => event.type === 'permission.requested')!.approvalId, 'deny')
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(fs.existsSync(path.join(state.cwd, 'denied.txt'))).toBe(false)
    expect(state.events.find(event => event.type === 'tool.completed')).toMatchObject({ outcome: 'declined', isError: true })
    let reviewRound = 0
    const review = await fixture(() => ++reviewRound === 1 ? wire('resp_review', [call('run_command', { executable: '/bin/pwd', args: [], timeoutMs: null })]) : wire('resp_review_done', [message('Reviewed')]), { readOnly: true, connection: { ...state.options.connection, allowCommands: true } })
    const reviewTurn = await review.adapter.sendPrompt({ taskId: 'task', text: 'Review' }); await terminal(review.events, reviewTurn.turnId)
    expect(review.requests[0].tools?.map(tool => tool.name)).not.toContain('write_file')
    expect(review.requests[0].tools?.map(tool => tool.name)).not.toContain('run_command')
    expect(review.events.some(event => event.type === 'permission.requested')).toBe(false)
    expect(review.events.find(event => event.type === 'tool.completed')).toMatchObject({ isError: true })
  })

  it.skipIf(!LOCAL_COMMAND_SUPPORTED)('always requests high-risk owner approval before an actual local command', async () => {
    let round = 0
    const state = await fixture(() => ++round === 1 ? wire('resp_command', [call('run_command', { executable: '/bin/pwd', args: [], timeoutMs: null })]) : wire('resp_command_done', [message('Done')]), { connection: { id: 'fixture', name: 'Fixture', baseUrl: 'https://fixture.invalid/v1', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'responses', allowCommands: true } })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Run pwd' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'permission.requested')).toBe(true))
    const approval = state.events.find(event => event.type === 'permission.requested')!
    expect(approval).toMatchObject({ riskLevel: 'high', decisionOptions: ['allow', 'deny'] })
    expect(approval.description).toContain('not an OS sandbox')
    expect(state.events.some(event => event.type === 'tool.completed')).toBe(false)
    await state.adapter.resolveApproval(approval.approvalId, 'allow')
    // The real supervised process also flushes its receipt and drains owned descendants.
    expect(await terminal(state.events, turn.turnId, 5000)).toMatchObject({ status: 'completed' })
    expect(state.events.find(event => event.type === 'tool.completed')).toMatchObject({ output: { stdout: `${state.cwd}\n`, cleanupVerified: true } })
    expect(state.requests[0].tools?.map(tool => tool.name)).toContain('run_command')
  }, 10_000)

  it('rejects tool-free connector sessions and fails generic unsolicited calls without approvals', async () => {
    const state = await fixture(() => wire('resp_bad', [call('write_file', { path: 'no.txt', content: 'no', expectedSha256: null })]), { toolPolicy: 'none' })
    expect(() => new ResponsesAdapter({ ...state.options, connection: { ...state.options.connection, profile: 'codex-connector' } })).toThrow('tool-free')
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Aggregate reports' })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error', error: expect.stringContaining('tool-free') })
    expect(state.requests[0]).toMatchObject({ tool_choice: 'none' }); expect(state.requests[0]).not.toHaveProperty('tools')
    expect(state.events.some(event => event.type === 'permission.requested' || event.type === 'tool.started')).toBe(false)
  })

  it('maps actual unversioned native observations without dispatching any local command', async () => {
    const state = await fixture(() => wire('resp_hosted', [message('Done')], [
      { type: 'codex.tool', method: 'item/started', params: { item: { id: 'remote_command', type: 'commandExecution', command: '/bin/pwd', cwd: '/remote/workspace' } }, sequence_number: 1 },
      { type: 'codex.tool', method: 'item/commandExecution/outputDelta', params: { itemId: 'remote_command', delta: '/remote/workspace\n' }, sequence_number: 2 },
      { type: 'codex.tool', method: 'item/completed', params: { item: { id: 'remote_command', type: 'commandExecution', exitCode: 0, aggregatedOutput: '/remote/workspace\n' } }, sequence_number: 3 },
    ]), { connection: { id: 'fixture', name: 'Connector', baseUrl: 'https://fixture.invalid/v1', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'responses', profile: 'codex-connector' } })
    const local = vi.spyOn(ApiFileTools.prototype, 'execute')
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Observe' }); await terminal(state.events, turn.turnId)
    expect(local).not.toHaveBeenCalled()
    expect(state.events.find(event => event.type === 'tool.started')).toMatchObject({ toolName: 'command_exec', executor: 'provider', input: { command: '/bin/pwd', cwd: '/remote/workspace' } })
    expect(state.events.find(event => event.type === 'tool.output.delta')).toMatchObject({ delta: '/remote/workspace\n' })
    expect(state.events.filter(event => event.type === 'tool.completed')).toHaveLength(1)
    expect(state.requests).toHaveLength(1)
  })

  it('ignores connector extensions under generic profile and bounds selected hosted output', async () => {
    const hostedStart = { type: 'codex.tool', method: 'item/started', params: { item: { id: 'remote_command', type: 'commandExecution', command: 'pwd' } }, sequence_number: 1 }
    const generic = await fixture(() => wire('resp_generic', [message('Done')], [hostedStart]))
    const turn = await generic.adapter.sendPrompt({ taskId: 'task', text: 'Answer' })
    expect(await terminal(generic.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(generic.events.some(event => event.type === 'tool.started')).toBe(false)
    const bounded = await fixture((_body, _init, url) => url.endsWith('/cancel') ? new Response(null, { status: 204 }) : wire('resp_bounded', [], [hostedStart, ...[2, 3, 4].map(sequence_number => ({ type: 'codex.tool', method: 'item/commandExecution/outputDelta', params: { itemId: 'remote_command', delta: 'x'.repeat(100_000) }, sequence_number }))]), { connection: { ...generic.options.connection, profile: 'codex-connector' } })
    const boundedTurn = await bounded.adapter.sendPrompt({ taskId: 'task', text: 'Observe' })
    expect(await terminal(bounded.events, boundedTurn.turnId)).toMatchObject({ status: 'error', error: expect.stringContaining('bounded turn limit') })
    expect(bounded.events.filter(event => event.type === 'tool.output.delta').reduce((sum, event) => sum + event.delta.length, 0)).toBeLessThanOrEqual(256 * 1024)
    expect(bounded.urls).toHaveLength(2)
  })

  it('awaits the private image sink and emits metadata only', async () => {
    const entered = deferred(), gate = deferred(), base64 = Buffer.from('fixture image bytes').toString('base64')
    const media: AgentMediaRef = { id: 'media-12345678-1234-1234-1234-123456789abc', sourceRunId: 'run', mime: 'image/png', bytes: 19, sha256: 'a'.repeat(64), width: 1, height: 1 }
    const state = await fixture(() => wire('resp_image', [{ id: 'image_item', type: 'image_generation_call', status: 'completed', result: base64 }], [{ type: 'codex.tool', method: 'item/completed', params: { item: { id: 'different_native_image_id', type: 'imageGeneration', status: 'completed' } }, sequence_number: 1 }]), { connection: { id: 'fixture', name: 'Connector', baseUrl: 'https://fixture.invalid/v1', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'responses', profile: 'codex-connector' }, storeMedia: async (_id, bytes, signal) => { expect(bytes).toBe(base64); signal.throwIfAborted(); entered.resolve(); await gate.promise; return media } })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Create an image' }); await entered.promise
    expect(state.events.some(event => event.type === 'tool.completed')).toBe(false)
    gate.resolve(); expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.events.find(event => event.type === 'tool.completed')).toMatchObject({ media: [media], output: { mediaId: media.id } })
    expect(state.events.filter(event => event.type === 'tool.started')).toHaveLength(1)
    expect(state.events.filter(event => event.type === 'tool.completed')).toHaveLength(1)
    expect(JSON.stringify(state.events) + fs.readFileSync(state.history, 'utf8')).not.toContain(base64)
  })

  it('refuses a changed identity or uncertain executing intent locally, with no replay or retrieval', async () => {
    const state = await fixture(() => wire('resp_unused', [message('Unused')]))
    await state.adapter.stop()
    const changed = new ResponsesAdapter({ ...state.options, model: 'another-model', resumeSessionId: state.adapter.getSessionId() }); adapters.push(changed)
    await expect(changed.start()).rejects.toThrow('does not match')
    const saved = JSON.parse(fs.readFileSync(state.history, 'utf8'))
    saved.pending = { turnId: 'turn_crashed', state: 'executing', responseId: 'resp_crashed', calls: [{ id: 'fc_crashed', callId: 'call_crashed', name: 'write_file', arguments: '{}', state: 'executing' }] }
    fs.writeFileSync(state.history, JSON.stringify(saved))
    const resumed = new ResponsesAdapter({ ...state.options, resumeSessionId: state.adapter.getSessionId() }); adapters.push(resumed)
    await expect(resumed.start()).rejects.toThrow('uncertain unfinished transaction')
    expect(state.requests).toHaveLength(0); expect(state.urls).toHaveLength(0)
  })

  it('enforces an explicit transport-byte limit without exposing response bodies or retrying', async () => {
    const state = await fixture(() => wire('resp_large', [message('x'.repeat(1000))]), { maxResponseBytes: 100 })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Answer' })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error', error: expect.stringContaining('bounded transport limit') })
    expect(state.requests).toHaveLength(1)
    expect(state.events.some(event => event.type === 'usage.reported')).toBe(false)
    expect(JSON.stringify(state.events) + state.logs.join('')).not.toContain('fixture-secret')
  })

  it('owns connector cancel after abort and rejects late approval without retries', async () => {
    let stream!: ReadableStreamDefaultController<Uint8Array>
    const state = await fixture((_body, init, url) => {
      if (url.endsWith('/cancel')) { expect(init.signal?.aborted).toBe(false); return new Response(null, { status: 204 }) }
      return new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller; controller.enqueue(new TextEncoder().encode(frame({ type: 'response.created', response: { id: 'resp_owned', status: 'in_progress' } }) + frame({ type: 'response.output_text.delta', delta: 'partial' }))) } }), { headers: { 'Content-Type': 'text/event-stream' } })
    }, { connection: { id: 'fixture', name: 'Connector', baseUrl: 'https://fixture.invalid/v1', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'responses', profile: 'codex-connector' } })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Wait' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'message.delta')).toBe(true))
    await state.adapter.interruptTurn(turn.turnId)
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'stopped' })
    expect(state.urls).toEqual(['https://fixture.invalid/v1/responses', 'https://fixture.invalid/v1/responses/resp_owned/cancel'])
    expect(state.requests).toHaveLength(1)
    expect(() => stream.enqueue(new TextEncoder().encode('late'))).toThrow()
    await expect(state.adapter.resolveApproval('unknown', 'allow')).rejects.toThrow('stale')
  })

  it('cancels the owned connector response when Stop interrupts approval after function-call HTTP completion', async () => {
    const state = await fixture((_body, _init, url) => url.endsWith('/cancel') ? new Response(null, { status: 204 }) : wire('resp_waiting_owner', [call('write_file', { path: 'never.txt', content: 'no', expectedSha256: null })]), { connection: { id: 'fixture', name: 'Connector', baseUrl: 'https://fixture.invalid/v1', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'responses', profile: 'codex-connector' } })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Write' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'permission.requested')).toBe(true))
    const approval = state.events.find(event => event.type === 'permission.requested')!
    await state.adapter.interruptTurn(turn.turnId)
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'stopped' })
    expect(state.urls).toEqual(['https://fixture.invalid/v1/responses', 'https://fixture.invalid/v1/responses/resp_waiting_owner/cancel'])
    expect(fs.existsSync(path.join(state.cwd, 'never.txt'))).toBe(false)
    expect(state.events.find(event => event.type === 'permission.state.changed')).toMatchObject({ state: 'expired' })
    await expect(state.adapter.resolveApproval(approval.approvalId, 'allow')).rejects.toThrow('stale')
  })
})
