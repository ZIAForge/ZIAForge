import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClaudeMessagesAdapter, type ClaudeMessagesAdapterOptions } from '../ClaudeMessagesAdapter'
import { ApiFileTools } from '../../api/ApiFileTools'
import { LOCAL_COMMAND_SUPPORTED } from '../LocalCommandTool'
import type { AgentEvent } from '../../../shared/agent-events'
import { claudeFrame, claudeRecords, claudeWire, responseId } from '../../api/__tests__/claudeFixture'
const roots: string[] = [], adapters: ClaudeMessagesAdapter[] = []
type Body = { previous_response_id?: string; messages: Array<{ role: string; content: Array<Record<string, unknown>> }>; tools: Array<{ name: string; input_schema: unknown }>; claude: { mode: string; nativeTools: string[] }; system: string }
async function fixture(handler: (body: Body | undefined, url: string, init?: RequestInit) => Promise<Response> | Response, options: Partial<ClaudeMessagesAdapterOptions> = {}, discovery: { model?: Record<string, unknown>; capabilities?: Record<string, unknown> } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-claude-messages-'))); roots.push(root)
  const cwd = path.join(root, 'workspace'); fs.mkdirSync(cwd)
  const events: AgentEvent[] = [], requests: Body[] = [], urls: string[] = []
  const configured: ClaudeMessagesAdapterOptions = { taskId: 'task', runId: 'run', worktreePath: cwd, historyDirectory: path.join(root, 'history'), connection: { id: 'fixture', name: 'Claude fixture', enabled: true, hasApiKey: true, apiKey: 'private-fixture-key', model: 'fixture-model', baseUrl: 'https://fixture.invalid', transport: 'anthropic-messages', profile: 'claude-connector-v1' }, onEvent: event => events.push(event), fetch: (async (url, init) => {
    const target = String(url); urls.push(target)
    if (target.endsWith('/models')) return Response.json({ object: 'list', has_more: false, data: [{ id: 'fixture-model', type: 'model', object: 'model', display_name: 'Fixture model', owned_by: 'native-claude', reasoning_efforts: ['high'], input_modalities: ['text', 'image'], context_windows: [], is_default: false, ...discovery.model }] })
    if (target.endsWith('/capabilities')) return Response.json(discovery.capabilities ?? { version: 1, provider: 'claude', toolCatalog: ['Read', 'Write', 'AskUserQuestion'], discoveredTools: ['Read', 'Write', 'AskUserQuestion'].map(name => ({ name, available: true, enabled: true })) })
    if (target.endsWith('/cancel')) return Response.json({ id: target.split('/').at(-2), status: 'cancelled' })
    const body = init?.body ? JSON.parse(String(init.body)) as Body : undefined
    if (target.endsWith('/messages') && body) requests.push(body)
    return handler(body, target, init)
  }) as typeof fetch, ...options }
  const adapter = new ClaudeMessagesAdapter(configured); adapters.push(adapter); await adapter.start()
  return { adapter, events, requests, urls, options: configured, cwd, root, history: path.join(configured.historyDirectory, `${adapter.getSessionId()}.json`) }
}
async function terminal(events: AgentEvent[], turnId: string, timeout = 4000) {
  await vi.waitFor(() => expect(events.some(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turnId && ['completed', 'error', 'stopped'].includes(event.status))).toBe(true), { timeout })
  return [...events].reverse().find(event => event.type === 'agent.status.changed' && event.scope === 'turn' && event.turnId === turnId)
}
afterEach(async () => { vi.useRealTimers(); await Promise.all(adapters.splice(0).map(adapter => adapter.stop())); vi.restoreAllMocks(); roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })
describe('Claude Messages caller and native execution boundaries', () => {
  it('requires an enabled discovered native tool as well as profile membership before starting a request', async () => {
    const handler = vi.fn(() => claudeWire(1, [{ type: 'text', text: 'Done' }]))
    const connection: ClaudeMessagesAdapterOptions['connection'] = { id: 'fixture', name: 'Native', baseUrl: 'https://fixture.invalid', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'anthropic-messages', profile: 'claude-connector-v1', claude: { mode: 'native', nativeTools: ['Write'] } }
    for (const discoveredTools of [[{ name: 'Write', available: true, enabled: false }], [{ name: 'Write', available: false, enabled: true }], []]) {
      await expect(fixture(handler, { connection }, { capabilities: { version: 1, provider: 'claude', toolCatalog: ['Write'], discoveredTools, effectiveTools: ['Write'] } })).rejects.toThrow('unavailable or disabled')
    }
    expect(handler).not.toHaveBeenCalled()
    // An unrelated session's empty/narrowed observed tools do not revoke the enabled connector profile.
    const state = await fixture(handler, { connection }, { capabilities: { version: 1, provider: 'claude', toolCatalog: ['Write'], discoveredTools: [{ name: 'Write', available: true, enabled: true, verified: false }], effectiveTools: [] } })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Begin' }); expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
  })
  it('uses explicit per-model manual thinking discovery without model-name inference', async () => {
    const handler = vi.fn(() => claudeWire(1, [{ type: 'text', text: 'Done' }]))
    const connection: ClaudeMessagesAdapterOptions['connection'] = { id: 'fixture', name: 'Thinking', baseUrl: 'https://fixture.invalid', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'anthropic-messages', profile: 'claude-connector-v1', claude: { maxTokens: 4096, thinking: { type: 'enabled', budget_tokens: 1024 } } }
    await expect(fixture(handler, { connection }, { model: { resolved_model: 'claude-opus-4-6', supports_adaptive_thinking: true, supports_manual_thinking: null } })).rejects.toThrow('does not advertise manual')
    await expect(fixture(handler, { connection }, { model: { supports_adaptive_thinking: false, supports_manual_thinking: false } })).rejects.toThrow('does not advertise manual')
    expect(handler).not.toHaveBeenCalled()
    const state = await fixture(handler, { connection }, { model: { resolved_model: 'new-catalog-alias', supports_manual_thinking: true, max_output_tokens: 4096, claude: { version: 1, manual_thinking: { source: 'native_model_metadata', verified: false }, connector_max_output_tokens: 128000 } } })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Begin' }); expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.requests[0]).toMatchObject({ thinking: { type: 'enabled', budget_tokens: 1024 } })
  })
  it('uses flat snake-case model capabilities and treats absent metadata as unknown', async () => {
    const handler = vi.fn(() => claudeWire(1, [{ type: 'text', text: 'Done' }]))
    const connection: ClaudeMessagesAdapterOptions['connection'] = { id: 'fixture', name: 'Thinking', baseUrl: 'https://fixture.invalid', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'anthropic-messages', profile: 'claude-connector-v1', claude: { thinking: { type: 'adaptive' } } }
    // The initial public catalog omitted these flags; never infer from aliases/camel fields or provenance.
    await expect(fixture(handler, { connection, reasoningEffort: 'high' }, { model: { supportsAdaptiveThinking: true, resolvedModel: 'claude-opus-4-6' } })).rejects.toThrow('does not advertise adaptive')
    await expect(fixture(handler, { connection, reasoningEffort: 'high' }, { model: { supports_adaptive_thinking: true, max_output_tokens: 2048 } })).rejects.toThrow('exceeds the discovered model limit')
    const state = await fixture(handler, { connection, reasoningEffort: 'high' }, { model: { supports_adaptive_thinking: true, supports_manual_thinking: null, max_output_tokens: null, claude: { version: 1, connector_max_output_tokens: 128000 } } })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Begin' }); expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.requests[0]).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'high' } })
  })
  it('returns original IDs in an owned caller roundtrip and resumes completed signed history without replay', async () => {
    let count = 0
    const state = await fixture(() => ++count === 1 ? claudeWire(1, [{ type: 'thinking', thinking: 'Public summary', signature: 'opaque-preserved' }, { type: 'tool_use', id: 'native.original/id', name: 'list_files', input: { path: '.' } }]) : claudeWire(count, [{ type: 'text', text: 'Done' }]))
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'List files' }); expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.requests[0].system).toContain(state.cwd); expect(state.requests[0].claude).toMatchObject({ mode: 'caller', nativeTools: [] })
    expect(state.requests[0]).toMatchObject({ max_tokens: 128000 })
    expect(state.requests[0].tools.every(tool => tool.input_schema)).toBe(true)
    expect(state.requests[1]).toMatchObject({ previous_response_id: responseId(1), messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'native.original/id', content: expect.stringContaining('entries') }] }] })
    const saved = fs.readFileSync(state.history, 'utf8'); expect(saved).toContain('opaque-preserved'); expect(saved).not.toContain('private-fixture-key'); expect(JSON.stringify(state.events)).not.toContain('opaque-preserved')
    await state.adapter.stop(); const resumed = new ClaudeMessagesAdapter({ ...state.options, runId: 'resumed', resumeSessionId: state.adapter.getSessionId() }); adapters.push(resumed); await resumed.start(); expect(count).toBe(2)
    const next = await resumed.sendPrompt({ taskId: 'task', text: 'Continue' }); expect(await terminal(state.events, next.turnId)).toMatchObject({ status: 'completed' }); expect(state.requests[2].previous_response_id).toBe(responseId(2))
    const drift = new ClaudeMessagesAdapter({ ...state.options, resumeSessionId: state.adapter.getSessionId(), reasoningEffort: 'high' }); adapters.push(drift); await expect(drift.start()).rejects.toThrow('does not match')
  })
  it('requires owner approval and durable intent before a real file edit, and never replays after a failed continuation', async () => {
    let count = 0
    const state = await fixture(() => ++count === 1 ? claudeWire(1, [{ type: 'tool_use', id: 'call/write', name: 'write_file', input: { path: 'owned.txt', content: 'approved', expectedSha256: null } }]) : new Response('unavailable', { status: 503 }))
    const execute = ApiFileTools.prototype.execute
    const spy = vi.spyOn(ApiFileTools.prototype, 'execute').mockImplementation(function (this: ApiFileTools, name, input) { expect(JSON.parse(fs.readFileSync(state.history, 'utf8')).pending).toMatchObject({ state: 'executing', calls: [{ state: 'executing', id: 'call/write' }] }); return execute.call(this, name, input) })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Write' }); await vi.waitFor(() => expect(state.events.some(event => event.type === 'permission.requested')).toBe(true))
    expect(fs.existsSync(path.join(state.cwd, 'owned.txt'))).toBe(false)
    const approval = state.events.find(event => event.type === 'permission.requested')!; await state.adapter.resolveApproval(approval.approvalId, 'allow')
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error' }); expect(fs.readFileSync(path.join(state.cwd, 'owned.txt'), 'utf8')).toBe('approved'); expect(spy).toHaveBeenCalledTimes(1)
    await expect(state.adapter.resolveApproval(approval.approvalId, 'allow')).rejects.toThrow('stale')
    const resumed = new ClaudeMessagesAdapter({ ...state.options, resumeSessionId: state.adapter.getSessionId() }); adapters.push(resumed); await expect(resumed.start()).rejects.toThrow('uncertain'); expect(count).toBe(2)
  })
  it.skipIf(!LOCAL_COMMAND_SUPPORTED)('executes a real local command only after explicit permission in the trusted directory', async () => {
    let count = 0
    const state = await fixture(() => ++count === 1 ? claudeWire(1, [{ type: 'tool_use', id: 'command/1', name: 'run_command', input: { executable: '/bin/pwd', args: [], timeoutMs: null } }]) : claudeWire(2, [{ type: 'text', text: 'Done' }]), { connection: { id: 'fixture', name: 'Fixture', baseUrl: 'https://fixture.invalid', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'anthropic-messages', profile: 'claude-connector-v1', allowCommands: true } })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Run pwd' }); await vi.waitFor(() => expect(state.events.some(event => event.type === 'permission.requested')).toBe(true))
    const approval = state.events.find(event => event.type === 'permission.requested')!; expect(approval.riskLevel).toBe('high'); expect(state.events.some(event => event.type === 'tool.completed')).toBe(false)
    await state.adapter.resolveApproval(approval.approvalId, 'allow'); expect(await terminal(state.events, turn.turnId, 8000)).toMatchObject({ status: 'completed' }); expect(state.events.find(event => event.type === 'tool.completed')).toMatchObject({ output: { stdout: `${state.cwd}\n`, cleanupVerified: true } })
  }, 12_000)
  it('keeps native tool observations out of local execution and sends separate immutable Claude permissions and question answers', async () => {
    const rid = responseId(1), approvalId = `approval_${'a'.repeat(32)}`, questionId = `question_${'b'.repeat(32)}`, sent: Array<{ url: string; body: unknown }> = []
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const records = claudeRecords(1, [{ type: 'text', text: 'Done' }]), push = (event: unknown) => controller.enqueue(new TextEncoder().encode(claudeFrame(event)))
    const state = await fixture((body, url) => {
      if (url.endsWith('/messages')) return new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; push(records[0]); push({ type: 'claude.tool', version: 1, response_id: rid, tool: { id: 'write1', name: 'Write', status: 'in_progress', input: { file_path: '/provider/file.txt', content: 'remote' } } }); push({ type: 'claude.approval', version: 1, response_id: rid, approval: { id: approvalId, expires_in: 120, request: { toolName: 'Write', input: { file_path: '/provider/file.txt', content: 'remote' }, suppressAlwaysAllowRule: true } } }) } }), { headers: { 'Content-Type': 'text/event-stream' } })
      sent.push({ url, body })
      if (url.endsWith(approvalId)) { push({ type: 'claude.tool', version: 1, response_id: rid, tool: { id: 'write1', name: 'Write', status: 'completed', output: 'remote saved' } }); push({ type: 'claude.question', version: 1, response_id: rid, question: { id: questionId, request: { questions: [{ question: 'Which option?', options: [{ label: 'A' }, { label: 'B' }], multiSelect: false }] } } }); return Response.json({ id: approvalId, answered: true }) }
      for (const record of records.slice(1)) push(record); controller.close(); return Response.json({ id: questionId, answered: true })
    }, { connection: { id: 'fixture', name: 'Native', baseUrl: 'https://fixture.invalid', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'anthropic-messages', profile: 'claude-connector-v1', claude: { mode: 'native', nativeTools: ['Write', 'AskUserQuestion'] } } })
    const local = vi.spyOn(ApiFileTools.prototype, 'execute'), turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Write remotely and ask' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'interaction.requested' && event.interaction.kind === 'approval')).toBe(true))
    await state.adapter.resolveInteraction({ taskId: 'task', turnId: turn.turnId, interactionId: approvalId, answer: { provider: 'claude', kind: 'approval', behavior: 'allow' } })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'interaction.requested' && event.interaction.kind === 'question')).toBe(true))
    await state.adapter.resolveInteraction({ taskId: 'task', turnId: turn.turnId, interactionId: questionId, answer: { provider: 'claude', kind: 'question', outcome: 'accepted', answers: { 'Which option?': 'A' } } })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' }); expect(local).not.toHaveBeenCalled(); expect(state.requests[0].tools).toEqual([])
    expect(sent.map(item => item.body)).toEqual([{ behavior: 'allow' }, { answers: { 'Which option?': 'A' } }]); expect(state.events.find(event => event.type === 'tool.started')).toMatchObject({ executor: 'provider' })
  })
  it('classifies Stop at a pending native question only after exact cancellation confirmation and never replays it', async () => {
    const rid = responseId(1), questionId = `question_${'c'.repeat(32)}`
    for (const confirmed of [true, false]) {
      const state = await fixture(() => new Response(new ReadableStream<Uint8Array>({ start(controller) {
        const records = [claudeRecords(1, [])[0], { type: 'claude.question', version: 1, response_id: rid, question: { id: questionId, request: { questions: [{ question: 'Continue?', options: [{ label: 'Yes' }, { label: 'No' }], multiSelect: false }] } } }]
        for (const record of records) controller.enqueue(new TextEncoder().encode(claudeFrame(record)))
      } }), { headers: { 'Content-Type': 'text/event-stream' } }), { connection: { id: 'fixture', name: 'Native', baseUrl: 'https://fixture.invalid', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'anthropic-messages', profile: 'claude-connector-v1', claude: { mode: 'native', nativeTools: ['AskUserQuestion'] } } })
      const performFetch = state.options.fetch!, cancellations: string[] = []
      state.options.fetch = (async (url, init) => {
        if (String(url).endsWith('/cancel')) { cancellations.push(String(url)); return Response.json({ id: rid, status: confirmed ? 'cancelled' : 'in_progress' }) }
        return performFetch(url, init)
      }) as typeof fetch
      const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Ask and wait' })
      await vi.waitFor(() => expect(state.events.some(event => event.type === 'interaction.requested')).toBe(true))
      await state.adapter.interruptTurn(turn.turnId)
      expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: confirmed ? 'stopped' : 'error', error: confirmed ? 'Interrupted by user' : expect.stringContaining('Cancellation could not be confirmed') })
      expect(state.events.filter(event => event.type === 'agent.status.changed' && event.scope === 'turn' && ['completed', 'error', 'stopped'].includes(event.status))).toHaveLength(1)
      expect(state.events.some(event => event.type === 'interaction.state.changed' && event.interactionId === questionId && event.state === 'expired')).toBe(true)
      expect(cancellations).toEqual([`https://fixture.invalid/v1/responses/${rid}/cancel`])
      expect(JSON.parse(fs.readFileSync(state.history, 'utf8'))).toMatchObject({ lastResponseId: null, pending: { state: 'uncertain', responseId: rid } })
      await expect(state.adapter.sendPrompt({ taskId: 'task', text: 'Retry' })).rejects.toThrow('not ready')
      await expect(state.adapter.resolveInteraction({ taskId: 'task', turnId: turn.turnId, interactionId: questionId, answer: { provider: 'claude', kind: 'question', outcome: 'accepted', answers: { 'Continue?': 'Yes' } } })).rejects.toThrow('stale')
      const resumed = new ClaudeMessagesAdapter({ ...state.options, resumeSessionId: state.adapter.getSessionId() }); adapters.push(resumed)
      await expect(resumed.start()).rejects.toThrow('uncertain'); expect(state.requests).toHaveLength(1)
    }
  })
  it('accepts owned GIF/PDF/text blocks without URLs and rejects write attempts in a read-only caller session', async () => {
    const state = await fixture(() => claudeWire(1, [{ type: 'tool_use', id: 'badwrite', name: 'write_file', input: { path: 'forbidden.txt', content: 'no', expectedSha256: null } }]), { readOnly: true })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Read attachments', inputImages: [{ id: 'owned-image', mime: 'image/gif', dataUrl: `data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}` }], inputDocuments: [{ id: 'owned-pdf', name: 'fixture.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1.4 fixture').toString('base64') }, { id: 'owned-text', name: 'fixture.txt', mime: 'text/plain', data: 'Local context' }] })
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error' }); expect(state.events.some(event => event.type === 'permission.requested')).toBe(false); expect(fs.existsSync(path.join(state.cwd, 'forbidden.txt'))).toBe(false)
    expect(state.requests[0].messages[0].content).toMatchObject([{ type: 'text' }, { type: 'image', source: { media_type: 'image/gif' } }, { type: 'document', source: { media_type: 'application/pdf', type: 'base64' } }, { type: 'document', source: { media_type: 'text/plain', type: 'text', data: 'Local context' } }])
  })
  it('does not commit a terminal stream while a native decision or operation remains unresolved', async () => {
    const extras = [
      { type: 'claude.approval', version: 1, response_id: responseId(1), approval: { id: `approval_${'a'.repeat(32)}`, request: { toolName: 'Write', input: { file_path: '/provider/file.txt' } } } },
      { type: 'claude.tool', version: 1, response_id: responseId(1), tool: { id: 'native-still-running', name: 'Write', status: 'in_progress' } },
    ]
    for (const extra of extras) {
      const state = await fixture(() => claudeWire(1, [{ type: 'text', text: 'Premature success' }], [extra]), { connection: { id: 'fixture', name: 'Native', baseUrl: 'https://fixture.invalid', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'anthropic-messages', profile: 'claude-connector-v1', claude: { mode: 'native', nativeTools: ['Write'] } } })
      const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Write remotely' })
      expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error', error: expect.stringContaining('unresolved native activity') })
      expect(JSON.parse(fs.readFileSync(state.history, 'utf8'))).toMatchObject({ lastResponseId: null, messages: [], pending: { state: 'uncertain' } })
      expect(state.urls.filter(url => url.endsWith('/cancel'))).toHaveLength(1)
    }
  })
  it('honors the advertised per-request budget across heartbeats beyond ten minutes and a later caller round', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>, round = 0
    const push = (event: unknown) => controller.enqueue(new TextEncoder().encode(claudeFrame(event)))
    const records = (n: number) => claudeRecords(n, n === 1 ? [{ type: 'tool_use', id: 'late-list', name: 'list_files', input: { path: '.' } }] : [{ type: 'text', text: 'Done' }])
    const state = await fixture(() => new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; push(records(++round)[0]) } }), { headers: { 'Content-Type': 'text/event-stream' } }), {}, { capabilities: { version: 1, provider: 'claude', limits: { turnTimeoutMs: 900_000 } } })
    expect(state.urls).toContain('https://fixture.invalid/v1/claude/capabilities')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Take time to list' })
    for (const n of [1, 2]) {
      await vi.waitFor(() => expect(state.requests).toHaveLength(n))
      for (let heartbeat = 0; heartbeat < 7; heartbeat++) { push({ type: 'ping' }); await vi.advanceTimersByTimeAsync(90_000) }
      expect(state.adapter.getStatus()).toBe('running')
      expect(state.events.some(event => event.type === 'agent.status.changed' && event.scope === 'turn' && ['error', 'completed', 'stopped'].includes(event.status))).toBe(false)
      for (const record of records(n).slice(1)) push(record)
      controller.close()
    }
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'completed' })
    expect(state.requests[1].previous_response_id).toBe(responseId(1)); expect(state.urls.some(url => url.endsWith('/cancel'))).toBe(false)
  })
  it('fails closed at the advertised deadline while retaining explicit and legacy timeout behavior', async () => {
    for (const scenario of [{ budget: 1000, timeout: undefined, deadline: 6000 }, { budget: 3_600_000, timeout: 10_000, deadline: 10_000 }, { budget: undefined, timeout: undefined, deadline: 600_000 }]) {
      const state = await fixture(() => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(claudeFrame(claudeRecords(1, [])[0]))) } }), { headers: { 'Content-Type': 'text/event-stream' } }), { timeoutMs: scenario.timeout }, { capabilities: { version: 1, provider: 'claude', ...(scenario.budget !== undefined ? { limits: { turnTimeoutMs: scenario.budget } } : {}) } })
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
      const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Wait' })
      await vi.waitFor(() => expect(JSON.parse(fs.readFileSync(state.history, 'utf8')).pending?.responseId).toBe(responseId(1)))
      await vi.advanceTimersByTimeAsync(scenario.deadline)
      expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error', error: 'Claude request deadline exceeded; partial output was not committed' })
      expect(state.urls.filter(url => url.endsWith('/cancel'))).toHaveLength(1)
      expect(JSON.parse(fs.readFileSync(state.history, 'utf8'))).toMatchObject({ pending: { state: 'uncertain' } })
      await expect(state.adapter.sendPrompt({ taskId: 'task', text: 'Do not replay' })).rejects.toThrow('not ready')
      vi.useRealTimers()
    }
  })
  it('keeps the owner question expiry distinct from a longer advertised request deadline', async () => {
    const questionId = `question_${'d'.repeat(32)}`
    const state = await fixture(() => new Response(new ReadableStream<Uint8Array>({ start(controller) {
      for (const event of [claudeRecords(1, [])[0], { type: 'claude.question', version: 1, response_id: responseId(1), question: { id: questionId, request: { questions: [{ question: 'Continue?', options: [{ label: 'Yes' }, { label: 'No' }] }] } } }]) controller.enqueue(new TextEncoder().encode(claudeFrame(event)))
    } }), { headers: { 'Content-Type': 'text/event-stream' } }), { connection: { id: 'fixture', name: 'Native', baseUrl: 'https://fixture.invalid', model: 'fixture-model', enabled: true, hasApiKey: false, transport: 'anthropic-messages', profile: 'claude-connector-v1', claude: { mode: 'native', nativeTools: ['AskUserQuestion'] } } }, { capabilities: { version: 1, provider: 'claude', limits: { turnTimeoutMs: 900_000 }, toolCatalog: ['AskUserQuestion'], discoveredTools: [{ name: 'AskUserQuestion', available: true, enabled: true }] } })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Ask and wait' })
    await vi.waitFor(() => expect(state.events.some(event => event.type === 'interaction.requested')).toBe(true))
    await vi.advanceTimersByTimeAsync(600_001)
    expect(await terminal(state.events, turn.turnId)).toMatchObject({ status: 'error', error: 'Claude owner question or permission expired; the turn was cancelled' })
    expect(state.events.some(event => event.type === 'interaction.state.changed' && event.interactionId === questionId && event.state === 'expired')).toBe(true)
  })
  it('reports max output failure and accepts terminal cleanup only for an exact matching failed response', async () => {
    for (const matching of [true, false]) {
      const state = await fixture(() => new Response([claudeRecords(1, [])[0], { type: 'error', error: { code: 'max_output_tokens', message: 'private provider content' } }].map(claudeFrame).join(''), { headers: { 'Content-Type': 'text/event-stream' } }))
      const performFetch = state.options.fetch!
      state.options.fetch = (async (url, init) => String(url).endsWith('/cancel') ? Response.json({ id: responseId(matching ? 1 : 2), status: 'failed', error: { code: 'max_output_tokens' }, claude: { requires_action: false } }) : performFetch(url, init)) as typeof fetch
      const turn = await state.adapter.sendPrompt({ taskId: 'task', text: 'Large answer' }), end = await terminal(state.events, turn.turnId)
      expect(end).toMatchObject({ status: 'error', error: expect.stringContaining('max_output_tokens') })
      expect(JSON.stringify(end).includes('Cancellation could not be confirmed')).toBe(!matching)
      expect(JSON.stringify(state.events)).not.toContain('private provider content')
      expect(JSON.parse(fs.readFileSync(state.history, 'utf8'))).toMatchObject({ lastResponseId: null, pending: { state: 'uncertain' } }); expect(state.requests).toHaveLength(1)
    }
  })
})
