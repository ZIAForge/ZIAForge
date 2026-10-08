import http, { type ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { open as openFile } from 'node:fs/promises'
import { constants } from 'node:fs'

/** Deterministic loopback transport only; no native CLI, credentials or upstream requests. */
export async function startGrokFixture(options: { ambiguousFirstApproval?: boolean; duplicateAllowApproval?: boolean; videoPath?: string } = {}) {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64')
  const sha256 = createHash('sha256').update(png).digest('hex')
  const ids = { first: `resp_${'1'.repeat(32)}`, stopped: `resp_${'2'.repeat(32)}`, question: `question_${'a'.repeat(32)}`, reject: `approval_${'b'.repeat(32)}`, allow: `approval_${'c'.repeat(32)}`, cancelledQuestion: `question_${'d'.repeat(32)}` }
  // The retained MP4 stays outside Git. This fixture neither creates media nor contacts its source.
  let video: { bytes: Buffer; sha256: string; id: string } | undefined
  if (options.videoPath) {
    const handle = await openFile(options.videoPath, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size <= 0 || stat.size > 128 * 1024 * 1024) throw new Error('Expected a regular MP4 fixture up to 128 MiB')
      const bytes = await handle.readFile()
      if (bytes.length !== stat.size) throw new Error('MP4 fixture changed during read')
      video = { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), id: `file_${'f'.repeat(32)}` }
    } finally { await handle.close() }
  }
  const apiKey = video ? 'fixture-only-video-bearer-not-a-real-credential' : undefined
  const records: Array<{ method: string; path: string; authorized?: boolean; body?: Record<string, unknown> }> = []
  const errors: string[] = [], open = new Set<ServerResponse>(), sequences = new WeakMap<ServerResponse, number>()
  let primary: ServerResponse | undefined, waiting: ServerResponse | undefined, generations = 0, duplicateApprovalEvents = 0
  let stage: 'new' | 'question' | 'reject' | 'allow' | 'complete' = 'new'
  const envelope = { version: 1, artifacts: [] }
  const write = (response: ServerResponse, event: Record<string, unknown>) => {
    if (response.destroyed || response.writableEnded) throw new Error('Fixture attempted to advance a closed stream')
    const sequence_number = (sequences.get(response) ?? -1) + 1; sequences.set(response, sequence_number)
    response.write(`data: ${JSON.stringify({ ...event, sequence_number })}\n\n`)
  }
  const json = (response: ServerResponse, body: unknown, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)) }
  const question = (responseId: string, id: string) => ({ type: 'grok.question', version: 1, response_id: responseId, question: { id, request: { sessionId: 'native-fixture', toolCallId: 'native-question', mode: 'default', expiresAt: new Date(Date.now() + 120_000).toISOString(), questions: [{ question: 'Which exact platforms?', multiSelect: true, options: [{ label: 'Linux', description: 'Desktop A' }, { label: 'Windows', description: 'Desktop B' }] }, { question: '  What should change?  ', multiSelect: false, options: [{ label: 'Keep the default', description: 'A native option' }] }] } } })
  const approval = (id: string) => ({ type: 'grok.approval', version: 1, response_id: ids.first, approval: { id, expires_in: 120, request: { sessionId: 'native-fixture', toolCall: { toolCallId: id, title: id === ids.reject ? 'Optional image operation to reject' : 'Requested image operation', kind: 'other', rawInput: { variant: id === ids.reject ? 'ImageEdit' : 'ImageGen', operation: 'image_gen', fixture: true } }, options: [{ optionId: 'native_reject_once', name: 'Reject this operation once', kind: 'reject_once' }, { optionId: 'native_allow_once', name: 'Allow this operation once', kind: 'allow_once' }, ...(id === ids.reject && options.ambiguousFirstApproval ? [{ optionId: 'native_allow_alternative', name: 'Another one-time permission', kind: 'allow_once' }] : [])] } } })
  const finishImage = () => {
    const artifactId = `file_${'e'.repeat(32)}`
    const artifact = { id: artifactId, object: 'file', kind: 'image', mime_type: 'image/png', bytes: png.length, sha256, api_url: `/v1/files/${artifactId}/content`, owner_url: `/api/artifacts/${artifactId}/content` }
    const item = { id: 'ig_grok_fixture', type: 'image_generation_call', status: 'completed', result: png.toString('base64') }
    write(primary!, { type: 'grok.artifact', version: 1, response_id: ids.first, artifact })
    write(primary!, { type: 'response.output_item.done', output_index: 0, item })
    write(primary!, { type: 'response.completed', response: { id: ids.first, status: 'completed', output: [item], grok: { version: 1, artifacts: [artifact] }, usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 } } })
    primary!.end(); stage = 'complete'
  }
  const finishVideo = (response: ServerResponse) => {
    const artifact = { id: video!.id, object: 'file', kind: 'video', mime_type: 'video/mp4', bytes: video!.bytes.length, sha256: video!.sha256, api_url: `/v1/files/${video!.id}/content`, filename: 'fixture-video.mp4' }
    const tool = { id: 'native-video-fixture', name: 'reference_to_video', input: { duration: 6, resolution: '480p' } }
    write(response, { type: 'grok.tool', version: 1, response_id: ids.first, tool: { ...tool, status: 'running' } })
    write(response, { type: 'grok.tool', version: 1, response_id: ids.first, tool: { ...tool, status: 'completed', output: { artifactId: video!.id } } })
    // A repeated observation and terminal metadata must converge on one download and one card.
    write(response, { type: 'grok.artifact', version: 1, response_id: ids.first, artifact })
    write(response, { type: 'grok.artifact', version: 1, response_id: ids.first, artifact })
    write(response, { type: 'response.completed', response: { id: ids.first, status: 'completed', output: [], grok: { version: 1, artifacts: [artifact] }, usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 } } })
    response.end(); stage = 'complete'
  }
  const server = http.createServer((request, response) => {
    void (async () => {
      const method = request.method ?? '', url = request.url ?? ''
      const chunks: Buffer[] = []; let size = 0
      for await (const chunk of request) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 1024 * 1024) throw new Error('Fixture request exceeded 1 MiB'); chunks.push(bytes) }
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : undefined
      const authorized = !apiKey || request.headers.authorization === `Bearer ${apiKey}`
      records.push({ method, path: url, ...(apiKey ? { authorized } : {}), ...(body ? { body } : {}) })
      if (!authorized) { errors.push('Missing synthetic fixture bearer'); return json(response, { error: { code: 'unauthorized' } }, 401) }
      if (method === 'GET' && url === '/v1/models') return json(response, { data: [{ id: 'grok-fixture', reasoning_efforts: ['low', 'high'], default_reasoning_effort: 'low', context_windows: [32000, 64000], context_window: 32000 }] })
      if (method === 'GET' && url === '/v1/grok/capabilities') return json(response, { version: 1, cliVersion: 'fixture-only', nativeTools: ['web_search', 'web_fetch', 'image_gen', 'image_edit', 'ask_user_question', ...(video ? ['image_to_video', 'reference_to_video'] : [])].map(name => ({ name })), imageInput: true, interactiveQuestions: { available: true }, reasoningSummaries: false, media: { images: { available: true, verified: true, edit: true }, video: video ? { available: true, enabled: true, verified: true } : { available: false, enabled: false, verified: false, restriction: 'Video is not enabled in this fixture' } } })
      if (method === 'GET' && url === '/v1/grok/usage') return json(response, { rate_limits: { tier: 'fixture', creditUsagePercent: null, currentPeriod: { end: null } } })
      if (video && method === 'GET' && url === `/v1/files/${video.id}/content`) {
        response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': video.bytes.length, 'Cache-Control': 'private, no-store' }); response.end(video.bytes); return
      }
      if (method === 'POST' && url === '/v1/responses') {
        generations += 1
        if (generations > (video ? 1 : 2)) throw new Error('Unexpected extra generation or automatic replay')
        const grok = body?.grok as Record<string, unknown> | undefined
        if (body?.model !== 'grok-fixture' || grok?.permissionMode !== 'default' || grok.maxTurns !== 9 || grok.contextWindow !== 32000 || typeof grok.clientWorkspace !== 'string' || 'autoApproveNativePermissions' in grok) throw new Error('Wrong explicit profile/model/workspace/options')
        const allowed = grok.allowedTools as string[] | undefined
        const expected = ['web_search', 'web_fetch', 'image_gen', 'image_edit', 'ask_user_question', ...(video ? ['image_to_video', 'reference_to_video'] : [])]
        if (!Array.isArray(allowed) || JSON.stringify([...allowed].sort()) !== JSON.stringify(expected.sort())) throw new Error('Wrong capability-gated provider tool allowlist')
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }); open.add(response); response.on('close', () => open.delete(response))
        if (generations === 1) {
          if (video) {
            const inputs = body?.input as Array<{ role?: string; content?: string | Array<{ type?: string; text?: string }> }>
            const content = inputs?.[0]?.content, expectedPrompt = 'Show the retained six-second reference video.'
            if (inputs?.[0]?.role !== 'user' || !(content === expectedPrompt || Array.isArray(content) && content.some(item => item.type === 'input_text' && item.text === expectedPrompt))) throw new Error('Expected explicit video fixture input')
            write(response, { type: 'response.created', response: { id: ids.first, grok: envelope } }); finishVideo(response); return
          }
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
        stage = 'allow'; json(response, { id: ids.reject, answered: true })
        const offered = approval(ids.allow); write(primary!, offered)
        if (options.duplicateAllowApproval) { write(primary!, offered); duplicateApprovalEvents++ }
        return
      }
      if (method === 'POST' && url === `/v1/grok/approvals/${ids.allow}`) {
        if (stage !== 'allow' || body?.optionId !== 'native_allow_once') throw new Error('Expected one exact offered allow_once')
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
  return { baseUrl: `http://127.0.0.1:${address.port}/v1`, png, sha256, ids, records, errors, apiKey, video: video ? { id: video.id, bytes: video.bytes.length, sha256: video.sha256 } : undefined, generationCount: () => generations, duplicateApprovalCount: () => duplicateApprovalEvents,
    close: async () => { for (const response of open) response.destroy(); server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) },
  }
}
