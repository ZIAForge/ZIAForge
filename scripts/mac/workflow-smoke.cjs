// Exercise the production ASAR and embedded verification supervisor with local
// protocol fixtures. Never builds, installs, signs, or sends a real LLM request.
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { createRun, identity, writeJson } = require('../qa/common.cjs')
const { bundleInventory } = require('./package-utils.cjs')

const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node scripts/mac/workflow-smoke.cjs /absolute/path/ZIAForge.app\nRuns the three-step executable-plan GUI regression against the actual packaged ASAR with an isolated profile and fake providers. Includes real verification subprocesses, restart, Quit, receipts and bundle hashes; no rebuild or live inference.')
  process.exit(0)
}
if (process.platform !== 'darwin' || args.length !== 1 || !path.isAbsolute(args[0]) || !args[0].endsWith('.app')) throw new Error('Expected an absolute macOS .app path')
const bundle = fs.realpathSync(args[0])
const embeddedIdentity = JSON.parse(fs.readFileSync(path.join(bundle, 'Contents/Resources/build-identity.json'), 'utf8'))
const before = bundleInventory(bundle).digest
const run = createRun('packaged-workflow', 'fixture')
const result = { schemaVersion: 1, status: 'running', bundle, embeddedIdentity, bundleBefore: before,
  providerExecution: 'local deterministic stdio fixture; no real LLM or authentication',
  boundary: 'Production app.isPackaged and app.asar with isolated userData and shell configuration; not an OS or network sandbox.' }
const save = () => writeJson(path.join(run.directory, 'result.json'), result)
save()
console.log('Packaged workflow evidence: ' + run.directory)
const output = path.join(run.directory, 'playwright')
const log = fs.createWriteStream(path.join(run.directory, 'playwright.log'))
const project = path.resolve(__dirname, '../..')
const child = spawn(process.execPath, [path.join(project, 'node_modules/@playwright/test/cli.js'), 'test', 'e2e/executable-plan.spec.ts'], {
  cwd: project,
  env: { ...process.env, ZIAFORGE_E2E_PACKAGED_APP: bundle, ZIAFORGE_QA_OUTPUT: output, PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(run.directory, 'html') },
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout.on('data', bytes => { log.write(bytes); process.stdout.write(bytes) })
child.stderr.on('data', bytes => { log.write(bytes); process.stderr.write(bytes) })
child.on('error', error => { result.error = error.message })
child.on('close', (exitCode, signal) => {
  result.exitCode = exitCode; result.signal = signal
  result.bundleAfter = bundleInventory(bundle).digest
  result.bundleChanged = before !== result.bundleAfter
  result.sourceAtFinish = identity()
  result.sourceChangedDuringRun = result.sourceAtFinish.workingTreeSha256 !== run.manifest.source.workingTreeSha256
  const receipts = fs.existsSync(output) ? fs.readdirSync(output).map(directory => path.join(output, directory, 'result.json')).filter(filename => fs.existsSync(filename)) : []
  result.receipts = receipts.map(filename => ({ path: filename, ...JSON.parse(fs.readFileSync(filename, 'utf8')) }))
  const completedFile = receipts.length === 1 ? path.join(path.dirname(receipts[0]), 'completed-workflow.json') : undefined
  if (completedFile && fs.existsSync(completedFile)) {
    const workflow = JSON.parse(fs.readFileSync(completedFile, 'utf8'))
    result.workflow = { status: workflow.status, iterations: workflow.iterations, steps: workflow.steps.map(step => ({ status: step.status, failures: step.failures, attempts: step.attempts.length })) }
    result.verifications = workflow.steps.flatMap(step => step.attempts.flatMap(attempt => attempt.verification.map(receipt => ({ status: receipt.status, exitCode: receipt.exitCode, cleanupVerified: receipt.cleanupVerified, stdoutPath: receipt.stdoutPath, stderrPath: receipt.stderrPath }))))
  }
  const commandsVerified = result.workflow?.status === 'completed' && result.verifications?.length === 5 &&
    result.verifications[0].status === 'failed' && result.verifications[0].exitCode === 1 &&
    result.verifications.slice(1).every(receipt => receipt.status === 'passed' && receipt.exitCode === 0 && receipt.cleanupVerified)
  result.status = !result.error && exitCode === 0 && commandsVerified && !result.bundleChanged && !result.sourceChangedDuringRun && result.receipts.length === 1 && result.receipts.every(receipt => receipt.status === 'passed' && receipt.packagedRuntimes?.length === 2 && !receipt.bundleChanged && receipt.cleanup?.signals?.length === 0) ? 'passed' : 'failed'
  result.finishedAt = new Date().toISOString(); save(); log.end()
  console.log(JSON.stringify({ status: result.status, bundleChanged: result.bundleChanged, evidence: run.directory }))
  process.exitCode = result.status === 'passed' ? 0 : 1
})
