#!/usr/bin/env node
/* Offline catalog and source checks. These do not certify native-language quality. */
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const audit = process.argv.includes('--audit')
const catalogDirectory = path.join(root, 'src/locales')
const locales = fs.readdirSync(catalogDirectory).filter(name => name.endsWith('.json')).sort()
const catalogs = Object.fromEntries(locales.map(name => [name.slice(0, -5), JSON.parse(fs.readFileSync(path.join(catalogDirectory, name), 'utf8'))]))
const canonical = catalogs.en
const keys = Object.keys(canonical)
const placeholders = value => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort().join(',')
const failures = []
const coverage = []
const candidates = []
const invariantText = /^(?:ZIAForge|FORGE\. DON'T VIBE\.|Code|Work|Codex|Claude Code|Google Antigravity|Antigravity|Git|GitHub|CLI|API|MCP|JSON|HTTP|HTTPS|OpenAI-compatible API|Auto|BETA|SHA-?256|UTF-?\d+|KiB|MiB|B|xterm\.js|stdout|stderr|diff|Visual Studio Code|PhpStorm|Cursor|Sublime Text|Apache-2\.0|Telegram)$/
for (const [locale, catalog] of Object.entries(catalogs)) {
  const missing = keys.filter(key => !(key in catalog))
  const extra = Object.keys(catalog).filter(key => !(key in canonical))
  const empty = Object.keys(catalog).filter(key => typeof catalog[key] !== 'string' || !catalog[key].trim())
  const protocolTokens = ['telegram.helpBody', 'telegram.invalidJson'].flatMap(key => {
    if (!catalog[key]) return []
    const tokens = key === 'telegram.helpBody' ? ['/status', '/projects', '/tasks', '/task', '/run', '/pause', '/screenshot', '/ask', '/new', '/command', 'CreateTaskConfig', '{"method":"...","args":[...]}'] : ['/new', '/command', 'CreateTaskConfig', '{"method":"...","args":[...]}']
    return tokens.filter(token => canonical[key].includes(token) && !catalog[key].includes(token)).map(token => ({ key, token }))
  })
  if (protocolTokens.length) failures.push({ locale, protocolTokens })
  const mismatched = keys.filter(key => typeof catalog[key] === 'string' && placeholders(catalog[key]) !== placeholders(canonical[key]))
  if (missing.length || extra.length || empty.length || mismatched.length) failures.push({ locale, missing, extra, empty, mismatched })
  coverage.push({ locale, translatedKeys: keys.length - missing.length, canonicalKeys: keys.length })
  if (audit && locale !== 'en') for (const key of keys) if (catalog[key] === canonical[key] && !invariantText.test(canonical[key])) candidates.push({ locale, key, reason: canonical[key].length > 35 ? 'English sentence copied verbatim' : 'Same text: review loanword or context', text: canonical[key] })
}
const registrySource = fs.readFileSync(path.join(root, 'src/languages.ts'), 'utf8')
const registry = [...registrySource.matchAll(/"id":\s*"([^"]+)"/g)].map(match => match[1])
if (registry.length !== 56 || new Set(registry).size !== registry.length || registry.some(id => !catalogs[id]) || Object.keys(catalogs).some(id => !registry.includes(id))) failures.push({ registry: 'The 56 registered languages must match the catalogs exactly.' })
const sources = new Set(Object.values(canonical))
const sourceFailures = []
const literals = []
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory() && !['__tests__', 'locales'].includes(entry.name)) walk(filename)
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !['i18n-core.ts', 'i18n.ts', 'uiText.ts', 'languages.ts', 'helpContent.ts'].includes(entry.name)) inspect(filename)
  }
}
function inspect(filename) {
  const text = fs.readFileSync(filename, 'utf8')
  const sf = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const relative = path.relative(root, filename)
  for (const diagnostic of sf.parseDiagnostics) sourceFailures.push({ file: relative, error: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') })
  const location = node => ({ file: relative, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 })
  function literal(node) { return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf)
      const source = literal(node.arguments[callee === 'translateText' ? 1 : 0])
      if (['uiText', 'translateText'].includes(callee) && source && !sources.has(source)) sourceFailures.push({ ...location(node), error: 'English UI source missing from canonical catalog', source })
      if (callee === 'uiKey' && source && !canonical[source]) sourceFailures.push({ ...location(node), error: 'Explicit UI key missing from canonical catalog', key: source })
      // These helpers are display wrappers; their Russian argument is retained only as source context.
      if (callee === 'label' && node.arguments.length === 2 && source && literal(node.arguments[1]) && !sources.has(source)) sourceFailures.push({ ...location(node), error: 'Bilingual UI source missing from canonical catalog', source })
    }
    if (audit && ts.isJsxText(node)) {
      const value = node.text.replace(/\s+/g, ' ').trim()
      if (value && /[\p{L}]/u.test(value) && !invariantText.test(value)) literals.push({ ...location(node), text: value, category: 'Visible literal: verify identifier, product name, fixture content, or localization need' })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}
walk(path.join(root, 'src'))
const result = {
  status: failures.length || sourceFailures.length ? 'failed' : 'passed',
  kind: audit ? 'structural checks and heuristic audit' : 'structural checks',
  languages: locales.length, canonicalKeys: keys.length, coverage, failures, sourceFailures,
  ...(audit ? { candidates, visibleLiterals: literals, note: 'Loanwords, invariant protocol/model identifiers, user content, raw provider diagnostics and explicit mock examples require contextual classification. These heuristics are not human-native language review.' } : {}),
  nativeHumanReview: false,
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
process.exitCode = result.status === 'passed' ? 0 : 1
