#!/usr/bin/env node
// One English source; generated manuals are checked byte-for-byte before shipping.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '../..')
const checking = process.argv.includes('--check')
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/help/generate.cjs [--check]')
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const sourceBytes = fs.readFileSync(path.join(root, 'docs/help/en.json'))
const sourceSha256 = crypto.createHash('sha256').update(sourceBytes).digest('hex')
const source = JSON.parse(sourceBytes)
const registry = read('docs/help/locales.json')
const own = (value, key) => Object.hasOwn(value, key)
const text = (value, context) => {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`Invalid help text: ${context}`)
}
function validateGuide(guide, locale, expected) {
  if (guide?.schemaVersion !== 1 || guide.locale !== locale || !Array.isArray(guide.sections) || !guide.sections.length) throw new Error(`Invalid help guide: ${locale}`)
  for (const key of ['title', 'description', 'sourcePolicy']) text(guide[key], `${locale}.${key}`)
  const ids = new Set()
  for (const section of guide.sections) {
    if (!/^[a-z][a-z0-9-]*$/.test(section.id) || ids.has(section.id)) throw new Error(`Invalid/duplicate help section: ${locale}.${section.id}`)
    ids.add(section.id)
    text(section.title, `${locale}.${section.id}.title`)
    for (const key of ['paragraphs', 'steps']) {
      if (key === 'steps' && section.steps === undefined) continue
      if (!Array.isArray(section[key]) || !section[key].length) throw new Error(`Missing help ${key}: ${locale}.${section.id}`)
      section[key].forEach((item, index) => text(item, `${locale}.${section.id}.${key}.${index}`))
    }
    if (section.note !== undefined) text(section.note, `${locale}.${section.id}.note`)
    if (!Array.isArray(section.links)) throw new Error(`Missing contract links: ${locale}.${section.id}`)
    for (const link of section.links) {
      text(link.label, `${locale}.${section.id}.link`)
      if (typeof link.path !== 'string' || !/^[a-zA-Z0-9_./-]+\.(md|ts|tsx|cjs)$/.test(link.path) || link.path.startsWith('/') || link.path.split('/').includes('..')) throw new Error(`Unsafe help link: ${locale}.${section.id}`)
      const target = path.join(root, link.path)
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`Broken help contract link: ${link.path}`)
    }
  }
  if (expected) {
    if (guide.sections.map(item => item.id).join('|') !== expected.sections.map(item => item.id).join('|')) throw new Error(`Help translation section order/IDs differ: ${locale}`)
    guide.sections.forEach((section, index) => {
      const original = expected.sections[index]
      for (const key of ['paragraphs', 'steps']) if ((section[key]?.length ?? 0) !== (original[key]?.length ?? 0)) throw new Error(`Help translation ${key} count differs: ${locale}.${section.id}`)
      if (!!section.note !== !!original.note || section.links.map(item => item.path).join('|') !== original.links.map(item => item.path).join('|')) throw new Error(`Help translation contracts differ: ${locale}.${section.id}`)
    })
  }
}
validateGuide(source, 'en')
if (registry.schemaVersion !== 1 || registry.sourceLocale !== 'en' || registry.fallbackLocale !== 'en' || !registry.locales || typeof registry.locales !== 'object') throw new Error('Invalid help locale registry')
const uiLocales = fs.readdirSync(path.join(root, 'src/locales')).filter(file => file.endsWith('.json')).map(file => file.slice(0, -5)).sort()
const servedGuides = new Map([['en', source]])
if (Object.keys(registry.locales).sort().join('|') !== uiLocales.join('|')) throw new Error('Help registry must cover every configured interface locale, without invented locales')
for (const locale of uiLocales) {
  const entry = registry.locales[locale]
  if (!entry || !['source', 'not-translated', 'draft', 'machine-translated', 'reviewed'].includes(entry.status)) throw new Error(`Invalid help status: ${locale}`)
  if (locale === 'en') {
    if (entry.status !== 'source' || entry.contentFile !== 'en.json') throw new Error('English must remain the canonical source')
  } else if (entry.status === 'not-translated') {
    if (entry.contentFile !== null || entry.reviewedSourceSha256 !== null || entry.reviewer !== null) throw new Error(`Untranslated help must not claim content or review: ${locale}`)
  } else {
    if (entry.contentFile !== `translations/${locale}.json`) throw new Error(`Help translation path must match its locale: ${locale}`)
    const translation = read(`docs/help/${entry.contentFile}`)
    validateGuide(translation, locale, source)
    if (entry.status === 'reviewed') {
      if (entry.reviewedSourceSha256 !== sourceSha256) throw new Error(`Help translation needs review for changed English source: ${locale}`)
      text(entry.reviewer, `${locale}.reviewer`)
      servedGuides.set(locale, translation)
    } else if (entry.status === 'machine-translated') {
      if (entry.translatedSourceSha256 !== sourceSha256) throw new Error(`Help translation needs refresh for changed English source: ${locale}`)
      if (entry.reviewedSourceSha256 !== null || entry.reviewer !== null) throw new Error(`Machine translation must not claim human review: ${locale}`)
      text(entry.translationMethod, `${locale}.translationMethod`)
      servedGuides.set(locale, translation)
    }
  }
}
for (const file of fs.readdirSync(path.join(root, 'docs/help/translations'))) {
  if (!file.endsWith('.json')) continue
  const locale = file.slice(0, -5)
  if (!own(registry.locales, locale) || registry.locales[locale].contentFile !== `translations/${file}`) throw new Error(`Unregistered help translation: ${file}`)
}
const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
const outputs = new Map()
const banner = `Generated from docs/help/en.json; source SHA-256 ${sourceSha256}. Do not edit this output.\nRun node scripts/help/generate.cjs after changing the canonical help.`
const rtlLocales = new Set(['ar', 'fa', 'pnb', 'ps', 'sd', 'ur'])
const uiCatalogs = new Map(uiLocales.map(locale => [locale, read(`src/locales/${locale}.json`)]))
const label = (locale, key, fallback) => uiCatalogs.get(locale)?.[key] || fallback
const htmlPath = locale => locale === 'en' ? 'website/guide.html' : `website/guides/${locale}.html`
const markdownPath = locale => locale === 'en' ? 'docs/USER_GUIDE.md' : `docs/help/manuals/${locale}.md`
const relative = (from, target) => path.posix.relative(path.posix.dirname(from), target)
const languageRegistry = path.join(root, 'src/languages.ts')
const nativeNames = new Map(fs.existsSync(languageRegistry) ? [...fs.readFileSync(languageRegistry, 'utf8').matchAll(/"id":\s*"([^"]+)"\s*,\s*"name":\s*"([^"]+)"/g)].map(match => [match[1], match[2]]) : [])
const nativeName = locale => { if (nativeNames.has(locale)) return nativeNames.get(locale); try { return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) || locale } catch { return locale } }
for (const locale of uiLocales) {
  const guide = servedGuides.get(locale) || source
  const language = guide.locale
  const machine = registry.locales[locale].status === 'machine-translated'
  const fallback = locale !== language
  const disclosure = machine ? label(locale, 'help.machineTranslationNotice', 'Machine-translated help. English is canonical; native-language human review is not claimed.') : fallback ? label(locale, 'help.fallbackNotice', 'This help language is unavailable. Showing the English reference.') : ''
  const mdFile = markdownPath(locale), htmlFile = htmlPath(locale)
  const related = label(language, 'help.contractsLabel', 'Related instructions')
  const toc = label(language, 'help.sectionsLabel', 'Guide sections')
  let markdown = `<!-- ${banner}\nRequested locale: ${locale}; served locale: ${language}; status: ${registry.locales[locale].status}. -->\n# ${guide.title}\n\n${guide.description}\n\n${guide.sourcePolicy}\n\n${disclosure ? `> ${disclosure}\n\n` : ''}## ${toc}\n\n`
  markdown += guide.sections.map(section => `- [${section.title}](#${section.id})`).join('\n') + '\n\n'
  for (const section of guide.sections) {
    markdown += `<a id="${section.id}"></a>\n\n## ${section.title}\n\n${section.paragraphs.join('\n\n')}\n\n`
    if (section.steps) markdown += section.steps.map((step, index) => `${index + 1}. ${step}`).join('\n') + '\n\n'
    if (section.note) markdown += `> ${section.note}\n\n`
    if (section.links.length) markdown += `${related}: ${section.links.map(link => `[${link.label}](${relative(mdFile, link.path)})`).join(' · ')}.\n\n`
  }
  outputs.set(mdFile, markdown.trimEnd() + '\n')
  const htmlSection = section => `<section id="${section.id}"><h2>${escapeHtml(section.title)}</h2>${section.paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}${section.steps ? `<ol>${section.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : ''}${section.note ? `<aside>${escapeHtml(section.note)}</aside>` : ''}<p class="guide-contracts">${escapeHtml(related)}: ${section.links.map(link => `<a href="${relative(htmlFile, link.path)}">${escapeHtml(link.label)}</a>`).join(' · ')}.</p></section>`
  const languageOptions = [...servedGuides.keys()].sort((a, b) => nativeName(a).localeCompare(nativeName(b))).map(other => `<option value="${relative(htmlFile, htmlPath(other))}" lang="${other}" dir="${rtlLocales.has(other) ? 'rtl' : 'ltr'}"${other === language ? ' selected' : ''}>${escapeHtml(nativeName(other))}</option>`).join('')
  const languageLinks = [...servedGuides.keys()].sort().map(other => `<a href="${relative(htmlFile, htmlPath(other))}" hreflang="${other}" lang="${other}" dir="${rtlLocales.has(other) ? 'rtl' : 'ltr'}">${escapeHtml(nativeName(other))}</a>`).join(' · ')
  const searchLabel = label(language, 'search', 'Search')
  const languageLabel = label(language, 'interface_language', 'Interface language')
  const guideLabel = label(language, 'ui.userGuide', 'User guide')
  outputs.set(htmlFile, `<!doctype html>\n<!-- ${banner} -->\n<html lang="${language}" dir="${rtlLocales.has(language) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="description" content="${escapeHtml(guide.description)}"><title>${escapeHtml(guide.title)} — ZIAForge</title><link rel="icon" href="${relative(htmlFile, 'website/assets/brand-logo.jpg')}"><link rel="stylesheet" href="${relative(htmlFile, 'website/assets/site.css')}"><script src="${relative(htmlFile, 'website/assets/guide.js')}" defer></script></head><body class="guide-page"><a class="skip" href="#guide">${escapeHtml(toc)}</a><header class="site-header"><a class="brand" href="${relative(htmlFile, 'website/index.html')}"><img src="${relative(htmlFile, 'website/assets/brand-logo.jpg')}" alt="" width="32" height="32"><span>ZIAForge<span class="brand-studio">STUDIO</span></span></a><a class="guide-header-link" href="#guide">${escapeHtml(guideLabel)} ↗</a><select class="guide-language-select" aria-label="${escapeHtml(languageLabel)}">${languageOptions}</select><noscript><details><summary>${escapeHtml(nativeName(language))}</summary>${languageLinks}</details></noscript></header><div class="guide-progress" aria-hidden="true"></div><main class="guide-layout"><aside class="guide-sidebar"><p class="guide-sidebar-heading">${escapeHtml(toc)}</p><label class="guide-search-wrap"><input class="guide-search" type="search" aria-label="${escapeHtml(searchLabel)}" placeholder="${escapeHtml(searchLabel)}" autocomplete="off"></label><nav aria-label="${escapeHtml(toc)}">${guide.sections.map(section => `<a href="#${section.id}">${escapeHtml(section.title)}</a>`).join('')}</nav><p class="guide-empty" hidden>${escapeHtml(toc)}: 0</p></aside><article id="guide"><p class="eyebrow">ZIAFORGE / 1.0.2</p><h1>${escapeHtml(guide.title)}</h1><p class="intro">${escapeHtml(guide.description)}</p><p>${escapeHtml(guide.sourcePolicy)}</p>${disclosure ? `<aside lang="${locale}" dir="${rtlLocales.has(locale) ? 'rtl' : 'ltr'}">${escapeHtml(disclosure)}</aside>` : ''}<div class="guide-meta"><a href="${relative(htmlFile, mdFile)}">Markdown (${language}) ↗</a><a href="${relative(htmlFile, 'docs/HELP_MAINTENANCE.md')}">HELP_MAINTENANCE.md ↗</a></div>${guide.sections.map(htmlSection).join('\n')}</article></main><footer><span class="guide-motto" dir="ltr">FORGE. DON’T VIBE.</span> · <a href="${relative(htmlFile, 'docs/help/en.json')}" dir="ltr">docs/help/en.json</a></footer></body></html>\n`)

}
outputs.set('src/components/helpSource.generated.ts', `// ${banner.replaceAll('\n', '\n// ')}\nexport const helpSourceSha256 = '${sourceSha256}'\n`)
let localesMarkdown = `<!-- ${banner} -->\n# Help translation coverage\n\nInterface translations and help translations have separate provenance. All ${uiLocales.length} configured interface locales have a help entry. Machine-translated bodies are served only for the current English source hash and carry an explicit notice; they are not human-reviewed translations. Missing/draft bodies display the English reference.\n\n| Locale | Help status | Served guide | Offline manual |\n| --- | --- | --- | --- |\n`
localesMarkdown += uiLocales.map(locale => `| ${locale} | ${registry.locales[locale].status} | ${servedGuides.has(locale) ? locale : 'English'} | [${locale}](${relative('docs/help/LOCALES.md', markdownPath(locale))}) |`).join('\n') + '\n\nSee [maintenance instructions](../HELP_MAINTENANCE.md) before claiming a translation is reviewed.\n'
outputs.set('docs/help/LOCALES.md', localesMarkdown)
let stale = false
for (const [file, content] of outputs) {
  const target = path.join(root, file)
  if (checking) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) { console.error(`Stale help output: ${file}`); stale = true }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
}
if (stale) process.exitCode = 1
else console.log(`${checking ? 'Help consistency verified' : 'Help generated'}: ${source.sections.length} sections, ${uiLocales.length} locale entries, English SHA-256 ${sourceSha256}`)
