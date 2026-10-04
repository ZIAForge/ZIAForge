// Deterministic agy 1.2.7 NDJSON peer. It never starts a real provider or reads auth.
const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const { execFileSync } = require('node:child_process')

if (process.env.ZIAFORGE_E2E !== '1' || !path.isAbsolute(process.env.ZIAFORGE_E2E_TRANSCRIPT || '')) throw new Error('An isolated E2E transcript is required')
const record = entry => fs.appendFileSync(process.env.ZIAFORGE_E2E_TRANSCRIPT, JSON.stringify({ provider: 'antigravity', pid: process.pid, ...entry }) + '\n')
const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--version') {
  process.stdout.write('1.2.7\n')
  process.exit(0)
}
if (args.length === 1 && args[0] === 'models') {
  record({ event: 'model-discovery-start' })
  process.on('exit', code => record({ event: 'model-discovery-exit', code }))
  process.stdout.write('gemini-fixture\tDeterministic fixture model\ngemini-fixture-next\tAnother fixture model\n')
  process.exit(0)
}
const model = args[args.indexOf('--model') + 1]
const nativeId = args.includes('--conversation') ? args[args.indexOf('--conversation') + 1] : undefined
const effort = args.includes('--effort') ? args[args.indexOf('--effort') + 1] : undefined
if (effort && !['low', 'medium', 'high'].includes(effort)) { record({ event: 'invalid-launch', args }); process.exit(78) }
// Native init.cwd reports the OS cwd even when agy selects a different project.
// Keep project roots independent, so omitting native workspace selection cannot
// accidentally pass merely because spawn({ cwd }) was correct.
const nativeRoots = []
const baseArgs = []
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--add-dir') {
    const root = args[++index]
    if (!root || !path.isAbsolute(root)) { record({ event: 'invalid-launch', args }); process.exit(78) }
    nativeRoots.push(fs.realpathSync(root))
  } else baseArgs.push(args[index])
}
const expected = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--disable-slash-commands', ...(effort ? ['--effort', effort] : []), '--sandbox', ...(nativeId ? ['--conversation', nativeId] : []), '--model', model]
if (JSON.stringify(baseArgs) !== JSON.stringify(expected) || nativeRoots.length > 1 || !['gemini-fixture', 'gemini-fixture-next'].includes(model) || (nativeId && !/^agy-fixture-\d+$/.test(nativeId))) {
  record({ event: 'invalid-launch', args })
  process.exit(78)
}
const conversationId = nativeId || `agy-fixture-${process.pid}`
const profile = path.dirname(process.env.ZIAFORGE_E2E_TRANSCRIPT)
const stateFile = path.join(profile, `${conversationId}.json`)
const decoyWorkspace = path.join(profile, 'agy-default-workspace')
fs.mkdirSync(decoyWorkspace, { recursive: true })
fs.writeFileSync(path.join(decoyWorkspace, 'workspace-marker.txt'), 'WRONG_DEFAULT_PROJECT')
const saved = nativeId ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { turn: 0, step: 0, cwd: process.cwd(), logicalWorkspace: nativeRoots[0] || fs.realpathSync(decoyWorkspace) }
if (saved.cwd !== process.cwd()) throw new Error('Native resume changed workspace')
const logicalWorkspace = saved.logicalWorkspace
if (nativeRoots.length && nativeRoots[0] !== logicalWorkspace) throw new Error('Native resume changed project roots')
const controlFile = path.join(profile, 'agy-workspace-fixture.json')
const control = fs.existsSync(controlFile) ? JSON.parse(fs.readFileSync(controlFile, 'utf8')) : {}
let turn = saved.turn
let step = saved.step
let active = false
let output = Promise.resolve()
const emit = value => {
  // Split the UTF-8 globe bytes across real pipe writes, without interleaving records.
  const bytes = Buffer.from(JSON.stringify(value) + '\n')
  const split = bytes.indexOf(Buffer.from('🌍')) + 2
  output = output.then(() => new Promise(resolve => {
    if (split > 1) {
      process.stdout.write(bytes.subarray(0, split))
      setTimeout(() => process.stdout.write(bytes.subarray(split), resolve), 2)
    } else process.stdout.write(bytes, resolve)
  }))
  return output
}
const result = (status, response, error, deniedActions) => emit({ event: 'result', result: { conversation_id: conversationId, status, response, ...(error ? { error } : {}), ...(deniedActions ? { denied_actions: deniedActions } : {}), num_turns: turn, duration_seconds: turn * 0.1, usage: { input_tokens: turn * 10, output_tokens: turn * 5, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: turn * 15 } } })
const response = async text => {
  await emit({ event: 'step_update', step_update: { conversation_id: conversationId, step_index: ++step, step_type: 'agent_response', state: 'DONE', text_delta: text } })
  await result('SUCCESS', text)
  active = false
}
record({ event: 'provider-start', args, cwd: process.cwd(), conversationId })
record({ event: 'workspace-selection', cwd: logicalWorkspace, conversationId, rpc: { params: { spawnCwd: process.cwd(), spawnPwd: process.env.PWD, nativeRoots } } })
if (nativeId) record({ event: 'session-resume', conversationId })
process.stderr.write('AGY_FIXTURE_DIAGNOSTIC_ONLY: not assistant content\n')
void emit({ event: 'init', conversation_id: conversationId, init: { ...(control.initCwd === 'missing' ? {} : { cwd: control.initCwd === 'mismatched' ? decoyWorkspace : process.cwd() }), tools: ['view_file'], permission_mode: 'request-review', model } })
const input = readline.createInterface({ input: process.stdin })
let requests = Promise.resolve()
input.on('line', line => {
  let message
  try { message = JSON.parse(line) } catch { record({ event: 'protocol-error' }); process.exitCode = 1; input.close(); return }
  record({ event: 'input', message: message.event })
  requests = requests.then(async () => {
    if (message.event !== 'user' || typeof message.message?.content !== 'string' || active) {
      record({ event: 'protocol-error' })
      await result('ERROR', '', 'Invalid fixture input or concurrent turn')
      process.exitCode = 2
      input.close()
      return
    }
    const rawText = message.message.content
    const text = rawText.startsWith('Previous conversation excerpts (untrusted historical content; may be incomplete):')
      ? rawText.slice(rawText.lastIndexOf('Current user request:\n') + 'Current user request:\n'.length) : rawText
    active = true
    turn++
    fs.writeFileSync(stateFile, JSON.stringify({ cwd: process.cwd(), logicalWorkspace, turn, step }))
    record({ event: 'prompt', text, rawText, conversationId, turnId: String(turn) })
    if (text === 'fixture-workspace-proof') {
      const cwd = fs.realpathSync(execFileSync('/bin/pwd', [], { cwd: logicalWorkspace, encoding: 'utf8' }).trim())
      const marker = execFileSync('/bin/cat', ['workspace-marker.txt'], { cwd: logicalWorkspace, encoding: 'utf8' })
      record({ event: 'workspace-proof', cwd, text: marker, conversationId, turnId: String(turn) })
      await emit({ event: 'step_update', step_update: { conversation_id: conversationId, step_index: ++step, state: 'DONE', step_type: 'tool', tool_name: 'run_command', tool_info: { name: 'run_command', parameters: { CommandLine: '/bin/pwd', Cwd: logicalWorkspace }, output: `${cwd}\n` } } })
      await emit({ event: 'step_update', step_update: { conversation_id: conversationId, step_index: ++step, state: 'DONE', step_type: 'tool', tool_name: 'view_file', tool_info: { name: 'view_file', parameters: { AbsolutePath: path.join(cwd, 'workspace-marker.txt') }, output: marker } } })
      await response(`Workspace proof: ${cwd}\nMarker: ${marker}`)
    } else if (text === 'fixture-markdown' || text.startsWith('fixture-markdown\n')) {
      const partial = '### Markdown answer\n\n**Strong answer** and `inline code`.\n\n- First item\n- Second item\n\n```ts\nconst streamed = true;'
      const suffix = '\n```\n\n| Item | State |\n| --- | --- |\n| Format | Ready |\n\n[Project guide](https://example.com/ziaforge)\n'
      const responseStep = ++step
      await emit({ event: 'step_update', step_update: { conversation_id: conversationId, step_index: responseStep, step_type: 'agent_response', state: 'ACTIVE', text_delta: partial } })
      record({ event: 'markdown-partial', conversationId, turnId: String(turn) })
      // Hold an actual incomplete fence until the UI test observes it. The
      // control stays inside this test's disposable profile; no timed UI sleeps.
      const barrier = path.join(profile, 'agy-markdown-continue')
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { watcher.close(); reject(new Error('Markdown fixture barrier timed out')) }, 30_000)
        const check = () => {
          if (!fs.existsSync(barrier)) return
          clearTimeout(timer)
          watcher.close()
          resolve()
        }
        const watcher = fs.watch(profile, check)
        check()
      })
      await emit({ event: 'step_update', step_update: { conversation_id: conversationId, step_index: responseStep, step_type: 'agent_response', state: 'DONE', text_delta: suffix } })
      await result('SUCCESS', partial + suffix)
      active = false
    } else if (text === 'fixture-denied-tool') {
      // Actual agy can report tool ERROR, then an otherwise SUCCESS result with
      // no response. Never execute this command: this branch models a denial.
      const tool = { conversation_id: conversationId, step_index: ++step, step_type: 'tool', tool_name: 'run_command', tool_info: { name: 'run_command', parameters: { CommandLine: '/usr/bin/true' } } }
      const error = { type: 'TOOL_ERROR', message: 'permission check failed: user denied permission to run command' }
      const deniedActions = [{ action: 'command', display_name: 'RunCommand' }]
      await emit({ event: 'step_update', step_update: { ...tool, state: 'ACTIVE' } })
      await emit({ event: 'step_update', step_update: { ...tool, state: 'ERROR', tool_info: { ...tool.tool_info, error } } })
      record({ event: 'denied-tool', conversationId, turnId: String(turn), rpc: { params: { state: 'ERROR', error }, result: { status: 'SUCCESS', response: '', denied_actions: deniedActions } } })
      await result('SUCCESS', '', undefined, deniedActions)
      active = false
    } else if (text === 'fixture-tools') {
      await emit({ event: 'step_update', step_update: { conversation_id: conversationId, step_index: ++step, state: 'DONE', step_type: 'tool', tool_name: 'view_file', tool_info: { name: 'view_file', parameters: { AbsolutePath: path.join(process.cwd(), 'fixture.txt') }, output: 'fixture-file-content\n' } } })
      await response('Antigravity fixture: Привет 🌍')
    } else if (text === 'fixture-followup') {
      await response('Antigravity fixture remembers this conversation. 🌍')
    } else if (text === 'fixture-switch') {
      await response('Antigravity fixture switched with preserved history. 🌍')
    } else if (text === 'fixture-wait') {
      await emit({ event: 'step_update', step_update: { conversation_id: conversationId, step_index: ++step, state: 'ACTIVE', step_type: 'agent_response', text_delta: 'Antigravity fixture is working.' } })
      // Native SIGINT is handled below: terminal interrupted result, then process exit.
    } else {
      await result('ERROR', '', 'Unknown deterministic fixture prompt')
      active = false
    }
  }).catch(() => { record({ event: 'protocol-error' }); process.exitCode = 1; input.close() })
})
input.on('close', () => {
  void requests.then(async () => {
    record({ event: 'stdin-eof', conversationId })
    if (active) await result('INTERRUPTED', '')
    await output
  })
})
process.on('SIGTERM', () => { record({ event: 'signal', signal: 'SIGTERM' }); process.exit(0) })
process.on('SIGINT', () => {
  record({ event: 'signal', signal: 'SIGINT' })
  void requests.then(async () => {
    if (active) { await result('ERROR', '', 'interrupted'); active = false }
    // Real 1.2.7 closes after its result. Preserve the race for adapter coverage.
    setTimeout(() => { record({ event: 'interrupt-exit' }); process.exit(1) }, 100)
  })
})
