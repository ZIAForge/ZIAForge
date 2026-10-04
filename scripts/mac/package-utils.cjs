const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function reserveOutput(base, label) {
  if (!/^[A-Za-z0-9._-]+$/.test(label)) throw new Error('Unsafe build label')
  fs.mkdirSync(base, { recursive: true })
  return fs.mkdtempSync(path.join(base, label + '-'))
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}
function bundleInventory(root) {
  const files = []
  function visit(relative) {
    const filename = path.join(root, relative)
    const stat = fs.lstatSync(filename)
    if (stat.isSymbolicLink()) files.push({ path: relative, type: 'symlink', target: fs.readlinkSync(filename) })
    else if (stat.isDirectory()) for (const child of fs.readdirSync(filename).sort()) visit(path.join(relative, child))
    else if (stat.isFile()) files.push({ path: relative, type: 'file', bytes: stat.size, mode: stat.mode & 0o777, sha256: sha256(filename) })
    else throw new Error(`Unsupported bundle entry: ${relative}`)
  }
  visit('')
  return { algorithm: 'sha256', digest: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),
    description: 'SHA256 of JSON file inventory including relative paths, modes, bytes and symlink targets.', files }
}
function assertSourceUnchanged(before, after) {
  if (!before.commit || !before.workingTreeSha256 || before.commit !== after.commit || before.workingTreeSha256 !== after.workingTreeSha256) {
    throw new Error('Source changed during packaging; this artifact is invalidated and must not be delivered.')
  }
}
module.exports = { reserveOutput, sha256, bundleInventory, assertSourceUnchanged }
