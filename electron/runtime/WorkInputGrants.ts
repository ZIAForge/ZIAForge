import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { RecoveryStore } from './RecoveryStore'
import { ensurePrivateDirectory } from './privateStorage'
import { isWithin } from './ProjectAccess'
import type { WorkInputRef } from '../../shared/work-flow'

export interface WorkFolderGrant { id: string; path: string; name: string; device: number; inode: number }
interface InputGrant { id: string; name: string; sizeBytes: number; sha256: string }
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
// Native filenames must remain printable single path segments.
// eslint-disable-next-line no-control-regex
const unsafeName = /[\x00-\x1f/\\]/g
function validId(id: unknown): asserts id is string { if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new Error('Invalid Work input identity') }
function validateInput(value: unknown): asserts value is InputGrant {
  const item = value as InputGrant
  if (!item || typeof item !== 'object') throw new Error('Invalid Work input')
  validId(item.id)
  if (typeof item.name !== 'string' || !item.name || path.basename(item.name) !== item.name || item.name.replace(unsafeName, '_') !== item.name || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes < 0 || item.sizeBytes > 32 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid Work input receipt')
}
function validateFolder(value: unknown): asserts value is WorkFolderGrant {
  const item = value as WorkFolderGrant
  if (!item || typeof item !== 'object') throw new Error('Invalid Work folder')
  validId(item.id)
  if (typeof item.path !== 'string' || !path.isAbsolute(item.path) || typeof item.name !== 'string' || !Number.isSafeInteger(item.device) || !Number.isSafeInteger(item.inode)) throw new Error('Invalid Work folder grant')
}

/** Only the main-process native picker may register a source. Renderer requests use opaque IDs. */
export class WorkInputGrants {
  constructor(private readonly directory: string) { ensurePrivateDirectory(directory) }
  private inputStore(id: string) { validId(id); return new RecoveryStore<InputGrant>({ filename: path.join(this.directory, `${id}.input.json`), validate: validateInput }) }
  private folderStore(id: string) { validId(id); return new RecoveryStore<WorkFolderGrant>({ filename: path.join(this.directory, `${id}.folder.json`), validate: validateFolder }) }
  registerFolder(selected: string, userHome: string): WorkFolderGrant {
    if (fs.lstatSync(selected).isSymbolicLink()) throw new Error('Choose a real Work folder, not a symbolic link')
    const canonical = fs.realpathSync(selected), stat = fs.statSync(canonical)
    if (!stat.isDirectory() || isWithin(canonical, fs.realpathSync(userHome))) throw new Error('Choose a dedicated Work folder, not the home directory or its ancestor')
    const grant = { id: `folder-${randomUUID()}`, path: canonical, name: path.basename(canonical), device: stat.dev, inode: stat.ino }
    this.folderStore(grant.id).write(grant)
    return grant
  }
  folder(id: string): WorkFolderGrant {
    const grant = this.folderStore(id).read()
    if (!grant || grant.id !== id) throw new Error('Select the Work folder again')
    const stat = fs.lstatSync(grant.path)
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(grant.path) !== grant.path || stat.dev !== grant.device || stat.ino !== grant.inode) throw new Error('The selected Work folder has changed. Select it again.')
    return grant
  }
  importFile(selected: string): WorkInputRef {
    const fd = fs.openSync(selected, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    let bytes: Buffer
    try {
      const stat = fs.fstatSync(fd)
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('Work inputs must be regular files up to 32 MB')
      bytes = fs.readFileSync(fd)
      if (bytes.length > 32 * 1024 * 1024) throw new Error('Work input grew while being imported')
    } finally { fs.closeSync(fd) }
    const item = { id: `input-${randomUUID()}`, name: path.basename(selected).replace(unsafeName, '_'), sizeBytes: bytes.length, sha256: hash(bytes) }
    validateInput(item)
    fs.writeFileSync(path.join(this.directory, `${item.id}.data`), bytes, { flag: 'wx', mode: 0o600 })
    this.inputStore(item.id).write(item)
    return { ...item }
  }
  list(ids: string[]): WorkInputRef[] {
    if (!Array.isArray(ids) || ids.length > 20 || new Set(ids).size !== ids.length) throw new Error('Choose up to 20 distinct Work inputs')
    return ids.map(id => {
      const item = this.inputStore(id).read()
      if (!item || item.id !== id) throw new Error('A selected Work input is missing; attach it again')
      this.bytes(item)
      return { ...item }
    })
  }
  private bytes(item: InputGrant): Buffer {
    const fd = fs.openSync(path.join(this.directory, `${item.id}.data`), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    try {
      const stat = fs.fstatSync(fd)
      if (!stat.isFile() || stat.size !== item.sizeBytes) throw new Error('Saved Work input changed')
      const bytes = fs.readFileSync(fd)
      if (hash(bytes) !== item.sha256) throw new Error('Saved Work input changed')
      return bytes
    } finally { fs.closeSync(fd) }
  }
  validate(refs: WorkInputRef[], cwd: string): void {
    const root = fs.realpathSync(cwd)
    const saved = this.list(refs.map(item => item.id))
    for (const [index, item] of saved.entries()) {
      const relativePath = path.join('.ziaf-inputs', item.id, item.name), supplied = refs[index]
      if (supplied.name !== item.name || supplied.sizeBytes !== item.sizeBytes || supplied.sha256 !== item.sha256 || supplied.relativePath !== relativePath) throw new Error('Work input receipt changed')
      const target = path.join(root, relativePath)
      if (fs.realpathSync(target) !== target) throw new Error('Work input must not traverse a symbolic link')
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
      try { if (!fs.fstatSync(fd).isFile() || fs.fstatSync(fd).size !== item.sizeBytes || hash(fs.readFileSync(fd)) !== item.sha256) throw new Error('Task input was modified; attach a new version') }
      finally { fs.closeSync(fd) }
    }
  }
  materialize(ids: string[], cwd: string): WorkInputRef[] {
    const root = fs.realpathSync(cwd)
    return this.list(ids).map(item => {
      const folder = path.join(root, '.ziaf-inputs', item.id)
      for (const part of [path.dirname(folder), folder]) {
        if (fs.existsSync(part) && (fs.lstatSync(part).isSymbolicLink() || !fs.statSync(part).isDirectory())) throw new Error('Unsafe Work input destination')
        fs.mkdirSync(part, { recursive: true, mode: 0o700 })
        if (fs.realpathSync(part) !== part) throw new Error('Work input directory changed')
      }
      const target = path.join(folder, item.name)
      const bytes = this.bytes(item)
      try { fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 }) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
        try { if (fs.fstatSync(fd).size !== item.sizeBytes || hash(fs.readFileSync(fd)) !== item.sha256) throw new Error('Task input was modified; attach a new version') }
        finally { fs.closeSync(fd) }
      }
      return { ...item, relativePath: path.relative(root, target) }
    })
  }
}
