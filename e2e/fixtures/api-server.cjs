const http = require('node:http')

/** Only disposable E2E input is recorded; binds loopback and never forwards requests. */
async function startApiFixture() {
  const requests = []
  const interrupted = []
  const frames = (response, content) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' })
    response.end(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: 'stop' }] })}\n\ndata: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 14, completion_tokens: 6, total_tokens: 20 } })}\n\ndata: [DONE]\n\n`)
  }
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/v1/models') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ data: [{ id: 'api-fixture-model' }, { id: 'api-fixture-next' }] }))
      return
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') { response.writeHead(404); response.end(); return }
    let input = ''
    request.on('data', chunk => { input += chunk; if (Buffer.byteLength(input) > 2 * 1024 * 1024) request.destroy() })
    request.on('end', () => {
      let body
      try { body = JSON.parse(input) } catch { response.writeHead(400); response.end(); return }
      requests.push(body)
      const last = body.messages?.at(-1)
      const text = body.messages?.filter(message => message.role === 'user').at(-1)?.content || ''
      if (last?.role === 'tool') { frames(response, 'API fixture wrote the approved file.'); return }
      if (text.includes('fixture-api-write')) {
        const call = { index: 0, id: 'api-write-call', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ path: 'api-approved.txt', content: 'Approved by the real user-facing card.\n', expectedSha256: null }) } }
        response.writeHead(200, { 'Content-Type': 'text/event-stream' })
        response.end(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [call] }, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`)
        return
      }
      if (text.includes('fixture-api-wait')) {
        response.writeHead(200, { 'Content-Type': 'text/event-stream' })
        response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'API fixture is waiting for Stop.' }, finish_reason: null }] })}\n\n`)
        response.on('close', () => interrupted.push(text))
        return
      }
      if (text.includes('fixture-api-recall')) {
        const remembered = body.messages.some(message => message.role === 'user' && message.content?.includes('remember BASALT'))
        frames(response, remembered ? 'The remembered word is BASALT.' : 'MISSING_CONTEXT')
        return
      }
      frames(response, 'API fixture remembers the supplied word. Ж🙂')
    })
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, requests, interrupted, close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } }
}
module.exports = { startApiFixture }
