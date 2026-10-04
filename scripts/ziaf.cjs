#!/usr/bin/env node
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const net = require('node:net')
const { randomUUID } = require('node:crypto')
const { spawn } = require('node:child_process')

function options(argv) {
  const result = { command: 'status', json: false, untilSuccess: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') result.help = true
    else if (arg === '--launch') result.launch = true
    else if (arg === '--json') result.json = true
    else if (arg === '--until-success') { result.untilSuccess = true; result.command = 'start' }
    else if (['list', 'status', 'start', 'pause', 'quit'].includes(arg)) result.command = arg
    else if (['--task', '--profile'].includes(arg) && argv[i + 1] && !argv[i + 1].startsWith('--')) result[arg.slice(2)] = argv[++i]
    else throw new Error(`Unknown or incomplete option: ${arg}`)
  }
  if (!result.help && !['list', 'quit'].includes(result.command) && !result.task) throw new Error('Select a task with --task ID; use ziaf list first')
  if (result.untilSuccess && result.command !== 'start') throw new Error('--until-success is a start policy')
  return result
}
function endpoint(profile) {
  const roots = profile ? [path.resolve(profile)] : process.platform === 'darwin' ? ['ZIAForge', 'ziaforge'].map(name => path.join(os.homedir(), 'Library', 'Application Support', name)) : [path.join(process.env.APPDATA || process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'ziaforge')]
  for (const root of roots) {
    const filename = path.join(root, 'cli', 'endpoint.json')
    try {
      const stat = fs.lstatSync(filename)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096 || process.platform !== 'win32' && (stat.mode & 0o077 || typeof process.getuid === 'function' && stat.uid !== process.getuid())) throw new Error('Unsafe dispatcher endpoint permissions')
      const value = JSON.parse(fs.readFileSync(filename, 'utf8'))
      if (value.version !== 1 || typeof value.socketPath !== 'string' || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)) throw new Error('Invalid dispatcher endpoint')
      return value
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  throw new Error('ZIAForge is not running for this profile. Open the app first, or pass --profile PATH for an isolated profile.')
}
function request(address, command) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(address.socketPath)
    let raw = ''
    socket.setEncoding('utf8')
    socket.setTimeout(30000, () => socket.destroy(new Error('Dispatcher timed out')))
    socket.once('connect', () => socket.write(JSON.stringify({ token: address.token, request: command }) + '\n'))
    socket.on('data', chunk => { raw += chunk; if (Buffer.byteLength(raw) > 1024 * 1024 + 1024) socket.destroy(new Error('Dispatcher response too large')) })
    socket.once('error', reject)
    socket.once('end', () => { try { const response = JSON.parse(raw); if (!response.ok) throw new Error(response.error); resolve(response.result) } catch (error) { reject(error) } })
  })
}
async function main(argv) {
  const config = options(argv)
  if (config.help) {
    process.stdout.write('ziaf list | status | start | pause | quit --task ID [--profile PATH] [--json] [--launch]\nziaf --task ID --until-success\n\nUses the app and its saved WorkflowEngine plan. --launch starts the installed macOS app without opening a window when needed. --until-success enables Auto advancement; explicit checkpoints, verification, review and retry limits still apply. ziaf quit closes the app gracefully. Ctrl+C stops observing; ziaf pause --task ID pauses execution.\n')
    return 0
  }
  let address
  if (config.launch) {
    try { address = endpoint(config.profile); await request(address, { command: 'list' }) } catch {
      if (config.profile) throw new Error('Open the chosen isolated profile before using --profile; automatic launch uses the normal app profile')
      const bundled = path.resolve(__dirname, '..', 'MacOS', 'ZIAForge')
      const binary = fs.existsSync(bundled) ? bundled : '/Applications/ZIAForge.app/Contents/MacOS/ZIAForge'
      if (process.platform !== 'darwin' || !fs.existsSync(binary)) throw new Error('Install ZIAForge.app in Applications or run its bundled Resources/ziaf.cjs launcher')
      await new Promise((resolve, reject) => { const child = spawn(binary, ['--ziaf-headless'], { detached: true, stdio: 'ignore' }); child.once('error', reject); child.once('spawn', () => { child.unref(); resolve() }) })
      const deadline = Date.now() + 20000
      for (;;) {
        try { address = endpoint(); await request(address, { command: 'list' }); break } catch (error) { if (Date.now() >= deadline) throw error; await new Promise(resolve => setTimeout(resolve, 250)) }
      }
    }
  } else address = endpoint(config.profile)
  const command = { command: config.command, ...(config.task ? { taskId: config.task } : {}), ...(config.command === 'start' ? { commandId: randomUUID(), untilSuccess: config.untilSuccess } : {}) }
  let result = await request(address, command)
  let sequence
  const print = () => {
    if (config.json) process.stdout.write(JSON.stringify(result) + '\n')
    else if (Array.isArray(result)) for (const task of result) process.stdout.write(`${task.id}\t${task.name}\t${task.mode}\n`)
    else process.stdout.write(result ? `${result.taskId}\t${result.status}\t${result.completed}/${result.total}${result.reason ? '\t' + result.reason : ''}\n` : 'No saved plan\n')
  }
  print(); sequence = result?.sequence
  while (config.untilSuccess && result?.status === 'running') {
    await new Promise(resolve => setTimeout(resolve, 500))
    result = await request(address, { command: 'status', taskId: config.task })
    if (result?.sequence !== sequence) { print(); sequence = result?.sequence }
  }
  return config.untilSuccess && result?.status !== 'completed' ? result?.status === 'paused' ? 3 : 2 : 0
}
module.exports = { options, endpoint, request, main }
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code }, error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
