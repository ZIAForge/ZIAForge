const { spawn } = require('node:child_process')

// Electron.launch hard-codes Playwright's SIGINT handler, which exits its host
// before our finally can save the receipt. Own terminal signals in a separate
// supervisor and use ordinary Node IPC plus the public ElectronApplication.close.
// The detached worker also avoids receiving the terminal's Ctrl+C directly.
function supervise() {
  const worker = spawn(process.execPath, [__filename, ...process.argv.slice(2)], {
    env: { ...process.env, ZIAFORGE_PACKAGE_SMOKE_WORKER: '1' },
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })
  const stop = signal => {
    if (worker.connected) worker.send({ type: 'stop', signal }, error => {
      if (error && worker.exitCode === null && worker.signalCode === null) console.error(`Cannot forward smoke stop: ${error.message}`)
    })
  }
  const onInterrupt = () => stop('SIGINT')
  const onTerminate = () => stop('SIGTERM')
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)
  worker.once('error', error => { console.error(error); process.exitCode = 1 })
  worker.once('close', (code, signal) => {
    process.removeListener('SIGINT', onInterrupt)
    process.removeListener('SIGTERM', onTerminate)
    process.exitCode = code ?? (signal ? 1 : 0)
  })
  console.log(`Packaged smoke supervisor PID: ${process.pid}`)
}

if (process.env.ZIAFORGE_PACKAGE_SMOKE_WORKER === '1' && process.send) runWorker()
else supervise()

