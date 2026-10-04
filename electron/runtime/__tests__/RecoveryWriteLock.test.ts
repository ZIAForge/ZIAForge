import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecoveryStore } from '../RecoveryStore'

interface Value { value: string }
function validate(value: unknown): asserts value is Value {
  if (!value || typeof value !== 'object' || !('value' in value) || typeof value.value !== 'string') throw new Error('Invalid value')
}
const worker = String.raw`
const fs = require('node:fs'); const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, file);
const [source, filename, mode, barrier, value] = process.argv.slice(1);
const { RecoveryStore } = require(source);
function pause(stage) {
  process.send({ stage });
  const until = Date.now() + 15000;
  while (!fs.existsSync(barrier)) {
    if (Date.now() > until) throw new Error('Fixture barrier timed out');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
}
if (mode === 'pause-before-claim') {
  const link = fs.linkSync; let paused = false;
  fs.linkSync = (from, to) => {
    if (!paused && String(to).includes('/write-locks/')) { paused = true; pause('before-claim'); }
    return link(from, to);
  };
}
const store = new RecoveryStore({ filename, validate: value => {
  if (!value || typeof value.value !== 'string') throw new Error('Invalid value');
} });
const publish = store.publish.bind(store);
store.publish = (file, bytes, replace) => {
  if (file === filename) {
    if (mode === 'hold-write') pause('entered');
    else process.send({ stage: 'entered' });
  }
  return publish(file, bytes, replace);
};
try { store.write({ value }); process.send({ stage: 'complete' }); }
catch (error) { process.send({ stage: 'refused', error: error.message }); }
process.disconnect();
`

describe('recovery write ownership across actual process crashes', () => {
  let directory: string
  let filename: string
  let store: RecoveryStore<Value>
  const children: ChildProcess[] = []
  beforeEach(() => {
    directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-recovery-owner-')))
    filename = path.join(directory, 'document.json')
    store = new RecoveryStore({ filename, validate })
    store.write({ value: 'original' })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    for (const child of children.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
        await new Promise<void>(resolve => child.once('close', () => resolve()))
      }
    }
    fs.rmSync(directory, { recursive: true, force: true })
  })
  function start(mode: string, value: string) {
    const barrier = path.join(directory, `release-${value}`)
    const child = spawn(process.execPath, ['-e', worker, fileURLToPath(new URL('../RecoveryStore.ts', import.meta.url)), filename, mode, barrier, value], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
    children.push(child)
    const messages: Array<{ stage: string; error?: string }> = []
    let stderr = ''
    child.stderr?.on('data', data => { stderr += String(data) })
    child.on('message', message => messages.push(message as { stage: string; error?: string }))
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()))
    async function stage(expected: string) {
      const until = Date.now() + 10000
      while (!messages.some(message => message.stage === expected)) {
        if (Date.now() > until || child.exitCode !== null || child.signalCode !== null) throw new Error(`Missing ${expected}: ${JSON.stringify(messages)} ${stderr}`)
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    return { child, messages, closed, stage, release: () => fs.writeFileSync(barrier, '') }
  }

  it('refuses an active writer, then a fresh process saves safely after that writer is SIGKILLed', async () => {
    const crashed = start('hold-write', 'uncommitted')
    await crashed.stage('entered')
    expect(() => store.write({ value: 'contender' })).toThrow(/active or unverified owner/)
    expect(store.read()).toEqual({ value: 'original' })
    crashed.child.kill('SIGKILL')
    await crashed.closed
    expect(crashed.child.signalCode).toBe('SIGKILL')
    const fresh = start('write', 'recovered')
    await fresh.stage('complete')
    await fresh.closed
    expect(fresh.child.exitCode).toBe(0)
    expect(store.read()).toEqual({ value: 'recovered' })
    expect(store.inspect().backups).toHaveLength(2)
  }, 25000)

  it('does not strand its own published lock when directory synchronization fails before the write starts', () => {
    const sync = fs.fsyncSync
    let calls = 0
    const fail = vi.spyOn(fs, 'fsyncSync').mockImplementation(fd => {
      if (++calls === 2) throw new Error('directory sync failed after lock publication')
      return sync(fd)
    })
    expect(() => store.write({ value: 'not-written' })).toThrow(/directory sync failed/)
    expect(store.read()).toEqual({ value: 'original' })
    fail.mockRestore()
    store.write({ value: 'retried' })
    expect(store.read()).toEqual({ value: 'retried' })
  })

  it('does not let a delayed contender enter an old generation after pruning while another process owns the newest lock', async () => {
    const delayed = start('pause-before-claim', 'must-not-write')
    await delayed.stage('before-claim')
    for (let index = 0; index < 12; index++) store.write({ value: `revision-${index}` })
    expect(fs.readdirSync(path.join(`${filename}.recovery`, 'write-locks')).filter(name => name.endsWith('.json'))).toHaveLength(8)
    const holder = start('hold-write', 'latest-owner')
    await holder.stage('entered')
    delayed.release()
    await delayed.stage('refused')
    await delayed.closed
    expect(delayed.messages.some(message => message.stage === 'entered')).toBe(false)
    expect(delayed.messages.find(message => message.stage === 'refused')?.error).toMatch(/active or unverified owner/)
    expect(store.read()).toEqual({ value: 'revision-11' })
    holder.release()
    await holder.stage('complete')
    await holder.closed
    expect(store.read()).toEqual({ value: 'latest-owner' })
    store.write({ value: 'next-write' })
    expect(store.read()).toEqual({ value: 'next-write' })
    expect(fs.readdirSync(path.join(`${filename}.recovery`, 'write-locks')).filter(name => name.endsWith('.json'))).toHaveLength(8)
  }, 30000)
})
