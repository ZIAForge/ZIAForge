const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { inspectHelpers, repairHelpers } = require('../fix-node-pty-helper.cjs')

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaforge-helper-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dependency = path.join(root, 'node_modules/node-pty')
  fs.mkdirSync(dependency, { recursive: true })
  fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({ name: 'node-pty', version: 'fixture' }))
  const file = (relative, mode = 0o644) => {
    const filename = path.join(dependency, relative)
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    fs.writeFileSync(filename, '#!/bin/sh\nexit 0\n')
    fs.chmodSync(filename, mode)
    return filename
  }
  return { root, dependency, file }
}

test('repairs only allowed helpers, retains read/write permissions and is idempotent', t => {
  const { root, file } = fixture(t)
  const current = file('prebuilds/darwin-x64/spawn-helper')
  const otherArch = file('prebuilds/darwin-arm64/spawn-helper')
  const compiled = file('build/Release/spawn-helper', 0o640)
  const unrelated = file('prebuilds/linux-x64/spawn-helper')
  const otherFile = file('prebuilds/darwin-x64/pty.node')
  const before = inspectHelpers(root, 'x64')
  assert.equal(before.applicableExecutable, false)
  assert.equal(fs.statSync(current).mode & 0o777, 0o644, 'inspection must not chmod')
  const result = repairHelpers(root, { platform: 'darwin', arch: 'x64' })
  assert.equal(result.status, 'repaired')
  assert.equal(result.changed.length, 3)
  assert.equal(fs.statSync(current).mode & 0o777, 0o755)
  assert.equal(fs.statSync(otherArch).mode & 0o777, 0o755)
  assert.equal(fs.statSync(compiled).mode & 0o777, 0o751)
  assert.equal(fs.statSync(unrelated).mode & 0o777, 0o644)
  assert.equal(fs.statSync(otherFile).mode & 0o777, 0o644)
  assert.equal(repairHelpers(root, { platform: 'darwin', arch: 'x64' }).status, 'already-executable')
})

test('refuses a helper symlink before mutating any validated helper', t => {
  const { root, dependency, file } = fixture(t)
  const compiled = file('build/Release/spawn-helper')
  const victim = path.join(root, 'unrelated-file')
  fs.writeFileSync(victim, 'do not change'); fs.chmodSync(victim, 0o644)
  fs.mkdirSync(path.join(dependency, 'prebuilds/darwin-x64'), { recursive: true })
  fs.symlinkSync(victim, path.join(dependency, 'prebuilds/darwin-x64/spawn-helper'))
  assert.throws(() => repairHelpers(root, { platform: 'darwin', arch: 'x64' }), /symlink/)
  assert.equal(fs.statSync(compiled).mode & 0o777, 0o644)
  assert.equal(fs.statSync(victim).mode & 0o777, 0o644)
})

test('refuses a symlinked package subdirectory and never chmods outside it', t => {
  const { root, dependency } = fixture(t)
  const outside = path.join(root, 'outside')
  fs.mkdirSync(path.join(outside, 'darwin-x64'), { recursive: true })
  const victim = path.join(outside, 'darwin-x64/spawn-helper')
  fs.writeFileSync(victim, 'do not change'); fs.chmodSync(victim, 0o644)
  fs.symlinkSync(outside, path.join(dependency, 'prebuilds'))
  assert.throws(() => repairHelpers(root, { platform: 'darwin', arch: 'x64' }), /symlink/)
  assert.equal(fs.statSync(victim).mode & 0o777, 0o644)
})

test('refuses an unexpected package and missing platform helper', t => {
  const { root, dependency, file } = fixture(t)
  file('prebuilds/darwin-arm64/spawn-helper')
  assert.throws(() => repairHelpers(root, { platform: 'darwin', arch: 'x64' }), /No node-pty spawn-helper/)
  fs.writeFileSync(path.join(dependency, 'package.json'), '{"name":"different-package"}')
  assert.throws(() => repairHelpers(root, { platform: 'darwin', arch: 'x64' }), /not node-pty/)
})

test('does not mutate helpers on other platforms', t => {
  const { root, file } = fixture(t)
  const helper = file('build/Release/spawn-helper')
  assert.equal(repairHelpers(root, { platform: 'linux' }).status, 'not-applicable')
  assert.equal(fs.statSync(helper).mode & 0o777, 0o644)
})
