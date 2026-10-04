const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function supplementalNotice(project, relative, entry, installed, installedBytes) {
  const manifestPath = path.join(project, 'docs/licenses/supplemental-notices.json')
  if (!fs.existsSync(manifestPath)) return null
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.notices)) throw new Error('Invalid supplemental notice manifest')
  const matches = manifest.notices.filter(notice => notice.packagePath === relative)
  if (!matches.length) return null
  if (matches.length !== 1) throw new Error(`Duplicate supplemental notice: ${relative}`)
  const notice = matches[0]
  const author = typeof installed.author === 'string' ? installed.author : installed.author?.name
  const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
  if (notice.name !== installed.name || notice.version !== installed.version || notice.version !== entry.version ||
    notice.license !== entry.license || notice.license !== installed.license || notice.author !== author ||
    !notice.integrity || notice.integrity !== entry.integrity || !notice.resolved || notice.resolved !== entry.resolved ||
    notice.packageJsonSha256 !== sha256(installedBytes)) throw new Error(`Supplemental notice package binding changed; needs license review: ${relative}`)
  if (typeof notice.file !== 'string' || !/^docs\/licenses\/[a-zA-Z0-9_.-]+\.txt$/.test(notice.file)) throw new Error('Unsafe supplemental notice path')
  const filename = path.join(project, notice.file)
  const stat = fs.lstatSync(filename)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024) throw new Error(`Unsafe supplemental notice: ${notice.file}`)
  const bytes = fs.readFileSync(filename)
  if (sha256(bytes) !== notice.sha256) throw new Error(`Supplemental notice text changed; needs license review: ${notice.file}`)
  return { file: notice.file, sha256: notice.sha256, text: bytes.toString('utf8') }
}

function collectNotices(project) {
  const lockBytes = fs.readFileSync(path.join(project, 'package-lock.json'))
  const lock = JSON.parse(lockBytes)
  const dependencies = []
  const notices = ['ZIAForge runtime dependency notices', 'The following notices accompany the exact installed packages used by this build.']
  for (const [relative, entry] of Object.entries(lock.packages || {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (!relative) continue
    if (!relative.startsWith('node_modules/') || relative.split('/').includes('..')) throw new Error('Unsafe locked dependency path')
    const name = relative.slice(relative.lastIndexOf('node_modules/') + 'node_modules/'.length)
    const runtime = !entry.dev && !entry.devOptional
    const dependency = { path: relative, name, version: entry.version, license: entry.license || null,
      integrity: entry.integrity || null, runtime }
    dependencies.push(dependency)
    if (!runtime) continue
    const directory = path.join(project, relative)
    const installedBytes = fs.readFileSync(path.join(directory, 'package.json'))
    const installed = JSON.parse(installedBytes)
    if (installed.name !== name || installed.version !== entry.version) throw new Error(`Dependency differs from lockfile: ${relative}`)
    const files = fs.readdirSync(directory).filter(filename => /^(licen[cs]e|copying|notice)(?:\.|$)/i.test(filename)).sort()
    if (!entry.license) throw new Error(`Runtime dependency needs license review: ${relative}`)
    if (!files.length) {
      const supplemental = supplementalNotice(project, relative, entry, installed, installedBytes)
      if (!supplemental) throw new Error(`Runtime dependency needs license review: ${relative}`)
      dependency.supplementalNotice = { path: supplemental.file, sha256: supplemental.sha256, kind: 'reviewed-declaration-based-supplement' }
      notices.push(`\n${'='.repeat(72)}\n${name} ${entry.version} — ${entry.license}\nSUPPLEMENTAL NOTICE (not an upstream license file): ${supplemental.file}\n\n${supplemental.text}`)
    }
    for (const filename of files) {
      const absolute = path.join(directory, filename)
      const stat = fs.lstatSync(absolute)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512 * 1024) throw new Error(`Unsafe dependency notice: ${relative}/${filename}`)
      notices.push(`\n${'='.repeat(72)}\n${name} ${entry.version} — ${entry.license}\n${relative}/${filename}\n\n${fs.readFileSync(absolute, 'utf8')}`)
    }
  }
  return { inventory: { schemaVersion: 1, lockSha256: crypto.createHash('sha256').update(lockBytes).digest('hex'),
    description: 'Locked npm dependency metadata, not a complete binary SBOM or legal clearance. Electron/Chromium notices are included separately.', dependencies },
  text: notices.join('\n') + '\n' }
}
module.exports = { collectNotices }
