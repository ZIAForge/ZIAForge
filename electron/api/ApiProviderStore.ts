import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ApiConnection, ApiConnectionsAPI, SaveApiConnection } from '../../shared/api-provider'
import type { AgentModelCatalog } from '../../shared/agent-models'
import { ensurePrivateDirectory, readPrivateMetadata, replacePrivateMetadata, assertPrivateFile } from '../runtime/privateStorage'

export interface SecretStorage {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}
export interface ResolvedApiConnection extends ApiConnection { apiKey?: string }
interface StoredConnection extends Omit<ApiConnection, 'hasApiKey'> { version: 1; encryptedKey?: string }
const idPattern = /^[a-zA-Z0-9_-]{1,160}$/
const label = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && ![...value].some(char => char.charCodeAt(0) < 32)

export function validateApiBaseUrl(input: string): string {
  if (typeof input !== 'string' || input.length > 2000) throw new Error('Invalid API base URL')
  const url = new URL(input)
  if (url.username || url.password || url.search || url.hash) throw new Error('API URL must not contain credentials, query parameters or a fragment')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('API connections require HTTPS, except local loopback HTTP')
  return url.toString().replace(/\/$/, '')
}

/** Main injects Electron safeStorage after app readiness; tests inject a real reversible test cipher. */
export class ApiProviderStore implements ApiConnectionsAPI {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly discoveries = new Map<AbortController, Promise<AgentModelCatalog>>()
  private closing = false
  constructor(private readonly options: { directory: string; secrets: SecretStorage }) { ensurePrivateDirectory(options.directory) }
  private filename(id: string): string { if (!idPattern.test(id)) throw new Error('Invalid API connection ID'); return path.join(this.options.directory, `${id}.json`) }
  private public(value: StoredConnection): ApiConnection { return { id: value.id, name: value.name, baseUrl: value.baseUrl, model: value.model, enabled: value.enabled, hasApiKey: Boolean(value.encryptedKey) } }
  private async read(id: string): Promise<StoredConnection> {
    const value = await readPrivateMetadata(this.filename(id)) as StoredConnection
    if (!value || value.version !== 1 || value.id !== id || !label(value.name) || !label(value.model) || typeof value.enabled !== 'boolean' || (value.encryptedKey !== undefined && (typeof value.encryptedKey !== 'string' || value.encryptedKey.length > 32768))) throw new Error('Invalid stored API connection')
    validateApiBaseUrl(value.baseUrl)
    return value
  }
  async list(): Promise<ApiConnection[]> {
    await this.queue
    const files = await fs.promises.readdir(this.options.directory)
    return Promise.all(files.filter(file => /^[a-zA-Z0-9_-]+\.json$/.test(file)).map(async file => this.public(await this.read(file.slice(0, -5)))))
  }
  save(request: SaveApiConnection): Promise<ApiConnection> {
    if (this.closing) return Promise.reject(new Error('API connection storage is shutting down'))
    const action = this.queue.catch(() => {}).then(async () => {
      if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some(key => !['id', 'name', 'baseUrl', 'model', 'enabled', 'apiKey'].includes(key)) || !label(request.name) || !label(request.model) || typeof request.enabled !== 'boolean' || (request.apiKey !== undefined && (typeof request.apiKey !== 'string' || request.apiKey.length > 16384 || /[\r\n\0]/.test(request.apiKey)))) throw new Error('Invalid API connection configuration')
      const id = request.id ?? `api-${randomUUID()}`
      const file = this.filename(id)
      let previous: StoredConnection | undefined
      try { previous = await this.read(id) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      let encryptedKey = previous?.encryptedKey
      if (previous?.encryptedKey && request.apiKey === undefined && validateApiBaseUrl(request.baseUrl) !== previous.baseUrl) throw new Error('Re-enter or clear the API key when changing its endpoint')
      if (request.apiKey !== undefined) {
        if (request.apiKey && !this.options.secrets.isEncryptionAvailable()) throw new Error('Secure OS credential storage is unavailable; no API key was saved')
        encryptedKey = request.apiKey ? this.options.secrets.encryptString(request.apiKey).toString('base64') : undefined
      }
      const value: StoredConnection = { version: 1, id, name: request.name.trim(), baseUrl: validateApiBaseUrl(request.baseUrl), model: request.model.trim(), enabled: request.enabled, encryptedKey }
      await replacePrivateMetadata(file, value)
      return this.public(value)
    })
    this.queue = action.then(() => {}, () => {})
    return action
  }
  remove(request: { id: string }): Promise<void> {
    if (this.closing) return Promise.reject(new Error('API connection storage is shutting down'))
    const action = this.queue.catch(() => {}).then(async () => {
      if (!request || typeof request !== 'object' || Object.keys(request).some(key => key !== 'id')) throw new Error('Invalid API removal request')
      const file = this.filename(request.id); assertPrivateFile(file)
      await fs.promises.rm(file, { force: true })
    })
    this.queue = action.then(() => {}, () => {})
    return action
  }
  async resolve(id: string): Promise<ResolvedApiConnection> {
    if (this.closing) throw new Error('API connection storage is shutting down')
    await this.queue
    const value = await this.read(id)
    if (!value.enabled) throw new Error('This API connection is disabled')
    if (value.encryptedKey && !this.options.secrets.isEncryptionAvailable()) throw new Error('Secure OS credential storage is unavailable')
    const apiKey = value.encryptedKey ? this.options.secrets.decryptString(Buffer.from(value.encryptedKey, 'base64')) : undefined
    return { ...this.public(value), apiKey }
  }
  catalog(id: string): Promise<AgentModelCatalog> {
    const controller = new AbortController()
    const promise = (async (): Promise<AgentModelCatalog> => {
      const base = { agent: 'OpenAI-compatible API', source: 'api' as const, command: 'GET /models', manualReasoningEffort: true, queriedAt: Date.now() }
      const timer = setTimeout(() => controller.abort(), 10_000)
      try {
        if (this.closing) throw new Error('Closing')
        const connection = await this.resolve(id)
        if (this.closing) throw new Error('Closing')
        const response = await fetch(`${connection.baseUrl}/models`, { headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}, signal: controller.signal, redirect: 'error' })
        if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('Model discovery failed') }
        const reader = response.body.getReader(), chunks: Buffer[] = []
        let bytes = 0
        try {
          while (!controller.signal.aborted) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > 1024 * 1024) throw new Error('Model catalog exceeds limit'); chunks.push(Buffer.from(next.value)) }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
        const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { data?: unknown }
        if (!Array.isArray(result.data) || result.data.length > 5000) throw new Error('Invalid model catalog')
        const models = new Map<string, { id: string; label: string }>()
        for (const item of result.data) {
          if (!item || !label(item.id) || /\s/.test(item.id)) throw new Error('Invalid model identifier')
          models.set(item.id, { id: item.id, label: item.id })
        }
        if (!models.size) throw new Error('Empty model catalog')
        return { ...base, status: 'ready', models: [...models.values()] }
      } catch { return { ...base, status: 'unavailable', models: [], error: this.closing ? 'API model discovery is shutting down' : 'Could not load the API model catalog. Check this connection or enter a model ID manually.' } }
      finally { clearTimeout(timer) }
    })()
    this.discoveries.set(controller, promise)
    void promise.finally(() => this.discoveries.delete(controller))
    return promise
  }
  async shutdown(): Promise<void> {
    this.closing = true
    for (const controller of this.discoveries.keys()) controller.abort()
    await Promise.allSettled([...this.discoveries.values(), this.queue])
  }
}
