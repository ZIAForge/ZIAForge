import http, { type ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'

/** Deterministic loopback transport only; no native CLI, credentials or upstream requests. */
export async function startGrokFixture() {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64')
  const sha256 = createHash('sha256').update(png).digest('hex')
  const ids = { first: `resp_${'1'.repeat(32)}`, stopped: `resp_${'2'.repeat(32)}`, question: `question_${'a'.repeat(32)}`, reject: `approval_${'b'.repeat(32)}`, allow: `approval_${'c'.repeat(32)}`, cancelledQuestion: `question_${'d'.repeat(32)}` }
  const records: Array<{ method: string; path: string; body?: Record<string, unknown> }> = []
  const errors: string[] = [], open = new Set<ServerResponse>(), sequences = new WeakMap<ServerResponse, number>()
  let primary: ServerResponse | undefined, waiting: ServerResponse | undefined, generations = 0
  let stage: 'new' | 'question' | 'reject' | 'allow' | 'complete' = 'new'
  const envelope = { version: 1, artifacts: [] }
  const write = (response: ServerResponse, event: Record<string, unknown>) => {
    if (response.destroyed || response.writableEnded) throw new Error('Fixture attempted to advance a closed stream')
    const sequence_number = (sequences.get(response) ?? -1) + 1; sequences.set(response, sequence_number)
    response.write(`data: ${JSON.stringify({ ...event, sequence_number })}\n\n`)
  }
  const json = (response: ServerResponse, body: unknown, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)) }
  const question = (responseId: string, id: string) => ({ type: 'grok.question', version: 1, response_id: responseId, question: { id, request: { sessionId: 'native-fixture', toolCallId: 'native-question', mode: 'default', expiresAt: new Date(Date.now() + 120_000).toISOString(), questions: [{ question: 'Which exact platforms?', multiSelect: true, options: [{ label: 'Linux', description: 'Desktop A' }, { label: 'Windows', description: 'Desktop B' }] }, { question: '  What should change?  ', multiSelect: false, options: [{ label: 'Keep the default', description: 'A native option' }] }] } } })
  const approval = (id: string) => ({ type: 'grok.approval', version: 1, response_id: ids.first, approval: { id, expires_in: 120, request: { sessionId: 'native-fixture', toolCall: { toolCallId: id, title: id === ids.reject ? 'Optional image operation to reject' : 'Requested image operation', rawInput: { operation: 'image_gen', fixture: true } }, options: [{ optionId: 'native_reject_once', name: 'Reject this operation once', kind: 'reject_once' }, { optionId: 'native_allow_once', name: 'Allow this operation once', kind: 'allow_once' }] } } })
  const finishImage = () => {
    const artifactId = `file_${'e'.repeat(32)}`
    const artifact = { id: artifactId, object: 'file', kind: 'image', mime_type: 'image/png', bytes: png.length, sha256, api_url: `/v1/files/${artifactId}/content`, owner_url: `/api/artifacts/${artifactId}/content` }
    const item = { id: 'ig_grok_fixture', type: 'image_generation_call', status: 'completed', result: png.toString('base64') }
    write(primary!, { type: 'grok.artifact', version: 1, response_id: ids.first, artifact })
    write(primary!, { type: 'response.output_item.done', output_index: 0, item })
    write(primary!, { type: 'response.completed', response: { id: ids.first, status: 'completed', output: [item], grok: { version: 1, artifacts: [artifact] }, usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 } } })
    primary!.end(); stage = 'complete'
  }
  const server = http.createServer((request, response) => {
    void (async () => {
      const method = request.method ?? '', url = request.url ?? ''
      const chunks: Buffer[] = []; let size = 0
      for await (const chunk of request) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 1024 * 1024) throw new Error('Fixture request exceeded 1 MiB'); chunks.push(bytes) }
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : undefined
      records.push({ method, path: url, ...(body ? { body } : {}) })
      if (method === 'GET' && url === '/v1/models') return json(response, { data: [{ id: 'grok-fixture', reasoning_efforts: ['low', 'high'], default_reasoning_effort: 'low', context_windows: [32000, 64000], context_window: 32000 }] })
      if (method === 'GET' && url === '/v1/grok/capabilities') return json(response, { version: 1, cliVersion: 'fixture-only', nativeTools: ['web_search', 'web_fetch', 'image_gen', 'image_edit', 'ask_user_question'].map(name => ({ name })), imageInput: true, interactiveQuestions: { available: true }, reasoningSummaries: false, media: { images: { available: true, verified: true, edit: true }, video: { available: false, enabled: false, verified: false, restriction: 'Video is not enabled in this fixture' } } })
      if (method === 'GET' && url === '/v1/grok/usage') return json(response, { rate_limits: { tier: 'fixture', creditUsagePercent: null, currentPeriod: { end: null } } })
      if (method === 'POST' && url === '/v1/responses') {
        generations += 1
        if (generations > 2) throw new Error('Unexpected extra generation or automatic replay')
        const grok = body?.grok as Record<string, unknown> | undefined
        if (body?.model !== 'grok-fixture' || grok?.permissionMode !== 'default' || grok.maxTurns !== 9 || grok.contextWindow !== 32000 || typeof grok.clientWorkspace !== 'string') throw new Error('Wrong explicit profile/model/workspace/options')
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }); open.add(response); response.on('close', () => open.delete(response))
        if (generations === 1) {
          const inputs = body?.input as Array<{ role?: string; content?: Array<{ type?: string; image_url?: string }> }>
          if (inputs?.[0]?.role !== 'user' || !Array.isArray(inputs[0].content) || !inputs[0].content.some(item => item.type === 'input_image' && item.image_url === `data:image/png;base64,${png.toString('base64')}`)) throw new Error('Expected exact user image bytes')
          primary = response; stage = 'question'; write(response, { type: 'response.created', response: { id: ids.first, grok: envelope } }); write(response, question(ids.first, ids.question))
        } else {
          if (stage !== 'complete') throw new Error('New input started before first completion')
          waiting = response; write(response, { type: 'response.created', response: { id: ids.stopped, grok: envelope } }); write(response, question(ids.stopped, ids.cancelledQuestion))
        }
        return
      }
      if (method === 'POST' && url === `/v1/grok/questions/${ids.question}`) {
        if (stage !== 'question' || body?.outcome !== 'accepted' || JSON.stringify(body.answers) !== JSON.stringify({ 'Which exact platforms?': ['Linux', 'Windows'], '  What should change?  ': ['Other'] }) || JSON.stringify(body.annotations) !== JSON.stringify({ '  What should change?  ': { notes: 'Exact written answer — Ж' } })) throw new Error('Question labels, keys or notes were changed or replayed')
        stage = 'reject'; json(response, { id: ids.question, answered: true }); write(primary!, approval(ids.reject)); return
      }
      if (method === 'POST' && url === `/v1/grok/approvals/${ids.reject}`) {
        if (stage !== 'reject' || body?.optionId !== 'native_reject_once') throw new Error('Expected one explicit reject')
        stage = 'allow'; json(response, { id: ids.reject, answered: true }); write(primary!, approval(ids.allow)); return
      }
      if (method === 'POST' && url === `/v1/grok/approvals/${ids.allow}`) {
        if (stage !== 'allow' || body?.optionId !== 'native_allow_once') throw new Error('Expected one explicit allow')
        json(response, { id: ids.allow, answered: true }); finishImage(); return
      }
      if (method === 'POST' && url === `/v1/responses/${ids.stopped}/cancel`) {
        waiting?.end(); json(response, { id: ids.stopped, status: 'cancelled', grok: envelope }); return
      }
      throw new Error(`Unexpected fixture route ${method} ${url}`)
    })().catch(error => { errors.push(error instanceof Error ? error.message : String(error)); if (!response.headersSent) json(response, { error: { code: 'fixture_contract_error' } }, 400); else response.destroy() })
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Loopback fixture did not bind')
  return { baseUrl: `http://127.0.0.1:${address.port}/v1`, png, sha256, ids, records, errors, generationCount: () => generations,
    close: async () => { for (const response of open) response.destroy(); server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) },
  }
}
