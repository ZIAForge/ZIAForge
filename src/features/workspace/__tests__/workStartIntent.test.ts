// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredTask } from '../../../../shared/legacy-ipc'
import { clearWorkStartIntent, readWorkStartIntent, saveWorkStartIntent, submitWorkCopies, type WorkStartBatch } from '../workStartIntent'

const batch = (): WorkStartBatch => ({ id: 'batch-a', accepted: [], requests: ['one', 'two'].map(id => ({
  createRequestId: id, startWorkflow: true, name: id, repoId: 'work-folder', branchType: 'Folder', description: 'Work request', provider: 'codex', providerModel: `model-${id}`,
  workOptions: { kind: 'auto', advance: 'auto', review: false, reviewers: [], inputIds: [] },
})) })
const task = (id: string): StoredTask => ({ id: `task-${id}`, repoId: `repo-${id}`, name: id, status: 'running', logs: [], workFlowVersion: 1 })
beforeEach(() => localStorage.clear())

describe('Work copy startup identity', () => {
  it('reconciles a lost response without creating an accepted copy again', async () => {
    const createTask = vi.fn().mockRejectedValueOnce(new Error('ACK lost')).mockResolvedValueOnce(task('two'))
    const lookupWorkStart = vi.fn().mockResolvedValue(task('one'))
    const initial = batch(); saveWorkStartIntent(initial)
    const result = await submitWorkCopies(initial, { createTask, lookupWorkStart }, saveWorkStartIntent)
    expect(result.batch.requests).toEqual([])
    expect(result.batch.accepted.map(item => item.id)).toEqual(['task-one', 'task-two'])
    expect(createTask.mock.calls.map(([request]) => request.createRequestId)).toEqual(['one', 'two'])
    expect(readWorkStartIntent()?.accepted).toEqual(result.batch.accepted)
  })

  it('retains only an unknown copy for retry, with its original selected model and request ID', async () => {
    const createTask = vi.fn().mockResolvedValueOnce(task('one')).mockRejectedValueOnce(new Error('network'))
    const lookupWorkStart = vi.fn().mockRejectedValue(new Error('lookup unavailable'))
    const initial = batch(); saveWorkStartIntent(initial)
    await submitWorkCopies(initial, { createTask, lookupWorkStart }, saveWorkStartIntent)
    const restored = readWorkStartIntent()!
    expect(restored.requests.map(item => item.createRequestId)).toEqual(['two'])
    expect(restored.accepted.map(item => item.id)).toEqual(['task-one'])
    createTask.mockResolvedValueOnce(task('two'))
    const result = await submitWorkCopies(restored, { createTask, lookupWorkStart }, saveWorkStartIntent)
    expect(createTask.mock.calls[2][0]).toEqual(initial.requests[1])
    expect(result.batch.accepted).toHaveLength(2)
    expect(result.batch.requests).toEqual([])
  })

  it('unlocks only definitively rejected copies while retaining successful neighbours', async () => {
    const initial = batch(); saveWorkStartIntent(initial)
    const result = await submitWorkCopies(initial, { createTask: vi.fn().mockResolvedValueOnce(task('one')).mockRejectedValueOnce(new Error('invalid model')), lookupWorkStart: vi.fn().mockResolvedValue(null) }, saveWorkStartIntent)
    expect(result.batch.accepted.map(item => item.id)).toEqual(['task-one'])
    expect(result.batch.rejected).toEqual([initial.requests[1]])
    expect(result.batch.requests).toEqual([])
  })

  it('does not continue to another copy when receipt persistence fails, and retains retry-safe original IDs', async () => {
    const initial = batch(); saveWorkStartIntent(initial)
    const createTask = vi.fn().mockResolvedValue(task('one'))
    await expect(submitWorkCopies(initial, { createTask, lookupWorkStart: vi.fn() }, () => { throw new Error('storage full') })).rejects.toThrow('storage full')
    expect(createTask).toHaveBeenCalledTimes(1)
    expect(readWorkStartIntent()?.requests).toEqual(initial.requests)
    saveWorkStartIntent({ ...initial, id: 'newer' })
    clearWorkStartIntent(initial.id)
    expect(readWorkStartIntent()?.id).toBe('newer')
  })
})
