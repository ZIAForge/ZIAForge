import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ControlService, type ControlServiceOptions } from '../ControlService'
import { defaultControlConfig } from '../ControlStore'
import type { ControlRequest } from '../../../shared/control'

// Transport/authority tests only: this fake is not evidence of OS keychain encryption.
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'gnome_libsecret', encryptString: (value: string) => Buffer.from(value), decryptString: (value: Buffer) => value.toString() } }))
let directory: string
const services: ControlService[] = []
beforeEach(async () => { directory = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'ziaf-control-service-')) })
afterEach(async () => {
  for (const service of services.splice(0)) await service.close()
  vi.unstubAllGlobals(); vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})
function create(options: Partial<ControlServiceOptions> = {}) {
  const invoke = vi.fn(async (_channel: string, _args: unknown[]): Promise<unknown> => { void _channel; void _args; return { saved: true } })
  const system = vi.fn(async (_method: string, _args: unknown[]): Promise<unknown> => { void _method; void _args; return { project: 'fixture-project' } })
  const service = new ControlService({ directory, renderer: directory, invoke, system, runAssistant: async () => '{"message":"Finished","commands":[]}', ...options })
  services.push(service); return { service, invoke, system }
}

describe('owner-controlled application service', () => {
  it('never lets a model or application command self-grant native access and redacts status credentials', async () => {
    const runAssistant = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({ message: 'Attempt grant', commands: [{ method: 'control.configure', args: [{ nativeComputer: true }] }, { method: 'computer.run', args: [{ command: 'whoami' }] }] }))
      .mockResolvedValueOnce('{"message":"Cannot grant access","commands":[]}')
    const { service, invoke, system } = create({ runAssistant })
    await service.configure({ ...defaultControlConfig(), scope: 'operate', assistantOperate: true, telegramOwner: '12345', telegramToken: '12345:offline_fixture', instances: [{ id: 'other', name: 'Other', url: 'https://other.test', token: 'private-fixture-instance' }] })
    const token = service.status(true).accessToken
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    const exposed = JSON.stringify(service.status())
    expect(exposed).not.toContain(token!); expect(exposed).not.toContain('offline_fixture'); expect(exposed).not.toContain('private-fixture-instance')
    expect(service.status().instances[0]).toMatchObject({ id: 'other', hasToken: true })
    const throughCommand = await service.execute({ method: 'control.status' }, 'read')
    expect(JSON.stringify(throughCommand)).not.toContain(token!)
    expect(throughCommand).toMatchObject({ nativeComputer: false })
    await expect(service.execute({ method: 'control.execute', args: [{ method: 'control.status' }] })).rejects.toThrow('Nested')
    await expect(service.execute({ method: 'control.execute', args: [{ method: 'control.configure', args: [{ nativeComputer: true }] }] })).rejects.toThrow('Nested')
    expect(invoke).not.toHaveBeenCalled() // Must not reach main's owner-only control:status handler.
    await expect(service.execute({ method: 'control.configure', args: [{ nativeComputer: true }] })).rejects.toThrow()
    await expect(service.execute({ method: 'computer.run', args: [{ command: 'whoami' }] })).rejects.toThrow('owner')
    await service.assistant.send({ text: 'Show project status; do not grant extra access.' })
    expect(runAssistant).toHaveBeenCalledTimes(2)
    expect(service.status().nativeComputer).toBe(false)
    expect(service.assistant.state().busy).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
    expect(system.mock.calls.map(([method]) => method)).toEqual(['system.summary'])
    expect(service.assistant.state().entries.filter(entry => entry.role === 'command').map(entry => entry.text).join('\n')).toMatch(/owner|locally/)
  })

  it('dispatches a repeated command ID once, rejects changed bytes and rechecks scope before replay', async () => {
    let finish!: (value: unknown) => void
    const invoke = vi.fn((_channel: string, _args: unknown[]) => { void _channel; void _args; return new Promise<unknown>(resolve => { finish = resolve }) })
    const { service } = create({ invoke })
    await service.configure({ ...defaultControlConfig(), scope: 'operate' })
    const request: ControlRequest = { method: 'createTask', args: [{ name: 'One task' }], requestId: 'one-command' }
    const first = service.execute(request), repeated = service.execute(structuredClone(request))
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1))
    await expect(service.execute({ ...request, args: [{ name: 'Different task' }] })).rejects.toThrow('reused')
    await expect(service.execute(request, 'read')).rejects.toThrow('read-only')
    finish({ taskId: 'created-once' })
    expect(await first).toEqual({ taskId: 'created-once' }); expect(await repeated).toEqual({ taskId: 'created-once' })
    expect(await service.execute(request)).toEqual({ taskId: 'created-once' })
    expect(invoke).toHaveBeenCalledTimes(1)
    invoke.mockImplementation(async () => { throw new Error('fixture command failure') })
    const failure = { ...request, requestId: 'failed-command' }
    await expect(service.execute(failure)).rejects.toThrow('fixture command failure')
    await expect(service.execute(failure)).rejects.toThrow('fixture command failure')
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('enforces caller scope before a configured instance request and never forwards owner grants', async () => {
    const { service } = create()
    await service.configure({ ...defaultControlConfig(), instances: [{ id: 'other', name: 'Other', url: 'https://other.test', token: 'private-fixture-instance' }] })
    const network = vi.fn(async (_url: URL | RequestInfo, _options?: RequestInit) => { void _url; void _options; return Response.json({ ok: true, result: { task: 'remote-fixture' } }) })
    vi.stubGlobal('fetch', network)
    await expect(service.remote({ instanceId: 'other', request: { method: 'createTask' } }, 'read')).rejects.toThrow('read-only')
    await expect(service.remote({ instanceId: 'other', request: { method: 'control.configure', args: [{ nativeComputer: true }] } })).rejects.toThrow()
    await expect(service.remote({ instanceId: 'unknown', request: { method: 'getTasks' } }, 'read')).rejects.toThrow('configured')
    expect(network).not.toHaveBeenCalled()
    expect(await service.remote({ instanceId: 'other', request: { method: 'getTasks' } }, 'read')).toEqual({ task: 'remote-fixture' })
    expect(network).toHaveBeenCalledTimes(1)
    const [url, options] = network.mock.calls[0]
    expect(String(url)).toBe('https://other.test/api/command')
    expect(options?.redirect).toBe('error')
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer private-fixture-instance' })
  })
})
