import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecoveryRequiredError, RecoveryStore } from '../RecoveryStore'
import { validateStoredWorkflow } from '../../workflow/WorkflowValidation'
import type { WorkflowSnapshot } from '../../../shared/workflow'

interface Settings { language: 'en' | 'ru'; enabled: boolean }
function validateSettings(value: unknown): asserts value is Settings {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'enabled,language' || !('language' in value) || !['en', 'ru'].includes(String(value.language)) || !('enabled' in value) || typeof value.enabled !== 'boolean') throw new Error('Invalid settings')
}
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex')

describe('explicit durable metadata recovery', () => {
  let directory: string
  let filename: string
  let store: RecoveryStore<Settings>
  beforeEach(() => {
    directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-recovery-')))
    filename = path.join(directory, 'settings.json')
    store = new RecoveryStore({ filename, validate: validateSettings })
  })
  afterEach(() => { vi.restoreAllMocks(); fs.rmSync(directory, { recursive: true, force: true }) })

  it('distinguishes absence from corrupt settings and never silently rewrites damage', () => {
    expect(store.read()).toBeNull()
    expect(store.inspect()).toEqual({ state: 'missing', fingerprint: null, backups: [], invalidBackups: 0 })
    const bytes = Buffer.from('{"language":"ru",\xff', 'binary')
    fs.writeFileSync(filename, bytes)
    expect(() => store.read()).toThrow(RecoveryRequiredError)
    expect(() => store.write({ language: 'en', enabled: true })).toThrow(RecoveryRequiredError)
    expect(fs.readFileSync(filename)).toEqual(bytes)
    expect(store.inspect()).toMatchObject({ state: 'corrupt', fingerprint: sha(bytes), backups: [] })
  })

  it('restores a selected validated revision, preserves exact damaged bytes and private permissions', () => {
    store.write({ language: 'ru', enabled: true }, null)
    const original = fs.readFileSync(filename)
    const originalId = store.inspect().fingerprint!
    store.write({ language: 'en', enabled: false }, originalId)
    const damaged = Buffer.from('{"language":')
    fs.writeFileSync(filename, damaged)
    const inspection = store.inspect()
    expect(inspection.backups).toHaveLength(2)
    const receipt = store.restore({ expectedFingerprint: inspection.fingerprint!, backupId: originalId })
    expect(receipt).toEqual({ fingerprint: originalId, preservedFingerprint: sha(damaged) })
    expect(fs.readFileSync(filename)).toEqual(original)
    expect(store.read()).toEqual({ language: 'ru', enabled: true })
    const archive = path.join(`${filename}.recovery`, `${receipt.preservedFingerprint}.damaged`)
    expect(fs.readFileSync(archive)).toEqual(damaged)
    for (const file of [filename, archive, path.join(`${filename}.recovery`, `${originalId}.json`)]) expect(fs.statSync(file).mode & 0o777).toBe(0o600)
  })

  it('refuses stale restoration, changed edits, valid primary rollback and arbitrary backup paths', () => {
    store.write({ language: 'ru', enabled: true })
    const id = store.inspect().fingerprint!
    expect(() => store.write({ language: 'en', enabled: true }, '0'.repeat(64))).toThrow(/changed/)
    expect(() => store.restore({ expectedFingerprint: id, backupId: id })).toThrow(/Only damaged/)
    fs.writeFileSync(filename, 'broken-one')
    const observed = store.inspect().fingerprint!
    fs.writeFileSync(filename, 'broken-two')
    expect(() => store.restore({ expectedFingerprint: observed, backupId: id })).toThrow(/changed/)
    expect(() => store.restore({ expectedFingerprint: sha('broken-two'), backupId: '../settings.json' })).toThrow(/Invalid recovery/)
    expect(fs.readFileSync(filename, 'utf8')).toBe('broken-two')
  })

  it('excludes torn, mismatched and schema-invalid backups without modifying them', () => {
    store.write({ language: 'ru', enabled: true })
    const savedId = store.inspect().fingerprint!
    const recovery = `${filename}.recovery`
    const invalid = [Buffer.from('{'), Buffer.from(JSON.stringify({ language: 'de', enabled: true })), Buffer.from(JSON.stringify({ language: 'ru', enabled: true, unexpected: true }))]
    for (const bytes of invalid) fs.writeFileSync(path.join(recovery, `${sha(bytes)}.json`), bytes)
    fs.writeFileSync(path.join(recovery, `${'0'.repeat(64)}.json`), '{}')
    const report = store.inspect()
    expect(report.backups.map(item => item.id)).toEqual([savedId])
    expect(report.invalidBackups).toBe(4)
    fs.writeFileSync(filename, '{')
    expect(() => store.restore({ expectedFingerprint: sha('{'), backupId: sha(invalid[1]) })).toThrow(/validation/)
    expect(fs.readFileSync(path.join(recovery, `${sha(invalid[1])}.json`))).toEqual(invalid[1])
  })

  it('uses the real workflow validator including identity and completion evidence', () => {
    const workflowFile = path.join(directory, 'workflow.json')
    const workflow = new RecoveryStore<WorkflowSnapshot>({ filename: workflowFile, validate: (value): asserts value is WorkflowSnapshot => validateStoredWorkflow(value, 'task-one') })
    const draft: WorkflowSnapshot = { schemaVersion: 1, taskId: 'task-one', runId: 'workflow-one', revision: 1, sequence: 1, plan: { title: 'Plan', coderPreset: 'Coder', advance: 'manual', review: false, maxFailures: 3, maxIterations: 10, steps: [] }, status: 'draft', iterations: 0, steps: [], updatedAt: Date.now(), commandIds: [] }
    workflow.write(draft)
    expect(() => workflow.write({ ...draft, taskId: 'task-other' })).toThrow(/saved workflow/)
    expect(() => workflow.write({ ...draft, status: 'completed' })).toThrow(/completion/)
    expect(workflow.read()).toEqual(draft)
  })

  it('preserves the primary when publication fails, and records the damaged bytes before failed restoration', () => {
    store.write({ language: 'ru', enabled: true })
    const saved = fs.readFileSync(filename)
    const backupId = sha(saved)
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('simulated disk failure') })
    expect(() => store.write({ language: 'en', enabled: false })).toThrow('simulated disk failure')
    expect(fs.readFileSync(filename)).toEqual(saved)
    fs.writeFileSync(filename, 'damaged')
    expect(() => store.restore({ expectedFingerprint: sha('damaged'), backupId })).toThrow('simulated disk failure')
    expect(fs.readFileSync(filename, 'utf8')).toBe('damaged')
    expect(fs.readFileSync(path.join(`${filename}.recovery`, `${sha('damaged')}.damaged`), 'utf8')).toBe('damaged')
    rename.mockRestore()
    expect(fs.readdirSync(directory).some(name => name.endsWith('.tmp'))).toBe(false)
    expect(fs.existsSync(path.join(`${filename}.recovery`, 'write.lock'))).toBe(false)
  })

  it('refuses symlinks and concurrent/stale lock ownership without touching outside data', () => {
    const outside = path.join(directory, 'outside.json')
    fs.writeFileSync(outside, 'outside')
    fs.symlinkSync(outside, filename)
    expect(() => store.read()).toThrow(/Unsafe/)
    fs.unlinkSync(filename)
    store.write({ language: 'ru', enabled: true })
    const lock = path.join(`${filename}.recovery`, 'write.lock')
    fs.mkdirSync(lock)
    expect(() => store.write({ language: 'en', enabled: true })).toThrow()
    expect(fs.existsSync(lock)).toBe(true)
    fs.rmdirSync(lock)
    fs.symlinkSync(outside, path.join(`${filename}.recovery`, `${'0'.repeat(64)}.json`))
    expect(() => store.inspect()).toThrow(/Unsafe/)
    expect(fs.readFileSync(outside, 'utf8')).toBe('outside')
  })

  it('bounds stored revisions and document size while retaining current data and damaged archives', () => {
    store = new RecoveryStore({ filename, validate: validateSettings, retainedBackups: 2, maxBytes: 100 })
    store.write({ language: 'ru', enabled: true })
    store.write({ language: 'en', enabled: true })
    store.write({ language: 'en', enabled: false })
    const current = store.inspect()
    expect(current.backups).toHaveLength(2)
    expect(current.backups.some(item => item.id === current.fingerprint)).toBe(true)
    fs.writeFileSync(filename, 'damaged')
    store.restore({ expectedFingerprint: sha('damaged'), backupId: current.fingerprint! })
    store.write({ language: 'ru', enabled: false })
    expect(fs.readFileSync(path.join(`${filename}.recovery`, `${sha('damaged')}.damaged`), 'utf8')).toBe('damaged')
    fs.writeFileSync(filename, 'a'.repeat(101))
    expect(() => store.read()).toThrow(/size limit/)
    expect(fs.statSync(filename).size).toBe(101)
  })
})
