import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VerificationRunner, type VerificationRequest } from '../VerificationRunner'
import { ProcessSupervisor } from '../../runtime/ProcessSupervisor'

let directory: string
let cwd: string
let storage: string
const runners: VerificationRunner[] = []
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ziaf-verify-'))
  cwd = path.join(directory, 'work'); storage = path.join(directory, 'receipts')
  fs.mkdirSync(cwd)
})
afterEach(async () => {
  await Promise.all(runners.splice(0).map(runner => runner.dispose().catch(() => {})))
  vi.restoreAllMocks()
  fs.rmSync(directory, { recursive: true, force: true })
}, 15_000)
const setup = (options: Partial<ConstructorParameters<typeof VerificationRunner>[0]> = {}) => {
  // These are OS-process tests, running alongside the full parallel unit suite.
  // Only the dedicated deadline test should expire a healthy child at startup.
  const runner = new VerificationRunner({ directory: storage, timeoutMs: 15_000, ...options })
  runners.push(runner); return runner
}
const request = (id: string, script: string, extra: Partial<VerificationRequest> = {}): VerificationRequest => ({
  verificationId: id, cwd, command: { executable: process.execPath, args: ['-e', script] }, inputFingerprint: 'tree-version-one', ...extra,
})
async function until(check: () => boolean, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)) }
  throw new Error('Timed out waiting for verification command')
}
function output(id: string) {
  try { return fs.readFileSync(path.join(storage, id, 'stdout.log'), 'utf8') } catch { return '' }
}
function absent(pid: number) {
  try { process.kill(pid, 0); return false } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; throw error }
}
const keepAlive = `process.stdout.write(String(process.pid)+'\\n');setInterval(()=>{},1000)`
async function readyPid(id: string) {
  // A complete child-written record proves command execution, not just wrapper
  // creation. Never issue cancellation based on a startup sleep or partial PID.
  await until(() => /^\d+\n$/.test(output(id)))
  const pid = Number(output(id))
  expect(pid).toBeGreaterThan(100)
  expect(absent(pid)).toBe(false)
  return pid
}

