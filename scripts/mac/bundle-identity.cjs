const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const plist = require('plist')
const asar = require('@electron/asar')
const { sha256 } = require('./package-utils.cjs')

function regularFile(app, relative) {
  let current = app
  for (const part of relative.split('/')) {
    current = path.join(current, part)
    const stat = fs.lstatSync(current)
    if (stat.isSymbolicLink()) throw new Error(`Bundle identity path is a symlink: ${relative}`)
  }
  if (!fs.statSync(current).isFile()) throw new Error(`Bundle identity file is not regular: ${relative}`)
  return current
}

/** Read-only: never repair an incorrectly branded bundle into an apparent pass. */
function assertBundleIdentity(app, expected) {
  if (fs.lstatSync(app).isSymbolicLink() || !fs.statSync(app).isDirectory()) throw new Error('Bundle must be a real directory')
  const infoPath = regularFile(app, 'Contents/Info.plist')
  const info = plist.parse(fs.readFileSync(infoPath, 'utf8'))
  const fields = {
    CFBundleName: expected.productName, CFBundleDisplayName: expected.productName,
    CFBundleIdentifier: expected.appId, CFBundleExecutable: expected.productName,
    CFBundleShortVersionString: expected.version, CFBundleVersion: expected.version,
    CFBundleIconFile: 'icon.icns', ZIAForgeBuildId: expected.buildId,
    ZIAForgeSourceCommit: expected.source.commit, ZIAForgeSourceSHA256: expected.source.workingTreeSha256,
  }
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || !value || info[key] !== value) throw new Error(`Bundle identity mismatch: ${key}`)
  }
  for (const relative of ['Contents/MacOS/Electron', 'Contents/Resources/electron.icns', 'Contents/Resources/default_app.asar']) {
    try { fs.lstatSync(path.join(app, relative)) }
    catch (error) { if (error.code === 'ENOENT') continue; throw error }
    throw new Error(`Stock Electron entry remains in bundle: ${relative}`)
  }
  const executable = regularFile(app, `Contents/MacOS/${expected.productName}`)
  fs.accessSync(executable, fs.constants.X_OK)
  const icon = regularFile(app, 'Contents/Resources/icon.icns')
  if (sha256(icon) !== expected.iconSha256) throw new Error('Bundle icon differs from the reviewed application icon')
  const embedded = JSON.parse(fs.readFileSync(regularFile(app, 'Contents/Resources/build-identity.json'), 'utf8'))
  if (embedded.version !== expected.version || embedded.buildId !== expected.buildId ||
      embedded.source?.commit !== expected.source.commit || embedded.source?.workingTreeSha256 !== expected.source.workingTreeSha256) {
    throw new Error('Packaged build identity mismatch')
  }
  const archive = regularFile(app, 'Contents/Resources/app.asar')
  // Avoid the library's path-keyed cache hiding a changed archive during a later check.
  asar.uncache(archive)
  const packageVersion = JSON.parse(asar.extractFile(archive, 'package.json').toString()).version
  if (packageVersion !== expected.version) throw new Error('ASAR package version differs from the reservation')
  const headerSha256 = createHash('sha256').update(asar.getRawHeader(archive).headerString).digest('hex')
  const integrity = info.ElectronAsarIntegrity
  if (!integrity || Object.keys(integrity).length !== 1 || integrity['Resources/app.asar']?.algorithm !== 'SHA256' ||
      integrity['Resources/app.asar']?.hash !== headerSha256) throw new Error('Bundle ASAR integrity does not match the actual application archive')
  return { schemaVersion: 1, fields, packageVersion, infoPlistSha256: sha256(infoPath), iconSha256: sha256(icon), asarHeaderSha256: headerSha256 }
}

module.exports = { assertBundleIdentity }