function runWorker() {
  const fs = require('node:fs')
  const path = require('node:path')
  const { _electron } = require('@playwright/test')
  const { createRun, writeJson } = require('../qa/common.cjs')
  const { ownedProcesses } = require('../qa/process-tree.cjs')
  const { fixtureEnvironment } = require('../qa/fixture-environment.cjs')
  const { bundleInventory } = require('./package-utils.cjs')

  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: npm run qa:package -- /absolute/path/ZIAForge.app [--hold] [--read-control]\nLaunch the actual packaged app visibly with fresh userData/workspace. No provider request.\nRecord identity, native geometry, screenshot, renderer errors, Quit and descendant cleanup.\n--read-control enables a read-only loopback control server in this disposable profile and writes its token to a private local file.\n--hold keeps it open for agent-browser via a random loopback CDP port; Ctrl+C ends it.')
    process.exit(0)
  }
  const appPath = args.find(arg => !arg.startsWith('--'))
  if (!appPath || !path.isAbsolute(appPath) || !appPath.endsWith('.app') || args.filter(arg => arg !== appPath && arg !== '--hold' && arg !== '--read-control').length) throw new Error('Expected one absolute .app path and optional --hold / --read-control')
  const bundle = fs.realpathSync(appPath)
  const embedded = JSON.parse(fs.readFileSync(path.join(bundle, 'Contents/Resources/build-identity.json'), 'utf8'))
  const before = bundleInventory(bundle).digest
  const run = createRun('packaged-smoke', 'fixture')
  const userData = path.join(run.directory, 'user-data')
  const workspace = path.join(run.directory, 'workspace')
  const shellConfig = path.join(run.directory, 'shell-config')
  const bin = path.join(run.directory, 'bin')
  for (const directory of [userData, workspace, shellConfig, bin]) fs.mkdirSync(directory)
  for (const name of ['codex', 'claude', 'agy']) fs.writeFileSync(path.join(bin, name), '#!/bin/sh\necho "Provider disabled in packaged smoke" >&2\nexit 126\n', { mode: 0o755 })
  const quote = value => "'" + value.replace(/'/g, "'\"'\"'") + "'"
  // Keep the normal HOME unchanged. Isolate zsh login configuration so production
  // environment discovery cannot replace our provider stubs with real CLIs.
  fs.writeFileSync(path.join(shellConfig, '.zprofile'), 'export PATH=' + quote(bin + ':/usr/bin:/bin') + '\n')
  const shell = path.join(bin, 'shell')
  fs.writeFileSync(shell, '#!/bin/sh\nexport PATH=' + quote(bin + ':/usr/bin:/bin') + '\nexec /bin/bash --noprofile --norc -i\n', { mode: 0o755 })
  writeJson(path.join(userData, 'settings.json'), { theme: 'dark', language: 'en', uiLanguage: 'en', useMockData: false,
    debugLogging: false, globalWorkspacePath: workspace, soundAlerts: false, desktopNotifications: false })
  writeJson(path.join(userData, 'repositories.json'), [])
  const result = { schemaVersion: 1, status: 'launching', app: bundle, embeddedIdentity: embedded,
    supervisorPid: process.ppid, workerPid: process.pid,
    beforeBundleSha256: before, userData, workspace,
    mode: 'packaged-smoke', providerExecution: 'none', rendererErrors: [],
    boundary: 'Separate app state and shell configuration, no provider prompts; this is not an OS/network sandbox.' }
  const save = () => writeJson(path.join(run.directory, 'result.json'), result)
  let app
  let processHandle
  let descendants
  let observation
  let requestedStop = false
  let releaseHold
  const stopped = new Promise(resolve => { releaseHold = resolve })
  const requestStop = reason => {
    requestedStop = true
    result.stopRequests ??= []
    result.stopRequests.push({ reason, at: new Date().toISOString() })
    save()
    releaseHold()
  }
  const supervisorDisconnected = () => requestStop('supervisor-disconnected')
  process.on('message', message => {
    if (message?.type === 'stop' && ['SIGINT', 'SIGTERM'].includes(message.signal)) requestStop(message.signal)
  })
  process.once('disconnect', supervisorDisconnected)
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

  async function main() {
    console.log(`Packaged smoke evidence: ${run.directory}`)
    save()
    try {
      app = await _electron.launch({ executablePath: path.join(bundle, 'Contents/MacOS/ZIAForge'),
        args: [`--user-data-dir=${userData}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'],
        timeout: 30000, env: fixtureEnvironment({ PATH: bin + ':/usr/bin:/bin', SHELL: shell, ZDOTDIR: shellConfig, LANG: 'en_US.UTF-8', TMPDIR: run.directory }) })
      const observeWindow = page => page.on('pageerror', error => result.rendererErrors.push(error.message))
      app.windows().forEach(observeWindow)
      app.on('window', observeWindow)
      processHandle = app.process()
      result.pid = processHandle.pid
      const log = fs.createWriteStream(path.join(run.directory, 'electron.log'))
      processHandle.stdout?.pipe(log, { end: false }); processHandle.stderr?.pipe(log, { end: false })
      processHandle.once('close', () => { log.end(); releaseHold() })
      descendants = ownedProcesses(result.pid)
      descendants.observe()
      observation = setInterval(() => { try { descendants.observe() } catch (error) { result.observationError = error.message } }, 300)
      result.runtime = await app.evaluate(({ app }, expectedHome) => ({ packaged: app.isPackaged, appPath: app.getAppPath(), userData: app.getPath('userData'), version: app.getVersion(), homeInherited: process.env.HOME === expectedHome }), process.env.HOME)
      if (!result.runtime.packaged || !result.runtime.homeInherited || fs.realpathSync(result.runtime.userData) !== fs.realpathSync(userData) || !result.runtime.appPath.startsWith(bundle + path.sep)) throw new Error('Packaged identity/profile isolation or inherited HOME failed')
      let window
      for (let attempt = 0; attempt < 150; attempt++) {
        window = app.windows().find(page => page.url().endsWith('/index.html'))
        const shown = window && await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(win => win.isVisible() && win.webContents.getURL().endsWith('/index.html')))
        if (shown) break
        window = undefined
        await delay(100)
      }
      if (!window) throw new Error('Packaged main window did not become visible')
      await window.waitForLoadState('domcontentloaded')
      await window.locator('body').waitFor({ state: 'visible' })
      result.geometry = await app.evaluate(({ BrowserWindow, screen }) => {
        const win = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().endsWith('/index.html'))
        return { bounds: win.getBounds(), workArea: screen.getDisplayMatching(win.getBounds()).workArea, visible: win.isVisible(), fullscreen: win.isFullScreen() }
      })
      if (!result.geometry.visible || result.geometry.fullscreen) throw new Error('Unexpected packaged window visibility/fullscreen')
      if (['x', 'y', 'width', 'height'].some(key => Math.abs(result.geometry.bounds[key] - result.geometry.workArea[key]) > 2)) throw new Error('Packaged window does not fill the desktop work area')
      await window.screenshot({ path: path.join(run.directory, 'startup.png'), fullPage: true })
      fs.writeFileSync(path.join(run.directory, 'accessibility.yaml'), await window.locator('body').ariaSnapshot())
      const portFile = path.join(userData, 'DevToolsActivePort')
      if (fs.existsSync(portFile)) result.cdp = { address: '127.0.0.1', port: Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) }
      if (args.includes('--read-control')) {
        const net = require('node:net')
        const server = net.createServer()
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
        const controlPort = server.address().port
        await new Promise(resolve => server.close(resolve))
        const configured = await window.evaluate(port => window.ziafAPI.control.configure({ enabled: true, host: '127.0.0.1', port, scope: 'read', nativeComputer: false, assistantPreset: '', assistantOperate: false, telegramEnabled: false, telegramOwner: '', instances: [] }), controlPort)
        if (!configured.running || configured.error || !configured.accessToken) throw new Error('Disposable read-only control setup failed')
        const privateDirectory = fs.realpathSync(fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ziaf-control-check-')))
        fs.chmodSync(privateDirectory, 0o700)
        const credentialFile = path.join(privateDirectory, 'access.json')
        fs.writeFileSync(credentialFile, JSON.stringify({ endpoint: configured.endpoint, accessToken: configured.accessToken }), { mode: 0o600 })
        result.readControl = { endpoint: configured.endpoint, scope: 'read', credentialFile }
      }
      result.status = 'running'; save()
      console.log(JSON.stringify({ app: bundle, pid: result.pid, cdp: result.cdp, evidence: run.directory, hold: args.includes('--hold') }))
      if (args.includes('--hold') && !requestedStop) await stopped
      if (!window.isClosed()) await window.screenshot({ path: path.join(run.directory, 'final.png'), fullPage: true })
    } catch (error) { result.error = error.message }
    finally {
      // External application Quit disposes Playwright's Electron object before
      // this continuation; retain the OS handle captured while it was alive.
      if (app && processHandle && processHandle.exitCode === null && processHandle.signalCode === null) {
        const timer = setTimeout(() => { result.forcedQuit = true; processHandle.kill('SIGKILL') }, 15000)
        try { await app.close() } catch (error) { result.quitError = error.message }
        finally { clearTimeout(timer) }
      }
      clearInterval(observation)
      if (result.readControl?.credentialFile) { fs.rmSync(result.readControl.credentialFile, { force: true }); result.readControl.privateCredentialRemoved = true }
      if (descendants) result.cleanup = await descendants.cleanup().catch(error => ({ verified: false, error: error.message }))
      result.exitCode = processHandle?.exitCode
      result.exitSignal = processHandle?.signalCode
      result.productionQuitVerified = Boolean(result.exitCode === 0 && result.cleanup?.verified && result.cleanup.signals?.length === 0)
      result.afterBundleSha256 = bundleInventory(bundle).digest
      result.bundleChanged = before !== result.afterBundleSha256
      result.status = !result.error && !result.quitError && !result.forcedQuit && !result.observationError && !result.bundleChanged &&
        !result.rendererErrors.length && result.productionQuitVerified ? 'passed' : 'failed'
      result.finishedAt = new Date().toISOString(); save()
      console.log(JSON.stringify({ status: result.status, result: path.join(run.directory, 'result.json'), bundleChanged: result.bundleChanged, cleanup: result.cleanup }))
      process.exitCode = result.status === 'passed' ? 0 : 1
    }
  }
  main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => {
    process.removeListener('disconnect', supervisorDisconnected)
    if (process.connected) process.disconnect()
  })
}
