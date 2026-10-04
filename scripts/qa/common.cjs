const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const project = path.resolve(__dirname, '../..')

function git(args) {
  const result = spawnSync('git', ['--no-optional-locks', ...args], {
    cwd: project, encoding: 'utf8', timeout: 15_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  })
  return result.status === 0 ? result.stdout : null
}

function identity() {
  const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
  const status = git(['status', '--porcelain=v1', '--untracked-files=all'])
  const hash = crypto.createHash('sha256')
  const names = [...new Set((files || '').split('\0').filter(Boolean))].sort()
  for (const name of names) {
    hash.update(name + '\0')
    try {
      const filename = path.join(project, name)
      const stat = fs.lstatSync(filename)
      hash.update(String(stat.mode) + '\0')
      if (stat.isSymbolicLink()) hash.update('symlink\0' + fs.readlinkSync(filename))
      else if (stat.isFile()) hash.update(fs.readFileSync(filename))
      else hash.update('directory')
    } catch (error) {
      hash.update(`unavailable:${error.code}`)
    }
    hash.update('\0')
  }
  return {
    commit: git(['rev-parse', 'HEAD'])?.trim() || null,
    branch: git(['branch', '--show-current'])?.trim() || null,
    dirty: status === null ? null : Boolean(status.trim()),
    workingTreeSha256: files === null ? null : hash.digest('hex'),
    fileCount: names.length,
    description: 'SHA256 of sorted tracked and non-ignored untracked paths, modes and contents; ignored build artifacts excluded.',
  }
}

function packageVersion(name) {
  try { return JSON.parse(fs.readFileSync(path.join(project, 'node_modules', name, 'package.json'), 'utf8')).version }
  catch { return null }
}

function versions() {
  return {
    node: process.version,
    npm: process.env.npm_config_user_agent?.match(/(?:^|\s)npm\/([^\s]+)/)?.[1] || null,
    package: JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).version,
    electron: packageVersion('electron'),
    playwright: packageVersion('@playwright/test'),
    typescript: packageVersion('typescript'),
    vitest: packageVersion('vitest'),
    nodePty: packageVersion('node-pty'),
  }
}

function environment() {
  return { platform: process.platform, arch: process.arch, osRelease: os.release(), versions: versions() }
}

function buildIdentity() {
  const hash = crypto.createHash('sha256')
  let fileCount = 0
  function visit(relative) {
    const filename = path.join(project, relative)
    if (!fs.existsSync(filename)) return
    const stat = fs.lstatSync(filename)
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(filename).sort()) visit(path.join(relative, child))
    } else if (stat.isFile()) {
      hash.update(relative + '\0').update(fs.readFileSync(filename)).update('\0')
      fileCount++
    }
  }
  for (const directory of ['dist', 'dist-electron']) visit(directory)
  return {
    sha256: fileCount ? hash.digest('hex') : null, fileCount,
    provenance: 'Hash of existing compiled files; no assumption that a prior build matches the current source tree.',
  }
}

function writeJson(filename, value) {
  const temporary = filename + '.tmp'
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(temporary, filename)
}

function createRun(command, mode) {
  const base = path.join(project, 'test-results', 'qa')
  fs.mkdirSync(base, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const directory = fs.mkdtempSync(path.join(base, `${stamp}-${command}-`))
  const manifest = {
    schemaVersion: 1, command, mode, createdAt: new Date().toISOString(),
    project, directory, source: identity(), build: buildIdentity(), environment: environment(),
    providerExecution: mode === 'live' ? 'explicit-live' : 'no-live-provider-requested',
  }
  writeJson(path.join(directory, 'manifest.json'), manifest)
  return { directory, manifest }
}

function executable(name) {
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : ['']
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    if (!directory) continue
    for (const extension of extensions) {
      const filename = path.join(directory, name + extension.toLowerCase())
      try {
        fs.accessSync(filename, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK)
        if (fs.statSync(filename).isFile()) return filename
      } catch { /* Try the next PATH entry. */ }
    }
  }
  return null
}

module.exports = { project, identity, buildIdentity, versions, environment, writeJson, createRun, executable }