describe('VerificationRunner executes explicit commands and persists evidence', { timeout: 30_000 }, () => {
  it('writes the request before command execution, retains argv literally, and publishes a private immutable success receipt', async () => {
    const runner = setup()
    const requestPath = path.join(storage, 'pass', 'request.json')
    const literal = 'hello; echo SHOULD_NOT_EXECUTE 🌍'
    const script = `const fs=require('fs');if(!fs.existsSync(process.argv[1]))process.exit(9);process.stdout.write(process.argv[2]);process.stderr.write('diagnostic')`
    const input = request('pass', script, { command: { executable: process.execPath, args: ['-e', script, requestPath, literal] } })
    const receipt = await runner.run(input)
    expect(receipt).toMatchObject({ status: 'passed', exitCode: 0, signal: null, cleanupVerified: true, cancelled: false, outputTruncated: false, cwd })
    expect(fs.readFileSync(receipt.stdoutPath, 'utf8')).toBe(literal)
    expect(fs.readFileSync(receipt.stderrPath, 'utf8')).toBe('diagnostic')
    expect(receipt.command).toEqual(input.command)
    expect(receipt.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    const file = path.join(storage, 'pass', 'receipt.json')
    const bytes = fs.readFileSync(file, 'utf8')
    expect(JSON.parse(bytes)).toEqual(receipt)
    for (const filename of [file, requestPath, receipt.stdoutPath, receipt.stderrPath]) expect(fs.statSync(filename).mode & 0o777).toBe(0o600)
    await expect(runner.run(input)).rejects.toThrow(/exist/i)
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes)
  })

  it('uses the actual nonzero exit status even when command output claims success', async () => {
    const receipt = await setup().run(request('failure', `process.stdout.write('All tests passed');process.stderr.write('actual failure');process.exitCode=17`))
    expect(receipt).toMatchObject({ status: 'failed', exitCode: 17, cleanupVerified: true })
    expect(fs.readFileSync(receipt.stdoutPath, 'utf8')).toBe('All tests passed')
  })

  it('persists the concrete unresolved cleanup error without converting later disposal into an initial success', async () => {
    const supervisor = new ProcessSupervisor()
    vi.spyOn(supervisor, 'terminateProcessTree').mockResolvedValueOnce(false)
    const runner = setup({ supervisor })
    const receipt = await runner.run(request('cleanup-diagnostic', `process.stdout.write('version completed')`))
    expect(receipt).toMatchObject({ status: 'cleanup_failed', exitCode: 0, cleanupVerified: false })
    expect(receipt.error).toMatch(/Cleanup failed: Verification owned process cleanup is unresolved for supervisor \d+; tracked PIDs: \d+/)
    const filename = path.join(storage, 'cleanup-diagnostic', 'receipt.json')
    const original = fs.readFileSync(filename, 'utf8')
    expect(JSON.parse(original).error).toBe(receipt.error)
    await expect(runner.dispose()).resolves.toBeUndefined()
    expect(fs.readFileSync(filename, 'utf8')).toBe(original)
  })

  it('times out a running command and confirms process-tree cleanup', async () => {
    const running = setup().run(request('timeout', keepAlive, { timeoutMs: 10_000 }))
    const pid = await readyPid('timeout')
    const receipt = await running
    expect(receipt).toMatchObject({ status: 'timed_out', timeoutMs: 10_000, cleanupVerified: true, cancelled: false })
    await until(() => absent(pid))
  })

  it('bounds combined stdout/stderr bytes and ends an output flood', async () => {
    const receipt = await setup({ maxOutputBytes: 512 }).run(request('flood', `process.stdout.write('a'.repeat(65536));process.stderr.write('b'.repeat(65536));setInterval(()=>{},1000)`))
    expect(receipt).toMatchObject({ status: 'output_limit', outputTruncated: true, cleanupVerified: true })
    expect(receipt.stdoutBytes + receipt.stderrBytes).toBe(512)
    expect(fs.statSync(receipt.stdoutPath).size + fs.statSync(receipt.stderrPath).size).toBe(512)
  })

  it('cancels through AbortSignal and does not spawn for an already cancelled input', async () => {
    const runner = setup()
    const aborted = new AbortController(); aborted.abort()
    const skipped = await runner.run(request('preabort', `process.stdout.write('must not run')`), aborted.signal)
    expect(skipped).toMatchObject({ status: 'cancelled', cancelled: true, cleanupVerified: true, stdoutBytes: 0 })
    const controller = new AbortController()
    const running = runner.run(request('abort', keepAlive), controller.signal)
    const pid = await readyPid('abort')
    controller.abort()
    expect(await running).toMatchObject({ status: 'cancelled', cancelled: true, cancelReason: 'Aborted by caller', cleanupVerified: true })
    await until(() => absent(pid))
  })

  it('waits for owned cleanup on explicit cancel and shutdown and prevents later runs', async () => {
    const runner = setup()
    const first = runner.run(request('cancel', keepAlive))
    const firstPid = await readyPid('cancel')
    await runner.cancel('cancel', 'User stopped workflow')
    expect(await first).toMatchObject({ status: 'cancelled', cancelReason: 'User stopped workflow', cleanupVerified: true })
    expect(absent(firstPid)).toBe(true)
    const second = runner.run(request('quit', keepAlive))
    const secondPid = await readyPid('quit')
    await runner.dispose()
    expect(await second).toMatchObject({ status: 'cancelled', cancelReason: 'Application shutdown', cleanupVerified: true })
    expect(absent(secondPid)).toBe(true)
    await expect(runner.run(request('late', ''))).rejects.toThrow(/shutting down/)
  })

  it('cleans an immediate orphan after the successful parent exits, including a child ignoring SIGTERM', async () => {
    const runner = setup({ killGraceMs: 50 })
    const orphan = `process.on('SIGTERM',()=>{});process.send('ready');setInterval(()=>{},1000)`
    const script = `const {spawn}=require('child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(orphan)}],{stdio:['ignore','ignore','ignore','ipc']});child.once('message',()=>process.stdout.write(String(child.pid),()=>process.exit(0)))`
    const receipt = await runner.run(request('orphan', script))
    expect(receipt).toMatchObject({ status: 'passed', exitCode: 0, cleanupVerified: true })
    const pid = Number(output('orphan'))
    expect(pid).toBeGreaterThan(100)
    await until(() => absent(pid))
  })

  it('rejects relative executable, noncanonical cwd and unsafe storage identities without execution', async () => {
    const runner = setup()
    await expect(runner.run(request('relative', '', { command: { executable: 'node', args: [] } }))).rejects.toThrow(/explicit executable/)
    const link = path.join(directory, 'link'); fs.symlinkSync(cwd, link)
    await expect(runner.run(request('linked', '', { cwd: link }))).rejects.toThrow(/canonical/)
    await expect(runner.run(request('../outside', ''))).rejects.toThrow(/identity/)
    expect(fs.readdirSync(storage)).toEqual([])
  })

  it('revalidates the authorized directory after durable input publication and before spawn', async () => {
    const runner = setup()
    const original = fs.promises.link.bind(fs.promises)
    const outside = path.join(directory, 'outside'); fs.mkdirSync(outside)
    vi.spyOn(fs.promises, 'link').mockImplementationOnce(async (from, to) => {
      await original(from, to)
      fs.renameSync(cwd, cwd + '-original'); fs.symlinkSync(outside, cwd)
    })
    const receipt = await runner.run(request('swapped', `require('fs').writeFileSync('escape','bad')`))
    expect(receipt).toMatchObject({ status: 'failed', cleanupVerified: true, exitCode: null })
    expect(receipt.error).toMatch(/directory changed/)
    expect(fs.existsSync(path.join(outside, 'escape'))).toBe(false)
  })

  it('fingerprints explicit input revisions and preserves the caller environment only for the tested command', async () => {
    const preload = path.join(directory, 'preload.cjs')
    const touched = path.join(directory, 'preloaded')
    fs.writeFileSync(preload, `require('fs').appendFileSync(${JSON.stringify(touched)},String(process.pid)+String.fromCharCode(10))`)
    const runner = setup({ env: { ...process.env, NODE_OPTIONS: '--require=' + preload } })
    const script = `process.stdout.write(JSON.stringify({pid:process.pid,home:process.env.HOME,runAsNode:process.env.ELECTRON_RUN_AS_NODE??null}))`
    const first = await runner.run(request('env-one', script))
    const second = await runner.run(request('env-two', script, { inputFingerprint: 'tree-version-two' }))
    expect(first.status).toBe('passed')
    expect(second.status).toBe('passed')
    expect(first.fingerprint).not.toBe(second.fingerprint)
    const actual = JSON.parse(output('env-one'))
    expect(actual).toMatchObject({ home: process.env.HOME, runAsNode: null })
    expect(fs.readFileSync(touched, 'utf8').trim().split('\n').map(Number)).toEqual([actual.pid, JSON.parse(output('env-two')).pid])
  })
})
