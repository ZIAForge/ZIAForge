// Native Windows Node source-storage proof. No Electron, GUI or provider calls.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync, spawnSync } = require('node:child_process')

const project = path.resolve(__dirname, '../..')
const baselineCommit = '9504aba4c4ce8311fc2d894bef050c870368b040'
const baselineFiles = ['RecoveryStore.ts', 'RecoveryWriteLock.ts', 'privateStorage.ts']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const errorInfo = error => ({ name: error?.name, message: String(error?.message ?? error), code: error?.code, syscall: error?.syscall })

function settings(profile, revision) {
  return {
    uiLanguage: revision % 2 ? 'ru' : 'en', theme: 'Dark',
    desktopNotifications: Boolean(revision % 2), soundAlerts: Boolean(revision % 3),
    debugLogging: false, globalWorkspacePath: path.join(profile, `workspace-${revision}`),
  }
}

function temporaryFiles(directory) {
  const found = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory() && !entry.isSymbolicLink()) found.push(...temporaryFiles(filename))
    else if (entry.name.endsWith('.tmp')) found.push(path.relative(directory, filename))
  }
  return found
}

function owners(filename) {
  const directory = path.join(`${filename}.recovery`, 'write-locks')
  return fs.readdirSync(directory).filter(name => /^\d{16}\.json$/.test(name)).sort().map(name => {
    const file = path.join(directory, name)
    assert.ok(fs.lstatSync(file).isFile(), 'Lock owner must remain a regular file')
    const owner = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.equal(owner.generation, Number(name.slice(0, 16)), 'Lock generation must match its filename')
    return owner
  })
}

function sourceIdentity() {
  return {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: project, encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: project, encoding: 'utf8' }).trim()),
    harnessSha256: sha(fs.readFileSync(__filename)),
  }
}

