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
    const saved = await store.save({ name: 'Grok test', baseUrl: `http://127.0.0.1:${address.port}/v1`, enabled: true, model: 'grok-test', apiKey: 'grok-fixture-secret', transport: 'responses', profile: 'grok-connector-v1', grok: { contextWindow: 256000, maxTurns: 12 } })
    const reopened = new ApiProviderStore({ directory, secrets }); stores.push(reopened)
    expect((await reopened.list())[0]).toMatchObject({ profile: 'grok-connector-v1', grok: { contextWindow: 256000, maxTurns: 12 } })
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

})
