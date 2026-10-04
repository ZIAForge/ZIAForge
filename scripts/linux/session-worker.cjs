// Owns one installed Ubuntu desktop instance. Fixture-only; no subscription calls.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { _electron } = require('/build/source/node_modules/playwright')
const { ownedProcesses } = require('/build/source/scripts/qa/process-tree.cjs')
const { bundleInventory } = require('/build/source/scripts/mac/package-utils.cjs')
const { startPrivateKeyring } = require('./keyring.cjs')
const role = process.argv[2]
if (!['a', 'b'].includes(role) || process.getuid() === 0) throw new Error('Nonroot role a or b required')
const root = '/evidence', profile = root + '/profile', workspace = root + '/workspace'
const binary = '/opt/ZIAForge/ziaforge', appRoot = path.dirname(binary)
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn, label, timeout = 30000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { const value = await fn(); if (value) return value; await delay(100) } throw new Error('Timed out: ' + label) }
let app, page, owned, proc, task, snapshot, config, keyring, stopping = false
let rendererErrors = [], launches = [], shutdowns = []
const desktops = []
const before = bundleInventory(appRoot).digest
const sandboxHelper = fs.statSync(path.join(appRoot, 'chrome-sandbox'))
assert.equal(sandboxHelper.uid, 0, 'Installed sandbox helper must be root-owned')
assert.equal(sandboxHelper.mode & 0o7777, 0o755, 'The user-namespace container must use the 0755 sandbox helper')
const packagedInventory = JSON.parse(fs.readFileSync('/build/package/app-inventory.json', 'utf8')).digest
assert.equal(before, packagedInventory, 'Installed app must match the original packaged file inventory')
const result = { status: 'running', role, sandboxHelper: { path: path.join(appRoot, 'chrome-sandbox'), uid: sandboxHelper.uid, mode: (sandboxHelper.mode & 0o7777).toString(8), reason: 'electron-builder postinstall selects 0755 after successful user-namespace probe' }, mode: 'installed Ubuntu .deb with deterministic Codex fixture', launches, shutdowns, checks: [], limits: ['No provider authentication or live inference.', 'Container X11 desktop; not a GNOME/Wayland or Debian distribution certification.'] }
const transcript = () => fs.existsSync(root + '/transcript.jsonl') ? fs.readFileSync(root + '/transcript.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []
const check = (name, condition) => { assert(condition, name); result.checks.push(name) }
async function launch() {
  app = await _electron.launch({ executablePath: binary, chromiumSandbox: true, args: ['--user-data-dir=' + profile, '--password-store=gnome-libsecret'], cwd: workspace, env: { PATH: root + '/bin:/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME, DISPLAY: ':99', XDG_RUNTIME_DIR: root + '/runtime', DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS, LANG: 'C.UTF-8', SHELL: '/bin/bash', ZIAFORGE_E2E: '1', ZIAFORGE_E2E_TRANSCRIPT: root + '/transcript.jsonl', ZIAFORGE_E2E_CODEX_CONTROLS: root + '/controls' }, timeout: 45000 })
  proc = app.process(); owned = ownedProcesses(proc.pid); owned.observe()
  page = await until(async () => app.windows().find(window => /index\.html/.test(window.url())) || null, 'real application window')
  page.on('pageerror', error => rendererErrors.push(error.message))
  await page.waitForFunction(() => !!window.ziafAPI)
  const runtime = await app.evaluate(({ app: electron, BrowserWindow, safeStorage }) => ({ storageBackend: safeStorage.getSelectedStorageBackend(), packaged: electron.isPackaged, version: electron.getVersion(), userData: electron.getPath('userData'), appPath: electron.getAppPath(), pid: process.pid, uid: process.getuid(), home: process.env.HOME, rendererSandbox: BrowserWindow.getAllWindows().filter(w => /index\.html/.test(w.webContents.getURL())).map(w => w.webContents.getLastWebPreferences().sandbox) }))
  check('packaged ASAR and isolated profile', runtime.packaged && runtime.appPath.endsWith('/resources/app.asar') && runtime.userData === profile && runtime.uid !== 0)
  check('GNOME Secret Service selected after app ready', runtime.storageBackend === 'gnome_libsecret')
  check('renderer sandbox enabled', runtime.rendererSandbox.length === 1 && runtime.rendererSandbox[0] === true)
  check('no sandbox-disable argument', !proc.spawnargs.some(arg => /no-sandbox|disable-setuid-sandbox/.test(arg)))
  launches.push(runtime)
}
async function close() {
  if (!app) return
  owned.observe()
  const child = proc
  await app.close(); app = null
  const cleanup = await owned.cleanup()
  const exitCode = child.exitCode
  shutdowns.push({ exitCode, signal: child.signalCode, cleanup })
  check('normal Quit and no owned fallback', exitCode === 0 && !child.signalCode && cleanup.verified && cleanup.signals.length === 0)
}
async function call(method, args = []) { return page.evaluate(({ method, args }) => { let obj = window.ziafAPI; const pieces = method.split('.'); for (const part of pieces.slice(0, -1)) obj = obj[part]; return obj[pieces.at(-1)](...args) }, { method, args }) }
async function setupTask() {
  fs.mkdirSync(workspace + '/Work', { recursive: true })
  task = await call('createTask', [{ name: 'Linux instance ' + role.toUpperCase(), description: '', repoId: 'work-folder', branchType: 'Folder', branchName: 'Work', model: 'Linux fixture', workflow: 'Draft & Document' }])
  await page.reload(); await page.getByRole('button', { name: task.name, exact: true }).click()
  await page.getByTestId('composer-input').fill('fixture-hello')
  await page.getByTestId('composer-send-button').click()
  snapshot = await until(async () => { const s = await call('agentSessions.attach', [{ taskId: task.id, chatId: 'chat-main' }]); return s?.lastTurn?.status === 'completed' ? s : null }, 'fixture completion')
  check('exact one local fixture prompt', transcript().filter(e => e.event === 'prompt').length === 1)
  const draft = 'Unsent draft for Ubuntu ' + role.toUpperCase() + ' — сохранён'
  await page.getByTestId('composer-input').fill(draft)
  await page.screenshot({ path: root + '/01-desktop-history.png', fullPage: true })
  return { task, snapshot, draft }
}
async function perform(command) {
  if (command.type === 'seed') return setupTask()
  if (command.type === 'configure') {
    config = { enabled: true, host: '0.0.0.0', port: 43111, scope: command.scope || 'read', nativeComputer: false, assistantPreset: '', assistantOperate: false, telegramEnabled: false, telegramOwner: '', instances: command.instances || [] }
    return call('control.configure', [config])
  }
  if (command.type === 'observe') {
    const tasks = await call('getTasks')
    return { tasks, version: await call('getAppVersion'), promptCount: transcript().filter(e => e.event === 'prompt').length }
  }
  if (command.type === 'show') {
    task = (await call('getTasks')).find(t => t.id === command.taskId)
    assert(task)
    await page.reload(); await page.getByRole('button', { name: task.name, exact: true }).click()
    await page.getByTestId('composer-input').fill(command.draft)
    snapshot = await call('agentSessions.attach', [{ taskId: task.id, chatId: 'chat-main' }])
    await page.screenshot({ path: root + '/02-remote-history.png', fullPage: true })
    return { task, snapshot, draft: command.draft }
  }
  if (command.type === 'restart') {
    const old = await call('agentSessions.attach', [{ taskId: command.taskId, chatId: 'chat-main' }])
    const prompts = transcript().filter(e => e.event === 'prompt').length
    await close(); await launch()
    const tasks = await call('getTasks'); task = tasks.find(t => t.id === command.taskId); assert(task)
    await page.getByRole('button', { name: task.name, exact: true }).click()
    await until(async () => (await page.getByTestId('composer-input').inputValue()) === command.draft, 'retained draft')
    const restored = await call('agentSessions.attach', [{ taskId: task.id, chatId: 'chat-main' }])
    assert.deepEqual(restored.feed, old.feed)
    check('history session identity retained without automatic provider', restored.sessionId === old.sessionId && restored.runId === old.runId && transcript().filter(e => e.event === 'prompt').length === prompts)
    await page.screenshot({ path: root + '/03-restarted-history.png', fullPage: true })
    return { sessionId: restored.sessionId, runId: restored.runId, historyMessages: restored.feed.length, prompts }
  }
  if (command.type === 'quit') { stopping = true; return { quitting: true } }
  throw new Error('Unknown fixture command')
}
async function main() {
  for (const directory of [profile, workspace, root + '/bin', root + '/controls', root + '/runtime']) fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  json(profile + '/settings.json', { useMockData: false, globalWorkspacePath: workspace, uiLanguage: 'en', theme: 'dark', defaultCodingPreset: 'Linux fixture', debugLogging: false })
  json(profile + '/presets.json', [{ name: 'Linux fixture', agent: 'Codex', model: 'gpt-fixture', permissions: 'Read only' }])
  fs.writeFileSync(root + '/bin/codex', '#!/bin/sh\nexec /usr/local/bin/node /build/source/e2e/fixtures/codex.cjs "$@"\n', { mode: 0o755 })
  for (const name of ['agy', 'claude']) fs.writeFileSync(root + '/bin/' + name, '#!/bin/sh\necho "Disabled in isolated Linux fixture" >&2\nexit 126\n', { mode: 0o755 })
  desktops.push(spawn('/usr/bin/Xvfb', [':99', '-screen', '0', '1440x1000x24', '-nolisten', 'tcp'], { stdio: 'ignore' }))
  await until(() => fs.existsSync('/tmp/.X11-unix/X99'), 'X11 display')
  desktops.push(spawn('/usr/bin/fluxbox', [], { stdio: 'ignore' }))
  keyring = await startPrivateKeyring(root + '/runtime'); result.keyring = keyring.receipt
  await launch(); json(root + '/ready.json', { ready: true, role, runtime: launches[0] })
  while (!stopping) {
    const filename = root + '/request.json'
    if (!fs.existsSync(filename)) { await delay(100); continue }
    const command = JSON.parse(fs.readFileSync(filename, 'utf8')); fs.unlinkSync(filename)
    try { json(root + '/response-' + command.id + '.json', { ok: true, result: await perform(command) }) }
    catch (error) { json(root + '/response-' + command.id + '.json', { ok: false, error: error.stack }); throw error }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; result.interrupted = signal })
main().then(() => { result.status = 'passed' }).catch(error => { result.status = 'failed'; result.error = error.stack }).finally(async () => {
  try { await close() } catch (error) { result.status = 'failed'; result.cleanupError = error.stack }
  if (keyring) { result.keyringCleanup = await keyring.close(); if (!result.keyringCleanup.stopped || result.keyringCleanup.forced) result.status = 'failed' }
  for (const child of desktops) child.kill('SIGTERM')
  result.rendererErrors = rendererErrors
  result.bundleBefore = before; result.bundleAfter = bundleInventory(appRoot).digest
  if (rendererErrors.length || before !== result.bundleAfter || result.interrupted) result.status = 'failed'
  result.finishedAt = new Date().toISOString(); json(root + '/result.json', result)
  process.exitCode = result.status === 'passed' ? 0 : 1
})
