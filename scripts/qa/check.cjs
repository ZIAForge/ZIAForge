const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')
const { project, createRun, identity, buildIdentity, writeJson } = require('./common.cjs')

const args = process.argv.slice(2)
const known = new Set(['tooling', 'typescript', 'typescript-e2e', 'lint', 'unit', 'build', 'e2e', 'help', 'locales'])
const only = args.find(argument => argument.startsWith('--only='))?.slice('--only='.length).split(',')
if (args.includes('--help')) {
  console.log('Usage: npm run qa:check -- [--e2e] [--only=tooling,typescript,typescript-e2e,lint,unit,build,e2e,help,locales] [--dry-run]\nRuns checks sequentially; each invocation creates test-results/qa/<fresh-id>/manifest.json, result.json and logs.\nDefault: tooling syntax, typechecks, full lint, unit tests, build, help and locale consistency. --e2e adds Electron fixture tests, never real LLM calls. --only=e2e also builds first.')
  process.exit(0)
}
if (args.some(argument => argument !== '--e2e' && argument !== '--dry-run' && !argument.startsWith('--only=')) || only?.some(name => !known.has(name))) {
  console.error('Unknown check or option. Use --help.')
  process.exit(2)
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const node = (filename, ...parameters) => [process.execPath, path.join(project, filename), ...parameters]
const commands = [
  { name: 'tooling', commands: [
    ...['common', 'doctor', 'check', 'inspect', 'inspect-worker', 'process-tree', 'history-scale', 'fixture-environment'].map(name => [process.execPath, '--check', path.join(__dirname, `${name}.cjs`)]),
    [process.execPath, '--test', path.join(project, 'scripts/__tests__/fixture-environment.test.cjs')],
    [process.execPath, '--check', path.join(project, 'scripts/fix-node-pty-helper.cjs')],
    [process.execPath, '--test', path.join(project, 'scripts/__tests__/fix-node-pty-helper.test.cjs')],
    ...['package-macos.cjs', 'mac/package-utils.cjs', 'mac/build-version.cjs', 'mac/dependency-notices.cjs', 'mac/after-pack.cjs', 'mac/native-smoke.cjs', 'mac/smoke.cjs', 'mac/workflow-smoke.cjs', 'mac/upgrade-smoke.cjs', 'mac/upgrade-worker.cjs'].map(name => [process.execPath, '--check', path.join(project, 'scripts', name)]),
    ...['help/generate.cjs', 'locales/check.cjs', 'qa/telegram-live.cjs', 'linux/docker.cjs', 'linux/keyring.cjs', 'linux/package.cjs', 'linux/native-smoke.cjs', 'linux/session-worker.cjs'].map(name => [process.execPath, '--check', path.join(project, 'scripts', name)]),
    [process.execPath, '--test', path.join(project, 'scripts/__tests__/package-macos.test.cjs')],
    [process.execPath, '--test', path.join(project, 'scripts/__tests__/build-version.test.cjs')],
    [process.execPath, '--test', path.join(project, 'scripts/__tests__/dependency-notices.test.cjs')],
  ] },
  { name: 'locales', commands: [node('scripts/locales/check.cjs')] },
  { name: 'help', commands: [node('scripts/help/generate.cjs', '--check'), [process.execPath, '--test', path.join(project, 'scripts/__tests__/help-generation.test.cjs')]] },
  { name: 'typescript', commands: [node('node_modules/typescript/bin/tsc', '--noEmit')] },
  { name: 'typescript-e2e', commands: [node('node_modules/typescript/bin/tsc', '--noEmit', '-p', 'e2e/tsconfig.json')] },
  { name: 'lint', commands: [[npm, 'run', 'lint']] },
  { name: 'unit', commands: [[npm, 'test']] },
  { name: 'build', commands: [[npm, 'run', 'build:e2e']] },
  { name: 'e2e', commands: [node('node_modules/@playwright/test/cli.js', 'test')] },
]
const selected = new Set(only || ['tooling', 'typescript', 'typescript-e2e', 'lint', 'unit', 'build', 'help', 'locales'])
if (args.includes('--e2e')) selected.add('e2e')
if (selected.has('e2e')) selected.add('build')
const run = createRun('check', 'fixture')
// Storage/lifecycle tests must not put their fsynced scratch files inside a
// cloud-synchronised checkout. Retain the exact private path for diagnosis.
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-check-')))
fs.chmodSync(temporary, 0o700)
run.manifest.temporaryDirectory = temporary
writeJson(path.join(run.directory, 'manifest.json'), run.manifest)
const environment = {
  ...process.env, CI: 'true', GIT_OPTIONAL_LOCKS: '0', TMPDIR: temporary,
  ZIAFORGE_QA_OUTPUT: path.join(run.directory, 'playwright'),
  PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(run.directory, 'playwright-report'),
}
const result = {
  schemaVersion: 1, mode: 'fixture', status: 'running', startedAt: new Date().toISOString(),
  manifest: 'manifest.json', checks: [], liveProviders: 'unverified: these checks do not call LLM providers',
  temporaryDirectory: temporary,
}
const save = () => writeJson(path.join(run.directory, 'result.json'), result)
save()
console.log(`QA artifacts: ${run.directory}`)
let child
let interrupted = false
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  interrupted = true
  if (child) {
    try { process.platform === 'win32' ? child.kill('SIGINT') : process.kill(-child.pid, 'SIGINT') } catch { /* Child may have exited. */ }
  }
})

