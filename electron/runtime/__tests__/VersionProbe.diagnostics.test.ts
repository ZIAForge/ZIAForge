import fs from 'node:fs'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { VerificationRunner, type VerificationReceipt } from '../../workflow/VerificationRunner'
import { runVersionProbe } from '../VersionProbe'

const retained: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of retained.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

function receiptFixture(status: VerificationReceipt['status']) {
  let directory = ''
  let original = ''
  vi.spyOn(VerificationRunner.prototype, 'run').mockImplementation(async request => {
    directory = request.cwd; retained.push(directory)
    const version = path.join(directory, 'version'); fs.mkdirSync(version, { mode: 0o700 })
    const receipt: VerificationReceipt = {
      schemaVersion: 1, verificationId: 'version', command: request.command, cwd: directory,
      resolvedExecutable: request.command.executable, fingerprint: 'fixture', startedAt: '2026-09-30T00:00:00.000Z',
      finishedAt: '2026-09-30T00:00:01.000Z', status, exitCode: 0, signal: null,
      stdoutPath: path.join(version, 'stdout.log'), stderrPath: path.join(version, 'stderr.log'),
      stdoutBytes: 20, stderrBytes: 0, outputTruncated: false, timeoutMs: 5000, maxOutputBytes: 16384,
      cleanupVerified: status === 'passed', cancelled: false,
      ...(status === 'cleanup_failed' ? { error: 'Cleanup failed: Verification owned process cleanup is unresolved; tracked PIDs: 12345' } : {}),
    }
    fs.writeFileSync(receipt.stdoutPath, 'codex-cli 0.153.4\n', { mode: 0o600 })
    fs.writeFileSync(receipt.stderrPath, '', { mode: 0o600 })
    original = JSON.stringify(receipt)
    fs.writeFileSync(path.join(version, 'receipt.json'), original, { mode: 0o600 })
    return receipt
  })
  return { directory: () => directory, original: () => original }
}

it.each([false, true])('retains the initial failed receipt and concrete error even when dispose fails=%s', async disposeFails => {
  const fixture = receiptFixture('cleanup_failed')
  const dispose = vi.spyOn(VerificationRunner.prototype, 'dispose')
  if (disposeFails) dispose.mockRejectedValue(new Error('Verification shutdown could not confirm cleanup'))
  else dispose.mockResolvedValue()
  const error = await runVersionProbe(process.execPath, { ...process.env }).catch(value => value as Error & { diagnosticDirectory: string })
  expect(error).toBeInstanceOf(Error)
  expect(error).toMatchObject({ diagnosticDirectory: fixture.directory(), message: expect.stringContaining('tracked PIDs: 12345') })
  expect((error as Error).message).toContain(`diagnostics: ${fixture.directory()}`)
  const failurePath = path.join(fixture.directory(), 'failure.json')
  const failure = JSON.parse(fs.readFileSync(failurePath, 'utf8'))
  expect(failure).toMatchObject({ operation: 'CLI --version', receiptStatus: 'cleanup_failed', cleanupVerified: false,
    disposal: disposeFails ? { status: 'failed', error: 'Verification shutdown could not confirm cleanup' } : { status: 'completed' } })
  expect(fs.readFileSync(failure.receiptPath, 'utf8')).toBe(fixture.original())
  expect(fs.statSync(fixture.directory()).mode & 0o777).toBe(0o700)
  expect(fs.statSync(failurePath).mode & 0o777).toBe(0o600)
  expect(dispose).toHaveBeenCalledOnce()
})

it('removes successful version receipts only after disposal succeeds', async () => {
  const fixture = receiptFixture('passed')
  vi.spyOn(VerificationRunner.prototype, 'dispose').mockImplementation(async () => {
    expect(fs.existsSync(path.join(fixture.directory(), 'version', 'receipt.json'))).toBe(true)
  })
  await expect(runVersionProbe(process.execPath, { ...process.env })).resolves.toBe('codex-cli 0.153.4\n')
  expect(fs.existsSync(fixture.directory())).toBe(false)
})
