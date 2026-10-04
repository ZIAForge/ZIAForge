import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { Page, TestInfo } from '@playwright/test'
import { test, expect } from './fixtures'

const taskPrompt = 'Удали страничку index и создай страничку с mock данными авторизации красивую с бутстрап cdn и запусти временный веб сервер чтобы я смог в браузере ее посмотреть.'

async function idle(window: Page) {
  await expect(window.getByTestId('composer-stop-button')).toHaveCount(0)
  await expect(window.getByTestId('composer-send-button')).toBeVisible()
}

async function send(window: Page, message: string) {
  await window.getByTestId('composer-input').fill(message)
  await expect(window.getByTestId('composer-send-button')).toBeEnabled()
  await window.getByTestId('composer-send-button').click()
}

async function screenshot(window: Page, name: string, testInfo: TestInfo) {
  const directory = path.resolve('screenshots')
  await mkdir(directory, { recursive: true })
  const filename = path.join(directory, name)
  await window.screenshot({ path: filename, fullPage: true })
  await testInfo.attach(name, { path: filename, contentType: 'image/png' })
}

async function expectTurnOrder(window: Page, expected: string[]) {
  const messages = window.getByTestId('conversation-feed').locator('[data-testid^="user-message-"], [data-testid^="assistant-message-"]')
  await expect.poll(async () => {
    const texts = await messages.allTextContents()
    let previous = -1
    return expected.every(text => {
      const index = texts.findIndex((content, i) => i > previous && content.includes(text))
      if (index < 0) return false
      previous = index
      return true
    })
  }, { message: 'Each user message must precede its own assistant response' }).toBe(true)
}

test('opens a task, creates a chat, completes two turns and returns to idle with screenshots', async ({ app }, testInfo) => {
  const { window } = app
  await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  await idle(window)
  await window.getByTestId('btn-new-chat').click()
  await idle(window)
  await expect(window.getByTestId('composer-input')).toBeEmpty()
  await screenshot(window, 'chat-step1-idle.png', testInfo)

  await send(window, 'Привет')
  await expectTurnOrder(window, ['Привет', 'E2E response: Привет'])
  await idle(window)
  await screenshot(window, 'chat-step2-greeting.png', testInfo)

  await send(window, taskPrompt)
  const permission = window.getByRole('button', { name: 'Создать mock авторизацию и запустить сервер', exact: true })
  await expect(permission).toBeEnabled()
  await expect(window.getByTestId('composer-stop-button')).toHaveCount(0)
  await screenshot(window, 'chat-step3-permission.png', testInfo)
  await permission.click()
  await expect(permission).toBeDisabled()
  await expectTurnOrder(window, ['Привет', 'E2E response: Привет', taskPrompt, 'Mock авторизация готова'])
  await idle(window)
  await screenshot(window, 'chat-step3-task.png', testInfo)

  const transcript = await app.transcript()
  const preview = transcript.find(entry => entry.event === 'preview')
  expect(preview?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  const response = await window.request.get(preview!.url!)
  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain('bootstrap@5.3.3')
  expect(await response.text()).toContain('demo@example.test')
  const turns = transcript.filter(entry => entry.message === 'Привет' || entry.message === taskPrompt || entry.message === '1')
  expect(turns).toHaveLength(3)
  expect(new Set(turns.map(entry => entry.pid)).size).toBe(1)
  await expect(window.getByTestId('conversation-feed')).not.toContainText('[Process exited')
})

test('keeps activity per tab and cancels generation without restarting the CLI', async ({ app }) => {
  const { window } = app
  await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  await idle(window)
  await send(window, 'long-generation')
  await expect(window.getByTestId('conversation-feed')).toContainText('Working on a long response')
  await expect(window.getByTestId('composer-stop-button')).toBeVisible()
  const firstPid = (await app.transcript()).find(entry => entry.message === 'long-generation')!.pid

  await window.getByTestId('btn-new-chat').click()
  await idle(window)
  await send(window, 'Привет из новой вкладки')
  await expectTurnOrder(window, ['Привет из новой вкладки', 'E2E response: Привет из новой вкладки'])
  await idle(window)

  await window.getByTestId('central-tab-chat-main').click()
  await expect(window.getByTestId('composer-stop-button')).toBeVisible()
  await window.getByTestId('composer-stop-button').click()
  await expect.poll(app.transcript).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'interrupt', pid: firstPid })]))
  await idle(window)
  await send(window, 'После отмены')
  await expectTurnOrder(window, ['После отмены', 'E2E response: После отмены'])
  await idle(window)
  const transcript = await app.transcript()
  expect(transcript.find(entry => entry.message === 'После отмены')?.pid).toBe(firstPid)
  expect(transcript.filter(entry => entry.event === 'start')).toHaveLength(2)
  await expect(window.getByTestId('conversation-feed')).not.toContainText('[Process exited')
})