function execute(command, log) {
  return new Promise(resolve => {
    child = spawn(command[0], command.slice(1), {
      cwd: project, env: environment, detached: process.platform !== 'win32',
      shell: process.platform === 'win32' && command[0] === npm,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.pipe(log, { end: false })
    child.stderr.pipe(log, { end: false })
    let error
    child.on('error', caught => { error = caught.message })
    child.on('close', (exitCode, signal) => { child = null; resolve({ exitCode, signal, ...(error ? { error } : {}) }) })
  })
}

async function main() {
  for (const check of commands.filter(check => selected.has(check.name))) {
    const item = { name: check.name, status: 'running', commands: check.commands, log: `${check.name}.log`, startedAt: new Date().toISOString() }
    result.checks.push(item)
    if (args.includes('--dry-run')) item.status = 'planned'
    else if (interrupted) item.status = 'interrupted'
    else if (check.name === 'e2e' && result.checks.find(previous => previous.name === 'build')?.status !== 'passed') {
      item.status = 'blocked'; item.reason = 'build did not pass'
    } else {
      const log = fs.createWriteStream(path.join(run.directory, item.log))
      const start = Date.now()
      try {
        for (const command of check.commands) {
          const execution = await execute(command, log)
          Object.assign(item, execution)
          if (execution.exitCode !== 0 || interrupted) break
        }
        item.status = interrupted ? 'interrupted' : item.exitCode === 0 ? 'passed' : 'failed'
      } finally {
        await new Promise(resolve => log.end(resolve))
      }
      item.durationMs = Date.now() - start
    }
    item.finishedAt = new Date().toISOString()
    save()
    console.log(`${item.name}: ${item.status}`)
  }
  result.sourceAtFinish = identity()
  result.buildAtFinish = buildIdentity()
  result.sourceChangedDuringRun = result.sourceAtFinish.workingTreeSha256 !== run.manifest.source.workingTreeSha256
  result.status = args.includes('--dry-run') ? 'planned' : interrupted ? 'interrupted'
    : result.sourceChangedDuringRun || !run.manifest.source.workingTreeSha256 || !result.sourceAtFinish.workingTreeSha256 ? 'invalidated'
    : result.checks.every(check => check.status === 'passed') ? 'passed' : 'failed'
  if (result.status === 'invalidated') {
    result.reason = 'Source identity changed or was unavailable; per-check results do not certify one unchanged source tree.'
    console.error(result.reason)
  }
  result.finishedAt = new Date().toISOString()
  save()
  process.exitCode = result.status === 'passed' || result.status === 'planned' ? 0 : 1
}

main().catch(error => {
  result.status = 'failed'; result.error = error.message; result.finishedAt = new Date().toISOString(); save()
  console.error(error.message); process.exitCode = 1
})
