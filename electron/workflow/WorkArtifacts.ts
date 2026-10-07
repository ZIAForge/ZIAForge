import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { WorkArtifactReceipt, WorkPhaseResult } from '../../shared/work-flow'
import { workflowId } from './WorkflowValidation'
import { workOutputPath } from './WorkTaskValidation'
import { isWithin } from '../runtime/ProjectAccess'
import { syncDirectory } from '../runtime/syncDirectory'

const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')
export class WorkArtifactStore {
  constructor(private readonly taskRoot: (taskId: string) => string, private readonly taskCwd: (taskId: string) => string) {}
  private directory(taskId: string, stageId: string, invocationId: string, create: boolean) {
    [taskId, stageId, invocationId].forEach(workflowId)
    let current = fs.realpathSync(this.taskRoot(taskId))
    for (const segment of ['work-flow', stageId, invocationId]) {
      current = path.join(current, segment)
      if (create) { try { fs.mkdirSync(current, { mode: 0o700 }) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error } }
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(current) !== current) throw new Error('Work artifact directory is unsafe')
    }
    return current
  }
  private bytes(filename: string, maximum = 32 * 1024 * 1024): Buffer {
    const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    try {
      const before = fs.fstatSync(fd)
      if (!before.isFile() || before.size > maximum || before.size === 0) throw new Error('Work output must be a nonempty bounded regular file')
      const bytes = fs.readFileSync(fd); const after = fs.fstatSync(fd)
      if (bytes.length > maximum || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('Work output changed while being captured')
      return bytes
    } finally { fs.closeSync(fd) }
  }
  private filename(directory: string, name: string, create: boolean) {
    const parent = path.join(directory, digest(name))
    if (create) { try { fs.mkdirSync(parent, { mode: 0o700 }) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error } }
    if (fs.lstatSync(parent).isSymbolicLink() || fs.realpathSync(parent) !== parent) throw new Error('Work artifact filename directory is unsafe')
    return path.join(parent, path.basename(name))
  }
  private publish(cwd: string, name: string, content: Buffer, previous: WorkArtifactReceipt[]) {
    if (path.basename(name) !== name) throw new Error('Generated Work artifacts require a basename')
    const target = path.join(cwd, name)
    let existing: Buffer | undefined
    try { existing = this.bytes(target) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    if (existing?.equals(content)) return
    if (existing) {
      const prior = [...previous].filter(item => item.name === name).sort((a, b) => b.version - a.version)[0]
      if (!prior || digest(existing) !== prior.sha256) throw new Error(`Work output ${name} already contains unrelated or edited content; it was preserved`)
    }
    const temporary = path.join(cwd, `.ziaf-output-${randomUUID()}.tmp`)
    const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
    try {
      try { fs.writeFileSync(fd, content); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      if (existing) { if (!this.bytes(target).equals(existing)) throw new Error('Work output changed before publication'); fs.renameSync(temporary, target) }
      else fs.linkSync(temporary, target)
      syncDirectory(cwd)
    } finally { fs.rmSync(temporary, { force: true }) }
  }
  async write(request: { taskId: string; stageId: string; invocationId: string; result: WorkPhaseResult; previous: WorkArtifactReceipt[]; publish?: boolean }, signal: AbortSignal): Promise<WorkArtifactReceipt[]> {
    if (signal.aborted) throw new Error('Work artifact capture cancelled')
    const directory = this.directory(request.taskId, request.stageId, request.invocationId, true)
    const values: Array<{ name: string; content: Buffer; sourcePath?: string }> = request.result.artifacts.map(item => ({ name: item.name, content: Buffer.from(item.content), sourcePath: undefined as string | undefined }))
    const cwd = fs.realpathSync(this.taskCwd(request.taskId))
    for (const output of request.result.outputs ?? []) {
      workOutputPath(output.path)
      const filename = path.join(cwd, output.path)
      if (!isWithin(cwd, filename, false) || fs.realpathSync(filename) !== filename) throw new Error('Work output must not traverse a symlink or leave the task')
      values.push({ name: output.path, content: this.bytes(filename), sourcePath: output.path })
    }
    if (new Set(values.map(item => item.name)).size !== values.length || values.reduce((sum, item) => sum + item.content.length, 0) > 64 * 1024 * 1024) throw new Error('Duplicate or oversized Work outputs')
    const receipts: WorkArtifactReceipt[] = []
    for (const item of values) {
      if (signal.aborted) throw new Error('Work artifact capture cancelled')
      const filename = this.filename(directory, item.name, true)
      try {
        const fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
        try { fs.writeFileSync(fd, item.content); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; if (!this.bytes(filename).equals(item.content)) throw new Error('Work artifact replay differs from the retained output') }
      for (const parent of [path.dirname(filename), directory]) {
        syncDirectory(parent)
      }
      const id = `artifact-${digest(`${request.taskId}:${request.stageId}:${request.invocationId}:${item.name}`).slice(0, 32)}`
      const prior = request.previous.find(receipt => receipt.id === id)
      receipts.push({ id, name: item.name, path: filename, sha256: digest(item.content), bytes: item.content.length, version: prior?.version ?? 1 + Math.max(0, ...request.previous.filter(receipt => receipt.name === item.name).map(receipt => receipt.version)), stageId: request.stageId, invocationId: request.invocationId, createdAt: prior?.createdAt ?? Date.now(), binary: item.content.includes(0) || !Buffer.from(item.content.toString('utf8')).equals(item.content), ...(item.sourcePath ? { sourcePath: item.sourcePath } : {}) })
      if (!item.sourcePath && request.publish !== false) this.publish(cwd, item.name, item.content, request.previous)
    }
    this.directory(request.taskId, request.stageId, request.invocationId, false)
    return receipts
  }
  private readBytes(taskId: string, receipt: WorkArtifactReceipt) {
    const directory = this.directory(taskId, receipt.stageId, receipt.invocationId, false)
    const filename = this.filename(directory, receipt.name, false)
    if (receipt.path !== filename) throw new Error('Work artifact does not belong to this task')
    const bytes = this.bytes(filename)
    if (digest(bytes) !== receipt.sha256 || bytes.length !== receipt.bytes) throw new Error('Work artifact changed. Its previous approval cannot be reused.')
    return bytes
  }
  async read(taskId: string, receipt: WorkArtifactReceipt) {
    const bytes = this.readBytes(taskId, receipt)
    if (receipt.binary || bytes.length > 800000) throw new Error('This output has no bounded text preview. Open the original file from task Files.')
    return { name: receipt.name, content: bytes.toString('utf8'), sha256: receipt.sha256, version: receipt.version }
  }
  async verifiedPath(taskId: string, receipt: WorkArtifactReceipt): Promise<string> { this.readBytes(taskId, receipt); return receipt.path }
  async context(taskId: string, receipts: WorkArtifactReceipt[]): Promise<string> {
    const latest = new Map<string, WorkArtifactReceipt>()
    for (const receipt of receipts) if ((latest.get(receipt.name)?.version ?? 0) < receipt.version) latest.set(receipt.name, receipt)
    let size = 0
    return [...latest.values()].map(receipt => {
      const bytes = this.readBytes(taskId, receipt)
      const text = !receipt.binary && bytes.length <= 60000 && size + bytes.length <= 160000 ? bytes.toString('utf8') : ''
      size += Buffer.byteLength(text)
      return `Artifact ${receipt.name}, version ${receipt.version}, SHA256 ${receipt.sha256}, bytes ${receipt.bytes}\nFile: ${receipt.path}${text ? `\n<artifact-data>\n${text}\n</artifact-data>` : '\nFull content is in the verified file; do not pretend a truncated excerpt is the full output.'}`
    }).join('\n\n')
  }
}
