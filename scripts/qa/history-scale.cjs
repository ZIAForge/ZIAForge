#!/usr/bin/env node
'use strict'

// Reproducible saved-history Electron fixture. Never builds or invokes a real
// provider. Run against a finished build without concurrent GUI checks or edits.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { fork } = require('node:child_process')
const { performance } = require('node:perf_hooks')
const { project, identity, buildIdentity, createRun } = require('./common.cjs')
const { ownedProcesses } = require('./process-tree.cjs')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const save = (file, value) => { fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); fs.renameSync(file + '.tmp', file) }
const stats = samples => { const values = [...samples].sort((a, b) => a - b); return { count: values.length, p50Ms: values[Math.ceil(values.length * .5) - 1], p95Ms: values[Math.ceil(values.length * .95) - 1], maxMs: values.at(-1) } }
const quote = value => "'" + value.replace(/'/g, "'\"'\"'") + "'"

if (process.argv[2] === '--help') {
  console.log('Usage: npm run qa:scale\nFresh isolated development Electron: 100 saved fixture chats, cold/warm UI switches, full Quit/reopen, CPU/memory and retained-history measurements. No build, real CLI, authentication, API request, Resume or Send.')
} else if (process.argv[2] === '--worker') {
  if (!process.send || !process.argv[3]) throw new Error('Use the supervised harness entrypoint')
  void worker(process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; process.disconnect?.() })
} else {
  if (process.argv.length !== 2) throw new Error('Use --help')
  if (!['darwin', 'linux'].includes(process.platform)) throw new Error('This fixture requires macOS or Linux with a graphical session and /bin/sh')
  if (!fs.existsSync(path.join(project, 'dist/index.html')) || !fs.existsSync(path.join(project, 'dist-electron/main.js'))) throw new Error('Run npm run build:e2e before qa:scale')
  supervise()
}

function supervise() {
  process.umask(0o077)
  const run = createRun('history-scale', 'fixture'), directory = run.directory
  const resultFile = path.join(directory, 'result.json')
  const before = run.manifest.source, compiled = run.manifest.build
  save(resultFile, { schemaVersion: 1, status: 'launching', startedAt: new Date().toISOString(), directory,
    sourceBefore: before, compiledBefore: compiled, environment: run.manifest.environment, helperSha256: hash(fs.readFileSync(__filename)),
    workload: { projects: 50, tasks: 100, tasksPerProject: 2, chatsPerTask: 1, turnsPerChat: 20, messagesPerChat: 40, assistantChunkCount: 8, assistantChunkChars: 512 },
    boundary: ['Synthetic saved histories through the production metadata/journal readers and actual Electron/React UI.', 'Zero active native sessions; not a claim about 100 live CLI processes or model throughput.', 'Cold means fresh backend/session cache with a warm OS filesystem cache, not physical cold disk.', 'Electron process metrics are unforced-GC observations; the automation and process observer add overhead.', 'Journal bytes and UTF-8 JSON snapshot bytes are logical replay payloads, not measured kernel I/O or IPC wire bytes.'],
  })
  console.log(JSON.stringify({ stage: 'launching', evidence: directory }))
  const child = fork(__filename, ['--worker', directory], { cwd: project, detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  child.stdout.pipe(process.stdout, { end: false }); child.stderr.pipe(process.stderr, { end: false })
  let tree, stopReason, forced = false, deadline, observationError, workerError
  const stop = reason => {
    if (stopReason) return
    stopReason = reason
    if (child.connected) child.send({ type: 'stop', reason }, () => {})
    deadline = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) { forced = true; child.kill('SIGKILL') } }, 55000)
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(signal))
  for (const stream of [process.stdout, process.stderr]) stream.on('error', () => stop('output-disconnected'))
  const timeout = setTimeout(() => stop('overall-deadline-12-minutes'), 12 * 60000)
  try { tree = ownedProcesses(child.pid); tree.observe() } catch (error) { observationError = error.message; stop('process-observation-failed') }
  child.on('error', error => { workerError = error.message; stop('worker-error') })
  const observer = setInterval(() => { try { tree?.observe() } catch (error) { observationError = error.message; stop('process-observation-failed') } }, 300)
  child.once('close', async (exitCode, signal) => {
    clearInterval(observer); clearTimeout(timeout); clearTimeout(deadline)
    let result
    try { result = JSON.parse(fs.readFileSync(resultFile, 'utf8')) } catch (error) { result = { status: 'failed', error: error.message } }
    result.supervisor = { exitCode, signal, stopReason, forced, observationError, workerError, cleanup: tree ? await tree.cleanup().catch(error => ({ verified: false, error: error.message })) : { verified: false } }
    result.sourceAfter = identity(); result.compiledAfter = buildIdentity()
    result.sourceChangedDuringRun = !before.workingTreeSha256 || before.workingTreeSha256 !== result.sourceAfter.workingTreeSha256
    result.compiledChangedDuringRun = !compiled.sha256 || compiled.sha256 !== result.compiledAfter.sha256
    if (exitCode !== 0 || signal || stopReason || forced || observationError || workerError || !result.supervisor.cleanup.verified || result.supervisor.cleanup.signals?.length || result.sourceChangedDuringRun || result.compiledChangedDuringRun) result.status = 'failed'
    result.finishedAt = new Date().toISOString(); save(resultFile, result)
    console.log(JSON.stringify({ status: result.status, result: resultFile, sourceChangedDuringRun: result.sourceChangedDuringRun, compiledChangedDuringRun: result.compiledChangedDuringRun }))
    process.exitCode = result.status === 'passed' ? 0 : 1
  })
}

