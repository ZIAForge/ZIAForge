// Linux/Windows packaging in a new owned container. No host profile/socket mounts.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn, spawnSync } = require('node:child_process')
const { archiveSource } = require('./source.cjs')
const { snapshot } = require('./source-manifest.cjs')
const { sha256 } = require('../mac/package-utils.cjs')
const project = path.resolve(__dirname, '../..')
function options(args) {
  const out = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') out.help = true
    else if (['--image', '--platform', '--arch', '--identity', '--output', '--formats'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) out[args[i].slice(2)] = args[++i]
    else throw new Error(`Unknown or incomplete option: ${args[i]}`)
  }
  return out
}
async function main(argv) {
  const input = options(argv)
  if (input.help) { console.log('Usage: node scripts/platform/container.cjs --image IMAGE --platform linux|win32 --arch x64|arm64 --identity RESERVED.json --output NEW_DIRECTORY [--formats list]\nCreates only an owned container from an existing image, exports clean source, installs target dependencies, packages and retains evidence, then removes only that container. No host mounts, version reservation or publishing.'); return }
  if (!input.image || !input.identity || !input.output || !['linux', 'win32'].includes(input.platform) || !['x64', 'arm64'].includes(input.arch)) throw new Error('Image, target, reserved identity and new output are required')
  const source = snapshot(project), reserved = JSON.parse(fs.readFileSync(path.resolve(input.identity)))
  if (reserved.source?.commit !== source.commit || reserved.source?.dirty !== false) throw new Error('Reserved identity does not match clean source')
  const output = path.resolve(input.output); fs.mkdirSync(output, { mode: 0o700 })
  const owner = crypto.randomUUID(), name = `ziaforge-platform-${owner}`, docker = process.env.ZIAFORGE_DOCKER || 'docker'
  const dockerArch = input.platform === 'win32' ? 'amd64' : input.arch === 'x64' ? 'amd64' : 'arm64'
  const result = { status: 'preparing', owner, container: name, version: reserved.version, buildId: reserved.buildId, target: { platform: input.platform, arch: input.arch }, source, checks: [], limits: ['Docker ARM on an x64 daemon is emulated, not ARM hardware certification.', 'Windows cross-build does not execute a native Windows installer or GUI.'] }
  const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  let interrupted, activeChild
  const stop = signal => { interrupted = signal; activeChild?.kill('SIGTERM') }
  const onInterrupt = () => stop('SIGINT'), onTerminate = () => stop('SIGTERM')
  process.on('SIGINT', onInterrupt); process.on('SIGTERM', onTerminate)
  async function command(label, args, { allowFailure = false, timeout = 45 * 60 * 1000, cleanup = false } = {}) {
    if (interrupted && !cleanup) throw new Error(`Build interrupted by ${interrupted}`)
    const fd = fs.openSync(path.join(output, label + '.log'), 'wx')
    let executed
    try {
      executed = await new Promise(resolve => {
        let error, timedOut = false, force
        const child = spawn(docker, args, { cwd: project, stdio: ['ignore', fd, fd] }); activeChild = child
        const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); force = setTimeout(() => child.kill('SIGKILL'), 5000) }, timeout)
        child.once('error', value => { error = value })
        child.once('close', (status, signal) => { clearTimeout(timer); clearTimeout(force); activeChild = undefined; resolve({ status, signal, error: error || (timedOut ? new Error('Docker command timed out') : undefined) }) })
      })
    } finally { fs.closeSync(fd) }
    result.checks.push({ label, command: [docker, ...args], exitCode: executed.status, signal: executed.signal, error: executed.error?.message }); save()
    if (interrupted && !cleanup) throw new Error(`Build interrupted by ${interrupted}`)
    if (!allowFailure && executed.status !== 0) throw new Error(`${label} failed; see retained log`)
    return executed
  }
  function inspect(args) {
    const read = spawnSync(docker, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 })
    if (read.status !== 0) throw new Error(`Docker inspection failed: ${args[0]}`)
    return read.stdout.trim() ? JSON.parse(read.stdout) : null
  }
  let creationAttempted = false
  try {
    const image = inspect(['image', 'inspect', input.image])[0]
    if (image.Os !== 'linux' || image.Architecture !== dockerArch || !['ziaf', '1002', '1002:1002'].includes(image.Config.User)) throw new Error('Expected reviewed Linux builder image with matching architecture and ordinary ziaf user')
    result.image = { id: image.Id, platform: image.Os, arch: image.Architecture, user: image.Config.User }
    const server = inspect(['info', '--format', '{{json .}}'])
    result.daemon = { platform: server.OSType, arch: server.Architecture }
    result.emulated = dockerArch === 'arm64' && !['arm64', 'aarch64'].includes(server.Architecture)
    const exported = path.join(output, 'source')
    const archive = archiveSource(project, exported)
    if (archive.status !== 'passed') throw new Error('Source export failed')
    const tar = archive.artifacts.find(item => item.file.endsWith('.tar.gz'))
    fs.copyFileSync(path.resolve(input.identity), path.join(output, 'reserved-identity.json'), fs.constants.COPYFILE_EXCL)
    creationAttempted = true
    await command('container-create', ['create', '--name', name, '--platform', `linux/${dockerArch}`, '--label', `org.ziaforge.owner=${owner}`, '--cpus', '3', '--memory', '3g', '--pids-limit', '1024', '--shm-size', '256m', '--env', 'npm_config_jobs=2', image.Id])
    await command('container-start', ['start', name])
    await command('copy-source', ['cp', path.join(exported, tar.file), `${name}:/tmp/source.tar.gz`])
    await command('copy-manifest', ['cp', path.join(exported, 'source-manifest.json'), `${name}:/tmp/source-manifest.json`])
    await command('copy-identity', ['cp', path.join(output, 'reserved-identity.json'), `${name}:/tmp/reserved-identity.json`])
    await command('extract-source', ['exec', name, 'python3', '/usr/local/bin/ziaforge-extract-tar', '/tmp/source.tar.gz', '/workspace', '1'])
    // docker cp retains private host modes; grant only the ordinary container user
    // access to these non-secret build metadata files before running npm.
    await command('metadata-permissions', ['exec', '--user', 'root', name, 'chown', '1002:1002', '/tmp/source-manifest.json', '/tmp/reserved-identity.json'])
    await command('clean-install', ['exec', '--workdir', '/workspace', name, 'npm', 'ci', '--no-audit', '--no-fund'])
    const packageArgs = ['exec', '--workdir', '/workspace', name, ...(input.platform === 'win32' ? ['xvfb-run', '-a'] : []), 'node', 'scripts/platform/package.cjs', '--platform', input.platform, '--arch', input.arch, '--identity', '/tmp/reserved-identity.json', '--source-manifest', '/tmp/source-manifest.json', '--output', '/evidence/package']
    if (input.formats) packageArgs.push('--formats', input.formats)
    const packaged = await command('package', packageArgs, { allowFailure: true })
    await command('retain-package', ['cp', `${name}:/evidence/package`, path.join(output, 'package')])
    const child = JSON.parse(fs.readFileSync(path.join(output, 'package/result.json')))
    if (packaged.status !== 0 || child.status !== 'passed') throw new Error('Target package failed; retained original package receipt')
    result.packageReceipt = path.join(output, 'package/result.json')
    result.retainedApp = path.join(output, 'package', path.relative('/evidence/package', child.app))
    result.artifacts = child.artifacts.map(item => {
      const relative = path.posix.relative('/evidence/package', item.path)
      if (relative.startsWith('../') || path.posix.isAbsolute(relative)) throw new Error('Unexpected container artifact path')
      const file = path.join(output, 'package', relative)
      if (sha256(file) !== item.sha256) throw new Error('Copied artifact differs from container package')
      return { path: file, sha256: item.sha256 }
    })
    if (snapshot(project).digest !== source.digest) throw new Error('Host source changed during container build')
    result.sourceChanged = false; result.nativeExecution = child.nativeExecution; result.status = 'passed'
  } catch (error) { result.status = 'failed'; result.error = error.stack }
  finally {
    if (creationAttempted) {
      try {
        const found = inspect(['ps', '-a', '--filter', `label=org.ziaforge.owner=${owner}`, '--format', '{{json .}}'])
        if (found) {
          const current = inspect(['inspect', name])[0]
          if (current.Config.Labels?.['org.ziaforge.owner'] !== owner) throw new Error('Container ownership changed; refused cleanup')
          await command('container-stop', ['stop', '--time', '15', name], { timeout: 45000, cleanup: true })
          await command('container-remove', ['rm', name], { timeout: 45000, cleanup: true })
        }
        const remaining = inspect(['ps', '-a', '--filter', `label=org.ziaforge.owner=${owner}`, '--format', '{{json .}}'])
        result.cleanup = { verified: !remaining, ownership: owner }
        if (remaining) throw new Error('Owned build container remains after cleanup')
      } catch (error) { result.status = 'failed'; result.cleanup = { verified: false, error: error.stack } }
    } else result.cleanup = { verified: true, containerCreated: false }
    if (interrupted) { result.interrupted = interrupted; result.status = 'failed' }
    process.removeListener('SIGINT', onInterrupt); process.removeListener('SIGTERM', onTerminate)
    result.finishedAt = new Date().toISOString(); save()
  }
  console.log(JSON.stringify({ status: result.status, directory: output, artifacts: result.artifacts, cleanup: result.cleanup }))
  process.exitCode = result.status === 'passed' ? 0 : 1
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.stack); process.exitCode = 1 })
module.exports = { options }
