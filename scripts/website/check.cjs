#!/usr/bin/env node
// Meaningful public-site consistency checks; no desktop inference, build or credentials.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '../..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const docsOnly = process.argv.includes('--docs-only')
if (process.argv.slice(2).some(arg => arg !== '--docs-only')) throw new Error('Usage: node scripts/website/check.cjs [--docs-only]')
const source = docsOnly ? {} : JSON.parse(read('website/content/en.json'))
const expectedLocales = [...read('src/languages.ts').matchAll(/"id":\s*"([^"]+)"/g)].map(match => match[1]).sort()
const sandbox = { window: {} }; if (!docsOnly) vm.runInNewContext(read('website/assets/locales.js'), sandbox, { timeout: 1000 })
const dictionaries = sandbox.window.ZIAFORGE_LOCALES
if (!docsOnly && (!dictionaries || Object.keys(dictionaries).sort().join('|') !== expectedLocales.join('|'))) throw new Error('Landing must cover exactly the configured 56 app languages')
const keys = Object.keys(source).sort()
for (const locale of docsOnly ? [] : expectedLocales) {
  const catalog = dictionaries[locale]
  if (!catalog || Object.keys(catalog).sort().join('|') !== keys.join('|')) throw new Error(`Incomplete/extra landing keys: ${locale}`)
  for (const key of keys) if (typeof catalog[key] !== 'string' || !catalog[key].trim()) throw new Error(`Empty localized string: ${locale}.${key}`)
  if (locale !== 'en' && keys.filter(key => catalog[key] !== source[key]).length < keys.length / 3) throw new Error(`Locale is mostly unlocalized: ${locale}`)
}
const index = docsOnly ? '' : read('website/index.html')
for (const match of index.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) if (!Object.hasOwn(source, match[1])) throw new Error(`Unknown HTML locale key: ${match[1]}`)
const generatedHtml = [...(docsOnly ? [] : ['website/index.html']), 'website/guide.html', ...fs.readdirSync(path.join(root, 'website/guides')).filter(file => file.endsWith('.html')).map(file => `website/guides/${file}`)]
let links = 0
for (const file of generatedHtml) {
  const html = read(file)
  for (const match of html.matchAll(/(?:href|src|poster)="([^"<>]+)"/g)) {
    const href = match[1].replaceAll('&amp;', '&')
    if (/^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(href)) { if (/^javascript:/i.test(href)) throw new Error(`Unsafe link in ${file}`); continue }
    const [pathname, fragment] = href.split('#')
    const clean = decodeURIComponent(pathname.split('?')[0])
    const target = clean ? path.resolve(root, path.dirname(file), clean) : path.join(root, file)
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) throw new Error(`Broken local resource: ${file} -> ${href}`)
    if (fragment && path.extname(target) === '.html') {
      const ids = [...fs.readFileSync(target, 'utf8').matchAll(/\bid="([^"]+)"/g)].map(item => item[1])
      if (!ids.includes(decodeURIComponent(fragment))) throw new Error(`Broken anchor: ${file} -> ${href}`)
    }
    links++
  }
}
const films = ['forge-overview', 'code-workflow', 'work-workflow']
for (const film of docsOnly ? [] : films) {
  const video = path.join(root, `website/assets/videos/${film}.mp4`)
  if (!fs.existsSync(video) || fs.statSync(video).size < 100000) throw new Error(`Missing actual video: ${film}`)
  if (fs.statSync(video).size > 100000000) throw new Error(`Video exceeds GitHub file limit: ${film}`)
  for (const locale of expectedLocales) {
    const filename = `website/assets/videos/captions/${film}.${locale}.vtt`
    if (!fs.existsSync(path.join(root, filename))) throw new Error(`Missing caption: ${film}.${locale}`)
    const captions = read(filename)
    if (!captions.startsWith('WEBVTT') || !captions.includes('-->')) throw new Error(`Invalid caption: ${film}.${locale}`)
  }
}
const hash = crypto.createHash('sha256').update(read('docs/help/en.json')).digest('hex')
if (docsOnly) process.stdout.write(`Documentation website check passed: ${generatedHtml.length} generated guides and ${links} local references. Canonical help SHA-256 ${hash}.\n`)
else process.stdout.write(`Website check passed: ${expectedLocales.length} complete landing languages, ${keys.length} keys each, ${generatedHtml.length - 1} generated guides, ${links} local references, ${films.length} actual films and ${films.length * expectedLocales.length} subtitle tracks. Canonical help SHA-256 ${hash}.\n`)
