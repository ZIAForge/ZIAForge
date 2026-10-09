import http, { type ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'

/** Synthetic loopback Messages peer only: no native CLI, credentials, filesystem tools or upstream calls. */
export async function startClaudeConnectorFixture() {
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n')
  const prompt = 'Read the selected fixture attachments and prepare a server report.'
  const ids = { response: `resp_${'1'.repeat(32)}`, approval: `approval_${'a'.repeat(32)}`, question: `question_${'b'.repeat(32)}`, nativeTool: 'native-write-fixture' }
  const serverFilename = 'provider-only-fixture.txt'
  const nativeInput = { file_path: serverFilename, content: 'Provider observation must not create a local file.' }
  const questionAnswers = { '  Which fixture format?  ': 'Text file', 'Comment for fixture report?': 'Exact owner answer — Ж' }
  const artifacts = [1, 2].map(revision => {
    const id = `file_${(revision === 1 ? 'c' : 'd').repeat(32)}`
    const bytes = Buffer.from(`Claude connector fixture report, revision ${revision} — Ж ✓\n`)
    return { bytes, metadata: { id, kind: 'file', filename: 'fixture-report.txt', mime_type: 'text/plain', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), api_url: `/v1/files/${id}/content`, revision, ...(revision === 2 ? { supersedes_file_id: `file_${'c'.repeat(32)}` } : {}) } }
  })
  const records: Array<{ method: string; path: string; body?: Record<string, unknown> }> = []
  const errors: string[] = [], streams = new Set<ServerResponse>()
  let primary: ServerResponse | undefined, generationCount = 0
  let stage: 'new' | 'approval' | 'question' | 'complete' = 'new'
  const tools = ['Write', 'AskUserQuestion']
  const discoveredTools = tools.map(name => ({ name, available: true, enabled: true, verified: true }))
  const supported = { available: true, enabled: true, verified: true }
  const capabilities = { version: 1, provider: 'claude', sdkVersion: 'fixture-only', toolCatalog: tools, discoveredTools, callerTools: supported, imageInput: true, nativeImageInput: supported, documentInput: { ...supported, mediaTypes: ['application/pdf', 'text/plain'] }, artifacts: supported, thinking: { available: true, display: ['summarized', 'omitted'] }, history: { liveSessionContinuation: true, ownedIdleResume: true, restartResume: true } }
  const json = (response: ServerResponse, body: unknown, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)) }
  const write = (response: ServerResponse, event: Record<string, unknown>) => {
    if (response.destroyed || response.writableEnded) throw new Error('Fixture attempted to advance a closed stream')
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  }
  const complete = () => {
    write(primary!, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'completed with two immutable files — Ж ✓' } })
    write(primary!, { type: 'content_block_stop', index: 0 })
    for (const artifact of artifacts) write(primary!, { type: 'claude.artifact', version: 1, response_id: ids.response, artifact: artifact.metadata })
    // Stream and terminal observations of the same file must create one download/card.
    write(primary!, { type: 'claude.artifact', version: 1, response_id: ids.response, artifact: artifacts[1].metadata })
    write(primary!, { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { input_tokens: 12, output_tokens: 8 } })
    write(primary!, { type: 'message_stop', claude: { version: 1, response_id: ids.response, requires_action: false, artifacts: artifacts.map(artifact => artifact.metadata) } })
    primary!.end(); stage = 'complete'
  }
  const server = http.createServer((request, response) => {
    void (async () => {
      const method = request.method ?? '', url = request.url ?? ''
      const chunks: Buffer[] = []; let size = 0
      for await (const chunk of request) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 1024 * 1024) throw new Error('Fixture request exceeded 1 MiB'); chunks.push(bytes) }
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : undefined
      records.push({ method, path: url, ...(body ? { body } : {}) })
      if (request.headers.authorization) throw new Error('Credential-free fixture received an unexpected Authorization header')
      if (method === 'GET' && url === '/v1/models') return json(response, { data: [{ id: 'claude-fixture', type: 'model', display_name: 'Claude Messages fixture', reasoning_efforts: ['low', 'high'], input_modalities: ['text', 'image', 'document'], context_windows: [200000], is_default: true, resolved_model: 'claude-fixture', supports_adaptive_thinking: true, supports_manual_thinking: true, max_output_tokens: 8192, claude: { version: 1, connector_max_output_tokens: 8192 } }] })
      if (method === 'GET' && url === '/v1/claude/capabilities') return json(response, capabilities)
      if (method === 'GET' && url === '/v1/claude/tools') return json(response, { version: 1, provider: 'claude', toolCatalog: tools, discoveredTools })
      if (method === 'GET' && url === '/v1/claude/usage') return json(response, { rate_limits: { available: false, windows: [{ name: 'fixture-window', usedPercent: null, resetsAt: null }] }, subscription: { source: 'unavailable', renewsAt: null } })
      if (method === 'GET' && url === '/v1/claude/status') return json(response, { claude: { connected: true, version: 'fixture-only' }, activity: { active: 0, queued: 0, nativeActive: 0, awaitingTools: 0, concurrency: 1, queueLimit: 4 } })
      if (method === 'GET' && url === '/v1/claude/sessions') return json(response, { version: 1, sessions: [] })
      const artifact = artifacts.find(item => item.metadata.api_url === url)
      if (method === 'GET' && artifact) { response.writeHead(200, { 'Content-Type': artifact.metadata.mime_type, 'Content-Length': artifact.bytes.length, 'Cache-Control': 'private, no-store' }); response.end(artifact.bytes); return }
      if (method === 'POST' && url === '/v1/messages') {
        generationCount++
        if (generationCount !== 1 || stage !== 'new') throw new Error('Unexpected generation or automatic replay')
        const native = body?.claude as Record<string, unknown> | undefined
        if (body?.model !== 'claude-fixture' || body.max_tokens !== 2048 || body.stream !== true || body.previous_response_id !== undefined || !Array.isArray(body.tools) || body.tools.length || native?.mode !== 'native' || native.permissionMode !== 'manual' || native.maxTurns !== 7 || native.historyMode !== 'reject' || typeof native.clientWorkspace !== 'string' || JSON.stringify(native.nativeTools) !== JSON.stringify(tools)) throw new Error('Wrong saved native profile, local-tool boundary or pinned options')
        const messages = body.messages as Array<{ role: string; content: Array<Record<string, unknown>> }>
        if (messages?.length !== 1 || messages[0].role !== 'user' || !Array.isArray(messages[0].content)) throw new Error('Missing exact user input')
        const content = messages[0].content
        if (content.length !== 3 || JSON.stringify(content[0]) !== JSON.stringify({ type: 'text', text: prompt }) || JSON.stringify(content[1]) !== JSON.stringify({ type: 'image', source: { type: 'base64', media_type: 'image/gif', data: gif.toString('base64') } }) || JSON.stringify(content[2]) !== JSON.stringify({ type: 'document', title: 'selected-fixture.pdf', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } })) throw new Error('Attachment MIME, order or owned bytes changed')
        primary = response; stage = 'approval'
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }); streams.add(response); response.on('close', () => streams.delete(response))
        write(response, { type: 'message_start', message: { id: ids.response.replace('resp_', 'msg_'), type: 'message', role: 'assistant', model: 'claude-fixture', content: [], stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } } })
        write(response, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
        write(response, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Claude connector fixture — ' } })
        write(response, { type: 'claude.tool', version: 1, response_id: ids.response, tool: { id: ids.nativeTool, name: 'Write', status: 'in_progress', input: nativeInput } })
        write(response, { type: 'claude.approval', version: 1, response_id: ids.response, approval: { id: ids.approval, expires_in: 120, request: { toolName: 'Write', toolUseID: ids.nativeTool, description: 'Fixture server write only', input: nativeInput, suppressAlwaysAllowRule: true } } })
        return
      }
      if (method === 'POST' && url === `/v1/claude/approvals/${ids.approval}`) {
        if (stage !== 'approval' || JSON.stringify(body) !== JSON.stringify({ behavior: 'allow' })) throw new Error('Native permission changed input or was replayed')
        stage = 'question'; json(response, { id: ids.approval, answered: true })
        write(primary!, { type: 'claude.tool', version: 1, response_id: ids.response, tool: { id: ids.nativeTool, name: 'Write', status: 'completed', output: { fixture: true, location: 'connector-owned workspace' } } })
        write(primary!, { type: 'claude.question', version: 1, response_id: ids.response, question: { id: ids.question, request: { toolCallId: 'native-question-fixture', questions: [{ question: '  Which fixture format?  ', header: 'Format', options: [{ label: 'Text file', description: 'Downloadable report' }, { label: 'Keep PDF', description: 'A fixture option' }], multiSelect: false }, { question: 'Comment for fixture report?', options: [], multiSelect: false }] } } })
        return
      }
      if (method === 'POST' && url === `/v1/claude/questions/${ids.question}`) {
        if (stage !== 'question' || JSON.stringify(body) !== JSON.stringify({ answers: questionAnswers })) throw new Error('Exact question keys or answer changed or were replayed')
        json(response, { id: ids.question, answered: true }); complete(); return
      }
      if (method === 'POST' && url === `/v1/responses/${ids.response}/cancel`) {
        primary?.end(); json(response, { id: ids.response, status: 'cancelled', claude: { requires_action: false } }); return
      }
      throw new Error(`Unexpected fixture route ${method} ${url}`)
    })().catch(error => { errors.push(error instanceof Error ? error.message : String(error)); if (!response.headersSent) json(response, { error: { code: 'fixture_contract_error' } }, 400); else response.destroy() })
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Claude loopback fixture did not bind')
  return { origin: `http://127.0.0.1:${address.port}`, gif, pdf, prompt, ids, serverFilename, questionAnswers, artifacts, records, errors, generationCount: () => generationCount,
    close: async () => { for (const response of streams) response.destroy(); server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) },
  }
}
