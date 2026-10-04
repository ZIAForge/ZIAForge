import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runVersionProbe } from '../VersionProbe'

const directories: string[] = []
const survivors = new Set<number>()
const operations = new Set<Promise<string>>()
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'"
afterEach(async () => {
  await Promise.allSettled([...operations])
  operations.clear()
  for (const pid of survivors) { try { process.kill(pid, 'SIGKILL') } catch { /* Already stopped. */ } }
  survivors.clear()
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})
function run(binary: string, timeoutMs = 15000) {
  const operation = runVersionProbe(binary, { ...process.env }, { timeoutMs })
  operations.add(operation)
  void operation.catch(error => { if (typeof error.diagnosticDirectory === 'string') directories.push(error.diagnosticDirectory) })
  // A failed readiness assertion still leaves a handled, awaited cleanup operation.
  void operation.catch(() => {})
  return operation
}
function fixture(source: (directory: string) => string) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-version-test-')))
  directories.push(directory)
  const script = path.join(directory, 'version.cjs')
  const binary = path.join(directory, 'cli')
  fs.writeFileSync(script, source(directory))
  fs.writeFileSync(binary, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(script)} "$@"\n`, { mode: 0o700 })
  return { binary, directory }
}
function stopped(pid: number): boolean {
  try { process.kill(pid, 0); return false } catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH' }
}

describe('bounded version process ownership', () => {
  it('runs only --version, preserves HOME, and drains successful output', async () => {
    const { binary } = fixture(() => `if(process.argv[2]!=='--version'||process.env.HOME!==${JSON.stringify(process.env.HOME)})process.exit(3);process.stdout.write('codex-cli 0.153.4\\n')`)
    expect(await run(binary)).toBe('codex-cli 0.153.4\n')
  }, 25000)

  it('times out a version command that ignores SIGTERM and confirms it is gone before rejecting', async () => {
    const { binary, directory } = fixture(directory => `process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(path.join(directory, 'pid'))},String(process.pid));setInterval(()=>{},1000)`)
    const deadlineMs = 31337
    const realSetTimeout = globalThis.setTimeout
    let expire: (() => void) | undefined
    // Trigger only the product deadline after the real command has started.
    // All process, signal, pipe-drain and cleanup timers retain real time.
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay, ...args) => {
      const handle = realSetTimeout(callback, delay, ...args)
      if (delay === deadlineMs) expire = () => { clearTimeout(handle); callback(...args) }
      return handle
    })
    const operation = run(binary, deadlineMs)
    try {
      const filename = path.join(directory, 'pid')
      await vi.waitFor(() => expect(fs.existsSync(filename)).toBe(true), { timeout: 15000 })
      const pid = Number(fs.readFileSync(filename, 'utf8'))
      survivors.add(pid)
      expect(pid).toBeGreaterThan(100)
      expect(stopped(pid)).toBe(false)
      expect(expire).toBeTypeOf('function')
      const started = Date.now()
      expire!()
      await expect(operation).rejects.toThrow('timed_out')
      expect(Date.now() - started).toBeLessThan(10000)
      expect(stopped(pid)).toBe(true)
      survivors.delete(pid)
    } finally {
      expire?.()
      timer.mockRestore()
      await operation.catch(() => {})
    }
  }, 30000)

  it('cleans an orphan holding inherited output pipes after its version parent exits successfully', async () => {
    const { binary, directory } = fixture(directory => {
      const descendant = "process.on('SIGTERM',()=>{});process.send('ready');setInterval(()=>{},1000)"
      return `const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:['ignore','inherit','inherit','ipc']});child.on('message',()=>{fs.writeFileSync(${JSON.stringify(path.join(directory, 'pid'))},String(child.pid));process.stdout.write('codex-cli 0.153.4\\n',()=>process.exit(0))})`
    })
    expect(await run(binary)).toBe('codex-cli 0.153.4\n')
    const pid = Number(fs.readFileSync(path.join(directory, 'pid'), 'utf8'))
    survivors.add(pid)
    expect(stopped(pid)).toBe(true)
    survivors.delete(pid)
  }, 25000)
})
