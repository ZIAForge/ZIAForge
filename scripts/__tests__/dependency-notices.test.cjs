const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { collectNotices } = require('../mac/dependency-notices.cjs')

test('notices preserve the actual copyright text, identify the lock and exclude dev-only license bodies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-notices-'))
  try {
    const packagePath = path.join(root, 'node_modules/example'); fs.mkdirSync(packagePath, { recursive: true })
    fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages: {
      '': { version: '0.0.4' }, 'node_modules/example': { version: '1.0.0', license: 'MIT', integrity: 'sha512-example' },
      'node_modules/tool': { version: '2.0.0', license: 'ISC', dev: true },
    } }))
    fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ name: 'example', version: '1.0.0' }))
    fs.writeFileSync(path.join(packagePath, 'LICENSE'), 'Copyright original contributor\nExact license text\n')
    const result = collectNotices(root)
    assert.match(result.text, /Copyright original contributor\nExact license text/)
    assert.match(result.inventory.lockSha256, /^[a-f0-9]{64}$/)
    assert.equal(result.inventory.dependencies.find(item => item.name === 'tool').runtime, false)
    fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ name: 'example', version: '9.0.0' }))
    assert.throws(() => collectNotices(root), /differs from lockfile/)
    fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ name: 'example', version: '1.0.0' }))
    fs.unlinkSync(path.join(packagePath, 'LICENSE'))
    assert.throws(() => collectNotices(root), /needs license review/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('pinned supplemental notice requires the reviewed package metadata and integrity, and never masks unknown missing licenses', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-supplemental-notice-'))
  try {
    const project = path.resolve(__dirname, '../..')
    const manifest = JSON.parse(fs.readFileSync(path.join(project, 'docs/licenses/supplemental-notices.json'), 'utf8'))
    const pinned = manifest.notices[0]
    const directory = path.join(root, pinned.packagePath)
    fs.mkdirSync(directory, { recursive: true })
    fs.mkdirSync(path.join(root, 'docs/licenses'), { recursive: true })
    fs.copyFileSync(path.join(project, 'docs/licenses/supplemental-notices.json'), path.join(root, 'docs/licenses/supplemental-notices.json'))
    const originalNotice = fs.readFileSync(path.join(project, pinned.file))
    fs.writeFileSync(path.join(root, pinned.file), originalNotice)
    const originalPackage = fs.readFileSync(path.join(project, pinned.packagePath, 'package.json'))
    const writePackage = bytes => fs.writeFileSync(path.join(directory, 'package.json'), bytes)
    const entry = { version: pinned.version, license: pinned.license, integrity: pinned.integrity, resolved: pinned.resolved }
    const writeLock = (value = entry, packagePath = pinned.packagePath) => fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages: { [packagePath]: value } }))
    writePackage(originalPackage); writeLock()
    const result = collectNotices(root)
    assert.match(result.text, /SUPPLEMENTAL NOTICE \(not an upstream license file\)/)
    assert.match(result.text, /Vladimir Krivosheev/)
    assert.match(result.text, /Permission is hereby granted/)
    assert.match(result.text, /not complete legal clearance/)
    assert.doesNotMatch(result.text, /Copyright \(c\) (?:\d|Vladimir)/)
    assert.deepEqual(result.inventory.dependencies[0].supplementalNotice, { path: pinned.file, sha256: pinned.sha256, kind: 'reviewed-declaration-based-supplement' })
    for (const field of ['integrity', 'resolved', 'license']) {
      writeLock({ ...entry, [field]: 'changed' })
      assert.throws(() => collectNotices(root), /binding changed; needs license review/)
    }
    writeLock()
    for (const field of ['name', 'version', 'author', 'license']) {
      writePackage(JSON.stringify({ ...JSON.parse(originalPackage), [field]: 'changed' }))
      assert.throws(() => collectNotices(root), /differs from lockfile|binding changed; needs license review/)
    }
    writePackage(originalPackage)
    fs.appendFileSync(path.join(root, pinned.file), 'tampered')
    assert.throws(() => collectNotices(root), /notice text changed; needs license review/)
    fs.writeFileSync(path.join(root, pinned.file), originalNotice)
    fs.writeFileSync(path.join(directory, 'LICENSE'), 'Original upstream notice\n')
    const upstream = collectNotices(root)
    assert.match(upstream.text, /Original upstream notice/)
    assert.doesNotMatch(upstream.text, /SUPPLEMENTAL NOTICE/)
    assert.equal(upstream.inventory.dependencies[0].supplementalNotice, undefined)
    fs.unlinkSync(path.join(directory, 'LICENSE'))
    const unknown = path.join(root, 'node_modules/unknown'); fs.mkdirSync(unknown)
    fs.writeFileSync(path.join(unknown, 'package.json'), JSON.stringify({ name: 'unknown', version: pinned.version, license: 'MIT' }))
    writeLock(entry, 'node_modules/unknown')
    assert.throws(() => collectNotices(root), /Runtime dependency needs license review: node_modules\/unknown/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