function installLoader(config, loaded) {
  const ts = require(path.join(project, 'node_modules/typescript'))
  require.extensions['.ts'] = (mod, filename) => {
    const bytes = fs.readFileSync(filename)
    const base = filename.startsWith(config.baselineRoot + path.sep) ? config.baselineRoot : project
    loaded.push({ tree: base === project ? 'patched' : 'baseline', file: path.relative(base, filename).split(path.sep).join('/'), sha256: sha(bytes) })
    const compiled = ts.transpileModule(bytes.toString('utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename, reportDiagnostics: true,
    })
    const errors = (compiled.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
    assert.equal(errors.length, 0, `Cannot transpile ${path.basename(filename)}: ${errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('; ')}`)
    mod._compile(compiled.outputText, filename)
  }
}

// Observe the real calls; all successful operations still use Node's native APIs.
function observeSyncs() {
  const counts = { regularSyncAttempts: 0, regularSyncSuccesses: 0, regularAsyncAttempts: 0, regularAsyncSuccesses: 0, directoryOpens: 0, directorySyncAttempts: 0, directoryFailures: [] }
  const open = fs.openSync, sync = fs.fsyncSync, asyncOpen = fs.promises.open
  const isDirectory = filename => {
    try { return fs.lstatSync(filename).isDirectory() } catch { return false }
  }
  fs.openSync = function (filename, ...args) {
    const directory = isDirectory(filename)
    if (directory) counts.directoryOpens++
    try { return open.call(fs, filename, ...args) }
    catch (error) {
      if (directory) counts.directoryFailures.push({ operation: 'openSync', directory: path.basename(filename), ...errorInfo(error) })
      throw error
    }
  }
  fs.fsyncSync = function (fd) {
    const stat = fs.fstatSync(fd)
    if (stat.isFile()) counts.regularSyncAttempts++
    else if (stat.isDirectory()) counts.directorySyncAttempts++
    try {
      const result = sync.call(fs, fd)
      if (stat.isFile()) counts.regularSyncSuccesses++
      return result
    } catch (error) {
      if (stat.isDirectory()) counts.directoryFailures.push({ operation: 'fsyncSync', ...errorInfo(error) })
      throw error
    }
  }
  fs.promises.open = async function (filename, ...args) {
    const directory = isDirectory(filename)
    if (directory) counts.directoryOpens++
    let handle
    try { handle = await asyncOpen.call(fs.promises, filename, ...args) }
    catch (error) {
      if (directory) counts.directoryFailures.push({ operation: 'open', directory: path.basename(filename), ...errorInfo(error) })
      throw error
    }
    const handleSync = handle.sync.bind(handle)
    handle.sync = async () => {
      const stat = await handle.stat()
      if (stat.isFile()) counts.regularAsyncAttempts++
      else if (stat.isDirectory()) counts.directorySyncAttempts++
      try {
        const result = await handleSync()
        if (stat.isFile()) counts.regularAsyncSuccesses++
        return result
      } catch (error) {
        if (stat.isDirectory()) counts.directoryFailures.push({ operation: 'sync', ...errorInfo(error) })
        throw error
      }
    }
    return handle
  }
  return counts
}

async function child(config) {
  const report = { phase: config.phase, status: 'failed', pid: process.pid, loadedSources: [] }
  try {
    assert.equal(process.platform, 'win32', 'This proof requires native Windows Node')
    const childProcess = require('node:child_process')
    let unexpectedSubprocesses = 0
    for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
      childProcess[name] = () => { unexpectedSubprocesses++; throw new Error('The source-storage child must not launch another process') }
    }
    installLoader(config, report.loadedSources)
    report.syncs = observeSyncs()
    // The unchanged production validator is shared; baseline storage resolves
    // its own exact three modules from the isolated git-show snapshot.
    const { validateSavedSettings } = require(path.join(project, 'electron/runtime/StoredMetadataValidation.ts'))
    const storageRoot = config.phase === 'baseline' ? config.baselineRoot : path.join(project, 'electron/runtime')
    const { RecoveryStore } = require(path.join(storageRoot, 'RecoveryStore.ts'))
    const filename = path.join(config.profile, 'settings.json')
    const makeStore = () => new RecoveryStore({ filename, validate: validateSavedSettings })
    const initial = settings(config.profile, 0)
    const store = makeStore()
    if (config.phase === 'baseline') {
      validateSavedSettings(initial)
      assert.deepEqual(store.read(), initial)
      const before = fs.readFileSync(filename)
      let failure
      try { store.write(settings(config.profile, 1)) } catch (error) { failure = error }
      assert.ok(failure, 'Unpatched Windows storage unexpectedly saved successfully')
      assert.ok(report.syncs.directoryFailures.length > 0, 'Baseline must fail specifically in native directory open/fsync')
      assert.equal(report.syncs.directoryFailures.at(-1).code, failure.code)
      assert.deepEqual(fs.readFileSync(filename), before, 'Failed baseline save changed the original settings')
      assert.deepEqual(store.read(), initial)
      const records = owners(filename)
      assert.equal(records.length, 1)
      assert.equal(records[0].state, 'held')
      assert.equal(records[0].pid, process.pid)
      assert.ok(report.syncs.regularSyncSuccesses >= 1, 'Baseline owner file must actually be fsynced before directory failure')
      report.expectedFailure = errorInfo(failure)
      report.primaryUnchanged = true
      report.primarySha256 = sha(before)
      report.ownerAfterFailure = records[0]
    } else {
      const previousOwners = owners(filename)
      if (config.phase === 'patched') {
        assert.equal(previousOwners.at(-1).state, 'held')
        assert.equal(previousOwners.at(-1).pid, config.baselinePid)
        assert.throws(() => process.kill(config.baselinePid, 0), error => error.code === 'ESRCH', 'The failed baseline child must have exited')
        assert.deepEqual(store.read(), initial)
        const values = [settings(config.profile, 1), ...Array.from({ length: 12 }, (_, index) => settings(config.profile, index + 2))]
        const syncSuccessesBefore = report.syncs.regularSyncSuccesses
        for (const value of values) {
          validateSavedSettings(value)
          const priorGeneration = owners(filename).at(-1).generation
          const priorSyncs = report.syncs.regularSyncSuccesses
          makeStore().write(value)
          assert.deepEqual(makeStore().read(), value, 'Recreated store did not read the just-saved settings')
          const latest = owners(filename).at(-1)
          assert.equal(latest.generation, priorGeneration + 1)
          assert.equal(latest.state, 'released')
          assert.equal(latest.pid, process.pid)
          assert.ok(report.syncs.regularSyncSuccesses > priorSyncs, 'Each save must fsync regular files')
        }
        report.saves = values.length
        report.repeatedSaves = 12
        report.recreatedReads = values.length
        report.deadBaselineOwnerReclaimed = true
        report.settingsFileSyncSuccesses = report.syncs.regularSyncSuccesses - syncSuccessesBefore

        const { writePrivateMetadata, replacePrivateMetadata, readPrivateMetadata } = require(path.join(project, 'electron/runtime/privateStorage.ts'))
        const privateFile = path.join(config.profile, 'private-metadata.json')
        const created = { version: 1, value: 'created' }, replacement = { version: 1, value: 'replaced' }
        await writePrivateMetadata(privateFile, created)
        assert.deepEqual(await readPrivateMetadata(privateFile), created)
        const originalPrivate = fs.readFileSync(privateFile)
        await assert.rejects(writePrivateMetadata(privateFile, { version: 1, value: 'conflicting' }), error => error.code === 'EEXIST')
        assert.deepEqual(fs.readFileSync(privateFile), originalPrivate, 'Exclusive create conflict changed existing metadata')
        await replacePrivateMetadata(privateFile, replacement)
        assert.deepEqual(await readPrivateMetadata(privateFile), replacement)
        assert.ok(report.syncs.regularAsyncSuccesses >= 3, 'Create, conflict temporary and replace must fsync regular files')
        report.privateMetadata = { create: 'passed', read: 'passed', exclusiveConflict: 'passed', replacement: 'passed', regularAsyncSyncSuccesses: report.syncs.regularAsyncSuccesses }
      } else {
        assert.equal(config.phase, 'cold-reopen')
        assert.equal(previousOwners.at(-1).state, 'released')
        assert.notEqual(previousOwners.at(-1).pid, process.pid, 'Cold reopen must use another process')
        assert.deepEqual(store.read(), settings(config.profile, 13), 'Cold process lost the final repeated save')
        makeStore().write(settings(config.profile, 14))
        assert.deepEqual(makeStore().read(), settings(config.profile, 14))
        assert.equal(owners(filename).at(-1).generation, previousOwners.at(-1).generation + 1)
        report.saves = 1
        report.coldRead = 'passed'
        report.coldSave = 'passed'
      }
      const inspection = makeStore().inspect()
      assert.equal(inspection.state, 'valid')
      assert.equal(inspection.fingerprint, sha(fs.readFileSync(filename)))
      assert.ok(inspection.backups.some(item => item.id === inspection.fingerprint))
      assert.equal(inspection.backups.length, 8, 'Revision backups must be pruned to their configured bound')
      const records = owners(filename)
      assert.equal(records.length, 8, 'Owner generations must be pruned to eight')
      assert.ok(records.every(owner => owner.state === 'released'))
      assert.equal(records.at(-1).pid, process.pid)
      assert.equal(report.syncs.directoryOpens, 0, 'Patched Windows storage must not open directory descriptors')
      assert.equal(report.syncs.directorySyncAttempts, 0)
      assert.equal(report.syncs.directoryFailures.length, 0)
      assert.ok(report.syncs.regularSyncSuccesses > 0)
      report.primarySha256 = inspection.fingerprint
      report.backups = inspection.backups.length
      report.lockRecords = records.length
      report.latestOwner = records.at(-1)
    }
    report.temporaryFiles = temporaryFiles(config.profile)
    assert.deepEqual(report.temporaryFiles, [], 'Publication left temporary files behind')
    assert.equal(unexpectedSubprocesses, 0)
    report.unexpectedSubprocesses = unexpectedSubprocesses
    report.status = 'passed'
  } catch (error) { report.error = errorInfo(error) }
  process.stdout.write(JSON.stringify(report) + '\n')
  process.exitCode = report.status === 'passed' ? 0 : 1
}

