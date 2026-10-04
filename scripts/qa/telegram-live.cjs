#!/usr/bin/env node
// Explicit live verification against the owner's private bot and a running application.
// Credentials are read from a private file, never arguments/environment/logs/receipts.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const ts = require('typescript')
const { identity } = require('./common.cjs')
const [credentialFile, evidenceDirectory, durationArgument = '900'] = process.argv.slice(2)
if (!credentialFile || !evidenceDirectory || process.argv.length > 5) {
  console.error('Usage: node scripts/qa/telegram-live.cjs PRIVATE_CREDENTIALS_JSON NEW_EVIDENCE_DIRECTORY [DURATION_SECONDS]')
  console.error('Private JSON: {token, ownerId, endpoint, accessToken, buildIdentityFile}. Use a current packaged application and its build-identity.json, with an isolated profile and read-only remote control. While this command runs, send /status; use Projects, Back/Home, Language, choose a language (or Use app language), and Screenshot in Telegram. Menus normally edit the existing card. Only real owner updates and successful Bot API replies count; the initial welcome does not.')
  process.exit(2)
}
const project = path.resolve(__dirname, '../..')
const duration = Number(durationArgument)
if (!Number.isSafeInteger(duration) || duration < 30 || duration > 3600) throw new Error('Duration must be 30–3600 seconds')
if (!path.isAbsolute(credentialFile) || !fs.lstatSync(credentialFile).isFile() || fs.statSync(credentialFile).mode & 0o077) throw new Error('Credentials require an absolute private regular file (0600)')
const credential = JSON.parse(fs.readFileSync(credentialFile, 'utf8'))
if (typeof credential.buildIdentityFile !== 'string' || !path.isAbsolute(credential.buildIdentityFile) || !fs.lstatSync(credential.buildIdentityFile).isFile()) throw new Error('The verified package build-identity.json is required')
const expectedBuild = JSON.parse(fs.readFileSync(credential.buildIdentityFile, 'utf8'))
const source = identity()
if (!/^\d+\.\d+\.\d+$/.test(expectedBuild.version) || !/^[a-f0-9]{40}$/.test(expectedBuild.source?.commit) || !/^[a-f0-9]{64}$/.test(expectedBuild.source?.workingTreeSha256) || expectedBuild.source.commit !== source.commit || expectedBuild.source.workingTreeSha256 !== source.workingTreeSha256) throw new Error('The expected package does not match the current source tree')
const expectedHelpSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(project, 'docs/help/en.json'))).digest('hex')
const endpoint = new URL(credential.endpoint)
if (!['http:', 'https:'].includes(endpoint.protocol) || !['127.0.0.1', '[::1]', 'localhost'].includes(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash || !/^[a-f0-9]{64}$/.test(credential.accessToken)) throw new Error('A loopback application endpoint and its private access token are required')
fs.mkdirSync(evidenceDirectory, { mode: 0o700 })
const snapshot = path.join(evidenceDirectory, 'source-snapshot')
const metadata = { schemaVersion: 1, startedAt: new Date().toISOString(), source, expectedBuild: { buildId: expectedBuild.buildId, version: expectedBuild.version, source: expectedBuild.source }, expectedHelpSha256, backend: 'running application over its authenticated control API', inbound: [], handledInbound: [], requests: [], backendCommands: [], status: 'starting' }
const save = () => fs.writeFileSync(path.join(evidenceDirectory, 'result.json'), JSON.stringify(metadata, null, 2) + '\n', { mode: 0o600 })
const copied = new Set()
function compile(file) {
  if (copied.has(file)) return
  copied.add(file)
  const relative = path.relative(project, file)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Source import is outside the project')
  const source = fs.readFileSync(file)
  const target = path.join(snapshot, relative.replace(/\.ts$/, '.js'))
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  if (file.endsWith('.json')) { fs.writeFileSync(target, source); return }
  const compiled = ts.transpileModule(source.toString('utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, resolveJsonModule: true }, fileName: file }).outputText
  fs.writeFileSync(target, compiled)
  for (const match of compiled.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
    const base = path.resolve(path.dirname(file), match[1])
    const dependency = [base, base + '.ts', base + '.json', path.join(base, 'index.ts')].find(item => fs.existsSync(item) && fs.statSync(item).isFile())
    if (!dependency) throw new Error('Relative source dependency is unavailable')
    compile(dependency)
  }
}
const realFetch = global.fetch
let bot
let stop
let signalTimer
let stopping = false
let currentDispatch
async function close(reason) {
  if (stopping) return
  stopping = true
  clearTimeout(signalTimer)
  try { await bot?.close() } catch { metadata.shutdown = 'application command was still settling' }
  metadata.status = bot?.status() === 'stopped' ? 'completed' : 'stopped-with-error'
  metadata.finishedAt = new Date().toISOString()
  metadata.stopReason = reason
  metadata.sourceAtFinish = identity()
  metadata.sourceUnchanged = metadata.sourceAtFinish.commit === source.commit && metadata.sourceAtFinish.workingTreeSha256 === source.workingTreeSha256
  if (!metadata.backendIdentityVerified || !metadata.sourceUnchanged || metadata.failure) { metadata.status = 'failed'; process.exitCode = 1 }
  metadata.inboundVerified = metadata.handledInbound.some(item => item.ok)
  const handled = metadata.handledInbound.filter(item => item.ok)
  const related = (items, updateId, predicate) => items.some(item => item.updateId === updateId && predicate(item))
  const cardReply = request => ['sendMessage', 'editMessageText'].includes(request.method) && request.ok && request.inlineKeyboard && request.publishedMessage
  const callbackReply = (item, predicate) => item.kind === 'callback' && related(metadata.requests, item.updateId, request => request.method === 'answerCallbackQuery' && request.ok) && related(metadata.requests, item.updateId, predicate)
  metadata.checks = {
    currentBackendAndHelp: metadata.backendIdentityVerified === true,
    unchangedSource: metadata.sourceUnchanged,
    liveStatusCommand: handled.some(item => item.command === 'status' && related(metadata.backendCommands, item.updateId, command => command.method === 'system.summary' && command.ok) && related(metadata.requests, item.updateId, request => request.method === 'sendMessage' && request.ok)),
    inlineMenu: handled.some(item => callbackReply(item, request => cardReply(request) || request.method === 'sendPhoto' && request.ok)),
    editedMenuCard: handled.some(item => item.navigation && callbackReply(item, request => cardReply(request) && request.method === 'editMessageText' && request.sameMessage)),
    languageMenu: handled.some(item => (item.navigation === 'languages' || item.command === 'language') && related(metadata.requests, item.updateId, cardReply)),
    languageChoice: handled.some(item => item.navigation === 'language' && callbackReply(item, cardReply)),
    screenshotUpload: handled.some(item => (item.command === 'screenshot' || item.callback === 'menu:screenshot' || item.navigation === 'screenshot') && related(metadata.backendCommands, item.updateId, command => command.method === 'system.screenshot' && command.ok) && related(metadata.requests, item.updateId, request => request.method === 'sendPhoto' && request.ok)),
    normalStop: bot?.status() === 'stopped',
  }
  save()
  global.fetch = realFetch
  stop?.()
}
process.once('SIGINT', () => { void close('SIGINT') })
process.once('SIGTERM', () => { void close('SIGTERM') })
async function execute(request) {
  const response = await realFetch(new URL('/api/command', endpoint), { method: 'POST', headers: { Authorization: `Bearer ${credential.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request), redirect: 'error', signal: AbortSignal.timeout(30000) })
  const envelope = await response.json()
  metadata.backendCommands.push({ at: new Date().toISOString(), phase: currentDispatch ? 'bot-dispatch' : 'preflight', updateId: currentDispatch?.updateId, method: request.method, httpStatus: response.status, ok: response.ok && envelope.ok === true })
  save()
  if (!response.ok || envelope.ok !== true) throw new Error('Application control command rejected')
  return envelope.result
}
async function main() {
  if (stopping) return
  const settings = await execute({ method: 'getSettings' })
  metadata.language = settings.uiLanguage || 'en'
  metadata.backendVersion = await execute({ method: 'getAppVersion' })
  const expectedFullVersion = `${expectedBuild.version}-${expectedBuild.mode === 'development' ? 'dev' : 'release'}.${source.commit.slice(0, 8)}`
  const catalog = await execute({ method: 'system.commands' })
  if (metadata.backendVersion.version !== expectedBuild.version || metadata.backendVersion.fullVersion !== expectedFullVersion || catalog.documentation?.sourceSha256 !== expectedHelpSha256) throw new Error('Running backend identity or canonical help does not match the current package')
  metadata.backendIdentityVerified = true
  await execute({ method: 'system.summary' })
  compile(path.join(project, 'electron/control/TelegramBot.ts'))
  metadata.snapshot = [...copied].sort().map(file => ({ file: path.relative(project, file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }))
  const { TelegramBot } = require(path.join(snapshot, 'electron/control/TelegramBot.js'))
  global.fetch = async (input, options) => {
    const url = new URL(String(input))
    if (url.hostname !== 'api.telegram.org') return realFetch(input, options)
    const method = url.pathname.split('/').at(-1)
    const updateId = currentDispatch?.updateId
    let response
    try { response = await realFetch(input, options) } catch { throw new Error('Telegram transport unavailable') }
    const value = await response.clone().json().catch(() => ({}))
    const payload = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined
    const resultMessage = value.result && typeof value.result === 'object' && Number.isSafeInteger(value.result.message_id) && value.result.message_id > 0
    // Retain only structural delivery evidence. No card text, button labels,
    // callback tokens, owner/chat/message IDs or credentials enter the receipt.
    metadata.requests.push({ at: new Date().toISOString(), updateId, method, httpStatus: response.status, ok: response.ok && value.ok === true,
      ...(['sendMessage', 'editMessageText'].includes(method) ? {
        inlineKeyboard: Array.isArray(payload?.reply_markup?.inline_keyboard) && payload.reply_markup.inline_keyboard.length > 0,
        publishedMessage: !!resultMessage,
        sameMessage: method === 'editMessageText' && resultMessage && value.result.message_id === payload?.message_id,
      } : {}),
    })
    if (method === 'getUpdates' && typeof options?.body === 'string' && JSON.parse(options.body).offset !== -1 && Array.isArray(value.result)) {
      for (const update of value.result) {
        const message = update.callback_query?.message ?? update.message
        const from = update.callback_query?.from ?? message?.from
        if (message?.chat?.type !== 'private' || String(message.chat.id) !== String(credential.ownerId) || String(from?.id) !== String(credential.ownerId) || from?.is_bot) continue
        metadata.inbound.push({ updateId: update.update_id, kind: update.callback_query ? 'callback' : 'message', command: /^\/([a-z]+)(?:@|\s|$)/.exec(message?.text || '')?.[1], callback: update.callback_query?.data?.startsWith('menu:') ? update.callback_query.data : update.callback_query ? 'single-use action' : undefined })
      }
    }
    save()
    return response
  }
  if (stopping) return
  const webhookResponse = await realFetch(`https://api.telegram.org/bot${credential.token}/getWebhookInfo`, { redirect: 'error', signal: AbortSignal.timeout(20000) })
  const webhook = await webhookResponse.json()
  if (!webhookResponse.ok || !webhook.ok || webhook.result?.url) throw new Error('Polling ownership is not available')
  if (stopping) return
  bot = new TelegramBot({ token: credential.token, owner: String(credential.ownerId), directory: path.join(evidenceDirectory, 'offsets'), getLanguage: () => metadata.language, execute, assistant: text => execute({ method: 'control.assistantSend', args: [{ text }] }), screenshot: () => execute({ method: 'system.screenshot' }) })
  const originalHandle = bot.handle.bind(bot)
  const originalNavigate = bot.navigate.bind(bot)
  bot.navigate = async (action, updateId, signal, messageId) => {
    // This observes production navigation only after owner authentication,
    // message binding and single-use callback validation. Never invoke it here.
    if (currentDispatch?.updateId === updateId && ['home', 'help', 'screenshot', 'projects', 'tasks', 'project', 'task', 'run', 'pause', 'chats', 'chat', 'languages', 'language'].includes(action.kind)) currentDispatch.navigation = action.kind
    return originalNavigate(action, updateId, signal, messageId)
  }
  // Observe only production handle calls: polling has already authenticated the
  // owner and durably saved the offset. Observing a getUpdates payload is not
  // successful dispatch. No synthetic update is injected into polling.
  bot.handle = async (update, signal) => {
    const callback = update.callback_query
    currentDispatch = { updateId: update.update_id, kind: callback ? 'callback' : 'message', command: /^\/([a-z]+)(?:@|\s|$)/.exec(update.message?.text || '')?.[1], callback: callback?.data?.startsWith('menu:') ? callback.data : callback ? 'single-use action' : undefined }
    const receipt = { ...currentDispatch, ok: false }
    try { await originalHandle(update, signal); receipt.ok = true }
    finally { Object.assign(receipt, currentDispatch); metadata.handledInbound.push(receipt); currentDispatch = undefined; save() }
  }
  await bot.start()
  if (stopping) return
  // Outbound welcome is explicitly not proof of a received Telegram command.
  await bot.command('start', '', 0, new AbortController().signal)
  if (stopping) return
  metadata.status = 'listening'; save()
  console.log(JSON.stringify({ status: 'listening', evidence: path.join(evidenceDirectory, 'result.json'), durationSeconds: duration, userActions: '/status; Projects; Back/Home; Language; choose a language or Use app language; Screenshot', evidenceRules: 'Only handled owner updates count. Edited cards require a successful editMessageText result for the same message. The initial welcome is outbound-only. Stop with Ctrl+C after these actions.' }))
  await new Promise(resolve => { stop = resolve; signalTimer = setTimeout(() => { void close('duration elapsed') }, duration * 1000) })
  console.log(JSON.stringify({ status: metadata.status, checks: metadata.checks, inboundVerified: metadata.inboundVerified, evidence: path.join(evidenceDirectory, 'result.json') }))
}
main().catch(async () => {
  metadata.failure = 'Live verification stopped: inspect application configuration, bot polling ownership or connectivity. Raw transport errors are deliberately omitted.'
  await close('verification error'); process.exitCode = 1
})
