const fs = require('node:fs')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { spawn, spawnSync } = require('node:child_process')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function startPrivateKeyring(runtimeDirectory) {
  assert.equal(process.platform, 'linux')
  assert.notEqual(process.getuid(), 0)
  assert(process.env.DBUS_SESSION_BUS_ADDRESS, 'A private DBus session is required')
  fs.mkdirSync(runtimeDirectory, { recursive: true, mode: 0o700 })
  const env = { ...process.env, XDG_RUNTIME_DIR: runtimeDirectory }
  const daemon = spawn('/usr/bin/gnome-keyring-daemon', ['--foreground', '--unlock', '--components=secrets'], { env, stdio: ['pipe', 'ignore', 'ignore'] })
  let spawnError
  daemon.on('error', error => { spawnError = error.message })
  const password = crypto.randomBytes(32).toString('base64')
  // A fresh container user's login keyring is created and unlocked in memory.
  // The password is sent only through stdin and never written to evidence.
  daemon.stdin.on('error', () => {})
  daemon.stdin.end(password)
  async function close() {
    if (daemon.exitCode !== null || daemon.signalCode !== null) return { stopped: true, forced: false, exitCode: daemon.exitCode, signal: daemon.signalCode }
    daemon.kill('SIGTERM')
    for (let i = 0; i < 50 && daemon.exitCode === null && daemon.signalCode === null; i++) await wait(100)
    let forced = false
    if (daemon.exitCode === null && daemon.signalCode === null) { forced = true; daemon.kill('SIGKILL'); await wait(250) }
    return { stopped: daemon.exitCode !== null || daemon.signalCode !== null, forced, exitCode: daemon.exitCode, signal: daemon.signalCode }
  }
  try {
    let available = false
    for (let i = 0; i < 100; i++) {
      if (spawnError || daemon.exitCode !== null || daemon.signalCode !== null) throw new Error('Private keyring daemon failed to start')
      const reply = spawnSync('/usr/bin/dbus-send', ['--session', '--print-reply', '--dest=org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus.NameHasOwner', 'string:org.freedesktop.secrets'], { env, encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'pipe'] })
      if (reply.status === 0 && /boolean true/.test(reply.stdout)) { available = true; break }
      await wait(100)
    }
    assert(available, 'Private Secret Service did not become available')
    const item = crypto.randomUUID(), value = crypto.randomBytes(24).toString('hex')
    const store = spawnSync('/usr/bin/secret-tool', ['store', '--label=ZIAForge isolated keyring check', 'ziaforge-fixture', item], { env, input: value, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
    assert.equal(store.status, 0, 'Private keyring store failed')
    const lookup = spawnSync('/usr/bin/secret-tool', ['lookup', 'ziaforge-fixture', item], { env, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] })
    assert(lookup.status === 0 && lookup.stdout.trimEnd() === value, 'Private keyring lookup mismatch')
    const clear = spawnSync('/usr/bin/secret-tool', ['clear', 'ziaforge-fixture', item], { env, timeout: 10000, stdio: 'ignore' })
    assert.equal(clear.status, 0, 'Private keyring test item cleanup failed')
    return { close, receipt: { service: 'org.freedesktop.secrets', available: true, privateStoreLookupClear: true, passwordRetained: false, pid: daemon.pid } }
  } catch (error) { await close(); throw error }
}
module.exports = { startPrivateKeyring }
if (require.main === module) {
  startPrivateKeyring('/evidence/keyring-runtime').then(async keyring => {
    const cleanup = await keyring.close()
    console.log(JSON.stringify({ status: cleanup.stopped && !cleanup.forced ? 'passed' : 'failed', ...keyring.receipt, cleanup }))
    process.exitCode = cleanup.stopped && !cleanup.forced ? 0 : 1
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
}
