import { mkdir } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'
import { test, expect } from './fixtures'

test.use({ replayAgyStartup: true })

async function screenshot(window: Page, testInfo: TestInfo, name: string) {
  const directory = testInfo.outputPath('e2e-screenshots')
  await mkdir(directory, { recursive: true })
  const filename = testInfo.outputPath('e2e-screenshots', `${name}.png`)
  await window.screenshot({ path: filename, fullPage: true })
  await testInfo.attach(name, { path: filename, contentType: 'image/png' })
}

test('new chat stays idle through captured agy sign-in and delayed redraws, with full UI screenshots', async ({ app }, testInfo) => {
  test.setTimeout(120_000)
  const { window } = app
  await expect.poll(() => app.electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some(candidate => candidate.isVisible())),
  { message: 'Native window has completed ready-to-show', timeout: 5000 }).toBe(true)
  // Read native window geometry before any test action can resize the app.
  const nativeGeometry = () => app.electronApp.evaluate(({ BrowserWindow, screen }) => {
    const nativeWindow = BrowserWindow.getAllWindows().find(candidate => candidate.isVisible())
    if (!nativeWindow) throw new Error('No visible native application window')
    const bounds = nativeWindow.getBounds()
    return { bounds, workArea: screen.getDisplayMatching(bounds).workArea, fullscreen: nativeWindow.isFullScreen(), webContentsId: nativeWindow.webContents.id }
  })
  const geometry = await nativeGeometry()
  const nativeTolerance = process.platform === 'darwin' ? 2 : 0
  await testInfo.attach('startup-window-geometry.json', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' })
  expect(geometry.bounds.width, 'Initial native window fits display workArea width').toBeLessThanOrEqual(geometry.workArea.width + nativeTolerance)
  expect(geometry.bounds.height, 'Initial native window fits display workArea height').toBeLessThanOrEqual(geometry.workArea.height + nativeTolerance)
  expect(geometry.bounds.x).toBeGreaterThanOrEqual(geometry.workArea.x - nativeTolerance)
  expect(geometry.bounds.y).toBeGreaterThanOrEqual(geometry.workArea.y - nativeTolerance)
  expect(geometry.bounds.x + geometry.bounds.width).toBeLessThanOrEqual(geometry.workArea.x + geometry.workArea.width + nativeTolerance)
  expect(geometry.bounds.y + geometry.bounds.height).toBeLessThanOrEqual(geometry.workArea.y + geometry.workArea.height + nativeTolerance)
  expect(geometry.fullscreen, 'The app uses desktop workArea, not native fullscreen').toBe(false)
  if (process.platform === 'darwin') {
    for (const dimension of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(geometry.bounds[dimension] - geometry.workArea[dimension]), `Initial macOS ${dimension} fills workArea`).toBeLessThanOrEqual(2)
    }
  }
  const stop = window.getByTestId('composer-stop-button')
  const waitForEvent = async (event: string, pid?: number) => {
    await expect.poll(async () => (await app.transcript()).some(entry => entry.event === event && (pid === undefined || entry.pid === pid))).toBe(true)
  }
  await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  await waitForEvent('idle-stable')
  await window.waitForTimeout(1000)
  await expect(stop).toHaveCount(0)
  await screenshot(window, testInfo, '01-task-open-idle')

  const previousPids = (await app.transcript()).filter(entry => entry.event === 'start').map(entry => entry.pid)
  await window.getByTestId('btn-new-chat').click()
  await expect(stop).toHaveCount(0)
  await expect(window.getByText('Independent Chat Session', { exact: true })).toBeVisible()
  const customTab = window.locator('[data-testid^="central-tab-chat-"]').last()
  const customTabTestId = await customTab.getAttribute('data-testid')

  // Observe the whole idle interval, so an eventually-hidden Stop cannot pass.
  await window.evaluate(() => {
    const samples: Array<{ time: number; visible: boolean }> = []
    const record = () => samples.push({ time: performance.now(), visible: Boolean(document.querySelector('[data-testid="composer-stop-button"]')) })
    const observer = new MutationObserver(record)
    observer.observe(document.body, { childList: true, subtree: true })
    record()
    Object.assign(window, { idleStopAudit: { samples, observer } })
  })
  await screenshot(window, testInfo, '02-new-chat-created')

  await expect.poll(async () => (await app.transcript()).some(entry => entry.event === 'start' && !previousPids.includes(entry.pid))).toBe(true)
  const pid = (await app.transcript()).find(entry => entry.event === 'start' && !previousPids.includes(entry.pid))!.pid
  await waitForEvent('authenticating', pid)
  await window.waitForTimeout(500)
  await expect(stop).toHaveCount(0)
  await screenshot(window, testInfo, '03-authentication-spinner')

  await waitForEvent('ready', pid)
  await window.waitForTimeout(500)
  await expect(window.getByTestId('stdout-telemetry-bar')).toContainText('Gemini 3.8 Flash')
  await expect(stop).toHaveCount(0)
  await screenshot(window, testInfo, '04-authorized-banner-idle')

  await waitForEvent('idle-redraw', pid)
  await window.waitForTimeout(500)
  await expect(stop).toHaveCount(0)
  await screenshot(window, testInfo, '05-idle-partial-redraw')

  await waitForEvent('idle-stable', pid)
  await window.waitForTimeout(3000)
  await expect(stop).toHaveCount(0)
  await expect(window.getByTestId('composer-input')).toBeEmpty()
  await expect(window.getByTestId('composer-send-button')).toBeVisible()
  await screenshot(window, testInfo, '06-idle-after-pause')
  const samples = await window.evaluate(() => {
    const audit = (window as unknown as { idleStopAudit: { samples: Array<{ time: number; visible: boolean }>; observer: MutationObserver } }).idleStopAudit
    audit.observer.disconnect()
    return audit.samples
  })
  await testInfo.attach('idle-stop-observations.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' })
  expect(samples.every(sample => !sample.visible), 'Stop must never flash during untouched chat startup').toBe(true)
  expect((await app.transcript()).filter(entry => entry.pid === pid && entry.message !== undefined)).toHaveLength(0)

  if (process.platform === 'darwin') {
    const marker = `reopen-${pid}`
    await window.evaluate(value => Object.assign(window, { qaResumeMarker: value }), marker)
    await app.electronApp.evaluate(({ BrowserWindow, app, screen }) => {
      const nativeWindow = BrowserWindow.getAllWindows().find(candidate => candidate.isVisible())!
      const area = screen.getDisplayMatching(nativeWindow.getBounds()).workArea
      nativeWindow.setBounds({ x: area.x + 20, y: area.y + 20, width: Math.max(1024, area.width - 200), height: Math.max(700, area.height - 160) })
      app.emit('activate')
    })
    await expect.poll(async () => {
      const { bounds, workArea, fullscreen } = await nativeGeometry()
      return !fullscreen && (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(bounds[key] - workArea[key]) <= 2)
    }, { message: 'Activation restores a user-resized macOS window to workArea' }).toBe(true)
    await app.electronApp.evaluate(({ BrowserWindow, app }) => {
      BrowserWindow.getAllWindows().find(candidate => candidate.isVisible())!.close()
      app.emit('activate')
    })
    await expect(window.getByTestId(customTabTestId!)).toBeVisible()
    expect(await window.evaluate(() => (window as unknown as { qaResumeMarker?: string }).qaResumeMarker), 'Close/reopen preserves the renderer document').toBe(marker)
    const reopened = await nativeGeometry()
    expect(reopened.webContentsId).toBe(geometry.webContentsId)
    expect(reopened.fullscreen).toBe(false)
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(reopened.bounds[key] - reopened.workArea[key])).toBeLessThanOrEqual(2)
    expect((await app.transcript()).filter(entry => entry.event === 'start')).toHaveLength(2)
    await screenshot(window, testInfo, '06b-reopened-same-session')
    await testInfo.attach('reopened-window-geometry.json', { body: JSON.stringify(reopened, null, 2), contentType: 'application/json' })
  }

  await window.getByTestId('composer-input').fill('long-generation')
  await window.getByTestId('composer-send-button').click()
  // A bubble or a busy flag is not evidence that PTY input reached this CLI.
  await expect.poll(async () => (await app.transcript()).filter(entry => entry.pid === pid && entry.message === 'long-generation').length,
    { message: 'The active CLI must receive the submitted message exactly once before Stop is checked' }).toBe(1)
  await expect(stop).toBeVisible()
  await window.waitForTimeout(1000)
  await screenshot(window, testInfo, '07-generation-stop-visible')

  // The main task still has status=running, but its own idle CLI has no Stop.
  await window.getByTestId('central-tab-chat-main').click()
  await window.waitForTimeout(1000)
  await expect(stop).toHaveCount(0)
  await screenshot(window, testInfo, '08-neighbor-tab-idle')
  await window.getByTestId(customTabTestId!).click()
  await expect(stop).toBeVisible()
  await screenshot(window, testInfo, '09-reconnected-generation')
  await stop.click()
  await waitForEvent('interrupt', pid)
  await window.waitForTimeout(1000)
  await expect(stop).toHaveCount(0)
  await screenshot(window, testInfo, '10-cancelled-idle')
  await window.getByTestId('composer-input').fill('post-stop-replay')
  await window.getByTestId('composer-send-button').click()
  await expect.poll(async () => (await app.transcript()).filter(entry => entry.pid === pid && entry.message === 'post-stop-replay').length,
    { message: 'The turn after Stop is delivered exactly once to the same CLI PID' }).toBe(1)
  await expect(window.getByTestId('conversation-feed')).toContainText('E2E response: post-stop-replay')
  await expect(stop).toHaveCount(0)
  await screenshot(window, testInfo, '11-post-stop-same-session')
  expect((await app.transcript()).filter(entry => entry.event === 'start')).toHaveLength(2)
  await testInfo.attach('cli-transcript.json', { body: JSON.stringify(await app.transcript(), null, 2), contentType: 'application/json' })
})
