import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { RunService } from '../RunService'
import { SessionRegistry } from '../SessionRegistry'
import { ProcessSupervisor } from '../ProcessSupervisor'
import type { AgentAdapter, CreateAdapterOptions } from '../../agents/AgentAdapterFactory'
import type { AgentEvent } from '../../../shared/agent-events'
import type { AgentSessionSnapshot } from '../../../shared/agent-session'
import type { TrustedAgentSessionConfig } from '../SessionManager'

async function pool<T, R>(values: T[], parallel: number, operation: (value: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(values.length)
  let next = 0
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (next < values.length) { const index = next++; results[index] = await operation(values[index], index) }
  }))
  return results
}
function latency(samples: number[]) {
  const ordered = [...samples].sort((a, b) => a - b)
  return { count: samples.length, p50Ms: ordered[Math.ceil(ordered.length * .5) - 1], p95Ms: ordered[Math.ceil(ordered.length * .95) - 1], maxMs: ordered.at(-1) }
}
function storageBytes(directory: string): number {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => sum + (entry.isDirectory() ? storageBytes(path.join(directory, entry.name)) : fs.statSync(path.join(directory, entry.name)).size), 0)
}
function sourceIdentity() {
  const root = path.resolve(import.meta.dirname, '../../..')
  const files = ['electron/runtime/SessionManager.ts', 'electron/runtime/EventJournal.ts', 'shared/agent-feed.ts', 'electron/runtime/__tests__/SessionManager.scalability.test.ts']
  return Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]))
}

