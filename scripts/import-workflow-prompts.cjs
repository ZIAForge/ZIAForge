#!/usr/bin/env node
// Import a user's own local guide pack. No source documents are redistributed.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const mapping = {
  auto: ['templates', 'auto.md'], 'fix-bug': ['templates', 'fix-a-bug.md'],
  'spec-first': ['templates', 'spec-first.md'], 'requirements-first': ['templates', 'requirements-first.md'],
  'multi-model': ['templates', 'multi-model.md'],
  ...Object.fromEntries(['planner', 'codebase-explorer', 'plan-designer', 'plan-orchestrator', 'implementer', 'review-worker', 'review-orchestrator', 'fixer'].map(key => [key, ['installed-skills', `${key}.md`]])),
}
function importPack(source, destination) {
  if (!path.isAbsolute(source) || !path.isAbsolute(destination)) throw new Error('Use absolute source guide-directory and destination profile-file paths')
  const documents = {}
  for (const [key, segments] of Object.entries(mapping)) {
    const file = path.join(source, ...segments)
    const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    try {
      const stat = fs.fstatSync(descriptor)
      if (!stat.isFile() || stat.size > 100000) throw new Error(`Invalid guide file for ${key}`)
      const bytes = fs.readFileSync(descriptor), text = bytes.toString('utf8')
      if (!text.trim() || text.includes('\0') || !Buffer.from(text).equals(bytes)) throw new Error(`Invalid UTF-8 guide for ${key}`)
      documents[key] = text
    } finally { fs.closeSync(descriptor) }
  }
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(documents).sort(([a], [b]) => a.localeCompare(b))))
  if (Buffer.byteLength(canonical) > 512000) throw new Error('Guide pack exceeds 512 KB')
  const profile = { version: 1, sha256: crypto.createHash('sha256').update(canonical).digest('hex'), documents }
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  if (fs.existsSync(destination)) {
    const stat = fs.lstatSync(destination)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Destination must be a regular profile file')
    const previous = fs.readFileSync(destination)
    const backup = destination + '.backup-' + crypto.createHash('sha256').update(previous).digest('hex').slice(0, 16)
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, previous, { flag: 'wx', mode: 0o600 })
  }
  const temporary = destination + '.import-' + crypto.randomUUID()
  try {
    fs.writeFileSync(temporary, JSON.stringify(profile, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    fs.renameSync(temporary, destination)
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
  return { path: destination, sha256: profile.sha256, documents: Object.keys(documents).length }
}
if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/import-workflow-prompts.cjs /absolute/guides /absolute/userData/code-workflow-prompts.json')
    process.stdout.write(JSON.stringify(importPack(process.argv[2], process.argv[3])) + '\n')
  } catch (error) { process.stderr.write(String(error.message || error) + '\n'); process.exitCode = 1 }
}
module.exports = { importPack }
