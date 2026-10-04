#!/usr/bin/env node
// Rendered user-flow checks for the static site. Requires the repo's existing Playwright dev dependency.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { chromium } = require('@playwright/test')
const root = path.resolve(__dirname, '../..')
const docsOnly = process.argv.includes('--docs-only')
const base = process.argv.slice(2).find(arg => arg !== '--docs-only') || 'http://127.0.0.1:4173/website/index.html'
const output = path.join(root, 'test-results', 'website', new Date().toISOString().replaceAll(':', '-'))
fs.mkdirSync(output, { recursive: true })
const rtl = new Set(['ar', 'fa', 'pnb', 'ps', 'sd', 'ur'])
const locales = [...fs.readFileSync(path.join(root, 'src/languages.ts'), 'utf8').matchAll(/"id":\s*"([^"]+)"/g)].map(match => match[1])
const results = { base, docsOnly, startedAt: new Date().toISOString(), locales: [], films: [], guides: [], errors: [] }
;(async () => {
  const executablePath = process.env.ZIAFORGE_SITE_BROWSER || [chromium.executablePath(), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file => fs.existsSync(file))
  const browser = await chromium.launch({ executablePath })
  results.browser = browser.version()
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const badResponses = []
    page.on('pageerror', error => results.errors.push(error.message))
    page.on('response', response => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }) })
    await page.goto(base, { waitUntil: 'networkidle' })
    const contentBase = await page.evaluate(() => document.baseURI)
    results.contentBase = contentBase
    if (!docsOnly) {
    await page.locator('#language-select').selectOption('en')
    assert.equal(await page.locator('#language-select option').count(), 56)
    for (const locale of locales) {
      await page.locator('#language-select').selectOption(locale)
      await page.waitForFunction(code => document.documentElement.lang === code, locale)
      const state = await page.evaluate(() => {
        const code = document.documentElement.lang, catalog = window.ZIAFORGE_LOCALES[code]
        const mismatches = [...document.querySelectorAll('[data-i18n]')].filter(node => node.textContent.trim() !== catalog[node.dataset.i18n]).map(node => node.dataset.i18n)
        return { lang: code, dir: document.documentElement.dir, title: document.title, mismatches, guide: document.querySelector('[data-guide]').getAttribute('href'), captions: document.querySelector('#film-captions').getAttribute('srclang'), overflow: document.documentElement.scrollWidth - innerWidth }
      })
      assert.equal(state.dir, rtl.has(locale) ? 'rtl' : 'ltr', `${locale}: direction`)
      assert.deepEqual(state.mismatches, [], `${locale}: visible text must match selected language`)
      assert.ok(state.guide.includes(locale === 'en' ? 'guide.html' : `guides/${locale}.html`), `${locale}: corresponding guide`)
      assert.equal(state.captions, locale, `${locale}: matching captions`)
      assert.ok(state.overflow <= 1, `${locale}: desktop overflow ${state.overflow}`)
      results.locales.push({ locale, passed: true })
    }
    await page.locator('#language-select').selectOption('ru')
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru', 'Language persists after reload')
    await page.locator('#work-tab').click()
    assert.equal(await page.locator('#work-tab').getAttribute('aria-selected'), 'true')
    await page.locator('#work-tab').press('ArrowLeft')
    assert.equal(await page.locator('#code-tab').getAttribute('aria-selected'), 'true', 'Code/Work keyboard switching')
    for (const film of ['forge-overview', 'code-workflow', 'work-workflow']) {
      await page.locator(`[data-film="${film}"]`).click()
      await page.waitForFunction(() => document.querySelector('video').readyState >= 2)
      await page.locator('#forge-video').scrollIntoViewIfNeeded()
      await page.evaluate(async () => { const video = document.querySelector('video'); video.muted = true; await video.play() })
      await page.waitForFunction(() => document.querySelector('video').currentTime > 0.2, null, { timeout: 10000 })
      const media = await page.evaluate(async () => {
        const video = document.querySelector('video'); video.pause()
        const playedTo = video.currentTime
        video.currentTime = video.duration / 2
        await new Promise(resolve => video.addEventListener('seeked', resolve, { once: true }))
        const track = video.textTracks[0]; if (track) track.mode = 'showing'
        for (let attempt = 0; attempt < 30 && !track?.cues?.length; attempt++) await new Promise(resolve => setTimeout(resolve, 100))
        return { duration: video.duration, playedTo, seekedTo: video.currentTime, width: video.videoWidth, height: video.videoHeight, captions: track?.language, cues: track?.cues?.length || 0, error: video.error?.message || null }
      })
      assert.ok(media.playedTo > 0.1, `${film}: actual playback advances`)
      assert.ok(media.seekedTo > 5, `${film}: seeking works`)
      assert.equal(media.width, 1280); assert.equal(media.height, 720)
      assert.equal(media.error, null)
      assert.equal(media.captions, 'ru')
      assert.ok(media.cues > 0, `${film}: captions loaded`)
      results.films.push({ film, ...media, passed: true })
    }
    await page.locator('#language-select').selectOption('en')
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true })
    await page.screenshot({ path: path.join(output, 'desktop-hero.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    for (const locale of ['en', 'ru', 'de', 'my', 'ta', 'ar', 'fa', 'pnb', 'ps', 'sd', 'ur']) {
      await page.locator('#language-select').selectOption(locale)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      assert.ok(overflow <= 1, `${locale}: mobile overflow ${overflow}`)
    }
    await page.locator('#language-select').selectOption('ru')
    await page.locator('#menu-toggle').click()
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true')
    await page.locator('#main-nav a').first().click()
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false', 'Mobile navigation closes after destination')
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true })
    await page.locator('#language-select').selectOption('ar')
    await page.screenshot({ path: path.join(output, 'mobile-rtl.png'), fullPage: true })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    for (const locale of ['en', 'ru', 'ar']) {
      const guideUrl = new URL(locale === 'en' ? 'guide.html' : `guides/${locale}.html`, contentBase)
      await page.goto(guideUrl.href, { waitUntil: 'networkidle' })
      assert.equal(await page.locator('html').getAttribute('lang'), locale)
      assert.ok(await page.locator('#guide section').count() >= 20)
      const search = page.locator('.guide-search')
      if (await search.count()) {
        await search.fill('zzzz-no-guide-match-zzzz')
        assert.equal(await page.locator('.guide-sidebar nav a:visible').count(), 0, 'Guide search filters sections')
        await search.fill('')
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, `${locale}: guide mobile overflow`)
      results.guides.push({ locale, passed: true })
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(new URL('guide.html', contentBase).href, { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(output, 'guide-desktop.png') })
    assert.deepEqual(badResponses, [], 'No broken local resource requests')
    assert.deepEqual(results.errors, [], 'No browser runtime errors')
    results.passed = true
  } catch (error) { results.passed = false; results.failure = error.stack; throw error }
  finally { await browser.close(); results.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(results, null, 2) + '\n'); process.stdout.write(`Website browser report: ${output}\n`) }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1 })
