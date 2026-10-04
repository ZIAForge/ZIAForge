// Only named resources created by this run are managed; never prune Docker.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { spawn, spawnSync } = require('node:child_process')
const { project, identity } = require('../qa/common.cjs')
let interrupted = false
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true })
const docker = process.env.ZIAFORGE_DOCKER || 'docker'
const [operation, directoryArg, extraArg] = process.argv.slice(2)
if (!['prepare', 'package', 'smoke', 'cleanup'].includes(operation) || !directoryArg) {
  console.log('Usage:\n  node scripts/linux/docker.cjs prepare NEW_RUN_DIR [IMAGE]\n  node scripts/linux/docker.cjs package RUN_DIR ROOT_RESERVED_IDENTITY_JSON\n  node scripts/linux/docker.cjs smoke RUN_DIR\n  node scripts/linux/docker.cjs cleanup RUN_DIR\nprepare requires clean frozen Git; package never reserves a version. cleanup removes only this run\'s labelled builder/container volume.')
  process.exit(operation === '--help' || !operation ? 0 : 1)
}
const directory = path.resolve(directoryArg)
const manifestFile = path.join(directory, 'docker-run.json')
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
function run(args, options = {}) {
  const command = spawnSync(docker, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, ...options })
  if (command.status !== 0) throw new Error(`Docker ${args[0]} failed (${command.status}): ${command.stderr || command.error || ''}`)
  return command.stdout.trim()
}
async function logged(name, args, timeout = 1200000) {
  const log = fs.openSync(path.join(directory, name + '.log'), 'wx')
  try { await new Promise((resolve, reject) => { const child = spawn(docker, args, { stdio: ['ignore', log, log] }); const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(name + ' deadline')) }, timeout); child.once('error', reject); child.once('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(name + ' failed; see retained log')) }) }) }
  finally { fs.closeSync(log) }
}
function ownedResource(kind, name, id) {
  const label = run([kind, 'inspect', name, '--format', '{{ index .Labels "org.ziaforge.run" }}'].map((part, i) => kind === 'container' && i === 4 ? '{{ index .Config.Labels "org.ziaforge.run" }}' : part))
  if (label !== id) throw new Error('Refusing resource not owned by this run: ' + name)
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function poll(fn, label, timeout = 60000) { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const value = await fn(); if (value) return value } catch (error) { last = error.message } await delay(200) } throw new Error('Timed out ' + label + (last ? ': ' + last : '')) }
async function prepare() {
  const source = identity(); if (source.dirty !== false || !source.commit) throw new Error('Freeze and commit source before exporting Linux build input')
  fs.mkdirSync(directory, { mode: 0o700 })
  const id = 'ziaf-' + crypto.randomBytes(6).toString('hex')
  const image = extraArg || 'ziaforge-ubuntu-lab:node24-20261003'
  const manifest = { schemaVersion: 1, id, source, image, imageId: run(['image', 'inspect', image, '--format', '{{.Id}}']), builder: id + '-builder', volume: id + '-build', createdAt: new Date().toISOString(), status: 'preparing' }
  write(manifestFile, manifest)
  const archive = path.join(directory, 'source.tar')
  const exported = spawnSync('git', ['archive', '--format=tar', '-o', archive, source.commit], { cwd: project, encoding: 'utf8' })
  if (exported.status !== 0) throw new Error('Source export failed')
  manifest.sourceArchiveSha256 = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex')
  run(['volume', 'create', '--label', 'org.ziaforge.run=' + id, manifest.volume])
  run(['run', '-d', '--name', manifest.builder, '--label', 'org.ziaforge.run=' + id, '--cpus', '3', '--memory', '3g', '--pids-limit', '512', '-v', manifest.volume + ':/workspace', manifest.imageId])
  run(['exec', '-u', 'root', manifest.builder, 'chown', 'ziaf:ziaf', '/workspace'])
  run(['exec', manifest.builder, 'mkdir', '/workspace/source'])
  run(['cp', archive, manifest.builder + ':/workspace/source.tar'])
  run(['exec', manifest.builder, 'tar', '-xf', '/workspace/source.tar', '-C', '/workspace/source'])
  await logged('npm-ci-linux', ['exec', '-w', '/workspace/source', manifest.builder, 'npm', 'ci', '--no-audit', '--no-fund'])
  // Electron exposes its vendor installer separately from npm lifecycle scripts.
  // It validates the pinned archive and is a no-op when that runtime is installed.
  await logged('electron-runtime-linux', ['exec', '-w', '/workspace/source', manifest.builder, 'node', 'node_modules/electron/install.js'])
  manifest.runtime = JSON.parse(run(['exec', manifest.builder, 'node', '-e', 'console.log(JSON.stringify({node:process.version,arch:process.arch,platform:process.platform,uid:process.getuid(),home:process.env.HOME}))']))
  assert.equal(manifest.runtime.platform, 'linux'); assert.equal(manifest.runtime.arch, 'x64'); assert.notEqual(manifest.runtime.uid, 0)
  manifest.status = 'prepared'; write(manifestFile, manifest)
  console.log(JSON.stringify({ status: manifest.status, directory, builder: manifest.builder, imageId: manifest.imageId, runtime: manifest.runtime }))
}
async function packageBuild(manifest) {
  ownedResource('container', manifest.builder, manifest.id)
  const input = JSON.parse(fs.readFileSync(path.resolve(extraArg), 'utf8'))
  assert.equal(input.source.commit, manifest.source.commit); assert.equal(input.source.workingTreeSha256, manifest.source.workingTreeSha256)
  assert.deepEqual(identity(), manifest.source)
  run(['cp', path.resolve(extraArg), manifest.builder + ':/workspace/build-identity.json'])
  await logged('package-linux', ['exec', '-w', '/workspace/source', manifest.builder, 'node', 'scripts/linux/package.cjs', '/workspace/build-identity.json', '/workspace/package'])
  const destination = path.join(directory, 'package'); fs.mkdirSync(destination)
  const entries = JSON.parse(run(['exec', manifest.builder, 'node', '-e', 'console.log(JSON.stringify(require("fs").readdirSync("/workspace/package")))']))
  for (const entry of entries.filter(name => name !== 'artifacts')) run(['cp', manifest.builder + ':/workspace/package/' + entry, path.join(destination, entry)])
  fs.mkdirSync(path.join(destination, 'artifacts'))
  const built = JSON.parse(fs.readFileSync(path.join(destination, 'result.json'), 'utf8'))
  if (built.status !== 'passed' || !/^artifacts\/[^/]+\.deb$/.test(built.deb)) throw new Error('Unexpected Linux artifact path')
  run(['cp', manifest.builder + ':/workspace/package/' + built.deb, path.join(destination, built.deb)])
  const debHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(destination, built.deb))).digest('hex')
  assert.equal(debHash, built.debSha256)
  // The installer and complete inventory are retained; do not duplicate the
  // transient unpacked app on a constrained host or in the builder volume.
  run(['exec', manifest.builder, 'rm', '-rf', '/workspace/package/artifacts/linux-unpacked'])
  write(path.join(destination, 'artifact-retention.json'), { retained: [built.deb, 'app-inventory.json', 'native-pty.json', 'build-identity.json'], debSha256: debHash, transientUnpackedRemoved: true, expectedBundleInventorySha256: built.bundleInventorySha256, checkedAt: new Date().toISOString() })
  assert.deepEqual(identity(), manifest.source)
  const result = JSON.parse(fs.readFileSync(path.join(destination, 'result.json'), 'utf8')); assert.equal(result.status, 'passed')
  manifest.package = destination; manifest.status = 'packaged'; write(manifestFile, manifest)
  console.log(JSON.stringify({ status: 'passed', package: destination, deb: path.join(destination, result.deb), debSha256: result.debSha256 }))
}
async function smoke(manifest) {
  const smokeDir = fs.mkdtempSync(path.join(directory, 'smoke-'))
  const network = manifest.id + '-smoke-' + crypto.randomBytes(3).toString('hex')
  const containers = [], workers = [], receipts = {}
  const result = { status: 'running', mode: 'two actual Ubuntu Docker desktops; installed .deb; fixture CLI only', source: manifest.source, imageId: manifest.imageId, checks: [], containers, limits: ['Ubuntu24 X11/Xvfb container desktop, not host GNOME/Wayland or Debian validation.', 'No live provider, authentication, billing or Internet inference.', 'Docker network is internal; only loopback control HTTP ports are published.'] }
  const save = () => write(path.join(smokeDir, 'result.json'), result)
  const check = (name, ok) => { assert(ok, name); result.checks.push(name); save() }
  async function request(container, data) {
    if (interrupted && data.type !== 'quit') throw new Error('Linux smoke interrupted')
    const id = crypto.randomBytes(5).toString('hex')
    run(['exec', '-i', container, 'node', '-e', 'const fs=require("fs");let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>fs.writeFileSync("/evidence/request.json",s,{mode:384}))'], { input: JSON.stringify({ id, ...data }) })
    const response = await poll(() => { const raw = spawnSync(docker, ['exec', container, 'cat', '/evidence/response-' + id + '.json'], { encoding: 'utf8', timeout: 5000 }); return raw.status === 0 ? JSON.parse(raw.stdout) : null }, 'instance request ' + data.type, 90000)
    if (!response.ok) throw new Error(response.error)
    return response.result
  }
  let a, b, first, second, local, remote, origin, token
  const call = async (method, args = [], target = '') => { const response = await fetch(origin + '/api/command' + target, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args, requestId: crypto.randomUUID() }), signal: AbortSignal.timeout(30000) }); return { status: response.status, body: await response.json() } }
  const streams = []
  function events(target) {
    const controller = new AbortController(), values = []
    const pending = fetch(origin + '/api/events' + target, { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal }).then(async response => { assert.equal(response.status, 200); const reader = response.body.getReader(); let buffer = ''; while (true) { const part = await reader.read(); if (part.done) return; buffer += Buffer.from(part.value).toString(); let index; while ((index = buffer.indexOf('\n\n')) >= 0) { const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2); for (const line of frame.split('\n')) if (line.startsWith('data: ')) values.push(JSON.parse(line.slice(6))) } } }).catch(error => { if (!controller.signal.aborted) throw error })
    streams.push({ controller, pending }); return values
  }
  try {
    run(['network', 'create', '--internal', '--label', 'org.ziaforge.run=' + manifest.id, network])
    const packaged = JSON.parse(fs.readFileSync(path.join(manifest.package, 'result.json'), 'utf8'))
    const deb = path.join(manifest.package, packaged.deb)
    for (const role of ['a', 'b']) {
      const name = network + '-' + role; containers.push(name)
      run(['run', '-d', '--name', name, '--label', 'org.ziaforge.run=' + manifest.id, '--network', network, '--network-alias', 'ziaf-' + role, '--security-opt', 'seccomp=' + path.join(project, 'scripts/linux/seccomp.json'), '--shm-size', '256m', '--cpus', '2', '--memory', '2g', '--pids-limit', '512', '-p', '127.0.0.1::43111', '-v', manifest.volume + ':/build:ro', manifest.imageId])
      run(['cp', deb, name + ':/tmp/ziaforge.deb'])
      run(['exec', '-u', 'root', name, 'dpkg', '-i', '/tmp/ziaforge.deb'])
      const installed = run(['exec', name, 'dpkg-query', '-W', '-f=${Package} ${Version} ${Architecture}', 'ziaforge'])
      const expected = JSON.parse(fs.readFileSync(path.join(manifest.package, 'build-identity.json'), 'utf8'))
      check('installed .deb ' + role, installed === 'ziaforge ' + expected.version + ' amd64')
      const fd = fs.openSync(path.join(smokeDir, role + '-worker.log'), 'wx')
      const worker = spawn(docker, ['exec', '-w', '/evidence', name, 'dbus-run-session', '--', 'node', '/build/source/scripts/linux/session-worker.cjs', role], { stdio: ['ignore', fd, fd] })
      worker.once('close', () => fs.closeSync(fd)); workers.push(worker)
      await poll(() => { const ready = spawnSync(docker, ['exec', name, 'cat', '/evidence/ready.json'], { encoding: 'utf8', timeout: 5000 }); return ready.status === 0 && JSON.parse(ready.stdout).ready }, 'Ubuntu ' + role + ' desktop', 60000)
    }
    ;[a, b] = containers
    local = await request(a, { type: 'configure', scope: 'operate' }); remote = await request(b, { type: 'configure', scope: 'read' })
    origin = 'http://' + run(['port', a, '43111/tcp']); token = local.accessToken
    check('unauthenticated denied', (await fetch(origin + '/api/command', { method: 'POST', body: '{"method":"system.summary"}' })).status === 401)
    check('wrong token denied', (await fetch(origin + '/api/command', { method: 'POST', headers: { Authorization: 'Bearer not-the-owner-token' }, body: '{"method":"system.summary"}' })).status === 401)
    first = await request(a, { type: 'seed' })
    await request(a, { type: 'configure', scope: 'operate', instances: [{ id: 'second', name: 'Ubuntu B', url: 'http://ziaf-b:43111', token: remote.accessToken }] })
    check('independent task stores', (await call('system.summary')).body.result.tasks.length === 1 && (await call('system.summary', [], '?instance=second')).body.result.tasks.length === 0)
    check('read target rejects mutation', (await call('createWorkspaceFolder', ['Refused'], '?instance=second')).body.ok === false)
    check('remote cannot grant native permissions', (await call('control.configure', [{ nativeComputer: true }], '?instance=second')).body.ok === false)
    check('native command not granted', (await call('computer.run', [{ command: '/usr/bin/true' }])).body.ok === false)
    const safe = await call('control.status')
    check('tokens redacted', !JSON.stringify(safe).includes(token) && !JSON.stringify(safe).includes(remote.accessToken))
    await request(b, { type: 'configure', scope: 'operate' })
    const ownEvents = events(''), remoteEvents = events('?instance=second')
    const folder = await call('createWorkspaceFolder', ['Remote B'], '?instance=second'); check('remote operate creates own workspace', folder.body.ok && folder.body.result.success)
    const created = await call('createTask', [{ name: 'Linux instance B', description: '', repoId: 'work-folder', branchType: 'Folder', branchName: 'Remote B', model: 'Linux fixture', workflow: 'Draft & Document' }], '?instance=second')
    check('remote operate creates task', created.body.ok)
    const taskB = created.body.result
    const started = await call('agentSessions.create', [{ taskId: taskB.id, chatId: 'chat-main', presetName: 'Linux fixture' }], '?instance=second'); check('remote fixture session created', started.body.ok)
    const ref = { sessionId: started.body.result.sessionId, runId: started.body.result.runId }
    const accepted = await call('agentSessions.send', [{ ...ref, clientMessageId: 'linux-remote-one', text: 'fixture-hello' }], '?instance=second'); check('remote fixture send accepted', accepted.body.ok)
    const complete = await poll(async () => { const read = await call('agentSessions.snapshot', [ref], '?instance=second'); return read.body.result?.lastTurn?.status === 'completed' ? read.body.result : null }, 'remote actual completion')
    await poll(() => remoteEvents.some(event => event.channel === 'agent-session:update' && event.data?.snapshot?.taskId === taskB.id), 'remote SSE event')
    check('remote event isolation', !ownEvents.some(event => event.data?.snapshot?.taskId === taskB.id) && !remoteEvents.some(event => event.data?.snapshot?.taskId === first.task.id))
    write(path.join(smokeDir, 'event-summary.json'), { ownChannels: ownEvents.map(e => e.channel), remoteChannels: remoteEvents.map(e => e.channel), remoteTaskId: taskB.id })
    second = await request(b, { type: 'show', taskId: taskB.id, draft: 'Unsent Ubuntu B draft — independent' })
    check('remote history delivered to correct instance', complete.feed.some(message => message.role === 'assistant') && second.snapshot.sessionId === ref.sessionId)
    const image = await call('system.screenshot', [], '?instance=second'); check('remote real desktop screenshot', image.body.result?.dataUrl?.startsWith('data:image/png;base64,')); fs.writeFileSync(path.join(smokeDir, 'remote-desktop-b.png'), Buffer.from(image.body.result.dataUrl.split(',')[1], 'base64'))
    for (const stream of streams) stream.controller.abort(); await Promise.allSettled(streams.map(s => s.pending))
    receipts.aRestart = await request(a, { type: 'restart', taskId: first.task.id, draft: first.draft })
    check('B survives A normal Quit/restart', (await request(b, { type: 'observe' })).tasks[0].id === taskB.id)
    receipts.bRestart = await request(b, { type: 'restart', taskId: taskB.id, draft: second.draft })
    check('A and B retain separated histories', receipts.aRestart.sessionId !== receipts.bRestart.sessionId)
    result.status = 'passed'
  } catch (error) { result.status = 'failed'; result.error = error.stack }
  finally {
    for (const stream of streams) stream.controller.abort()
    for (const container of containers) {
      try { await request(container, { type: 'quit' }); await poll(() => { const out = spawnSync(docker, ['exec', container, 'cat', '/evidence/result.json'], { encoding: 'utf8', timeout: 5000 }); if (out.status !== 0) return null; const receipt = JSON.parse(out.stdout); receipts[container] = receipt; return receipt }, 'normal Quit receipt', 45000) }
      catch (error) { result.status = 'failed'; (result.cleanupErrors ||= []).push(error.message) }
      const receipt = receipts[container]; if (!receipt || receipt.status !== 'passed') result.status = 'failed'
      try {
        const retained = path.join(smokeDir, container.endsWith('-a') ? 'a' : 'b'); fs.mkdirSync(retained)
        for (const name of ['result.json', '01-desktop-history.png', '02-remote-history.png', '03-restarted-history.png']) { const probe = spawnSync(docker, ['exec', container, 'test', '-f', '/evidence/' + name]); if (probe.status === 0) run(['cp', container + ':/evidence/' + name, path.join(retained, name)]) }
        ownedResource('container', container, manifest.id); run(['stop', '-t', '10', container]); run(['rm', container])
      } catch (error) { result.status = 'failed'; (result.cleanupErrors ||= []).push(error.message) }
    }
    try { ownedResource('network', network, manifest.id); run(['network', 'rm', network]) } catch (error) { result.status = 'failed'; (result.cleanupErrors ||= []).push(error.message) }
    result.receipts = receipts; result.finishedAt = new Date().toISOString(); result.sourceAtFinish = identity()
    result.sourceChanged = JSON.stringify(result.sourceAtFinish) !== JSON.stringify(manifest.source)
    result.interrupted = interrupted
    if (result.sourceChanged || interrupted) result.status = 'failed'
    save(); console.log(JSON.stringify({ status: result.status, receipt: path.join(smokeDir, 'result.json') })); if (result.status !== 'passed') process.exitCode = 1
  }
}
async function main() {
  if (operation === 'prepare') return prepare()
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  if (operation === 'package') return packageBuild(manifest)
  if (operation === 'smoke') return smoke(manifest)
  ownedResource('container', manifest.builder, manifest.id); run(['stop', '-t', '10', manifest.builder]); run(['rm', manifest.builder])
  ownedResource('volume', manifest.volume, manifest.id); run(['volume', 'rm', manifest.volume]); manifest.cleanedAt = new Date().toISOString(); write(manifestFile, manifest)
}
main().catch(error => { console.error(error.stack); process.exitCode = 1 })
