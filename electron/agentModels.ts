import { execFile, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ProcessSupervisor } from './runtime/ProcessSupervisor'
import { ensurePrivateDirectory } from './runtime/privateStorage'
import { isReasoningEffort } from '../shared/agent-models'
import { CLI_REASONING_EFFORTS } from './runtime/AgentExecutionPolicy'
import type { AgentModelCatalog } from '../shared/agent-models'

export interface ModelDiscoveryRequest { agent: string; executable?: string; env: NodeJS.ProcessEnv; cwd: string }

/** An ASAR app path is virtual; native CLI processes need a real private cwd. */
export function modelCatalogDirectory(userData: string): string {
  if (!path.isAbsolute(userData)) throw new Error('Model discovery requires an absolute application profile directory')
  const directory = path.join(fs.realpathSync(userData), 'model-catalog')
  ensurePrivateDirectory(directory)
  return fs.realpathSync(directory)
}

/** Keep CLI identifiers, never the progress banner or the display-name column. */
export function parseAgentModels(output: string): string[] {
  // eslint-disable-next-line no-control-regex
  const clean = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  const models = clean.split(/\r?\n/).flatMap(line => {
    const match = line.trim().match(/^([a-z0-9]+(?:[._-][a-z0-9]+)+)(?:\s+.+)?$/i)
    return match ? [match[1]] : []
  })
  return [...new Set(models)]
}

interface Discovery {
  child: ChildProcess
  done: Promise<void>
  tracking?: NodeJS.Timeout
  cleanup?: Promise<boolean>
  cancel?: () => void
}

const record = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const validModel = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && ![...value].some(char => char.charCodeAt(0) < 33 || char.charCodeAt(0) === 127)

export function parseStructuredModels(value: unknown, provider: 'codex' | 'claude'): AgentModelCatalog['models'] {
  if (!Array.isArray(value)) throw new Error('The CLI returned an invalid model catalog')
  const models = new Map<string, AgentModelCatalog['models'][number]>()
  for (const entry of value) {
    const item = record(entry)
    const id = provider === 'codex' ? item?.model : item?.value
    if (!validModel(id)) throw new Error('The CLI returned an invalid model identifier')
    const label = item?.displayName
    const model: AgentModelCatalog['models'][number] = { id, label: typeof label === 'string' && label.length <= 300 ? label : id }
    const efforts = provider === 'codex' ? item?.supportedReasoningEfforts : item?.supportsEffort === false ? [] : item?.supportedEffortLevels
    if (efforts !== undefined) {
      if (!Array.isArray(efforts) || efforts.length > 64) throw new Error('The CLI returned invalid reasoning effort metadata')
      const values = efforts.map(value => provider === 'codex' ? record(value)?.reasoningEffort : value)
      if (!values.every(isReasoningEffort)) throw new Error('The CLI returned invalid reasoning effort metadata')
      model.supportedReasoningEfforts = [...new Set(values)]
    }
    const defaultEffort = item?.defaultReasoningEffort
    if (defaultEffort !== undefined) {
      if (!isReasoningEffort(defaultEffort)) throw new Error('The CLI returned invalid default reasoning effort')
      model.defaultReasoningEffort = defaultEffort
    }
    models.set(id, model)
  }
  return [...models.values()]
}

/** Model enumeration owns processes too; closing the application cannot orphan it. */
export class AgentModelDiscovery {
  private readonly pending = new Set<Discovery>()
  private readonly supervisor = new ProcessSupervisor()
  private closing = false
  private readonly catalogs = new Map<string, AgentModelCatalog>()

  assertEffort(agent: string, model: string | undefined, effort: string | null | undefined): void {
    if (effort == null || !model) return
    const advertised = this.catalogs.get(agent)?.models.find(item => item.id === model)?.supportedReasoningEfforts
    if (advertised && !advertised.includes(effort)) throw new Error(`Model ${model} does not advertise reasoning effort ${effort}`)
  }

