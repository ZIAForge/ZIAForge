import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import type { GitAPI, GitTaskBinding, GitTaskRequest, GitStatus, GitChange, GitDiffRequest, GitOperationReceipt, GitOperationKind, GitOperationRequest, GitCommitRequest, GitPushRequest, GitMergeRequest, GitRemoveWorktreeRequest } from '../../shared/git'
import { ensurePrivateDirectory, readPrivateMetadata, replacePrivateMetadata, writePrivateMetadata } from '../runtime/privateStorage'
import { isWithin } from '../runtime/ProjectAccess'
import { VerificationRunner } from '../workflow/VerificationRunner'
import { gitBranch, gitId, validateGitCommand } from './GitValidation'

export interface TrustedGitTask {
  taskId: string
  /** All paths come from the registered backend task, never the renderer. */
  projectPath: string
  repoPath: string
  worktreePath: string
  mode: 'worktree' | 'branch'
  branch: string
  baseRef: string
  createBranch: boolean
  /** Main may set this only for a previously registered, verified legacy task worktree. */
  adoptExisting?: boolean
}
export interface GitServiceOptions {
  directory: string
  resolveTask(taskId: string): TrustedGitTask | Promise<TrustedGitTask>
  env(): NodeJS.ProcessEnv
}
interface Output { code: number; stdout: string; stderr: string }
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const text = (error: unknown) => error instanceof Error ? error.message : String(error)
const clip = (value: string) => value.length <= 32768 ? value : value.slice(0, 32768) + '\n[truncated]'
const gitOptions = ['--literal-pathspecs', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false']

/** Real Git outcomes with durable operation receipts and task-bound filesystem access. */
export class GitService implements GitAPI {
  private readonly queues = new Map<string, Promise<unknown>>()
  private readonly active = new Set<Promise<unknown>>()
  private readonly taskOperations = new Map<string, Set<Promise<unknown>>>()
  private readonly removing = new Map<string, number>()
  private readonly runner: VerificationRunner
  private closing = false
  constructor(private readonly options: GitServiceOptions) {
    ensurePrivateDirectory(options.directory)
    this.runner = new VerificationRunner({ directory: path.join(options.directory, 'commands'), env: this.env(), maxOutputBytes: 1024 * 1024 })
  }

  private async context(taskId: string): Promise<TrustedGitTask> {
    gitId(taskId)
    const task = await this.options.resolveTask(taskId)
    if (task.taskId !== taskId) throw new Error('Git task ownership changed')
    gitBranch(task.branch); gitBranch(task.baseRef)
    if (!['worktree', 'branch'].includes(task.mode)) throw new Error('Unsupported Git task mode')
    this.canonical(task.projectPath); this.canonical(task.repoPath)
    if (!path.isAbsolute(task.worktreePath) || !isWithin(path.join(task.projectPath, 'worktrees'), task.worktreePath, false)) throw new Error('Worktree path is outside the task project')
    this.destination(task.projectPath, task.worktreePath)
    return task
  }
  private canonical(directory: string): string {
    if (!path.isAbsolute(directory) || path.resolve(directory) !== directory || fs.realpathSync(directory) !== directory || !fs.lstatSync(directory).isDirectory()) throw new Error('Git directory must be canonical and must not be a symlink')
    return directory
  }
  private destination(root: string, destination: string): void {
    if (!isWithin(root, destination, false)) throw new Error('Unsafe Git worktree destination')
    let current = root
    for (const component of path.relative(root, destination).split(path.sep)) {
      current = path.join(current, component)
      try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Git worktree path must not contain symlinks') }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    }
  }
  private file(taskId: string, name: string): string { gitId(taskId); return path.join(this.options.directory, 'tasks', taskId, name) }
  private env(): NodeJS.ProcessEnv { return { ...this.options.env(), GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' } }
  private read(cwd: string, args: string[], allowFailure = false): Promise<Output> {
    this.canonical(cwd)
    return new Promise((resolve, reject) => {
      execFile('/usr/bin/git', [...gitOptions, '-C', cwd, ...args], { env: this.env(), timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
        const code = error ? typeof error.code === 'number' ? error.code : -1 : 0
        if (error && !allowFailure) reject(new Error(`Git ${args[0]} failed: ${clip(stderr || error.message)}`))
        else resolve({ code, stdout, stderr })
      })
    })
  }
  private async change(cwd: string, args: string[], indexFile?: string): Promise<Output> {
    this.canonical(cwd)
    const command = indexFile
      ? { executable: '/usr/bin/env', args: [`GIT_INDEX_FILE=${indexFile}`, '/usr/bin/git', ...gitOptions, ...args] }
      : { executable: '/usr/bin/git', args: [...gitOptions, ...args] }
    const receipt = await this.runner.run({ verificationId: `git-${randomUUID()}`, cwd, command, timeoutMs: 60000 })
    const stdout = fs.readFileSync(receipt.stdoutPath, 'utf8'), stderr = fs.readFileSync(receipt.stderrPath, 'utf8')
    if (!receipt.cleanupVerified || !['passed', 'failed'].includes(receipt.status)) throw new Error(`Git command ${receipt.status}: ${receipt.error ?? 'process cleanup or execution was not verified'}`)
    return { code: receipt.exitCode ?? -1, stdout, stderr }
  }
  private async mustChange(cwd: string, args: string[], indexFile?: string): Promise<Output> {
    const output = await this.change(cwd, args, indexFile)
    if (output.code !== 0) throw new Error(`Git ${args[0]} failed: ${clip(output.stderr || output.stdout)}`)
    return output
  }
  private serialize<T>(taskId: string, action: (task: TrustedGitTask) => Promise<T>): Promise<T> {
    const operation = (async () => {
      if (this.closing || this.removing.has(taskId)) throw new Error('Git task is shutting down or being removed')
      const initial = await this.context(taskId)
      const previous = this.queues.get(initial.repoPath) ?? Promise.resolve()
      const current = previous.catch(() => {}).then(async () => {
        if (this.closing || this.removing.has(taskId)) throw new Error('Git task is shutting down or being removed')
        const task = await this.context(taskId)
        if (JSON.stringify(task) !== JSON.stringify(initial)) throw new Error('Git task configuration changed while waiting')
        return action(task)
      })
      this.queues.set(initial.repoPath, current)
      try { return await current } finally { if (this.queues.get(initial.repoPath) === current) this.queues.delete(initial.repoPath) }
    })()
    this.active.add(operation)
    const taskOperations = this.taskOperations.get(taskId) ?? new Set<Promise<unknown>>()
    taskOperations.add(operation); this.taskOperations.set(taskId, taskOperations)
    void operation.finally(() => {
      this.active.delete(operation); taskOperations.delete(operation)
      if (!taskOperations.size && this.taskOperations.get(taskId) === taskOperations) this.taskOperations.delete(taskId)
    }).catch(() => {})
    return operation
  }
  /** Main holds this fence until filesystem removal and unregistration finish. */
  beginTaskRemoval(taskIds: readonly string[]): { finished: Promise<void>; release(): void } {
    const ids = [...new Set(taskIds)]; ids.forEach(gitId)
    for (const id of ids) this.removing.set(id, (this.removing.get(id) ?? 0) + 1)
    const pending = ids.flatMap(id => [...this.taskOperations.get(id) ?? []])
    let released = false
    return {
      finished: Promise.allSettled(pending).then(() => {}),
      release: () => {
        if (released) return
        released = true
        for (const id of ids) { const remaining = (this.removing.get(id) ?? 1) - 1; if (remaining) this.removing.set(id, remaining); else this.removing.delete(id) }
      },
    }
  }
  async shutdown(): Promise<void> {
    this.closing = true
    await this.runner.dispose()
    await Promise.allSettled([...this.active])
  }
  private async branch(cwd: string): Promise<string> {
    const value = await this.read(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'], true)
    if (value.code) throw new Error('Detached HEAD is not a task branch; select a local branch')
    return value.stdout.trim()
  }
  private async revision(cwd: string, ref: string): Promise<string> {
    const result = (await this.read(cwd, ['rev-parse', '--verify', `${ref}^{commit}`])).stdout.trim()
    if (!/^[a-f0-9]{40,64}$/.test(result)) throw new Error('Git returned an invalid commit revision')
    return result
  }
  private async clean(cwd: string, includeIgnored = false): Promise<boolean> {
    return !(await this.read(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all', ...(includeIgnored ? ['--ignored=matching'] : [])])).stdout
  }
  private async loadBinding(task: TrustedGitTask): Promise<GitTaskBinding | undefined> {
    let data: unknown
    try { data = await readPrivateMetadata(this.file(task.taskId, 'binding.json')) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error }
    const value = data as GitTaskBinding
    if (!value || value.schemaVersion !== 1 || value.taskId !== task.taskId || value.mode !== task.mode || value.branch !== task.branch || value.repoPath !== task.repoPath || value.cwd !== (task.mode === 'branch' ? task.repoPath : task.worktreePath) || typeof value.baseBranch !== 'string' || !/^[a-f0-9]{40,64}$/.test(value.baseRevision)) throw new Error('Saved Git task binding does not match the registered task')
    return value
  }
  private async validateBinding(binding: GitTaskBinding, allowMissing = false): Promise<void> {
    this.canonical(binding.repoPath)
    if (allowMissing && !fs.existsSync(binding.cwd)) return
    this.canonical(binding.cwd)
    const top = (await this.read(binding.cwd, ['rev-parse', '--show-toplevel'])).stdout.trim()
    if (fs.realpathSync(top) !== binding.cwd) throw new Error('Task path is not a Git worktree root')
    const source = (await this.read(binding.repoPath, ['rev-parse', '--path-format=absolute', '--git-common-dir'])).stdout.trim()
    const worktree = (await this.read(binding.cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'])).stdout.trim()
    if (fs.realpathSync(source) !== fs.realpathSync(worktree)) throw new Error('Task worktree belongs to another Git repository')
    if (await this.branch(binding.cwd) !== binding.branch) throw new Error('Task branch changed; no Git operation was performed')
  }
  prepare(request: GitTaskRequest): Promise<GitTaskBinding> {
    validateGitCommand('prepare', request)
    return this.serialize(request.taskId, task => this.prepareTask(task))
  }
  private async prepareTask(task: TrustedGitTask): Promise<GitTaskBinding> {
    const existing = await this.loadBinding(task)
    if (existing) { await this.validateBinding(existing); return existing }
    const top = (await this.read(task.repoPath, ['rev-parse', '--show-toplevel'])).stdout.trim()
    if (fs.realpathSync(top) !== task.repoPath) throw new Error('Registered source must be a Git repository root')
    let baseRevision = await this.revision(task.repoPath, `refs/heads/${task.baseRef}`)
    let adopted: GitTaskBinding['adopted']
    const branchExists = !(await this.read(task.repoPath, ['show-ref', '--verify', '--quiet', `refs/heads/${task.branch}`], true)).code
    if (!branchExists && !task.createBranch) throw new Error('The selected task branch does not exist')
    const cwd = task.mode === 'branch' ? task.repoPath : task.worktreePath
    if (task.mode === 'branch') {
      await this.branch(task.repoPath) // Refuse implicit recovery from detached HEAD.
      if (!await this.clean(cwd)) throw new Error('Source worktree is dirty; commit or preserve those changes before switching branches')
      await this.mustChange(cwd, branchExists ? ['switch', '--no-overwrite-ignore', '--', task.branch] : ['switch', '--no-overwrite-ignore', '-c', task.branch, baseRevision])
    } else if (fs.existsSync(path.join(cwd, '.git'))) {
      const candidate: GitTaskBinding = { schemaVersion: 1, taskId: task.taskId, mode: task.mode, branch: task.branch, baseBranch: task.baseRef, baseRevision, repoPath: task.repoPath, cwd, createdAt: Date.now() }
      await this.validateBinding(candidate)
      if (!task.adoptExisting && !await this.clean(cwd)) throw new Error('Cannot adopt a dirty unbound worktree without its registered legacy task identity')
      if (task.adoptExisting) {
        const before = await this.snapshot(candidate)
        baseRevision = (await this.read(cwd, ['merge-base', baseRevision, before.head])).stdout.trim()
        if (!/^[a-f0-9]{40,64}$/.test(baseRevision)) throw new Error('Cannot establish the legacy task base revision')
        adopted = { head: before.head, fingerprint: before.fingerprint }
      }
    } else {
      if (fs.existsSync(cwd) && fs.readdirSync(cwd).length) throw new Error('Task destination is not empty; its existing files were preserved')
      fs.mkdirSync(path.dirname(cwd), { recursive: true })
      await this.mustChange(task.repoPath, branchExists ? ['worktree', 'add', '--', cwd, task.branch] : ['worktree', 'add', '-b', task.branch, '--', cwd, baseRevision])
    }
    const binding: GitTaskBinding = { schemaVersion: 1, taskId: task.taskId, mode: task.mode, branch: task.branch, baseBranch: task.baseRef, baseRevision, repoPath: task.repoPath, cwd, createdAt: Date.now(), ...(adopted ? { adopted } : {}) }
    await this.validateBinding(binding)
    await writePrivateMetadata(this.file(task.taskId, 'binding.json'), binding)
    return binding
  }
  private changes(raw: string): GitChange[] {
    const pieces = raw.split('\0'), changes: GitChange[] = []
    for (let index = 0; index < pieces.length; index++) {
      const item = pieces[index]
      if (!item) continue
      const value: GitChange = { index: item[0], worktree: item[1], path: item.slice(3) }
      if (/[RC]/.test(item.slice(0, 2))) value.originalPath = pieces[++index]
      changes.push(value)
    }
    return changes
  }
  private async receipts(taskId: string): Promise<GitOperationReceipt[]> {
    const directory = this.file(taskId, 'operations')
    let names: string[]
    try { names = await fs.promises.readdir(directory) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
    const receipts: GitOperationReceipt[] = []
    for (const name of names.filter(name => /^[a-zA-Z0-9_-]+\.json$/.test(name))) {
      const receipt = await readPrivateMetadata(path.join(directory, name)) as GitOperationReceipt
      if (receipt?.schemaVersion !== 1 || receipt.taskId !== taskId || typeof receipt.startedAt !== 'number' || typeof receipt.status !== 'string') throw new Error('Invalid saved Git operation receipt')
      receipts.push(receipt)
    }
    return receipts.sort((a, b) => b.startedAt - a.startedAt).slice(0, 100)
  }
  private async snapshot(binding: GitTaskBinding): Promise<GitStatus> {
    await this.validateBinding(binding, true)
    const receipts = await this.receipts(binding.taskId)
    const remotes = (await this.read(binding.repoPath, ['remote'])).stdout.trim().split('\n').filter(Boolean)
    const branches = (await this.read(binding.repoPath, ['for-each-ref', '--format=%(refname:short)%00%(objectname)', 'refs/heads/'])).stdout.trim().split('\n').filter(Boolean).map(line => { const [name, head] = line.split('\0'); return { name, head } })
    if (!fs.existsSync(binding.cwd)) return { ...binding, head: await this.revision(binding.repoPath, `refs/heads/${binding.branch}`), changes: [], conflicts: [], fingerprint: '', clean: true, removed: true, receipts, remotes, branches }
    const head = await this.revision(binding.cwd, 'HEAD')
    const raw = (await this.read(binding.cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])).stdout
    const changes = this.changes(raw)
    const index = (await this.read(binding.cwd, ['ls-files', '--stage', '-z'])).stdout
    const files: unknown[] = []
    let bytes = 0
    for (const name of [...new Set(changes.flatMap(change => [change.path, ...(change.originalPath ? [change.originalPath] : [])]))].sort()) {
      const filename = path.resolve(binding.cwd, name)
      if (!isWithin(binding.cwd, filename, false)) throw new Error('Unsafe changed file path')
      let stat: fs.Stats
      try { stat = await fs.promises.lstat(filename) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { files.push([name, 'missing']); continue } throw error }
      if (stat.isSymbolicLink()) files.push([name, 'symlink', await fs.promises.readlink(filename)])
      else if (stat.isFile()) {
        if (!isWithin(binding.cwd, fs.realpathSync(filename), false)) throw new Error('Changed file escaped its worktree')
        bytes += stat.size
        if (bytes > 64 * 1024 * 1024) throw new Error('Changed files exceed the 64 MiB Git review limit')
        const handle = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
        try { files.push([name, stat.mode, digest(await handle.readFile())]) } finally { await handle.close() }
      } else files.push([name, 'directory-or-special'])
    }
    if (head !== await this.revision(binding.cwd, 'HEAD')) throw new Error('HEAD changed while reading Git status; refresh')
    return { ...binding, head, changes, fingerprint: digest(JSON.stringify({ head, raw, index, files })), clean: !changes.length, conflicts: changes.filter(change => /U/.test(change.index + change.worktree) || ['AA', 'DD'].includes(change.index + change.worktree)).map(change => change.path), removed: false, receipts, remotes, branches }
  }
  status(request: GitTaskRequest): Promise<GitStatus> {
    validateGitCommand('status', request)
    return this.serialize(request.taskId, async task => {
      const binding = await this.loadBinding(task)
      if (!binding) throw new Error('Prepare the task Git branch before inspecting it')
      return this.snapshot(binding)
    })
  }
  diff(request: GitDiffRequest) {
    validateGitCommand('diff', request)
    return this.serialize(request.taskId, async task => {
      const binding = await this.loadBinding(task)
      if (!binding) throw new Error('Prepare the task Git branch before inspecting it')
      const before = await this.snapshot(binding)
      if (before.removed) throw new Error('Task worktree has been removed; restore it before viewing changes')
      const args = ['diff', '--no-ext-diff', '--no-textconv', '--ignore-submodules=all', ...(request.scope === 'staged' ? ['--cached'] : request.scope === 'base' ? [`${binding.baseRevision}...HEAD`] : []), '--', ...(request.path ? [request.path] : [])]
      let output = (await this.read(binding.cwd, args)).stdout
      if (request.scope === 'working' && request.path && before.changes.some(change => change.path === request.path && change.index === '?')) {
        const filename = path.join(binding.cwd, request.path)
        if (!fs.lstatSync(filename).isSymbolicLink()) output = (await this.read(binding.cwd, ['diff', '--no-ext-diff', '--no-textconv', '--no-index', '--', '/dev/null', filename], true)).stdout
      }
      if ((await this.snapshot(binding)).fingerprint !== before.fingerprint) throw new Error('Files changed while generating the diff; refresh')
      return { text: output.slice(0, 1024 * 1024), truncated: output.length > 1024 * 1024, head: before.head, fingerprint: before.fingerprint }
    })
  }
  private marker(receipt: GitOperationReceipt): string { return `ZIAForge-Operation: ${receipt.taskId}/${receipt.operationId}` }
  private async committed(cwd: string, ref: string, receipt: GitOperationReceipt): Promise<string | undefined> {
    const output = await this.read(cwd, ['log', '-1000', '--format=%H%x00%P%x00%B%x00%x00', ref, '--'], true)
    if (output.code) return
    const parent = receipt.kind === 'merge' ? receipt.targetBeforeHead : receipt.beforeHead
    for (const record of output.stdout.split('\0\0')) {
      const [hash, parents, message] = record.trimStart().split('\0')
      if (parents?.split(' ')[0] === parent && message?.split('\n').includes(this.marker(receipt)) && /^[a-f0-9]{40,64}$/.test(hash)) {
        if (receipt.reviewedTree && (await this.read(cwd, ['show', '-s', '--format=%T', hash])).stdout.trim() !== receipt.reviewedTree) throw new Error('Git hooks changed the reviewed commit tree; inspect the saved commit before continuing')
        return hash
      }
    }
  }
  private async operation<T extends GitOperationRequest>(kind: GitOperationKind, request: T, execute: (binding: GitTaskBinding, state: GitStatus, receipt: GitOperationReceipt) => Promise<void>): Promise<GitOperationReceipt> {
    return this.serialize(request.taskId, async task => {
      const binding = await this.loadBinding(task)
      if (!binding) throw new Error('Prepare the task Git branch before changing it')
      const filename = this.file(task.taskId, `operations/${request.operationId}.json`)
      const signature = digest(JSON.stringify({ kind, request: Object.fromEntries(Object.entries(request).sort(([a], [b]) => a.localeCompare(b))) }))
      let saved: GitOperationReceipt | undefined
      try { saved = await readPrivateMetadata(filename) as GitOperationReceipt } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      if (saved) {
        if (saved.signature !== signature || saved.taskId !== task.taskId || saved.operationId !== request.operationId || saved.kind !== kind) throw new Error('Git operation identity was reused with different arguments')
        if (saved.status === 'pending') {
          const commit = ['commit', 'merge'].includes(kind) ? await this.committed(binding.repoPath, kind === 'merge' ? `refs/heads/${saved.targetBranch}` : `refs/heads/${binding.branch}`, saved) : undefined
          if (commit) { saved.status = 'succeeded'; saved.afterHead = commit; saved.recovered = true }
          else if (kind === 'remove-worktree' && !fs.existsSync(binding.cwd) && saved.recoveryRef && await this.revision(binding.repoPath, saved.recoveryRef) === saved.beforeHead) { saved.status = 'succeeded'; saved.afterHead = saved.beforeHead; saved.recovered = true }
          else { saved.status = 'interrupted'; saved.error = 'The previous Git operation was interrupted. Inspect its result before explicitly starting a new operation.' }
          saved.finishedAt = Date.now(); await replacePrivateMetadata(filename, saved)
        }
        return structuredClone(saved)
      }
      const state = await this.snapshot(binding)
      if (state.removed || state.head !== request.expectedHead) throw new Error('The task HEAD changed or its worktree is missing; refresh before continuing')
      const receipt: GitOperationReceipt = { schemaVersion: 1, taskId: task.taskId, operationId: request.operationId, kind, signature, status: 'pending', startedAt: Date.now(), beforeHead: state.head, stdout: '', stderr: '' }
      await writePrivateMetadata(filename, receipt)
      try { await execute(binding, state, receipt); if (receipt.status === 'pending') receipt.status = 'succeeded' }
      catch (error) { receipt.status = 'failed'; receipt.error = text(error) }
      receipt.finishedAt = Date.now(); receipt.stdout = clip(receipt.stdout); receipt.stderr = clip(receipt.stderr)
      await replacePrivateMetadata(filename, receipt)
      return structuredClone(receipt)
    })
  }
  commit(request: GitCommitRequest): Promise<GitOperationReceipt> {
    validateGitCommand('commit', request)
    return this.operation('commit', request, async (binding, state, receipt) => {
      if (state.fingerprint !== request.expectedStatusFingerprint) throw new Error('Files changed since they were reviewed; refresh the diff before committing')
      if (state.conflicts.length) throw new Error('Resolve Git conflicts before committing')
      const changed = new Set(state.changes.flatMap(change => [change.path, ...(change.originalPath ? [change.originalPath] : [])]))
      if (request.paths.some(name => !changed.has(name))) throw new Error('Only reviewed changed files may be committed')
      const selectedPaths = [...new Set(request.paths.flatMap(name => {
        const change = state.changes.find(item => item.path === name || item.originalPath === name)
        return change?.originalPath ? [change.path, change.originalPath] : [name]
      }))]
      if ((await this.snapshot(binding)).fingerprint !== state.fingerprint) throw new Error('Files changed before staging; refresh')
      // An isolated index freezes the reviewed paths. `commit --only` would read
      // them again after staging and could include concurrent, unreviewed edits.
      const index = (await this.read(binding.cwd, ['rev-parse', '--path-format=absolute', '--git-path', 'index'])).stdout.trim()
      this.canonical(path.dirname(index))
      if (fs.lstatSync(index).isSymbolicLink()) throw new Error('Git index must not be a symlink')
      const lock = index + '.lock', selected = index + `.ziaforge-${randomUUID()}`, preserved = selected + '-preserved'
      const handle = await fs.promises.open(lock, 'wx', 0o600)
      try {
        await fs.promises.copyFile(index, preserved, fs.constants.COPYFILE_EXCL)
        await this.mustChange(binding.cwd, ['read-tree', state.head], selected)
        await this.mustChange(binding.cwd, ['add', '-A', '--', ...selectedPaths], selected)
        if ((await this.snapshot(binding)).fingerprint !== state.fingerprint) throw new Error('Files changed while staging; refresh the diff before committing')
        receipt.reviewedTree = (await this.mustChange(binding.cwd, ['write-tree'], selected)).stdout.trim()
        await replacePrivateMetadata(this.file(binding.taskId, `operations/${request.operationId}.json`), receipt)
        if (await this.revision(binding.cwd, 'HEAD') !== state.head) throw new Error('HEAD changed before commit; existing staged changes were preserved')
        const output = await this.change(binding.cwd, ['commit', '-m', `${request.message.trim()}\n\n${this.marker(receipt)}`], selected)
        receipt.stdout = output.stdout; receipt.stderr = output.stderr
        const committed = await this.committed(binding.cwd, 'HEAD', receipt)
        if (!committed) throw new Error(output.stderr || output.stdout || 'Git did not confirm the requested commit')
        receipt.afterHead = committed
        // Update only selected index entries, retaining every unrelated staged
        // change. The normal index lock prevents another Git writer being lost.
        await this.mustChange(binding.cwd, ['reset', '-q', committed, '--', ...selectedPaths], preserved)
        await handle.close()
        await fs.promises.rename(preserved, lock)
        await fs.promises.rename(lock, index)
      } finally {
        await handle.close().catch(() => {})
        for (const filename of [lock, selected, preserved, selected + '.lock', preserved + '.lock']) await fs.promises.rm(filename, { force: true })
      }
    })
  }
  push(request: GitPushRequest): Promise<GitOperationReceipt> {
    validateGitCommand('push', request)
    return this.operation('push', request, async (binding, _state, receipt) => {
      const remotes = (await this.read(binding.cwd, ['remote'])).stdout.trim().split('\n')
      if (!remotes.includes(request.remote)) throw new Error('The selected Git remote does not exist')
      receipt.remote = request.remote
      await replacePrivateMetadata(this.file(binding.taskId, `operations/${request.operationId}.json`), receipt)
      const output = await this.change(binding.cwd, ['push', '--porcelain', '--', request.remote, `${request.expectedHead}:refs/heads/${binding.branch}`])
      receipt.stdout = output.stdout; receipt.stderr = output.stderr
      if (output.code !== 0) throw new Error(output.stderr || 'Git remote rejected the push')
      const confirmed = await this.change(binding.cwd, ['ls-remote', '--exit-code', '--heads', '--', request.remote, `refs/heads/${binding.branch}`])
      if (confirmed.code || confirmed.stdout.split(/\s+/)[0] !== request.expectedHead) throw new Error('Push returned but the remote revision could not be confirmed')
      receipt.afterHead = request.expectedHead
    })
  }
  merge(request: GitMergeRequest): Promise<GitOperationReceipt> {
    validateGitCommand('merge', request)
    return this.operation('merge', request, async (binding, state, receipt) => {
      if (!state.clean) throw new Error('Commit task changes before merging')
      if (request.targetBranch === binding.branch) throw new Error('Choose a different merge target branch')
      const targetHead = await this.revision(binding.repoPath, `refs/heads/${request.targetBranch}`)
      if (targetHead !== request.expectedTargetHead) throw new Error('Merge target changed; refresh before continuing')
      const worktrees = (await this.read(binding.repoPath, ['worktree', 'list', '--porcelain', '-z'])).stdout.split('\0\0')
      const targetRecord = worktrees.find(record => record.split('\0').includes(`branch refs/heads/${request.targetBranch}`))
      let targetPath = targetRecord?.split('\0').find(line => line.startsWith('worktree '))?.slice(9)
      if (targetPath && targetPath !== binding.repoPath) throw new Error('Merge target is checked out in another worktree; merge there explicitly')
      if (targetPath) {
        this.canonical(targetPath)
        if (!await this.clean(targetPath)) throw new Error('Merge target has local changes; all target changes were preserved')
      } else {
        const task = await this.context(binding.taskId)
        targetPath = path.join(task.projectPath, 'worktrees', `merge-${binding.taskId.slice(0, 80)}-${digest(request.operationId).slice(0, 24)}`)
        this.destination(task.projectPath, targetPath)
        if (fs.existsSync(targetPath)) throw new Error('Merge recovery worktree already exists; inspect it before retrying')
      }
      receipt.targetBranch = request.targetBranch; receipt.targetBeforeHead = targetHead; receipt.targetPath = targetPath
      await replacePrivateMetadata(this.file(binding.taskId, `operations/${request.operationId}.json`), receipt)
      if (!targetRecord) await this.mustChange(binding.repoPath, ['worktree', 'add', '--', targetPath, request.targetBranch])
      if (await this.branch(targetPath) !== request.targetBranch || await this.revision(targetPath, 'HEAD') !== targetHead || !await this.clean(targetPath)) throw new Error('Merge target changed before execution; no merge was performed')
      const output = await this.change(targetPath, ['merge', '--no-ff', '--no-edit', '--no-autostash', '--no-overwrite-ignore', '-m', `Merge ${binding.branch}\n\n${this.marker(receipt)}`, request.expectedHead])
      receipt.stdout = output.stdout; receipt.stderr = output.stderr
      if (output.code !== 0) {
        const conflicts = this.changes((await this.read(targetPath, ['status', '--porcelain=v1', '-z'])).stdout).filter(change => /U/.test(change.index + change.worktree) || ['AA', 'DD'].includes(change.index + change.worktree))
        if (conflicts.length) { receipt.status = 'conflicted'; receipt.error = `Resolve conflicts in ${targetPath}; changes and MERGE_HEAD are preserved`; return }
        throw new Error(output.stderr || output.stdout || 'Git merge failed')
      }
      const after = await this.revision(targetPath, 'HEAD')
      const ancestor = await this.read(targetPath, ['merge-base', '--is-ancestor', request.expectedHead, after], true)
      if (ancestor.code) throw new Error('Git did not confirm the merged task revision')
      receipt.afterHead = after
    })
  }
  removeWorktree(request: GitRemoveWorktreeRequest): Promise<GitOperationReceipt> {
    validateGitCommand('removeWorktree', request)
    return this.operation('remove-worktree', request, async (binding, state, receipt) => {
      if (binding.mode !== 'worktree') throw new Error('The source checkout cannot be removed as a temporary task worktree')
      if (!state.clean || state.fingerprint !== request.expectedStatusFingerprint || !await this.clean(binding.cwd, true)) throw new Error('Task worktree contains changed, untracked or ignored files; nothing was removed')
      if (!state.receipts.some(item => item.status === 'succeeded' && item.kind === 'commit' && item.afterHead === state.head)) throw new Error('Save the task result in a confirmed commit before removing its worktree')
      receipt.recoveryRef = `refs/ziaforge/recovery/${binding.taskId}/${request.operationId}`
      await this.mustChange(binding.repoPath, ['update-ref', receipt.recoveryRef, state.head])
      await replacePrivateMetadata(this.file(binding.taskId, `operations/${request.operationId}.json`), receipt)
      const output = await this.change(binding.repoPath, ['worktree', 'remove', '--', binding.cwd])
      receipt.stdout = output.stdout; receipt.stderr = output.stderr
      if (output.code || fs.existsSync(binding.cwd)) throw new Error(output.stderr || 'Git did not remove the worktree')
      if (await this.revision(binding.repoPath, receipt.recoveryRef) !== state.head) throw new Error('Worktree recovery revision could not be confirmed')
      receipt.afterHead = state.head
    })
  }
}
