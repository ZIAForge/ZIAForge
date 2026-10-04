// Archive only one clean committed tree, never the current workspace directory.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { snapshot } = require('./source-manifest.cjs')
const { sha256 } = require('../mac/package-utils.cjs')
function archiveSource(root, output) {
  const source = snapshot(root)
  fs.mkdirSync(output, { mode: 0o700 })
  const result = { status: 'running', commit: source.commit, sourcePortableSha256: source.digest, artifacts: [] }
  try {
    fs.writeFileSync(path.join(output, 'source-manifest.json'), JSON.stringify(source, null, 2) + '\n', { flag: 'wx' })
    for (const [format, extension] of [['tar.gz', 'tar.gz'], ['zip', 'zip']]) {
      const file = path.join(output, `ZIAForge-source-${source.commit.slice(0, 12)}.${extension}`)
      const command = ['archive', '--format=' + format, '--prefix=ZIAForge-source/', '--output=' + file, source.commit]
      const run = spawnSync('git', command, { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 })
      if (run.status !== 0) throw new Error(`Source archive failed: ${run.stderr || run.error?.message || run.status}`)
      result.artifacts.push({ file: path.basename(file), bytes: fs.statSync(file).size, sha256: sha256(file), command: ['git', ...command] })
    }
    // Export is selected by Git, not a recursive filesystem copy. Ignored local
    // files may exist here but cannot enter the archives; the extracted build
    // input is checked strictly by source-manifest.verify before compilation.
    if (snapshot(root).digest !== source.digest) throw new Error('Source changed during archive')
    result.status = 'passed'
    fs.writeFileSync(path.join(output, 'SHA256SUMS'), result.artifacts.map(item => `${item.sha256}  ${item.file}`).join('\n') + '\n', { flag: 'wx' })
  } catch (error) { result.status = 'failed'; result.error = error.stack }
  result.finishedAt = new Date().toISOString()
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' })
  return result
}
if (require.main === module) {
  const [output] = process.argv.slice(2)
  if (!output || output === '--help') {
    console.log('Usage: node scripts/platform/source.cjs NEW_OUTPUT_DIRECTORY\nCreates immutable source tar.gz, ZIP, exact-byte manifest and checksums from a clean committed tree. No release version is reserved and no dependencies or build are run.')
    process.exitCode = output ? 0 : 1
  } else {
    const result = archiveSource(path.resolve(__dirname, '../..'), path.resolve(output))
    console.log(JSON.stringify({ status: result.status, commit: result.commit, directory: path.resolve(output) }))
    process.exitCode = result.status === 'passed' ? 0 : 1
  }
}
module.exports = { archiveSource }
