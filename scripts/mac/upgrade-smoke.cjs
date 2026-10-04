// Supervise the GUI worker so Playwright cannot consume terminal signals before
// normal Quit, process ownership checks and the upgrade receipt are persisted.
const fs = require('node:fs')
const path = require('node:path')
const { fork } = require('node:child_process')
const { project, createRun, identity, writeJson } = require('../qa/common.cjs')
const { ownedProcesses } = require('../qa/process-tree.cjs')
const { bundleInventory } = require('./package-utils.cjs')

const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node scripts/mac/upgrade-smoke.cjs /absolute/previous/ZIAForge.app /absolute/new/ZIAForge.app\nCreates a fresh fixture profile through the old app UI, Quits, then opens that same profile in the new app. Checks task/chat/native resume and partial executable-plan receipts, continues the plan and Quits. No builds, package reservation, user profiles, credentials or inference. Both bundles must remain unchanged.')
  process.exit(0)
}
if (process.platform !== 'darwin' || args.length !== 2 || args.some(item => !path.isAbsolute(item) || !item.endsWith('.app'))) throw new Error('Expected two absolute macOS .app paths. Use --help.')
const bundles = args.map(item => fs.realpathSync(item))
if (bundles[0] === bundles[1]) throw new Error('An upgrade requires two distinct app bundles')
const embedded = bundles.map(bundle => JSON.parse(fs.readFileSync(path.join(bundle, 'Contents/Resources/build-identity.json'), 'utf8')))
const version = value => /^\d+\.\d+\.\d+$/.test(value) ? value.split('.').map(Number) : null
const previous = version(embedded[0].version), next = version(embedded[1].version)
if (!previous || !next || next.reduce((result, part, index) => result || Math.sign(part - previous[index]), 0) !== 1) throw new Error('The new embedded semantic version must be greater than the previous version')
const before = bundles.map(bundle => bundleInventory(bundle).digest)
const run = createRun('packaged-upgrade', 'fixture')
const resultFile = path.join(run.directory, 'result.json')
writeJson(resultFile, { schemaVersion: 1, mode: 'fixture', status: 'launching', startedAt: new Date().toISOString(), bundles, embedded, bundleBefore: before,
  providerExecution: 'Local deterministic Codex stdio fixture; no authentication or inference.',
  boundary: 'Fresh shared upgrade userData and disposable Git project. Provider stubs and isolated shell startup; not an OS/network sandbox.' })
console.log('Packaged upgrade evidence: ' + run.directory)
const worker = fork(path.join(__dirname, 'upgrade-worker.cjs'), [run.directory, ...bundles], { cwd: project, detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
worker.stdout.pipe(process.stdout, { end: false }); worker.stderr.pipe(process.stderr, { end: false })
let stopReason, deadline, forced, error, observingError
const requestStop = reason => {
  if (stopReason) return
  stopReason = reason
  if (worker.connected) worker.send({ type: 'stop', reason }, () => {})
  deadline = setTimeout(() => { if (worker.exitCode === null && worker.signalCode === null) { forced = true; worker.kill('SIGKILL') } }, 55_000)
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => requestStop(signal))
for (const stream of [process.stdout, process.stderr]) stream.on('error', () => requestStop('terminal-disconnected'))
let descendants
try { descendants = ownedProcesses(worker.pid); descendants.observe() } catch (caught) { observingError = caught.message; requestStop('process-observation-failed') }
const observe = setInterval(() => { try { descendants?.observe() } catch (caught) { observingError = caught.message; requestStop('process-observation-failed') } }, 250)
worker.on('error', caught => { error = caught.message })
worker.on('close', async (code, signal) => {
  clearTimeout(deadline); clearInterval(observe)
  let result
  try { result = JSON.parse(fs.readFileSync(resultFile, 'utf8')) } catch { result = { schemaVersion: 1, mode: 'fixture', status: 'failed' } }
  result.supervisor = { workerPid: worker.pid, exitCode: code, signal, stopReason, forced, error, observingError }
  try { result.supervisor.cleanup = descendants ? await descendants.cleanup() : { verified: false } } catch (caught) { result.supervisor.cleanup = { verified: false, error: caught.message } }
  try { result.bundleAfter = bundles.map(bundle => bundleInventory(bundle).digest) } catch (caught) { result.error = caught.message }
  result.bundleChanged = before.some((digest, index) => digest !== result.bundleAfter?.[index])
  result.sourceAtFinish = identity()
  result.sourceChangedDuringRun = !run.manifest.source.workingTreeSha256 || run.manifest.source.workingTreeSha256 !== result.sourceAtFinish.workingTreeSha256
  if (code !== 0 || signal || stopReason || forced || error || observingError || result.bundleChanged || result.sourceChangedDuringRun || !result.supervisor.cleanup.verified || result.supervisor.cleanup.signals?.length) result.status = 'failed'
  result.finishedAt = new Date().toISOString(); writeJson(resultFile, result)
  console.log(JSON.stringify({ status: result.status, evidence: run.directory, bundleChanged: result.bundleChanged, sourceChangedDuringRun: result.sourceChangedDuringRun }))
  process.exitCode = result.status === 'passed' ? 0 : 1
})
