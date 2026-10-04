// Isolated app state + known-provider command stubs, NOT an OS/network sandbox.
const fs = require('node:fs')
const path = require('node:path')
const { project, identity, writeJson } = require('./common.cjs')
const { ownedProcesses } = require('./process-tree.cjs')
const { fixtureEnvironment } = require('./fixture-environment.cjs')

if (!process.send || process.argv.length !== 3) throw new Error('Run qa:inspect; the worker requires its supervisor IPC channel.')
// A vanished supervisor must not prevent cleanup through a broken output pipe.
for (const stream of [process.stdout, process.stderr]) stream.on('error', () => {})
const directory = process.argv[2]
const run = { directory, manifest: JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')) }
const userData = path.join(run.directory, 'user-data')
const workspace = path.join(run.directory, 'workspace')
const temporary = path.join(run.directory, 'tmp')
const bin = path.join(run.directory, 'bin')
for (const directory of [userData, workspace, temporary, bin]) fs.mkdirSync(directory, { recursive: true })
const quote = value => "'" + value.replace(/'/g, "'\"'\"'") + "'"
for (const name of ['codex', 'claude', 'agy']) {
  fs.writeFileSync(path.join(bin, name), '#!/bin/sh\necho "Provider disabled in QA inspection profile (fixture only)." >&2\nexit 126\n', { mode: 0o755 })
}
const shell = path.join(bin, 'shell')
// Production may prepend global executable directories; reset again at PTY entry.
fs.writeFileSync(shell, '#!/bin/sh\nexport PATH=' + quote(bin + ':/usr/bin:/bin') + '\nexec /bin/bash --noprofile --norc -i\n', { mode: 0o755 })
writeJson(path.join(userData, 'settings.json'), {
  theme: 'dark', language: 'en', uiLanguage: 'en', useMockData: false,
  debugLogging: false, globalWorkspacePath: workspace,
})
const result = {
  schemaVersion: 1, mode: 'fixture', status: 'launching', startedAt: new Date().toISOString(),
  supervisor: { pid: process.ppid, workerPid: process.pid },
  manifest: 'manifest.json', userData, workspace, providerCommands: 'blocked by name: codex, claude, agy',
  boundary: 'Separate application state and minimal environment; no OS/network sandbox. Absolute commands and file access are not restricted.',
  liveProviders: 'unverified: inspection uses no real LLM',
}
const save = () => writeJson(path.join(run.directory, 'result.json'), result)
const log = fs.createWriteStream(path.join(run.directory, 'electron.log'))
let app
let stopping = false
let requestedStop = false
let stopReason
let readyForStop = false
let finalizing = false
let stopPromise
let cdpTimer
let processTimer
let descendants
let captured = false
save()

async function bounded(promise, milliseconds, label) {
  let timer
  try {
    return await Promise.race([promise, new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}

async function capture() {
  if (!app || captured) return
  captured = true
  const window = app.windows().find(candidate => !candidate.isClosed())
  result.capture = { status: window ? 'attempted' : 'unavailable: app already closed' }
  if (!window) return
  await window.screenshot({ path: path.join(run.directory, 'window.png'), fullPage: true, timeout: 5000 }).catch(error => { result.capture.screenshotError = error.message })
  const snapshot = await window.locator('body').ariaSnapshot({ timeout: 5000 }).catch(() => null)
  if (snapshot) fs.writeFileSync(path.join(run.directory, 'accessibility.yaml'), snapshot)
  await bounded(app.context().tracing.stop({ path: path.join(run.directory, 'trace.zip') }), 5000, 'Trace capture').catch(error => { result.capture.traceError = error.message })
}

async function performStop(reason) {
  if (!app || stopping) return
  stopping = true
  clearInterval(cdpTimer)
  try { descendants?.observe() } catch (error) { result.processObservationError = error.message }
  result.stopReason = reason
  await capture().catch(error => { result.capture = { status: 'failed', error: error.message } })
  // ElectronApplication.close uses app.quit so normal application cleanup runs.
  const processHandle = app.process()
  const terminate = setTimeout(() => {
    if (processHandle.exitCode === null && processHandle.signalCode === null) {
      result.forcedQuit = 'SIGTERM'; processHandle.kill('SIGTERM')
    }
  }, 10_000)
  const kill = setTimeout(() => {
    if (processHandle.exitCode === null && processHandle.signalCode === null) {
      result.forcedQuit = 'SIGKILL'; processHandle.kill('SIGKILL')
    }
  }, 12_000)
  try { await bounded(app.close(), 14_000, 'Electron Quit') } catch (error) { result.cleanupError = error.message }
  finally { clearTimeout(terminate); clearTimeout(kill) }
}
function stop(reason) {
  return stopPromise ||= performStop(reason)
}
function requestStop(reason) {
  if (finalizing) return
  requestedStop = true
  stopReason ||= reason
  if (readyForStop) void stop(stopReason)
}
process.on('message', message => {
  if (message?.type === 'stop') requestStop(message.reason || 'supervisor-request')
})
process.on('disconnect', () => {
  if (!finalizing) {
    result.supervisor.disconnected = true
    requestStop('supervisor-disconnected')
  }
})

async function main() {
  const { _electron } = require('@playwright/test')
  app = await _electron.launch({
    args: [path.join(project, 'e2e/bootstrap.cjs'), `--user-data-dir=${userData}`,
      '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'],
    cwd: project, timeout: 30_000,
    env: fixtureEnvironment({
      PATH: bin + ':/usr/bin:/bin', SHELL: shell, LANG: 'en_US.UTF-8', TMPDIR: temporary,
      HISTFILE: path.join(run.directory, 'shell-history'),
      ...(process.env.DISPLAY ? { DISPLAY: process.env.DISPLAY } : {}),
      ...(process.env.WAYLAND_DISPLAY ? { WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY } : {}),
      ...(process.env.XDG_RUNTIME_DIR ? { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR } : {}),
      ZIAFORGE_E2E: '1', ZIAFORGE_E2E_USER_DATA: userData,
    }),
  })
  const processHandle = app.process()
  result.pid = processHandle.pid
  descendants = ownedProcesses(processHandle.pid)
  descendants.observe()
  processTimer = setInterval(() => {
    try { descendants.observe() } catch (error) { result.processObservationError = error.message }
  }, 500)
  processHandle.stdout?.pipe(log, { end: false })
  processHandle.stderr?.pipe(log, { end: false })
  result.homeInherited = await app.evaluate((_, expectedHome) => process.env.HOME === expectedHome, process.env.HOME)
  if (!result.homeInherited) throw new Error('Inspection application did not inherit the standard HOME')
  const exited = new Promise(resolve => {
    if (processHandle.exitCode !== null || processHandle.signalCode !== null) resolve()
    else processHandle.once('exit', resolve)
  })
  if (requestedStop) {
    readyForStop = true
    await stop(stopReason)
  } else {
    await app.context().tracing.start({ screenshots: true, snapshots: true })
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    let visible = false
    for (let attempt = 0; attempt < 50; attempt++) {
      visible = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(candidate => candidate.isVisible()))
      if (visible) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!visible) throw new Error('Native window did not become visible within 5 seconds')
    result.status = 'running'
    result.windowBounds = await app.evaluate(({ BrowserWindow, screen }) => {
      const window = BrowserWindow.getAllWindows().find(candidate => candidate.isVisible())
      return { bounds: window?.getBounds(), workArea: window ? screen.getDisplayMatching(window.getBounds()).workArea : null }
    })
    await window.screenshot({ path: path.join(run.directory, 'startup.png'), fullPage: true })
    save()
    console.log(JSON.stringify({ pid: result.pid, mode: result.mode, userData, workspace, note: 'Ctrl+C or explicit Quit to stop; window close hides the macOS app.' }))
    let probes = 0
    cdpTimer = setInterval(() => {
      const filename = path.join(userData, 'DevToolsActivePort')
      if (fs.existsSync(filename)) {
        const port = Number(fs.readFileSync(filename, 'utf8').split('\n')[0])
        if (Number.isInteger(port) && port > 0 && port < 65536) {
          result.cdp = { address: '127.0.0.1', port }; save()
          console.log(JSON.stringify({ cdp: result.cdp })); clearInterval(cdpTimer)
        }
      } else if (++probes >= 120) {
        result.cdp = { status: 'unavailable', reason: 'DevToolsActivePort not found' }; save(); clearInterval(cdpTimer)
      }
    }, 250)
    readyForStop = true
    if (requestedStop) await stop(stopReason)
  }
  await exited
  // The process exit can race the final capture/close promise.
  if (stopPromise) await stopPromise
  finalizing = true
  clearInterval(cdpTimer)
  clearInterval(processTimer)
  result.cleanup = await descendants.cleanup()
  result.stopReason ||= 'explicit-quit'
  result.capture ||= { status: 'unavailable: app already closed' }
  result.status = 'closed'
  result.exitCode = processHandle.exitCode
  result.exitSignal = processHandle.signalCode
  if (processHandle.exitCode !== 0 || !result.cleanup.verified || result.processObservationError || result.cleanupError) {
    result.status = 'failed'; process.exitCode = 1
  }
  result.finishedAt = new Date().toISOString()
  result.sourceAtFinish = identity()
  result.sourceChangedDuringRun = result.sourceAtFinish.workingTreeSha256 !== run.manifest.source.workingTreeSha256
  save()
  await new Promise(resolve => log.end(resolve))
  if (process.connected) process.disconnect()
}

main().catch(async error => {
  finalizing = true
  result.status = 'failed'; result.error = error.message; result.finishedAt = new Date().toISOString()
  await stop('error')
  clearInterval(cdpTimer)
  clearInterval(processTimer)
  if (descendants) result.cleanup = await descendants.cleanup().catch(caught => { result.cleanupError = caught.message })
  save(); log.end(); console.error(error.message); process.exitCode = 1
  if (process.connected) process.disconnect()
})
