const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { reserveOutput, bundleInventory, assertSourceUnchanged } = require('../mac/package-utils.cjs')

test('identical builds reserve distinct directories and preserve prior artifacts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-package-test-'))
  try {
    const first = reserveOutput(root, 'same-version-commit-time')
    fs.writeFileSync(path.join(first, 'old.dmg'), 'original')
    const second = reserveOutput(root, 'same-version-commit-time')
    assert.notEqual(first, second)
    assert.equal(fs.readFileSync(path.join(first, 'old.dmg'), 'utf8'), 'original')
    assert.throws(() => reserveOutput(root, '../escape'), /Unsafe/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('bundle inventory captures content, executable mode and symlink target without following it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-inventory-test-'))
  try {
    fs.writeFileSync(path.join(root, 'binary'), 'one', { mode: 0o755 })
    fs.symlinkSync('/unavailable/outside', path.join(root, 'link'))
    const before = bundleInventory(root)
    assert.equal(before.files[1].target, '/unavailable/outside')
    assert.equal(before.files[0].mode, 0o755)
    fs.chmodSync(path.join(root, 'binary'), 0o644)
    const modeChanged = bundleInventory(root)
    assert.notEqual(before.digest, modeChanged.digest)
    fs.writeFileSync(path.join(root, 'binary'), 'two')
    assert.notEqual(modeChanged.digest, bundleInventory(root).digest)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('a changed commit, content or missing provenance invalidates the build', () => {
  const original = { commit: 'abc', workingTreeSha256: 'def' }
  assert.doesNotThrow(() => assertSourceUnchanged(original, { ...original }))
  for (const changed of [{ ...original, commit: 'new' }, { ...original, workingTreeSha256: 'new' }, {}]) {
    assert.throws(() => assertSourceUnchanged(original, changed), /invalidated/)
  }
  assert.throws(() => assertSourceUnchanged({}, {}), /invalidated/)
})
