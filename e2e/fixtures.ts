import { test as base, expect, _electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdir, writeFile, chmod, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const qaEvidence = createRequire(import.meta.url)('../scripts/qa/common.cjs') as {
  identity: () => Record<string, unknown>
  buildIdentity: () => Record<string, unknown>
  environment: () => Record<string, unknown>
}
const qaProcesses = createRequire(import.meta.url)('../scripts/qa/process-tree.cjs') as {
  ownedProcesses: (pid: number) => {
    observe: () => void
    cleanup: () => Promise<{ verified: boolean; aliveCount: number; signals: Array<{ pid: number; signal: string }> }>
  }
}
const qaPackage = createRequire(import.meta.url)('../scripts/mac/package-utils.cjs') as {
  bundleInventory: (bundle: string) => { digest: string }
}

export const taskSessionId = 'term-task-task-e2e-0'
export const customSessionId = 'chat-e2e'

export type FixtureTranscriptEntry = {
  message?: string
  model?: string
  stage?: string
  index?: number
  cycle?: number
  sourceSha256?: string
  outcome?: string
  sharedDiffSha256?: string
  pid: number
  event?: string
  url?: string
  text?: string
  rawText?: string
  threadId?: string
  turnId?: string
  decision?: string
  barrier?: string
  signal?: string
  args?: string[]
  cwd?: string
  provider?: string
  conversationId?: string
  rpc?: { id?: string | number; method?: string; params?: Record<string, unknown>; result?: unknown }
}

type AppFixture = {
  electronApp: ElectronApplication
  window: Page
  transcript: () => Promise<FixtureTranscriptEntry[]>
  releaseCodex: (barrier: 'finish-interrupt' | 'accept-send' | 'configure-session' | 'code-flow-preparation' | 'work-flow-start') => Promise<void>
  releaseClaude: (barrier: 'finish-interrupt') => Promise<void>
  /** Production Quit, no fallback, then a new Electron process on the same profile. */
  restart: () => Promise<void>
}

export const test = base.extend<{ app: AppFixture; replayAgyStartup: boolean; fixtureAllProviders: boolean; holdModelDiscovery: boolean; providerFixture: 'agy' | 'codex' | 'claude' | 'agy-headless' }>({
  replayAgyStartup: [false, { option: true }],
  providerFixture: ['agy', { option: true }],
  fixtureAllProviders: [false, { option: true }],
  holdModelDiscovery: [false, { option: true }],
  // Playwright inspects this destructuring pattern to discover fixture dependencies.
  app: async ({ replayAgyStartup, providerFixture, fixtureAllProviders, holdModelDiscovery }, use, testInfo) => {
    test.skip(process.platform === 'win32', 'The deterministic CLI fixture currently requires bash (macOS/Linux).')
    const root = testInfo.outputPath('profile')
    const packagedInput = process.env.ZIAFORGE_E2E_PACKAGED_APP
    if (packagedInput && (!path.isAbsolute(packagedInput) || !packagedInput.endsWith('.app') || process.platform !== 'darwin')) throw new Error('Packaged fixture requires an absolute macOS .app path')
    const packagedApp = packagedInput ? await realpath(packagedInput) : undefined
    const embeddedIdentity = packagedApp ? JSON.parse(await readFile(path.join(packagedApp, 'Contents/Resources/build-identity.json'), 'utf8')) as unknown : undefined
    const bundleBefore = packagedApp ? qaPackage.bundleInventory(packagedApp).digest : undefined
    const packagedRuntimes: Array<{ packaged: boolean; appPath: string; userData: string; pid: number }> = []
    const userData = path.join(root, 'user-data')
    const project = path.join(root, 'project')
    const bin = path.join(root, 'bin')
    const tmp = path.join(root, 'tmp')
    const shellConfig = path.join(root, 'shell-config')
    const transcriptFile = path.join(root, 'transcript.jsonl')
    const codexControls = path.join(root, 'codex-controls')
    const claudeControls = path.join(root, 'claude-controls')
    const structured = providerFixture !== 'agy'
    const executableName = providerFixture === 'agy-headless' ? 'agy' : providerFixture
    const presetName = { agy: 'E2E Coding', codex: 'E2E Codex', claude: 'E2E Claude', 'agy-headless': 'E2E Antigravity' }[providerFixture]
    const worktree = path.join(project, 'worktrees', 'task-e2e')
    for (const directory of [userData, bin, tmp, shellConfig, codexControls, claudeControls, worktree, path.join(project, 'repo')]) {
      await mkdir(directory, { recursive: true })
    }
    if (structured) {
      const repository = path.join(project, 'repo')
      const git = (args: string[]) => promisify(execFile)('/usr/bin/git', args, {
        cwd: repository,
        // Git does not need the app-specific variables required by electron-env.d.ts.
        env: { PATH: '/usr/bin:/bin', LANG: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } as unknown as NodeJS.ProcessEnv,
      })
      await git(['init', '--template=', '-b', 'main'])
      await git(['-c', 'user.name=ZIAForge E2E', '-c', 'user.email=e2e@ziaforge.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'E2E fixture repository'])
      await git(['worktree', 'add', '-b', 'e2e', worktree])
    }
    const json = (filename: string, data: unknown) => writeFile(filename, JSON.stringify(data, null, 2))
    const startedAt = new Date().toISOString()
    const source = qaEvidence.identity()
    await json(testInfo.outputPath('manifest.json'), {
      schemaVersion: 1, mode: 'fixture', providerFixture, replayAgyStartup, test: testInfo.title,
      startedAt, source, build: qaEvidence.buildIdentity(), environment: qaEvidence.environment(),
      provider: `local deterministic ${providerFixture} fixture; no real LLM or provider authentication`,
      profile: root,
      ...(packagedApp ? { packagedApp, embeddedIdentity, bundleBefore } : {}),
    })
    await json(path.join(userData, 'settings.json'), {
      theme: 'dark', language: 'en', uiLanguage: 'en', useMockData: false,
      debugLogging: false, globalWorkspacePath: root,
      defaultCodingPreset: presetName, defaultReviewPreset: 'E2E Review',
    })
    await json(path.join(userData, 'presets.json'), [
      { name: 'E2E Review', agent: 'Google Antigravity', model: 'gemini-3.8-flash-medium', permissions: 'Read only' },
      { name: 'E2E Coding', agent: 'Google Antigravity', model: 'gemini-3.8-flash-high', permissions: 'Read only' },
      { name: 'E2E Codex', agent: 'Codex', model: 'gpt-fixture', permissions: 'Read only' },
      { name: 'E2E Claude', agent: 'Claude Code', model: 'claude-fixture', permissions: 'Read only' },
      { name: 'E2E Antigravity', agent: 'Google Antigravity', model: 'gemini-fixture', permissions: 'CLI settings' },
    ])
    await json(path.join(userData, 'repositories.json'), [
      { id: 'repo-e2e', name: 'E2E Project', path: project, repoPath: path.join(project, 'repo') },
    ])
    await json(path.join(project, 'tasks.json'), [{
      id: 'task-e2e', repoId: 'repo-e2e', name: 'E2E Workspace', model: presetName,
      ...(structured ? {} : { agentTransport: 'legacy-pty' }),
      workflow: 'Auto', status: 'running', branchType: 'Worktree', branchName: 'e2e',
      worktreePath: worktree, logs: [], feed: [], todoSteps: [], gitChanges: [],
    }])
    await mkdir(path.join(userData, 'task-chat-history'), { recursive: true })
    await json(path.join(userData, 'task-chat-history', 'task-e2e.json'), {
      version: 1, taskId: 'task-e2e',
      centralTabs: [
        { id: 'chat-main', name: 'Discussion Feed', type: 'chat' },
        { id: customSessionId, name: 'E2E Chat', type: 'chat' },
      ],
      customTabFeeds: {},
    })
    const quote = (value: string) => "'" + value.replace(/'/g, "'\"'\"'") + "'"
    const fixturePath = [bin, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter)
    // Production login-shell discovery stays within the same fixture PATH.
    // HOME remains inherited; no user zsh configuration is modified or loaded.
    await writeFile(path.join(shellConfig, '.zprofile'), `export PATH=${quote(fixturePath)}\n`)
    await writeFile(path.join(bin, executableName), `#!/bin/bash\nexec ${quote(process.execPath)} ${quote(path.resolve(`e2e/fixtures/${providerFixture}.cjs`))} "$@"\n`)
    await chmod(path.join(bin, executableName), 0o755)
    for (const name of ['agy', 'codex', 'claude'].filter(name => name !== executableName)) {
      await writeFile(path.join(bin, name), fixtureAllProviders
        ? `#!/bin/bash\nexec ${quote(process.execPath)} ${quote(path.resolve(`e2e/fixtures/${name === 'agy' ? 'agy-headless' : name}.cjs`))} "$@"\n`
        : '#!/bin/sh\necho "Provider disabled in Electron fixture profile" >&2\nexit 126\n', { mode: 0o755 })
    }
    const shell = path.join(bin, 'shell')
    const shellAudit = structured
      ? 'printf \'{"pid":%d,"event":"pty-shell-start"}\\n\' "$$" >> "$ZIAFORGE_E2E_TRANSCRIPT"\n'
      : ''
    await writeFile(shell, '#!/bin/bash\n' + shellAudit + 'export PATH="$ZIAFORGE_E2E_BIN:/usr/bin:/bin"\nexec /bin/bash --noprofile --norc -i\n')
    await chmod(shell, 0o755)

    const launch = () => _electron.launch({
      ...(packagedApp ? { executablePath: path.join(packagedApp, 'Contents/MacOS/ZIAForge') } : {}),
      args: [...(packagedApp ? [] : [path.resolve('e2e/bootstrap.cjs')]), `--user-data-dir=${userData}`],
      cwd: process.cwd(),
      timeout: 30_000,
      env: {
        PATH: fixturePath,
        ZDOTDIR: shellConfig,
        TMPDIR: tmp,
        SHELL: shell,
        HISTFILE: path.join(root, 'shell-history'),
        LANG: 'en_US.UTF-8',
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        ...(process.env.DISPLAY ? { DISPLAY: process.env.DISPLAY } : {}),
        ZIAFORGE_E2E: '1',
        ZIAFORGE_E2E_USER_DATA: userData,
        ZIAFORGE_E2E_BIN: bin,
        ZIAFORGE_E2E_TRANSCRIPT: transcriptFile,
        ZIAFORGE_E2E_CODEX_CONTROLS: codexControls,
        ZIAFORGE_E2E_CLAUDE_CONTROLS: claudeControls,
        ZIAFORGE_E2E_STARTUP_REPLAY: replayAgyStartup ? '1' : '0',
        ZIAFORGE_E2E_CATALOG_HOLD: holdModelDiscovery ? '1' : '0',
      },
    })
    let electronApp = await launch()
    let activeProcess = electronApp.process()
    const electronExits: Array<{ pid: number; exitCode: number | null; signal: string | null }> = []
    const quit = async () => {
      if (activeProcess.exitCode === null && activeProcess.signalCode === null) await electronApp.close()
      electronExits.push({ pid: activeProcess.pid!, exitCode: activeProcess.exitCode, signal: activeProcess.signalCode })
    }
    const verifyPackagedRuntime = async () => {
      if (!packagedApp) return
      const runtime = await electronApp.evaluate(({ app }) => ({ packaged: app.isPackaged, appPath: app.getAppPath(), userData: app.getPath('userData'), pid: process.pid }))
      packagedRuntimes.push(runtime)
      expect(runtime.packaged).toBe(true)
      expect(runtime.appPath).toBe(path.join(packagedApp, 'Contents/Resources/app.asar'))
      expect(await realpath(runtime.userData)).toBe(await realpath(userData))
    }
    let window = await electronApp.firstWindow()
    let ownedProcesses = qaProcesses.ownedProcesses(electronApp.process().pid!)
    const restartReceipts: Array<{ pid: number; providerPids: number[]; survivors: number[]; cleanup: unknown }> = []
    const errors: string[] = []
    let fixtureError: string | undefined
    window.on('pageerror', error => errors.push(error.message))
    const selectMainWindow = async () => {
      // Production launches a transient splash first. Bind to the actual app
      // page and its native visibility, including after a complete restart.
      const mainPage = () => electronApp.windows().find(page => !page.isClosed() && page.url().endsWith('/index.html'))
      await expect.poll(() => Boolean(mainPage()), { timeout: 20_000 }).toBe(true)
      const main = mainPage()!
      if (main !== window) main.on('pageerror', error => errors.push(error.message))
      window = main
      await expect.poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(candidate => candidate.isVisible() && candidate.webContents.getURL().endsWith('/index.html'))), { timeout: 20_000 }).toBe(true)
    }
    await electronApp.context().tracing.start({ screenshots: true, snapshots: true })
    try {
      await verifyPackagedRuntime()
      await selectMainWindow()
      await expect(window.getByRole('button', { name: 'E2E Workspace', exact: true })).toBeVisible()
      await use({
        get electronApp() { return electronApp },
        get window() { return window },
        restart: async () => {
          const pid = electronApp.process().pid!
          await electronApp.context().tracing.stop({ path: testInfo.outputPath(`restart-${restartReceipts.length + 1}.zip`) })
          ownedProcesses.observe()
          await quit()
          const entries = (await readFile(transcriptFile, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as FixtureTranscriptEntry)
          const providerPids = [...new Set(entries.filter(entry => ['app-server-start', 'provider-start'].includes(entry.event || '')).map(entry => entry.pid))]
          const alive = (candidate: number) => { try { process.kill(candidate, 0); return true } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH' } }
          for (let attempt = 0; attempt < 20 && providerPids.some(alive); attempt++) await new Promise(resolve => setTimeout(resolve, 100))
          const survivors = providerPids.filter(alive)
          const cleanup = await ownedProcesses.cleanup()
          restartReceipts.push({ pid, providerPids, survivors, cleanup })
          expect(survivors, 'Restart uses production Quit without leaving provider processes').toEqual([])
          expect(cleanup, 'Restart needs no fallback process signals').toMatchObject({ verified: true, aliveCount: 0, signals: [] })
          expect(electronExits.at(-1)).toMatchObject({ exitCode: 0, signal: null })
          electronApp = await launch()
          activeProcess = electronApp.process()
          window = await electronApp.firstWindow()
          ownedProcesses = qaProcesses.ownedProcesses(electronApp.process().pid!)
          window.on('pageerror', error => errors.push(error.message))
          await electronApp.context().tracing.start({ screenshots: true, snapshots: true })
          await verifyPackagedRuntime()
          await selectMainWindow()
          await expect(window.getByRole('button', { name: 'E2E Workspace', exact: true })).toBeVisible()
        },
        releaseCodex: barrier => writeFile(path.join(codexControls, barrier), 'release\n'),
        releaseClaude: barrier => writeFile(path.join(claudeControls, barrier), 'release\n'),
        transcript: async () => {
          const data = await readFile(transcriptFile, 'utf8').catch(() => '')
          return data.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
        },
      })
      expect(errors, 'Renderer exceptions').toEqual([])
    } catch (error) {
      fixtureError = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      const transcript = await readFile(transcriptFile, 'utf8').catch(() => '')
      await testInfo.attach('fixture-transcript.jsonl', { body: transcript, contentType: 'application/x-ndjson' })
      if (fixtureError || testInfo.status !== testInfo.expectedStatus) {
        await window.screenshot({ path: testInfo.outputPath('failure.png') }).catch(() => {})
        await electronApp.context().tracing.stop({ path: testInfo.outputPath('trace.zip') }).catch(() => {})
      } else {
        await electronApp.context().tracing.stop()
      }
      await window.evaluate(async sessions => {
        const chatTabs = [...document.querySelectorAll('[data-testid^="central-tab-"]')]
          .map(tab => tab.getAttribute('data-testid')!.replace('central-tab-', ''))
          .filter(id => id.startsWith('chat-') || id.startsWith('term-custom-'))
        await Promise.all([...new Set([...sessions, ...chatTabs])].map(sessionId => globalThis.window.ziafAPI.killPty({ sessionId })))
      }, [taskSessionId, customSessionId]).catch(() => {})
      ownedProcesses.observe()
      await quit().catch(error => { fixtureError ??= error instanceof Error ? error.message : String(error) })
      const codexPids = [...new Set(transcript.trim().split('\n').filter(Boolean)
        .map(line => JSON.parse(line) as FixtureTranscriptEntry)
        .filter(entry => entry.event === 'app-server-start').map(entry => entry.pid))]
      const providerPids = [...new Set(transcript.trim().split('\n').filter(Boolean)
        .map(line => JSON.parse(line) as FixtureTranscriptEntry)
        .filter(entry => ['app-server-start', 'provider-start'].includes(entry.event || '')).map(entry => entry.pid))]
      const modelDiscoveryPids = [...new Set(transcript.trim().split('\n').filter(Boolean)
        .map(line => JSON.parse(line) as FixtureTranscriptEntry)
        .filter(entry => entry.event === 'model-discovery-start').map(entry => entry.pid))]
      const alive = (pid: number) => {
        try { process.kill(pid, 0); return true }
        catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH' }
      }
      // Observe production Quit before applying any emergency fixture cleanup.
      for (let attempt = 0; attempt < 20 && providerPids.some(alive); attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const codexSurvivorsAfterQuit = codexPids.filter(alive)
      const providerSurvivorsAfterQuit = providerPids.filter(alive)
      const modelDiscoverySurvivorsAfterQuit = modelDiscoveryPids.filter(alive)
      const cleanup = await ownedProcesses.cleanup()
      const sourceAtFinish = qaEvidence.identity()
      const bundleAfter = packagedApp ? qaPackage.bundleInventory(packagedApp).digest : undefined
      const bundleChanged = bundleBefore !== bundleAfter
      await json(testInfo.outputPath('result.json'), {
        schemaVersion: 1, mode: 'fixture', test: testInfo.title,
        status: fixtureError || electronExits.some(exit => exit.exitCode !== 0 || exit.signal !== null) || providerSurvivorsAfterQuit.length || modelDiscoverySurvivorsAfterQuit.length || bundleChanged || !cleanup.verified ? 'failed' : testInfo.status, expectedStatus: testInfo.expectedStatus,
        startedAt, finishedAt: new Date().toISOString(), rendererErrors: errors,
        sourceAtFinish, sourceChangedDuringRun: sourceAtFinish.workingTreeSha256 !== source.workingTreeSha256,
        codexPids, codexSurvivorsAfterQuit, providerPids, providerSurvivorsAfterQuit, modelDiscoveryPids, modelDiscoverySurvivorsAfterQuit, cleanup, restartReceipts, electronExits, fixtureError,
        liveProviders: 'unverified: this test uses a local CLI fixture',
        ...(packagedApp ? { packagedApp, embeddedIdentity, packagedRuntimes, bundleBefore, bundleAfter, bundleChanged } : {}),
      })
      expect(codexSurvivorsAfterQuit, 'Production Quit terminates every owned Codex app-server before fallback cleanup').toEqual([])
      expect(providerSurvivorsAfterQuit, 'Production Quit terminates every structured provider before fallback cleanup').toEqual([])
      expect(modelDiscoverySurvivorsAfterQuit, 'Production Quit terminates model enumeration before fallback cleanup').toEqual([])
      expect(cleanup.verified, 'No owned fixture process survives teardown').toBe(true)
      expect(bundleChanged, 'Packaged fixture tests must never mutate the application bundle').toBe(false)
      expect(electronExits.every(exit => exit.exitCode === 0 && exit.signal === null), 'Every Electron instance exits normally').toBe(true)
      expect(fixtureError, 'Fixture setup and cleanup completed').toBeUndefined()
    }
  },
})

export { expect }