  query(env: NodeJS.ProcessEnv, cwd: string, executable = 'agy'): Promise<string[]> {
    if (this.closing) return Promise.reject(new Error('Model discovery is shutting down'))
    return new Promise((resolve, reject) => {
      let complete!: () => void
      const done = new Promise<void>(finished => { complete = finished })
      const child = execFile(executable, ['models'], {
        cwd, env, timeout: 15_000, encoding: 'utf8', maxBuffer: 1024 * 1024,
      }, (error, stdout) => {
        // The callback may be synchronous in a test double; establish ownership first.
        queueMicrotask(() => {
          void this.cleanup(entry).then(cleaned => {
            if (!cleaned) throw new Error('Model discovery cleanup could not be verified')
            if (error) reject(error)
            else resolve(parseAgentModels(stdout))
          }).catch(reject).finally(complete)
        })
      })
      const entry: Discovery = { child, done }
      this.pending.add(entry)
      if (child.pid) {
        this.supervisor.trackProcessTree(child.pid)
        entry.tracking = setInterval(() => this.supervisor.trackProcessTree(child.pid!), 100)
      }
    })
  }

  async catalog(request: ModelDiscoveryRequest): Promise<AgentModelCatalog> {
    const provider = request.agent === 'Codex' || request.agent === 'ZIAFCoder' ? 'codex'
      : request.agent === 'Claude Code' ? 'claude' : request.agent === 'Google Antigravity' ? 'antigravity' : null
    const command = provider === 'codex' ? 'codex app-server: model/list'
      : provider === 'claude' ? 'claude stream-json: initialize.models' : provider === 'antigravity' ? 'agy models' : request.agent
    const base = { agent: request.agent, command, source: 'cli' as const, queriedAt: Date.now(), ...(provider === 'claude' || provider === 'antigravity' ? { reasoningEfforts: [...CLI_REASONING_EFFORTS[provider]] } : provider === 'codex' ? { manualReasoningEffort: true } : {}) }
    try {
      if (!provider) throw new Error('Model discovery is not supported for this client')
      const models = provider === 'antigravity'
        ? (await this.query(request.env, request.cwd, request.executable)).map(id => ({ id, label: id }))
        : await this.protocolCatalog(provider, request)
      if (!models.length) throw new Error('The CLI returned an empty model catalog; enter a model ID manually or retry')
      const catalog: AgentModelCatalog = { ...base, status: 'ready', models }
      this.catalogs.set(request.agent, structuredClone(catalog))
      return catalog
    } catch (error) {
      // Never return raw CLI stderr, command environment, or a fabricated catalog.
      const message = error instanceof Error && error.message.startsWith('The CLI') ? error.message
        : this.closing ? 'Model discovery is shutting down' : 'Could not load models from the selected CLI; check its installation and sign-in, or enter a model ID manually'
      return { ...base, status: 'unavailable', models: [], error: message }
    }
  }

