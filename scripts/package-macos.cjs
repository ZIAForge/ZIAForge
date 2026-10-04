const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { project, identity, buildIdentity, environment, writeJson } = require('./qa/common.cjs')
const { reserveOutput, sha256, bundleInventory, assertSourceUnchanged } = require('./mac/package-utils.cjs')
const { nextVersion, reserveVersion, acquirePackagingLock } = require('./mac/build-version.cjs')
const { collectNotices } = require('./mac/dependency-notices.cjs')
const { assertBundleIdentity } = require('./mac/bundle-identity.cjs')

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('Usage: npm run package:mac -- [--allow-dirty] [--dry-run] [--ci-verify]\nBuilds an unsigned macOS development .app and DMG for the current host architecture.\nEach delivery attempt permanently reserves the next patch version under release/macos/.versions. Failed attempts never reuse a number.\n--dry-run does not reserve a version. --ci-verify uses the source base version under release/macos-ci for testing only; never deliver those artifacts.\nNo signing credentials, notarization, publishing, installation or old-artifact replacement. A clean Git tree is required unless --allow-dirty is explicit.')
  process.exit(0)
}
if (args.some(arg => !['--allow-dirty', '--dry-run', '--ci-verify'].includes(arg))) throw new Error('Unknown option; use --help')
if (process.platform !== 'darwin' || !['x64', 'arm64'].includes(process.arch)) throw new Error('Run on the target macOS architecture (x64 or arm64); cross-building is not certified')
const source = identity()
if (!source.commit || !source.workingTreeSha256 || source.dirty === null) throw new Error('Git source provenance is unavailable')
if (source.dirty && !args.includes('--allow-dirty')) throw new Error('Source tree is dirty. Commit the reviewed source first, or explicitly use --allow-dirty for a development artifact.')
const baseVersion = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).version
const ciVerification = args.includes('--ci-verify')
const reservationBase = path.join(project, 'release', 'macos')
const outputBase = ciVerification ? path.join(project, 'release', 'macos-ci') : reservationBase
const stamp = new Date().toISOString().replace(/[-:.]/g, '')
if (args.includes('--dry-run')) {
  console.log(JSON.stringify({ status: 'dry-run', nextVersion: ciVerification ? baseVersion : nextVersion(reservationBase, baseVersion), versionReserved: false,
    arch: process.arch, source, outputBase, ciVerification, signing: 'unsigned', notarization: false, publish: 'never' }, null, 2))
  process.exit(0)
}
// The same lock protects CI verification and deliverable builds from shared dist races.
const releaseLock = acquirePackagingLock(reservationBase)
process.once('exit', () => { try { releaseLock() } catch (error) { console.error(error.message) } })
const reservation = ciVerification ? null : reserveVersion(reservationBase, baseVersion, { source, arch: process.arch })
const version = reservation?.version || baseVersion
const buildId = `${version}-${ciVerification ? 'ci' : 'dev'}.${source.commit.slice(0, 8)}.${source.workingTreeSha256.slice(0, 8)}.${stamp}`
const directory = reserveOutput(outputBase, buildId)
const artifacts = path.join(directory, 'artifacts')
const manifest = { schemaVersion: 1, buildId, version, mode: 'development', arch: process.arch,
  baseVersion, distribution: ciVerification ? 'ci-verification-only' : 'development-delivery', reservation,
  signing: 'unsigned', notarization: false, createdAt: new Date().toISOString(), source, environment: environment(),
  artifactPolicy: ciVerification ? 'CI validation only. Do not distribute as a release or user deliverable.'
    : 'Fresh immutable output and permanent version reservation; no automatic latest replacement; not a notarized public release.' }
const result = { schemaVersion: 1, status: 'building', buildId, checks: [], manifest: 'build-identity.json' }
const save = () => writeJson(path.join(directory, 'result.json'), result)
writeJson(path.join(directory, 'build-identity.json'), manifest)
save()
console.log(`macOS build artifacts: ${directory}`)

// Credentials are neither read nor forwarded to builder. This command is always unsigned.
const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false', CI: 'true' }
for (const key of Object.keys(env)) if (/^(CSC_|WIN_CSC_|APPLE_|APPLEID|ASC_|API_KEY|GH_TOKEN|GITHUB_TOKEN|BT_TOKEN)/.test(key)) delete env[key]
env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
delete env.ELECTRON_RUN_AS_NODE
delete env.VITE_DEV_SERVER_URL
let child
let interrupted = false
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  interrupted = true
  if (child) try { process.kill(-child.pid, signal) } catch { /* Child may already have exited. */ }
})
function execute(name, executable, parameters, overrideEnv = env) {
  if (interrupted) return Promise.reject(new Error('Packaging interrupted'))
  const check = { name, status: 'running', command: [executable, ...parameters], log: `${name}.log`, startedAt: new Date().toISOString() }
  result.checks.push(check); save()
  return new Promise((resolve, reject) => {
    const log = fs.createWriteStream(path.join(directory, check.log))
    child = spawn(executable, parameters, { cwd: project, env: overrideEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false })
    let spawnError
    child.once('error', error => { spawnError = error.message })
    child.once('close', (exitCode, signal) => {
      child = null; log.end()
      Object.assign(check, { exitCode, signal, finishedAt: new Date().toISOString(), status: exitCode === 0 && !interrupted ? 'passed' : 'failed' })
      if (spawnError) check.error = spawnError
      save()
      if (check.status === 'passed') resolve()
      else reject(new Error(`${name} failed; see ${check.log}`))
    })
  })
}

