import { test, expect, customSessionId } from './fixtures'

test('loads the CLI model catalog, submits through raw PTY and answers prompts in each tab', async ({ app }) => {
  const { window } = app
  await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  await expect(window.getByTestId('composer-model-selector-btn')).toContainText('E2E Coding')
  const send = async (message: string) => {
    await window.getByTestId('composer-input').fill(message)
    await window.getByTestId('composer-send-button').click()
  }
  await send('привет!')
  await send('ты тут?')
  await window.getByTestId('composer-model-selector-btn').click()
  await window.getByTestId('model-tab-custom').click()
  await expect(window.getByTestId('composer-custom-model-select').locator('option')).toContainText([
    'auto', 'gemini-3.8-flash-high', 'gemini-3.8-flash-medium', /Custom|Другая|Other/,
  ])
  await expect(window.getByTestId('model-selector-dropdown')).not.toContainText('Fetching available models')
  await window.getByTestId('composer-model-selector-btn').click()
  await expect(window.getByTestId('conversation-feed')).toContainText('E2E response: привет!')
  await expect(window.getByTestId('conversation-feed')).toContainText('E2E response: ты тут?')
  await expect.poll(app.transcript).toEqual(expect.arrayContaining([
    expect.objectContaining({ message: 'привет!', model: 'gemini-3.8-flash-high' }),
    expect.objectContaining({ message: 'ты тут?', model: 'gemini-3.8-flash-high' }),
  ]))
  await expect(window.getByTestId('conversation-feed')).not.toContainText('export LANG=')
  await expect(window.getByTestId('conversation-feed')).not.toContainText('Gemini 3.8 Flash · high')

  await send('ask-options')
  await window.getByRole('button', { name: 'Explain', exact: true }).click()
  await expect(window.getByTestId('conversation-feed')).toContainText('Confirmed choice: 3')
  await expect(window.getByRole('button', { name: 'Explain', exact: true })).toBeDisabled()

  await window.getByTestId(`central-tab-${customSessionId}`).click()
  await send('ask-yes-no')
  await window.getByRole('button', { name: 'Yes (y)', exact: true }).click()
  await expect(window.getByTestId('conversation-feed')).toContainText('Confirmed choice: y')
  const transcript = await app.transcript()
  expect(transcript.find(entry => entry.message === 'y')?.pid).not.toBe(transcript.find(entry => entry.message === '3')?.pid)
})

test('persists default presets, keeps a task model and accepts a model absent from the catalog', async ({ app }) => {
  const { window } = app
  // Coding is the second preset; the first preset must not override it.
  await expect(window.getByTestId('new-task-agent-preset')).toHaveValue('E2E Coding')
  await window.getByRole('button', { name: 'Settings', exact: true }).click()
  await window.getByRole('button', { name: 'Presets', exact: true }).click()
  await expect(window.getByTestId('default-coding-preset')).toHaveValue('E2E Coding')
  await window.getByTestId('default-coding-preset').selectOption('E2E Review')
  await window.getByTestId('default-review-preset').selectOption('E2E Coding')
  await window.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(window.getByRole('button', { name: 'Save Changes', exact: true })).not.toBeVisible()
  await window.reload()
  await expect(window.getByTestId('new-task-agent-preset')).toHaveValue('E2E Review')
  const settings = await window.evaluate(() => globalThis.window.ziafAPI.getSettings())
  expect(settings).toMatchObject({ defaultCodingPreset: 'E2E Review', defaultReviewPreset: 'E2E Coding' })

  await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
  await expect(window.getByTestId('composer-model-selector-btn')).toContainText('E2E Coding')
  await window.getByTestId('composer-model-selector-btn').click()
  await window.getByTestId('model-tab-custom').click()
  await window.getByTestId('composer-custom-model-select').selectOption('__custom__')
  await window.getByTestId('composer-custom-model-input').fill('future-model-e2e')
  await window.getByTestId('composer-apply-custom-model-btn').click()
  await expect(window.getByTestId('composer-model-selector-btn')).toContainText('future-model-e2e')
})
