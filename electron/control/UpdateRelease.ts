import { createHash } from 'node:crypto'
import { gt, valid, prerelease, rcompare } from 'semver'
import { assertUpdateUrl, updateBytes, type UpdateAsset } from './UpdateDownload'

type RecordValue = Record<string, unknown>
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value)
export interface GitHubReleaseAsset { name: string; browser_download_url: string; size: number; digest: string; state: string }
export interface GitHubRelease { id: number; version: string; tag: string; url: string; prerelease: boolean; assets: GitHubReleaseAsset[] }
export interface UpdateCandidate { release: GitHubRelease; asset: UpdateAsset; sourceCommit: string; releaseId: string; buildId: string }

export function parseReleases(value: unknown, repository: string, currentVersion: string, channel: 'stable' | 'preview'): GitHubRelease[] {
  if (!Array.isArray(value) || value.length > 100 || !valid(currentVersion)) throw new Error('Invalid GitHub release catalog or current version')
  const result: GitHubRelease[] = []
  for (const row of value) {
    if (!object(row) || row.draft !== false || typeof row.tag_name !== 'string' || typeof row.prerelease !== 'boolean') continue
    const version = row.tag_name.replace(/^v/, '')
    if (!valid(version) || !gt(version, currentVersion) || channel === 'stable' && (row.prerelease || prerelease(version))) continue
    if (!Number.isSafeInteger(row.id) || typeof row.html_url !== 'string' || row.html_url !== `https://github.com/${repository}/releases/tag/${row.tag_name}` || !Array.isArray(row.assets)) throw new Error('Release identity is invalid')
    const names = new Set<string>(), assets: GitHubReleaseAsset[] = []
    for (const asset of row.assets) {
      if (!object(asset) || typeof asset.name !== 'string' || names.has(asset.name) || typeof asset.browser_download_url !== 'string' || !Number.isSafeInteger(asset.size) || Number(asset.size) < 1 || typeof asset.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(asset.digest) || asset.state !== 'uploaded') throw new Error('Release asset identity is invalid')
      assertUpdateUrl(asset.browser_download_url, repository)
      if (asset.browser_download_url !== `https://github.com/${repository}/releases/download/${row.tag_name}/${encodeURIComponent(asset.name)}`) throw new Error('Release asset belongs to a different tag')
      names.add(asset.name)
      assets.push(asset as unknown as GitHubReleaseAsset)
    }
    result.push({ id: Number(row.id), version, tag: row.tag_name, url: row.html_url, prerelease: row.prerelease, assets })
  }
  return result.sort((a, b) => rcompare(a.version, b.version))
}

export function verifiedCandidate(release: GitHubRelease, bytes: Buffer, platform: NodeJS.Platform, arch: string, extension: string): UpdateCandidate {
  const manifestAsset = release.assets.find(asset => asset.name === 'release-manifest.json')
  if (!manifestAsset || manifestAsset.size !== bytes.length || manifestAsset.digest !== `sha256:${createHash('sha256').update(bytes).digest('hex')}`) throw new Error('Release manifest failed GitHub digest verification')
  const manifest: unknown = JSON.parse(bytes.toString('utf8'))
  if (!object(manifest) || manifest.schemaVersion !== 1 || manifest.product !== 'ZIAForge' || manifest.version !== release.version || manifest.mode !== 'release' || !['stable', 'preview'].includes(String(manifest.channel)) || !release.prerelease && manifest.channel !== 'stable' || typeof manifest.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) || typeof manifest.releaseId !== 'string' || !/^[a-f0-9-]{36}$/.test(manifest.releaseId) || !Array.isArray(manifest.targets) || !Array.isArray(manifest.assets)) throw new Error('Release manifest does not match the selected application release')
  const osName = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[platform as 'darwin' | 'win32' | 'linux']
  if (!osName || !['x64', 'arm64'].includes(arch)) throw new Error('No update package exists for this platform')
  const name = `ZIAForge-${release.version}-${osName}-${arch}.${extension}`
  const targets = manifest.targets.filter(row => object(row) && row.platform === platform && row.arch === arch)
  if (targets.length !== 1) throw new Error('Release target is missing or ambiguous')
  const target = targets[0] as RecordValue
  if (target.sourceCommit !== manifest.sourceCommit || typeof target.buildId !== 'string' || !target.buildId.startsWith(`${release.version}.release.${manifest.releaseId}.`) || !Array.isArray(target.artifactNames) || !target.artifactNames.includes(name) || target.packageIntegrity !== 'passed') throw new Error('Release target integrity metadata is invalid')
  const entries = manifest.assets.filter(row => object(row) && row.name === name)
  const published = release.assets.find(asset => asset.name === name)
  if (entries.length !== 1 || !published) throw new Error('The matching update package is missing')
  const entry = entries[0] as RecordValue
  if (entry.platform !== platform || entry.arch !== arch || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || entry.bytes !== published.size || published.digest !== `sha256:${entry.sha256}`) throw new Error('Update package identity differs between GitHub and the release manifest')
  return { release, sourceCommit: manifest.sourceCommit, releaseId: manifest.releaseId, buildId: target.buildId, asset: { name, url: published.browser_download_url, bytes: published.size, sha256: entry.sha256, platform, arch } }
}

export async function loadUpdateCandidate(release: GitHubRelease, repository: string, platform: NodeJS.Platform, arch: string, extension: string, signal: AbortSignal): Promise<UpdateCandidate> {
  const asset = release.assets.find(asset => asset.name === 'release-manifest.json')
  if (!asset || asset.size > 2 * 1024 * 1024) throw new Error('Release has no supported update manifest')
  return verifiedCandidate(release, await updateBytes(asset.browser_download_url, repository, signal, 2 * 1024 * 1024), platform, arch, extension)
}
