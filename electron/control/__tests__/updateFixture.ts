import { createHash } from 'node:crypto'
import type { GitHubRelease, UpdateCandidate } from '../UpdateRelease'

export const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')
export const repository = 'ZIAForge/ZIAForge'
export const commit = 'a'.repeat(40)
export const releaseId = '12345678-1234-1234-1234-123456789abc'
export function releaseFixture(bytes: Buffer = Buffer.from('inert update fixture'), platform: NodeJS.Platform = 'darwin', arch = 'x64', extension = 'dmg', version = '1.0.9') {
  const os = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[platform as 'darwin' | 'win32' | 'linux']
  const name = `ZIAForge-${version}-${os}-${arch}.${extension}`, buildId = `${version}.release.${releaseId}.r0.${platform}-${arch}.123.1`
  const entry = { name, bytes: bytes.length, sha256: hash(bytes), platform, arch }
  const manifest = Buffer.from(JSON.stringify({ schemaVersion: 1, product: 'ZIAForge', version, mode: 'release', channel: 'stable', releaseId, sourceCommit: commit, targets: [{ platform, arch, buildId, sourceCommit: commit, artifactNames: [name], packageIntegrity: 'passed' }], assets: [entry] }))
  const asset = (name: string, data: Buffer) => ({ name, browser_download_url: `https://github.com/${repository}/releases/download/v${version}/${name}`, size: data.length, digest: `sha256:${hash(data)}`, state: 'uploaded' })
  const release: GitHubRelease = { id: 99, version, tag: `v${version}`, url: `https://github.com/${repository}/releases/tag/v${version}`, prerelease: false, assets: [asset('release-manifest.json', manifest), asset(name, bytes)] }
  const catalog = [{ id: release.id, tag_name: release.tag, html_url: release.url, draft: false, prerelease: false, assets: release.assets }]
  const candidate: UpdateCandidate = { release, sourceCommit: commit, releaseId, buildId, asset: { name, url: release.assets[1].browser_download_url, bytes: bytes.length, sha256: hash(bytes), platform, arch } }
  return { bytes, manifest, release, candidate, catalog }
}

/** Small stored ZIP fixtures with real CRCs; no archive dependency or build. */
export function zipFixture(entries: { name: string; bytes?: Buffer; mode?: number }[]): Buffer {
  const locals: Buffer[] = [], directory: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name), bytes = entry.bytes ?? Buffer.alloc(0)
    let crc = 0xffffffff
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0) }
    crc = (crc ^ 0xffffffff) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x314, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(((entry.mode ?? (entry.name.endsWith('/') ? 0o40755 : 0o100644)) << 16) >>> 0, 38); central.writeUInt32LE(offset, 42)
    locals.push(local, name, bytes); directory.push(central, name); offset += local.length + name.length + bytes.length
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, central, end])
}
