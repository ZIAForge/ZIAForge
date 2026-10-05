// One target per invocation. Official versions come from the retained owner ledger.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { project, identity, buildIdentity, environment } = require('../qa/common.cjs')
const { sha256, bundleInventory } = require('../mac/package-utils.cjs')
const { collectNotices } = require('../mac/dependency-notices.cjs')
const { assertArchitecture } = require('./binary-architecture.cjs')
const sourceManifest = require('./source-manifest.cjs')
const matrix = { darwin: ['dmg', 'zip'], win32: ['nsis', 'zip'], linux: ['deb', 'rpm', 'AppImage', 'tar.gz', 'zip'] }
function options(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (['--ci-verify', '--build-only', '--help'].includes(key)) out[key.slice(2)] = true
    else if (['--platform', '--arch', '--formats', '--identity', '--output', '--source-manifest'].includes(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) out[key.slice(2)] = argv[++i]
    else throw new Error(`Unknown or incomplete option: ${key}`)
  }
  return out
}
function targetOptions(input) {
  const platform = input.platform || process.platform, arch = input.arch || process.arch
  if (!matrix[platform] || !['x64', 'arm64'].includes(arch)) throw new Error('Supported targets: darwin, win32, linux; x64 or arm64')
  const formats = input.formats ? input.formats.split(',') : matrix[platform]
  if (!formats.length || new Set(formats).size !== formats.length || formats.some(value => !matrix[platform].includes(value))) throw new Error('Unsupported or duplicate target format')
  if (platform === 'darwin' && process.platform !== 'darwin') throw new Error('macOS packages require a macOS build host')
  if (platform === 'linux' && (process.platform !== 'linux' || process.arch !== arch)) throw new Error('Linux native modules require the target Linux architecture; use a matching native/emulated container')
  return { platform, arch, formats }
}
async function main(argv) {
  const input = options(argv)
  if (input.help) {
    console.log('Usage: node scripts/platform/package.cjs --platform darwin|win32|linux --arch x64|arm64 [--formats comma,list] [--build-only] (--identity RESERVED.json --output NEW_DIRECTORY [--source-manifest SOURCE.json] | --ci-verify)\nNo reservation, signing, publishing or overwrite. Official identity must be allocated by the single retained release ledger. CI outputs are verification-only. --build-only compiles and checks package integrity without executing the packaged app/native PTY; this is explicitly recorded as not run. GUI and provider checks are separate.')
    return
  }
  const target = targetOptions(input), native = process.platform === target.platform && process.arch === target.arch
  if (input['ci-verify'] && (input.identity || input.output)) throw new Error('CI verification cannot consume an official identity/output')
  if (!input['ci-verify'] && (!input.identity || !input.output)) throw new Error('Official build needs owner-reserved identity and a new output directory')
  const portable = input['source-manifest'] ? JSON.parse(fs.readFileSync(path.resolve(input['source-manifest']), 'utf8')) : sourceManifest.snapshot(project)
  const verifiedSource = sourceManifest.verify(project, portable)
  const localSource = identity()
  const stamp = new Date().toISOString().replace(/[-:.]/g, '')
  const manifest = input['ci-verify'] ? {
    schemaVersion: 1, version: JSON.parse(fs.readFileSync(path.join(project, 'package.json'))).version,
    buildId: `${JSON.parse(fs.readFileSync(path.join(project, 'package.json'))).version}-ci.${portable.commit.slice(0, 8)}.${stamp}.${crypto.randomBytes(4).toString('hex')}`,
    distribution: 'ci-verification-only', source: localSource.commit ? localSource : { commit: portable.commit, dirty: false, workingTreeSha256: portable.digest, description: 'Verified portable source manifest digest; no local Git checkout.' },
  } : JSON.parse(fs.readFileSync(path.resolve(input.identity), 'utf8'))
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version) || !/^[A-Za-z0-9._-]+$/.test(manifest.buildId) || manifest.source?.commit !== portable.commit || manifest.source?.dirty !== false) throw new Error('Invalid or mismatched frozen build identity')
  if (manifest.sourcePortableSha256 && manifest.sourcePortableSha256 !== portable.digest) throw new Error('Portable source does not match reserved identity')
  if (localSource.commit && (localSource.commit !== portable.commit || localSource.dirty)) throw new Error('Working checkout must remain clean at the reserved source commit')
  if (manifest.platform && manifest.platform !== target.platform) throw new Error('Reserved identity belongs to another platform')
  if (manifest.arch && manifest.arch !== target.arch) throw new Error('Reserved identity belongs to another architecture')
  const stable = manifest.distribution === 'stable-release'
  if (stable && (manifest.mode !== 'release' || !manifest.releaseId || !manifest.reservationId || !manifest.attemptId || !manifest.sourcePortableSha256
    || JSON.parse(fs.readFileSync(path.join(project, 'package.json'))).version !== manifest.version)) throw new Error('Stable package needs a release-family identity and matching committed application version')
  const nativeExecution = input['build-only'] ? 'not-run-build-only' : native ? 'pending' : 'unverified-cross-build'
  const base = path.join(project, 'release', 'platform-ci')
  if (input['ci-verify']) fs.mkdirSync(base, { recursive: true })
  const directory = input['ci-verify'] ? path.join(base, `${manifest.buildId}-${target.platform}-${target.arch}`) : path.resolve(input.output)
  // The caller cannot merge an attempt with any prior result, including a failure.
  fs.mkdirSync(directory, { mode: 0o700 })
  // Share the legacy Mac compiler lock: both entrypoints write dist in this checkout.
  const lock = path.join(project, 'release', 'macos', '.packaging-lock')
  fs.mkdirSync(path.dirname(lock), { recursive: true })
  try { fs.mkdirSync(lock, { mode: 0o700 }) } catch (error) {
    fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ status: 'failed', error: `Packaging lock unavailable: ${lock}`, cause: error.code }, null, 2) + '\n')
    throw error
  }
  const owner = crypto.randomUUID(); fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, owner, directory }), { flag: 'wx' })
  const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + '\n')
  const result = { schemaVersion: 1, status: 'building', ...target, nativeExecution, gui: 'unverified',
    verificationScope: input['build-only'] ? 'compile-and-package-integrity-only' : 'package-integrity-and-native-pty-when-host-matches',
    tests: { unit: 'not-run', e2e: 'not-run' }, providerExecution: 'not-run', checks: [] }
  const save = () => write('result.json', result)
  const env = { ...process.env, CI: 'true' }
  for (const key of Object.keys(env)) if (/^(CSC_|WIN_CSC_|APPLE_|APPLEID|ASC_|API_KEY|GH_TOKEN|GITHUB_TOKEN|BT_TOKEN)/.test(key)) delete env[key]
  env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'; delete env.ELECTRON_RUN_AS_NODE; delete env.VITE_DEV_SERVER_URL
  function command(name, exe, args, extra = {}) {
    const fd = fs.openSync(path.join(directory, name + '.log'), 'wx')
    const timeout = name === 'package' && stable ? 60 * 60 * 1000 : 20 * 60 * 1000
    const executed = spawnSync(exe, args, { cwd: project, env: { ...env, ...extra }, stdio: ['ignore', fd, fd], timeout })
    fs.closeSync(fd)
    result.checks.push({ name, command: [exe, ...args], timeoutMs: timeout, exitCode: executed.status, signal: executed.signal, error: executed.error?.message }); save()
    if (executed.status !== 0) throw new Error(`${name} failed; see retained log`)
  }
  let staging
  try {
    Object.assign(manifest, { ...target, platform: target.platform, arch: target.arch, signing: 'unsigned', notarization: false, portableSource: verifiedSource, builderEnvironment: environment(), nativeExecution, verificationScope: result.verificationScope })
    write('build-identity.json', manifest); write('source-manifest.json', portable); save()
    if (!native && target.platform === 'win32' && !['darwin', 'linux'].includes(process.platform)) throw new Error('Unsupported cross-build host')
    // Only the reviewed N-API package can bypass a target rebuild. Its locked
    // prebuilt binaries are structurally verified here, never called native proof.
    if (!native) {
      const pty = JSON.parse(fs.readFileSync(path.join(project, 'node_modules/node-pty/package.json')))
      if (pty.version !== '1.1.0') throw new Error('Cross-build prebuilt policy needs review for this node-pty version')
      const locked = JSON.parse(fs.readFileSync(path.join(project, 'package-lock.json')))
      function rejectUnknownNative(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          if (entry.name === 'node_modules') continue
          const file = path.join(directory, entry.name)
          if (entry.isDirectory()) rejectUnknownNative(file)
          else if (entry.name.endsWith('.node')) throw new Error(`New native runtime dependency needs a cross-build policy: ${file}`)
        }
      }
      for (const [name, entry] of Object.entries(locked.packages)) if (name && !entry.dev && !entry.devOptional && name !== 'node_modules/node-pty') rejectUnknownNative(path.join(project, name))
      const prebuilt = path.join(project, 'node_modules/node-pty/prebuilds', `${target.platform}-${target.arch}`)
      const names = target.platform === 'win32' ? ['conpty.node', 'conpty_console_list.node'] : ['pty.node', 'spawn-helper']
      write('prebuilt-native-inputs.json', names.map(name => ({ name, sha256: sha256(path.join(prebuilt, name)), ...assertArchitecture(path.join(prebuilt, name), target.platform, target.arch) })))
    }
    command('help-consistency', process.execPath, ['scripts/help/generate.cjs', '--check'])
    command('locale-consistency', process.execPath, ['scripts/locales/check.cjs'])
    command('typescript', process.execPath, ['node_modules/typescript/bin/tsc'])
    command('compile', process.execPath, ['node_modules/vite/bin/vite.js', 'build'])
    manifest.compiled = buildIdentity(); write('build-identity.json', manifest)
    const notices = collectNotices(project); write('dependency-inventory.json', notices.inventory)
    fs.writeFileSync(path.join(directory, 'THIRD_PARTY_NOTICES.txt'), notices.text)
    staging = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaforge-platform-')))
    const artifacts = path.join(staging, 'artifacts'), tmp = path.join(staging, 'tmp'); fs.mkdirSync(tmp)
    if (target.platform === 'win32' && !native) {
      // Resource editing needs Wine, not its optional Gecko/.NET installers or
      // the contributor's existing Wine profile. Standard HOME is unchanged.
      env.WINEPREFIX = path.join(staging, 'wine-prefix')
      env.WINEDLLOVERRIDES = 'mscoree,mshtml='
    }
    result.staging = { directory: staging, retained: true }; save()
    const extraResources = ['scripts/ziaf.cjs', 'scripts/ziaforge-mcp.cjs', 'docs/AGENT_CONTROL.md', 'docs/USER_GUIDE.md', 'LICENSE'].map(file => ({ from: path.join(project, file), to: path.basename(file) }))
    for (const file of ['build-identity.json', 'dependency-inventory.json', 'THIRD_PARTY_NOTICES.txt']) extraResources.push({ from: path.join(directory, file), to: file })
    extraResources.push({ from: path.join(project, 'node_modules/electron/dist/LICENSE'), to: 'ELECTRON_LICENSE.txt' }, { from: path.join(project, 'node_modules/electron/dist/LICENSES.chromium.html'), to: 'LICENSES.chromium.html' })
    const artifactVersion = stable ? manifest.version : manifest.buildId
    const config = { extends: path.join(project, 'electron-builder.json5'), directories: { output: artifacts }, extraMetadata: { version: manifest.version, homepage: 'https://ziaforge.studio/', desktopName: 'ziaforge.desktop' },
      buildVersion: manifest.version, asarUnpack: ['node_modules/node-pty/**/*'], npmRebuild: native, extraResources, forceCodeSigning: false,
      artifactName: `ZIAForge-${artifactVersion}-${target.platform}-${target.arch}.` + '${ext}',
      mac: { identity: null, notarize: false, hardenedRuntime: false, target: target.formats, artifactName: `ZIAForge-${artifactVersion}-macOS-${target.arch}.` + '${ext}',
        extendInfo: { ZIAForgeBuildId: manifest.buildId, ZIAForgeSourceCommit: manifest.source.commit, ZIAForgeSourceSHA256: manifest.source.workingTreeSha256 } },
      dmg: { sign: false },
      win: { target: target.formats, icon: 'build/icon.png', artifactName: `ZIAForge-${artifactVersion}-Windows-${target.arch}.` + '${ext}' },
      linux: { target: target.formats, artifactName: `ZIAForge-${artifactVersion}-Linux-${target.arch}.` + '${ext}', syncDesktopName: true },
    }
    // Stable delivery favors bounded native packaging over maximum compression.
    // Payloads, native rebuilds and all integrity checks are unchanged.
    if (stable) {
      if (env.ELECTRON_BUILDER_COMPRESSION_LEVEL !== undefined) throw new Error('Stable compression must not be overridden through the environment')
      config.compression = 'store'
      if (target.platform === 'linux') { config.deb = { compression: 'gz' }; config.rpm = { compression: 'gzip' } }
    }
    // The other platform sections are not targets; avoid feeding their format list
    // into schema validation for this invocation.
    for (const [name, platform] of [['mac', 'darwin'], ['win', 'win32'], ['linux', 'linux']]) if (platform !== target.platform) delete config[name]
    if (target.platform === 'darwin') config.afterPack = path.join(project, 'scripts/mac/after-pack.cjs')
    const configFile = path.join(staging, 'builder-config.json'); fs.writeFileSync(configFile, JSON.stringify(config, null, 2)); write('builder-config.json', config)
    command('package', process.execPath, ['node_modules/electron-builder/cli.js', '--' + ({ darwin: 'mac', win32: 'win', linux: 'linux' })[target.platform], ...target.formats, '--' + target.arch, '--publish', 'never', '--config', configFile], { TMPDIR: tmp, TMP: tmp, TEMP: tmp })
    const relativeApp = target.platform === 'darwin' ? path.join(target.arch === 'arm64' ? 'mac-arm64' : 'mac', 'ZIAForge.app') : (target.platform === 'win32' ? `win${target.arch === 'arm64' ? '-arm64' : ''}-unpacked` : `linux${target.arch === 'arm64' ? '-arm64' : ''}-unpacked`)
    const stagedApp = path.join(artifacts, relativeApp)
    const resources = path.join(stagedApp, ...(target.platform === 'darwin' ? ['Contents', 'Resources'] : ['resources']))
    const exe = target.platform === 'darwin' ? path.join(stagedApp, 'Contents/MacOS/ZIAForge') : path.join(stagedApp, target.platform === 'win32' ? 'ZIAForge.exe' : 'ziaforge')
    const asar = require('@electron/asar'), embedded = JSON.parse(asar.extractFile(path.join(resources, 'app.asar'), 'package.json'))
    if (embedded.version !== manifest.version) throw new Error('ASAR application version differs from reserved version')
    result.binary = assertArchitecture(exe, target.platform, target.arch)
    const nativeFiles = [], unpacked = path.join(resources, 'app.asar.unpacked/node_modules/node-pty')
    for (const name of target.platform === 'win32' ? ['conpty.node', 'conpty_console_list.node'] : ['pty.node']) {
      const candidates = [path.join(unpacked, 'build/Release', name), path.join(unpacked, 'prebuilds', `${target.platform}-${target.arch}`, name)]
      const match = candidates.find(file => { try { assertArchitecture(file, target.platform, target.arch); return true } catch { return false } })
      if (!match) throw new Error(`No matching native binary in packaged app: ${name}`)
      nativeFiles.push({ path: path.relative(stagedApp, match), sha256: sha256(match), ...assertArchitecture(match, target.platform, target.arch) })
    }
    write('native-binary-inventory.json', nativeFiles)
    if (input['build-only']) write('native-pty.json', { status: 'not-run', reason: 'Explicit build-only release scope; no packaged runtime or GUI was launched.', target, host: { platform: process.platform, arch: process.arch } })
    else if (native) {
      const cwd = path.join(staging, 'native-workspace'); fs.mkdirSync(cwd)
      command('native-pty', exe, [path.join(project, 'scripts/platform/native-smoke.cjs'), stagedApp, path.join(directory, 'native-pty.json'), cwd], { ELECTRON_RUN_AS_NODE: '1' })
      const proof = JSON.parse(fs.readFileSync(path.join(directory, 'native-pty.json')))
      if (proof.status !== 'passed' || proof.arch !== target.arch || proof.platform !== target.platform) throw new Error('Native packaged runtime did not pass')
      result.nativeExecution = 'passed'
    } else write('native-pty.json', { status: 'unverified', reason: 'Target OS/architecture differs from build host; native CI or target machine is required.', target, host: { platform: process.platform, arch: process.arch } })
    if (target.platform === 'darwin') {
      command('bundle-architecture', '/usr/bin/lipo', [exe, '-verify_arch', target.arch === 'x64' ? 'x86_64' : 'arm64'])
      for (const file of fs.readdirSync(artifacts).filter(f => f.endsWith('.dmg'))) command('dmg-verify', '/usr/bin/hdiutil', ['verify', path.join(artifacts, file)])
    }
    const inventory = bundleInventory(stagedApp); write('app-inventory.json', inventory)
    const retained = path.join(directory, 'artifacts'); fs.mkdirSync(retained)
    if (process.platform === 'darwin') command('retain-artifacts', '/usr/bin/ditto', [artifacts, retained])
    else fs.cpSync(artifacts, retained, { recursive: true, dereference: false, verbatimSymlinks: true })
    if (bundleInventory(path.join(retained, relativeApp)).digest !== inventory.digest || bundleInventory(artifacts).digest !== bundleInventory(retained).digest) throw new Error('Retained package differs from staging')
    const distributables = fs.readdirSync(retained).filter(name => fs.statSync(path.join(retained, name)).isFile() && !name.endsWith('.yml') && !name.endsWith('.yaml') && !name.endsWith('.blockmap'))
    const expectedSuffix = { nsis: '.exe', AppImage: '.AppImage', 'tar.gz': '.tar.gz', deb: '.deb', rpm: '.rpm', zip: '.zip', dmg: '.dmg' }
    for (const format of target.formats) if (distributables.filter(file => file.endsWith(expectedSuffix[format])).length !== 1) throw new Error(`Expected exactly one ${format} artifact`)
    fs.writeFileSync(path.join(directory, 'SHA256SUMS'), distributables.map(file => `${sha256(path.join(retained, file))}  artifacts/${file}`).join('\n') + '\n')
    sourceManifest.verify(project, portable)
    if (localSource.commit) { const after = identity(); if (after.commit !== localSource.commit || after.workingTreeSha256 !== localSource.workingTreeSha256) throw new Error('Source changed during package build') }
    Object.assign(result, { status: 'passed', version: manifest.version, buildId: manifest.buildId, releaseId: manifest.releaseId, sourceCommit: manifest.source.commit,
      app: path.join(retained, relativeApp), executable: path.join(retained, path.relative(artifacts, exe)), artifacts: distributables.map(file => ({ path: path.join(retained, file), sha256: sha256(path.join(retained, file)) })), sourceChanged: false, bundleInventorySha256: inventory.digest, compiled: manifest.compiled, distribution: manifest.distribution || 'development-delivery', signing: 'unsigned' })
  } catch (error) { result.status = 'failed'; result.error = error.stack; process.exitCode = 1 }
  finally {
    result.finishedAt = new Date().toISOString(); save()
    if (JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'))).owner !== owner) throw new Error('Packaging lock ownership changed')
    fs.unlinkSync(path.join(lock, 'owner.json')); fs.rmdirSync(lock)
  }
  console.log(JSON.stringify({ status: result.status, directory, app: result.app, nativeExecution: result.nativeExecution, gui: result.gui }))
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.stack); process.exitCode = 1 })
module.exports = { options, targetOptions }
