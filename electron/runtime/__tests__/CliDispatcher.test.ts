import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startCliDispatcher, validateDispatcherRequest } from '../CliDispatcher'

describe('local CLI workflow dispatcher', () => {
  let root: string
  let dispatcher: Awaited<ReturnType<typeof startCliDispatcher>> | undefined
  beforeEach(() => { root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-dispatch-test-'))) })
  afterEach(async () => { await dispatcher?.close(); dispatcher = undefined; fs.rmSync(root, { recursive: true, force: true }) })
  const call = (address: { socketPath: string; token: string }, request: unknown) => new Promise<{ ok: boolean; result?: unknown; error?: string }>((resolve, reject) => {
    const socket = net.connect(address.socketPath)
    let output = ''
    socket.setEncoding('utf8'); socket.on('data', chunk => { output += chunk }); socket.on('error', reject)
    socket.on('connect', () => socket.write(JSON.stringify({ token: address.token, request }) + '\n'))
    socket.on('end', () => { try { resolve(JSON.parse(output)) } catch (error) { reject(error) } })
  })
  it('authenticates a private owner endpoint and dispatches only the supported saved-task commands', async () => {
    const execute = vi.fn(async () => ({ status: 'running' }))
    dispatcher = await startCliDispatcher({ directory: root, execute })
    const file = path.join(root, 'endpoint.json')
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    const address = JSON.parse(fs.readFileSync(file, 'utf8'))
    const request = { command: 'start', taskId: 'task-1', commandId: 'command-1', untilSuccess: true }
    expect(await call(address, request)).toEqual({ ok: true, result: { status: 'running' } })
    expect(execute).toHaveBeenCalledWith(request)
    expect((await call({ ...address, token: 'wrong' }, request)).ok).toBe(false)
    expect((await call(address, { ...request, cwd: '/private' })).ok).toBe(false)
    expect((await call(address, { command: 'exec', taskId: 'task-1' })).ok).toBe(false)
    expect(execute).toHaveBeenCalledTimes(1)
    await dispatcher.close(); dispatcher = undefined
    expect(fs.existsSync(file)).toBe(false)
    expect(fs.existsSync(address.socketPath)).toBe(false)
  })
  it('uses a short private socket even when the application temp profile has a long path', async () => {
    const longPath = path.join(root, 'x'.repeat(100), 'y'.repeat(100))
    fs.mkdirSync(longPath, { recursive: true })
    const temp = vi.spyOn(os, 'tmpdir').mockReturnValue(longPath)
    try {
      dispatcher = await startCliDispatcher({ directory: root, execute: async () => 'ready' })
      const address = JSON.parse(fs.readFileSync(path.join(root, 'endpoint.json'), 'utf8'))
      expect(Buffer.byteLength(address.socketPath)).toBeLessThan(104)
      expect(fs.statSync(path.dirname(address.socketPath)).mode & 0o777).toBe(0o700)
      expect((await call(address, { command: 'list' })).ok).toBe(true)
    } finally { temp.mockRestore() }
  })
  it('retains a newer endpoint on shutdown and reports execution failures as failures', async () => {
    dispatcher = await startCliDispatcher({ directory: root, execute: async () => { throw new Error('Step blocked by review') } })
    const file = path.join(root, 'endpoint.json')
    const address = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(await call(address, { command: 'status', taskId: 'task-1' })).toEqual({ ok: false, error: 'Step blocked by review' })
    fs.writeFileSync(file, JSON.stringify({ token: 'new-owner' }))
    await dispatcher.close(); dispatcher = undefined
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ token: 'new-owner' })
  })
  it('refuses paths, missing command identities and policy overrides on read requests', () => {
    for (const request of [{ command: 'status', taskId: '../escape' }, { command: 'start', taskId: 'task' }, { command: 'status', taskId: 'task', untilSuccess: true }, { command: 'start', taskId: 'task', commandId: 'id', maxFailures: 999 }]) expect(() => validateDispatcherRequest(request)).toThrow()
  })
})
