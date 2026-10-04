import { test, expect } from './fixtures'

test.use({ holdModelDiscovery: true })

test('production Quit during model discovery stops the pending catalog before a full restart', async ({ app }, testInfo) => {
  test.setTimeout(60_000)
  await app.window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  const pendingCatalogs = async () => {
    const entries = await app.transcript()
    const exited = new Set(entries.filter(entry => entry.event === 'model-discovery-exit').map(entry => entry.pid))
    return entries.filter(entry => entry.event === 'model-discovery-start' && !exited.has(entry.pid))
  }
  // New-task and workspace selectors can independently load the same catalog.
  // The lifecycle contract concerns every still-owned process, not a UI query count.
  await expect.poll(async () => (await pendingCatalogs()).length).toBeGreaterThan(0)
  const catalogs = await pendingCatalogs()
  expect(catalogs.length).toBeGreaterThan(0)
  for (const catalog of catalogs) expect(() => process.kill(catalog.pid, 0)).not.toThrow()
  const pid = app.electronApp.process().pid
  // restart() asserts production Quit exits normally, with no fallback signals.
  await app.restart()
  expect(app.electronApp.process().pid).not.toBe(pid)
  const transcript = await app.transcript()
  for (const catalog of catalogs) {
    expect(transcript.filter(entry => entry.pid === catalog.pid && entry.event === 'model-discovery-signal')).toMatchObject([{ signal: 'SIGTERM' }])
    const exits = transcript.filter(entry => entry.pid === catalog.pid && entry.event === 'model-discovery-exit')
    expect(exits).toHaveLength(1)
    expect(exits[0]).toMatchObject({ code: 0 })
    expect(() => process.kill(catalog.pid, 0)).toThrow()
  }
  const catalogPids = new Set(catalogs.map(entry => entry.pid))
  await testInfo.attach('catalog-shutdown.json', { body: JSON.stringify({ pendingCatalogPids: [...catalogPids], events: transcript.filter(entry => catalogPids.has(entry.pid)) }, null, 2), contentType: 'application/json' })
  await app.window.screenshot({ path: testInfo.outputPath('01-restarted-after-catalog-quit.png'), fullPage: true })
})
