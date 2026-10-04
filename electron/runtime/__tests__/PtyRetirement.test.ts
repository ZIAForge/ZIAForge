import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PtyRetirement } from '../PtyRetirement'
import { WorktreeRemovalGuard } from '../WorktreeRemovalGuard'
import { ProcessSupervisor, type ProcessItem } from '../ProcessSupervisor'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach(directory => fs.rmSync(directory, { recursive: true, force: true })))
function fixture() {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-retiring-pty-')))
  directories.push(cwd); fs.writeFileSync(path.join(cwd, 'task.txt'), 'preserve')
  const supervisor = { trackProcessTree: vi.fn(), terminateProcessTree: vi.fn<(pid: number, options?: { timeoutMs?: number; force?: boolean }) => Promise<boolean>>(async () => true) }
  const retiring = new PtyRetirement<{ pid: number }>(() => supervisor)
  const guard = new WorktreeRemovalGuard(() => () => {}, () => [...retiring.entries.values()].map(entry => entry.cwd))
  const entry = { sessionId: 'terminal', generation: 1, process: { pid: 12001 }, cwd }
  const remove = vi.fn(async () => fs.rmSync(cwd, { recursive: true }))
  return { cwd, entry, supervisor, retiring, guard, remove }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('retiring terminal directory ownership', () => {
  it('retains cwd after closing the active terminal until the whole owned tree is confirmed gone', async () => {
    const { cwd, entry, supervisor, retiring, guard, remove } = fixture()
    const exit = deferred<boolean>()
    supervisor.terminateProcessTree.mockImplementationOnce(() => exit.promise)
    const order: string[] = []
    supervisor.trackProcessTree.mockImplementation(() => { order.push('snapshot'); expect(retiring.entries.size).toBe(1) })
    const cleanup = retiring.retire(entry, () => { order.push('detach'); expect(retiring.entries.size).toBe(1) })
    expect(order).toEqual(['snapshot', 'detach'])
    expect(supervisor.terminateProcessTree).toHaveBeenCalledWith(entry.process.pid, undefined)
    await expect(guard.run('task', cwd, remove)).rejects.toThrow(/terminal is still attached/)
    expect(remove).not.toHaveBeenCalled(); expect(fs.existsSync(cwd)).toBe(true)
    exit.resolve(true); await cleanup
    expect(retiring.entries.size).toBe(0)
    await guard.run('task', cwd, remove)
    expect(fs.existsSync(cwd)).toBe(false)
  })

  it.each(['false', 'rejected'])('keeps failed cleanup (%s) owned and allows an explicit retry to confirm exit', async failure => {
    const { cwd, entry, supervisor, retiring, guard, remove } = fixture()
    if (failure === 'false') supervisor.terminateProcessTree.mockResolvedValueOnce(false)
    else supervisor.terminateProcessTree.mockRejectedValueOnce(new Error('Process table unavailable'))
    await expect(retiring.retire(entry, () => {})).rejects.toThrow()
    expect(retiring.entries.get('terminal:1')).toBe(entry)
    await expect(guard.run('task', cwd, remove)).rejects.toThrow(/still attached/)
    expect(fs.readFileSync(path.join(cwd, 'task.txt'), 'utf8')).toBe('preserve')
    await retiring.retire(entry, () => {}, { force: true, timeoutMs: 2000 })
    expect(supervisor.terminateProcessTree).toHaveBeenCalledTimes(2)
    expect(retiring.entries.size).toBe(0)
  })

  it('does not forget ownership or detach when the initial process snapshot fails', async () => {
    const { entry, supervisor, retiring } = fixture()
    supervisor.trackProcessTree.mockImplementationOnce(() => { throw new Error('Cannot observe process identity') })
    const detach = vi.fn()
    await expect(retiring.retire(entry, detach)).rejects.toThrow(/identity/)
    expect(detach).not.toHaveBeenCalled()
    expect(supervisor.terminateProcessTree).not.toHaveBeenCalled()
    expect(retiring.entries.get('terminal:1')).toBe(entry)
    await retiring.retire(entry, detach)
    expect(detach).toHaveBeenCalledTimes(1)
  })

  it('deduplicates close, project removal and Quit without signalling another generation', async () => {
    const { entry, supervisor, retiring } = fixture()
    const oldExit = deferred<boolean>(), newExit = deferred<boolean>()
    supervisor.terminateProcessTree.mockImplementationOnce(() => oldExit.promise).mockImplementationOnce(() => newExit.promise)
    const detach = vi.fn()
    const original = retiring.retire(entry, detach)
    const repeated = retiring.retire(entry, detach, { force: true, timeoutMs: 2000 })
    expect(repeated).toBe(original); expect(detach).toHaveBeenCalledTimes(1)
    const replacement = { ...entry, generation: 2, process: { pid: 12002 }, cwd: `${entry.cwd}-replacement` }
    const newer = retiring.retire(replacement, () => {})
    await expect(retiring.retire({ ...entry, process: { pid: 99999 } }, () => {})).rejects.toThrow(/another process/)
    expect(supervisor.terminateProcessTree.mock.calls.map(call => call[0])).toEqual([12001, 12002])
    oldExit.resolve(true); await original
    expect(retiring.entries.get('terminal:2')).toBe(replacement)
    newExit.resolve(true); await newer
    expect(retiring.entries.size).toBe(0)
  })

  it('cleans a new owned shell after natural exit and PID reuse without discarding old orphan ownership', async () => {
    const { entry } = fixture()
    let table: ProcessItem[] = [
      { pid: 12001, ppid: 1, command: 'shell', generation: 'old-shell' },
      { pid: 12002, ppid: 12001, command: 'old-child', generation: 'old-child' },
      { pid: 19000, ppid: 1, command: 'unrelated', generation: 'unrelated' },
    ]
    const signals: Array<{ pid: number; generation: ProcessItem['generation'] }> = []
    const retiring = new PtyRetirement<{ pid: number }>(() => new ProcessSupervisor({
      getProcessListFn: () => table,
      killFn: (pid, signal) => {
        const current = table.find(item => item.pid === pid)
        if (!current) throw Object.assign(new Error('gone'), { code: 'ESRCH' })
        if (signal === 0) return
        signals.push({ pid, generation: current.generation })
        // The old orphan remains alive while another generation reuses its parent's PID.
        if (pid !== 12002) table = table.filter(item => item.pid !== pid)
      },
    }))
    retiring.track(entry)
    table = table.filter(item => item.pid !== 12001).map(item => item.pid === 12002 ? { ...item, ppid: 1 } : item)
    const oldCleanup = retiring.retire(entry, () => {}, { timeoutMs: 100 })
    const replacement = { ...entry, generation: 2, process: { pid: 12001 } }
    table.push({ pid: 12001, ppid: 1, command: 'shell', generation: 'new-shell' }, { pid: 12003, ppid: 12001, command: 'new-child', generation: 'new-child' })
    retiring.track(replacement)
    await retiring.retire(replacement, () => {}, { timeoutMs: 100 })
    expect(signals).toContainEqual({ pid: 12001, generation: 'new-shell' })
    expect(signals).toContainEqual({ pid: 12003, generation: 'new-child' })
    expect(signals.some(signal => signal.pid === 19000)).toBe(false)
    expect(retiring.entries.get('terminal:1')).toBe(entry)
    expect(table.map(item => item.pid)).toEqual([12002, 19000])
    table = table.filter(item => item.pid !== 12002)
    await oldCleanup
    expect(retiring.entries.size).toBe(0)
    expect(table.map(item => item.pid)).toEqual([19000])
  })
})
