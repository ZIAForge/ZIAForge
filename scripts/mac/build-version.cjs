const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function parseVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error(`Expected a stable numeric version: ${value}`)
  const parts = value.split('.').map(Number)
  if (parts.some(part => !Number.isSafeInteger(part))) throw new Error('Version component exceeds the safe integer limit')
  return parts
}
function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right)
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}
function incrementPatch(version) {
  const parts = parseVersion(version)
  if (parts[2] === Number.MAX_SAFE_INTEGER) throw new Error('Patch version exhausted')
  parts[2]++
  return parts.join('.')
}
function directory(filename, create = false) {
  if (create) fs.mkdirSync(filename, { recursive: true, mode: 0o700 })
  try {
    const stat = fs.lstatSync(filename)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Expected a real directory: ${filename}`)
    return true
  } catch (error) { if (error.code === 'ENOENT' && !create) return false; throw error }
}
function syncDirectory(filename) {
  const fd = fs.openSync(filename, 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
function writeExclusive(filename, value) {
  const fd = fs.openSync(filename, 'wx', 0o600)
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd) }
  finally { fs.closeSync(fd) }
  syncDirectory(path.dirname(filename))
}

// Reservation directory names are authoritative, including a crash between mkdir
// and writing JSON. Never recycle a failed, incomplete or manually interrupted run.
function nextVersion(base, minimum) {
  parseVersion(minimum)
  let next = minimum
  if (!directory(base)) return next
  const ledger = path.join(base, '.versions')
  const candidates = []
  if (directory(ledger)) {
    for (const entry of fs.readdirSync(ledger, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue
      parseVersion(entry.name)
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Invalid version reservation: ${entry.name}`)
      candidates.push(entry.name)
    }
  }
  // Retained artifacts predate the ledger or may have been restored from backup.
  for (const name of fs.readdirSync(base)) {
    const match = /^(\d+\.\d+\.\d+)(?:-|$)/.exec(name)
    if (match) candidates.push(match[1])
  }
  for (const version of candidates) if (compareVersions(version, next) >= 0) next = incrementPatch(version)
  return next
}

function reserveVersion(base, minimum, context = {}) {
  directory(base, true)
  const ledger = path.join(base, '.versions')
  directory(ledger, true)
  let version = nextVersion(base, minimum)
  while (true) {
    const location = path.join(ledger, version)
    try { fs.mkdirSync(location, { mode: 0o700 }) }
    catch (error) { if (error.code === 'EEXIST') { version = incrementPatch(version); continue } throw error }
    // Sync the allocation before doing anything that might fail. The number stays
    // consumed even when metadata/output creation, compilation or packaging fails.
    syncDirectory(ledger)
    const reservation = { schemaVersion: 1, version, reservationId: crypto.randomUUID(),
      createdAt: new Date().toISOString(), source: context.source, arch: context.arch,
      policy: 'Permanent reservation. Do not delete or reuse, including failed attempts.' }
    const filename = path.join(location, 'reservation.json')
    writeExclusive(filename, reservation)
    return { ...reservation, filename }
  }
}

// A public release is one permanent version reservation shared by its target
// builds. Retrying a target keeps this family but must use a new attempt identity.
// This is deliberately separate from the per-invocation development allocator.
function reserveReleaseVersion(base, version, context) {
  parseVersion(version)
  if (!context?.source?.commit || context.source.dirty !== false || !context.sourcePortableSha256 || !context.releaseId) throw new Error('A frozen source and release identity are required')
  directory(base, true)
  const ledger = path.join(base, '.versions')
  directory(ledger, true)
  if (nextVersion(base, version) !== version) throw new Error(`Release version ${version} is already reserved or older than the ledger; do not reuse it`)
  const location = path.join(ledger, version)
  fs.mkdirSync(location, { mode: 0o700 })
  syncDirectory(ledger)
  const reservation = { schemaVersion: 1, kind: 'stable-release-family', version,
    reservationId: crypto.randomUUID(), createdAt: new Date().toISOString(), ...context,
    policy: 'Permanent stable release family. Base record is immutable; unpublished candidate source revisions must be appended, never overwritten. Each revision binds all targets to one frozen source. Every build attempt has a new identity.' }
  const filename = path.join(location, 'reservation.json')
  writeExclusive(filename, reservation)
  return { ...reservation, filename }
}

// Hold this for the entire build: the compiler writes shared dist directories.
// A stale lock fails closed. An operator may remove only this lock after checking
// the recorded owner and its descendants; reservations must remain untouched.
function acquirePackagingLock(base) {
  directory(base, true)
  const lock = path.join(base, '.packaging-lock')
  try { fs.mkdirSync(lock, { mode: 0o700 }) }
  catch (error) { if (error.code === 'EEXIST') throw new Error(`Packaging is locked: ${lock}. Check owner.json; do not remove an active lock.`); throw error }
  const owner = { pid: process.pid, token: crypto.randomUUID(), createdAt: new Date().toISOString() }
  const ownerFile = path.join(lock, 'owner.json')
  writeExclusive(ownerFile, owner)
  let released = false
  return () => {
    if (released) return
    directory(lock)
    const current = JSON.parse(fs.readFileSync(ownerFile, 'utf8'))
    if (current.token !== owner.token) throw new Error('Packaging lock ownership changed; refusing to remove it')
    fs.unlinkSync(ownerFile); fs.rmdirSync(lock); syncDirectory(base)
    released = true
  }
}

module.exports = { parseVersion, compareVersions, nextVersion, reserveVersion, reserveReleaseVersion, acquirePackagingLock }
