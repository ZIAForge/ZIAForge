import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { ensurePrivateDirectory } from '../runtime/privateStorage'

export const UPDATE_REPOSITORY = 'ZIAForge/ZIAForge'
const MAX_ASSET_BYTES = 1024 * 1024 * 1024
const REDIRECT_HOSTS = new Set(['release-assets.githubusercontent.com', 'objects.githubusercontent.com'])

/** Release URLs come from the authenticated HTTPS GitHub origin, never from the renderer. */
export function assertUpdateUrl(value: string, repository: string, redirected = false): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw new Error('Invalid update download URL')
  const assetPrefix = `/${repository}/releases/download/`
  if (url.hostname === 'github.com' && url.pathname.startsWith(assetPrefix) && !url.search) return url
  if (redirected && REDIRECT_HOSTS.has(url.hostname)) return url
  throw new Error('Update download left the trusted GitHub release hosts')
}

export async function updateResponse(url: string, repository: string, signal: AbortSignal): Promise<Response> {
  let next = assertUpdateUrl(url, repository)
  for (let redirect = 0; redirect < 5; redirect++) {
    const response = await fetch(next, { headers: { Accept: 'application/octet-stream' }, redirect: 'manual', signal })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('Update download redirect has no destination')
      next = assertUpdateUrl(new URL(location, next).href, repository, true)
      continue
    }
    if (!response.ok || !response.body) throw new Error(`Update download failed (HTTP ${response.status})`)
    return response
  }
  throw new Error('Too many update download redirects')
}

export async function updateBytes(url: string, repository: string, signal: AbortSignal, limit: number): Promise<Buffer> {
  const response = await updateResponse(url, repository, signal)
  const reader = response.body!.getReader(), chunks: Buffer[] = []
  let bytes = 0
  try {
    for (;;) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > limit) throw new Error('Update metadata exceeds its size limit')
      chunks.push(Buffer.from(value))
    }
  } finally { await reader.cancel().catch(() => {}) }
  return Buffer.concat(chunks)
}

export async function fileSha256(filename: string): Promise<string> {
  const stat = fs.lstatSync(filename)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Update cache must contain a regular file')
  const hash = createHash('sha256')
  const file = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  try {
    if (!(await file.stat()).isFile()) throw new Error('Update cache must contain a regular file')
    for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk as Buffer)
  } finally { await file.close() }
  return hash.digest('hex')
}

export interface UpdateAsset {
  name: string; url: string; bytes: number; sha256: string
  platform: NodeJS.Platform; arch: string
}

export async function downloadUpdateAsset(asset: UpdateAsset, repository: string, directory: string, signal: AbortSignal, progress: (percent: number) => void): Promise<string> {
  if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > MAX_ASSET_BYTES || !/^[a-f0-9]{64}$/.test(asset.sha256) || path.basename(asset.name) !== asset.name) throw new Error('Invalid update asset identity')
  ensurePrivateDirectory(directory)
  const filename = path.join(directory, `${asset.sha256}-${asset.name}`)
  if (fs.existsSync(filename)) {
    const stat = fs.lstatSync(filename)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== asset.bytes || await fileSha256(filename) !== asset.sha256) throw new Error('Previously downloaded update failed verification; its cache is retained for inspection')
    progress(100)
    return filename
  }
  const temporary = path.join(directory, `${randomUUID()}.partial`)
  const file = await fs.promises.open(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600)
  let completed = false
  try {
    const response = await updateResponse(asset.url, repository, signal)
    const length = response.headers.get('content-length')
    if (length && Number(length) !== asset.bytes) { await response.body?.cancel(); throw new Error('Update download size differs from the release manifest') }
    const hash = createHash('sha256'), reader = response.body!.getReader()
    let bytes = 0
    try {
      for (;;) {
        signal.throwIfAborted()
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > asset.bytes) throw new Error('Update download exceeded its declared size')
        hash.update(value)
        let offset = 0
        while (offset < value.byteLength) {
          const { bytesWritten } = await file.write(value, offset)
          if (!bytesWritten) throw new Error('Update cache could not make progress writing the download')
          offset += bytesWritten
        }
        progress(bytes / asset.bytes * 100)
      }
    } finally { await reader.cancel().catch(() => {}) }
    if (bytes !== asset.bytes || hash.digest('hex') !== asset.sha256) throw new Error('Update checksum does not match the published release')
    signal.throwIfAborted()
    await file.sync()
    await file.close()
    // Exclusive publication: a second update never overwrites an immutable cache entry.
    await fs.promises.link(temporary, filename)
    completed = true
    return filename
  } finally {
    if (!completed) await file.close().catch(() => {})
    await fs.promises.rm(temporary, { force: true })
  }
}
