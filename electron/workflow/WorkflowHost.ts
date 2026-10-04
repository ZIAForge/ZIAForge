import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import type { PersistedAgentLaunch, SessionManager, TrustedAgentSessionConfig } from '../runtime/SessionManager'
import { isWithin } from '../runtime/ProjectAccess'
import { VerificationRunner } from './VerificationRunner'
import { CodeArtifactStore } from './CodeArtifacts'
import { createWorkflowAgentRunner } from './WorkflowAgentRunner'
import { WorkflowEngine, verificationExcerpt, type WorkflowAgentRequest, type WorkflowEngineOptions } from './WorkflowEngine'

export interface WorkflowHostOptions {
  directory: string
  sessions(): SessionManager
  resolveLaunch(request: WorkflowAgentRequest, frozen?: PersistedAgentLaunch): Promise<TrustedAgentSessionConfig>
  beforeLaunch?(request: WorkflowAgentRequest): void
  taskCwd(taskId: string): string
  artifactRoot?(taskId: string): string
  workspaceMode?(taskId: string): 'code' | 'work'
  validateTask(taskId: string): void
  env(): NodeJS.ProcessEnv
  finalize?: WorkflowEngineOptions['finalize']
}

/** Connects the engine to the same native session service used by interactive chats. */
export function createWorkflowHost(options: WorkflowHostOptions) {
  const runner = new VerificationRunner({ directory: path.join(options.directory, 'verification'), env: options.env() })
  const artifacts = new CodeArtifactStore(options.artifactRoot ?? (() => { throw new Error('Task artifact storage is unavailable') }))
  const engine = new WorkflowEngine({
    directory: path.join(options.directory, 'plans'),
    finalize: options.finalize,
    validateTask: options.validateTask,
    async settleAgentCleanup(taskId, pending) {
      for (const ref of pending) {
        const snapshot = await options.sessions().attach({ taskId, chatId: ref.chatId })
        if (!snapshot || snapshot.sessionId !== ref.sessionId || snapshot.runId !== ref.runId) throw new Error('Owned cleanup identity changed; inspect the retained session before continuing')
        await options.sessions().terminate(ref)
      }
    },
    writeArtifacts: (request, signal) => artifacts.write(request, signal),
    artifactContext: (taskId, receipts, referencesOnly) => artifacts.context(taskId, receipts, referencesOnly),
    evidence: taskId => workspaceEvidence(options.taskCwd(taskId), options.env(), options.workspaceMode?.(taskId)),
    reviewDiff: taskId => workspaceReviewDiff(options.taskCwd(taskId), options.env()),
    async verify(request, signal) {
      options.validateTask(request.taskId)
      const command = { executable: resolveExecutable(request.command.executable, options.env()), args: [...request.command.args] }
      const receipt = await runner.run({ verificationId: request.id, cwd: options.taskCwd(request.taskId), command, timeoutMs: request.command.timeoutMs, inputFingerprint: request.inputFingerprint }, signal)
      return { id: receipt.verificationId, status: receipt.status, command: request.command, exitCode: receipt.exitCode,
        cleanupVerified: receipt.cleanupVerified, stdoutPath: receipt.stdoutPath, stderrPath: receipt.stderrPath, inputFingerprint: receipt.inputFingerprint, error: receipt.error,
        stdout: await verificationExcerpt(receipt.stdoutPath), stderr: await verificationExcerpt(receipt.stderrPath) }
    },
    runAgent: createWorkflowAgentRunner(options),
  })
  return { engine, artifacts, async shutdown() { try { await engine.shutdown() } finally { await runner.dispose() } } }
}

