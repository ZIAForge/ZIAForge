const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

test('one help source detects drift, escaping and stale translation approval', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaforge-help-generation-'))
  const write = (file, value) => {
    const target = path.join(project, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
  }
  const invoke = (...args) => spawnSync(process.execPath, [path.join(project, 'scripts/help/generate.cjs'), ...args], { cwd: project, encoding: 'utf8', timeout: 10000 })
  try {
    write('scripts/help/generate.cjs', fs.readFileSync(path.join(__dirname, '../help/generate.cjs'), 'utf8'))
    write('docs/help/translations/README.md', 'Translations are reviewed separately.\n')
    write('src/locales/en.json', { save: 'Save' })
    write('src/locales/ar.json', { save: 'حفظ', 'help.machineTranslationNotice': 'ترجمة آلية؛ لم يراجعها مترجم بشري.', 'help.sectionsLabel': 'أقسام الدليل' })
    write('src/languages.ts', 'export const UI_LANGUAGES = [{"id":"en","name":"English"},{"id":"ar","name":"العربية المسجلة"}] as const\n')
    write('AGENTS.md', 'Fixture contract.\n')
    const source = { schemaVersion: 1, locale: 'en', title: 'Fixture help', description: 'Verify the documented flow.', sourcePolicy: 'English is canonical.', sections: [{ id: 'start', title: 'Start', paragraphs: ['Treat <script>alert("fixture")</script> as plain text.'], links: [{ label: 'Agent contract', path: 'AGENTS.md' }] }] }
    write('docs/help/en.json', source)
    const registry = { schemaVersion: 1, sourceLocale: 'en', fallbackLocale: 'en', locales: { en: { status: 'source', contentFile: 'en.json', reviewedSourceSha256: null, reviewer: null }, ar: { status: 'not-translated', contentFile: null, reviewedSourceSha256: null, reviewer: null } } }
    write('docs/help/locales.json', registry)
    assert.equal(invoke().status, 0)
    assert.equal(invoke('--check').status, 0)
    const html = fs.readFileSync(path.join(project, 'website/guide.html'), 'utf8')
    assert.ok(html.includes('&lt;script&gt;'))
    assert.ok(!html.includes('<script>'))
    fs.appendFileSync(path.join(project, 'docs/USER_GUIDE.md'), 'An independent edit must not be silently accepted.\n')
    const drift = invoke('--check')
    assert.notEqual(drift.status, 0)
    assert.match(drift.stderr, /Stale help output: docs\/USER_GUIDE.md/)
    assert.equal(invoke().status, 0)

    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(project, 'docs/help/en.json'))).digest('hex')
    write('docs/help/translations/ar.json', { ...source, locale: 'ar', title: 'مساعدة', description: 'وصف', sourcePolicy: 'الإنجليزية هي المرجع.', sections: [{ ...source.sections[0], title: 'البداية', paragraphs: ['إرشادات تجريبية.'] }] })
    registry.locales.ar = { status: 'machine-translated', contentFile: 'translations/ar.json', translatedSourceSha256: sourceHash, translationMethod: 'Fixture translator; no human review', reviewedSourceSha256: null, reviewer: null }
    write('docs/help/locales.json', registry)
    assert.equal(invoke().status, 0)
    const localized = fs.readFileSync(path.join(project, 'website/guides/ar.html'), 'utf8')
    assert.match(localized, /<html lang="ar" dir="rtl">/)
    assert.ok(localized.includes('أقسام الدليل'))
    assert.ok(localized.includes('العربية المسجلة'))
    assert.ok(localized.includes('ترجمة آلية؛ لم يراجعها مترجم بشري.'))
    assert.ok(localized.includes('href="../../AGENTS.md"'))
    assert.ok(localized.includes('href="../../docs/help/manuals/ar.md"'))
    assert.ok(localized.includes('إرشادات تجريبية.'))
    assert.ok(!localized.includes('Treat &lt;script&gt;'))
    const localizedManual = fs.readFileSync(path.join(project, 'docs/help/manuals/ar.md'), 'utf8')
    assert.ok(localizedManual.includes('[البداية](#start)'))
    assert.ok(localizedManual.includes('](../../../AGENTS.md)'))
    registry.locales.ar.reviewer = 'Must not claim human review'
    write('docs/help/locales.json', registry)
    assert.match(invoke('--check').stderr, /Machine translation must not claim human review/)
    registry.locales.ar.reviewer = null
    registry.locales.ar.translatedSourceSha256 = '0'.repeat(64)
    write('docs/help/locales.json', registry)
    assert.match(invoke('--check').stderr, /translation needs refresh for changed English source: ar/)
    registry.locales.ar = { status: 'reviewed', contentFile: 'translations/ar.json', reviewedSourceSha256: sourceHash, reviewer: 'Fixture reviewer; not a real language certification' }
    write('docs/help/locales.json', registry)
    assert.equal(invoke().status, 0)
    source.sections[0].paragraphs[0] = 'Changed approval requirements need fresh translation review.'
    write('docs/help/en.json', source)
    const staleReview = invoke('--check')
    assert.notEqual(staleReview.status, 0)
    assert.match(staleReview.stderr, /translation needs review for changed English source: ar/)

    registry.locales.ar.status = 'draft'
    registry.locales.ar.reviewedSourceSha256 = null
    registry.locales.ar.reviewer = null
    write('docs/help/locales.json', registry)
    assert.equal(invoke().status, 0)
    fs.unlinkSync(path.join(project, 'AGENTS.md'))
    assert.match(invoke('--check').stderr, /Broken help contract link: AGENTS.md/)
  } finally { fs.rmSync(project, { recursive: true, force: true }) }
})
