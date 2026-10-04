const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const sha = value => crypto.createHash('sha256').update(value).digest('hex')
function git(root, args) {
  const result = spawnSync('git', ['--no-optional-locks', ...args], { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`Cannot inspect source: git ${args[0]}`)
  return result.stdout
}
function snapshot(root) {
  if (git(root, ['status', '--porcelain=v1', '--untracked-files=all']).trim()) throw new Error('Commit the frozen source before exporting a platform manifest')
  const files = git(root, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean).map(entry => {
    const match = /^(100644|100755|120000) ([a-f0-9]+) 0\t([\s\S]+)$/.exec(entry)
    if (!match) throw new Error('Unsupported source index entry')
    const [, mode, object, name] = match
    const file = path.join(root, name)
    const contents = mode === '120000' ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file)
    // No CRLF/filter normalization is silently accepted in a portable build input.
    const blob = crypto.createHash('sha1').update(`blob ${contents.length}\0`).update(contents).digest('hex')
    if (blob !== object) throw new Error(`Working bytes differ from committed blob: ${name}; disable checkout line-ending conversion`)
    return { path: name, mode, sha256: sha(contents), bytes: contents.length }
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'))
  return { schemaVersion: 1, commit: git(root, ['rev-parse', 'HEAD']).trim(), tree: git(root, ['rev-parse', 'HEAD^{tree}']).trim(), files, digest: sha(JSON.stringify(files)), description: 'Committed Git paths/modes and exact bytes; portable across host filesystem modes.' }
}
function verify(root, manifest) {
  if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(manifest.commit) || !Array.isArray(manifest.files) || !manifest.files.length || sha(JSON.stringify(manifest.files)) !== manifest.digest) throw new Error('Invalid source manifest')
  const seen = new Set()
  for (const item of manifest.files) {
    if (typeof item.path !== 'string' || path.posix.isAbsolute(item.path) || item.path.includes('\\') || item.path.split('/').some(p => !p || p === '.' || p === '..') || seen.has(item.path) || !['100644', '100755', '120000'].includes(item.mode)) throw new Error('Unsafe or duplicate source path')
    seen.add(item.path)
    const file = path.join(root, item.path), stat = fs.lstatSync(file)
    if (item.mode === '120000' ? !stat.isSymbolicLink() : !stat.isFile() || stat.isSymbolicLink()) throw new Error(`Source type changed: ${item.path}`)
    const contents = item.mode === '120000' ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file)
    if (contents.length !== item.bytes || sha(contents) !== item.sha256) throw new Error(`Source bytes changed: ${item.path}`)
  }
  const generatedRoots = new Set(['.git', 'node_modules', 'dist', 'dist-electron', 'release', 'test-results', 'playwright-report', 'screenshots'])
  function checkExtra(relative = '') {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? relative + '/' + entry.name : entry.name
      if (!relative && generatedRoots.has(entry.name) && !seen.has(name)) continue
      if (entry.isDirectory()) checkExtra(name)
      else if (!seen.has(name) && !(entry.name === '.DS_Store' && entry.isFile())) throw new Error(`Unlisted source file: ${name}`)
    }
  }
  checkExtra()
  return { commit: manifest.commit, tree: manifest.tree, digest: manifest.digest, fileCount: manifest.files.length }
}
if (require.main === module) {
  if (process.argv.includes('--help')) console.log('Usage: node scripts/platform/source-manifest.cjs NEW_MANIFEST.json\nExport the clean committed source identity before copying sources to another platform; output must be outside tracked source.')
  else {
    const output = process.argv[2]
    if (!output) throw new Error('A new output manifest is required')
    const root = path.resolve(__dirname, '../..')
    fs.writeFileSync(output, JSON.stringify(snapshot(root), null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    console.log(path.resolve(output))
  }
}
module.exports = { snapshot, verify }
