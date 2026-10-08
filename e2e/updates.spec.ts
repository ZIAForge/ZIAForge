import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { test, expect } from './fixtures'

test.use({ providerFixture: 'codex' })

test('updates use the official default, verify a download and preserve settings after full Quit', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const version = '99.0.0'
  const sourceCommit = 'a'.repeat(40)
  const releaseId = '11111111-1111-4111-8111-111111111111'
  const osName = process.platform === 'darwin' ? 'macOS' : 'Linux'
  // This source-app fixture cannot install. Its package is deliberately inert.
  const payload = Buffer.from('ZIAForge deterministic update download fixture\n')
  const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex')
  const names = ['dmg', 'zip', 'AppImage', 'deb', 'rpm', 'tar.gz'].map(extension => `ZIAForge-${version}-${osName}-${process.arch}.${extension}`)
  const manifest = Buffer.from(JSON.stringify({
    schemaVersion: 1, product: 'ZIAForge', version, mode: 'release', channel: 'stable', sourceCommit, releaseId,
    targets: [{ platform: process.platform, arch: process.arch, sourceCommit, buildId: `${version}.release.${releaseId}.fixture`, packageIntegrity: 'passed', artifactNames: names }],
    assets: names.map(name => ({ name, platform: process.platform, arch: process.arch, bytes: payload.length, sha256: sha(payload) })),
  }))
  const base = `https://github.com/ZIAForge/ZIAForge/releases/download/v${version}/`
  const asset = (name: string, bytes: Buffer) => ({ name, browser_download_url: base + name, size: bytes.length, digest: `sha256:${sha(bytes)}`, state: 'uploaded' })
  const release = { id: 99, tag_name: `v${version}`, html_url: `https://github.com/ZIAForge/ZIAForge/releases/tag/v${version}`, draft: false, prerelease: false, assets: [asset('release-manifest.json', manifest), ...names.map(name => asset(name, payload))] }
  const installFetchFixture = () => app.electronApp.evaluate((_electron, fixture) => {
    // Intercept main-process network only in this isolated QA process. There is
    // no production download-host override and no live GitHub/provider call.
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url === 'https://api.github.com/repos/ZIAForge/ZIAForge/releases?per_page=100') return new Response(JSON.stringify([fixture.release]), { status: 200 })
      if (url === fixture.base + 'release-manifest.json') return new Response(fixture.manifest, { status: 200 })
      if (fixture.names.some(name => url === fixture.base + name)) return new Response(fixture.payload, { status: 200, headers: { 'content-length': String(new TextEncoder().encode(fixture.payload).length) } })
      throw new Error(`Unexpected update fixture network request: ${url}`)
    }
  }, { release, base, names, manifest: manifest.toString(), payload: payload.toString() })
  await installFetchFixture()
  const identity = await app.window.evaluate(() => window.ziafAPI.getAppVersion())
  expect(identity.version).toBe((JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version)
  await app.window.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await app.window.getByRole('button', { name: 'Updates', exact: true }).click()
  const panel = app.window.getByTestId('updates-settings')
  expect(await app.window.evaluate(() => window.ziafAPI.updates.status())).toMatchObject({ repository: 'ZIAForge/ZIAForge', currentChannel: 'stable', automatic: false })
  await panel.getByText('Update settings', { exact: true }).click()
  await panel.getByRole('combobox').selectOption('preview')
  await panel.getByRole('button', { name: 'Save settings', exact: true }).click()
  await panel.getByRole('button', { name: 'Check for updates', exact: true }).click()
  await expect(panel).toContainText(version)
  const available = await app.window.evaluate(() => window.ziafAPI.updates.status())
  expect(available).toMatchObject({ state: 'available', currentVersion: identity.version, repository: 'ZIAForge/ZIAForge', currentChannel: 'preview', version, canInstall: false })
  await expect(panel.getByRole('button', { name: 'Update now', exact: true })).toHaveCount(0)
  // Manual-only source runs direct owners' IPC solely to exercise the real
  // downloader; their UI exposes the release link, not an unusable cache file.
  await app.window.evaluate(() => window.ziafAPI.updates.download())
  await expect.poll(() => app.window.evaluate(() => window.ziafAPI.updates.status())).toMatchObject({ state: 'downloaded', progress: 100, version, canInstall: false })
  await expect(panel.getByRole('button', { name: 'Install and restart', exact: true })).toHaveCount(0)
  // The production Quit guard must reject an install before touching services.
  await app.window.evaluate(() => window.ziafAPI.editorDirtyState({ dirty: true }))
  try {
    await expect(app.window.evaluate(() => window.ziafAPI.updates.install())).rejects.toThrow('Save or discard unsaved file edits')
    await expect(panel).toBeVisible()
  } finally { await app.window.evaluate(() => window.ziafAPI.editorDirtyState({ dirty: false })) }
  await expect(app.window.evaluate(() => window.ziafAPI.updates.install())).rejects.toThrow('Use the published package installer')
  await expect(panel.getByRole('textbox')).toHaveValue('ZIAForge/ZIAForge')
  await app.window.screenshot({ path: testInfo.outputPath('01-verified-download-manual-source-build.png'), fullPage: true })
  await app.restart()
  await installFetchFixture()
  const restarted = await app.window.evaluate(() => window.ziafAPI.updates.status())
  expect(restarted).toMatchObject({ repository: 'ZIAForge/ZIAForge', currentChannel: 'preview', automatic: false })
  expect(['idle', 'downloaded']).toContain(restarted.state)
  expect(await app.window.evaluate(() => window.ziafAPI.getAppVersion())).toEqual(identity)
  const providerMethods = (await app.transcript()).flatMap(entry => entry.rpc?.method ? [entry.rpc.method] : [])
  // Normal model catalog discovery is allowed; starting a task/turn is not.
  expect(providerMethods.every(method => ['initialize', 'initialized', 'model/list'].includes(method))).toBe(true)
})
