import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http, { type Server, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoteServer } from '../RemoteServer'
import type { ControlConfig, ControlRequest } from '../../../shared/control'

const token = 'offline-test-token-never-a-user-credential'
const config: ControlConfig = { enabled: true, host: '127.0.0.1', port: 0, scope: 'operate', nativeComputer: false, assistantPreset: '', assistantOperate: false, telegramEnabled: false, telegramOwner: '', instances: [] }
interface Reply { status: number; headers: IncomingHttpHeaders; text: string }
let directory: string, renderer: string
const servers: RemoteServer[] = []
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'ziaf-control-http-'))
  renderer = path.join(directory, 'renderer'); await fs.mkdir(renderer)
  await fs.writeFile(path.join(renderer, 'index.html'), '<html><head></head><body>fixture renderer</body></html>')
  await fs.writeFile(path.join(renderer, 'app.js'), 'window.fixture = true')
})
afterEach(async () => {
  vi.restoreAllMocks()
  for (const server of servers.splice(0)) await server.close()
  await fs.rm(directory, { recursive: true, force: true })
})
async function start(execute = vi.fn(async (_request: ControlRequest): Promise<unknown> => { void _request; return { task: 'fixture-task' } }), options: Partial<Pick<ConstructorParameters<typeof RemoteServer>[0], 'token' | 'instanceEvents'>> = {}) {
  const server = new RemoteServer({ config, token, renderer, execute, ...options })
  servers.push(server); await server.start()
  // Port zero is used only by this loopback transport fixture; no desktop app or provider is started.
  const port = ((server as unknown as { server: Server }).server.address() as AddressInfo).port
  return { server, execute, origin: `http://127.0.0.1:${port}` }
}
function request(origin: string, route: string, body?: unknown, headers: Record<string, string> = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${origin}${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers } }, res => {
      const parts: Buffer[] = []; res.on('data', part => parts.push(Buffer.from(part)))
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, text: Buffer.concat(parts).toString('utf8') })); res.on('error', reject)
    })
    req.setTimeout(3000, () => req.destroy(new Error('Loopback fixture request timed out')))
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body))
  })
}
const bearer = { Authorization: `Bearer ${token}` }

