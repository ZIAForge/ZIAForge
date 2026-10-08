import { describe, expect, it, vi } from 'vitest'
import { createFeedProjector } from '../../../shared/agent-feed'
import { consumeResponsesStream, RESPONSES_LIMITS, type ResponsesStreamOptions } from '../ResponsesProtocol'

type Event = Record<string, unknown>
const encoder = new TextEncoder()
const frame = (event: Event, newline = '\n') => `event: ${event.type}${newline}data: ${JSON.stringify(event)}${newline}${newline}`
const created = { type: 'response.created', response: { id: 'resp_test', status: 'in_progress' } }
const message = (text: string, id = 'msg_test') => ({ id, type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] })
const call = (argumentsValue: string, id = 'fc_item', callId = 'call_original') => ({ id, type: 'function_call', status: 'completed', call_id: callId, name: 'list_files', arguments: argumentsValue })
const image = (id: string, result: string) => ({ id, type: 'image_generation_call', status: 'completed', result })
const completed = (output: unknown[] = [], usage?: Event) => ({ type: 'response.completed', response: { id: 'resp_test', status: 'completed', output, ...(usage ? { usage } : {}) } })
function response(text: string, fragmentBytes?: number): Response {
  const bytes = encoder.encode(text)
  let offset = 0
  return new Response(new ReadableStream<Uint8Array>({ pull(controller) {
    if (offset >= bytes.length) { controller.close(); return }
    const end = Math.min(offset + (fragmentBytes ?? bytes.length), bytes.length)
    controller.enqueue(bytes.slice(offset, end)); offset = end
  } }), { headers: { 'Content-Type': 'text/event-stream' } })
}
function options(controller = new AbortController()): ResponsesStreamOptions {
  return { signal: controller.signal, onText: vi.fn(), onHosted: vi.fn(), onImage: vi.fn(), onResponseId: vi.fn() }
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(accept => { resolve = accept })
  return { promise, resolve }
}

