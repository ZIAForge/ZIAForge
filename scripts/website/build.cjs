#!/usr/bin/env node
// Stage only public tracked source and explicitly owned website files. No app build/release allocation.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '../..')
const args = process.argv.slice(2)
const docsOnly = args.includes('--docs-only')
const rest = args.filter(arg => arg !== '--docs-only')
if (rest.length && (rest.length !== 2 || rest[0] !== '--output')) throw new Error('Usage: node scripts/website/build.cjs [--docs-only] [--output /absolute/empty/directory]')
const output = path.resolve(root, rest[1] || (docsOnly ? 'out/documentation' : 'out/website'))
if (output === root || root.startsWith(output + path.sep) || (output.startsWith(root + path.sep) && output !== path.join(root, '.pages') && !output.startsWith(path.join(root, 'out') + path.sep))) throw new Error('Output must be outside source or under ignored out/')
if (fs.existsSync(output) && fs.readdirSync(output).length) throw new Error(`Output is not empty: ${output}`)
fs.mkdirSync(output, { recursive: true })
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const files = new Set(tracked.filter(file => !file.startsWith('.github/') && file !== '.gitignore' && file !== '.eslintrc.cjs' && file !== 'index.html' && (!docsOnly || !file.startsWith('website/'))))
function collect(directory) {
  for (const item of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    if (item.name.startsWith('.') || ['node_modules', '__pycache__', 'frames', 'renders'].includes(item.name)) continue
    const relative = `${directory}/${item.name}`
    if (item.isDirectory()) collect(relative)
    else if (item.isFile()) files.add(relative)
    else throw new Error(`Unexpected nonregular website asset: ${relative}`)
  }
}
if (docsOnly) {
  collect('website/guides')
  collect('website/assets/fonts')
  for (const file of ['website/README.md', 'website/guide.html', 'website/assets/site.css', 'website/assets/guide.js', 'website/assets/brand-logo.jpg', 'website/assets/app-logo.jpeg']) if (fs.existsSync(path.join(root, file))) files.add(file)
} else collect('website')
collect('scripts/website')
for (const file of ['docs/WEBSITE.md']) if (fs.existsSync(path.join(root, file))) files.add(file)
const manifest = { schemaVersion: 1, purpose: docsOnly ? 'Public documentation only; new landing and films remain local' : 'Static ZIAForge website; custom domain deployment is separate', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), files: [] }
for (const relative of [...files].sort()) {
  if (/\.(?:pem|key|p12|pfx|har|log)$/i.test(relative) || relative.split('/').some(item => item === '.env' || item.startsWith('.env.'))) throw new Error(`Private file cannot be staged: ${relative}`)
  const source = path.join(root, relative)
  if (!fs.existsSync(source)) continue
  const stat = fs.lstatSync(source)
  if (!stat.isFile() || fs.realpathSync(source) !== source) throw new Error(`Public build refuses symlinks: ${relative}`)
  const target = path.join(output, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target)
  manifest.files.push({ path: relative, bytes: stat.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex') })
}
// Serve the full landing at the domain root; base keeps guide/source-relative links intact.
const html = fs.readFileSync(path.join(output, docsOnly ? 'website/guide.html' : 'website/index.html'), 'utf8')
if (docsOnly) fs.writeFileSync(path.join(output, 'website/index.html'), html)
fs.writeFileSync(path.join(output, 'index.html'), html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n<base href="./website/">`))
fs.writeFileSync(path.join(output, '.nojekyll'), '')
for (const relative of [...(docsOnly ? ['website/index.html'] : []), 'index.html', '.nojekyll']) {
  const bytes = fs.readFileSync(path.join(output, relative))
  manifest.files.push({ path: relative, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), generated: true })
}
manifest.files.sort((a, b) => a.path.localeCompare(b.path))
fs.writeFileSync(path.join(output, 'site-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
process.stdout.write(`Staged ${manifest.files.length} public files in ${output}\n`)
