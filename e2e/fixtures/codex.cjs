// Deterministic stdio app-server fixture. No provider, authentication or model calls.
// Payloads follow `codex app-server generate-json-schema` from codex-cli 0.153.4.
const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const { createHash } = require('node:crypto')
const workFlowReply = require('./work-flow-reply.cjs')
const forgeFlowReply = require('./forge-flow-reply.cjs')

const transcript = process.env.ZIAFORGE_E2E_TRANSCRIPT
const controls = process.env.ZIAFORGE_E2E_CODEX_CONTROLS
if (process.env.ZIAFORGE_E2E !== '1' || !transcript || !controls || !path.isAbsolute(transcript) || !path.isAbsolute(controls)) {
  process.stderr.write('Codex fixture requires an isolated E2E profile.\n')
  process.exit(78)
}
const record = entry => fs.appendFileSync(transcript, JSON.stringify({ pid: process.pid, time: Date.now(), ...entry }) + '\n')
const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--version') {
  record({ event: 'version-probe' })
  process.stdout.write('codex-cli 0.153.4\n')
  process.exit(0)
}
if (JSON.stringify(args) !== JSON.stringify(['app-server', '--listen', 'stdio://'])) {
  record({ event: 'invalid-launch', args })
  process.stderr.write('Expected codex app-server --listen stdio://, not a terminal/TUI invocation.\n')
  process.exit(78)
}
let catalogOnly = false
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {
  record({ event: 'signal', signal })
  process.exit(0)
})
process.stdout.on('error', () => process.exit(0))
process.stdin.on('end', () => { record({ event: catalogOnly ? 'model-discovery-exit' : 'stdin-end' }); process.exit(0) })