  private protocolCatalog(provider: 'codex' | 'claude', request: ModelDiscoveryRequest): Promise<AgentModelCatalog['models']> {
    if (this.closing) return Promise.reject(new Error('Model discovery is shutting down'))
    return new Promise((resolve, reject) => {
      const args = provider === 'codex' ? ['app-server', '--listen', 'stdio://'] : ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'plan', '--no-session-persistence']
      const child = spawn(request.executable || provider, args, { cwd: request.cwd, env: request.env, stdio: ['pipe', 'pipe', 'pipe'] })
      let complete!: () => void
      const entry: Discovery = { child, done: new Promise<void>(finished => { complete = finished }) }
      this.pending.add(entry)
      let finished = false
      let closed = false
      let closeDone!: () => void
      const closing = new Promise<void>(done => { closeDone = done })
      let bytes = 0
      let buffer = ''
      let requestId = 1
      let initialized = false
      const seenCursors = new Set<string>()
      const models = new Map<string, AgentModelCatalog['models'][number]>()
      const finish = (error?: Error) => {
        if (finished) return
        finished = true
        clearTimeout(deadline)
        child.stdin?.end()
        void (async () => {
          let timer: NodeJS.Timeout | undefined
          if (!closed && !error) {
            await Promise.race([closing, new Promise<void>(done => { timer = setTimeout(done, 1000) })])
            clearTimeout(timer)
          }
          const cleaned = await this.cleanup(entry)
          if (!cleaned) throw new Error('The CLI catalog process did not stop')
          if (error) throw error
          resolve([...models.values()])
        })().catch(reject).finally(complete)
      }
      entry.cancel = () => finish(new Error('Model discovery is shutting down'))
      const deadline = setTimeout(() => finish(new Error('The CLI model catalog timed out')), 15_000)
      const write = (value: unknown) => {
        if (finished) return
        child.stdin?.write(JSON.stringify(value) + '\n', error => { if (error) finish(new Error('The CLI catalog input closed')) })
      }
      child.once('spawn', () => {
        if (child.pid) {
          this.supervisor.trackProcessTree(child.pid)
          entry.tracking = setInterval(() => this.supervisor.trackProcessTree(child.pid!), 100)
        }
        if (provider === 'codex') write({ id: 1, method: 'initialize', params: { clientInfo: { name: 'ziaforge_catalog', version: '1.0' } } })
        else write({ type: 'control_request', request_id: 'catalog-initialize', request: { subtype: 'initialize', hooks: null } })
      })
      const receive = (line: string) => {
        const message = record(JSON.parse(line))
        if (!message) throw new Error('The CLI returned a malformed catalog message')
        if (provider === 'claude') {
          if (message.type !== 'control_response') return
          const response = record(message.response)
          if (response?.request_id !== 'catalog-initialize') return
          if (response.subtype !== 'success') throw new Error('The CLI rejected catalog initialization')
          for (const model of parseStructuredModels(record(response.response)?.models, provider)) models.set(model.id, model)
          finish()
          return
        }
        if (message.id !== requestId) return
        if (message.error) throw new Error('The CLI rejected the model catalog request')
        if (!initialized) {
          initialized = true
          write({ method: 'initialized', params: {} })
          write({ id: ++requestId, method: 'model/list', params: { limit: 100, includeHidden: true } })
          return
        }
        const result = record(message.result)
        for (const model of parseStructuredModels(result?.data, provider)) models.set(model.id, model)
        const cursor = result?.nextCursor
        if (cursor !== null && cursor !== undefined) {
          if (typeof cursor !== 'string' || !cursor || seenCursors.has(cursor) || seenCursors.size >= 100 || models.size > 10_000) throw new Error('The CLI returned an invalid catalog cursor')
          seenCursors.add(cursor)
          write({ id: ++requestId, method: 'model/list', params: { cursor, limit: 100, includeHidden: true } })
        } else finish()
      }
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', (chunk: string) => {
        if (finished) return
        bytes += Buffer.byteLength(chunk)
        if (bytes > 1024 * 1024) { finish(new Error('The CLI model catalog exceeded its output limit')); return }
        buffer += chunk
        let index: number
        while (!finished && (index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1)
          if (line) { try { receive(line) } catch { finish(new Error('The CLI returned an invalid model catalog')) } }
        }
      })
      child.stderr?.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 1024 * 1024) finish(new Error('The CLI model catalog exceeded its output limit')) })
      child.stdin?.on('error', () => finish(new Error('The CLI catalog input closed')))
      child.once('error', () => finish(new Error('The CLI could not be started')))
      child.once('close', () => { closed = true; closeDone(); if (!finished) finish(new Error('The CLI exited before returning its model catalog')) })
    })
  }

  private cleanup(entry: Discovery): Promise<boolean> {
    if (entry.cleanup) return entry.cleanup
    clearInterval(entry.tracking)
    const cleanup = entry.child.pid
      ? this.supervisor.terminateProcessTree(entry.child.pid, { timeoutMs: 750 })
      : Promise.resolve(true)
    entry.cleanup = cleanup.then(stopped => {
      if (stopped) this.pending.delete(entry)
      else entry.cleanup = undefined
      return stopped
    }, error => { entry.cleanup = undefined; throw error })
    return entry.cleanup
  }

  async shutdown(): Promise<void> {
    this.closing = true
    const entries = [...this.pending]
    for (const entry of entries) entry.cancel?.()
    const stopped = await Promise.all(entries.map(entry => this.cleanup(entry)))
    if (stopped.some(value => !value)) throw new Error('Model discovery processes did not stop')
    let timeout: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        Promise.all(entries.map(entry => entry.done)),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Model discovery callbacks did not drain')), 1500) }),
      ])
    } finally { clearTimeout(timeout) }
  }
}

const discovery = new AgentModelDiscovery()
export const queryAntigravityModels = (env: NodeJS.ProcessEnv, cwd: string) => discovery.query(env, cwd)
export const queryAgentModelCatalog = (request: ModelDiscoveryRequest) => discovery.catalog(request)
export const shutdownModelDiscovery = () => discovery.shutdown()

export const assertAdvertisedReasoningEffort = (agent: string, model: string | undefined, effort: string | null | undefined) => discovery.assertEffort(agent, model, effort)
