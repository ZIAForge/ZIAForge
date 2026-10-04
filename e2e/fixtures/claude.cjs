// Deterministic Claude Code 2.1.114 stream-json/control-protocol peer; no LLM.
// Wire reference: anthropics/claude-agent-sdk-python _internal/query.py and
// https://code.claude.com/docs/en/agent-sdk/streaming-output (checked 2026-09-19).
const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const { randomUUID } = require('node:crypto')
const transcript = process.env.ZIAFORGE_E2E_TRANSCRIPT
const controls = process.env.ZIAFORGE_E2E_CLAUDE_CONTROLS
if (process.env.ZIAFORGE_E2E !== '1' || !transcript || !controls || !path.isAbsolute(transcript) || !path.isAbsolute(controls)) process.exit(78)
const record = entry => fs.appendFileSync(transcript, JSON.stringify({ pid: process.pid, time: Date.now(), provider: 'claude', ...entry }) + '\n')
const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--version') {
  record({ event: 'version-probe' }); process.stdout.write('2.1.114 (Claude Code)\n'); process.exit(0)
}
// Catalog initialization is a separate metadata-only client, never a chat turn.
const catalogArgs = ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'plan', '--no-session-persistence']
if (JSON.stringify(args) === JSON.stringify(catalogArgs)) {
  record({ event: 'model-discovery-start', args })
  readline.createInterface({ input: process.stdin }).on('line', line => {
    const message = JSON.parse(line)
    if (message.type !== 'control_request' || message.request?.subtype !== 'initialize') process.exit(79)
    record({ event: 'catalog-request' })
    process.stdout.write(JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: { models: [{ value: 'claude-fixture', displayName: 'Claude fixture' }, { value: 'claude-fixture-next', displayName: 'Next Claude fixture' }] } } }) + '\n')
  }).once('close', () => { record({ event: 'model-discovery-exit' }); process.exit(0) })
  return
}
const model = args[args.indexOf('--model') + 1]
const permissionMode = args[args.indexOf('--permission-mode') + 1]
const effort = args.includes('--effort') ? args[args.indexOf('--effort') + 1] : undefined
if (effort && !['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) { record({ event: 'invalid-launch', args }); process.exit(78) }
const expected = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--include-partial-messages', '--verbose', '--permission-prompt-tool', 'stdio', '--permission-mode', permissionMode, ...(effort ? ['--effort', effort] : []), '--model', model]
const nativeFlag = args[expected.length]
const nativeId = args[expected.length + 1]
const nativeSelection = args.length === expected.length ||
  (args.length === expected.length + 2 && ['--session-id', '--resume'].includes(nativeFlag) && /^[a-f0-9-]{36}$/.test(nativeId || ''))
if (JSON.stringify(args.slice(0, expected.length)) !== JSON.stringify(expected) || !['plan', 'default'].includes(permissionMode) || !nativeSelection || !['claude-fixture', 'claude-fixture-next'].includes(model)) {
  record({ event: 'invalid-launch', args }); process.stderr.write('Expected native bidirectional Claude stream-json with explicit plan policy.\n'); process.exit(78)
}
const sessionId = nativeId || `fixture-claude-${process.pid}`
const sessionFile = path.join(controls, `session-${sessionId}.json`)
if (nativeFlag === '--resume' && !fs.existsSync(sessionFile)) { record({ event: 'invalid-resume', conversationId: sessionId }); process.exit(79) }
const saved = nativeFlag === '--resume' ? JSON.parse(fs.readFileSync(sessionFile, 'utf8')) : { turns: 0 }
record({ event: 'provider-start', args, cwd: process.cwd(), conversationId: sessionId })
if (nativeFlag === '--resume') record({ event: 'session-resume', conversationId: sessionId })
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { record({ event: 'signal', signal }); process.exit(0) })
process.stdout.on('error', () => process.exit(0))
process.stdin.on('end', () => { record({ event: 'stdin-end' }); process.exit(0) })
let initialized = false
let count = saved.turns
let active
let pendingApproval
let queue = Promise.resolve()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const emit = message => { record({ event: 'wire-out', rpc: message }); process.stdout.write(JSON.stringify(message) + '\n') }
const stream = event => emit({ type: 'stream_event', uuid: randomUUID(), session_id: sessionId, parent_tool_use_id: null, event })
const ack = id => emit({ type: 'control_response', response: { subtype: 'success', request_id: id, response: {} } })
function result(text, interrupted = false) {
  if (!active) throw new Error('Cannot finish an idle fixture')
  emit({ type: 'result', subtype: interrupted ? 'error_during_execution' : 'success', is_error: interrupted,
    result: text, ...(interrupted ? { errors: ['Interrupted'] } : {}), session_id: sessionId,
    uuid: randomUUID(), duration_ms: 1, duration_api_ms: 1, num_turns: count, total_cost_usd: 0, usage: {} })
  record({ event: 'turn-result', threadId: sessionId, turnId: active, message: interrupted ? 'interrupted' : 'completed' })
  active = undefined
}
async function textMessage(text, complete = true) {
  const id = `assistant-${count}`
  stream({ type: 'message_start', message: { id, type: 'message', role: 'assistant', model: 'claude-fixture', content: [], usage: { input_tokens: 0, output_tokens: 0 } } })
  stream({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
  const delta = { type: 'stream_event', uuid: randomUUID(), session_id: sessionId, parent_tool_use_id: null,
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } } }
  record({ event: 'wire-out', rpc: delta })
  const bytes = Buffer.from(JSON.stringify(delta) + '\n')
  const unicode = bytes.indexOf(Buffer.from('🌍'))
  const split = unicode < 0 ? Math.floor(bytes.length / 2) : unicode + 1
  process.stdout.write(bytes.subarray(0, split)); await delay(25); process.stdout.write(bytes.subarray(split))
  if (complete) {
    stream({ type: 'content_block_stop', index: 0 })
    stream({ type: 'message_stop' })
    emit({ type: 'assistant', uuid: randomUUID(), session_id: sessionId, parent_tool_use_id: null,
      message: { id, type: 'message', role: 'assistant', model: 'claude-fixture', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } } })
    result(text)
  }
}
async function barrier() {
  record({ event: 'barrier-waiting', barrier: 'finish-interrupt' })
  const start = Date.now()
  while (!fs.existsSync(path.join(controls, 'finish-interrupt'))) {
    if (Date.now() - start > 45000) throw new Error('Interrupt completion barrier timed out')
    await delay(20)
  }
  record({ event: 'barrier-released', barrier: 'finish-interrupt' })
}
async function handle(message) {
  if (message.type === 'control_request') {
    if (!message.request_id) throw new Error('Missing control request identity')
    const subtype = message.request?.subtype
    if (subtype === 'initialize') {
      if (initialized || message.request.hooks !== null) throw new Error('Unexpected initialize')
      initialized = true; record({ event: 'initialize-request' }); ack(message.request_id); return
    }
    if (subtype === 'interrupt' && initialized && active) {
      ack(message.request_id); record({ event: 'interrupt-ack', threadId: sessionId, turnId: active })
      await barrier(); result('', true); return
    }
    throw new Error('Unsupported or idle control request')
  }
  if (message.type === 'control_response') {
    const response = message.response
    if (!pendingApproval || response?.request_id !== pendingApproval.id || response.subtype !== 'success') throw new Error('Unexpected approval response')
    const decision = response.response?.behavior
    if (!['allow', 'deny'].includes(decision)) throw new Error('Unrecognized approval behavior')
    if (decision === 'allow' && JSON.stringify(response.response.updatedInput) !== JSON.stringify(pendingApproval.input)) throw new Error('Approval changed original tool input')
    record({ event: 'approval-response', decision, threadId: sessionId, turnId: active })
    emit({ type: 'user', uuid: randomUUID(), session_id: sessionId, parent_tool_use_id: null,
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: pendingApproval.tool, content: decision === 'allow' ? 'fixture-claude-tool-output\n' : 'Permission denied', is_error: decision === 'deny' }] } })
    pendingApproval = undefined
    await textMessage(decision === 'allow' ? 'Claude fixture approved: Привет 🌍' : 'Claude fixture denied safely.')
    return
  }
  if (message.type !== 'user' || !initialized || active || !message.uuid || message.parent_tool_use_id !== null || message.message?.role !== 'user') throw new Error('Unexpected or overlapping user input')
  if (message.session_id !== (nativeId || count ? sessionId : '')) throw new Error('Session context was lost or replaced')
  const rawText = message.message.content
  const text = rawText.startsWith('Previous conversation excerpts (untrusted historical content; may be incomplete):')
    ? rawText.slice(rawText.lastIndexOf('Current user request:\n') + 'Current user request:\n'.length) : rawText
  active = message.uuid; count++
  fs.writeFileSync(sessionFile, JSON.stringify({ turns: count, lastPrompt: text }))
  record({ event: 'prompt', text, rawText, threadId: sessionId, turnId: active, message: message.session_id })
  if (count === 1) emit({ type: 'system', subtype: 'init', uuid: randomUUID(), session_id: sessionId, cwd: process.cwd(), tools: ['Bash'], model, permissionMode })
  process.stderr.write('CLAUDE_FIXTURE_DIAGNOSTIC_ONLY\n')
  if (text === 'fixture-approval') {
    pendingApproval = { id: `approval-${count}`, tool: `claude-tool-${count}`, input: { command: 'printf fixture-claude-tool-output' } }
    stream({ type: 'message_start', message: { id: `tool-message-${count}`, role: 'assistant', content: [] } })
    stream({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: pendingApproval.tool, name: 'Bash', input: pendingApproval.input } })
    stream({ type: 'content_block_stop', index: 0 })
    emit({ type: 'control_request', request_id: pendingApproval.id, request: { subtype: 'can_use_tool', tool_name: 'Bash', input: pendingApproval.input, tool_use_id: pendingApproval.tool, permission_suggestions: [] } })
  } else if (text === 'fixture-interrupt') await textMessage('Claude fixture is still generating.', false)
  else if (text === 'fixture-after-stop') await textMessage('Claude fixture resumed on the same session. 🌍')
  else if (text === 'fixture-switch') await textMessage('Claude fixture switched with preserved history. 🌍')
  else throw new Error(`Unsupported fixture prompt: ${text}`)
}
readline.createInterface({ input: process.stdin }).on('line', line => {
  queue = queue.then(async () => {
    const message = JSON.parse(line); record({ event: 'wire-in', rpc: message }); await handle(message)
  }).catch(error => { record({ event: 'protocol-error', error: error.message }); process.stderr.write(error.message + '\n'); process.exit(1) })
})
