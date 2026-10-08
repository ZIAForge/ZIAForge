import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseFixture } from './updateFixture'

const native = vi.hoisted(() => ({
  app: { isPackaged: false, getVersion: vi.fn(() => '99.0.0') },
  target: { kind: 'manual', extension: 'dmg', canInstall: false, messageCode: 'updates.notPackaged' } as { kind: string; extension: string; canInstall: boolean; messageCode?: string },
  prepare: vi.fn(), arm: vi.fn(async () => 123), discard: vi.fn(),
}))
vi.mock('electron', () => ({ app: native.app }))
vi.mock('../UpdateInstaller', () => ({ detectUpdateTarget: () => native.target, prepareUpdate: native.prepare, armPreparedUpdate: native.arm, discardPreparedUpdate: native.discard }))
import { UpdateService } from '../UpdateService'

let directory: string
const fetchMock = vi.fn<typeof fetch>()
const extension = process.platform === 'darwin' ? 'dmg' : process.platform === 'win32' ? 'exe' : 'AppImage'
beforeEach(() => {
  vi.clearAllMocks(); fetchMock.mockReset()
  directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-update-policy-')))
  native.target = { kind: 'manual', extension, canInstall: false, messageCode: 'updates.notPackaged' }
  native.prepare.mockResolvedValue({ directory, source: 'owned stage' })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); fs.rmSync(directory, { recursive: true, force: true }) })
function mockRelease() {
  const fixture = releaseFixture(undefined, process.platform, process.arch, native.target.extension)
  fetchMock.mockImplementation(async url => {
    const value = String(url)
    if (value.includes('/repos/')) return new Response(JSON.stringify(fixture.catalog))
    if (value.endsWith('release-manifest.json')) return new Response(fixture.manifest)
    if (value.endsWith(fixture.candidate.asset.name)) return new Response(new Uint8Array(fixture.bytes))
    throw new Error('Unexpected fixture request')
  })
  return fixture
}
const service = (requestQuit?: () => void) => new UpdateService(directory, { currentVersion: '1.0.8', requestQuit })

describe('verified local-owner release updates', () => {
  it('uses the official repository and product version without enabling background downloads', async () => {
    const updater = service(); mockRelease()
    expect(updater.status()).toMatchObject({ repository: 'ZIAForge/ZIAForge', currentVersion: '1.0.8', currentChannel: 'stable', automatic: false })
    updater.start(); expect(fetchMock).not.toHaveBeenCalled()
    expect(await updater.check()).toMatchObject({ state: 'available', version: '1.0.9', canInstall: false, messageCode: 'updates.notPackaged' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await updater.close()
  })
  it('never downloads equal or older releases and reports network failures with a retry', async () => {
    const updater = service()
    fetchMock.mockRejectedValueOnce(new Error('Offline fixture'))
    expect(await updater.check()).toMatchObject({ state: 'error', message: 'Offline fixture' })
    const old = releaseFixture(undefined, process.platform, process.arch, extension, '1.0.8')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(old.catalog)))
    expect(await updater.check()).toMatchObject({ state: 'current', version: '1.0.8' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await expect(updater.download()).rejects.toThrow(/available update/)
  })
  it('coalesces check and download, verifies bytes, and leaves development installation untouched', async () => {
    const updater = service(), fixture = mockRelease()
    const check = updater.check(); expect(updater.check()).toBe(check); await check
    const download = updater.download(); expect(updater.download()).toBe(download)
    expect(await download).toMatchObject({ state: 'downloaded', progress: 100 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const files = fs.readdirSync(path.join(directory, 'update-cache'))
    expect(files).toEqual([`${fixture.candidate.asset.sha256}-${fixture.candidate.asset.name}`])
    await expect(updater.install()).rejects.toThrow(/published package installer/)
    expect(native.prepare).not.toHaveBeenCalled(); expect(native.arm).not.toHaveBeenCalled()
  })
  it('rejects altered downloads without installing, and allows an explicit correct retry', async () => {
    const updater = service(); const fixture = mockRelease(); await updater.check()
    fetchMock.mockResolvedValueOnce(new Response(Buffer.alloc(fixture.bytes.length, 1)))
    await expect(updater.download()).rejects.toThrow(/checksum/)
    expect(updater.status()).toMatchObject({ state: 'available', messageCode: 'updates.downloadFailed' })
    expect(fs.readdirSync(path.join(directory, 'update-cache'))).toEqual([])
    expect(await updater.download()).toMatchObject({ state: 'downloaded' })
    expect(native.arm).not.toHaveBeenCalled()
  })
  it('disarms prepared installation if dirty-editor normal Quit is rejected', async () => {
    native.target = { kind: 'mac-zip', extension: 'zip', canInstall: true }
    const updater = service(() => { throw new Error('Save your files first') }); mockRelease()
    await updater.check(); await updater.download()
    await expect(updater.install()).rejects.toThrow(/Save your files/)
    expect(updater.status().state).toBe('downloaded')
    expect(native.discard).toHaveBeenCalledTimes(1)
    await updater.finalizeInstallAfterQuitCleanup(); expect(native.arm).not.toHaveBeenCalled()
  })
  it('waits for explicit normal-Quit cleanup and never resumes installation from a later process', async () => {
    native.target = { kind: 'mac-zip', extension: 'zip', canInstall: true }
    const quit = vi.fn(), updater = service(quit); mockRelease()
    await updater.check(); await updater.download(); await updater.install()
    expect(quit).toHaveBeenCalledTimes(1); expect(native.arm).not.toHaveBeenCalled()
    await updater.close(); await updater.finalizeInstallAfterQuitCleanup(); await updater.finalizeInstallAfterQuitCleanup()
    expect(native.arm).toHaveBeenCalledTimes(1)
    const restarted = service(quit); restarted.start(); await restarted.finalizeInstallAfterQuitCleanup()
    expect(native.arm).toHaveBeenCalledTimes(1); expect(quit).toHaveBeenCalledTimes(1)
  })
  it('background checking can download but never requests installation or restart', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const quit = vi.fn(), updater = service(quit); mockRelease()
    updater.configure({ repository: 'ZIAForge/ZIAForge', channel: 'stable', automatic: true })
    await updater.check()
    expect(updater.status().state).toBe('downloaded')
    expect(quit).not.toHaveBeenCalled(); expect(native.prepare).not.toHaveBeenCalled()
    await updater.close()
  })
  it('cancels a pending network request on Quit and fences configuration while checking', async () => {
    const updater = service(); let signal: AbortSignal | undefined
    fetchMock.mockImplementation((_url, options) => new Promise<Response>((_resolve, reject) => { signal = options?.signal as AbortSignal; signal.addEventListener('abort', () => reject(signal!.reason), { once: true }) }))
    const check = updater.check()
    expect(() => updater.configure({ repository: 'ZIAForge/ZIAForge', channel: 'preview', automatic: false })).toThrow(/pending update/)
    await updater.close(); await check
    expect(signal?.aborted).toBe(true); expect(native.arm).not.toHaveBeenCalled()
  })
})
