// Run with the packaged executable and ELECTRON_RUN_AS_NODE=1, never host Node.
const fs = require('node:fs')
const path = require('node:path')
const [app, output, cwd] = process.argv.slice(2)
if (!app || !output || !cwd) throw new Error('Expected app, result file and isolated cwd')
const pty = require(path.join(app, 'Contents', 'Resources', 'app.asar', 'node_modules', 'node-pty'))
const marker = 'ZIAFORGE_PACKAGED_NATIVE_PTY_OK'
const child = pty.spawn('/bin/sh', ['-c', `printf '${marker}'; exit 0`], {
  name: 'xterm-color', cols: 80, rows: 24, cwd,
  env: { PATH: '/usr/bin:/bin', SHELL: '/bin/sh' },
})
let text = ''
child.onData(chunk => { text += chunk })
const timer = setTimeout(() => {
  try { child.kill() } catch { /* Capture timeout below. */ }
  fs.writeFileSync(output, JSON.stringify({ status: 'failed', error: 'Packaged native PTY timed out' }, null, 2))
  process.exit(1)
}, 7000)
child.onExit(({ exitCode, signal }) => {
  clearTimeout(timer)
  const passed = exitCode === 0 && text === marker
  fs.writeFileSync(output, JSON.stringify({ status: passed ? 'passed' : 'failed', exitCode, signal, output: text,
    arch: process.arch, electron: process.versions.electron, modules: process.versions.modules,
    provenance: 'node-pty loaded from this packaged app.asar; actual local shell spawned, no provider.' }, null, 2) + '\n')
  process.exitCode = passed ? 0 : 1
})