describe('100 stored fixture sessions with four active turns', () => {
  it('isolates two chats per task, preserves idle sessions, and replays all history without spawning providers', async () => {
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-scale-')))
    const providers: FixtureProvider[] = []
    let active = 0
    let maxActive = 0
    let started = 0
    let stopped = 0
    let sent = 0
    class FixtureProvider implements AgentAdapter {
      private turn = 0
      constructor(readonly options: CreateAdapterOptions) {}
      async start() { started++; return { threadId: `fixture-${this.options.runId}` } }
      async stop() { stopped++ }
      async sendPrompt() {
        const turnId = `turn-${++this.turn}`
        active++; sent++; maxActive = Math.max(maxActive, active)
        try {
          this.emit({ type: 'agent.status.changed', scope: 'turn', status: 'running', turnId })
          // Yield once so the measured workload really overlaps, without timing sleeps.
          await new Promise<void>(resolve => setImmediate(resolve))
          const messageId = `answer-${turnId}`
          this.emit({ type: 'message.started', messageId, role: 'assistant', turnId })
          for (let chunk = 0; chunk < 8; chunk++) this.emit({ type: 'message.delta', messageId, turnId, deltaType: 'text', content: `${this.options.taskId}/${this.options.runId}/${turnId}/${chunk}:` + 'x'.repeat(96) })
          this.emit({ type: 'message.completed', messageId, turnId, finishReason: 'stop' })
          this.emit({ type: 'agent.status.changed', scope: 'turn', status: 'completed', turnId })
          return { turnId }
        } finally { active-- }
      }
      async resolveApproval() {}
      getPid() { return undefined }
      getStatus() { return 'running' as const }
      getSessionId() { return `fixture-${this.options.runId}` }
      getProvider() { return 'api' as const }
      getTaskId() { return this.options.taskId }
      getRunId() { return this.options.runId! }
      getCapabilities() { return { textStreaming: true, toolCalls: false, thinkingStreaming: false, toolOutputStreaming: false, interactiveApprovals: false, attachments: false } }
      private emit(event: Record<string, unknown>) { this.options.onEvent?.({ eventId: randomUUID(), timestamp: Date.now(), taskId: this.options.taskId, runId: this.options.runId!, ...event } as AgentEvent) }
    }
    const createService = () => new RunService({ sessionRegistry: new SessionRegistry(), processSupervisor: new ProcessSupervisor(), baseStorageDir: directory,
      createAdapter: options => { const provider = new FixtureProvider(options); providers.push(provider); return provider } })
    let service = createService()
    const memory: Record<string, NodeJS.MemoryUsage> = { before: process.memoryUsage() }
    const sourceBefore = sourceIdentity()
    const startedAt = performance.now()
    const configs: TrustedAgentSessionConfig[] = Array.from({ length: 100 }, (_, index) => ({ taskId: `scale-task-${Math.floor(index / 2)}`, chatId: `chat-${index % 2}`, presetName: 'Fixture only', cwd: directory, provider: 'api', apiConnectionId: 'in-memory-fixture', apiConnection: { id: 'in-memory-fixture', name: 'Never contacted', baseUrl: 'https://example.invalid', model: 'fixture', enabled: true, hasApiKey: false }, env: {} }))
    try {
      let phase = performance.now()
      const sessions = await pool(configs, 4, config => service.sessions.create(config))
      const createMs = performance.now() - phase
      expect(new Set(sessions.map(item => item.sessionId)).size).toBe(100)
      expect(started).toBe(100)
      expect(providers.every(provider => provider.getPid() === undefined)).toBe(true)
      memory.afterCreate = process.memoryUsage()
      phase = performance.now()
      await pool(sessions, 4, async (session, index) => {
        for (let turn = 1; turn <= 2; turn++) {
          await service.sessions.send({ ...session, clientMessageId: `input-${index}-${turn}`, text: `Fixture message ${index}/${turn}` })
          const snapshot = await service.sessions.snapshot(session)
          expect(snapshot.activeTurn).toBeUndefined()
          expect(snapshot.lastTurn?.status).toBe('completed')
        }
      })
      const turnsMs = performance.now() - phase
      expect(sent).toBe(200)
      expect(maxActive).toBeGreaterThan(1)
      expect(maxActive).toBeLessThanOrEqual(4)
      expect(stopped).toBe(0) // No idle session is evicted or killed to achieve this result.
      memory.afterTurns = process.memoryUsage()
      const feeds = new Map<string, Array<[string, string]>>()
      const switches: number[] = []
      for (let pass = 0; pass < 3; pass++) for (const [index, session] of sessions.entries()) {
        const before = performance.now()
        const snapshot = await service.sessions.snapshot(session)
        switches.push(performance.now() - before)
        expect(snapshot.feed).toHaveLength(4)
        expect(snapshot.feed.filter(item => item.role === 'user').map(item => item.text)).toEqual([`Fixture message ${index}/1`, `Fixture message ${index}/2`])
        expect(snapshot.feed.filter(item => item.role === 'assistant').every(item => item.text.includes(`${session.taskId}/${session.runId}/`))).toBe(true)
        feeds.set(session.sessionId, snapshot.feed.map(item => [item.role, item.text]))
      }
      phase = performance.now()
      await service.sessions.shutdown()
      const shutdownMs = performance.now() - phase
      expect(stopped).toBe(100)
      service = createService()
      const replay: number[] = []
      phase = performance.now()
      const attached = await pool(configs, 4, async config => {
        const before = performance.now()
        const snapshot = await service.sessions.attach(config)
        replay.push(performance.now() - before)
        expect(snapshot).toMatchObject({ sessionStatus: 'disconnected', resumeAvailable: true })
        return snapshot as AgentSessionSnapshot
      })
      const replayMs = performance.now() - phase
      expect(started).toBe(100)
      expect(providers).toHaveLength(100)
      for (const snapshot of attached) expect(snapshot.feed.map(item => [item.role, item.text])).toEqual(feeds.get(snapshot.sessionId))
      memory.afterReplay = process.memoryUsage()
      const sourceAfter = sourceIdentity()
      const report = { schemaVersion: 1, status: 'passed', sourceBefore, sourceAfter, sourceChangedDuringRun: JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter), provider: 'in-memory deterministic adapter; no CLI processes, model requests, or auth', tasks: 50, chatsPerTask: 2, sessions: 100, turns: sent, chunksPerReply: 8, maxConcurrentActiveTurns: maxActive, processSpawns: 0, stoppedAdapters: stopped, idleEvictions: 0,
        measurements: { totalMs: performance.now() - startedAt, createMs, turnsMs, shutdownMs, replayMs, snapshot: latency(switches), coldAttach: latency(replay), memory, journalAndMetadataBytes: storageBytes(directory) },
        environment: { node: process.version, platform: process.platform, arch: process.arch, osRelease: os.release(), cpuCount: os.cpus().length },
        limitations: ['Backend/session coordinator only, not Electron rendering or native CLI memory.', 'Memory is this Vitest worker process, without forced GC; not retained-heap attribution.', 'Cold manager/replay uses the OS filesystem cache; not a cold disk benchmark.', 'Measurements are evidence, not machine-independent performance guarantees.'] }
      if (process.env.ZIAFORGE_SCALE_RECEIPT) {
        if (!path.isAbsolute(process.env.ZIAFORGE_SCALE_RECEIPT)) throw new Error('Scale receipt path must be absolute')
        fs.writeFileSync(process.env.ZIAFORGE_SCALE_RECEIPT, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 })
      }
    } finally { await service.sessions.shutdown(); fs.rmSync(directory, { recursive: true, force: true }) }
  }, 120000)
})
