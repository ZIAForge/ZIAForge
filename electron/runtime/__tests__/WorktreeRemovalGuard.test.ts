import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureWorkingDirectory, WorktreeRemovalGuard } from '../WorktreeRemovalGuard'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach(directory => fs.rmSync(directory, { recursive: true, force: true })))
function directory() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-worktree-guard-')))
  directories.push(root)
  const cwd = path.join(root, 'worktrees', 'task')
  fs.mkdirSync(cwd, { recursive: true }); fs.writeFileSync(path.join(cwd, 'result.txt'), 'preserve task result')
  return cwd
}

describe('worktree directory ownership guard', () => {
  it.each(['deleted', 'replaced', 'symlink'])('refuses a %s directory at the final pre-spawn check', change => {
    const cwd = directory()
    const revalidate = captureWorkingDirectory(cwd)
    expect(() => revalidate()).not.toThrow()
    fs.renameSync(cwd, `${cwd}-original`)
    if (change === 'replaced') fs.mkdirSync(cwd)
    if (change === 'symlink') fs.symlinkSync(`${cwd}-original`, cwd)
    expect(() => revalidate()).toThrow()
    expect(fs.readFileSync(path.join(`${cwd}-original`, 'result.txt'), 'utf8')).toBe('preserve task result')
  })

  it.each(['', 'nested'])('refuses deletion while a terminal owns the worktree or its %s directory', async child => {
    const cwd = directory()
    const reserve = vi.fn(() => vi.fn())
    const guard = new WorktreeRemovalGuard(reserve, () => [path.join(cwd, child)])
    const remove = vi.fn(async () => fs.rmSync(cwd, { recursive: true }))
    await expect(guard.run('task', cwd, remove)).rejects.toThrow(/terminal is still attached/)
    expect(remove).not.toHaveBeenCalled(); expect(reserve).not.toHaveBeenCalled()
    expect(fs.readFileSync(path.join(cwd, 'result.txt'), 'utf8')).toBe('preserve task result')
  })

  it('preserves the directory when the native session reservation refuses an idle process', async () => {
    const cwd = directory()
    const guard = new WorktreeRemovalGuard(() => { throw new Error('A session is still attached') }, () => [])
    const remove = vi.fn(async () => fs.rmSync(cwd, { recursive: true }))
    await expect(guard.run('task', cwd, remove)).rejects.toThrow(/session is still attached/)
    expect(remove).not.toHaveBeenCalled(); expect(fs.existsSync(cwd)).toBe(true)
    expect(() => guard.assertTerminalAvailable(cwd)).not.toThrow()
  })

  it.each([false, true])('fences new terminals through awaited Git removal and releases on failure=%s', async fails => {
    const cwd = directory(), sibling = `${cwd}-other`
    const release = vi.fn()
    const guard = new WorktreeRemovalGuard(() => release, () => [sibling])
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    const removal = guard.run('task', cwd, async () => {
      await pending
      if (fails) throw new Error('Git refused removal')
      fs.rmSync(cwd, { recursive: true })
      return 'saved receipt'
    })
    expect(() => guard.assertTerminalAvailable(cwd)).toThrow(/removal is in progress/)
    expect(() => guard.assertTerminalAvailable(path.join(cwd, 'nested'))).toThrow(/removal is in progress/)
    expect(() => guard.assertTerminalAvailable(sibling)).not.toThrow()
    expect(release).not.toHaveBeenCalled(); expect(fs.existsSync(cwd)).toBe(true)
    finish()
    if (fails) await expect(removal).rejects.toThrow(/Git refused/)
    else await expect(removal).resolves.toBe('saved receipt')
    expect(release).toHaveBeenCalledTimes(1)
    expect(() => guard.assertTerminalAvailable(cwd)).not.toThrow()
    expect(fs.existsSync(cwd)).toBe(fails)
  })
})
