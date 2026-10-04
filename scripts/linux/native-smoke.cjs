const fs = require('node:fs')
const path = require('node:path')
const [app, receipt] = process.argv.slice(2)
const result = { status: 'running', arch: process.arch, electron: process.versions.electron, node: process.version }
const save = () => fs.writeFileSync(receipt, JSON.stringify(result, null, 2) + '\n')
let pty
const timer = setTimeout(() => { try { pty?.kill() } catch {} result.status = 'failed'; result.error = 'Native PTY timed out'; save(); process.exit(1) }, 10000)
try {
  const native = require(path.join(app, 'resources/app.asar/node_modules/node-pty'))
  pty = native.spawn('/bin/bash', ['--noprofile', '--norc', '-c', 'printf ZIAFORGE_LINUX_PTY_OK'], { name: 'xterm', cols: 80, rows: 24, cwd: '/tmp', env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' } })
  let output = ''
  pty.onData(data => { output += data })
  pty.onExit(({ exitCode, signal }) => { clearTimeout(timer); Object.assign(result, { status: exitCode === 0 && output === 'ZIAFORGE_LINUX_PTY_OK' ? 'passed' : 'failed', exitCode, signal, output }); save(); process.exitCode = result.status === 'passed' ? 0 : 1 })
} catch (error) { clearTimeout(timer); result.status = 'failed'; result.error = error.stack; save(); process.exitCode = 1 }
