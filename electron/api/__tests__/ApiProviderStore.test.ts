import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProviderStore, validateApiBaseUrl, type SecretStorage } from '../ApiProviderStore'

const roots: string[] = [], stores: ApiProviderStore[] = [], servers: http.Server[] = []
function fixture() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-api-store-'))); roots.push(directory)
  const key = randomBytes(32)
  const secrets: SecretStorage = {
    isEncryptionAvailable: () => true,
    encryptString: value => { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); const content = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), content]) },
    decryptString: value => { const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); decipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8') },
  }
  const store = new ApiProviderStore({ directory, secrets }); stores.push(store)
  return { store, directory, secrets }
}
afterEach(async () => { await Promise.all(stores.splice(0).map(store => store.shutdown())); for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })

describe('private API connections', () => {
  it('persists encrypted keys, exposes only safe metadata, and keeps or removes credentials explicitly', async () => {
    const { store, directory } = fixture()
    const saved = await store.save({ name: 'Local', model: 'test-model', baseUrl: 'https://example.invalid/v1/', enabled: true, apiKey: 'fixture-secret-unique' })
    expect(saved.hasApiKey).toBe(true); expect(saved).not.toHaveProperty('apiKey')
    const raw = fs.readFileSync(path.join(directory, `${saved.id}.json`), 'utf8')
    expect(raw).not.toContain('fixture-secret-unique')
    expect(fs.statSync(path.join(directory, `${saved.id}.json`)).mode & 0o777).toBe(0o600)
    expect(await store.resolve(saved.id)).toMatchObject({ apiKey: 'fixture-secret-unique', baseUrl: 'https://example.invalid/v1' })
    await store.save({ id: saved.id, name: 'Renamed', model: 'another', baseUrl: saved.baseUrl, enabled: true })
    expect((await store.resolve(saved.id)).apiKey).toBe('fixture-secret-unique')
    await expect(store.save({ id: saved.id, name: 'Changed endpoint', model: 'another', baseUrl: 'https://other.invalid/v1', enabled: true })).rejects.toThrow('Re-enter')
    expect((await store.resolve(saved.id)).baseUrl).toBe(saved.baseUrl)
    await store.save({ id: saved.id, name: 'Renamed', model: 'another', baseUrl: saved.baseUrl, enabled: true, apiKey: '' })
    expect((await store.list())[0].hasApiKey).toBe(false)
    await store.remove({ id: saved.id }); expect(await store.list()).toEqual([])
  })
  it('keeps legacy transport and encrypted custody while explicit Responses settings survive restart', async () => {
    const { store, directory, secrets } = fixture()
    const legacy = await store.save({ name: 'Legacy', model: 'm', baseUrl: 'https://fixture.invalid/v1', enabled: true, apiKey: 'transport-fixture-secret' })
    expect(legacy).not.toHaveProperty('transport')
    const request = { id: legacy.id, name: legacy.name, model: legacy.model, baseUrl: legacy.baseUrl, enabled: true }
    await expect(store.save({ ...request, profile: 'codex-connector' })).rejects.toThrow('Responses')
    await expect(store.save({ ...request, allowCommands: true })).rejects.toThrow('Responses')
    await store.save({ ...request, transport: 'responses', profile: 'codex-connector', allowCommands: true })
    const reopened = new ApiProviderStore({ directory, secrets }); stores.push(reopened)
    expect((await reopened.list())[0]).toMatchObject({ transport: 'responses', profile: 'codex-connector', allowCommands: true, hasApiKey: true })
    expect((await reopened.resolve(legacy.id)).apiKey).toBe('transport-fixture-secret')
    expect(JSON.stringify(await reopened.list())).not.toContain('transport-fixture-secret')
    await reopened.save({ id: legacy.id, name: legacy.name, model: legacy.model, baseUrl: legacy.baseUrl, enabled: true, transport: 'chat-completions', profile: 'openai-compatible', allowCommands: false })
    expect(await reopened.resolve(legacy.id)).toMatchObject({ transport: 'chat-completions', allowCommands: false, apiKey: 'transport-fixture-secret' })
  })
  it('fails closed when OS encryption is unavailable and rejects embedded credentials and unsafe schemes', async () => {
    const { store, secrets, directory } = fixture()
    vi.spyOn(secrets, 'isEncryptionAvailable').mockReturnValue(false)
    await expect(store.save({ name: 'Failed', model: 'm', baseUrl: 'https://example.invalid/v1', enabled: true, apiKey: 'never-plaintext' })).rejects.toThrow('unavailable')
    expect(fs.readdirSync(directory)).toEqual([])
    for (const url of ['http://example.invalid/v1', 'https://key:secret@example.invalid/v1', 'https://example.invalid/v1?key=secret', 'file:///tmp', 'https://example.invalid/v1#secret']) expect(() => validateApiBaseUrl(url)).toThrow()
    expect(validateApiBaseUrl('http://127.0.0.1:9876/v1')).toBe('http://127.0.0.1:9876/v1')
  })
  it('discovers actual models over bounded HTTP and aborts a pending discovery on Quit without fallback models', async () => {
    let received = 0
    const server = http.createServer((request, response) => { received++; if (received === 1) { expect(request.url).toBe('/v1/models'); response.end(JSON.stringify({ data: [{ id: 'actual-one' }, { id: 'actual-two' }] })) } })
    servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }, { store } = fixture()
    const saved = await store.save({ name: 'Local', model: 'do-not-fabricate', baseUrl: `http://127.0.0.1:${address.port}/v1`, enabled: true })
    expect(await store.catalog(saved.id)).toMatchObject({ status: 'ready', models: [{ id: 'actual-one', label: 'actual-one' }, { id: 'actual-two', label: 'actual-two' }] })
    const pending = store.catalog(saved.id)
    await vi.waitFor(() => expect(received).toBe(2))
    await store.shutdown()
    expect(await pending).toMatchObject({ status: 'unavailable', models: [] })
    expect(await store.catalog(saved.id)).toMatchObject({ status: 'unavailable', models: [] })
  })
  it('refuses linked private metadata rather than reading outside credentials', async () => {
    const { store, directory } = fixture()
    const outside = path.join(directory, 'outside'); fs.writeFileSync(outside, '{}'); fs.symlinkSync(outside, path.join(directory, 'linked.json'))
    await expect(store.list()).rejects.toThrow('Unsafe')
    expect(fs.readFileSync(outside, 'utf8')).toBe('{}')
  })
  it('pins Grok settings across restart and inspects authenticated bounded metadata without exposing account details', async () => {
    let hold = false, pending = 0
    const server = http.createServer((request, response) => {
      expect(request.headers.authorization).toBe('Bearer grok-fixture-secret')
      if (hold) { pending++; return }
      const body = request.url === '/v1/models' ? { data: [{ id: 'grok-test', reasoning_efforts: ['low', 'high'], default_reasoning_effort: 'high', context_windows: [256000], context_window: 256000 }] }
        : request.url === '/v1/grok/capabilities' ? { version: 1, cliVersion: 'fixture', nativeTools: [{ name: 'web_search' }], imageInput: true, media: { images: { available: true, verified: true, edit: true } }, interactiveQuestions: { available: true } }
        : { rate_limits: { tier: 'fixture-tier', creditUsagePercent: null, accountId: 'private-account', currentPeriod: { end: '2030-01-01T00:00:00Z' } } }
      response.end(JSON.stringify(body))
    })
    servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }, { store, directory, secrets } = fixture()
    const saved = await store.save({ name: 'Grok test', baseUrl: `http://127.0.0.1:${address.port}/v1`, enabled: true, model: 'grok-test', apiKey: 'grok-fixture-secret', transport: 'responses', profile: 'grok-connector-v1', grok: { contextWindow: 256000, maxTurns: 12, autoApproveNativePermissions: true } })
    const reopened = new ApiProviderStore({ directory, secrets }); stores.push(reopened)
    expect((await reopened.list())[0]).toMatchObject({ profile: 'grok-connector-v1', grok: { contextWindow: 256000, maxTurns: 12, autoApproveNativePermissions: true } })
    expect(await reopened.catalog(saved.id)).toMatchObject({ manualReasoningEffort: false, models: [{ id: 'grok-test', supportedReasoningEfforts: ['low', 'high'], contextWindows: [256000] }] })
    const inspection = await reopened.inspect({ id: saved.id })
    expect(inspection).toMatchObject({ imageInput: true, imageGeneration: true, interactiveQuestions: true, usage: { creditUsagePercent: null, tier: 'fixture-tier' }, contextWindows: [256000] })
    expect(JSON.stringify(inspection)).not.toContain('private-account')
    expect(JSON.stringify(inspection)).not.toContain('grok-fixture-secret')
    hold = true
    const stopped = reopened.inspect({ id: saved.id }).catch(error => error)
    await vi.waitFor(() => expect(pending).toBe(3))
    await reopened.shutdown()
    expect(await stopped).toBeInstanceOf(Error)
    await expect(reopened.inspect({ id: saved.id })).rejects.toThrow('shutting down')
  })

  it('pins Claude defaults and options, retains encrypted custody and rejects doubled endpoints or mismatched transports', async () => {
    const { store, directory, secrets } = fixture()
    const request = { name: 'Claude fixture', model: 'fixture-model', baseUrl: 'https://claude.invalid', enabled: true, apiKey: 'claude-fixture-private-key', transport: 'anthropic-messages' as const, profile: 'claude-connector-v1' as const }
    for (const baseUrl of ['https://claude.invalid/v1', 'https://claude.invalid/v1/v1', 'https://claude.invalid/messages']) await expect(store.save({ ...request, baseUrl })).rejects.toThrow('origin')
    await expect(store.save({ ...request, transport: 'responses' })).rejects.toThrow('Messages')
    await expect(store.save({ ...request, profile: 'openai-compatible' })).rejects.toThrow('Messages')
    const saved = await store.save(request)
    expect(saved.claude).toEqual({ mode: 'caller', nativeTools: [], permissionMode: 'manual', maxTokens: 4096, maxTurns: 30, historyMode: 'reject' })
    expect(fs.readFileSync(path.join(directory, `${saved.id}.json`), 'utf8')).not.toContain(request.apiKey)
    await store.save({ ...request, id: saved.id, apiKey: undefined, claude: { mode: 'native', nativeTools: ['Read'], permissionMode: 'plan', thinking: { type: 'adaptive', display: 'omitted' }, outputSchema: { type: 'object' } } })
    const reopened = new ApiProviderStore({ directory, secrets }); stores.push(reopened)
    expect(await reopened.resolve(saved.id)).toMatchObject({ apiKey: request.apiKey, claude: { mode: 'native', nativeTools: ['Read'], permissionMode: 'plan', maxTokens: 4096, thinking: { type: 'adaptive', display: 'omitted' } } })
    expect(JSON.stringify(await reopened.list())).not.toContain(request.apiKey)
    await expect(reopened.save({ ...request, id: saved.id, apiKey: undefined, baseUrl: 'https://other.invalid' })).rejects.toThrow('Re-enter')
  })

  it('discovers Claude through all six authenticated origin routes and aborts owned discovery during Quit', async () => {
    const seen: string[] = []; let hold = false, pending = 0
    const capabilities = { version: 1, provider: 'claude', toolCatalog: ['Read'], discoveredTools: [{ name: 'Read', available: true, enabled: true, verified: false }] }
    const server = http.createServer((request, response) => {
      expect(request.headers.authorization).toBe('Bearer claude-fixture-key')
      expect(request.headers['anthropic-version']).toBe('2023-06-01')
      if (hold) { pending++; return }
      seen.push(request.url!)
      const body = request.url === '/v1/models' ? { data: [{ id: 'fixture-model', display_name: 'Discovered fixture', reasoning_efforts: ['high'], supports_adaptive_thinking: true }] }
        : request.url === '/v1/claude/usage' ? { rate_limits: { available: false, windows: [] }, account: { email: 'never-return-account' } }
        : request.url === '/v1/claude/status' ? { claude: { connected: true, version: 'fixture-cli' }, activity: { active: 0 } }
        : request.url === '/v1/claude/sessions' ? { version: 1, sessions: [{ id: 'never-return-session-id' }] } : capabilities
      response.end(JSON.stringify(body))
    })
    servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }, { store } = fixture()
    const saved = await store.save({ name: 'Claude local fixture', model: 'fixture-model', baseUrl: `http://127.0.0.1:${address.port}`, enabled: true, apiKey: 'claude-fixture-key', transport: 'anthropic-messages', profile: 'claude-connector-v1' })
    expect(await store.catalog(saved.id)).toMatchObject({ agent: 'Claude Connector v1', command: 'GET /v1/models', manualReasoningEffort: false, models: [{ id: 'fixture-model', label: 'Discovered fixture', supportedReasoningEfforts: ['high'] }] })
    seen.length = 0
    const inspection = await store.inspect({ id: saved.id })
    expect(new Set(seen)).toEqual(new Set(['/v1/models', '/v1/claude/capabilities', '/v1/claude/tools', '/v1/claude/usage', '/v1/claude/status', '/v1/claude/sessions']))
    expect(inspection).toMatchObject({ provider: 'claude', usage: { available: false }, status: { connected: true, active: 0, ownedSessions: 1 } })
    expect(JSON.stringify(inspection)).not.toMatch(/never-return|claude-fixture-key/)
    hold = true
    const stopped = store.inspect({ id: saved.id }).catch(error => error)
    await vi.waitFor(() => expect(pending).toBe(6))
    await store.shutdown()
    expect(await stopped).toBeInstanceOf(Error)
  })

})
