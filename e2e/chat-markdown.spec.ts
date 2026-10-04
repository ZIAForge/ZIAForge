import { writeFile } from 'node:fs/promises'
import { test, expect } from './fixtures'

test.use({ providerFixture: 'agy-headless' })

test('renders streamed assistant Markdown and replay while keeping user text literal', async ({ app }, testInfo) => {
  test.setTimeout(90_000)
  const { window: page } = app
  const prompt = 'fixture-markdown\n### User literal heading\n**user literal bold** and `raw user code`\n- user literal item'
  const nextDraft = '### Unsent follow-up\n**Keep this draft literal**'
  const content = page.getByTestId('conversation-feed').locator('[data-testid^="message-content-"]')
  const user = page.getByTestId('conversation-feed').locator('[data-testid^="user-message-"]')
  const snapshot = () => page.evaluate(() => window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
  const assertUserLiteral = async () => {
    await expect(user).toHaveCount(1)
    await expect(user).toContainText(prompt)
    await expect(user.locator('h1, h2, h3, strong, ul, pre, code')).toHaveCount(0)
  }
  const assertMarkdown = async () => {
    await expect(content).toHaveCount(1)
    await expect(content.locator('h3')).toHaveText('Markdown answer')
    await expect(content.locator('strong')).toHaveText('Strong answer')
    await expect(content.locator('ul > li')).toHaveText(['First item', 'Second item'])
    await expect(content.locator('code').filter({ hasText: /^inline code$/ })).toHaveCount(1)
    await expect(content.locator('pre > code')).toHaveText('const streamed = true;\n')
    await expect(content.locator('table th')).toHaveText(['Item', 'State'])
    await expect(content.locator('table td')).toHaveText(['Format', 'Ready'])
    await expect(content.getByRole('link', { name: 'Project guide', exact: true })).toHaveAttribute('href', 'https://example.com/ziaforge')
  }

  await page.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  await page.getByTestId('composer-input').fill(prompt)
  await page.getByTestId('composer-send-button').click()
  try {
    await expect.poll(async () => (await app.transcript()).filter(entry => entry.event === 'markdown-partial').length).toBe(1)
    await expect(content.locator('h3')).toHaveText('Markdown answer')
    await expect(content.locator('pre > code')).toContainText('const streamed = true;')
    await expect(page.getByTestId('composer-stop-button')).toBeVisible()
    expect((await snapshot())?.activeTurn).toBeDefined()
    await assertUserLiteral()
    await page.screenshot({ path: testInfo.outputPath('01-markdown-streaming-open-fence.png'), fullPage: true })
  } finally {
    // Release even on assertion failure so production Quit can drain this turn.
    await writeFile(testInfo.outputPath('profile/agy-markdown-continue'), 'continue\n')
  }
  await expect.poll(async () => (await snapshot())?.lastTurn?.status).toBe('completed')
  await assertMarkdown()
  await assertUserLiteral()
  const beforeReload = (await snapshot())!
  await page.getByTestId('composer-input').fill(nextDraft)

  // Exercise the real link handler through preload/IPC but replace the OS
  // boundary in this isolated Electron process: never open an external browser.
  await app.electronApp.evaluate(({ shell }) => {
    const original = shell.openExternal
    const state = globalThis as typeof globalThis & { __markdownExternal?: { urls: string[]; restore: () => void } }
    const urls: string[] = []
    state.__markdownExternal = { urls, restore: () => { shell.openExternal = original } }
    shell.openExternal = async url => { urls.push(url) }
  })
  try {
    const documentUrl = page.url()
    await content.getByRole('link', { name: 'Project guide', exact: true }).click()
    await expect.poll(() => app.electronApp.evaluate(() => (globalThis as typeof globalThis & { __markdownExternal?: { urls: string[] } }).__markdownExternal?.urls)).toEqual(['https://example.com/ziaforge'])
    expect(page.url()).toBe(documentUrl)
  } finally {
    await app.electronApp.evaluate(() => {
      const state = globalThis as typeof globalThis & { __markdownExternal?: { restore: () => void } }
      state.__markdownExternal?.restore()
      delete state.__markdownExternal
    })
  }

  await page.reload()
  await page.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  await assertMarkdown()
  await assertUserLiteral()
  await expect(page.getByTestId('composer-input')).toHaveValue(nextDraft)
  const afterReload = (await snapshot())!
  expect(afterReload.feed).toEqual(beforeReload.feed)
  expect({ sessionId: afterReload.sessionId, runId: afterReload.runId }).toEqual({ sessionId: beforeReload.sessionId, runId: beforeReload.runId })
  const transcript = await app.transcript()
  expect(transcript.filter(entry => entry.event === 'prompt').map(entry => entry.text)).toEqual([prompt])
  expect(transcript.filter(entry => entry.event === 'provider-start')).toHaveLength(1)
  expect(transcript.filter(entry => ['invalid-launch', 'protocol-error', 'pty-shell-start'].includes(entry.event || ''))).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('02-markdown-completed-after-reload.png'), fullPage: true })
})
