// Only invoked by upgrade-smoke.cjs. Actions use ordinary UI; IPC is read-only
// evidence. No synthetic state is written into task/session/workflow storage.
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { _electron, expect } = require('@playwright/test')
const { project, writeJson } = require('../qa/common.cjs')
const { ownedProcesses } = require('../qa/process-tree.cjs')
const { fixtureEnvironment } = require('../qa/fixture-environment.cjs')

const [directory, oldBundle, newBundle] = process.argv.slice(2)
if (!process.send || !directory || !oldBundle || !newBundle) throw new Error('Run scripts/mac/upgrade-smoke.cjs instead')
const resultFile = path.join(directory, 'result.json')
const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'))
result.phases = []; result.rendererErrors = []
const save = () => writeJson(resultFile, result)
const profile = path.join(directory, 'profile')
const userData = path.join(profile, 'user-data')
const projectFolder = path.join(profile, 'project')
const repo = path.join(projectFolder, 'repo')
const bin = path.join(profile, 'bin')
const tmp = path.join(profile, 'tmp')
const shellConfig = path.join(profile, 'shell-config')
const controls = path.join(profile, 'codex-controls')
const transcriptFile = path.join(profile, 'transcript.jsonl')
const quote = value => "'" + value.replace(/'/g, "'\"'\"'") + "'"
const transcript = () => fs.existsSync(transcriptFile) ? fs.readFileSync(transcriptFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
const prompts = () => transcript().filter(item => item.event === 'prompt')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const alive = pid => { try { process.kill(pid, 0); return true } catch (error) { return error.code !== 'ESRCH' } }
let active, stopping, quitRequested, finished = false
const stop = reason => {
  if (stopping || finished) return
  stopping = reason; result.stopReason = reason; save()
  if (active) { quitRequested = quit(active); void quitRequested.catch(() => {}) }
}
process.on('message', message => { if (message?.type === 'stop') stop(message.reason) })
process.once('disconnect', () => stop('supervisor-disconnected'))
for (const stream of [process.stdout, process.stderr]) stream.on('error', () => stop('output-disconnected'))
const check = () => { if (stopping) throw new Error('Upgrade interrupted: ' + stopping) }

function setup() {
  for (const folder of [userData, repo, bin, tmp, shellConfig, controls]) fs.mkdirSync(folder, { recursive: true })
  const git = args => execFileSync('/usr/bin/git', args, { cwd: repo, env: { PATH: '/usr/bin:/bin', LANG: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } })
  git(['init', '--template=', '-b', 'main'])
  git(['-c', 'user.name=ZIAForge Upgrade Fixture', '-c', 'user.email=upgrade@ziaforge.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'Disposable upgrade fixture'])
  writeJson(path.join(userData, 'settings.json'), { theme: 'dark', language: 'en', uiLanguage: 'en', useMockData: false, debugLogging: false, soundAlerts: false, desktopNotifications: false, globalWorkspacePath: profile, defaultCodingPreset: 'Upgrade Codex', defaultReviewPreset: 'Upgrade Codex' })
  writeJson(path.join(userData, 'presets.json'), [{ name: 'Upgrade Codex', agent: 'Codex', model: 'gpt-fixture', permissions: 'Read only' }])
  writeJson(path.join(userData, 'repositories.json'), [{ id: 'repo-upgrade', name: 'Upgrade Project', path: projectFolder, repoPath: repo }])
  writeJson(path.join(projectFolder, 'tasks.json'), [])
  const fixturePath = [bin, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter)
  fs.writeFileSync(path.join(bin, 'codex'), `#!/bin/bash\nexec ${quote(process.execPath)} ${quote(path.join(project, 'e2e/fixtures/codex.cjs'))} "$@"\n`, { mode: 0o755 })
  for (const name of ['agy', 'claude']) fs.writeFileSync(path.join(bin, name), '#!/bin/sh\necho "Provider disabled in upgrade fixture" >&2\nexit 126\n', { mode: 0o755 })
  fs.writeFileSync(path.join(shellConfig, '.zprofile'), `export PATH=${quote(fixturePath)}\n`)
  fs.writeFileSync(path.join(bin, 'shell'), '#!/bin/bash\nprintf \'{"pid":%d,"event":"pty-shell-start"}\\n\' "$$" >> "$ZIAFORGE_E2E_TRANSCRIPT"\nexport PATH=' + quote(fixturePath) + '\nexec /bin/bash --noprofile --norc -i\n', { mode: 0o755 })
  result.profile = { userData, project: projectFolder, transcript: transcriptFile, seededTaskCount: 0, seededWorkflowCount: 0 }
  save()
  // Inherit HOME unchanged. The fixture is the only callable provider on this
  // explicit PATH; no user tokens/settings are copied into the profile.
  return fixtureEnvironment({ PATH: fixturePath, ZDOTDIR: shellConfig, TMPDIR: tmp, SHELL: path.join(bin, 'shell'), HISTFILE: path.join(profile, 'shell-history'), LANG: 'en_US.UTF-8',
    ZIAFORGE_E2E: '1', ZIAFORGE_E2E_BIN: bin, ZIAFORGE_E2E_TRANSCRIPT: transcriptFile, ZIAFORGE_E2E_CODEX_CONTROLS: controls })
}
async function launch(bundle, label, env) {
  check()
  const app = await _electron.launch({ executablePath: path.join(bundle, 'Contents/MacOS/ZIAForge'), args: [`--user-data-dir=${userData}`], cwd: project, env, timeout: 30000 })
  const phase = { label, bundle, pid: app.process().pid, status: 'running' }
  result.phases.push(phase); save()
  const handle = app.process()
  const instance = { app, phase, handle, descendants: ownedProcesses(handle.pid), startOffset: transcript().length }
  active = instance
  const recordError = page => page.on('pageerror', error => { result.rendererErrors.push({ phase: label, message: error.message }) })
  app.windows().forEach(recordError); app.on('window', recordError)
  instance.observer = setInterval(() => { try { instance.descendants.observe() } catch (error) { phase.observationError = error.message; stop('process-observation-failed') } }, 250)
  await app.context().tracing.start({ screenshots: true, snapshots: true })
  phase.runtime = await app.evaluate(({ app }, expectedHome) => ({ packaged: app.isPackaged, appPath: app.getAppPath(), userData: app.getPath('userData'), version: app.getVersion(), homeInherited: process.env.HOME === expectedHome }), process.env.HOME)
  expect(phase.runtime.packaged).toBe(true)
  expect(phase.runtime.homeInherited).toBe(true)
  expect(phase.runtime.appPath).toBe(path.join(bundle, 'Contents/Resources/app.asar'))
  expect(fs.realpathSync(phase.runtime.userData)).toBe(fs.realpathSync(userData))
  await expect.poll(() => Boolean(app.windows().find(page => !page.isClosed() && page.url().endsWith('/index.html'))), { timeout: 30000 }).toBe(true)
  instance.window = app.windows().find(page => !page.isClosed() && page.url().endsWith('/index.html'))
  instance.window.setDefaultTimeout(15000)
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(win => win.isVisible() && win.webContents.getURL().endsWith('/index.html'))), { timeout: 15000 }).toBe(true)
  check()
  return instance
}
async function quit(instance) {
  if (instance.quitting) return instance.quitting
  instance.quitting = (async () => {
    const { app, handle, phase } = instance
    await app.context().tracing.stop({ path: path.join(directory, `${phase.label}-trace.zip`) }).catch(() => {})
    instance.descendants.observe()
    if (handle.exitCode === null && handle.signalCode === null) {
      const deadline = setTimeout(() => { phase.forcedQuit = true; handle.kill('SIGKILL') }, 20000)
      try { await app.close() } catch (error) { phase.quitError = error.message } finally { clearTimeout(deadline) }
    }
    clearInterval(instance.observer)
    const pids = [...new Set(transcript().slice(instance.startOffset).filter(item => ['app-server-start', 'model-discovery-start'].includes(item.event)).map(item => item.pid))]
    for (let index = 0; index < 20 && pids.some(alive); index++) await delay(100)
    phase.providerPids = pids; phase.survivorsBeforeFallback = pids.filter(alive)
    phase.cleanup = await instance.descendants.cleanup()
    phase.exitCode = handle.exitCode; phase.exitSignal = handle.signalCode
    phase.status = !phase.quitError && !phase.forcedQuit && !phase.observationError && phase.exitCode === 0 && phase.exitSignal === null && !phase.survivorsBeforeFallback.length && phase.cleanup.verified && phase.cleanup.signals.length === 0 ? 'passed' : 'failed'
    save(); if (active === instance) active = undefined
    expect(phase.status, `${phase.label}: production Quit and owned-process cleanup`).toBe('passed')
  })()
  return instance.quitting
}
async function capture(window, name) {
  check()
  await window.screenshot({ path: path.join(directory, name + '.png'), fullPage: true })
  fs.writeFileSync(path.join(directory, name + '.yaml'), await window.locator('body').ariaSnapshot(), { mode: 0o600 })
}
const session = (window, taskId) => window.evaluate(id => globalThis.window.ziafAPI.agentSessions.attach({ taskId: id, chatId: 'chat-main' }), taskId)
const workflow = (window, taskId) => window.evaluate(id => globalThis.window.ziafAPI.workflows.get({ taskId: id }), taskId)

async function main() {
  try {
    const env = setup()
    const old = await launch(oldBundle, 'old', env), window = old.window
    await window.getByRole('button', { name: 'New task', exact: true }).first().click()
    // Code Start in 0.0.14+ is an executing workflow, not a draft chat.
    // Its contemporaneous legacy Work form still creates the profile whose
    // saved chat and executable-plan upgrade this harness is meant to test.
    const legacyWork = await window.getByTestId('new-code-options').count() > 0
    if (legacyWork) {
      await window.getByRole('button', { name: 'Work', exact: true }).click()
      if (await window.getByTestId('new-work-form').count()) throw new Error('The previous app uses versioned Work. This harness requires a previous legacy draft-task form.')
      result.profile.creationFlow = 'legacy-work-via-ordinary-ui'
    } else result.profile.creationFlow = 'legacy-code-via-ordinary-ui'
    const form = window.locator('form')
    if (!legacyWork) {
      await expect(form.getByRole('button', { name: 'Upgrade Project', exact: true })).toBeVisible()
      await form.getByPlaceholder('new-task-xxxx').fill('upgrade-fixture-task')
    }
    const preset = form.getByTestId('new-task-agent-preset')
    if (await preset.count()) {
      await preset.selectOption('Upgrade Codex')
      await expect(preset).toHaveValue('Upgrade Codex')
    } else await expect(form.getByRole('button', { name: 'Upgrade Codex', exact: true })).toBeVisible()
    await form.locator('textarea').fill('fixture-hello')
    await form.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(window.getByTestId('structured-codex-chat')).toBeVisible()
    await expect(window.getByTestId('composer-input')).toHaveValue('fixture-hello')
    expect(prompts()).toHaveLength(0)
    const tasks = await window.evaluate(() => globalThis.window.ziafAPI.getTasks())
    expect(tasks).toHaveLength(1)
    const task = tasks[0]; result.task = task
    expect(task).toMatchObject({ name: 'fixture-hello', model: 'Upgrade Codex', agentProvider: 'codex' })
    if (legacyWork) {
      expect(task.mode).toBe('work')
      expect(task.workFlowVersion).toBeUndefined()
      expect(task.codeFlowVersion).toBeUndefined()
    }
    await window.getByTestId('composer-send-button').click()
    await expect.poll(async () => (await session(window, task.id))?.lastTurn?.status, { timeout: 30000 }).toBe('completed')
    expect(prompts()).toHaveLength(1)
    const beforeSession = await session(window, task.id), firstPrompt = prompts()[0]
    await expect(window.getByTestId('conversation-feed').locator('[data-testid^="assistant-message-"]')).toHaveCount(1)
    await capture(window, '01-old-task-chat')
    await window.getByTestId('composer-input').fill('fixture-after-stop')
    if (!await window.getByTestId('executable-plan').isVisible()) await window.getByTestId('tab-btn-todo').click()
    await expect(window.getByTestId('executable-plan')).toBeVisible()
    await window.getByTestId('workflow-coder').selectOption('Upgrade Codex')
    await window.getByTestId('workflow-reviewer').selectOption('Upgrade Codex')
    // Legacy Work defaults to automatic advancement; this scenario deliberately
    // leaves a partial plan for the new app to resume.
    await window.getByTestId('workflow-auto').uncheck()
    await expect(window.getByTestId('workflow-auto')).not.toBeChecked()
    if (legacyWork) {
      const draft = await workflow(window, task.id)
      expect(draft.status).toBe('draft')
      expect(draft.plan.steps.map(step => step.title)).toEqual(['Prepare', 'Create artifact', 'Review and deliver'])
      expect(draft.steps.every(step => step.attempts.length === 0)).toBe(true)
      // Deliberately edit the ordinary draft plan to the same two-step upgrade
      // scenario. No IPC mutation or synthetic saved plan bypasses the old UI.
      for (let count = 3; count > 0; count--) {
        const first = window.getByTestId('workflow-step-0')
        const remove = first.getByRole('button', { name: 'Remove step', exact: true })
        if (!await remove.isVisible()) await first.getByRole('button').first().click()
        await remove.click()
      }
    }
    for (const [index, number] of [2, 3].entries()) {
      await window.getByTestId('workflow-add-title').fill(`Fixture step ${number}`)
      await window.getByTestId('workflow-add-step').click()
      const step = window.getByTestId(`workflow-step-${index}`)
      await step.getByLabel('Instructions', { exact: true }).fill(`Produce fixture-step-${number}.txt. Preserve other files.`)
      await step.getByLabel('Acceptance criteria (one per line)', { exact: true }).fill('File contains ready; independent review approves.')
      await window.getByTestId(`workflow-check-${index}`).fill(`/usr/bin/grep -qx ready fixture-step-${number}.txt`)
    }
    await window.getByTestId('workflow-save').click()
    await expect.poll(async () => (await workflow(window, task.id))?.plan.steps.length).toBe(2)
    await window.getByTestId('workflow-start').click()
    await expect.poll(async () => (await workflow(window, task.id))?.steps[0].status, { timeout: 30000 }).toBe('completed')
    await expect.poll(async () => (await workflow(window, task.id))?.status).toBe('paused')
    const beforeWorkflow = await workflow(window, task.id)
    expect(beforeWorkflow.steps[1].attempts).toHaveLength(0)
    expect(beforeWorkflow.steps[0].attempts[0]).toMatchObject({ status: 'completed', review: { outcome: 'approved' }, verification: [{ status: 'passed', exitCode: 0, cleanupVerified: true }] })
    result.before = { session: beforeSession, workflow: beforeWorkflow, promptCount: prompts().length }
    const retainedReceipt = beforeWorkflow.steps[0].attempts[0].verification[0]
    const retainedReceiptPath = retainedReceipt.stdoutPath.replace(/stdout\.log$/, 'receipt.json')
    const originalReceiptBytes = fs.readFileSync(retainedReceiptPath)
    await capture(window, '02-old-partial-plan'); save(); await quit(old)
    check()
    const upgraded = await launch(newBundle, 'new', env), nextWindow = upgraded.window
    await nextWindow.getByRole('button', { name: 'fixture-hello', exact: true }).click()
    const restoredSession = await session(nextWindow, task.id), restoredWorkflow = await workflow(nextWindow, task.id)
    expect(restoredSession.sessionId).toBe(beforeSession.sessionId)
    expect(restoredSession.feed).toEqual(beforeSession.feed)
    expect(restoredSession.resumeAvailable).toBe(true)
    expect(restoredWorkflow.runId).toBe(beforeWorkflow.runId)
    expect(restoredWorkflow.steps[0]).toEqual(beforeWorkflow.steps[0])
    expect(restoredWorkflow.steps[1].attempts).toHaveLength(0)
    expect(fs.readFileSync(retainedReceiptPath)).toEqual(originalReceiptBytes)
    expect(prompts()).toHaveLength(result.before.promptCount)
    await nextWindow.getByTestId('central-tab-chat-main').click()
    await expect(nextWindow.getByTestId('composer-input')).toHaveValue('fixture-after-stop')
    await expect(nextWindow.getByTestId('agent-session-resume')).toBeVisible()
    await capture(nextWindow, '03-new-restored-history-and-draft')
    await nextWindow.getByTestId('agent-session-resume').click()
    await expect.poll(async () => (await session(nextWindow, task.id))?.sessionStatus, { timeout: 30000 }).toBe('ready')
    expect(prompts()).toHaveLength(result.before.promptCount)
    await nextWindow.getByTestId('composer-send-button').click()
    await expect.poll(() => prompts().length).toBe(result.before.promptCount + 1)
    await expect.poll(async () => (await session(nextWindow, task.id))?.lastTurn?.status).toBe('completed')
    const resumedPrompt = prompts().at(-1)
    expect(resumedPrompt.text).toBe('fixture-after-stop')
    expect(resumedPrompt.threadId).toBe(firstPrompt.threadId)
    expect(resumedPrompt.pid).not.toBe(firstPrompt.pid)
    await expect(nextWindow.getByTestId('conversation-feed').locator('[data-testid^="user-message-"]')).toHaveCount(2)
    await expect(nextWindow.getByTestId('conversation-feed').locator('[data-testid^="assistant-message-"]')).toHaveCount(2)
    await capture(nextWindow, '04-new-native-context-resumed')
    if (!await nextWindow.getByTestId('executable-plan').isVisible()) await nextWindow.getByTestId('tab-btn-todo').click()
    await expect(nextWindow.getByTestId('executable-plan')).toBeVisible()
    await nextWindow.getByTestId('workflow-start').click()
    await expect.poll(async () => (await workflow(nextWindow, task.id))?.status, { timeout: 30000 }).toBe('completed')
    const completed = await workflow(nextWindow, task.id)
    expect(completed.steps[0]).toEqual(beforeWorkflow.steps[0])
    expect(completed.steps.map(step => step.attempts.length)).toEqual([1, 1])
    expect(completed.steps[1].attempts[0]).toMatchObject({ status: 'completed', review: { outcome: 'approved' }, verification: [{ status: 'passed', exitCode: 0, cleanupVerified: true }] })
    expect(fs.readFileSync(retainedReceiptPath)).toEqual(originalReceiptBytes)
    expect(transcript().filter(item => item.event === 'workflow-implementation').map(item => item.step)).toEqual([2, 3])
    expect(transcript().filter(item => ['protocol-error', 'invalid-launch', 'invalid-resume', 'pty-shell-start'].includes(item.event))).toEqual([])
    result.after = { session: await session(nextWindow, task.id), workflow: completed, promptCount: prompts().length, nativeThread: resumedPrompt.threadId, sameNativeThread: true, priorCompletedStepUnchanged: true, priorReceiptBytesUnchanged: true }
    await capture(nextWindow, '05-new-completed-plan'); save(); await quit(upgraded)
    expect(result.rendererErrors).toEqual([])
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'; result.error = error.message
    if (active?.window && !active.window.isClosed()) await active.window.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true }).catch(() => {})
  } finally {
    if (quitRequested) await quitRequested.catch(error => { result.cleanupError = error.message })
    if (active) await quit(active).catch(error => { result.cleanupError = error.message })
    if (stopping || result.cleanupError || result.phases.length !== 2 || result.phases.some(phase => phase.status !== 'passed')) result.status = 'failed'
    result.finishedAt = new Date().toISOString(); save()
    console.log(JSON.stringify({ status: result.status, evidence: directory, error: result.error }))
    process.exitCode = result.status === 'passed' ? 0 : 1
    finished = true
    if (process.connected) process.disconnect()
  }
}
void main()
