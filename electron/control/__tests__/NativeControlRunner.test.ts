import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { NativeControlRunner } from '../NativeControlRunner'

function absent(pid: number): boolean {
  try { process.kill(pid, 0); return false } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true
    throw error
  }
}

it('disposes an active native command and its descendant, preserves HOME and rejects invalid cwd without fallback', async () => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ziaf-native-control-'))
  const cwd = path.join(root, 'settings'), storage = path.join(cwd, 'native-control'), ready = path.join(root, 'ready.json')
  fs.mkdirSync(cwd)
  const runner = new NativeControlRunner({ directory: storage, defaultCwd: cwd, env: { ...process.env } })
  try {
    await expect(runner.run({ command: process.execPath, args: ['-e', 'process.exit(99)'], cwd: path.join(root, 'missing') })).rejects.toThrow(/ENOENT/)
    await expect(runner.run({ command: process.execPath, args: [], cwd: '.' })).rejects.toThrow(/absolute directory/)
    expect(fs.readdirSync(storage)).toEqual([])
    const descendant = `process.on('SIGTERM',()=>{});process.send({pid:process.pid,cwd:process.cwd(),home:process.env.HOME});setInterval(()=>{},1000)`
    const script = `const fs=require('node:fs');const child=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:['ignore','ignore','ignore','ipc']});child.once('message',data=>fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({pid:process.pid,cwd:process.cwd(),home:process.env.HOME,child:data})));setInterval(()=>{},1000)`
    // Attach rejection handling before disposal so cancellation is owned too.
    const result = runner.run({ command: process.execPath, args: ['-e', script] }).then(value => ({ value }), error => ({ error: error as Error }))
    const deadline = Date.now() + 10_000
    while (!fs.existsSync(ready) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
    expect(fs.existsSync(ready)).toBe(true)
    const observed = JSON.parse(fs.readFileSync(ready, 'utf8')) as { pid: number; cwd: string; home?: string; child: { pid: number; cwd: string; home?: string } }
    expect(observed).toMatchObject({ cwd, home: process.env.HOME, child: { cwd, home: process.env.HOME } })
    expect(absent(observed.pid)).toBe(false)
    expect(absent(observed.child.pid)).toBe(false)
    await runner.dispose()
    expect(await result).toMatchObject({ error: expect.objectContaining({ message: expect.stringContaining('Native command cancelled') }) })
    expect(absent(observed.pid)).toBe(true)
    expect(absent(observed.child.pid)).toBe(true)
    const receipts = fs.readdirSync(storage)
    expect(receipts).toHaveLength(1)
    expect(JSON.parse(fs.readFileSync(path.join(storage, receipts[0], 'receipt.json'), 'utf8'))).toMatchObject({
      status: 'cancelled', cancelReason: 'Application shutdown', cleanupVerified: true, cwd, timeoutMs: 30_000, maxOutputBytes: 1024 * 1024,
    })
    await expect(runner.run({ command: process.execPath, args: [] })).rejects.toThrow(/shutting down/)
    expect(fs.readdirSync(storage)).toEqual(receipts)
  } finally {
    await runner.dispose()
    fs.rmSync(root, { recursive: true, force: true })
  }
}, 30_000)
