// Keep terminal signals out of Playwright's process-wide signal handlers.
// Isolated app state + provider stubs, NOT an OS/network sandbox.
const fs = require('node:fs')
const path = require('node:path')
const { fork } = require('node:child_process')
const { project, createRun, identity, writeJson } = require('./common.cjs')
const { ownedProcesses } = require('./process-tree.cjs')

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('Usage: npm run qa:inspect\nRequires npm run build:e2e. Opens Electron with fresh userData/workspace, provider stubs and a random loopback CDP port.\nCtrl+C or explicit application Quit stops the inspector; macOS window close only hides the window.\nDoes not call LLM providers. This is not an OS or network sandbox; do not enter sensitive data.')
  process.exit(0)
}
if (args.length || !['darwin', 'linux'].includes(process.platform)) {
  console.error(args.length ? 'Unknown option. Use --help.' : 'The inspector currently supports macOS/Linux with /bin/bash.')
  process.exit(2)
}
for (const filename of ['dist/index.html', 'dist-electron/main.js', 'dist-electron/preload.mjs']) {
  if (!fs.existsSync(path.join(project, filename))) {
    console.error(`Missing ${filename}. Run npm run build:e2e first.`)
    process.exit(1)
  }
}

const run = createRun('inspect', 'fixture')
const resultFile = path.join(run.directory, 'result.json')
writeJson(resultFile, {
  schemaVersion: 1, mode: 'fixture', status: 'launching', manifest: 'manifest.json',
  startedAt: new Date().toISOString(), supervisorPid: process.pid,
})
console.log(`QA artifacts: ${run.directory}`)
let worker
let descendants
let observationError
let deadline
let forcedSignal
let stopReason
let workerError
let finalizing = false
function requestStop(reason) {
  if (stopReason || finalizing) return
  stopReason = reason
  if (worker?.connected) worker.send({ type: 'stop', reason }, () => {})
  // Startup is bounded to 30s, final capture/quit have their own bounds.
  // Escalation targets this worker only; tracked descendants are cleaned below.
  deadline = setTimeout(() => {
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      forcedSignal = 'SIGKILL'
      worker.kill('SIGKILL')
    }
  }, 55_000)
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => requestStop(signal))
for (const stream of [process.stdout, process.stderr]) stream.on('error', () => requestStop('terminal-disconnected'))

async function main() {
  worker = fork(path.join(__dirname, 'inspect-worker.cjs'), [run.directory], {
    cwd: project, detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  worker.stdout.pipe(process.stdout, { end: false })
  worker.stderr.pipe(process.stderr, { end: false })
  const exited = new Promise(resolve => {
    worker.once('error', error => { workerError = error.message })
    worker.once('close', (code, signal) => resolve({ code, signal }))
  })
  try {
    descendants = ownedProcesses(worker.pid)
    descendants.observe()
  } catch (error) { observationError = error.message; requestStop('process-observation-failed') }
  const observation = setInterval(() => {
    try { descendants?.observe() }
    catch (error) { observationError = error.message; requestStop('process-observation-failed') }
  }, 250)
  // Stop may have arrived immediately before the worker was created.
  if (stopReason && worker.connected) worker.send({ type: 'stop', reason: stopReason }, () => {})
  const exit = await exited
  finalizing = true
  clearTimeout(deadline)
  clearInterval(observation)
  let receipt
  try { receipt = JSON.parse(fs.readFileSync(resultFile, 'utf8')) }
  catch { receipt = { schemaVersion: 1, mode: 'fixture', manifest: 'manifest.json' } }
  receipt.supervisor = { pid: process.pid, workerPid: worker.pid, workerExitCode: exit.code, workerExitSignal: exit.signal }
  if (stopReason) receipt.supervisor.stopReason = stopReason
  if (forcedSignal) receipt.supervisor.forcedSignal = forcedSignal
  if (workerError) receipt.supervisor.error = workerError
  if (observationError) receipt.supervisor.observationError = observationError
  try { receipt.supervisor.cleanup = descendants ? await descendants.cleanup() : { verified: false, aliveCount: null } }
  catch (error) { receipt.supervisor.cleanup = { verified: false, aliveCount: null, error: error.message } }
  if (exit.code !== 0 || receipt.status !== 'closed' || !receipt.supervisor.cleanup.verified || observationError) {
    receipt.status = 'failed'
    receipt.error ||= 'Inspector worker or supervised cleanup did not finish successfully.'
  }
  receipt.sourceAtFinish = identity()
  receipt.sourceChangedDuringRun = receipt.sourceAtFinish.workingTreeSha256 !== run.manifest.source.workingTreeSha256
  receipt.finishedAt = new Date().toISOString()
  writeJson(resultFile, receipt)
  console.log(JSON.stringify({ status: receipt.status, result: resultFile, cleanupVerified: receipt.supervisor.cleanup.verified }))
  process.exitCode = receipt.status === 'closed' ? 0 : 1
}

main().catch(error => {
  console.error(error.message)
  requestStop('supervisor-error')
  process.exitCode = 1
})
