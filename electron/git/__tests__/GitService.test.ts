import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitService, type TrustedGitTask } from '../GitService'
import { validateGitCommand } from '../GitValidation'
import { WorktreeRemovalGuard } from '../../runtime/WorktreeRemovalGuard'
import type { GitOperationReceipt } from '../../../shared/git'

const environments: Array<{ root: string; services: GitService[] }> = []
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' }
function git(cwd: string, ...args: string[]): string {
  return execFileSync('/usr/bin/git', ['-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false', '-C', cwd, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function fixture(mode: TrustedGitTask['mode'] = 'worktree') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-git-')))
  const repoPath = path.join(root, 'source'), projectPath = path.join(root, 'project')
  fs.mkdirSync(repoPath); fs.mkdirSync(projectPath)
  git(repoPath, 'init', '--template=', '-b', 'main')
  git(repoPath, 'config', 'user.name', 'ZIAForge fixture'); git(repoPath, 'config', 'user.email', 'fixture@localhost')
  git(repoPath, 'config', 'commit.gpgsign', 'false')
  fs.writeFileSync(path.join(repoPath, 'file.txt'), 'base\n')
  fs.writeFileSync(path.join(repoPath, 'other.txt'), 'other base\n')
  fs.writeFileSync(path.join(repoPath, '.gitignore'), 'cache/\n')
  git(repoPath, 'add', '.'); git(repoPath, 'commit', '-m', 'Initial fixture')
  const task: TrustedGitTask = { taskId: 'task', projectPath, repoPath, worktreePath: path.join(projectPath, 'worktrees', 'task'), branch: 'feature/selected', baseRef: 'main', mode, createBranch: true }
  const group = { root, services: [] as GitService[] }; environments.push(group)
  const directory = path.join(root, 'receipts')
  const fresh = () => {
    const service = new GitService({ directory, resolveTask: id => { if (id !== task.taskId) throw new Error('Task is not registered'); return { ...task } }, env: () => ({ ...env }) })
    group.services.push(service); return service
  }
  const service = fresh()
  return { root, directory, task, repoPath, projectPath, service, fresh }
}
afterEach(async () => {
  for (const group of environments.splice(0)) {
    await Promise.all(group.services.map(service => service.shutdown()))
    fs.rmSync(group.root, { recursive: true, force: true })
  }
}, 30000)
async function commit(service: GitService, cwd: string, content = 'task result\n', operationId = 'commit-result') {
  fs.writeFileSync(path.join(cwd, 'file.txt'), content)
  const status = await service.status({ taskId: 'task' })
  const request = { taskId: 'task', operationId, expectedHead: status.head, expectedStatusFingerprint: status.fingerprint, message: 'Save verified task result', paths: ['file.txt'] }
  const receipt = await service.commit(request)
  expect(receipt.status).toBe('succeeded')
  return { receipt, request }
}
function interruptedReceipt(directory: string, receipt: GitOperationReceipt) {
  fs.writeFileSync(path.join(directory, 'tasks/task/operations', `${receipt.operationId}.json`), JSON.stringify({ ...receipt, status: 'pending', afterHead: undefined, finishedAt: undefined }))
}

describe('real task Git lifecycle', () => {
  it('binds the selected worktree branch and base revision while preserving a dirty source checkout', async () => {
    const { task, repoPath, service } = fixture()
    git(repoPath, 'switch', '-c', 'selected-base')
    fs.writeFileSync(path.join(repoPath, 'base-only.txt'), 'selected base\n'); git(repoPath, 'add', '.'); git(repoPath, 'commit', '-m', 'Selected base')
    const baseRevision = git(repoPath, 'rev-parse', 'HEAD'); git(repoPath, 'switch', 'main')
    fs.writeFileSync(path.join(repoPath, 'file.txt'), 'outside task, preserve me\n')
    const dirty = git(repoPath, 'status', '--porcelain=v1')
    task.baseRef = 'selected-base'
    const binding = await service.prepare({ taskId: 'task' })
    expect(binding).toMatchObject({ branch: 'feature/selected', baseBranch: 'selected-base', baseRevision, cwd: task.worktreePath, mode: 'worktree' })
    expect(fs.readFileSync(path.join(binding.cwd, 'base-only.txt'), 'utf8')).toBe('selected base\n')
    expect(git(repoPath, 'status', '--porcelain=v1')).toBe(dirty)
    expect(fs.readFileSync(path.join(repoPath, 'file.txt'), 'utf8')).toBe('outside task, preserve me\n')
    expect((await service.status({ taskId: 'task' })).clean).toBe(true)
    expect(await service.prepare({ taskId: 'task' })).toEqual(binding)
  }, 60000)

  it('uses Branch mode in the source checkout and merges into a separate recoverable target worktree', async () => {
    const { repoPath, service } = fixture('branch')
    const base = git(repoPath, 'rev-parse', 'HEAD')
    const binding = await service.prepare({ taskId: 'task' })
    expect(binding.cwd).toBe(repoPath)
    expect(git(repoPath, 'branch', '--show-current')).toBe('feature/selected')
    const { receipt } = await commit(service, binding.cwd)
    const merged = await service.merge({ taskId: 'task', operationId: 'merge-branch', expectedHead: receipt.afterHead!, targetBranch: 'main', expectedTargetHead: base })
    expect(merged.status).toBe('succeeded')
    expect(merged.targetPath).not.toBe(repoPath)
    expect(fs.existsSync(merged.targetPath!)).toBe(true)
    expect(git(repoPath, 'branch', '--show-current')).toBe('feature/selected')
    expect(git(repoPath, 'show', 'main:file.txt')).toBe('task result')
  }, 60000)

  it('adopts a trusted dirty legacy worktree without changing HEAD, staged, unstaged or untracked data', async () => {
    const { service, task, repoPath, fresh } = fixture()
    fs.mkdirSync(path.dirname(task.worktreePath), { recursive: true })
    git(repoPath, 'worktree', 'add', '-b', task.branch, task.worktreePath, 'main')
    fs.writeFileSync(path.join(task.worktreePath, 'file.txt'), 'legacy staged\n'); git(task.worktreePath, 'add', 'file.txt')
    fs.writeFileSync(path.join(task.worktreePath, 'file.txt'), 'legacy staged plus later edit\n')
    fs.writeFileSync(path.join(task.worktreePath, 'untracked.txt'), 'user notes\n')
    const before = { head: git(task.worktreePath, 'rev-parse', 'HEAD'), index: git(task.worktreePath, 'write-tree'), status: git(task.worktreePath, 'status', '--porcelain=v1') }
    await expect(service.prepare({ taskId: 'task' })).rejects.toThrow('legacy task identity')
    task.adoptExisting = true
    const binding = await service.prepare({ taskId: 'task' })
    expect(binding.adopted).toMatchObject({ head: before.head, fingerprint: expect.any(String) })
    expect(git(task.worktreePath, 'rev-parse', 'HEAD')).toBe(before.head)
    expect(git(task.worktreePath, 'write-tree')).toBe(before.index)
    expect(git(task.worktreePath, 'status', '--porcelain=v1')).toBe(before.status)
    expect(fs.readFileSync(path.join(task.worktreePath, 'file.txt'), 'utf8')).toBe('legacy staged plus later edit\n')
    expect(fs.readFileSync(path.join(task.worktreePath, 'untracked.txt'), 'utf8')).toBe('user notes\n')
    expect((await fresh().status({ taskId: 'task' })).fingerprint).toBe(binding.adopted!.fingerprint)
  }, 60000)

  it.each(['dirty', 'detached', 'nonexistent'] as const)('refuses unsafe Branch preparation: %s', async reason => {
    const { task, repoPath, service } = fixture('branch')
    if (reason === 'dirty') fs.writeFileSync(path.join(repoPath, 'file.txt'), 'preserve\n')
    if (reason === 'detached') git(repoPath, 'checkout', '--detach')
    if (reason === 'nonexistent') task.createBranch = false
    const before = git(repoPath, 'status', '--porcelain=v1'), head = git(repoPath, 'rev-parse', 'HEAD')
    await expect(service.prepare({ taskId: 'task' })).rejects.toThrow()
    expect(git(repoPath, 'status', '--porcelain=v1')).toBe(before)
    expect(git(repoPath, 'rev-parse', 'HEAD')).toBe(head)
  }, 30000)

  it.each([false, true])('preserves ignored local bytes when switching to a branch that tracks them (new branch: %s)', async createBranch => {
    const { task, repoPath, service } = fixture('branch')
    git(repoPath, 'switch', '-c', 'target')
    fs.mkdirSync(path.join(repoPath, 'cache')); fs.writeFileSync(path.join(repoPath, 'cache/ignored.txt'), 'target committed data\n')
    git(repoPath, 'add', '-f', 'cache/ignored.txt'); git(repoPath, 'commit', '-m', 'Target tracks file'); git(repoPath, 'switch', 'main')
    fs.mkdirSync(path.join(repoPath, 'cache'), { recursive: true }); fs.writeFileSync(path.join(repoPath, 'cache/ignored.txt'), 'local unsaved data\n')
    task.branch = createBranch ? 'new-from-target' : 'target'; task.baseRef = 'target'; task.createBranch = createBranch
    expect(git(repoPath, 'status', '--porcelain=v1')).toBe('')
    const before = git(repoPath, 'rev-parse', 'HEAD')
    await expect(service.prepare({ taskId: 'task' })).rejects.toThrow()
    expect(git(repoPath, 'rev-parse', 'HEAD')).toBe(before)
    expect(fs.readFileSync(path.join(repoPath, 'cache/ignored.txt'), 'utf8')).toBe('local unsaved data\n')
  }, 30000)

  it.each(['add', 'write-tree'])('never commits concurrent unreviewed file edits after %s', async barrier => {
    const { service } = fixture()
    const { cwd } = await service.prepare({ taskId: 'task' })
    fs.writeFileSync(path.join(cwd, 'file.txt'), 'reviewed bytes\n')
    fs.writeFileSync(path.join(cwd, 'other.txt'), 'unrelated staged bytes\n'); git(cwd, 'add', 'other.txt')
    const before = await service.status({ taskId: 'task' })
    const internal = service as unknown as { change(cwd: string, args: string[], indexFile?: string): Promise<{ code: number; stdout: string; stderr: string }> }
    const actual = internal.change.bind(service)
    let injected = false
    vi.spyOn(internal, 'change').mockImplementation(async (directory, args, indexFile) => {
      const result = await actual(directory, args, indexFile)
      if (args[0] === barrier && !injected) { injected = true; fs.writeFileSync(path.join(cwd, 'file.txt'), 'concurrent unreviewed bytes\n') }
      return result
    })
    const receipt = await service.commit({ taskId: 'task', operationId: 'concurrent-edit', expectedHead: before.head, expectedStatusFingerprint: before.fingerprint, message: 'Reviewed only', paths: ['file.txt'] })
    expect(injected).toBe(true)
    expect(fs.readFileSync(path.join(cwd, 'file.txt'), 'utf8')).toBe('concurrent unreviewed bytes\n')
    expect(git(cwd, 'show', ':other.txt')).toBe('unrelated staged bytes')
    if (barrier === 'add') {
      expect(receipt.status).toBe('failed'); expect(receipt.error).toContain('changed while staging')
      expect(git(cwd, 'rev-parse', 'HEAD')).toBe(before.head)
    } else {
      expect(receipt.status).toBe('succeeded')
      expect(git(cwd, 'show', 'HEAD:file.txt')).toBe('reviewed bytes')
      expect(git(cwd, 'show', 'HEAD:other.txt')).toBe('other base')
      expect(git(cwd, 'diff', '--', 'file.txt')).toContain('+concurrent unreviewed bytes')
    }
    expect(fs.existsSync(git(cwd, 'rev-parse', '--path-format=absolute', '--git-path', 'index') + '.lock')).toBe(false)
  }, 90000)

  it('commits exactly selected paths, preserves unrelated staged changes and recovers an interrupted receipt without a second commit', async () => {
    const { service, fresh, directory } = fixture()
    const { cwd } = await service.prepare({ taskId: 'task' })
    fs.writeFileSync(path.join(cwd, 'other.txt'), 'someone else staged this\n'); git(cwd, 'add', 'other.txt')
    const selected = 'new Unicode Ж file.txt'
    fs.writeFileSync(path.join(cwd, selected), 'selected content\n')
    const status = await service.status({ taskId: 'task' })
    expect((await service.diff({ taskId: 'task', scope: 'working', path: selected })).text).toContain('+selected content')
    const request = { taskId: 'task', operationId: 'selected', expectedHead: status.head, expectedStatusFingerprint: status.fingerprint, message: 'Selected files only', paths: [selected] }
    const [first, concurrent] = await Promise.all([service.commit(request), service.commit(request)])
    expect(first.status).toBe('succeeded'); expect(concurrent).toEqual(first)
    expect(git(cwd, 'show', `HEAD:${selected}`)).toBe('selected content')
    expect(git(cwd, 'show', 'HEAD:other.txt')).toBe('other base')
    expect(git(cwd, 'show', ':other.txt')).toBe('someone else staged this')
    expect(git(cwd, 'rev-list', '--count', 'HEAD')).toBe('2')
    interruptedReceipt(directory, first)
    await service.shutdown()
    const recovered = await fresh().commit(request)
    expect(recovered).toMatchObject({ status: 'succeeded', afterHead: first.afterHead, recovered: true })
    expect(git(cwd, 'rev-list', '--count', 'HEAD')).toBe('2')
    await expect(fresh().commit({ ...request, message: 'Different request' })).rejects.toThrow('reused')
  }, 60000)

  it('refuses a changed review fingerprint before staging or committing and retains the failed receipt', async () => {
    const { service, fresh } = fixture()
    const { cwd } = await service.prepare({ taskId: 'task' })
    fs.writeFileSync(path.join(cwd, 'file.txt'), 'reviewed\n')
    const before = await service.status({ taskId: 'task' })
    fs.writeFileSync(path.join(cwd, 'file.txt'), 'changed after review\n')
    const request = { taskId: 'task', operationId: 'stale', expectedHead: before.head, expectedStatusFingerprint: before.fingerprint, message: 'Must not commit', paths: ['file.txt'] }
    const receipt = await service.commit(request)
    expect(receipt.status).toBe('failed'); expect(receipt.error).toMatch(/changed since/)
    expect(git(cwd, 'rev-parse', 'HEAD')).toBe(before.head)
    expect(git(cwd, 'diff', '--cached')).toBe('')
    expect(fs.readFileSync(path.join(cwd, 'file.txt'), 'utf8')).toBe('changed after review\n')
    expect(await fresh().commit(request)).toEqual(receipt)
  }, 60000)

  it('commits a selected rename as one change, including the original deletion and preserving unrelated staging', async () => {
    const { service } = fixture(), { cwd } = await service.prepare({ taskId: 'task' })
    git(cwd, 'mv', 'file.txt', 'renamed.txt')
    fs.writeFileSync(path.join(cwd, 'other.txt'), 'unrelated staged'); git(cwd, 'add', 'other.txt')
    const status = await service.status({ taskId: 'task' })
    expect(status.changes.find(change => change.path === 'renamed.txt')?.originalPath).toBe('file.txt')
    const receipt = await service.commit({ taskId: 'task', operationId: 'rename', expectedHead: status.head, expectedStatusFingerprint: status.fingerprint, message: 'Rename selected file', paths: ['renamed.txt'] })
    expect(receipt.status).toBe('succeeded')
    expect(git(cwd, 'ls-tree', '--name-only', 'HEAD')).not.toContain('file.txt')
    expect(git(cwd, 'show', 'HEAD:renamed.txt')).toBe('base')
    expect(git(cwd, 'show', ':other.txt')).toBe('unrelated staged')
    expect(git(cwd, 'show', 'HEAD:other.txt')).toBe('other base')
    expect((await service.status({ taskId: 'task' })).changes).toHaveLength(1)
  }, 60000)

  it('merges actual commits, preserves ignored target data and makes retry across restart idempotent', async () => {
    const { service, fresh, directory, repoPath } = fixture()
    const binding = await service.prepare({ taskId: 'task' })
    const { receipt } = await commit(service, binding.cwd)
    fs.mkdirSync(path.join(repoPath, 'cache')); fs.writeFileSync(path.join(repoPath, 'cache', 'private.txt'), 'keep ignored data')
    const request = { taskId: 'task', operationId: 'merge', expectedHead: receipt.afterHead!, targetBranch: 'main', expectedTargetHead: git(repoPath, 'rev-parse', 'HEAD') }
    const merged = await service.merge(request)
    expect(merged.status).toBe('succeeded')
    expect(git(repoPath, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ')).toHaveLength(3)
    expect(fs.readFileSync(path.join(repoPath, 'cache/private.txt'), 'utf8')).toBe('keep ignored data')
    interruptedReceipt(directory, merged)
    expect(await fresh().merge(request)).toMatchObject({ status: 'succeeded', afterHead: merged.afterHead, recovered: true })
    expect(git(repoPath, 'rev-parse', 'HEAD')).toBe(merged.afterHead)
  }, 60000)

  it('refuses a dirty merge target without changing its index, files or branch', async () => {
    const { service, repoPath } = fixture()
    const binding = await service.prepare({ taskId: 'task' }); const { receipt } = await commit(service, binding.cwd)
    fs.writeFileSync(path.join(repoPath, 'other.txt'), 'third-party staged\n'); git(repoPath, 'add', 'other.txt')
    fs.writeFileSync(path.join(repoPath, 'file.txt'), 'third-party unstaged\n')
    const index = git(repoPath, 'write-tree'), head = git(repoPath, 'rev-parse', 'HEAD'), status = git(repoPath, 'status', '--porcelain=v1')
    const merged = await service.merge({ taskId: 'task', operationId: 'dirty-merge', expectedHead: receipt.afterHead!, targetBranch: 'main', expectedTargetHead: head })
    expect(merged.status).toBe('failed'); expect(merged.error).toMatch(/local changes/)
    expect(git(repoPath, 'write-tree')).toBe(index); expect(git(repoPath, 'rev-parse', 'HEAD')).toBe(head)
    expect(git(repoPath, 'status', '--porcelain=v1')).toBe(status)
    expect(fs.readFileSync(path.join(repoPath, 'file.txt'), 'utf8')).toBe('third-party unstaged\n')
  }, 60000)

  it('keeps genuine merge conflicts and MERGE_HEAD available for user recovery', async () => {
    const { service, repoPath, fresh } = fixture()
    const { cwd } = await service.prepare({ taskId: 'task' }); const { receipt } = await commit(service, cwd, 'task side\n')
    fs.writeFileSync(path.join(repoPath, 'file.txt'), 'target side\n'); git(repoPath, 'add', 'file.txt'); git(repoPath, 'commit', '-m', 'Independent change')
    const head = git(repoPath, 'rev-parse', 'HEAD')
    const request = { taskId: 'task', operationId: 'conflict', expectedHead: receipt.afterHead!, targetBranch: 'main', expectedTargetHead: head }
    const merged = await service.merge(request)
    expect(merged.status).toBe('conflicted')
    expect(git(repoPath, 'rev-parse', 'MERGE_HEAD')).toBe(receipt.afterHead)
    expect(fs.readFileSync(path.join(repoPath, 'file.txt'), 'utf8')).toContain('<<<<<<<')
    expect(git(repoPath, 'rev-parse', 'HEAD')).toBe(head)
    expect(await fresh().merge(request)).toEqual(merged)
  }, 60000)

  it('confirms the pushed remote revision, never repeats the push on retry, and reports a remote rejection', async () => {
    const { service, repoPath, root, fresh } = fixture()
    const { cwd } = await service.prepare({ taskId: 'task' }); const { receipt } = await commit(service, cwd)
    const remote = path.join(root, 'remote.git'); fs.mkdirSync(remote); git(remote, 'init', '--bare', '--template=')
    fs.mkdirSync(path.join(remote, 'hooks'))
    git(repoPath, 'remote', 'add', 'origin', remote)
    const counter = path.join(root, 'push-count')
    fs.writeFileSync(path.join(remote, 'hooks/pre-receive'), `#!/bin/sh\necho accepted >> '${counter}'\n`, { mode: 0o700 })
    const request = { taskId: 'task', operationId: 'push', expectedHead: receipt.afterHead!, remote: 'origin' }
    const pushed = await service.push(request)
    expect(pushed.status).toBe('succeeded')
    expect(git(remote, 'rev-parse', 'refs/heads/feature/selected')).toBe(receipt.afterHead)
    expect(await fresh().push(request)).toEqual(pushed)
    expect(fs.readFileSync(counter, 'utf8').trim().split('\n')).toHaveLength(1)
    fs.writeFileSync(path.join(remote, 'hooks/pre-receive'), '#!/bin/sh\necho fixture-rejection >&2\nexit 1\n', { mode: 0o700 })
    const next = await commit(service, cwd, 'new revision\n', 'second-commit')
    const rejected = await service.push({ ...request, operationId: 'rejected-push', expectedHead: next.receipt.afterHead! })
    expect(rejected.status).toBe('failed'); expect(rejected.stderr).toContain('fixture-rejection')
    expect(git(remote, 'rev-parse', 'refs/heads/feature/selected')).toBe(receipt.afterHead)
  }, 90000)

  it('refuses detached and symlinked task worktrees and reports a missing worktree honestly', async () => {
    const { service, task } = fixture()
    const { cwd } = await service.prepare({ taskId: 'task' })
    git(cwd, 'checkout', '--detach')
    await expect(service.status({ taskId: 'task' })).rejects.toThrow('Detached HEAD')
    git(cwd, 'switch', task.branch)
    fs.renameSync(cwd, cwd + '-kept')
    expect((await service.status({ taskId: 'task' })).removed).toBe(true)
    fs.symlinkSync(cwd + '-kept', cwd)
    await expect(service.status({ taskId: 'task' })).rejects.toThrow('symlink')
    expect(fs.readFileSync(path.join(cwd + '-kept', 'file.txt'), 'utf8')).toBe('base\n')
  }, 60000)

  it('fences task removal until an in-flight real Git commit and its receipt have finished', async () => {
    const { service, repoPath, root } = fixture()
    const { cwd } = await service.prepare({ taskId: 'task' })
    const started = path.join(root, 'hook-started'), release = path.join(root, 'hook-release')
    fs.mkdirSync(path.join(repoPath, '.git/hooks'), { recursive: true })
    fs.writeFileSync(path.join(repoPath, '.git/hooks/pre-commit'), `#!/bin/sh\necho ready > '${started}'\nwhile [ ! -f '${release}' ]; do /bin/sleep 0.05; done\n`, { mode: 0o700 })
    fs.writeFileSync(path.join(cwd, 'file.txt'), 'in flight\n')
    const state = await service.status({ taskId: 'task' })
    const operation = service.commit({ taskId: 'task', operationId: 'in-flight', expectedHead: state.head, expectedStatusFingerprint: state.fingerprint, message: 'Commit while removal waits', paths: ['file.txt'] })
    let lease: ReturnType<GitService['beginTaskRemoval']> | undefined
    try {
      await vi.waitFor(() => expect(fs.existsSync(started)).toBe(true), { timeout: 15000 })
      lease = service.beginTaskRemoval(['task'])
      let finished = false
      void lease.finished.then(() => { finished = true })
      await expect(service.status({ taskId: 'task' })).rejects.toThrow('being removed')
      expect(finished).toBe(false)
      fs.writeFileSync(release, 'continue')
      const receipt = await operation
      expect(receipt.status).toBe('succeeded')
      await lease.finished
      expect(finished).toBe(true)
      lease.release()
      expect((await service.status({ taskId: 'task' })).receipts.some(value => value.operationId === 'in-flight' && value.status === 'succeeded')).toBe(true)
    } finally {
      fs.writeFileSync(release, 'continue')
      await operation
      lease?.release()
    }
  }, 60000)

  it('removes only a clean saved worktree, retains a recovery ref and refuses ignored data loss', async () => {
    const { service, repoPath, fresh } = fixture()
    const { cwd } = await service.prepare({ taskId: 'task' }); const { receipt } = await commit(service, cwd)
    fs.mkdirSync(path.join(cwd, 'cache')); fs.writeFileSync(path.join(cwd, 'cache/private'), 'must preserve')
    const state = await service.status({ taskId: 'task' })
    const request = { taskId: 'task', operationId: 'remove', expectedHead: receipt.afterHead!, expectedStatusFingerprint: state.fingerprint }
    expect((await service.removeWorktree(request)).status).toBe('failed')
    expect(fs.readFileSync(path.join(cwd, 'cache/private'), 'utf8')).toBe('must preserve')
    fs.rmSync(path.join(cwd, 'cache'), { recursive: true })
    const removed = await service.removeWorktree({ ...request, operationId: 'remove-clean' })
    expect(removed.status).toBe('succeeded'); expect(fs.existsSync(cwd)).toBe(false)
    expect(git(repoPath, 'rev-parse', removed.recoveryRef!)).toBe(receipt.afterHead)
    expect(await fresh().removeWorktree({ ...request, operationId: 'remove-clean' })).toEqual(removed)
    const restored = fresh()
    const removedState = await restored.status({ taskId: 'task' })
    expect(removedState).toMatchObject({ removed: true, cwd })
    const release = vi.fn()
    const guard = new WorktreeRemovalGuard(() => release, () => [])
    // The main handler obtains this binding before its ownership reservation;
    // an already absent cwd must still replay the exact saved Git receipt.
    expect(await guard.run('task', removedState.cwd, () => restored.removeWorktree({ ...request, operationId: 'remove-clean' }))).toEqual(removed)
    expect(release).toHaveBeenCalledTimes(1)
  }, 60000)

  it('preserves a nonempty task destination and rejects unsafe renderer request fields', async () => {
    const { service, task } = fixture()
    fs.mkdirSync(task.worktreePath, { recursive: true }); fs.writeFileSync(path.join(task.worktreePath, 'valuable.txt'), 'preserve')
    await expect(service.prepare({ taskId: 'task' })).rejects.toThrow('not empty')
    expect(fs.readFileSync(path.join(task.worktreePath, 'valuable.txt'), 'utf8')).toBe('preserve')
    expect(() => validateGitCommand('prepare', { taskId: 'task', cwd: '/tmp/injected' })).toThrow('fields')
    expect(() => validateGitCommand('diff', { taskId: 'task', scope: 'working', path: '../secret' })).toThrow()
    expect(() => validateGitCommand('push', { taskId: 'task', operationId: 'x', expectedHead: 'a'.repeat(40), remote: '--all' })).toThrow()
  }, 30000)
})