let initialized = false
let ready = false
let threadId
let activeTurn
let turnCount = 0
const stateFile = () => path.join(controls, `${threadId}.json`)
let rpcQueue = Promise.resolve()
const pendingApprovals = new Map()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
function emit(message) {
  record({ event: 'rpc-out', rpc: message })
  process.stdout.write(JSON.stringify(message) + '\n')
}
const reply = (id, result) => emit({ id, result })
const notify = (method, params) => emit({ method, params: {
  ...params,
  ...(method === 'item/started' ? { startedAtMs: Date.now() } : {}),
  ...(method === 'item/completed' ? { completedAtMs: Date.now() } : {}),
} })
const turn = (id, status) => ({ id, items: [], status, error: null })
const context = turnId => ({ threadId, turnId })
function item(turnId, suffix, text) {
  return { id: `${turnId}-${suffix}`, type: 'agentMessage', text }
}
async function barrier(name) {
  record({ event: 'barrier-waiting', barrier: name })
  const filename = path.join(controls, name)
  const started = Date.now()
  while (!fs.existsSync(filename)) {
    if (Date.now() - started > 45_000) throw new Error(`Fixture barrier timed out: ${name}`)
    await delay(20)
  }
  record({ event: 'barrier-released', barrier: name })
}
function complete(turnId, status = 'completed') {
  if (activeTurn !== turnId) throw new Error('Fixture cannot complete a stale turn')
  notify('turn/completed', { threadId, turn: turn(turnId, status) })
  activeTurn = undefined
}
async function streamText(turnId, text) {
  const message = item(turnId, 'answer', '')
  notify('item/started', { ...context(turnId), item: message })
  // Split a Unicode JSON record across stdout writes as a real pipe can do.
  const delta = { method: 'item/agentMessage/delta', params: { ...context(turnId), itemId: message.id, delta: text } }
  record({ event: 'rpc-out', rpc: delta })
  const bytes = Buffer.from(JSON.stringify(delta) + '\n')
  const unicodeIndex = bytes.indexOf(Buffer.from('🌍'))
  const split = unicodeIndex >= 0 ? unicodeIndex + 1 : Math.floor(bytes.length / 2)
  process.stdout.write(bytes.subarray(0, split))
  await delay(25)
  process.stdout.write(bytes.subarray(split))
  notify('item/completed', { ...context(turnId), item: { ...message, text } })
}
function command(turnId, status, output = null) {
  return {
    type: 'commandExecution', id: `${turnId}-command`, command: 'printf fixture-tool-output',
    commandActions: [], cwd: process.cwd(), status,
    aggregatedOutput: output, exitCode: status === 'completed' ? 0 : null,
  }
}
function codeArtifact(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const references = [...text.matchAll(new RegExp(`Artifact ${escaped}, version (\\d+), SHA256 ([a-f0-9]{64})\\nFile: ([^\\n]+)`, 'g'))]
  const reference = references.sort((left, right) => Number(right[1]) - Number(left[1]))[0]
  if (!reference) throw new Error(`Missing immutable fixture artifact reference: ${name}`)
  const filename = reference[3]
  const profile = fs.realpathSync(path.dirname(controls))
  const canonical = fs.realpathSync(filename)
  if (!canonical.startsWith(profile + path.sep) || path.basename(canonical) !== name || fs.lstatSync(filename).isSymbolicLink()) throw new Error('Fixture artifact is outside its own isolated profile')
  const bytes = fs.readFileSync(canonical)
  if (bytes.length > 256000 || createHash('sha256').update(bytes).digest('hex') !== reference[2]) throw new Error('Fixture artifact receipt does not match actual bytes')
  return bytes.toString('utf8')
}
async function codeFlowReply(text) {
  const forge = await forgeFlowReply(text, { record, barrier, codeArtifact })
  if (forge !== undefined) return forge
  const preparation = text.startsWith('You are carrying out one preparation phase of a ZIAForge Code task.')
  const multi = text.match(/^ZIAForge Multi-model (exploration|design|synthesis|review-worker|review-coordinator), worker (\d+), review\/fix cycle (\d+)\./)
  const match = text.match(/(?:Task: |Original task:\n)Code flow fixture (auto|fix-bug|spec-first|requirements-first|multi-model)\n/)
  // Existing form/chat regressions now start an actual one-phase Code answer.
  // The ordinary chat is still idle; its later fixture-hello is a separate send.
  if (preparation && /Original request:\nfixture-hello\n/.test(text)) {
    record({ event: 'code-flow-preparation', text: 'ordinary-chat-bootstrap', cwd: process.cwd(), threadId })
    return '```ziaforge-phase\n' + JSON.stringify({ status: 'ready', summary: 'Fixture request answered without implementation.', intent: 'answer', complexity: 'trivial', questions: [], artifacts: [{ name: 'answer.md', content: '# Fixture answer\nNo implementation was requested by this fixture marker.\n' }], steps: [] }) + '\n```'
  }
  if (!match) return undefined
  const kind = match[1]
  const key = createHash('sha256').update(process.cwd()).digest('hex')
  const filename = path.join(controls, `code-flow-${key}.json`)
  const state = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : { implementations: 0, reviews: 0 }
  const source = path.join(process.cwd(), 'identifier.cjs')
  const sourceHash = () => createHash('sha256').update(fs.readFileSync(source)).digest('hex')
  const persist = () => fs.writeFileSync(filename, JSON.stringify(state))
  const check = { executable: process.execPath, args: ['check-identifier.cjs'], timeoutMs: 15000 }
  const proposed = {
    title: 'Code fixture identifier validation', instructions: `Code flow fixture ${kind}: implement reusable identifier validation in identifier.cjs. Preserve the real regression check.`,
    acceptance: ['valid_id is accepted and a value containing spaces is rejected', 'The actual Node verification succeeds'], verification: [check],
    ...(kind === 'fix-bug' ? { red: check } : {}),
  }
  if (multi) {
    if (kind !== 'multi-model') throw new Error('Multi worker ran outside its selected workflow')
    const [, stage, rawIndex, rawCycle] = multi
    const index = Number(rawIndex), cycle = Number(rawCycle)
    if (stage === 'exploration') await barrier('code-flow-preparation')
    const common = { event: 'code-flow-multi-stage', stage, index, cycle, provider: kind, cwd: process.cwd(), threadId, sourceSha256: sourceHash() }
    if (stage === 'exploration' || stage === 'design') {
      if (stage === 'design' && (![1, 2].every(worker => codeArtifact(text, `exploration_${worker}.md`).includes(`# Code fixture exploration_${worker}.md`)))) throw new Error('Designer did not receive both completed exploration documents')
      const name = `${stage === 'exploration' ? 'exploration' : 'plan_draft'}_${index}.md`
      record(common)
      return '```ziaforge-stage\n' + JSON.stringify({ summary: `Fixture ${stage} ${index} inspected identifier.cjs:2 and its immutable regression.`, artifacts: [{ name, content: `# Code fixture ${name}\n\nSource SHA-256: ${sourceHash()}\nEvidence: identifier.cjs:2 returns true unconditionally; check-identifier.cjs exercises malformed and non-string inputs.\nApproach ${index}: keep a reusable CommonJS predicate and the existing regression command.\n` }] }) + '\n```'
    }
    if (stage === 'synthesis') {
      if (![1, 2, 3].every(worker => codeArtifact(text, `plan_draft_${worker}.md`).includes(`# Code fixture plan_draft_${worker}.md`))) throw new Error('Synthesis did not receive all completed design alternatives')
      record(common)
      return '```ziaforge-phase\n' + JSON.stringify({ status: 'ready', summary: 'Synthesized three design alternatives using the two exploration reports.', preamble: 'Implement the accepted identifier contract and retain real verification.', questions: [], artifacts: [{ name: 'final_plan.md', content: '# Code fixture final_plan.md\n\n## Context\nidentifier.cjs:2 returns true for every input.\n\n## Changes\nImplement one reusable predicate in identifier.cjs, including type rejection and ASCII identifier rules. Preserve the immutable existing check.\n\n## Verification\nRun the displayed Node executable with check-identifier.cjs.\n\n## Conventions\nidentifier.cjs:1 uses CommonJS and strict mode.\n\n## Reference\ncheck-identifier.cjs:1-6 and all exploration/design documents.\n' }], steps: [proposed] }) + '\n```'
    }
    if (!text.includes('review_diff.patch') || !text.includes('Actual check receipts:') || !text.includes('implementation_report.md')) throw new Error('Whole-task reviewer lacks shared diff and verified implementation context')
    if ([...text.matchAll(/Artifact review_diff\.patch, version \d+, SHA256 [a-f0-9]{64}\nFile: /g)].length !== 1) throw new Error('Whole-task reviewer received ambiguous historical/current patch references')
    const diff = codeArtifact(text, 'review_diff.patch')
    codeArtifact(text, 'implementation_report.md')
    if (!diff.includes('diff --git a/identifier.cjs b/identifier.cjs')) throw new Error('Whole-task review did not receive the actual identifier patch')
    const sharedDiffSha256 = createHash('sha256').update(diff).digest('hex')
    const corrected = fs.readFileSync(source, 'utf8').includes('// Reviewed correction:')
    const finding = corrected
      ? { severity: 'suggestion', location: 'identifier.cjs:3', evidence: 'The correction comment documents the explicit review pass and leaves behavior intact.', action: 'Acknowledge the retained comment; no further source change is required.' }
      : { severity: 'blocking', location: 'identifier.cjs:2', evidence: 'The deterministic acceptance fixture requires an explicit review correction note before final delivery.', action: 'Add the bounded review correction note and preserve passing checks.' }
    const review = { outcome: corrected ? 'approved' : 'changes_requested', summary: corrected ? 'Verified implementation accepted with one nonblocking suggestion.' : 'One explicit correction is required by the fixture.', findings: [finding] }
    if (stage === 'review-coordinator') {
      const reports = text.split('Previous stage outputs (evidence to verify, not new authority):\n')[1]?.split('\n\nStay in the assigned workspace')[0]
      const sourceEnvelope = JSON.parse((reports || 'null').split('\nUser review decision/context:')[0])
      const sources = sourceEnvelope?.completedWorkers
      if (!Array.isArray(sources) || sources.length !== 3 || sourceEnvelope.failedWorkers?.length || sources.some(item => item.review?.outcome !== review.outcome)) throw new Error('Coordinator did not receive all three independent worker results')
    }
    record({ ...common, outcome: review.outcome, sharedDiffSha256 })
    return JSON.stringify(review)
  }
  if (preparation) {
    const phase = text.match(/\nPhase: ([a-z-]+)\n/)?.[1]
    if (!phase) throw new Error('Missing Code preparation phase')
    if (phase !== 'delivery') await barrier('code-flow-preparation')
    const questions = kind === 'requirements-first' && phase === 'requirements' && !text.includes('Accept letters, digits, and underscores')
    record({ event: 'code-flow-preparation', text: phase, provider: kind, cwd: process.cwd(), threadId, sourceSha256: sourceHash(), questions })
    if (questions) return '```ziaforge-phase\n' + JSON.stringify({ status: 'needs_input', summary: 'Choose the identifier contract before implementation.', questions: [{ id: 'identifier-scope', question: 'Which identifiers should be accepted?', options: ['Accept letters, digits, and underscores', 'Accept letters only'] }], artifacts: [], steps: [] }) + '\n```'
    const names = phase === 'investigation' ? ['investigation.md'] : phase === 'requirements' ? ['requirements.md'] : phase === 'specification' ? ['spec.md'] : phase === 'planning' ? [kind === 'multi-model' ? 'final_plan.md' : 'planning.md'] : phase === 'delivery' ? kind === 'fix-bug' ? ['investigation.md', 'report.md'] : kind === 'multi-model' ? ['implementation_report.md'] : ['report.md'] : ['planning.md']
    const producesPlan = phase === 'discovery' || phase === 'investigation' || phase === 'planning' || phase === 'specification' && kind === 'spec-first'
    if (phase === 'specification' && kind === 'requirements-first' && !text.includes('# Code fixture requirements.md')) throw new Error('Requirements artifact was not passed into the fresh specification context')
    if (phase === 'planning' && kind === 'requirements-first' && !text.includes('# Code fixture spec.md')) throw new Error('Specification artifact was not passed into fresh planning context')
    if (phase === 'delivery' && !text.includes('Actual completed implementation receipts:')) throw new Error('Delivery did not receive actual verification evidence')
    return '```ziaforge-phase\n' + JSON.stringify({ status: 'ready', summary: `Prepared ${phase} from real fixture repository evidence.`, preamble: 'Reusable identifier validation; preserve the existing Node check.', complexity: 'medium', ...(phase === 'discovery' ? { intent: 'implement' } : {}), questions: [], artifacts: names.map(name => ({ name, content: `# Code fixture ${name}\n\nFlow: ${kind}\nPhase: ${phase}\nSource SHA-256: ${sourceHash()}\n\nUse a reusable identifier validator and verify it with the existing Node check.\n` })), steps: producesPlan ? [proposed] : [] }) + '\n```'
  }
  if (text.startsWith('Implement only the failing test')) {
    if (!fs.readFileSync(path.join(process.cwd(), 'check-identifier.cjs'), 'utf8').includes('assert.equal')) throw new Error('Missing actual failing regression check')
    record({ event: 'code-flow-red', provider: kind, cwd: process.cwd(), threadId, sourceSha256: sourceHash() })
    return 'The existing Node regression exposes the defect. Source remains unchanged before the Red check.'
  }
  if (text.startsWith('Implement this one plan step') || text.startsWith('Carry out the one user-authorized corrective attempt') || text.startsWith('Execute this approved ZIAForge Code implementation')) {
    const fixing = text.startsWith('Carry out the one user-authorized corrective attempt') || text.startsWith('Execute this approved ZIAForge Code implementation correction cycle ')
    state.implementations += 1
    fs.writeFileSync(source, "'use strict'\nmodule.exports = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)\n" + (fixing ? '// Reviewed correction: reject non-string inputs explicitly.\n' : ''))
    if (fixing) state.corrected = true
    persist()
    record({ event: fixing ? 'code-flow-fixer' : 'code-flow-implementation', provider: kind, cwd: process.cwd(), threadId, sourceSha256: sourceHash() })
    return `Implemented identifier.cjs for Code flow fixture ${kind}. The application must run the actual Node check and review. 🌍`
  }
  if (text.startsWith('Independently review only this plan step')) {
    state.reviews += 1; persist()
    const blocking = kind === 'multi-model' && !state.corrected
    record({ event: 'code-flow-review', provider: kind, cwd: process.cwd(), threadId, sourceSha256: sourceHash(), outcome: blocking ? 'changes_requested' : 'approved' })
    return JSON.stringify({ outcome: blocking ? 'changes_requested' : 'approved', summary: blocking ? 'The fixture requires one explicit correction before delivery.' : 'Independent fixture review accepts the verified implementation.', findings: blocking ? [{ severity: 'blocking', location: 'identifier.cjs:2', evidence: 'The initial fixture implementation lacks the required review note.', action: 'Make one explicit correction and preserve passing checks.' }] : [] })
  }
  return undefined
}
function workflowReply(text) {
  const role = text.startsWith('Implement this one plan step') ? 'coder' : text.startsWith('Independently review only this plan step') ? 'reviewer' : undefined
  if (!role) return undefined
  if (text.includes('Fixture Work document')) {
    const title = text.match(/\nStep: ([^\n]+)\n/)?.[1]
    const files = { Prepare: 'outline.md', 'Create artifact': 'document.md', 'Review and deliver': 'handoff.md' }
    const filename = files[title]
    if (!filename) throw new Error('Unsupported deterministic Work template step')
    const content = `# ${title}\nfixture work evidence\n`
    record({ event: role === 'coder' ? 'work-implementation' : 'work-review', text: title, cwd: process.cwd(), threadId })
    if (role === 'coder') {
      fs.writeFileSync(path.join(process.cwd(), filename), content)
      return `Created ${filename} in the Work folder. 🌍`
    }
    const approved = fs.readFileSync(path.join(process.cwd(), filename), 'utf8') === content
    return JSON.stringify({ outcome: approved ? 'approved' : 'changes_requested', summary: `Independent Work artifact review: ${filename}`, findings: approved ? [] : [{ severity: 'blocking', location: filename, evidence: 'Expected artifact content is missing.', action: 'Create the requested artifact.' }] })
  }
  const match = text.match(/\nStep: Fixture step ([123])\n/)
  if (!match) throw new Error('Unsupported deterministic workflow step')
  const step = Number(match[1])
  const workspaceKey = createHash('sha256').update(process.cwd()).digest('hex')
  const filename = path.join(controls, `workflow-${workspaceKey}.json`)
  const state = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {}
  const key = String(step)
  if (role === 'coder') {
    state[key] = (state[key] || 0) + 1
    fs.writeFileSync(filename, JSON.stringify(state))
    fs.writeFileSync(path.join(process.cwd(), `fixture-step-${step}.txt`), step === 1 && state[key] === 1 ? 'not ready\n' : 'ready\n')
    record({ event: 'workflow-implementation', step, attempt: state[key], threadId })
    // A false natural-language success must not bypass the real command failure.
    return `Fixture step ${step}: all tests passed according to the agent. Attempt ${state[key]}.`
  }
  record({ event: 'workflow-review', step, attempt: state[key], threadId })
  const ready = fs.readFileSync(path.join(process.cwd(), `fixture-step-${step}.txt`), 'utf8') === 'ready\n'
  const approved = ready && (step !== 1 || state[key] >= 3)
  return JSON.stringify({ outcome: approved ? 'approved' : 'changes_requested', summary: approved ? `Independent fixture review accepted step ${step}.` : 'The fixture requires one more correction.', findings: approved ? [] : [{ severity: 'blocking', location: `fixture-step-${step}.txt:1`, evidence: 'Second implementation intentionally lacks the final fixture correction.', action: 'Perform a third implementation attempt.' }] })
}
async function handle(message) {
  const { id, method, params = {}, result } = message
  if (!method && id !== undefined) {
    const approval = pendingApprovals.get(id)
    if (!approval || !['accept', 'decline'].includes(result?.decision)) throw new Error('Unexpected approval response')
    pendingApprovals.delete(id)
    record({ event: 'approval-response', approvalId: id, decision: result.decision, turnId: approval.turnId })
    if (result.decision === 'accept') {
      const tool = command(approval.turnId, 'completed', 'fixture-tool-output\n')
      notify('item/commandExecution/outputDelta', { ...context(approval.turnId), itemId: tool.id, delta: 'fixture-tool-output\n' })
      notify('item/completed', { ...context(approval.turnId), item: tool })
      await streamText(approval.turnId, 'Codex fixture approved: Привет 🌍')
    } else {
      notify('item/completed', { ...context(approval.turnId), item: command(approval.turnId, 'declined') })
      await streamText(approval.turnId, 'Codex fixture denied safely.')
    }
    complete(approval.turnId)
    return
  }
  if (method === 'initialize') {
    if (initialized || !params.clientInfo?.name) throw new Error('Invalid initialize handshake')
    initialized = true
    catalogOnly = params.clientInfo.name === 'ziaforge_catalog'
    record({ event: catalogOnly ? 'model-discovery-start' : 'app-server-start', args, cwd: process.cwd(), fixture: 'codex-0.153.4-stdio' })
    reply(id, {
      userAgent: 'codex-fixture/0.153.4', platformFamily: 'unix',
      platformOs: process.platform === 'darwin' ? 'macos' : 'linux',
      codexHome: path.dirname(transcript), // Protocol metadata only; no environment override.
    })
    return
  }
  if (method === 'initialized') {
    if (!initialized || id !== undefined) throw new Error('Invalid initialized notification')
    ready = true
    return
  }
  if (method === 'model/list') {
    if (!ready || params.includeHidden !== true) throw new Error('Invalid model discovery request')
    record({ event: 'catalog-request', cursor: params.cursor || null, catalogOnly })
    const efforts = values => values.map(reasoningEffort => ({ reasoningEffort, description: `Fixture ${reasoningEffort}` }))
    reply(id, params.cursor ? { data: [{
      model: 'codex-fixture-next', displayName: 'Next fixture model', hidden: true,
      supportedReasoningEfforts: efforts(['low', 'high', 'xhigh']), defaultReasoningEffort: 'high',
    }, {
      model: 'gpt-fixture-next', displayName: 'Manual fixture alias',
      supportedReasoningEfforts: efforts(['low', 'high', 'xhigh']), defaultReasoningEffort: 'high',
    }], nextCursor: null } : { data: [{
      model: 'codex-fixture', displayName: 'Codex fixture',
      supportedReasoningEfforts: efforts(['none', 'low', 'medium', 'high']), defaultReasoningEffort: 'medium',
    }, {
      model: 'gpt-fixture', displayName: 'Default fixture alias',
      supportedReasoningEfforts: efforts(['none', 'low', 'medium', 'high']), defaultReasoningEffort: 'medium',
    }], nextCursor: 'fixture-page-2' })
    return
  }
  if (catalogOnly) throw new Error('Model discovery must never start a thread or turn')
  if (method === 'thread/start' || method === 'thread/resume') {
    if (!ready || threadId || params.cwd !== process.cwd()) throw new Error('Invalid thread initialization or cwd')
    if (method === 'thread/resume') {
      if (!/^fixture-thread-\d+$/.test(params.threadId)) throw new Error('Invalid native resume identity')
      threadId = params.threadId
      const saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
      if (saved.cwd !== process.cwd()) throw new Error('Native resume changed workspace')
      turnCount = saved.turnCount
    } else {
      threadId = `fixture-thread-${process.pid}`
      fs.writeFileSync(stateFile(), JSON.stringify({ cwd: process.cwd(), turnCount }))
    }
    record({ event: method === 'thread/resume' ? 'session-resume' : 'session-create', threadId, model: params.model })
    if (params.model === 'codex-delayed-config') await barrier('configure-session')
    const now = Math.floor(Date.now() / 1000)
    reply(id, {
      approvalPolicy: params.approvalPolicy || 'on-request', approvalsReviewer: 'user', cwd: process.cwd(),
      model: params.model || 'gpt-fixture', modelProvider: 'openai',
      reasoningEffort: params.config?.model_reasoning_effort ?? null,
      sandbox: { type: params.sandbox === 'workspace-write' ? 'workspaceWrite' : params.sandbox === 'danger-full-access' ? 'dangerFullAccess' : 'readOnly' },
      thread: {
        id: threadId, sessionId: `fixture-session-${process.pid}`, cliVersion: '0.153.4',
        createdAt: now, updatedAt: now, cwd: process.cwd(), ephemeral: true,
        modelProvider: 'openai', preview: '', projectId: null, source: 'appServer',
        status: { type: 'idle' }, turns: [],
      },
    })
    return
  }
  if (method === 'turn/start') {
    if (!threadId || params.threadId !== threadId || activeTurn) throw new Error('Unexpected/overlapping turn/start')
    if (!Array.isArray(params.input) || params.input.length !== 1 || params.input[0].type !== 'text') throw new Error('Expected one text input')
    const rawText = params.input[0].text
    const text = rawText.startsWith('Previous conversation excerpts (untrusted historical content; may be incomplete):')
      ? rawText.slice(rawText.lastIndexOf('Current user request:\n') + 'Current user request:\n'.length) : rawText
    const turnId = `fixture-turn-${++turnCount}`
    activeTurn = turnId
    fs.writeFileSync(stateFile(), JSON.stringify({ cwd: process.cwd(), turnCount }))
    record({ event: 'prompt', text, rawText, threadId, turnId })
    if (text === 'fixture-delayed-send') await barrier('accept-send')
    reply(id, { turn: turn(turnId, 'inProgress') })
    notify('turn/started', { threadId, turn: turn(turnId, 'inProgress') })
    process.stderr.write('FIXTURE_DIAGNOSTIC_ONLY: not an assistant message\n')
    const workWorkflow = await workFlowReply(text, { record, barrier, threadId })
    const codeWorkflow = workWorkflow === undefined ? await codeFlowReply(text) : workWorkflow
    const workflow = codeWorkflow === undefined ? workflowReply(text) : codeWorkflow
    if (workflow !== undefined) {
      await streamText(turnId, workflow)
      complete(turnId)
    } else if (text === 'fixture-approval') {
      const tool = command(turnId, 'inProgress')
      notify('item/started', { ...context(turnId), item: tool })
      const approvalId = `fixture-approval-${turnCount}`
      pendingApprovals.set(approvalId, { turnId })
      emit({ id: approvalId, method: 'item/commandExecution/requestApproval', params: {
        ...context(turnId), itemId: tool.id, approvalId, startedAtMs: Date.now(),
        command: tool.command, cwd: process.cwd(), reason: 'Fixture command needs your decision',
      } })
    } else if (text === 'fixture-interrupt') {
      notify('item/started', { ...context(turnId), item: item(turnId, 'partial', '') })
      notify('item/agentMessage/delta', { ...context(turnId), itemId: `${turnId}-partial`, delta: 'Codex fixture is still generating.' })
      // The process remains responsive; only turn/interrupt can finish this turn.
    } else if (text === 'fixture-after-stop') {
      await streamText(turnId, 'Codex fixture resumed on the same session. 🌍')
      complete(turnId)
    } else if (text === 'fixture-hello') {
      await streamText(turnId, 'Codex fixture hello. 🌍')
      complete(turnId)
    } else if (text === 'fixture-delayed-send') {
      await streamText(turnId, 'Codex fixture accepted the delayed send. 🌍')
      complete(turnId)
    } else if (text === 'fixture-switch') {
      await streamText(turnId, 'Codex fixture switched with preserved history. 🌍')
      complete(turnId)
    } else throw new Error(`Unsupported fixture prompt: ${text}`)
    return
  }
  if (method === 'turn/interrupt') {
    if (params.threadId !== threadId || params.turnId !== activeTurn) throw new Error('Wrong interrupt target')
    const turnId = activeTurn
    reply(id, {})
    record({ event: 'interrupt-ack', threadId, turnId })
    await barrier('finish-interrupt')
    complete(turnId, 'interrupted')
    return
  }
  throw new Error(`Unexpected fixture RPC method: ${method}`)
}

readline.createInterface({ input: process.stdin }).on('line', line => {
  let message
  try { message = JSON.parse(line) }
  catch {
    record({ event: 'protocol-error', error: 'Non-JSON stdin: terminal path used instead of app-server' })
    process.exit(1)
  }
  record({ event: 'rpc-in', rpc: message })
  // Serial wire requests make accidental overlap observable, not silently ignored.
  rpcQueue = rpcQueue.then(() => handle(message)).catch(error => {
    record({ event: 'protocol-error', error: error.message })
    process.stderr.write(error.message + '\n')
    process.exit(1)
  })
})
