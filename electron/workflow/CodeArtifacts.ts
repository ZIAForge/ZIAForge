import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { CodeArtifactDraft, CodeArtifactReceipt } from '../../shared/code-flow'
import { validateArtifactDrafts } from './CodeFlowProtocol'
import { syncDirectory } from '../runtime/syncDirectory'

const identity = (value: string) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new Error('Invalid artifact identity')
  return value
}
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex')
const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw new Error('Artifact operation cancelled') }
export interface WriteCodeArtifacts {
  taskId: string
  stepId: string
  attemptId: string
  artifacts: CodeArtifactDraft[]
  previous: CodeArtifactReceipt[]
}
/** Only paths resolved from registered task metadata may enter this service. */
export class CodeArtifactStore {
  constructor(private readonly taskRoot: (taskId: string) => string) {}
  private syncDirectory(directory: string): void {
    syncDirectory(directory)
  }
  private directory(taskId: string, stepId: string, attemptId: string, create: boolean): string {
    identity(taskId); identity(stepId); identity(attemptId)
    const root = fs.realpathSync(this.taskRoot(taskId))
    if (!fs.statSync(root).isDirectory()) throw new Error('Task artifact root is not a directory')
    let current = root
    for (const segment of ['code-flow', stepId, attemptId]) {
      const parent = current
      current = path.join(current, segment)
      if (create) { try { fs.mkdirSync(current, { mode: 0o700 }) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error } }
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(current) !== current) throw new Error('Task artifact directory changed or escaped its root')
      if (create) this.syncDirectory(parent)
    }
    return current
  }
  async write(request: WriteCodeArtifacts, signal?: AbortSignal): Promise<CodeArtifactReceipt[]> {
    checkAbort(signal); validateArtifactDrafts(request.artifacts)
    const directory = this.directory(request.taskId, request.stepId, request.attemptId, true)
    const receipts: CodeArtifactReceipt[] = []
    for (const artifact of request.artifacts) {
      checkAbort(signal)
      const content = Buffer.from(artifact.content, 'utf8')
      const filename = path.join(directory, artifact.name)
      let fd: number | undefined
      try {
        fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
        fs.writeFileSync(fd, content); fs.fsyncSync(fd)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        // A durable artifact write may precede the engine checkpoint. Accept an
        // exact replay, but never overwrite a different result of that attempt.
        const existing = this.readBytes(filename)
        if (!existing.equals(content)) throw new Error('An immutable artifact already exists with different content')
      } finally { if (fd !== undefined) fs.closeSync(fd) }
      if (this.directory(request.taskId, request.stepId, request.attemptId, false) !== directory) throw new Error('Artifact destination changed during write')
      this.syncDirectory(directory)
      const id = 'artifact-' + createHash('sha256').update(`${request.taskId}:${request.stepId}:${request.attemptId}:${artifact.name}`).digest('hex').slice(0, 32)
      const previous = request.previous.find(item => item.id === id)
      receipts.push({ id, name: artifact.name, path: filename, version: previous?.version ?? 1 + Math.max(0, ...request.previous.filter(item => item.name === artifact.name).map(item => item.version)), sha256: hash(content), bytes: content.length, stepId: request.stepId, attemptId: request.attemptId, createdAt: previous?.createdAt ?? Date.now() })
    }
    checkAbort(signal)
    return receipts
  }
  private readBytes(filename: string): Buffer {
    const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    try {
      const stat = fs.fstatSync(fd)
      if (!stat.isFile() || stat.size > 256000) throw new Error('Invalid artifact file or size')
      const value = fs.readFileSync(fd)
      if (value.length > 256000) throw new Error('Artifact grew beyond the size limit')
      return value
    } finally { fs.closeSync(fd) }
  }
  async read(taskId: string, receipt: CodeArtifactReceipt): Promise<{ name: string; content: string; sha256: string; version: number }> {
    identity(receipt.id)
    // Validate the allowlisted basename without accepting any renderer path.
    validateArtifactDrafts([{ name: receipt.name, content: 'validation' }])
    const directory = this.directory(taskId, receipt.stepId, receipt.attemptId, false)
    const filename = path.join(directory, receipt.name)
    if (receipt.path !== filename) throw new Error('Artifact receipt does not belong to this task')
    const value = this.readBytes(filename)
    if (hash(value) !== receipt.sha256 || value.length !== receipt.bytes) throw new Error('Artifact changed after it was prepared. Generate a new version before approving it.')
    if (this.directory(taskId, receipt.stepId, receipt.attemptId, false) !== directory) throw new Error('Artifact directory changed while reading')
    return { name: receipt.name, content: value.toString('utf8'), sha256: receipt.sha256, version: receipt.version }
  }
  async context(taskId: string, receipts: CodeArtifactReceipt[], referencesOnly = false): Promise<string> {
    const latest = new Map<string, CodeArtifactReceipt>()
    for (const receipt of receipts) if ((latest.get(receipt.name)?.version ?? 0) < receipt.version) latest.set(receipt.name, receipt)
    const documents: string[] = []
    let size = 0
    for (const receipt of latest.values()) {
      const artifact = await this.read(taskId, receipt)
      if (referencesOnly) {
        documents.push(`Artifact ${receipt.name}, version ${receipt.version}, SHA256 ${receipt.sha256}\nFile: ${receipt.path}`)
        continue
      }
      size += artifact.content.length
      if (size > 160000) throw new Error('Workflow artifact context exceeds the limit; shorten the preparation documents')
      documents.push(`Artifact ${receipt.name}, version ${receipt.version}, SHA256 ${receipt.sha256}\nFile: ${receipt.path}\n<artifact-data>\n${artifact.content}\n</artifact-data>`)
    }
    return documents.join('\n\n')
  }
}