async function worker(directory) {
  process.umask(0o077)
  const { _electron, expect } = require(path.join(project, 'node_modules/@playwright/test'))
  const resultFile = path.join(directory, 'result.json'), result = JSON.parse(fs.readFileSync(resultFile, 'utf8'))
  const persist = () => save(resultFile, result)
  const profile = path.join(directory, 'user-data'), workspace = path.join(directory, 'workspace')
  const bin = path.join(directory, 'bin')
  const tmp = fs.mkdtempSync('/tmp/ziaf-ui-scale-'), blockedFile = path.join(directory, 'blocked-providers.jsonl')
  let active, stopped, stopPromise
  result.phases = []; result.rendererErrors = []; result.samples = []; result.profile = { userData: profile, workspace, temporary: tmp }
  const stop = reason => { stopped ||= reason; if (active && !stopPromise) { stopPromise = quit(active); void stopPromise.catch(() => {}) } }
  process.on('message', message => { if (message?.type === 'stop') stop(message.reason) })
  process.once('disconnect', () => stop('supervisor-disconnected'))
  for (const stream of [process.stdout, process.stderr]) stream.on('error', () => stop('output-disconnected'))
  const check = () => { if (stopped) throw new Error(`History measurement interrupted: ${stopped}`) }
  for (const dir of [profile, workspace, bin]) fs.mkdirSync(dir, { recursive: true })
  for (const name of ['codex', 'claude', 'agy']) fs.writeFileSync(path.join(bin, name), `#!/bin/sh\nprintf '{"provider":"${name}","pid":%d}\\n' "$$" >> ${quote(blockedFile)}\necho 'Native provider disabled in history fixture' >&2\nexit 126\n`, { mode: 0o755 })
  const shell = path.join(bin, 'shell')
  fs.writeFileSync(shell, `#!/bin/sh\nprintf '{"provider":"pty-shell","pid":%d}\\n' "$$" >> ${quote(blockedFile)}\nexit 126\n`, { mode: 0o755 })
  save(path.join(profile, 'settings.json'), { useMockData: false, uiLanguage: 'en', language: 'en', theme: 'dark', globalWorkspacePath: workspace, defaultCodingPreset: 'History fixture', debugLogging: false })
  save(path.join(profile, 'presets.json'), [{ name: 'History fixture', agent: 'Codex', model: 'synthetic-history', permissions: 'Read only' }])
  const repositories = Array.from({ length: result.workload.projects }, (_, index) => {
    const suffix = String(index + 1).padStart(2, '0'), folder = path.join(workspace, `History fixture ${suffix}`)
    fs.mkdirSync(folder)
    return { id: `folder-scale-${suffix}`, name: `History fixture ${suffix}`, kind: 'folder', path: folder, repoPath: folder, canonicalProjectPath: folder, sourcePath: folder }
  })
  save(path.join(profile, 'repositories.json'), repositories)
  const tasks = [], journals = []
  for (let index = 0; index < result.workload.tasks; index++) {
    const suffix = String(index + 1).padStart(3, '0'), taskId = `scale-task-${suffix}`, chatId = 'chat-main', runId = `run-scale-${suffix}`
    const repo = repositories[Math.floor(index / result.workload.tasksPerProject)], folder = repo.path
    const sessionId = 'session-' + hash(JSON.stringify([taskId, chatId])).slice(0, 40)
    const cwd = path.join(folder, 'worktrees', taskId), run = path.join(profile, 'agent-sessions/artifacts/worktrees', taskId, 'runs', runId)
    fs.mkdirSync(cwd, { recursive: true }); fs.mkdirSync(run, { recursive: true })
    tasks.push({ id: taskId, repoId: repo.id, name: `Scale task ${suffix}`, mode: 'work', model: 'History fixture', agentProvider: 'codex', status: 'running', logs: [], feed: [], todoSteps: [], gitChanges: [], workflow: 'Draft & Document', branchType: 'Folder', branchName: taskId, worktreePath: cwd })
    save(path.join(run, 'session.json'), { version: 1, provider: 'codex', taskId, chatId, sessionId, runId, presetName: 'History fixture', model: 'synthetic-history', createdAt: 1700000000000 + index,
      launch: { provider: 'codex', presetName: 'History fixture', model: 'synthetic-history', approvalPolicy: 'on-request', sandbox: 'read-only' } })
    const events = []; let sequence = 0
    const event = fields => events.push({ eventId: `${runId}-event-${++sequence}`, timestamp: 1700000000000 + sequence, taskId, runId, ...fields })
    for (let turn = 1; turn <= result.workload.turnsPerChat; turn++) {
      const turnId = `turn-${turn}`, clientMessageId = `input-${turn}`, userId = `user-${clientMessageId}`, messageId = `answer-${turn}`
      event({ type: 'message.started', messageId: userId, role: 'user', clientMessageId })
      event({ type: 'message.delta', messageId: userId, deltaType: 'text', content: `Synthetic input ${taskId}/${turn}`, clientMessageId })
      event({ type: 'message.completed', messageId: userId, finishReason: 'stop', clientMessageId })
      event({ type: 'agent.status.changed', status: 'running', scope: 'turn', turnId, clientMessageId })
      event({ type: 'message.started', messageId, role: 'assistant', turnId })
      for (let chunk = 0; chunk < result.workload.assistantChunkCount; chunk++) event({ type: 'message.delta', messageId, turnId, deltaType: 'text', content: `${taskId}/${turn}/${chunk}: ` + 'fixture '.repeat(64).slice(0, result.workload.assistantChunkChars) + '\n' })
      event({ type: 'message.delta', messageId, turnId, deltaType: 'text', content: `SCALE-END ${taskId} turn ${turn}` })
      event({ type: 'message.completed', messageId, turnId, finishReason: 'stop' })
      event({ type: 'agent.status.changed', status: 'completed', scope: 'turn', turnId, clientMessageId })
    }
    event({ type: 'agent.status.changed', status: 'stopped', scope: 'session' })
    const bytes = events.map(item => JSON.stringify(item)).join('\n') + '\n', filename = path.join(run, 'events.ndjson')
    fs.writeFileSync(filename, bytes, { mode: 0o600 }); journals.push({ taskId, runId, filename, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) })
  }
  for (const repo of repositories) save(path.join(repo.path, 'tasks.json'), tasks.filter(task => task.repoId === repo.id))
  result.journals = journals; result.logicalJournalBytes = journals.reduce((sum, item) => sum + item.bytes, 0); persist()
  const nativeEnvironment = Object.fromEntries(['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_CTYPE'].flatMap(name => process.env[name] === undefined ? [] : [[name, process.env[name]]]))
  const env = { ...nativeEnvironment, PATH: bin + ':/usr/bin:/bin', SHELL: shell, TMPDIR: tmp, ZIAFORGE_E2E: '1', ZIAFORGE_E2E_USER_DATA: profile }
  async function launch(label) {
    check()
    const start = performance.now()
    const app = await _electron.launch({ args: [path.join(project, 'e2e/bootstrap.cjs'), `--user-data-dir=${profile}`], cwd: project, env, timeout: 30000 })
    const handle = app.process(), phase = { label, pid: handle.pid, status: 'running' }
    result.phases.push(phase)
    const instance = { app, handle, phase, tree: ownedProcesses(handle.pid) }; active = instance
    instance.tree.observe(); instance.observer = setInterval(() => { try { instance.tree.observe() } catch (error) { phase.observationError = error.message; stop('process-observation-failed') } }, 300)
    const onPage = page => page.on('pageerror', error => result.rendererErrors.push({ phase: label, message: error.message }))
    app.windows().forEach(onPage); app.on('window', onPage)
    await expect.poll(() => Boolean(app.windows().find(page => !page.isClosed() && page.url().endsWith('/index.html'))), { timeout: 30000 }).toBe(true)
    instance.window = app.windows().find(page => !page.isClosed() && page.url().endsWith('/index.html'))
    instance.window.setDefaultTimeout(15000)
    await expect(instance.window.getByRole('button', { name: 'Scale task 001', exact: true })).toBeVisible({ timeout: 30000 })
    phase.readyMs = performance.now() - start
    expect(await instance.window.evaluate(() => window.ziafAPI.getTasks().then(items => items.length))).toBe(100)
    expect(await instance.window.evaluate(() => window.ziafAPI.getRepositories().then(items => items.length))).toBe(50)
    return instance
  }
  async function metrics(instance, label) {
    const processes = await instance.app.evaluate(({ app }) => app.getAppMetrics())
    result.samples.push({ label, at: new Date().toISOString(), processes })
    persist()
  }
  async function visit(instance, task, pass) {
    check()
    const window = instance.window, start = performance.now()
    await window.getByRole('button', { name: task.name, exact: true }).click()
    const chat = window.getByTestId('structured-codex-chat'), rows = chat.getByTestId('conversation-feed').locator('[data-testid^="assistant-message-"]')
    await expect(rows).toHaveCount(20)
    await expect(rows.last()).toContainText(`SCALE-END ${task.id} turn 20`)
    await window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))))
    const latencyMs = performance.now() - start
    const snapshot = await window.evaluate(async taskId => {
      const current = await window.ziafAPI.agentSessions.attach({ taskId, chatId: 'chat-main' })
      return current && { taskId: current.taskId, sessionId: current.sessionId, runId: current.runId, sessionStatus: current.sessionStatus, pid: current.pid, count: current.feed.length,
        bytes: new TextEncoder().encode(JSON.stringify(current)).length, lastText: current.feed.at(-1)?.text.slice(-120) }
    }, task.id)
    expect(snapshot).toMatchObject({ taskId: task.id, sessionStatus: 'disconnected', count: 40 })
    expect(snapshot.pid).toBeUndefined()
    expect(snapshot.lastText).toContain(`SCALE-END ${task.id} turn 20`)
    const rendered = await chat.getByTestId('conversation-feed').evaluate(feed => {
      const rows = [...feed.querySelectorAll('[data-testid^="user-message-"], [data-testid^="assistant-message-"]')]
      const visible = rows.filter(row => { const box = row.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth })
      return { matchingMessageIds: rows.map(row => row.getAttribute('data-testid')), domMessageCount: rows.length, viewportIntersectingMessageCount: visible.length, viewportIntersectingMessageIds: visible.map(row => row.getAttribute('data-testid')) }
    })
    expect(rendered.domMessageCount).toBe(40)
    return { pass, taskId: task.id, latencyMs, logicalSnapshotBytes: snapshot.bytes, rendered }
  }
  async function quit(instance) {
    if (instance.quitting) return instance.quitting
    instance.quitting = (async () => {
      const deadline = setTimeout(() => { instance.phase.forced = true; instance.handle.kill('SIGKILL') }, 20000)
      try { await instance.app.close() } catch (error) { instance.phase.quitError = error.message } finally { clearTimeout(deadline); clearInterval(instance.observer) }
      instance.phase.cleanup = await instance.tree.cleanup()
      instance.phase.exitCode = instance.handle.exitCode; instance.phase.signal = instance.handle.signalCode
      instance.phase.status = instance.phase.exitCode === 0 && !instance.phase.signal && !instance.phase.forced && !instance.phase.quitError && !instance.phase.observationError && instance.phase.cleanup.verified && !instance.phase.cleanup.signals.length ? 'passed' : 'failed'
      if (active === instance) active = undefined
      persist(); expect(instance.phase.status).toBe('passed')
    })()
    return instance.quitting
  }
  try {
    let instance = await launch('initial')
    await metrics(instance, 'before-cold-visits')
    result.visits = []
    for (const pass of ['cold-session-cache', 'warm-session-cache']) {
      const ordered = pass === 'cold-session-cache' ? tasks : [...tasks.slice(0, -1).reverse(), tasks.at(-1)]
      for (const [index, task] of ordered.entries()) {
        result.visits.push(await visit(instance, task, pass))
        if ((index + 1) % 10 === 0) await metrics(instance, `${pass}-${index + 1}`)
      }
      result[pass] = stats(result.visits.filter(item => item.pass === pass).map(item => item.latencyMs))
      await instance.window.screenshot({ path: path.join(directory, `${pass}.png`), fullPage: true })
    }
    await metrics(instance, 'after-200-visits'); await quit(instance)
    instance = await launch('full-restart')
    for (const index of [0, 49, 99]) result.visits.push(await visit(instance, tasks[index], 'full-restart'))
    await metrics(instance, 'after-full-restart-three-visits')
    await instance.window.screenshot({ path: path.join(directory, 'full-restart.png'), fullPage: true })
    await quit(instance)
    result.journalsUnchanged = journals.every(item => hash(fs.readFileSync(item.filename)) === item.sha256)
    result.blockedProviderLaunches = fs.existsSync(blockedFile) ? fs.readFileSync(blockedFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
    // A catalog may probe a refusal stub while the initial form is visible;
    // retain that count rather than mislabel it as native inference or a session.
    expect(result.blockedProviderLaunches.filter(item => item.provider === 'pty-shell')).toEqual([])
    result.realProviderInvocations = 0
    expect(result.journalsUnchanged).toBe(true); expect(result.rendererErrors).toEqual([])
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'; result.error = error.message
    if (active?.window && !active.window.isClosed()) await active.window.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true }).catch(() => {})
  } finally {
    if (stopPromise) await stopPromise.catch(error => { result.cleanupError = error.message })
    if (active) await quit(active).catch(error => { result.cleanupError = error.message })
    if (stopped || result.cleanupError || result.phases.length !== 2 || result.phases.some(phase => phase.status !== 'passed')) result.status = 'failed'
    result.stopReason = stopped; result.finishedAt = new Date().toISOString(); persist()
    if (result.phases.length && result.phases.every(phase => phase.cleanup?.verified)) fs.rmSync(tmp, { recursive: true, force: true })
    process.exitCode = result.status === 'passed' ? 0 : 1
    console.log(JSON.stringify({ status: result.status, evidence: directory, error: result.error }))
    if (process.connected) process.disconnect()
  }
}
