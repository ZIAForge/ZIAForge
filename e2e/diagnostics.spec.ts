import { readFile } from 'node:fs/promises'
import { test, expect } from './fixtures'

test('diagnostic IPC respects logging opt-out and sanitizes critical entries', async ({ app }, testInfo) => {
  const logPath = testInfo.outputPath('profile', 'debug', 'ziaforge-app.log')
  // The fixture's settings disable ordinary diagnostic output.
  await app.window.evaluate(() => window.ziafAPI.writeDebugLog({ message: 'ordinary-fixture-entry' }))
  expect(await readFile(logPath, 'utf8').catch(() => '')).not.toContain('ordinary-fixture-entry')

  await app.window.evaluate(() => window.ziafAPI.writeDebugLog({
    critical: true,
    message: 'pass\x1b[0mword=private-fixture-value\nAuthorization: Bearer private-fixture-token\n' + '界'.repeat(10_000),
  }))
  const log = await readFile(logPath, 'utf8')
  expect(log).toContain('password=[REDACTED]')
  expect(log).not.toContain('private-fixture-value')
  expect(log).not.toContain('private-fixture-token')
  expect(log).toContain('[truncated]')
  expect(log.trimEnd().split('\n')).toHaveLength(1)
  expect(Buffer.byteLength(log)).toBeLessThanOrEqual(8192)
})