async function main() {
  // Renames and writes inside a synced folder can be replayed by another writer.
  // Keep the builder's mutable output local; preserve it on failure for diagnosis.
  const staging = fs.realpathSync(fs.mkdtempSync('/private/tmp/ziaforge-package-'))
  const stagedArtifacts = path.join(staging, 'artifacts')
  const stagedTemporary = path.join(staging, 'tmp')
  fs.mkdirSync(stagedTemporary, { mode: 0o700 })
  manifest.staging = { directory: staging, artifacts: stagedArtifacts, retained: true }
  result.staging = manifest.staging
  save()
  await execute('help-consistency', process.execPath, [path.join(project, 'scripts/help/generate.cjs'), '--check'])
  await execute('locale-consistency', process.execPath, [path.join(project, 'scripts/locales/check.cjs')])
  const notices = collectNotices(project)
  writeJson(path.join(directory, 'dependency-inventory.json'), notices.inventory)
  fs.writeFileSync(path.join(directory, 'THIRD_PARTY_NOTICES.txt'), notices.text, { flag: 'wx' })
  await execute('typescript', process.execPath, [path.join(project, 'node_modules/typescript/bin/tsc')])
  await execute('compile', process.execPath, [path.join(project, 'node_modules/vite/bin/vite.js'), 'build'])
  manifest.compiled = buildIdentity()
  if (!manifest.compiled.sha256) throw new Error('Compilation produced no files')
  assertSourceUnchanged(source, identity())
  writeJson(path.join(directory, 'build-identity.json'), manifest)
  const config = {
    extends: path.join(project, 'electron-builder.json5'), directories: { output: stagedArtifacts },
    extraMetadata: { version }, buildVersion: version,
    asarUnpack: ['node_modules/node-pty/**/*'], afterPack: path.join(project, 'scripts/mac/after-pack.cjs'),
    extraResources: [
      { from: path.join(project, 'scripts/ziaf.cjs'), to: 'ziaf.cjs' },
      { from: path.join(project, 'scripts/ziaforge-mcp.cjs'), to: 'ziaforge-mcp.cjs' },
      { from: path.join(project, 'docs/AGENT_CONTROL.md'), to: 'AGENT_CONTROL.md' },
      { from: path.join(project, 'docs/USER_GUIDE.md'), to: 'USER_GUIDE.md' },
      { from: path.join(directory, 'build-identity.json'), to: 'build-identity.json' },
      { from: path.join(project, 'LICENSE'), to: 'LICENSE' },
      { from: path.join(directory, 'THIRD_PARTY_NOTICES.txt'), to: 'THIRD_PARTY_NOTICES.txt' },
      { from: path.join(directory, 'dependency-inventory.json'), to: 'dependency-inventory.json' },
      { from: path.join(project, 'node_modules/electron/dist/LICENSE'), to: 'ELECTRON_LICENSE.txt' },
      { from: path.join(project, 'node_modules/electron/dist/LICENSES.chromium.html'), to: 'LICENSES.chromium.html' },
    ],
    mac: { identity: null, notarize: false, hardenedRuntime: false,
      artifactName: `ZIAForge-${buildId}-macOS-${process.arch}.dmg`,
      extendInfo: { ZIAForgeBuildId: buildId, ZIAForgeSourceCommit: source.commit, ZIAForgeSourceSHA256: source.workingTreeSha256 } },
    dmg: { sign: false },
  }
  writeJson(path.join(directory, 'builder-config.json'), config)
  const stagedConfig = path.join(staging, 'builder-config.json')
  writeJson(stagedConfig, config)
  await execute('package', process.execPath, [path.join(project, 'node_modules/electron-builder/cli.js'), '--mac', 'dmg', `--${process.arch}`, '--publish', 'never', '--config', stagedConfig], { ...env, TMPDIR: stagedTemporary })
  const appRelative = path.join(process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'ZIAForge.app')
  const stagedApp = path.join(stagedArtifacts, appRelative)
  const expected = { productName: 'ZIAForge', appId: 'org.ziaforge.desktop', version, buildId, source,
    iconSha256: sha256(path.join(project, 'build/icon.icns')) }
  const stagedIdentity = assertBundleIdentity(stagedApp, expected)
  const afterPackIdentity = JSON.parse(fs.readFileSync(path.join(path.dirname(stagedApp), 'after-pack-identity.json'), 'utf8'))
  if (JSON.stringify(afterPackIdentity) !== JSON.stringify(stagedIdentity)) throw new Error('Bundle identity changed after afterPack')
  writeJson(path.join(directory, 'staged-bundle-identity.json'), stagedIdentity)
  result.appVersions = { reserved: version, package: stagedIdentity.packageVersion,
    short: stagedIdentity.fields.CFBundleShortVersionString, bundle: stagedIdentity.fields.CFBundleVersion }
  const stagedExecutable = path.join(stagedApp, 'Contents', 'MacOS', 'ZIAForge')
  const nativeCwd = path.join(directory, 'native-smoke-workspace')
  fs.mkdirSync(nativeCwd)
  await execute('native-pty', stagedExecutable, [path.join(project, 'scripts/mac/native-smoke.cjs'), stagedApp, path.join(directory, 'native-pty.json'), nativeCwd], { ...env, ELECTRON_RUN_AS_NODE: '1' })
  const native = JSON.parse(fs.readFileSync(path.join(directory, 'native-pty.json'), 'utf8'))
  if (native.status !== 'passed' || native.arch !== process.arch) throw new Error('Packaged native PTY verification failed')
  await execute('bundle-metadata', '/usr/bin/plutil', ['-lint', path.join(stagedApp, 'Contents', 'Info.plist')])
  await execute('bundle-architecture', '/usr/bin/lipo', [stagedExecutable, '-verify_arch', process.arch === 'x64' ? 'x86_64' : 'arm64'])
  const dmgFiles = fs.readdirSync(stagedArtifacts).filter(name => name.endsWith('.dmg'))
  if (dmgFiles.length !== 1) throw new Error('Expected exactly one freshly built DMG')
  await execute('dmg-verify', '/usr/bin/hdiutil', ['verify', path.join(stagedArtifacts, dmgFiles[0])])
  const stagedInventory = bundleInventory(stagedApp)
  const stagedArtifactsInventory = bundleInventory(stagedArtifacts)
  writeJson(path.join(directory, 'staged-app-inventory.json'), stagedInventory)
  writeJson(path.join(directory, 'staged-artifacts-inventory.json'), stagedArtifactsInventory)
  // Allocate an empty destination exclusively; never merge into earlier artifacts.
  fs.mkdirSync(artifacts, { mode: 0o700 })
  await execute('retain-artifacts', '/usr/bin/ditto', [stagedArtifacts, artifacts])
  const app = path.join(artifacts, appRelative)
  const dmg = path.join(artifacts, dmgFiles[0])
  const inventory = bundleInventory(app)
  const retainedArtifactsInventory = bundleInventory(artifacts)
  if (inventory.digest !== stagedInventory.digest || retainedArtifactsInventory.digest !== stagedArtifactsInventory.digest ||
      bundleInventory(stagedArtifacts).digest !== stagedArtifactsInventory.digest) throw new Error('Retained artifacts differ from the verified local staging output')
  const retainedIdentity = assertBundleIdentity(app, expected)
  if (JSON.stringify(retainedIdentity) !== JSON.stringify(stagedIdentity)) throw new Error('Retained bundle identity differs from local staging')
  writeJson(path.join(directory, 'retained-bundle-identity.json'), retainedIdentity)
  writeJson(path.join(directory, 'artifact-retention.json'), { verified: true, stagedArtifacts, artifacts,
    appDigest: inventory.digest, artifactsDigest: retainedArtifactsInventory.digest, checkedAt: new Date().toISOString() })
  result.sourceAtFinish = identity()
  assertSourceUnchanged(source, result.sourceAtFinish)
  writeJson(path.join(directory, 'app-inventory.json'), inventory)
  fs.writeFileSync(path.join(directory, 'SHA256SUMS'), [
    `${sha256(dmg)}  ${path.relative(directory, dmg)}`,
    `${sha256(path.join(directory, 'build-identity.json'))}  build-identity.json`,
    `${sha256(path.join(directory, 'app-inventory.json'))}  app-inventory.json`,
  ].join('\n') + '\n', { flag: 'wx' })
  Object.assign(result, { status: 'passed', finishedAt: new Date().toISOString(), app, dmg,
    bundleInventorySha256: inventory.digest, sourceChangedDuringRun: false,
    gui: 'unverified: perform separate packaged-app smoke before delivery', signing: 'unsigned', notarization: false })
  save()
  releaseLock()
  console.log(JSON.stringify({ status: result.status, app, dmg, manifest: path.join(directory, 'build-identity.json'), checksums: path.join(directory, 'SHA256SUMS'), gui: result.gui }, null, 2))
}
main().catch(error => {
  Object.assign(result, { status: 'failed', error: error.message, finishedAt: new Date().toISOString(), sourceAtFinish: identity() })
  save(); console.error(`${error.message}\nEvidence: ${directory}`); process.exitCode = 1
  releaseLock()
})
