const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { architectures, assertArchitecture } = require('../binary-architecture.cjs')
const { snapshot, verify } = require('../source-manifest.cjs')
const { options, targetOptions } = require('../package.cjs')
const { archiveSource } = require('../source.cjs')
function temporary(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-platform-contract-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root }
test('distinguishes real target formats and rejects corrupted PE headers', t => {
  const root = temporary(t), file = path.join(root, 'binary')
  const pe = Buffer.alloc(128); pe.write('MZ'); pe.writeUInt32LE(64, 0x3c); pe.write('PE\0\0', 64); pe.writeUInt16LE(0xaa64, 68); fs.writeFileSync(file, pe)
  assert.deepEqual(assertArchitecture(file, 'win32', 'arm64'), { format: 'PE', arches: ['arm64'] })
  assert.throws(() => assertArchitecture(file, 'win32', 'x64'), /Wrong/)
  pe.writeUInt32LE(65535, 0x3c); fs.writeFileSync(file, pe); assert.throws(() => architectures(file), /Invalid PE/)
  const elf = Buffer.alloc(64); elf.set([127, 69, 76, 70, 2, 1]); elf.writeUInt16LE(183, 18); fs.writeFileSync(file, elf)
  assert.deepEqual(assertArchitecture(file, 'linux', 'arm64').arches, ['arm64'])
  const macho = Buffer.alloc(64); macho.writeUInt32LE(0xfeedfacf); macho.writeUInt32LE(0x01000007, 4); fs.writeFileSync(file, macho)
  assert.deepEqual(assertArchitecture(file, 'darwin', 'x64').arches, ['x64'])
})
test('portable source binds exact committed bytes and refuses unsafe paths', t => {
  const root = temporary(t)
  const git = (...args) => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout }
  git('init', '-q'); git('config', 'user.name', 'ZIAForge fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'core.autocrlf', 'false')
  fs.writeFileSync(path.join(root, 'source.txt'), 'committed\n'); git('add', 'source.txt'); git('commit', '-qm', 'fixture')
  const manifest = snapshot(root); assert.equal(verify(root, manifest).fileCount, 1)
  fs.mkdirSync(path.join(root, 'node_modules')); fs.writeFileSync(path.join(root, 'node_modules', 'generated.js'), 'dependency')
  fs.mkdirSync(path.join(root, 'src')); fs.writeFileSync(path.join(root, 'src', 'untracked.ts'), 'injected')
  assert.throws(() => verify(root, manifest), /Unlisted source file: src\/untracked.ts/)
  fs.rmSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(path.join(root, '.env'), 'VITE_INJECTED=fixture')
  assert.throws(() => verify(root, manifest), /Unlisted source file: .env/)
  fs.unlinkSync(path.join(root, '.env')); assert.equal(verify(root, manifest).fileCount, 1)
  fs.writeFileSync(path.join(root, 'source.txt'), 'changed\n'); assert.throws(() => verify(root, manifest), /bytes changed/); assert.throws(() => snapshot(root), /Commit/)
  const bad = { ...manifest, files: [{ ...manifest.files[0], path: '../escape' }] }; bad.digest = crypto.createHash('sha256').update(JSON.stringify(bad.files)).digest('hex')
  assert.throws(() => verify(root, bad), /Unsafe/)
})
test('delivery target flags fail closed before a version or output is used', () => {
  assert.throws(() => options(['--identity']), /incomplete/)
  assert.throws(() => options(['--publish', 'always']), /Unknown/)
  assert.throws(() => targetOptions({ platform: 'win32', arch: 'arm64', formats: 'nsis,nsis' }), /duplicate/)
  assert.throws(() => targetOptions({ platform: 'darwin', arch: 'ia32' }), /Supported/)
  assert.deepEqual(options(['--platform', 'win32', '--arch', 'arm64', '--ci-verify']), { platform: 'win32', arch: 'arm64', 'ci-verify': true })
})
test('source archives contain exact committed files and exclude ignored private data', t => {
  const parent = temporary(t), root = path.join(parent, 'repo'), output = path.join(parent, 'delivery'), extracted = path.join(parent, 'extracted')
  fs.mkdirSync(root); fs.mkdirSync(extracted)
  const git = (...args) => { const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr) }
  git('init', '-q'); git('config', 'user.name', 'ZIAForge fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'core.autocrlf', 'false')
  fs.writeFileSync(path.join(root, '.gitignore'), 'private/\n'); fs.writeFileSync(path.join(root, 'source.txt'), 'exact\n')
  fs.mkdirSync(path.join(root, 'private')); fs.writeFileSync(path.join(root, 'private', 'not-delivered.txt'), 'fixture private data')
  git('add', '.gitignore', 'source.txt'); git('commit', '-qm', 'fixture')
  const result = archiveSource(root, output)
  assert.equal(result.status, 'passed', result.error); assert.equal(result.artifacts.length, 2)
  const archive = result.artifacts.find(item => item.file.endsWith('.tar.gz'))
  const unpack = spawnSync('tar', ['-xzf', path.join(output, archive.file), '-C', extracted], { encoding: 'utf8' })
  assert.equal(unpack.status, 0, unpack.stderr)
  const tree = path.join(extracted, 'ZIAForge-source')
  assert.equal(verify(tree, JSON.parse(fs.readFileSync(path.join(output, 'source-manifest.json')))).fileCount, 2)
  assert.equal(fs.existsSync(path.join(tree, 'private')), false)
  assert.throws(() => archiveSource(root, output), /EEXIST/)
})
test('portable archive extractor preserves executable links and rejects escape before writing', t => {
  const root = temporary(t)
  const code = `import io,tarfile,pathlib,sys,runpy,os
extract=runpy.run_path(sys.argv[1])['extract']; base=pathlib.Path(sys.argv[2])
def archive(name, bad=False):
 p=base/(name+'.tar')
 with tarfile.open(p,'w') as t:
  f=tarfile.TarInfo('root/bin/node');f.mode=0o755;data=b'marker';f.size=len(data);t.addfile(f,io.BytesIO(data))
  link=tarfile.TarInfo('root/bin/alias');link.type=tarfile.SYMTYPE;link.linkname='../../escape' if bad else 'node';t.addfile(link)
 return p
good=base/'good';good.mkdir();extract(archive('good'),good,1)
assert (good/'bin/alias').read_bytes()==b'marker'
assert (good/'bin/node').stat().st_mode & 0o111
bad=base/'bad';bad.mkdir()
try:extract(archive('bad',True),bad,1)
except ValueError:pass
else:raise AssertionError('unsafe archive accepted')
assert list(bad.iterdir())==[]
`
  const run = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', code, path.resolve(__dirname, '../extract-tar.py'), root], { encoding: 'utf8', timeout: 30000 })
  assert.equal(run.status, 0, run.stderr)
})
