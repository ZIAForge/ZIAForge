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
})
