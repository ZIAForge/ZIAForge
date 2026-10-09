import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { ClaudeTerminalError, consumeClaudeMessagesStream, downloadClaudeArtifact, type ClaudeArtifactMetadata } from '../ClaudeMessagesProtocol'
import { claudeFrame, claudeRecords, claudeWire, responseId } from './claudeFixture'
const callbacks = () => ({ signal: new AbortController().signal, onText: vi.fn(), onThinking: vi.fn(), onResponseId: vi.fn(), onExtension: vi.fn() })
describe('Claude Messages protocol', () => {
  it('preserves signed blocks privately while exposing only standard public text/thinking and exact caller IDs', async () => {
    const options = callbacks(), signature = 'opaque-signed-value'
    const raw = claudeRecords(1, [{ type: 'thinking', thinking: 'Public summary', signature }, { type: 'redacted_thinking', data: 'opaque-not-rendered' }, { type: 'text', text: 'Ответ 🙂' }, { type: 'tool_use', id: 'caller.original/id', name: 'read_file', input: { path: 'file.txt' } }], [{ type: 'claude.message', version: 1, response_id: responseId(1), event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Never duplicate' } } }]).map(claudeFrame).join('')
    const bytes = new TextEncoder().encode(raw), body = new ReadableStream<Uint8Array>({ start(controller) { for (let n = 0; n < bytes.length; n += 7) controller.enqueue(bytes.slice(n, n + 7)); controller.close() } })
    const result = await consumeClaudeMessagesStream(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }), options)
    expect(result.text).toBe('Ответ 🙂'); expect(result.calls[0]).toEqual({ type: 'tool_use', id: 'caller.original/id', name: 'read_file', input: { path: 'file.txt' } })
    expect(result.content).toContainEqual({ type: 'thinking', thinking: 'Public summary', signature })
    expect(result.content).toContainEqual({ type: 'redacted_thinking', data: 'opaque-not-rendered' })
    expect(options.onText.mock.calls.flat().join('')).toBe('Ответ 🙂'); expect(options.onThinking.mock.calls.flat().join('')).toBe('Public summary')
    expect(JSON.stringify(options.onExtension.mock.calls)).not.toContain('opaque'); expect(options.onResponseId).toHaveBeenCalledExactlyOnceWith(responseId(1))
  })
  it('fails closed on truncation, terminal error, mismatched response, duplicate caller IDs and incomplete token ceiling', async () => {
    const valid = claudeRecords(1, [{ type: 'text', text: 'partial' }])
    const invalid = [valid.slice(0, -1), [...valid.slice(0, -1), { type: 'error', error: { message: 'failed' } }], [...valid.slice(0, -1), { type: 'message_stop', claude: { version: 1, response_id: responseId(2), artifacts: [] } }], valid.map(value => value.type === 'message_delta' ? { ...value, delta: { stop_reason: 'max_tokens' } } : value)]
    for (const records of invalid) await expect(consumeClaudeMessagesStream(new Response(records.map(claudeFrame).join(''), { headers: { 'Content-Type': 'text/event-stream' } }), callbacks())).rejects.toThrow()
    await expect(consumeClaudeMessagesStream(claudeWire(1, [1, 2].map(() => ({ type: 'tool_use', id: 'same-id', name: 'list_files', input: { path: '.' } }))), callbacks())).rejects.toThrow()
    await expect(consumeClaudeMessagesStream(new Response('event: content_block_delta\ndata: {"signature":"opaque-private", broken}\n\n', { headers: { 'Content-Type': 'text/event-stream' } }), callbacks())).rejects.toThrow('Claude returned an invalid Messages protocol envelope')
  })
  it('downloads only the exact authenticated immutable file route and checks MIME/size/SHA before returning bytes', async () => {
    const bytes = Buffer.from('fixture text'), metadata: ClaudeArtifactMetadata = { id: `file_${'a'.repeat(32)}`, kind: 'file', filename: 'note.txt', mime_type: 'application/octet-stream', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), api_url: `/v1/files/file_${'a'.repeat(32)}/content` }
    const fetcher = vi.fn(async () => new Response(bytes, { headers: { 'Content-Type': metadata.mime_type, 'Content-Length': String(bytes.length) } })) as unknown as typeof fetch
    expect(await downloadClaudeArtifact('https://fixture.invalid', metadata, 'private-key', new AbortController().signal, fetcher)).toEqual(bytes)
    expect(fetcher).toHaveBeenCalledWith(new URL(`https://fixture.invalid${metadata.api_url}`), expect.objectContaining({ headers: { Authorization: 'Bearer private-key' }, redirect: 'error' }))
    await expect(downloadClaudeArtifact('https://fixture.invalid', { ...metadata, api_url: 'https://foreign.invalid/steal' }, 'private-key', new AbortController().signal, fetcher)).rejects.toThrow()
    await expect(downloadClaudeArtifact('https://fixture.invalid', { ...metadata, sha256: '0'.repeat(64) }, 'private-key', new AbortController().signal, fetcher)).rejects.toThrow('integrity')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('retains only reviewed terminal codes and their bound response identity without exposing provider error bodies', async () => {
    for (const code of ['max_output_tokens', 'native_timeout'] as const) {
      const error = { type: 'error', error: { code, type: 'api_error', message: 'private provider content', signature: 'private-signature' } }
      for (const bound of [true, false]) {
        const records = [...(bound ? [claudeRecords(1, [])[0]] : []), error]
        const failure = await consumeClaudeMessagesStream(new Response(records.map(claudeFrame).join(''), { headers: { 'Content-Type': 'text/event-stream' } }), callbacks()).catch(value => value)
        expect(failure).toBeInstanceOf(ClaudeTerminalError)
        expect(failure).toMatchObject({ code, responseId: bound ? responseId(1) : undefined })
        expect(failure.message).toContain(code); expect(failure.message).not.toContain('private')
      }
    }
    const limited = claudeRecords(1, [{ type: 'text', text: 'Partial' }]).map(record => record.type === 'message_delta' ? { ...record, delta: { stop_reason: 'max_tokens' } } : record)
    await expect(consumeClaudeMessagesStream(new Response(limited.map(claudeFrame).join(''), { headers: { 'Content-Type': 'text/event-stream' } }), callbacks())).rejects.toMatchObject({ code: 'max_output_tokens', responseId: responseId(1) })
  })
})