describe('ResponsesProtocol', () => {
  it('parses fragmented UTF-8, CRLF, multiline data and final text without duplicate output', async () => {
    const text = 'Привет 🌍'
    const delta = `: keepalive\r\nretry: 1000\r\nevent: response.output_text.delta\r\ndata: {"type":"response.output_text.delta",\r\ndata: "item_id":"msg_test","output_index":0,"content_index":0,"delta":"${text}"}\r\n\r\n`
    const input = frame(created, '\r\n') + delta + frame({ type: 'response.output_text.done', item_id: 'msg_test', output_index: 0, content_index: 0, text }, '\r\n') + frame({ type: 'response.output_item.done', output_index: 0, item: message(text) }, '\r\n') + frame(completed([message(text)], { input_tokens: 12, output_tokens: 4, total_tokens: 16 }), '\r\n')
    const callbacks = options()
    expect(await consumeResponsesStream(response(input, 1), callbacks)).toEqual({ id: 'resp_test', text, calls: [], usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 } })
    expect(callbacks.onText).toHaveBeenCalledExactlyOnceWith(text)
    expect(callbacks.onResponseId).toHaveBeenCalledExactlyOnceWith('resp_test')
  })

  it('supports connector text delta without item identity and reconciles final-only suffix', async () => {
    const callbacks = options()
    const input = frame(created) + frame({ type: 'response.output_text.delta', delta: 'Hello' }) + frame(completed([message('Hello world')]))
    expect((await consumeResponsesStream(response(input, 7), callbacks)).text).toBe('Hello world')
    expect(vi.mocked(callbacks.onText).mock.calls).toEqual([['Hello'], [' world']])
  })

  it('awaits durable response identity before delivering any text or caller result', async () => {
    const entered = deferred(), gate = deferred(), callbacks = options()
    callbacks.onResponseId = vi.fn(async () => { entered.resolve(); await gate.promise })
    const pending = consumeResponsesStream(response(frame(created) + frame(completed([message('ready')]))), callbacks)
    await entered.promise
    expect(callbacks.onText).not.toHaveBeenCalled()
    gate.resolve()
    expect((await pending).text).toBe('ready')
  })

  it('accumulates caller arguments by item ID and preserves original distinct call_id exactly once', async () => {
    const callbacks = options()
    const functionItem = call('{"path":"."}')
    const input = frame(created) + frame({ type: 'response.output_item.added', output_index: 1, item: { ...functionItem, status: 'in_progress', arguments: '' } }) + frame({ type: 'response.function_call_arguments.delta', item_id: 'fc_item', output_index: 1, delta: '{"path":' }) + frame({ type: 'response.function_call_arguments.delta', item_id: 'fc_item', output_index: 1, delta: '"."}' }) + frame({ type: 'response.function_call_arguments.done', item_id: 'fc_item', output_index: 1, arguments: '{"path":"."}' }) + frame({ type: 'response.output_item.done', output_index: 1, item: functionItem }) + frame(completed([{ id: 'reasoning_item', type: 'reasoning', encrypted_content: 'PRIVATE' }, functionItem]))
    expect(await consumeResponsesStream(response(input, 11), callbacks)).toEqual({ id: 'resp_test', text: '', calls: [{ id: 'fc_item', callId: 'call_original', name: 'list_files', arguments: '{"path":"."}' }] })
    expect(callbacks.onHosted).not.toHaveBeenCalled()
    expect(callbacks.onText).not.toHaveBeenCalled()
  })

  it('preserves an opaque original call_id with punctuation for the caller continuation', async () => {
    const item = call('{"path":"."}', 'fc_opaque_item', 'original.call/id')
    const result = await consumeResponsesStream(response(frame(created) + frame({ type: 'response.output_item.done', output_index: 0, item }) + frame(completed([item]))), options())
    expect(result.calls).toEqual([{ id: 'fc_opaque_item', callId: 'original.call/id', name: 'list_files', arguments: '{"path":"."}' }])
  })

  it.each(['call\ninvalid', 'a'.repeat(201)])('rejects unsafe or unbounded opaque call identity', async callId => {
    await expect(consumeResponsesStream(response(frame(completed([call('{}', 'fc_invalid', callId)]))), options())).rejects.toThrow('invalid Responses stream')
  })

  it('routes an image larger than the old text stream budget to an awaited sink and deduplicates final replay', async () => {
    const base64 = Buffer.alloc(1200 * 1024, 7).toString('base64'), item = image('ig_test', base64)
    const entered = deferred(), gate = deferred(), callbacks = options()
    let settled = false
    callbacks.onImage = vi.fn(async () => { entered.resolve(); await gate.promise })
    const pending = consumeResponsesStream(response(frame(created) + frame({ type: 'response.output_item.done', output_index: 0, item }) + frame(completed([item])), 64 * 1024), callbacks)
    void pending.then(() => { settled = true }, () => { settled = true })
    await entered.promise
    expect(settled).toBe(false)
    expect(callbacks.onImage).toHaveBeenCalledExactlyOnceWith('ig_test', base64)
    gate.resolve()
    const result = await pending
    expect(result).toEqual({ id: 'resp_test', text: '', calls: [] })
    expect(JSON.stringify(result)).not.toContain(base64)
    expect(callbacks.onImage).toHaveBeenCalledTimes(1)
  })

  it('forwards only known hosted progress, strips image payloads and never returns hosted execution as functions', async () => {
    const callbacks = options()
    const event = { type: 'codex.tool', method: 'item/completed', params: { threadId: 'native_thread', turnId: 'native_turn', item: { id: 'hosted_image', type: 'imageGeneration', status: 'completed', result: 'PRIVATE_BASE64', output: { data: 'PRIVATE_BASE64' }, encrypted_content: 'PRIVATE_REASONING' } }, sequence_number: 4 }
    const input = frame(created) + frame({ type: 'codex.tool', method: 'item/started', params: { item: { id: 'native_command', type: 'commandExecution', command: 'pwd', cwd: '/provider/workspace' } }, sequence_number: 1 }) + frame({ type: 'codex.tool', method: 'item/commandExecution/outputDelta', params: { itemId: 'native_command', delta: '/provider/workspace\n' }, sequence_number: 2 }) + frame(event) + frame({ type: 'codex.tool', method: 'item/started', params: { item: { id: 'private', type: 'reasoning', text: 'PRIVATE_REASONING' } }, sequence_number: 5 }) + frame({ type: 'codex.tool', method: 'item/started', params: { item: { id: 'caller', type: 'dynamicToolCall' } }, sequence_number: 6 }) + frame({ type: 'codex.tool', method: 'future/method', params: { arbitrary: 'PRIVATE_REASONING' }, sequence_number: 7 }) + frame({ type: 'response.reasoning_text.delta', delta: 'PRIVATE_REASONING' }) + frame({ type: 'response.reasoning_summary_text.delta', delta: 'summary' }) + frame({ type: 'unknown.extension', arbitrary: true }) + frame(completed())
    expect((await consumeResponsesStream(response(input), callbacks)).calls).toEqual([])
    expect(callbacks.onHosted).toHaveBeenCalledTimes(3)
    expect(callbacks.onHosted).toHaveBeenLastCalledWith({ ...event, params: { threadId: 'native_thread', turnId: 'native_turn', item: { id: 'hosted_image', type: 'imageGeneration', status: 'completed' } } })
    expect(JSON.stringify(vi.mocked(callbacks.onHosted).mock.calls)).not.toMatch(/PRIVATE/)
    expect(callbacks.onText).not.toHaveBeenCalled()
    expect(callbacks.onImage).not.toHaveBeenCalled()
  })

  it.each(['response.failed', 'response.incomplete', 'error'])('rejects %s after HTTP 200 without accepting a later completed event', async type => {
    const callbacks = options()
    await expect(consumeResponsesStream(response(frame(created) + frame({ type, error: { message: 'PRIVATE_SERVER_BODY' } }) + frame(completed())), callbacks)).rejects.toThrow('failed or stopped')
    expect(callbacks.onText).not.toHaveBeenCalled()
  })

  it.each(['', 'data: [DONE]\n\n', 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"partial"}\n\n'])('requires response.completed when a stream ends: %s', async suffix => {
    await expect(consumeResponsesStream(response(frame(created) + suffix), options())).rejects.toThrow('before response.completed')
  })

  it.each([
    frame(completed([call('{}', 'fc_one', 'duplicate'), call('{}', 'fc_two', 'duplicate')])),
    frame({ type: 'response.output_item.done', output_index: 0, item: call('{}') }) + frame(completed()),
    frame({ type: 'response.output_item.added', output_index: 0, item: call('') }) + frame({ type: 'response.function_call_arguments.delta', item_id: 'fc_item', output_index: 0, delta: '{"path":"other' }) + frame(completed([call('{"path":"."}')])),
    frame({ type: 'response.output_item.done', output_index: 0, item: image('ig_test', 'YQ==') }) + frame(completed([image('ig_test', 'Yg==')])),
    frame(completed([message('a'), message('a')])),
  ])('rejects conflicting or missing final output identities', async input => {
    await expect(consumeResponsesStream(response(frame(created) + input), options())).rejects.toThrow('invalid Responses stream')
  })

  it.each(['not base64', 'YQ=', 'YR==', 'data:image/png;base64,YQ==', ''])('rejects invalid image encoding before the sink: %s', async result => {
    const callbacks = options()
    await expect(consumeResponsesStream(response(frame(created) + frame(completed([image('ig_invalid', result)]))), callbacks)).rejects.toThrow()
    expect(callbacks.onImage).not.toHaveBeenCalled()
  })

  it('bounds text, function arguments and caller count independently of the larger media budget', async () => {
    const callbacks = options()
    await expect(consumeResponsesStream(response(frame(created) + frame({ type: 'response.output_text.delta', delta: 'a'.repeat(RESPONSES_LIMITS.textBytes + 1) })), callbacks)).rejects.toThrow('API text exceeds')
    expect(callbacks.onText).not.toHaveBeenCalled()
    await expect(consumeResponsesStream(response(frame(created) + frame({ type: 'response.function_call_arguments.delta', item_id: 'fc_large', delta: 'a'.repeat(RESPONSES_LIMITS.argumentBytes + 1) })), options())).rejects.toThrow('API tool arguments exceed')
    await expect(consumeResponsesStream(response(frame(created) + frame(completed(Array.from({ length: 17 }, (_, index) => call('{}', `fc_${index}`, `call_${index}`))))), options())).rejects.toThrow('API tool-call limit reached')
  })

  it('bounds image count and decoded bytes before accepting an oversized image', async () => {
    const callbacks = options()
    await expect(consumeResponsesStream(response(frame(created) + frame(completed(Array.from({ length: 5 }, (_, index) => image(`ig_${index}`, 'YQ=='))))), callbacks)).rejects.toThrow('API images exceed')
    expect(callbacks.onImage).toHaveBeenCalledTimes(4)
    const oversized = 'A'.repeat(Math.ceil((RESPONSES_LIMITS.imageBytes + 1) / 3) * 4)
    const oversizedCallbacks = options()
    await expect(consumeResponsesStream(response(frame(completed([image('ig_large', oversized)])), 256 * 1024), oversizedCallbacks)).rejects.toThrow('API image exceeds')
    expect(oversizedCallbacks.onImage).not.toHaveBeenCalled()
  })

  it('bounds aggregate decoded image bytes even when each image and SSE frame fits', async () => {
    const large = Buffer.alloc(17 * 1024 * 1024).toString('base64')
    let index = -1
    const source = new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (index < 0) controller.enqueue(encoder.encode(frame(created)))
      else if (index < 4) controller.enqueue(encoder.encode(frame({ type: 'response.output_item.done', output_index: index, item: image(`ig_${index}`, large) })))
      else controller.close()
      index++
    } }))
    const callbacks = options()
    await expect(consumeResponsesStream(source, callbacks)).rejects.toThrow('API images exceed')
    expect(callbacks.onImage).toHaveBeenCalledTimes(3)
  })

  it.each([
    { block: ':'.repeat(1024 * 1024), count: 49, expected: 'SSE frame' },
    { block: `:${'a'.repeat(1024 * 1024 - 3)}\n\n`, count: 161, expected: 'transport limit' },
  ])('bounds $expected for a streamed body without retaining the entire transport', async ({ block, count, expected }) => {
    const bytes = encoder.encode(block)
    let sent = 0
    const source = new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (sent++ < count) controller.enqueue(bytes)
      else controller.close()
    } }))
    await expect(consumeResponsesStream(source, options())).rejects.toThrow(expected)
  })

  it('cancels a stalled reader on abort and releases its stream lock', async () => {
    const controller = new AbortController(), entered = deferred(), cancelled = vi.fn()
    const source = new Response(new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(encoder.encode(frame(created))) }, cancel: cancelled }))
    const callbacks = options(controller)
    callbacks.onResponseId = vi.fn(() => { entered.resolve() })
    const pending = consumeResponsesStream(source, callbacks)
    await entered.promise
    controller.abort()
    await expect(pending).rejects.toThrow()
    expect(cancelled).toHaveBeenCalledTimes(1)
    expect(source.body?.locked).toBe(false)
  })

  it('does not process late text or report success when aborted during the awaited image write', async () => {
    const controller = new AbortController(), entered = deferred(), gate = deferred(), callbacks = options(controller)
    const item = image('ig_pending', 'YQ==')
    callbacks.onImage = vi.fn(async () => { entered.resolve(); await gate.promise })
    const pending = consumeResponsesStream(response(frame(created) + frame({ type: 'response.output_item.done', output_index: 0, item }) + frame({ type: 'response.output_text.delta', delta: 'late' }) + frame(completed([item, message('late')]))), callbacks)
    await entered.promise
    controller.abort(); gate.resolve()
    await expect(pending).rejects.toThrow()
    expect(callbacks.onText).not.toHaveBeenCalled()
  })

  it('propagates an image sink failure without continuing to a completed response', async () => {
    const callbacks = options()
    callbacks.onImage = vi.fn(async () => { throw new Error('Private media cache is unavailable') })
    const item = image('ig_failed', 'YQ==')
    await expect(consumeResponsesStream(response(frame(created) + frame({ type: 'response.output_item.done', output_index: 0, item }) + frame({ type: 'response.output_text.delta', delta: 'late' }) + frame(completed([item, message('late')]))), callbacks)).rejects.toThrow('Private media cache is unavailable')
    expect(callbacks.onText).not.toHaveBeenCalled()
  })

  it.each([
    'event: response.created\ndata: {broken\n\n',
    'event: response.failed\ndata: {"type":"response.completed","response":{"id":"resp_test","status":"completed","output":[]}}\n\n',
    frame({ type: 'codex.tool', method: 'item/commandExecution/outputDelta', params: { itemId: 'native_command', delta: 'output' }, sequence_number: -1 }),
    frame({ type: 'response.created', response: { id: 'resp_other' } }),
    frame({ type: 'response.created', response: { id: 'resp/foreign?secret=value' } }),
  ])('rejects malformed known events without reflecting raw payloads', async input => {
    await expect(consumeResponsesStream(response(frame(created) + input), options())).rejects.toThrow(/invalid/)
  })

  it('rejects invalid UTF-8 instead of decoding replacement characters', async () => {
    const source = new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([0xc3, 0x28])); controller.close() } }))
    await expect(consumeResponsesStream(source, options())).rejects.toThrow('invalid Responses stream')
  })

  it('rejects an image marked completed without a result instead of silently omitting the attachment', async () => {
    const callbacks = options()
    await expect(consumeResponsesStream(response(frame(completed([{ id: 'ig_empty', type: 'image_generation_call', status: 'completed', result: null }]))), callbacks)).rejects.toThrow('invalid Responses stream')
    expect(callbacks.onImage).not.toHaveBeenCalled()
  })

  it('honors a smaller optional transport cap without reverting the default image budget', async () => {
    const callbacks = options()
    await expect(consumeResponsesStream(response(frame(completed())), { ...callbacks, maxResponseBytes: 8 })).rejects.toThrow('transport limit')
    expect(callbacks.onResponseId).not.toHaveBeenCalled()
    await expect(consumeResponsesStream(response(frame(completed())), { ...options(), maxResponseBytes: 0 })).rejects.toThrow('Invalid Responses transport limit')
    await expect(consumeResponsesStream(response(frame(completed())), { ...options(), maxResponseBytes: RESPONSES_LIMITS.transportBytes + 1 })).resolves.toMatchObject({ id: 'resp_test' })
  })

  it('ignores unknown named extensions even when their payload is not Responses JSON', async () => {
    const callbacks = options()
    const input = frame(created) + 'event: future.extension\ndata: arbitrary extension payload\n\n' + frame(completed([message('complete')]))
    expect((await consumeResponsesStream(response(input), callbacks)).text).toBe('complete')
    expect(callbacks.onHosted).not.toHaveBeenCalled()
  })

  it('returns authoritative final-phase text and replaces streamed commentary in the real feed without duplication', async () => {
    const commentary = 'I am checking the local result. ', answer = 'The local directory is empty.'
    const commentItem = { ...message(commentary, 'msg_commentary'), codex_phase: 'commentary' }
    const finalItem = { ...message(answer, 'msg_final'), codex_phase: 'final' }
    const terminal = completed([commentItem, { id: 'reasoning_private', type: 'reasoning', encrypted_content: 'PRIVATE_REASONING' }, finalItem])
    const callbacks = options(), feed = createFeedProjector()
    const base = { eventId: 'event_test', taskId: 'task_test', runId: 'run_test', timestamp: 1, turnId: 'turn_test' }
    feed.apply({ ...base, type: 'message.started', messageId: 'adapter_message', role: 'assistant' })
    callbacks.onText = vi.fn(delta => { feed.apply({ ...base, type: 'message.delta', messageId: 'adapter_message', deltaType: 'text', content: delta }) })
    const input = frame(created) + frame({ type: 'response.output_text.delta', item_id: 'msg_commentary', output_index: 0, content_index: 0, delta: commentary }) + frame({ type: 'response.output_item.done', output_index: 0, item: commentItem }) + frame({ type: 'response.reasoning_text.delta', delta: 'PRIVATE_REASONING' }) + frame({ type: 'response.output_text.delta', item_id: 'msg_final', output_index: 2, content_index: 0, delta: answer }) + frame({ ...terminal, response: { ...terminal.response, output_text: answer } })
    const result = await consumeResponsesStream(response(input, 13), callbacks)
    expect(result.text).toBe(answer)
    expect(vi.mocked(callbacks.onText).mock.calls).toEqual([[commentary], [answer]])
    expect(feed.messages()[0].text).toBe(commentary + answer)
    // This is the existing ResponsesAdapter.run delivery contract, and the
    // production projector assigns fullContent rather than appending it.
    feed.apply({ ...base, type: 'message.completed', messageId: 'adapter_message', fullContent: result.text, finishReason: 'stop' })
    expect(feed.messages()).toHaveLength(1)
    expect(feed.messages()[0].text).toBe(answer)
    expect(JSON.stringify(result)).not.toContain('PRIVATE_REASONING')
  })

  it('accepts a differing final text without output items and bounds it before any media callback', async () => {
    const callbacks = options(), terminal = completed()
    const input = frame(created) + frame({ type: 'response.output_text.delta', delta: 'Working...' }) + frame({ ...terminal, response: { ...terminal.response, output_text: 'Done.' } })
    expect((await consumeResponsesStream(response(input), callbacks)).text).toBe('Done.')
    expect(callbacks.onText).toHaveBeenCalledExactlyOnceWith('Working...')
    const oversized = completed([image('ig_not_written', 'YQ==')])
    const invalidCallbacks = options()
    await expect(consumeResponsesStream(response(frame({ ...oversized, response: { ...oversized.response, output_text: 'a'.repeat(RESPONSES_LIMITS.textBytes + 1) } })), invalidCallbacks)).rejects.toThrow('API text exceeds')
    expect(invalidCallbacks.onImage).not.toHaveBeenCalled()
  })

  it.each([undefined, 0])('keeps anonymous commentary separate from a differing identified final message (index %s)', async outputIndex => {
    const callbacks = options(), terminal = completed([message('Final answer')])
    const input = frame(created) + frame({ type: 'response.output_text.delta', ...(outputIndex === undefined ? {} : { output_index: outputIndex }), delta: 'Checking the project first...' }) + frame({ ...terminal, response: { ...terminal.response, output_text: 'Final answer' } })
    expect((await consumeResponsesStream(response(input), callbacks)).text).toBe('Final answer')
    expect(vi.mocked(callbacks.onText).mock.calls).toEqual([['Checking the project first...'], ['Final answer']])
  })
})
