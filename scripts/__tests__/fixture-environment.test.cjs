const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { fixtureEnvironment } = require('../qa/fixture-environment.cjs')

test('an actual fixture child inherits standard HOME and only explicitly selected environment', () => {
  const selected = { PATH: '/usr/bin:/bin', SHELL: '/bin/sh', ZDOTDIR: '/fixture-shell-config', ZIAF_FIXTURE_SENTINEL: 'selected' }
  const inherited = { HOME: process.env.HOME, CODEX_HOME: 'not-forwarded', ANTHROPIC_API_KEY: 'not-forwarded', NODE_OPTIONS: 'not-forwarded', BASH_ENV: 'not-forwarded', ENV: 'not-forwarded', ZDOTDIR: 'not-forwarded' }
  const environment = fixtureEnvironment(selected, inherited)
  const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(process.env))'], {
    env: environment, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(child.error, undefined)
  assert.equal(child.status, 0)
  assert.equal(child.signal, null)
  assert.deepEqual(environment, { ...selected, HOME: process.env.HOME })
  const actual = JSON.parse(child.stdout)
  // Platforms may add metadata after process creation (for example macOS
  // __CF_USER_TEXT_ENCODING); assert the contract and prohibited values directly.
  for (const [name, value] of Object.entries({ ...selected, HOME: process.env.HOME })) assert.equal(actual[name], value, name)
  for (const name of ['CODEX_HOME', 'ANTHROPIC_API_KEY', 'NODE_OPTIONS', 'BASH_ENV', 'ENV']) assert.equal(actual[name], undefined, name)
  assert.deepEqual(selected, { PATH: '/usr/bin:/bin', SHELL: '/bin/sh', ZDOTDIR: '/fixture-shell-config', ZIAF_FIXTURE_SENTINEL: 'selected' })
})

test('fixture launch refuses missing HOME and a fixture HOME override without mutating process.env', () => {
  const original = process.env.HOME
  assert.throws(() => fixtureEnvironment({}, {}), /standard inherited HOME/)
  assert.throws(() => fixtureEnvironment({}, { HOME: '' }), /standard inherited HOME/)
  assert.throws(() => fixtureEnvironment({ HOME: original }), /cannot be overridden/)
  assert.equal(process.env.HOME, original)
})