export function resolveExecutable(command: string, env: NodeJS.ProcessEnv): string {
  const candidates = path.isAbsolute(command) ? [command] : command.includes(path.sep) ? [] : (env.PATH ?? '').split(path.delimiter).filter(path.isAbsolute).map(directory => path.join(directory, command))
  for (const candidate of candidates) {
    try { if (fs.statSync(candidate).isFile()) { fs.accessSync(candidate, fs.constants.X_OK); return fs.realpathSync(candidate) } } catch { /* Try the next explicit PATH directory. */ }
  }
  throw new Error(`Verification executable not found: ${command}`)
}

async function git(cwd: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/git', ['-C', cwd, ...args], { env, timeout: 10000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => error ? reject(new Error(`Cannot collect workspace evidence: ${error.message}`)) : resolve(stdout))
  })
}
/** One complete patch for every reviewer. Refuse oversize/binary-new inputs
 * instead of silently reviewing a truncated approximation of the change. */
export async function workspaceReviewDiff(cwd: string, env: NodeJS.ProcessEnv): Promise<string> {
  const root = await fs.promises.realpath(cwd)
  if (root !== path.resolve(cwd)) throw new Error('Review requires the canonical task workspace')
  const [tracked, untracked] = await Promise.all([
    git(cwd, ['diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD', '--'], env),
    git(cwd, ['ls-files', '--others', '--exclude-standard', '-z'], env),
  ])
  let patch = tracked
  const bounded = () => { if (Buffer.byteLength(patch) > 240000) throw new Error('The complete review diff exceeds 240 KB. Split this task before review; no truncated patch was used.') }
  bounded()
  const names = untracked.split('\0').filter(Boolean).sort()
  if (names.length > 2000) throw new Error('Too many untracked files for a complete review')
  for (const name of names) {
    const filename = path.resolve(root, name)
    if (!isWithin(root, filename, false) || !isWithin(root, await fs.promises.realpath(path.dirname(filename)))) throw new Error('Review file escaped the assigned workspace')
    const stat = await fs.promises.lstat(filename)
    let content: Buffer
    let mode: string
    if (stat.isSymbolicLink()) { content = Buffer.from(await fs.promises.readlink(filename)); mode = '120000' }
    else {
      if (!stat.isFile() || stat.size > 240000) throw new Error('An untracked review file is not a bounded regular file')
      const handle = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
      try { content = await handle.readFile() } finally { await handle.close() }
      mode = stat.mode & 0o111 ? '100755' : '100644'
    }
    if (content.includes(0) || !Buffer.from(content.toString('utf8')).equals(content)) throw new Error('A new binary file needs a dedicated review; no incomplete text patch was supplied')
    const text = content.toString('utf8')
    const lines = text ? text.replace(/\n$/, '').split('\n') : []
    // Git accepts quoted paths for spaces, quotes, tabs and newlines.
    const before = JSON.stringify(`a/${name}`), after = JSON.stringify(`b/${name}`)
    patch += `diff --git ${before} ${after}\nnew file mode ${mode}\n--- /dev/null\n+++ ${after}\n`
    if (lines.length) patch += `@@ -0,0 +1,${lines.length} @@\n${lines.map(line => `+${line}\n`).join('')}${text.endsWith('\n') ? '' : '\\ No newline at end of file\n'}`
    bounded()
  }
  return patch
}
export async function workspaceEvidence(cwd: string, env: NodeJS.ProcessEnv, mode: 'code' | 'work' = 'code'): Promise<string> {
  if (mode === 'work') return folderEvidence(cwd)
  const [head, diff, tracked, untracked, status] = await Promise.all([
    git(cwd, ['rev-parse', 'HEAD'], env),
    git(cwd, ['diff', '--no-ext-diff', '--no-textconv', 'HEAD', '--'], env),
    git(cwd, ['diff', '--name-only', '-z', 'HEAD', '--'], env),
    git(cwd, ['ls-files', '--others', '--exclude-standard', '-z'], env),
    git(cwd, ['status', '--porcelain=v1'], env),
  ])
  const filenames = [...new Set((tracked + untracked).split('\0').filter(Boolean))].sort()
  if (filenames.length > 2000) throw new Error('Too many changed files to verify this step (limit: 2000)')
  const files: Array<{ path: string; sha256?: string; symlink?: string; deleted?: boolean; excerpt?: string }> = []
  let total = 0
  let excerptBytes = 0
  for (const name of filenames) {
    const filename = path.resolve(cwd, name)
    if (!isWithin(cwd, filename, false)) throw new Error('Unsafe path in workspace evidence')
    let stat: fs.Stats
    try { stat = await fs.promises.lstat(filename) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { files.push({ path: name, deleted: true }); continue } throw error }
    if (stat.isSymbolicLink()) { files.push({ path: name, symlink: await fs.promises.readlink(filename) }); continue }
    if (!stat.isFile()) continue
    if (!isWithin(cwd, await fs.promises.realpath(filename), false)) throw new Error('Changed file escaped the task workspace')
    total += stat.size
    if (total > 64 * 1024 * 1024) throw new Error('Changed files exceed the bounded verification evidence limit (64 MiB)')
    const handle = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    let content: Buffer
    try { content = await handle.readFile() } finally { await handle.close() }
    const sha256 = createHash('sha256').update(content).digest('hex')
    const excerpt = content.includes(0) || excerptBytes >= 40000 ? undefined : content.subarray(0, Math.min(10000, 40000 - excerptBytes)).toString('utf8')
    excerptBytes += excerpt?.length ?? 0
    files.push({ path: name, sha256, excerpt })
  }
  return JSON.stringify({ head: head.trim(), status, diff: diff.slice(0, 120000), diffSha256: createHash('sha256').update(diff).digest('hex'), files })
}

