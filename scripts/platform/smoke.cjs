// Minimal native-platform CI check, separate from fixture/live provider evidence.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { _electron } = require('playwright')
const { bundleInventory } = require('../mac/package-utils.cjs')
const { assertArchitecture } = require('./binary-architecture.cjs')
const [resultFile] = process.argv.slice(2)
if (!resultFile || process.argv.includes('--help')) { console.log('Usage: node scripts/platform/smoke.cjs PACKAGE_RESULT.json\nLaunch on the target OS/architecture only; fresh profile, no provider calls, real window, normal Quit and birth-aware owned cleanup.'); process.exit(resultFile ? 0 : 1) }
const packaged = JSON.parse(fs.readFileSync(resultFile, 'utf8'))
if (packaged.status !== 'passed' || packaged.platform !== process.platform || packaged.arch !== process.arch) throw new Error('Native GUI smoke requires a successful package for this exact OS/architecture')
assertArchitecture(packaged.executable, process.platform, process.arch)
const directory = fs.mkdtempSync(path.join(path.dirname(path.resolve(resultFile)), 'native-gui-'))
const profile = path.join(directory, 'profile'), workspace = path.join(directory, 'workspace')
fs.mkdirSync(profile); fs.mkdirSync(workspace)
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ useMockData: false, globalWorkspacePath: workspace, uiLanguage: 'en', debugLogging: false }))
fs.writeFileSync(path.join(profile, 'presets.json'), '[]')
const env = {}
for (const name of ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'LC_ALL', 'DISPLAY', 'XAUTHORITY', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']) if (process.env[name]) env[name] = process.env[name]
const result = { status: 'running', mode: 'native packaged window; no providers', platform: process.platform, arch: process.arch, rendererErrors: [], fallbackSignals: [], screenshots: [], limits: ['No provider authentication/inference or installed-package upgrade.', 'Linux keyring, desktop integration and installer behavior require the separate installed-container/target-machine checks.'] }
const before = bundleInventory(packaged.app).digest
let app, child, observation, rootBirth, observationError
const owned = new Map()
function processes() {
  if (process.platform === 'win32') {
    const command = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,@{Name="Birth";Expression={$_.CreationDate.ToUniversalTime().ToString("o")}} | ConvertTo-Json -Compress'
    const read = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', timeout: 10000, windowsHide: true })
    if (read.status !== 0) throw new Error('Cannot inspect Windows process birth identities')
    const rows = JSON.parse(read.stdout); return new Map((Array.isArray(rows) ? rows : [rows]).map(r => [r.ProcessId, { pid: r.ProcessId, parent: r.ParentProcessId, birth: r.Birth }]))
  }
  const read = spawnSync('/bin/ps', ['-axo', 'pid=,ppid=,stat=,lstart='], { encoding: 'utf8', timeout: 5000, detached: true })
  if (read.status !== 0) throw new Error('Cannot inspect POSIX process birth identities')
  return new Map(read.stdout.split('\n').flatMap(line => { const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line); return m ? [[+m[1], { pid: +m[1], parent: +m[2], state: m[3], birth: m[4] }]] : [] }))
}
function observe() {
  const table = processes()
  const roots = new Set([...owned].filter(([pid, row]) => table.get(pid)?.birth === row.birth).map(([pid]) => pid))
  if (table.get(child.pid)?.birth === rootBirth) roots.add(child.pid)
  let changed = true
  while (changed) { changed = false; for (const [pid, row] of table) if (roots.has(row.parent) && !roots.has(pid)) { roots.add(pid); owned.set(pid, row); changed = true } }
  return table
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function main() {
  try {
    app = await _electron.launch({ executablePath: packaged.executable, chromiumSandbox: true, args: ['--user-data-dir=' + profile], cwd: workspace, env, timeout: 60000 })
    child = app.process(); rootBirth = processes().get(child.pid)?.birth
    if (!rootBirth) throw new Error('Could not bind packaged process ownership')
    observe(); observation = setInterval(() => { try { observe() } catch (error) { observationError = error.message } }, 2000)
    let page
    const deadline = Date.now() + 45000
    while (Date.now() < deadline) { page = app.windows().find(p => /index\.html/.test(p.url())); if (page) break; await delay(100) }
    if (!page) throw new Error('Application window unavailable')
    page.on('pageerror', error => result.rendererErrors.push(error.message))
    await page.waitForFunction(() => !!window.ziafAPI)
    await page.getByTestId('sidebar-help').waitFor({ state: 'visible', timeout: 30000 })
    const runtime = await app.evaluate(({ app: target, BrowserWindow }) => ({ packaged: target.isPackaged, version: target.getVersion(), appPath: target.getAppPath(), userData: target.getPath('userData'), platform: process.platform, arch: process.arch, sandbox: BrowserWindow.getAllWindows().filter(w => /index\.html/.test(w.webContents.getURL())).map(w => w.webContents.getLastWebPreferences().sandbox) }))
    const identity = JSON.parse(fs.readFileSync(path.join(path.dirname(resultFile), 'build-identity.json')))
    if (!runtime.packaged || !runtime.appPath.endsWith('app.asar') || runtime.version !== identity.version || path.resolve(runtime.userData) !== profile || runtime.arch !== packaged.arch || runtime.sandbox.length !== 1 || runtime.sandbox[0] !== true) throw new Error('Unexpected packaged runtime identity')
    result.runtime = runtime
    const screenshot = path.join(directory, 'desktop.png'); await page.screenshot({ path: screenshot, fullPage: true }); result.screenshots.push(screenshot)
    await page.reload(); await page.waitForFunction(() => !!window.ziafAPI)
    await page.getByTestId('sidebar-help').waitFor({ state: 'visible', timeout: 30000 })
    result.status = 'passed'
  } catch (error) { result.status = 'failed'; result.error = error.stack }
  finally {
    clearInterval(observation)
    let quitTimer
    try {
      if (child && rootBirth) observe()
      if (app) await Promise.race([app.close(), new Promise((_, reject) => { quitTimer = setTimeout(() => reject(new Error('Normal Quit timed out')), 30000) })])
    } catch (error) { result.status = 'failed'; result.quitError = error.stack }
    finally { clearTimeout(quitTimer) }
    try {
      result.exitCode = child?.exitCode; result.exitSignal = child?.signalCode
      if (child && rootBirth) {
        let table = processes()
        const alive = row => table.get(row.pid)?.birth === row.birth && !table.get(row.pid)?.state?.startsWith('Z')
        const candidates = [{ pid: child.pid, birth: rootBirth }, ...owned.values()]
        for (const signal of ['SIGTERM', 'SIGKILL']) {
          for (const row of candidates) if (alive(row)) { try { process.kill(row.pid, signal); result.fallbackSignals.push({ pid: row.pid, signal }) } catch (error) { if (error.code !== 'ESRCH') throw error } }
          await delay(500); table = processes()
        }
        result.survivors = candidates.filter(alive).map(row => row.pid)
      }
    } catch (error) { result.status = 'failed'; result.cleanupError = error.stack }
    result.bundleBefore = before; result.bundleAfter = bundleInventory(packaged.app).digest
    result.observationError = observationError
    if (result.exitCode !== 0 || result.exitSignal || result.fallbackSignals.length || result.survivors?.length || result.rendererErrors.length || observationError || before !== result.bundleAfter) result.status = 'failed'
    result.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  }
  console.log(JSON.stringify({ status: result.status, receipt: path.join(directory, 'result.json') })); process.exitCode = result.status === 'passed' ? 0 : 1
}
main().catch(error => { console.error(error.stack); process.exitCode = 1 })
