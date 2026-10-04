// Read-only diagnostics. No profile writes, login, model calls or network probes.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { project, identity, environment, executable } = require('./common.cjs')
const { inspectHelpers } = require('../fix-node-pty-helper.cjs')

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log('Usage: npm run qa:doctor -- [--cli]\nRead-only JSON diagnostics; --cli also invokes installed providers with --version only.')
} else if (args.some(argument => argument !== '--cli')) {
  console.error('Unknown option. Use --help.')
  process.exitCode = 2
} else {
  let electronBinary = null
  try { electronBinary = require(path.join(project, 'node_modules/electron')) } catch { /* Dependencies may be absent. */ }
  let nativePtyHelpers
  try { nativePtyHelpers = inspectHelpers(project) }
  catch (error) { nativePtyHelpers = { error: error.message, applicableExecutable: false } }
  const result = {
    schemaVersion: 1, command: 'qa:doctor', mode: 'diagnostic', readOnly: true,
    createdAt: new Date().toISOString(), source: identity(), environment: environment(),
    dependencies: {
      electronBinaryPresent: Boolean(electronBinary && fs.existsSync(electronBinary)),
      playwrightPresent: fs.existsSync(path.join(project, 'node_modules/@playwright/test/package.json')),
      nativePtyPackagePresent: fs.existsSync(path.join(project, 'node_modules/node-pty/package.json')),
      nativePtyHelpers,
      nativePtyRuntime: 'unverified: package presence does not prove Electron ABI compatibility',
    },
    build: Object.fromEntries(['dist/index.html', 'dist-electron/main.js', 'dist-electron/preload.mjs']
      .map(filename => [filename, fs.existsSync(path.join(project, filename))])),
    gui: {
      supportedFixturePlatform: ['darwin', 'linux'].includes(process.platform),
      displayHint: process.platform === 'darwin' ? 'macOS: window launch still needs verification'
        : process.env.DISPLAY || process.env.WAYLAND_DISPLAY ? 'display environment is set' : 'no display environment detected',
      launch: 'unverified: doctor does not launch Electron',
    },
    providers: {},
  }
  for (const name of ['codex', 'claude', 'agy']) {
    const binary = executable(name)
    const provider = { foundOnPath: Boolean(binary), version: null, checked: false }
    if (args.includes('--cli') && binary) {
      const probe = spawnSync(binary, ['--version'], { cwd: project, encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024 })
      // Keep just the version, never arbitrary startup output or environment.
      provider.version = (probe.stdout || '').match(/\b\d+\.\d+\.\d+(?:[-+][\w.-]+)?\b/)?.[0] || null
      provider.checked = true
      provider.exitCode = probe.status
      provider.error = probe.error?.code || null
    }
    result.providers[name] = provider
  }
  result.providerAuthentication = 'not inspected'
  result.status = result.dependencies.electronBinaryPresent && result.dependencies.playwrightPresent ? 'ready-for-checks' : 'missing-dependencies'
  if (result.status === 'ready-for-checks' && process.platform === 'darwin' && !nativePtyHelpers.applicableExecutable) result.status = 'native-helper-unavailable'
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.status === 'ready-for-checks' ? 0 : 1
}
