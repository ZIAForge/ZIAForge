const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { nextVersion, reserveVersion, acquirePackagingLock } = require('../mac/build-version.cjs')
const temporary = fn => async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-versions-'))
  try { await fn(root) } finally { fs.rmSync(root, { recursive: true, force: true }) }
}

test('preview does not allocate; failed and interrupted attempts permanently consume versions', temporary(root => {
  const base = path.join(root, 'macos')
  assert.equal(nextVersion(base, '0.0.4'), '0.0.4')
  assert.equal(fs.existsSync(base), false)
  const first = reserveVersion(base, '0.0.4')
  assert.equal(first.version, '0.0.4')
  const firstBytes = fs.readFileSync(first.filename)
  // Crash after atomic directory reservation but before metadata was written.
  fs.mkdirSync(path.join(base, '.versions', '0.0.5'))
  assert.equal(reserveVersion(base, '0.0.4').version, '0.0.6')
  assert.deepEqual(fs.readFileSync(first.filename), firstBytes)
  assert.equal(fs.statSync(first.filename).mode & 0o777, 0o600)
}))

test('retained output versions, newer release lines and source floors prevent reuse after restore', temporary(root => {
  fs.mkdirSync(path.join(root, '0.0.3-dev.previous'))
  assert.equal(nextVersion(root, '0.0.4'), '0.0.4')
  fs.mkdirSync(path.join(root, '0.1.2-dev.retained-failed'))
  assert.equal(reserveVersion(root, '0.0.4').version, '0.1.3')
  assert.equal(reserveVersion(root, '0.2.0').version, '0.2.0')
  for (const invalid of ['1.2', '1.2.3-dev', '01.2.3', '../escape', '0.0.9007199254740992']) assert.throws(() => nextVersion(root, invalid))
}))

test('concurrent independent allocators reserve unique consecutive versions', temporary(async root => {
  const helper = require.resolve('../mac/build-version.cjs')
  const code = 'process.stdout.write(require(process.argv[1]).reserveVersion(process.argv[2],"0.0.4").version)'
  const runs = await Promise.all(Array.from({ length: 6 }, () => promisify(execFile)(process.execPath, ['-e', code, helper, root], { timeout: 10_000 })))
  assert.deepEqual(runs.map(run => run.stdout).sort(), ['0.0.4', '0.0.5', '0.0.6', '0.0.7', '0.0.8', '0.0.9'])
  assert.equal(fs.readdirSync(path.join(root, '.versions')).length, 6)
}))

test('whole-build lock fails closed and does not release another owner lock', temporary(root => {
  const release = acquirePackagingLock(root)
  assert.throws(() => acquirePackagingLock(root), /locked/)
  release(); release()
  const second = acquirePackagingLock(root)
  const owner = path.join(root, '.packaging-lock', 'owner.json')
  const original = fs.readFileSync(owner)
  fs.writeFileSync(owner, JSON.stringify({ token: 'replacement' }))
  assert.throws(second, /ownership changed/)
  assert.equal(fs.existsSync(owner), true)
  fs.writeFileSync(owner, original); second()
}))

test('symlinked ledger or reservation refuses allocation without touching its target', temporary(root => {
  const target = path.join(root, 'outside'); fs.mkdirSync(target)
  const base = path.join(root, 'macos'); fs.mkdirSync(base)
  fs.symlinkSync(target, path.join(base, '.versions'))
  assert.throws(() => reserveVersion(base, '0.0.4'), /real directory/)
  assert.deepEqual(fs.readdirSync(target), [])
}))
