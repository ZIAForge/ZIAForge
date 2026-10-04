// Run with the target packaged Electron in Node mode on the same OS/architecture.
const fs = require('node:fs')
const path = require('node:path')
const { stripVTControlCharacters } = require('node:util')
const [app, receipt, cwd] = process.argv.slice(2)
const marker = 'ZIAFORGE_PLATFORM_NATIVE_PTY_OK'
const resources = path.join(app, ...(process.platform === 'darwin' ? ['Contents', 'Resources'] : ['resources']))
const result = { status: 'running', platform: process.platform, arch: process.arch, electron: process.versions.electron, modules: process.versions.modules, napi: process.versions.napi }
const save = () => fs.writeFileSync(receipt, JSON.stringify(result, null, 2) + '\n')
let terminal, output = ''
const timer = setTimeout(() => { try { terminal?.kill() } catch {} Object.assign(result, { status: 'failed', error: 'Native PTY timeout', emergencyCleanup: true }); save(); process.exit(1) }, 15000)
try {
  if (!app || !receipt || !cwd || !process.versions.electron) throw new Error('Packaged Electron, app, receipt and isolated cwd are required')
  const pty = require(path.join(resources, 'app.asar', 'node_modules', 'node-pty'))
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  const windows = process.platform === 'win32'
  const executable = windows ? path.join(process.env.SystemRoot, 'System32', 'cmd.exe') : '/bin/sh'
  const argv = windows ? ['/d', '/s', '/c', `echo ${marker}`] : ['-c', `printf ${marker}`]
  terminal = pty.spawn(executable, argv, { name: 'xterm', cols: 100, rows: 24, cwd, env })
  terminal.onData(chunk => { output += chunk; if (output.length > 65536) terminal.kill() })
  terminal.onExit(({ exitCode, signal }) => {
    clearTimeout(timer)
    const text = stripVTControlCharacters(output).trim()
    Object.assign(result, { status: exitCode === 0 && text === marker ? 'passed' : 'failed', exitCode, signal, output: text, provenance: 'Real shell spawned through node-pty loaded from this target app.asar; no provider calls.' })
    save(); process.exitCode = result.status === 'passed' ? 0 : 1
  })
} catch (error) { clearTimeout(timer); Object.assign(result, { status: 'failed', error: error.stack }); save(); process.exitCode = 1 }
