import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { runVersionProbe, shutdownVersionProbes } from '../VersionProbe'

it('cancels an in-flight version probe on quit and rejects every later launch', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-version-quit-test-')))
  const binary = path.join(directory, 'cli')
  const script = path.join(directory, 'version.cjs')
  const pidFile = path.join(directory, 'pid')
  const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'"
  fs.writeFileSync(script, `process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`)
  fs.writeFileSync(binary, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(script)} "$@"\n`, { mode: 0o700 })
  let pid: number | undefined
  let outcome: Promise<string | Error> | undefined
  let diagnosticDirectory: string | undefined
  try {
    outcome = runVersionProbe(binary, { ...process.env }, { timeoutMs: 30000 }).catch(error => { diagnosticDirectory = error.diagnosticDirectory; return error as Error })
    await vi.waitFor(() => expect(fs.existsSync(pidFile)).toBe(true), { timeout: 15000 })
    pid = Number(fs.readFileSync(pidFile, 'utf8'))
    expect(pid).toBeGreaterThan(100)
    expect(() => process.kill(pid!, 0)).not.toThrow()
    const started = Date.now()
    await shutdownVersionProbes()
    expect(Date.now() - started).toBeLessThan(10000)
    expect(await outcome).toMatchObject({ message: expect.stringContaining('CLI version check cancelled; diagnostics: ') })
    expect(JSON.parse(fs.readFileSync(path.join(diagnosticDirectory!, 'failure.json'), 'utf8'))).toMatchObject({ receiptStatus: 'cancelled', disposal: { status: 'completed' } })
    expect(() => process.kill(pid!, 0)).toThrow()
    await expect(runVersionProbe(binary, { ...process.env })).rejects.toThrow('shutting down')
  } finally {
    await shutdownVersionProbes()
    await outcome
    if (pid) { try { process.kill(pid, 'SIGKILL') } catch { /* Already stopped. */ } }
    fs.rmSync(directory, { recursive: true, force: true })
    if (diagnosticDirectory) fs.rmSync(diagnosticDirectory, { recursive: true, force: true })
  }
}, 30000)