/** Work mode has no Git precondition; symlinks are evidence, never followed. */
export async function folderEvidence(cwd: string): Promise<string> {
  const root = await fs.promises.realpath(cwd)
  if (root !== path.resolve(cwd) || (await fs.promises.lstat(cwd)).isSymbolicLink()) throw new Error('Work evidence requires a canonical task folder')
  const files: Array<{ path: string; sha256?: string; symlink?: string; excerpt?: string }> = []
  let total = 0
  let excerpts = 0
  let entries = 0
  const visit = async (directory: string, depth = 0) => {
    if (depth > 40 || ++entries > 4000) throw new Error('Work evidence directory limit exceeded')
    if (await fs.promises.realpath(directory) !== directory || !isWithin(root, directory)) throw new Error('Work evidence directory escaped its task')
    for (const item of (await fs.promises.readdir(directory)).sort()) {
      if (['.git', 'node_modules', '.DS_Store', '.ziaf'].includes(item)) continue
      if (++entries > 4000) throw new Error('Work evidence directory limit exceeded')
      const filename = path.join(directory, item)
      const name = path.relative(root, filename)
      const stat = await fs.promises.lstat(filename)
      if (stat.isSymbolicLink()) files.push({ path: name, symlink: await fs.promises.readlink(filename) })
      else if (stat.isDirectory()) await visit(filename, depth + 1)
      else if (stat.isFile()) {
        if (await fs.promises.realpath(filename) !== filename || !isWithin(root, filename, false)) throw new Error('Work file escaped its task')
        total += stat.size
        if (total > 64 * 1024 * 1024) throw new Error('Work evidence exceeds 64 MiB; split the task into smaller folders')
        const handle = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
        let content: Buffer
        try { content = await handle.readFile() } finally { await handle.close() }
        const excerpt = content.includes(0) || excerpts >= 40000 ? undefined : content.subarray(0, Math.min(10000, 40000 - excerpts)).toString('utf8')
        excerpts += excerpt?.length ?? 0
        files.push({ path: name, sha256: createHash('sha256').update(content).digest('hex'), excerpt })
      }
      if (files.length > 2000) throw new Error('Too many files for Work evidence (limit: 2000)')
    }
  }
  await visit(root)
  return JSON.stringify({ mode: 'work', files })
}
