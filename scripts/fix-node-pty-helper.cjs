// npm can extract node-pty's macOS spawn-helper without executable bits.
// Touch only regular files in the local npm package, never recursively chmod.
const fs = require('node:fs')
const path = require('node:path')

function checkedPath(projectRoot, relative) {
  const root = fs.realpathSync(projectRoot)
  const parts = relative.split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe helper path')
  let filename = root
  for (const [index, part] of parts.entries()) {
    filename = path.join(filename, part)
    let stat
    try { stat = fs.lstatSync(filename) }
    catch (error) { if (error.code === 'ENOENT') return null; throw error }
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in node-pty helper path: ${relative}`)
    if (index < parts.length - 1 && !stat.isDirectory()) throw new Error(`Expected directory in helper path: ${relative}`)
  }
  return { filename, stat: fs.lstatSync(filename) }
}

function inspectHelpers(projectRoot, arch = process.arch) {
  const packageRelative = 'node_modules/node-pty'
  const packageInfo = checkedPath(projectRoot, `${packageRelative}/package.json`)
  if (!packageInfo) return { packagePresent: false, helpers: [], applicableExecutable: false }
  if (!packageInfo.stat.isFile()) throw new Error('node-pty/package.json must be a regular file')
  const metadata = JSON.parse(fs.readFileSync(packageInfo.filename, 'utf8'))
  if (metadata.name !== 'node-pty') throw new Error('Refusing helper changes: local package is not node-pty')
  const targets = ['build/Release/spawn-helper']
  const prebuilds = checkedPath(projectRoot, `${packageRelative}/prebuilds`)
  if (prebuilds) {
    if (!prebuilds.stat.isDirectory()) throw new Error('node-pty/prebuilds must be a directory')
    for (const name of fs.readdirSync(prebuilds.filename).sort()) {
      if (/^darwin-[A-Za-z0-9_-]+$/.test(name)) targets.push(`prebuilds/${name}/spawn-helper`)
    }
  }
  const helpers = targets.map(relative => {
    const entry = checkedPath(projectRoot, `${packageRelative}/${relative}`)
    if (entry && !entry.stat.isFile()) throw new Error(`Helper must be a regular file: ${relative}`)
    let executable = false
    if (entry) {
      try { fs.accessSync(entry.filename, fs.constants.X_OK); executable = Boolean(entry.stat.mode & 0o111) }
      catch { /* Presence does not imply executability. */ }
    }
    return {
      relative, present: Boolean(entry), executable,
      mode: entry ? (entry.stat.mode & 0o777).toString(8).padStart(3, '0') : null,
      applicable: relative === 'build/Release/spawn-helper' || relative === `prebuilds/darwin-${arch}/spawn-helper`,
    }
  })
  return {
    packagePresent: true, version: metadata.version, helpers,
    applicableExecutable: helpers.some(helper => helper.applicable && helper.present && helper.executable),
  }
}

function repairHelpers(projectRoot, { platform = process.platform, arch = process.arch } = {}) {
  if (platform !== 'darwin') return { status: 'not-applicable', platform, reason: 'macOS spawn-helper repair only' }
  // Validate every candidate before changing any mode.
  const inspected = inspectHelpers(projectRoot, arch)
  if (!inspected.packagePresent) throw new Error('Local npm dependency node-pty is missing')
  if (!inspected.helpers.some(helper => helper.present && helper.applicable)) throw new Error(`No node-pty spawn-helper found for darwin-${arch}`)
  const changed = []
  for (const helper of inspected.helpers.filter(helper => helper.present)) {
    const relative = `node_modules/node-pty/${helper.relative}`
    const entry = checkedPath(projectRoot, relative)
    if (!entry || !entry.stat.isFile()) throw new Error(`Helper changed during inspection: ${relative}`)
    const mode = entry.stat.mode & 0o777
    if ((mode & 0o111) === 0o111) continue
    const fd = fs.openSync(entry.filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    try {
      const opened = fs.fstatSync(fd)
      if (!opened.isFile() || opened.ino !== entry.stat.ino || opened.dev !== entry.stat.dev) throw new Error(`Helper changed before chmod: ${relative}`)
      fs.fchmodSync(fd, mode | 0o111)
    } finally { fs.closeSync(fd) }
    changed.push({ relative: helper.relative, before: mode.toString(8).padStart(3, '0'), after: (mode | 0o111).toString(8).padStart(3, '0') })
  }
  const verified = inspectHelpers(projectRoot, arch)
  if (!verified.applicableExecutable) throw new Error('node-pty helper is still not executable; native PTY remains unverified')
  return { status: changed.length ? 'repaired' : 'already-executable', platform, changed, ...verified, nativePtyRuntime: 'unverified until a real Electron PTY spawn succeeds' }
}

if (require.main === module) {
  try { console.log(JSON.stringify(repairHelpers(path.resolve(__dirname, '..')), null, 2)) }
  catch (error) { console.error(`node-pty helper setup failed: ${error.message}`); process.exitCode = 1 }
}

module.exports = { inspectHelpers, repairHelpers }
