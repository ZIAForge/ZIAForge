import fs from 'node:fs'
import path from 'node:path'
import { detectUpdateTarget, type UpdateEnvironment } from './UpdateInstaller'

const downloadName = /^[a-f0-9]{64}-ZIAForge-[0-9][\w.+-]*-(?:macOS|Windows|Linux)-(?:x64|arm64)\.(?:zip|dmg|exe|AppImage|deb|rpm)$/
const jobName = /^install-[A-Za-z0-9]{6}$/
function regular(filename: string) { const stat = fs.lstatSync(filename); return stat.isFile() && !stat.isSymbolicLink() }
function readRecord(filename: string): Record<string, unknown> {
  if (!regular(filename) || fs.statSync(filename).size > 128 * 1024) throw new Error('Invalid updater receipt')
  const record: unknown = JSON.parse(fs.readFileSync(filename, 'utf8'))
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid updater receipt')
  return record as Record<string, unknown>
}

/** The cache is application-private; only exact updater-generated file names expire. */
export function pruneUpdateDownloads(directory: string, keep?: string): void {
  if (!fs.existsSync(directory)) return
  if (fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory) !== directory) return
  const downloads: { filename: string; at: number }[] = []
  for (const name of fs.readdirSync(directory)) {
    const filename = path.join(directory, name), stat = fs.lstatSync(filename)
    if (!stat.isFile() || stat.isSymbolicLink()) continue
    if (downloadName.test(name)) downloads.push({ filename, at: stat.mtimeMs })
    else if (/^[a-f0-9-]{36}\.partial$/.test(name) && stat.mtimeMs < Date.now() - 24 * 60 * 60 * 1000) fs.unlinkSync(filename)
  }
  downloads.sort((a, b) => b.at - a.at)
  const retained = keep ?? downloads[0]?.filename
  for (const entry of downloads) if (entry.filename !== retained) fs.unlinkSync(entry.filename)
}

/** A helper receipt alone never certifies success. The newly running app must
 * match the prepared release identity before any previous rollback expires. */
export function confirmUpdateStartup(directory: string, env: UpdateEnvironment): void {
  if (!fs.existsSync(directory) || fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory) !== directory) return
  const target = detectUpdateTarget(env)
  if (!target.identityPath) return
  const identity = readRecord(target.identityPath), source = identity.source as Record<string, unknown> | undefined
  const confirmed: { directory: string; prepared: Record<string, unknown>; at: number }[] = []
  for (const name of fs.readdirSync(directory)) {
    if (!jobName.test(name)) continue
    const job = path.join(directory, name)
    if (fs.lstatSync(job).isSymbolicLink() || !fs.statSync(job).isDirectory()) continue
    try {
      const prepared = readRecord(path.join(job, 'prepared.json'))
      if (prepared.destination !== target.destination || prepared.receipt !== path.join(job, 'result.json') || !['mac-zip', 'appimage', 'nsis', 'deb', 'rpm'].includes(String(prepared.kind))) continue
      const result = readRecord(path.join(job, 'result.json'))
      if (!['applied', 'applying', 'installer-completed'].includes(String(result.status))) continue
      const successFile = path.join(job, 'confirmed.json')
      if (!fs.existsSync(successFile) && prepared.version === env.version && prepared.sourceCommit === source?.commit) {
        fs.writeFileSync(successFile, JSON.stringify({ version: env.version, sourceCommit: source?.commit, at: Date.now() }), { flag: 'wx', mode: 0o600 })
      }
      if (!fs.existsSync(successFile)) continue
      const success = readRecord(successFile)
      if (success.version !== prepared.version || success.sourceCommit !== prepared.sourceCommit || typeof success.at !== 'number') continue
      confirmed.push({ directory: job, prepared, at: success.at })
    } catch { /* Unknown receipts and failed updates remain available for inspection. */ }
  }
  confirmed.sort((a, b) => b.at - a.at)
  for (let index = 0; index < confirmed.length; index++) {
    const { prepared } = confirmed[index]
    // Only siblings of the verified current installation, with exact generated
    // names, are eligible. Profiles, repositories and arbitrary receipt paths
    // can never become recursive deletion targets.
    if (typeof prepared.destination !== 'string') continue
    const parent = path.dirname(prepared.destination)
    const sibling = prepared.sibling
    if (typeof sibling === 'string' && path.dirname(sibling) === parent && /^\.ziaforge-update-[A-Za-z0-9]{6}$/.test(path.basename(sibling)) && fs.existsSync(sibling) && !fs.lstatSync(sibling).isSymbolicLink()) {
      // Successful replacement moved the only payload out; remove empty stage only.
      if (fs.readdirSync(sibling).length === 0) fs.rmdirSync(sibling)
    }
    const backup = prepared.backup
    if (index > 0 && typeof backup === 'string' && path.dirname(backup) === parent && /^\.ziaforge-backup-[a-f0-9-]{36}\.(?:app|AppImage)$/.test(path.basename(backup)) && fs.existsSync(backup) && !fs.lstatSync(backup).isSymbolicLink()) {
      if (prepared.kind === 'mac-zip') {
        const previous = readRecord(path.join(backup, 'Contents/Resources/build-identity.json'))
        if (previous.platform !== 'darwin' || previous.mode !== 'release') continue
      } else if (prepared.kind !== 'appimage' || !regular(backup)) continue
      fs.rmSync(backup, { recursive: prepared.kind === 'mac-zip' })
    }
  }
  pruneUpdateDownloads(directory)
}
