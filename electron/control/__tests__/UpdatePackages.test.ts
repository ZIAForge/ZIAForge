import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseReleases, verifiedCandidate } from '../UpdateRelease'
import { assertUpdateUrl, downloadUpdateAsset } from '../UpdateDownload'
import { validateMacUpdateZip } from '../UpdateArchive'
import { armPreparedUpdate, detectUpdateTarget, prepareUpdate, type PreparedUpdate, type UpdateEnvironment } from '../UpdateInstaller'
import { confirmUpdateStartup, pruneUpdateDownloads } from '../UpdateRetention'
import { hash, releaseFixture, zipFixture } from './updateFixture'

let directory: string
const children: ChildProcess[] = [], helpers: number[] = []
beforeEach(() => { directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-updater-files-'))) })
afterEach(async () => {
  vi.unstubAllGlobals()
  for (const child of children.splice(0)) if (child.exitCode === null && child.signalCode === null) child.kill()
  for (const pid of helpers.splice(0)) { try { process.kill(pid, 0); throw new Error(`Updater helper ${pid} survived its fixture`) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') { try { process.kill(pid) } catch { /* already gone */ } throw error } } }
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('release trust and download boundaries', () => {
  it('selects semantic stable versions and binds every artifact to tag, architecture, size and GitHub digest', () => {
    const fixture = releaseFixture(), newer = releaseFixture(undefined, 'darwin', 'x64', 'dmg', '1.10.0'), preview = releaseFixture(undefined, 'darwin', 'x64', 'dmg', '2.0.0-beta.1')
    const catalog = [...fixture.catalog, ...newer.catalog, ...preview.catalog]
    expect(parseReleases(catalog, 'ZIAForge/ZIAForge', '1.0.8', 'stable').map(item => item.version)).toEqual(['1.10.0', '1.0.9'])
    expect(parseReleases(catalog, 'ZIAForge/ZIAForge', '1.0.8', 'preview')[0].version).toBe('2.0.0-beta.1')
    expect(verifiedCandidate(fixture.release, fixture.manifest, 'darwin', 'x64', 'dmg').asset.sha256).toBe(hash(fixture.bytes))
    expect(() => verifiedCandidate(fixture.release, fixture.manifest, 'darwin', 'arm64', 'dmg')).toThrow(/target/)
    expect(() => verifiedCandidate(fixture.release, Buffer.from('{}'), 'darwin', 'x64', 'dmg')).toThrow(/digest/)
    const wrong = structuredClone(fixture.release); wrong.assets[1].digest = `sha256:${'0'.repeat(64)}`
    expect(() => verifiedCandidate(wrong, fixture.manifest, 'darwin', 'x64', 'dmg')).toThrow(/identity differs/)
  })
  it('rejects non-HTTPS, credentials, foreign releases and redirects outside GitHub asset hosts', async () => {
    for (const url of ['http://github.com/ZIAForge/ZIAForge/releases/download/v1/x', 'https://user@github.com/ZIAForge/ZIAForge/releases/download/v1/x', 'https://github.com/other/repository/releases/download/v1/x', 'https://127.0.0.1/x']) expect(() => assertUpdateUrl(url, 'ZIAForge/ZIAForge')).toThrow()
    const fixture = releaseFixture(), fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://example.com/update.exe' } }))
    vi.stubGlobal('fetch', fetcher)
    await expect(downloadUpdateAsset(fixture.candidate.asset, 'ZIAForge/ZIAForge', directory, new AbortController().signal, () => {})).rejects.toThrow(/trusted GitHub/)
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fs.readdirSync(directory)).toEqual([])
  })
  it('bounds download retention and never removes unrelated files or symlinks', () => {
    const first = `${'a'.repeat(64)}-ZIAForge-1.0.8-macOS-x64.zip`, second = `${'b'.repeat(64)}-ZIAForge-1.0.9-macOS-x64.zip`
    fs.writeFileSync(path.join(directory, first), 'old'); fs.writeFileSync(path.join(directory, second), 'current'); fs.writeFileSync(path.join(directory, 'important.txt'), 'retain')
    fs.symlinkSync(path.join(directory, 'important.txt'), path.join(directory, `${'c'.repeat(64)}-ZIAForge-1.0.7-macOS-x64.zip`))
    pruneUpdateDownloads(directory, path.join(directory, second))
    expect(fs.existsSync(path.join(directory, first))).toBe(false)
    expect(fs.readFileSync(path.join(directory, 'important.txt'), 'utf8')).toBe('retain')
    expect(fs.existsSync(path.join(directory, second))).toBe(true)
  })
})

describe('archive validation before extraction', () => {
  it.runIf(!!process.env.ZIAFORGE_UPDATE_ARCHIVE_FIXTURE)('accepts the explicitly supplied historical release archive format', async () => {
    await expect(validateMacUpdateZip(process.env.ZIAFORGE_UPDATE_ARCHIVE_FIXTURE!)).resolves.toBeUndefined()
  })
  it('rejects traversal, escaping symlinks and central/local path disagreements', async () => {
    const cases = [
      zipFixture([{ name: 'ZIAForge.app/../../escape', bytes: Buffer.from('x') }]),
      zipFixture([{ name: 'ZIAForge.app/link', mode: 0o120777, bytes: Buffer.from('../../escape') }]),
    ]
    const inconsistent = zipFixture([{ name: 'ZIAForge.app/safe', bytes: Buffer.from('x') }]); inconsistent[30] = 'X'.charCodeAt(0); cases.push(inconsistent)
    for (let index = 0; index < cases.length; index++) {
      const filename = path.join(directory, `${index}.zip`); fs.writeFileSync(filename, cases[index])
      await expect(validateMacUpdateZip(filename)).rejects.toThrow(/Unsafe|escapes|differs/)
    }
    const allowed = path.join(directory, 'valid.zip')
    fs.writeFileSync(allowed, zipFixture([{ name: 'ZIAForge.app/' }, { name: 'ZIAForge.app/real', bytes: Buffer.from('valid') }, { name: 'ZIAForge.app/link', mode: 0o120777, bytes: Buffer.from('real') }]))
    await expect(validateMacUpdateZip(allowed)).resolves.toBeUndefined()
  })
})

function appFixture() {
  const app = path.join(directory, 'Applications', 'ZIAForge.app'), resources = path.join(app, 'Contents/Resources'), executable = path.join(app, 'Contents/MacOS/ZIAForge')
  fs.mkdirSync(resources, { recursive: true }); fs.mkdirSync(path.dirname(executable), { recursive: true })
  const oldIdentity = JSON.stringify({ mode: 'release', version: '1.0.8', platform: 'darwin', arch: process.arch, source: { commit: 'b'.repeat(40) } })
  fs.writeFileSync(path.join(resources, 'build-identity.json'), oldIdentity); fs.writeFileSync(executable, 'old fixture executable')
  const env: UpdateEnvironment = { platform: 'darwin', arch: process.arch, isPackaged: true, version: '1.0.8', executable, resources }
  const fixture = releaseFixture(undefined, 'darwin', process.arch, 'zip'), candidate = fixture.candidate
  const identity = Buffer.from(JSON.stringify({ mode: 'release', version: candidate.release.version, releaseId: candidate.releaseId, buildId: candidate.buildId, platform: 'darwin', arch: process.arch, source: { commit: candidate.sourceCommit } }))
  const header = Buffer.alloc(32); header.writeUInt32LE(0xfeedfacf); header.writeUInt32LE(process.arch === 'arm64' ? 0x100000c : 0x1000007, 4)
  const plist = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>org.ziaforge.desktop</string><key>CFBundleShortVersionString</key><string>1.0.9</string><key>CFBundleExecutable</key><string>ZIAForge</string></dict></plist>')
  const zip = zipFixture([{ name: 'ZIAForge.app/' }, { name: 'ZIAForge.app/Contents/' }, { name: 'ZIAForge.app/Contents/Resources/' }, { name: 'ZIAForge.app/Contents/MacOS/' }, { name: 'ZIAForge.app/Contents/Resources/build-identity.json', bytes: identity }, { name: 'ZIAForge.app/Contents/Info.plist', bytes: plist }, { name: 'ZIAForge.app/Contents/MacOS/ZIAForge', bytes: header, mode: 0o100755 }])
  const filename = path.join(directory, 'verified.zip'); fs.writeFileSync(filename, zip)
  const packageFixture = releaseFixture(zip, 'darwin', process.arch, 'zip')
  return { env, app, resources, oldIdentity, filename, candidate: packageFixture.candidate }
}
async function gone(pid: number) { await vi.waitFor(() => { expect(() => process.kill(pid, 0)).toThrow() }, { timeout: 5000, interval: 25 }) }

describe.skipIf(process.platform !== 'darwin')('real Mac filesystem and after-Quit helper fixture', () => {
  it.each([false, true])('waits for parent exit, preserves profile and %s tests rollback on failed swap', async failSwap => {
    const fixture = appFixture(), target = detectUpdateTarget(fixture.env), cache = path.join(directory, 'private-cache')
    expect(target).toMatchObject({ kind: 'mac-zip', canInstall: true })
    const profile = path.join(directory, 'unrelated-profile.json'); fs.writeFileSync(profile, 'history and drafts')
    const prepared: PreparedUpdate = await prepareUpdate(fixture.candidate, fixture.filename, target, cache, new AbortController().signal)
    const parent = spawn('/bin/sleep', ['30'], { stdio: 'ignore' }); children.push(parent)
    await new Promise<void>((resolve, reject) => { parent.once('spawn', resolve); parent.once('error', reject) })
    prepared.parentPid = parent.pid!
    prepared.parentStart = execFileSync('/bin/ps', ['-p', String(parent.pid), '-o', 'lstart='], { encoding: 'utf8' }).trim()
    if (failSwap) fs.rmSync(prepared.source, { recursive: true })
    const pid = await armPreparedUpdate(prepared, { relaunch: false }); helpers.push(pid)
    expect(fs.readFileSync(path.join(fixture.resources, 'build-identity.json'), 'utf8')).toBe(fixture.oldIdentity)
    expect(fs.existsSync(prepared.backup!)).toBe(false)
    parent.kill(); await gone(parent.pid!)
    await vi.waitFor(() => expect(JSON.parse(fs.readFileSync(prepared.receipt, 'utf8')).status).toBe(failSwap ? 'failed' : 'applied'), { timeout: 5000, interval: 25 })
    await gone(pid)
    if (failSwap) expect(fs.readFileSync(path.join(fixture.resources, 'build-identity.json'), 'utf8')).toBe(fixture.oldIdentity)
    else {
      expect(JSON.parse(fs.readFileSync(path.join(fixture.resources, 'build-identity.json'), 'utf8')).version).toBe('1.0.9')
      expect(fs.readFileSync(path.join(prepared.backup!, 'Contents/Resources/build-identity.json'), 'utf8')).toBe(fixture.oldIdentity)
      confirmUpdateStartup(cache, { ...fixture.env, version: '1.0.9' })
      expect(JSON.parse(fs.readFileSync(path.join(prepared.directory, 'confirmed.json'), 'utf8')).version).toBe('1.0.9')
    }
    expect(fs.readFileSync(profile, 'utf8')).toBe('history and drafts')
  })
})
