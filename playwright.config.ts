import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Keep direct Playwright cleanup away from retained qa:check/qa:inspect runs.
  outputDir: process.env.ZIAFORGE_QA_OUTPUT || 'test-results/e2e',
})