describe('authenticated renderer transport', () => {
  it('isolates instance SSE, reserves pending proxies and closes every browser/upstream connection before token rotation', async () => {
    const remote = await start()
    let upstreamSignal: AbortSignal | undefined
    const pendingSignals: AbortSignal[] = []
    const local = await start(undefined, { instanceEvents: async (id, signal) => {
      if (id.startsWith('pending-')) {
        pendingSignals.push(signal)
        return new Promise<ReadableStream<Uint8Array>>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Upstream cancelled')), { once: true })
        })
      }
      expect(id).toBe('instance-b'); upstreamSignal = signal
      const response = await fetch(`${remote.origin}/api/events`, { headers: bearer, signal })
      expect(response.status).toBe(200)
      return response.body!
    } })
    const login = await request(local.origin, '/api/login', { token }, { Origin: local.origin })
    const Cookie = login.headers['set-cookie']![0].split(';')[0]
    const clients: { text: string; closed: boolean; req: http.ClientRequest }[] = []
    const openStream = (route: string) => {
      const state = { text: '', closed: false, req: undefined as unknown as http.ClientRequest }
      state.req = http.get(`${local.origin}${route}`, { headers: { Cookie } }, res => {
        res.on('data', data => { state.text += data.toString() })
        res.on('error', () => { state.closed = true })
        res.on('close', () => { state.closed = true })
      })
      state.req.on('error', () => { state.closed = true })
      state.req.on('close', () => { state.closed = true })
      clients.push(state); return state
    }
    try {
      const own = openStream('/api/events'), proxied = openStream('/api/events?instance=instance-b')
      await vi.waitFor(() => { expect(own.text).toContain(': connected'); expect(proxied.text).toContain(': connected') })
      local.server.publish('status-update', { marker: 'local-A-only' })
      remote.server.publish('status-update', { marker: 'remote-B-only' })
      await vi.waitFor(() => { expect(own.text).toContain('local-A-only'); expect(proxied.text).toContain('remote-B-only') })
      expect(own.text).not.toContain('remote-B-only'); expect(proxied.text).not.toContain('local-A-only')
      // Thirty unresolved upstream handshakes plus the two live streams fill the same limit.
      for (let i = 0; i < 30; i++) openStream(`/api/events?instance=pending-${i}`)
      await vi.waitFor(() => expect(pendingSignals).toHaveLength(30))
      expect((await request(local.origin, '/api/events?instance=pending-overflow', undefined, { Cookie })).status).toBe(429)
      expect(pendingSignals).toHaveLength(30)
      expect(clients.every(client => !client.closed)).toBe(true)
      await local.server.close()
      await vi.waitFor(() => expect(clients.every(client => client.closed)).toBe(true))
      expect(upstreamSignal?.aborted).toBe(true); expect(pendingSignals.every(signal => signal.aborted)).toBe(true)
      // Closing A cancels its upstream subscription without stopping B itself.
      expect((await request(remote.origin, '/api/command', { method: 'getTasks' }, bearer)).status).toBe(200)
      const rotatedToken = 'rotated-offline-fixture-token'
      const rotated = await start(undefined, { token: rotatedToken })
      expect((await request(rotated.origin, '/api/events', undefined, { Cookie })).status).toBe(401)
      expect((await request(rotated.origin, '/api/events', undefined, bearer)).status).toBe(401)
      expect((await request(rotated.origin, '/api/login', { token: rotatedToken }, { Origin: rotated.origin })).status).toBe(200)
    } finally { for (const client of clients) client.req.destroy() }
  })

  it('gates commands, assets and events; cookie commands require same-origin browser proof', async () => {
    const { origin, execute } = await start()
    expect((await request(origin, '/')).text).toContain('Access token')
    for (const route of ['/index.html', '/app.js', '/remote-bridge.js', '/api/events']) expect((await request(origin, route)).status).toBe(401)
    expect((await request(origin, '/api/command', { method: 'getTasks' })).status).toBe(401)
    expect((await request(origin, '/api/command', { method: 'getTasks' }, { Authorization: 'Bearer wrong' })).status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
    const login = await request(origin, '/api/login', { token }, { Origin: origin })
    expect(login.status).toBe(200)
    const cookieHeader = login.headers['set-cookie']![0]
    expect(cookieHeader).toContain('HttpOnly'); expect(cookieHeader).toContain('SameSite=Strict')
    expect(cookieHeader).not.toContain(token)
    const Cookie = cookieHeader.split(';')[0]
    expect((await request(origin, '/api/command', { method: 'getTasks' }, { Cookie })).status).toBe(403)
    expect((await request(origin, '/api/command', { method: 'getTasks' }, { Cookie, Origin: 'http://hostile.test' })).status).toBe(403)
    expect((await request(origin, '/api/command', { method: 'getTasks' }, { ...bearer, Origin: 'http://hostile.test' })).status).toBe(403)
    expect(execute).not.toHaveBeenCalled()
    expect((await request(origin, '/api/command', { method: 'getTasks' }, { Cookie, Origin: origin })).status).toBe(200)
    expect((await request(origin, '/api/command', { method: 'getTasks' }, bearer)).status).toBe(200)
    expect(execute).toHaveBeenCalledTimes(2)
    const actualNow = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(actualNow + 13 * 60 * 60 * 1000)
    expect((await request(origin, '/api/command', { method: 'getTasks' }, { Cookie, Origin: origin })).status).toBe(401)
  })

  it('serves only canonical renderer files and rejects encoded traversal or external symlinks', async () => {
    await fs.writeFile(path.join(directory, 'outside.txt'), 'PRIVATE_OUTSIDE_BYTES')
    await fs.symlink(path.join(directory, 'outside.txt'), path.join(renderer, 'escaped.txt'))
    const { origin } = await start()
    const index = await request(origin, '/', undefined, bearer)
    expect(index.status).toBe(200); expect(index.text).toContain('/remote-bridge.js')
    expect(index.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect((await request(origin, '/app.js', undefined, bearer)).text).toBe('window.fixture = true')
    for (const route of ['/escaped.txt', '/..%2foutside.txt', '/%2e%2e%2foutside.txt']) {
      const result = await request(origin, route, undefined, bearer)
      expect(result.status).toBe(404); expect(result.text).not.toContain('PRIVATE_OUTSIDE_BYTES')
    }
  })

  it('bounds unauthenticated login input and repeated bad credentials without dispatch', async () => {
    const { origin, execute } = await start()
    const oversized = await request(origin, '/api/login', { token, padding: 'x'.repeat(64 * 1024) })
    expect([400, 413]).toContain(oversized.status)
    for (let attempt = 0; attempt < 8; attempt++) expect((await request(origin, '/api/login', { token: 'wrong' })).status).toBe(401)
    expect((await request(origin, '/api/login', { token: 'wrong' })).status).toBe(429)
    expect(execute).not.toHaveBeenCalled()
  })

  it('refuses malformed command authority and bounds simultaneous accepted commands', async () => {
    const releases: (() => void)[] = []
    const execute = vi.fn((_request: ControlRequest): Promise<unknown> => { void _request; return new Promise(resolve => releases.push(() => resolve({ ok: true }))) })
    const { origin } = await start(execute)
    expect((await request(origin, '/api/command', { method: 'getTasks', nativeComputer: true }, bearer)).status).toBe(400)
    expect((await request(origin, '/api/command', { method: 'getTasks', args: [1, 2, 3, 4, 5] }, bearer)).status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
    const pending = Array.from({ length: 16 }, (_, i) => request(origin, '/api/command', { method: 'getTasks', requestId: `request-${i}` }, bearer))
    try {
      await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(16), { timeout: 2000 })
      expect((await request(origin, '/api/command', { method: 'getTasks' }, bearer)).status).toBe(429)
      expect(execute).toHaveBeenCalledTimes(16)
    } finally { releases.forEach(resolve => resolve()) }
    expect((await Promise.all(pending)).every(reply => reply.status === 200)).toBe(true)
    const last = request(origin, '/api/command', { method: 'getTasks' }, bearer)
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(17)); releases.at(-1)!()
    expect((await last).status).toBe(200)
  })

  it('invalidates browser sessions when the server closes and does not embed credentials in its bridge', async () => {
    const { origin, server } = await start()
    const login = await request(origin, '/api/login', { token })
    const Cookie = login.headers['set-cookie']![0].split(';')[0]
    const bridge = await request(origin, '/remote-bridge.js', undefined, { Cookie })
    expect(bridge.status).toBe(200); expect(bridge.text).not.toContain(token)
    await server.close()
    const restarted = await start()
    expect((await request(restarted.origin, '/api/command', { method: 'getTasks' }, { Cookie, Origin: restarted.origin })).status).toBe(401)
    expect(restarted.execute).not.toHaveBeenCalled()
  })
})