function runChild(config, temporaryDirectory) {
  const input = path.join(temporaryDirectory, `${config.phase}-input.json`)
  fs.writeFileSync(input, JSON.stringify(config), { mode: 0o600 })
  const startedAt = new Date().toISOString()
  const execution = spawnSync(process.execPath, [__filename, '--child', input], {
    cwd: project, encoding: 'utf8', timeout: 60_000, maxBuffer: 512 * 1024, windowsHide: true,
  })
  const stdout = execution.stdout || '', stderr = execution.stderr || ''
  let report
  try { report = JSON.parse(stdout.trim()) }
  catch { report = { phase: config.phase, status: 'failed', error: { message: 'Child did not return one JSON receipt' } } }
  report.execution = { startedAt, endedAt: new Date().toISOString(), exitCode: execution.status, signal: execution.signal, error: execution.error ? errorInfo(execution.error) : null }
  if (stderr.trim()) report.stderr = stderr.trim().slice(0, 8192)
  if (execution.status !== 0 || execution.error) report.status = 'failed'
  return report
}

function main(args) {
  let baseline = baselineCommit, output = path.join(project, 'test-results/windows-settings-save/result.json')
  for (let index = 0; index < args.length; index++) {
    if (!['--baseline', '--output'].includes(args[index]) || !args[index + 1]) throw new Error('Usage: node scripts/qa/windows-settings-save.cjs [--baseline COMMIT] [--output RESULT_JSON]')
    if (args[index] === '--baseline') baseline = args[++index]
    else output = path.resolve(project, args[++index])
  }
  const result = {
    schemaVersion: 1, kind: 'windows-settings-source-storage-regression', status: 'failed',
    classification: 'native Windows Node source-storage proof', startedAt: new Date().toISOString(),
    scope: { gui: 'not-run', electron: 'not-run', providerInference: 'not-run', fullSuite: 'not-run', fileSymlinkCases: 'not-run' },
    environment: { platform: process.platform, arch: process.arch, node: process.version, osRelease: os.release(), osVersion: os.version(), runnerOS: process.env.RUNNER_OS, runnerArch: process.env.RUNNER_ARCH },
    baselineCommit: baseline, baselineSources: [], phases: [], cleanup: { temporaryDirectoryRemoved: false },
  }
  let temporaryDirectory
  try {
    assert.equal(process.platform, 'win32', 'This proof requires native Windows Node; a platform mock is insufficient')
    assert.equal(baseline, baselineCommit, 'Baseline must remain the exact broken release commit')
    result.sourceBefore = sourceIdentity()
    temporaryDirectory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaforge-windows-settings-')))
    const baselineRoot = path.join(temporaryDirectory, 'baseline'), profile = path.join(temporaryDirectory, 'profile')
    fs.mkdirSync(baselineRoot)
    fs.mkdirSync(profile)
    for (const file of baselineFiles) {
      const bytes = execFileSync('git', ['show', `${baseline}:electron/runtime/${file}`], { cwd: project, maxBuffer: 256 * 1024 })
      fs.writeFileSync(path.join(baselineRoot, file), bytes)
      result.baselineSources.push({ file: `electron/runtime/${file}`, sha256: sha(bytes) })
    }
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings(profile, 0)), { mode: 0o600 })
    for (const phase of ['baseline', 'patched', 'cold-reopen']) {
      const report = runChild({ phase, baselineRoot, profile, baselinePid: result.phases[0]?.pid }, temporaryDirectory)
      result.phases.push(report)
      assert.equal(report.status, 'passed', `${phase} failed: ${report.error?.message ?? report.execution.error?.message ?? 'see child receipt'}`)
    }
    // Detect concurrent edits to every TypeScript module actually exercised.
    for (const report of result.phases) for (const source of report.loadedSources ?? []) {
      if (source.tree === 'patched') assert.equal(sha(fs.readFileSync(path.join(project, source.file))), source.sha256, `Exercised source changed: ${source.file}`)
    }
    result.sourceAfter = sourceIdentity()
    assert.deepEqual(result.sourceAfter, result.sourceBefore, 'Source identity changed during the proof')
    result.status = 'passed'
  } catch (error) { result.error = errorInfo(error) }
  finally {
    if (temporaryDirectory) {
      try { fs.rmSync(temporaryDirectory, { recursive: true, force: true }); result.cleanup.temporaryDirectoryRemoved = !fs.existsSync(temporaryDirectory) }
      catch (error) { result.cleanup.error = errorInfo(error); result.status = 'failed' }
    }
    result.endedAt = new Date().toISOString()
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify({ status: result.status, classification: result.classification, platform: process.platform, arch: process.arch, phases: result.phases.map(item => ({ phase: item.phase, status: item.status })), output }))
    process.exitCode = result.status === 'passed' ? 0 : 1
  }
}

if (process.argv[2] === '--child') {
  child(JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))).catch(error => { console.error(errorInfo(error)); process.exitCode = 1 })
} else {
  try { main(process.argv.slice(2)) }
  catch (error) { console.error(errorInfo(error)); process.exitCode = 2 }
}
