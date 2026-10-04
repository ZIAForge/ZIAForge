import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueueStore, queueContext } from '../QueueStore'
import { RecoveryStore } from '../RecoveryStore'

const identity = { taskId: 'task-one', chatId: 'chat-main', sessionId: 'session-one' }
const context = queueContext({ provider: 'codex', presetName: 'Default', model: 'model-a' })
const request = (clientMessageId: string, text = clientMessageId) => ({ clientMessageId, text, runId: 'run-one' })

describe('private durable message queue', () => {
  let directory: string
  beforeEach(() => { directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-queue-'))) })
  afterEach(() => { vi.restoreAllMocks(); fs.rmSync(directory, { recursive: true, force: true }) })

  it('stores accepted input before returning, restores paused, and pins configuration and run lineage', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('a', 'Привет 🧪'), context)
    expect(JSON.parse(fs.readFileSync(queue.filename, 'utf8')).items[0].text).toBe('Привет 🧪')
    expect(fs.statSync(queue.filename).mode & 0o777).toBe(0o600)
    const restored = new QueueStore(directory, identity)
    expect(restored.snapshot()).toMatchObject({ paused: true, items: [{ clientMessageId: 'a', status: 'queued' }] })
    expect(restored.beginDispatch()).toBeUndefined()
    expect(() => restored.assertContext(context, new Set(['other-run']))).toThrow(/another/)
    expect(() => restored.assertContext(queueContext({ provider: 'claude', presetName: 'Default' }), new Set(['run-one']))).toThrow(/another/)
    restored.assertContext(context, new Set(['run-one', 'run-two']))
    restored.pause(false)
    expect(restored.beginDispatch()?.clientMessageId).toBe('a')
  })

  it('crash during dispatch leaves uncertainty, blocks every following item, and permits dismissal only', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('a'), context); queue.accept(request('b'), context)
    expect(queue.beginDispatch()?.clientMessageId).toBe('a')
    const restored = new QueueStore(directory, identity)
    expect(restored.snapshot().items.map(item => item.status)).toEqual(['uncertain', 'queued'])
    expect(() => restored.pause(false)).toThrow(/uncertain/)
    restored.finish('a', 'cancelled')
    restored.pause(false)
    expect(restored.beginDispatch()?.clientMessageId).toBe('b')
  })

  it('retains completed and cancelled ID tombstones across restart, refusing changed content', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('a'), context); queue.beginDispatch(); queue.finish('a', 'delivered')
    queue.accept(request('b'), context); queue.finish('b', 'cancelled')
    const restored = new QueueStore(directory, identity)
    restored.accept(request('a'), context); restored.accept(request('b'), context)
    expect(restored.snapshot().items).toEqual([])
    expect(() => restored.accept(request('a', 'different'), context)).toThrow(/different content/)
  })

  it('refuses cancellation of a saved dispatch intent and bounded UTF-8 overflows', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('a'), context); queue.beginDispatch()
    expect(() => queue.finish('a', 'cancelled')).toThrow(/already being delivered/)
    queue.finish('a', 'delivered')
    queue.pause(true)
    const text = '😀'.repeat(450_000)
    queue.accept(request('big-a', text), context); queue.accept(request('big-b', text), context)
    expect(() => queue.accept(request('big-c', text), context)).toThrow(/limit/)
    expect(queue.snapshot().items).toHaveLength(2)
  })

  it('does not treat damaged, missing, or symlinked primary storage as an empty queue', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('a'), context)
    const bytes = fs.readFileSync(queue.filename)
    fs.writeFileSync(queue.filename, '{torn')
    expect(() => new QueueStore(directory, identity)).toThrow(/damaged/)
    fs.unlinkSync(queue.filename)
    expect(() => new QueueStore(directory, identity)).toThrow(/missing/)
    fs.writeFileSync(path.join(directory, 'other'), bytes)
    fs.symlinkSync(path.join(directory, 'other'), queue.filename)
    expect(() => new QueueStore(directory, identity)).toThrow(/Unsafe/)
  })

  it('fails closed on a publication error and on concurrent durable state changes', () => {
    const a = new QueueStore(directory, identity)
    const b = new QueueStore(directory, identity)
    a.accept(request('a'), context)
    expect(() => b.accept(request('b'), context)).toThrow(/changed/)
    expect(b.blocked).toBe(true)
    expect(b.beginDispatch()).toBeUndefined()
    const spy = vi.spyOn(RecoveryStore.prototype, 'write').mockImplementationOnce(() => { throw new Error('disk full') })
    expect(() => a.accept(request('c'), context)).toThrow('disk full')
    expect(a.snapshot()).toMatchObject({ paused: true, error: expect.stringContaining('storage failed') })
    expect(a.beginDispatch()).toBeUndefined()
    spy.mockRestore()
    expect(new QueueStore(directory, identity).snapshot().items.map(item => item.clientMessageId)).toEqual(['a'])
  })

  it('restoring an older backup quarantines every restored input rather than replaying delivered work', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('a'), context)
    const older = queue.inspect().fingerprint!
    queue.beginDispatch(); queue.finish('a', 'delivered')
    fs.writeFileSync(queue.filename, '{damaged')
    const recovery = new QueueStore(directory, identity, 'inspect')
    recovery.restore({ expectedFingerprint: recovery.inspect().fingerprint!, backupId: older })
    const restored = new QueueStore(directory, identity)
    expect(restored.snapshot()).toMatchObject({ paused: true, items: [{ clientMessageId: 'a', status: 'uncertain' }] })
    expect(() => restored.pause(false)).toThrow(/uncertain/)
    expect(restored.beginDispatch()).toBeUndefined()
  })

  it('a crash after backup restore but before quarantine still cannot replay old queued inputs', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('a'), context)
    const older = queue.inspect().fingerprint!
    queue.beginDispatch(); queue.finish('a', 'delivered')
    fs.writeFileSync(queue.filename, '{damaged')
    const recovery = new QueueStore(directory, identity, 'inspect')
    const write = RecoveryStore.prototype.write
    const spy = vi.spyOn(RecoveryStore.prototype, 'write').mockImplementation(function (this: RecoveryStore<unknown>, value, expected) {
      if (this.filename === queue.filename) throw new Error('crash before quarantine')
      return write.call(this, value, expected)
    })
    expect(() => recovery.restore({ expectedFingerprint: recovery.inspect().fingerprint!, backupId: older })).toThrow('crash before quarantine')
    spy.mockRestore()
    const restored = new QueueStore(directory, identity)
    expect(restored.snapshot()).toMatchObject({ paused: true, items: [{ clientMessageId: 'a', status: 'uncertain' }] })
    expect(restored.beginDispatch()).toBeUndefined()
  })
  it('quarantined historical inputs remain dismissible after a deliberate provider/model change', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('old-model'), context)
    const backupId = queue.inspect().fingerprint!
    queue.beginDispatch(); queue.finish('old-model', 'delivered')
    fs.writeFileSync(queue.filename, '{damaged')
    const recovery = new QueueStore(directory, identity, 'inspect')
    recovery.restore({ expectedFingerprint: recovery.inspect().fingerprint!, backupId })
    const restored = new QueueStore(directory, identity)
    expect(() => restored.assertContext(queueContext({ provider: 'claude', presetName: 'New model' }), new Set(['run-two']))).not.toThrow()
    restored.finish('old-model', 'cancelled')
    expect(restored.snapshot().items).toEqual([])
  })

  it('damaged recovery markers are visible and recoverable without making restored queued items replayable', () => {
    const queue = new QueueStore(directory, identity)
    queue.accept(request('a'), context)
    const backupId = queue.inspect().fingerprint!
    fs.writeFileSync(queue.filename, '{damaged')
    const recovery = new QueueStore(directory, identity, 'inspect')
    recovery.restore({ expectedFingerprint: recovery.inspect().fingerprint!, backupId })
    const marker = `${queue.filename}.restore-state`
    fs.writeFileSync(marker, '{damaged marker')
    expect(() => new QueueStore(directory, identity)).toThrow(/damaged/)
    const inspection = new QueueStore(directory, identity, 'inspect').inspect()
    expect(inspection).toMatchObject({ state: 'corrupt', error: expect.stringContaining('marker') })
    expect(inspection.backups.length).toBeGreaterThan(0)
    new QueueStore(directory, identity, 'inspect').restore({ expectedFingerprint: inspection.fingerprint!, backupId: inspection.backups[0].id })
    const restored = new QueueStore(directory, identity)
    expect(restored.snapshot()).toMatchObject({ paused: true, items: [{ status: 'uncertain' }] })
    expect(() => restored.pause(false)).toThrow(/uncertain/)
  })

})
