import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponsesAdapter, type ResponsesAdapterOptions } from '../ResponsesAdapter'
import type { AgentEvent } from '../../../shared/agent-events'

const directories: string[] = [], adapters: ResponsesAdapter[] = []
const id = (digit: string) => `resp_${digit.repeat(32)}`
const approvalId = `approval_${'a'.repeat(32)}`, questionId = `question_${'b'.repeat(32)}`
const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`
const grok = { version: 1, artifacts: [] }
const created = (responseId: string) => ({ type: 'response.created', response: { id: responseId, grok } })
const completed = (responseId: string, output: unknown[] = [], artifacts: unknown[] = []) => ({ type: 'response.completed', response: { id: responseId, status: 'completed', output, grok: { ...grok, artifacts } } })
const wire = (responseId: string, output: unknown[] = [], events: unknown[] = [], artifacts: unknown[] = []) => new Response(frame(created(responseId)) + events.map(frame).join('') + frame(completed(responseId, output, artifacts)))
type Body = Record<string, unknown>
async function fixture(handle: (url: string, body: Body | undefined, init: RequestInit) => Response | Promise<Response>, overrides: Partial<ResponsesAdapterOptions> = {}, cancellation?: () => Response) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-grok-'))); directories.push(root)
  const cwd = path.join(root, 'workspace'); fs.mkdirSync(cwd)
  const events: AgentEvent[] = [], requests: Array<{ url: string; body?: Body; init: RequestInit }> = []
  const options: ResponsesAdapterOptions = { taskId: 'task', runId: 'run', worktreePath: cwd, historyDirectory: path.join(root, 'history'), connection: { id: 'grok-fixture', name: 'Grok fixture', baseUrl: 'https://fixture.invalid/v1', model: 'grok-test', enabled: true, hasApiKey: false, transport: 'responses', profile: 'grok-connector-v1', grok: { contextWindow: 131072, maxTurns: 8 } }, onEvent: event => events.push(event), fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Body : undefined
    requests.push({ url: String(url), body, init: init! })
    if (String(url).endsWith('/cancel')) return cancellation?.() ?? Response.json({ id: String(url).split('/').at(-2), status: 'cancelled', grok })
    return handle(String(url), body, init!)
  }), ...overrides }
  const adapter = new ResponsesAdapter(options); adapters.push(adapter); await adapter.start()
  return { root, cwd, options, adapter, events, requests }
}
async function terminal(events: AgentEvent[], turnId: string) {
  await vi.waitFor(() => expect(events.some(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turnId && ['completed', 'error', 'stopped'].includes(event.status))).toBe(true))
  return [...events].reverse().find(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turnId)
}
afterEach(async () => { await Promise.all(adapters.splice(0).map(adapter => adapter.stop())); vi.restoreAllMocks(); directories.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })

describe('Grok Responses profile and native interaction ownership', () => {
  it('reasserts the trusted client workspace and exact native allowlist on every caller continuation', async () => {
    let round = 0
    const state = await fixture(() => ++round === 1 ? wire(id('1'), [{ id: 'fc_one', type: 'function_call', status: 'completed', call_id: 'native.caller/one', name: 'list_files', arguments: '{"path":"."}' }]) : wire(id('2')))
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Inspect' })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    const requests = state.requests.filter(request => request.url.endsWith('/responses'))
    expect(requests).toHaveLength(2)
    for (const request of requests) expect(request.body?.grok).toEqual({ clientWorkspace: state.cwd, permissionMode: 'default', allowedTools: ['web_search', 'web_fetch', 'image_gen', 'image_edit', 'ask_user_question'], contextWindow: 131072, maxTurns: 8 })
    expect(requests[1].body).toMatchObject({ previous_response_id: id('1'), input: [{ type: 'function_call_output', call_id: 'native.caller/one' }] })
    const resume = new ResponsesAdapter({ ...state.options, connection: { ...state.options.connection, grok: { contextWindow: 65536, maxTurns: 8 } }, resumeSessionId: state.adapter.getSessionId() }); adapters.push(resume)
    await expect(resume.start()).rejects.toThrow('trusted context')
  })
  it('restricts read-only native tools and rejects a requested tool-free connector', async () => {
    const state = await fixture(() => wire(id('1')), { readOnly: true })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Review' }); await terminal(state.events, turn.turnId)
    expect(state.requests[0].body?.grok).toMatchObject({ permissionMode: 'read-only', allowedTools: ['web_search', 'web_fetch'] })
    expect(state.requests[0].body?.tools).not.toContainEqual(expect.objectContaining({ name: 'write_file' }))
    expect(() => new ResponsesAdapter({ ...state.options, toolPolicy: 'none' })).toThrow('tool-free')
  })
  it('waits for explicit exact approval and keeps hosted progress observation-only', async () => {
    let finish!: () => void
    const event = { type: 'grok.approval', version: 1, response_id: id('1'), sequence_number: 2, approval: { id: approvalId, expires_in: 120, request: { sessionId: 'native-session', toolCall: { toolCallId: 'web-call', title: 'Fetch webpage' }, options: [{ optionId: 'native-allow', name: 'Allow once', kind: 'allow_once' }, { optionId: 'native-reject', name: 'Reject', kind: 'reject_once' }] } } }
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode(frame(created(id('1'))) + frame({ type: 'grok.tool', version: 1, response_id: id('1'), sequence_number: 1, tool: { id: 'web-call', name: 'web_fetch', status: 'in_progress', input: { url: 'https://example.invalid' } } }) + frame(event)))
      finish = () => { controller.enqueue(new TextEncoder().encode(frame(completed(id('1'))))); controller.close() }
    } })
    const state = await fixture((url, body) => {
      if (url.includes('/grok/approvals/')) { expect(body).toEqual({ optionId: 'native-reject' }); finish(); return Response.json({ id: approvalId, answered: true }) }
      return new Response(stream)
    })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Fetch' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'interaction.requested')).toBe(true))
    expect(state.requests).toHaveLength(1)
    expect(state.events.some(event => event.type === 'permission.requested')).toBe(false)
    expect(state.events.find(event => event.type === 'tool.started')).toMatchObject({ executor: 'provider', toolName: 'web_fetch' })
    await expect(state.adapter.resolveInteraction({ taskId: 'task', runId: 'run', turnId: turn.turnId, interactionId: approvalId, answer: { kind: 'approval', optionId: 'allow' } })).rejects.toThrow('offered')
    await state.adapter.resolveInteraction({ taskId: 'task', runId: 'run', turnId: turn.turnId, interactionId: approvalId, answer: { kind: 'approval', optionId: 'native-reject' } })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.events.find(event => event.type === 'interaction.state.changed')).toMatchObject({ state: 'resolved', answer: { kind: 'approval', optionId: 'native-reject' } })
    await expect(state.adapter.resolveInteraction({ taskId: 'task', turnId: turn.turnId, interactionId: approvalId, answer: { kind: 'approval', optionId: 'native-reject' } })).rejects.toThrow('stale')
    expect(state.requests.filter(request => request.url.includes('/approvals/'))).toHaveLength(1)
  })
  it('sends plan question outcomes separately and never replays a resolved answer', async () => {
    let finish!: () => void
    const question = { type: 'grok.question', version: 1, response_id: id('1'), sequence_number: 1, question: { id: questionId, request: { sessionId: 'native-session', toolCallId: 'question-call', mode: 'plan', expiresAt: new Date(Date.now() + 600000).toISOString(), questions: [{ question: 'What next?', options: [{ label: 'Discuss', description: 'Talk first' }], multiSelect: false }] } } }
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(frame(created(id('1'))) + frame(question))); finish = () => { controller.enqueue(new TextEncoder().encode(frame(completed(id('1'))))); controller.close() } } })
    const state = await fixture((url, body) => { if (url.includes('/questions/')) { expect(body).toEqual({ outcome: 'chat_about_this', partial_answers: { 'What next?': 'Discuss' } }); finish(); return Response.json({ id: questionId, answered: true }) } return new Response(stream) })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Plan' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'interaction.requested')).toBe(true))
    await state.adapter.resolveInteraction({ taskId: 'task', runId: 'run', turnId: turn.turnId, interactionId: questionId, answer: { kind: 'question', outcome: 'chat_about_this', partial_answers: { 'What next?': 'Discuss' } } })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.requests.filter(request => request.url.includes('/questions/'))).toHaveLength(1)
  })
  it('verifies native image metadata against one standard image callback without a second GET', async () => {
    const bytes = Buffer.from('fixture raster bytes'), sha256 = createHash('sha256').update(bytes).digest('hex'), artifactId = `file_${'c'.repeat(32)}`
    const artifact = { id: artifactId, object: 'file', kind: 'image', mime_type: 'image/png', bytes: bytes.length, sha256, api_url: `/v1/files/${artifactId}/content`, owner_url: `/api/artifacts/${artifactId}/content` }
    const sink = vi.fn(async () => ({ id: 'media-11111111-1111-4111-8111-111111111111', sourceRunId: 'run', mime: 'image/png' as const, bytes: bytes.length, sha256, width: 1, height: 1 }))
    const item = { id: 'ig_standard', type: 'image_generation_call', status: 'completed', result: bytes.toString('base64') }
    const state = await fixture(() => wire(id('1'), [item], [{ type: 'grok.artifact', version: 1, response_id: id('1'), sequence_number: 1, artifact }, { type: 'response.output_item.done', output_index: 0, item }], [artifact]), { storeMedia: sink })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Image' }); expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(sink).toHaveBeenCalledTimes(1)
    expect(state.events.filter(event => event.type === 'tool.completed' && event.media)).toHaveLength(1)
    expect(state.requests.every(request => request.url.endsWith('/responses'))).toBe(true)
    expect(JSON.stringify(state.events)).not.toContain(bytes.toString('base64'))
  })
  it('supports owned image-only input without putting encoded bytes into saved history', async () => {
    const state = await fixture(() => wire(id('1')))
    const imageId = 'input-image-11111111-1111-4111-8111-111111111111', dataUrl = 'data:image/png;base64,aW1hZ2U='
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: '', inputImages: [{ id: imageId, mime: 'image/png', dataUrl }] })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.requests[0].body?.input).toEqual([{ role: 'user', content: [{ type: 'input_image', image_url: dataUrl }] }])
    expect(fs.readFileSync(path.join(state.options.historyDirectory, `${state.adapter.getSessionId()}.json`), 'utf8')).not.toContain(dataUrl)
  })
  it('rejects an unverified artifact digest and confirms cancellation instead of retrying', async () => {
    const artifactId = `file_${'d'.repeat(32)}`
    const artifact = { id: artifactId, object: 'file', kind: 'image', mime_type: 'image/png', bytes: 4, sha256: '0'.repeat(64), api_url: `/v1/files/${artifactId}/content`, owner_url: `/api/artifacts/${artifactId}/content` }
    const sink = vi.fn()
    const state = await fixture(() => wire(id('1'), [{ id: 'ig_mismatch', type: 'image_generation_call', status: 'completed', result: Buffer.from('test').toString('base64') }], [{ type: 'grok.artifact', version: 1, response_id: id('1'), sequence_number: 1, artifact }], [artifact]), { storeMedia: sink })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Image' })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error', error: expect.stringContaining('artifact metadata') })
    expect(sink).not.toHaveBeenCalled()
    expect(state.requests.filter(request => request.url.endsWith('/responses'))).toHaveLength(1)
    expect(state.requests.filter(request => request.url.endsWith('/cancel'))).toHaveLength(1)
  })
  it('leaves a wrong cancellation acknowledgement uncertain and blocks resume without replay', async () => {
    const event = { type: 'grok.tool', version: 2, response_id: id('1'), sequence_number: 1, tool: { id: 'web-call', name: 'web_search', status: 'completed' } }
    const state = await fixture(() => wire(id('1'), [], [event]), {}, () => Response.json({ id: id('2'), status: 'cancelled', grok }))
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Search' })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error', error: expect.stringContaining('cancellation could not be confirmed') })
    const saved = JSON.parse(fs.readFileSync(path.join(state.options.historyDirectory, `${state.adapter.getSessionId()}.json`), 'utf8'))
    expect(saved.pending).toMatchObject({ state: 'uncertain', responseId: id('1') })
    const resumed = new ResponsesAdapter({ ...state.options, resumeSessionId: state.adapter.getSessionId() }); adapters.push(resumed)
    await expect(resumed.start()).rejects.toThrow('uncertain unfinished transaction')
    expect(state.requests.filter(request => request.url.endsWith('/responses'))).toHaveLength(1)
  })
  it('projects an expired native question without submitting any answer', async () => {
    const event = { type: 'grok.question', version: 1, response_id: id('1'), sequence_number: 1, question: { id: questionId, request: { sessionId: 'native-session', toolCallId: 'question-call', mode: 'default', expiresAt: new Date(Date.now() - 1000).toISOString(), questions: [{ question: 'Continue?', options: [], multiSelect: false }] } } }
    const state = await fixture(() => wire(id('1'), [], [event]))
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Plan' }); await terminal(state.events, turn.turnId)
    expect(state.events.find(event => event.type === 'interaction.requested')).toMatchObject({ interaction: { state: 'expired' } })
    await expect(state.adapter.resolveInteraction({ taskId: 'task', turnId: turn.turnId, interactionId: questionId, answer: { kind: 'question', outcome: 'cancelled' } })).rejects.toThrow('stale')
    expect(state.requests.some(request => request.url.includes('/questions/'))).toBe(false)
  })
})
