const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')

const defaultPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBZYAAAAASUVORK5CYII='
const nativeCwd = '/provider/fixture/workspace'
const nativeSentinel = 'provider-native-must-not-exist.txt'

/** Disposable loopback Responses only: no forwarding, real keys, or model inference. */
async function startResponsesFixture() {
  const imagePath = process.env.ZIAFORGE_E2E_MEDIA_IMAGE
  if (imagePath && !path.isAbsolute(imagePath)) throw new Error('Fixture image must use an absolute local path')
  if (imagePath && (await fs.stat(imagePath)).size > 32 * 1024 * 1024) throw new Error('Fixture image exceeds the private media limit')
  const bytes = imagePath ? await fs.readFile(imagePath) : Buffer.from(defaultPNG, 'base64')
  if (!bytes.length || bytes.length > 32 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Fixture image must be a bounded PNG')
  const encoded = bytes.toString('base64')
  const media = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), encodedPrefix: encoded.slice(0, 256) }
  const requests = [], cancellations = [], interrupted = [], errors = []
  const pending = new Map()
  let sequence = 0
  const event = value => `event: ${value.type}\r\ndata: ${JSON.stringify({ ...value, sequence_number: sequence++ })}\r\n\r\n`
  const created = id => ({ type: 'response.created', response: { id, status: 'in_progress' } })
  const message = (id, text) => ({ id, type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] })
  const completed = (id, output, usage) => ({ type: 'response.completed', response: { id, status: 'completed', output, usage } })
  const caller = async (response, id, itemId, callId, name, argumentsValue, hosted = []) => {
    const item = { id: itemId, type: 'function_call', call_id: callId, name, arguments: JSON.stringify(argumentsValue), status: 'completed' }
    await stream(response, [created(id), ...hosted, { type: 'response.output_item.added', output_index: 0, item: { ...item, arguments: '', status: 'in_progress' } }, { type: 'response.function_call_arguments.delta', item_id: itemId, output_index: 0, delta: item.arguments.slice(0, 4) }, { type: 'response.function_call_arguments.delta', item_id: itemId, output_index: 0, delta: item.arguments.slice(4) }, { type: 'response.function_call_arguments.done', item_id: itemId, output_index: 0, arguments: item.arguments }, { type: 'response.output_item.done', output_index: 0, item }, completed(id, [item], { input_tokens: 3, output_tokens: 1, total_tokens: 4 })])
  }
  const write = (response, chunk) => new Promise((resolve, reject) => {
    if (response.destroyed) { reject(new Error('Fixture stream closed')); return }
    response.write(chunk, error => error ? reject(error) : resolve())
  })
  async function stream(response, events, finish = true) {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    for (const value of events) {
      const buffer = Buffer.from(event(value))
      // Split both framing and Unicode bytes without creating millions of image writes.
      for (let offset = 0; offset < buffer.length;) {
        const end = Math.min(buffer.length, offset + (offset < 384 ? 3 : 64 * 1024))
        await write(response, buffer.subarray(offset, end)); offset = end
      }
    }
    if (finish) response.end()
  }
  const functionOutput = (body, callId, previous) => {
    if (body.previous_response_id !== previous || !Array.isArray(body.input) || body.input.length !== 1 || body.input[0].type !== 'function_call_output' || body.input[0].call_id !== callId || typeof body.input[0].output !== 'string') throw new Error('Fixture received an invalid caller continuation')
    return JSON.parse(body.input[0].output)
  }
  const fail = response => { if (!response.headersSent) response.writeHead(400); if (!response.destroyed) response.end() }
  const server = http.createServer((request, response) => {
    // The fresh test profile deliberately stores no credential. Never record headers.
    if (request.headers.authorization) { errors.push('Unexpected fixture authorization'); fail(response); return }
    if (request.method === 'GET' && request.url === '/v1/models') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ data: [{ id: 'responses-fixture-model' }] })); return
    }
    const cancel = /^\/v1\/responses\/([A-Za-z0-9_-]+)\/cancel$/.exec(request.url || '')
    if (request.method === 'POST' && cancel) {
      cancellations.push(cancel[1])
      const waiting = pending.get(cancel[1])
      if (!waiting) { response.writeHead(404); response.end(); return }
      pending.delete(cancel[1]); if (!waiting.destroyed) waiting.end()
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ id: cancel[1], status: 'cancelled' })); return
    }
    if (request.method !== 'POST' || request.url !== '/v1/responses') { response.writeHead(404); response.end(); return }
    let input = '', size = 0
    request.on('data', chunk => { size += chunk.length; if (size > 2 * 1024 * 1024) request.destroy(); else input += chunk })
    request.on('end', () => {
      void (async () => {
        const body = JSON.parse(input)
        if (body.model !== 'responses-fixture-model' || body.stream !== true || typeof body.instructions !== 'string' || !Array.isArray(body.input)) throw new Error('Fixture received an invalid Responses request')
        requests.push(body)
        const user = body.input.find(item => item.role === 'user')?.content || ''
        if (user.includes('fixture-responses-wait')) {
          pending.set('resp_fixture_wait', response)
          response.on('close', () => interrupted.push('resp_fixture_wait'))
          await stream(response, [created('resp_fixture_wait'), { type: 'response.output_text.delta', item_id: 'msg_wait', output_index: 0, content_index: 0, delta: 'Responses fixture is waiting for Stop.' }], false)
          return
        }
        if (user.includes('fixture-responses-recall')) {
          if (body.previous_response_id !== 'resp_fixture_media') throw new Error('Fixture lost the previous completed response identity')
          const text = 'Responses context resumed without replaying caller tools or generating another image. Ж🙂'
          await stream(response, [created('resp_fixture_recall'), { type: 'response.output_text.delta', item_id: 'msg_recall', output_index: 0, content_index: 0, delta: text }, completed('resp_fixture_recall', [message('msg_recall', text)], { input_tokens: 2, output_tokens: 2, total_tokens: 4 })]); return
        }
        if (body.previous_response_id === 'resp_fixture_list') {
          const output = functionOutput(body, 'call_fixture_list', 'resp_fixture_list')
          if (!Array.isArray(output.entries) || output.entries.length !== 0 || output.truncated !== false) throw new Error('Fixture local list_files result was not the empty trusted task directory')
          if (!body.tools?.some(tool => tool.name === 'run_command' && tool.parameters?.required?.includes('timeoutMs'))) throw new Error('Fixture local command schema is unavailable')
          const item = { id: 'native_command', type: 'commandExecution', command: `/bin/sh -c "printf provider-only > ${nativeSentinel}"`, cwd: nativeCwd, status: 'in_progress' }
          await caller(response, 'resp_fixture_command', 'fc_fixture_command', 'call_fixture_command', 'run_command', { executable: '/bin/pwd', args: [], timeoutMs: null }, [
            { type: 'codex.tool', method: 'item/started', params: { item, threadId: 'thread_fixture', turnId: 'turn_fixture' } },
            { type: 'codex.tool', method: 'item/commandExecution/outputDelta', params: { itemId: item.id, delta: 'Synthetic provider stdout from its own workspace.\n' } },
            { type: 'codex.tool', method: 'item/completed', params: { item: { ...item, status: 'completed', exitCode: 0, aggregatedOutput: 'Synthetic provider stdout from its own workspace.\n' } } },
          ]); return
        }
        if (body.previous_response_id === 'resp_fixture_command') {
          const output = functionOutput(body, 'call_fixture_command', 'resp_fixture_command')
          if (output.status !== 'passed' || output.exitCode !== 0 || output.cleanupVerified !== true || typeof output.stdout !== 'string' || !body.instructions.includes(output.stdout.trim()) || output.stdout.trim() === nativeCwd) throw new Error('Fixture local command did not report the trusted local cwd')
          const item = { id: 'ig_fixture_image', type: 'image_generation_call', status: 'completed', result: encoded }
          const text = 'Caller list_files and approved pwd used the local task directory. Provider command stayed remote. Generated image is stored privately. Ж🙂'
          await stream(response, [created('resp_fixture_media'), { type: 'response.output_item.done', output_index: 0, item }, { type: 'response.output_text.delta', item_id: 'msg_media', output_index: 1, content_index: 0, delta: text }, completed('resp_fixture_media', [item, message('msg_media', text)], { input_tokens: 8, output_tokens: 4, total_tokens: 12 })]); return
        }
        if (!user.includes('fixture-responses-media') || body.previous_response_id !== undefined) throw new Error('Fixture received an unexpected initial prompt')
        await caller(response, 'resp_fixture_list', 'fc_fixture_list', 'call_fixture_list', 'list_files', { path: '.' })
      })().catch(() => {
        // A deliberately aborted wait stream is expected; errors never include bodies.
        if (!response.destroyed) { errors.push('Responses fixture contract failed'); fail(response) }
      })
    })
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`, requests, cancellations, interrupted, errors, media, nativeCwd, nativeSentinel,
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) },
  }
}
module.exports = { startResponsesFixture }
