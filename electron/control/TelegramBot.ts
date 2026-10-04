import path from 'node:path'
import { translate, translateText, normalizeLocale, formatDate, formatNumber } from '../../src/i18n-core'
import { UI_LANGUAGES } from '../../src/languages'
import { randomBytes } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { AssistantState, ControlRequest } from '../../shared/control'
import { RecoveryStore } from '../runtime/RecoveryStore'
import { validateControlRequest } from './ControlPolicy'

export interface TelegramBotOptions {
  token: string
  owner: string
  directory: string
  getLanguage?(): string
  execute(request: ControlRequest): Promise<unknown>
  assistant(text: string): Promise<AssistantState>
  screenshot(): Promise<{ dataUrl: string }>
}
interface OffsetState { version: 1; botId: string; owner: string; offset: number }
interface LanguageState { version: 1; botId: string; owner: string; locale: string | null }
interface TelegramMessage { message_id?: number; date?: number; from?: { id?: number; is_bot?: boolean }; chat?: { id?: number; type?: string }; text?: string }
interface TelegramUpdate { update_id: number; message?: TelegramMessage; callback_query?: { id?: string; from?: { id?: number; is_bot?: boolean }; message?: TelegramMessage; data?: string } }
interface Button { text: string; callback_data: string }
interface Item { id: string; name?: string; status?: string; repoId?: string; workFlowVersion?: number; providerModel?: string; model?: string }
type ButtonTarget = { kind: 'home' | 'help' | 'screenshot' }
  | { kind: 'languages'; page?: number }
  | { kind: 'language'; locale: string | null; page: number }
  | { kind: 'projects'; page?: number }
  | { kind: 'tasks'; repoId?: string; page?: number }
  | { kind: 'project'; repoId: string }
  | { kind: 'task' | 'run' | 'pause'; taskId: string }
  | { kind: 'chats'; taskId: string; page?: number }
  | { kind: 'chat'; taskId: string; chatId: string }
type ButtonAction = ButtonTarget & { expires: number; messageId?: number }
interface Chat { id: string; name: string }
class TelegramError extends Error {
  constructor(readonly code: number, readonly retryAfter = 0) { super(`Telegram API unavailable (${code})`) }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,160}$/.test(value)
const safeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

/**
 * Owner-activated polling only. Constructor makes no network call.
 * Bot API: https://core.telegram.org/bots/api#getupdates
 * A durable offset is saved BEFORE dispatch: an unknown interrupted command is
 * never replayed on restart. This is at-most-once acceptance, not guaranteed completion.
 */
export class TelegramBot {
  private readonly store: RecoveryStore<OffsetState>
  private readonly languageStore: RecoveryStore<LanguageState>
  private languageOverride: string | null = null
  private readonly botId: string
  private controller?: AbortController
  private startup?: Promise<void>
  private polling?: Promise<void>
  private state = 'stopped'
  private offset = 0
  private readonly actions = new Map<string, ButtonAction>()
  private readonly cards = new Set<number>()

  constructor(private readonly options: TelegramBotOptions) {
    if (!/^\d{1,20}:[A-Za-z0-9_-]{15,180}$/.test(options.token) || !/^\d{1,16}$/.test(options.owner) || !Number.isSafeInteger(Number(options.owner)) || Number(options.owner) <= 0) throw new Error('Telegram requires a valid bot token and numeric private owner ID')
    if (!path.isAbsolute(options.directory)) throw new Error('Telegram storage requires an application-owned absolute directory')
    this.botId = options.token.split(':')[0]
    this.store = new RecoveryStore<OffsetState>({
      filename: path.join(options.directory, `telegram-${this.botId}-${options.owner}.json`), maxBytes: 4096, retainedBackups: 3,
      validate: (value: unknown): asserts value is OffsetState => {
        if (!object(value) || Object.keys(value).some(key => !['version', 'botId', 'owner', 'offset'].includes(key)) || value.version !== 1 || value.botId !== this.botId || value.owner !== options.owner || !safeNumber(value.offset)) throw new Error('Invalid Telegram offset metadata')
      },
    })
    this.languageStore = new RecoveryStore<LanguageState>({
      filename: path.join(options.directory, `telegram-language-${this.botId}-${options.owner}.json`), maxBytes: 4096, retainedBackups: 3,
      validate: (value: unknown): asserts value is LanguageState => {
        if (!object(value) || Object.keys(value).some(key => !['version', 'botId', 'owner', 'locale'].includes(key)) || value.version !== 1 || value.botId !== this.botId || value.owner !== options.owner || value.locale !== null && !UI_LANGUAGES.some(item => item.id === value.locale)) throw new Error('Invalid Telegram language metadata')
      },
    })
  }

  private language(): string { return this.languageOverride ?? normalizeLocale(this.options.getLanguage?.() ?? 'en') }
  private t(key: string, variables?: Record<string, string | number>): string {
    return translate(this.language(), key, variables)
  }
  private menu(): Button[][] {
    return [
      [this.button(`◉ ${this.t('telegram.status')}`, { kind: 'home' }), this.button(`📁 ${this.t('telegram.projects')}`, { kind: 'projects' })],
      [this.button(`☷ ${this.t('telegram.tasks')}`, { kind: 'tasks' }), this.button(`📷 ${this.t('telegram.screenshot')}`, { kind: 'screenshot' })],
      [this.button(`❔ ${this.t('telegram.help')}`, { kind: 'help' }), this.button(`🌐 ${this.t('telegram.language')}`, { kind: 'languages' })],
    ]
  }
  private help(): string { return `${this.t('telegram.title')}\n${this.t('telegram.helpBody')}` }

  status(): string { return this.state }
  private open(signal: AbortSignal) { if (signal.aborted) throw new Error('Telegram is stopping') }
  private persist(offset: number) {
    this.store.write({ version: 1, botId: this.botId, owner: this.options.owner, offset })
    this.offset = offset
  }

  async start(): Promise<void> {
    if (this.controller) throw new Error('Telegram is already started or stopping')
    const controller = new AbortController()
    this.controller = controller
    this.state = 'starting'
    this.startup = (async () => {
      this.offset = this.store.read()?.offset ?? 0
      this.languageOverride = this.languageStore.read()?.locale ?? null
      // Official negative offset selects the tail and forgets earlier pending updates.
      // Never execute a backlog received before this activation, including on first start.
      const tail = this.updates(await this.api('getUpdates', { offset: -1, limit: 1, timeout: 0, allowed_updates: ['message', 'callback_query'] }, controller.signal))
      this.open(controller.signal)
      if (tail.length) this.persist(tail[tail.length - 1].update_id + 1)
      else this.persist(0) // Telegram may randomize update IDs after a week without updates.
      this.state = 'running'
      this.polling = this.poll(controller.signal).catch(() => {
        if (!controller.signal.aborted) this.state = 'error: polling or private offset storage failed; inspect local configuration'
      })
    })()
    try { await this.startup }
    catch (error) {
      controller.abort()
      if (this.controller === controller) this.controller = undefined
      this.state = error instanceof TelegramError ? `error: Telegram API ${error.code}; check token, connectivity and polling ownership` : 'error: Telegram startup or private storage unavailable'
      // Raw network errors contain the token-bearing request URL. Never forward them.
      throw new Error(this.state)
    } finally { this.startup = undefined }
  }

  async close(): Promise<void> {
    const controller = this.controller
    if (!controller) return
    this.state = 'stopping'
    controller.abort()
    this.actions.clear()
    this.cards.clear()
    const wait = Promise.allSettled([this.startup, this.polling].filter(Boolean))
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([wait, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Telegram stopped polling but an application command is still settling')), 10000) })])
      this.state = 'stopped'
      this.controller = undefined
      this.polling = undefined
    } catch (error) { this.state = 'error: application command still settling after Telegram stop'; throw error }
    finally { if (timer) clearTimeout(timer) }
  }

  private async api(method: string, payload: Record<string, unknown> | FormData, signal: AbortSignal): Promise<unknown> {
    this.open(signal)
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), method === 'getUpdates' ? 35000 : 20000)
    try {
      const form = payload instanceof FormData
      const response = await fetch(`https://api.telegram.org/bot${this.options.token}/${method}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, timeout.signal]),
        headers: form ? undefined : { 'Content-Type': 'application/json' }, body: form ? payload : JSON.stringify(payload),
      })
      const reader = response.body?.getReader()
      if (!reader) throw new TelegramError(response.status || 502)
      const chunks: Uint8Array[] = []; let size = 0
      try {
        for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 2 * 1024 * 1024) throw new TelegramError(413); chunks.push(part.value) }
      } finally { await reader.cancel().catch(() => {}) }
      let parsed: unknown
      try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new TelegramError(response.status >= 400 ? response.status : 502) }
      if (!object(parsed) || parsed.ok !== true || !response.ok) {
        const retry = object(parsed) && object(parsed.parameters) && safeNumber(parsed.parameters.retry_after) ? Math.min(parsed.parameters.retry_after, 60) : 0
        throw new TelegramError(object(parsed) && safeNumber(parsed.error_code) ? parsed.error_code : response.status || 502, retry)
      }
      return parsed.result
    } catch (error) { if (error instanceof TelegramError) throw error; throw new TelegramError(0) }
    finally { clearTimeout(timer) }
  }
  private updates(value: unknown): TelegramUpdate[] {
    if (!Array.isArray(value) || value.length > 100 || value.some(item => !object(item) || !safeNumber(item.update_id) || item.update_id >= Number.MAX_SAFE_INTEGER)) throw new TelegramError(502)
    return (value as TelegramUpdate[]).sort((a, b) => a.update_id - b.update_id)
  }
  private async poll(signal: AbortSignal): Promise<void> {
    let failures = 0
    while (!signal.aborted) {
      let updates: TelegramUpdate[]
      try {
        updates = this.updates(await this.api('getUpdates', { offset: this.offset, limit: 30, timeout: 25, allowed_updates: ['message', 'callback_query'] }, signal))
        failures = 0
        this.state = 'running'
      } catch (error) {
        if (signal.aborted) break
        const code = error instanceof TelegramError ? error.code : 0
        this.state = `error: Telegram polling ${code || 'unavailable'}`
        if ([401, 403, 409].includes(code)) return // No webhook deletion or stealing another poller.
        const seconds = error instanceof TelegramError && error.retryAfter ? error.retryAfter : Math.min(30, 2 ** Math.min(failures++, 5))
        await delay(seconds * 1000, undefined, { signal }).catch(() => {})
        continue
      }
      for (const update of updates) {
        if (signal.aborted) return
        if (update.update_id < this.offset) continue
        // A failure here stops polling; no command may execute without durable acceptance.
        this.persist(update.update_id + 1)
        if (!this.authorized(update)) continue
        try { await this.handle(update, signal) }
        catch {
          if (!signal.aborted) {
            this.state = 'error: owner command failed; it was not retried'
            await this.card(`⚠️ ${this.t('telegram.commandFailed')}`, this.menu(), signal, update.callback_query?.message?.message_id).catch(() => {})
          }
        }
      }
    }
  }

  private authorized(update: TelegramUpdate): boolean {
    const callback = update.callback_query
    const message = callback?.message ?? update.message
    const from = callback?.from ?? message?.from
    return message?.chat?.type === 'private' && safeNumber(message.chat.id) && String(message.chat.id) === this.options.owner && safeNumber(from?.id) && String(from.id) === this.options.owner && from.is_bot !== true
  }
  private cleaned(value: unknown): string {
    const text = typeof value === 'string' ? value : JSON.stringify(value, (key, item) => /token|password|secret|authorization|api[-_]?key/i.test(key) ? '[redacted]' : item, 2)
    return Array.from((text ?? this.t('telegram.done')).split(this.options.token).join('[redacted]')).filter(character => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127 || code === 9 || code === 10 || code === 13
    }).join('')
  }
  private async send(value: unknown, signal: AbortSignal, keyboard?: Button[][]): Promise<void> {
    const text = this.cleaned(value)
    // No parse_mode: file names and agent text cannot inject Telegram markup.
    // Bound a result to four messages, with an explicit truncation notice.
    // At most 2000 code points also fits Telegram's limit with surrogate pairs.
    const units = Array.from(text); const maximum = 4 * 2000
    if (units.length > maximum) {
      const notice = Array.from(`\n…${this.t('telegram.truncated')}`).slice(0, 1000)
      units.splice(maximum - notice.length, units.length, ...notice)
    }
    for (let offset = 0; offset < units.length || offset === 0; offset += 2000) {
      this.open(signal)
      await this.api('sendMessage', { chat_id: this.options.owner, text: units.slice(offset, offset + 2000).join('') || this.t('telegram.done'), link_preview_options: { is_disabled: true }, ...(keyboard && offset === 0 ? { reply_markup: { inline_keyboard: keyboard } } : {}) }, signal)
    }
  }
  /** Navigation edits only messages this bot successfully published in this run. */
  private async card(value: string, keyboard: Button[][], signal: AbortSignal, messageId?: number): Promise<void> {
    const units = Array.from(this.cleaned(value))
    const notice = `\n…${this.t('telegram.truncated')}`
    const text = units.length > 1800 ? units.slice(0, Math.max(0, 1800 - Array.from(notice).length)).join('') + notice : units.join('')
    const payload = { chat_id: this.options.owner, text: text || this.t('telegram.done'), link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: keyboard } }
    const ids = new Set(keyboard.flat().map(button => button.callback_data.slice(7)))
    let publishedId: number | undefined
    if (messageId !== undefined && this.cards.has(messageId)) {
      try { await this.api('editMessageText', { ...payload, message_id: messageId }, signal); publishedId = messageId }
      catch (error) {
        // Deleted/too-old Telegram messages may no longer be editable. Do not
        // turn a network/unknown acknowledgement into duplicate messages.
        if (!(error instanceof TelegramError) || error.code !== 400) throw error
        this.cards.delete(messageId)
      }
    }
    if (publishedId === undefined) {
      const sent = await this.api('sendMessage', payload, signal)
      if (object(sent) && safeNumber(sent.message_id) && sent.message_id > 0) publishedId = sent.message_id
    }
    if (publishedId !== undefined) {
      this.cards.add(publishedId)
      for (const [id, action] of this.actions) {
        if (ids.has(id)) action.messageId = publishedId
        else if (action.messageId === messageId) this.actions.delete(id)
      }
      while (this.cards.size > 64) this.cards.delete(this.cards.values().next().value!)
    }
  }
  private label(source: string): string { return translateText(this.language(), source) }
  private statusText(value: unknown): string {
    if (typeof value !== 'string' || !value) return '—'
    const key = value.toLowerCase().replaceAll(' ', '_')
    if (key === 'disconnected') return `⚪ ${this.t('telegram.disconnected')}`
    if (key === 'waiting_for_approval') return `🔐 ${this.t('telegram.awaitingApproval')}`
    const labels: Record<string, [string, string]> = {
      running: ['🟢', 'Running'], in_progress: ['🟢', 'Running'], completed: ['✅', 'Completed'], done: ['✅', 'Completed'],
      draft: ['📝', 'Draft'], idle: ['⚪', 'Idle'], pending: ['⏳', 'Waiting'], waiting: ['⏳', 'Waiting'], waiting_input: ['💬', 'Awaiting an answer'],
      paused: ['⏸', 'Paused'], blocked: ['⛔', 'Blocked'], failed: ['❌', 'Failed'], error: ['❌', 'Error'],
      cancelled: ['🚫', 'Cancelled'], interrupted: ['⏹', 'Interrupted'], uncertain: ['⚠️', 'Outcome unknown'],
      starting: ['⏳', 'Starting'], ready: ['🟢', 'Ready'], stopped: ['⏹', 'Stopped'], stopping: ['⏳', 'Stopping'], interrupting: ['⏳', 'Stopping'],
    }
    return labels[key] ? `${labels[key][0]} ${this.label(labels[key][1])}` : this.cleaned(value)
  }
  private phaseLabel(value: unknown): string {
    const sources: Record<string, string> = {
      intake: 'Task assessment', discovery: 'Task assessment', investigation: 'Bug investigation', requirements: 'Requirements',
      specification: 'Specification', planning: 'Planning', execution: 'Implementation', implementation: 'Implementation',
      divergence: 'Brainstorm', convergence: 'Assessment', research: 'Research', outline: 'Outline', draft: 'Draft', worker: 'Worker',
      helper: 'Helper', synthesis: 'Plan synthesis', revision: 'Correction', review: 'Review', 'review-architect': 'Report architect',
      delivery: 'Delivery report', 'follow-up': 'Follow-up', exploration: 'Exploration', design: 'Design', 'review-worker': 'Review',
      'review-coordinator': 'Review synthesis', fix: 'Correction',
    }
    return typeof value === 'string' && sources[value] ? this.label(sources[value]) : this.t('steps')
  }
  private nav(back: ButtonTarget, refresh: ButtonTarget): Button[][] {
    return [[this.button(`← ${this.t('telegram.back')}`, back), this.button(`↻ ${this.t('model_catalog_refresh')}`, refresh), this.button(`⌂ ${this.t('telegram.home')}`, { kind: 'home' })]]
  }
  private pages(total: number, page: number, target: (page: number) => ButtonTarget): Button[][] {
    const buttons: Button[] = []
    if (page > 0) buttons.push(this.button(`‹ ${this.t('telegram.previous')}`, target(page - 1)))
    if ((page + 1) * 8 < total) buttons.push(this.button(`${this.t('telegram.next')} ›`, target(page + 1)))
    return buttons.length ? [buttons] : []
  }
  private pageIndex(page: number | undefined, total: number): number { return Math.max(0, Math.min(page ?? 0, Math.ceil(total / 8) - 1)) }
  private count(total: number, page: number): string { return total ? this.t('telegram.page', { from: page * 8 + 1, to: Math.min(total, (page + 1) * 8), total }) : this.t('telegram.empty') }
  private async overview(signal: AbortSignal, messageId?: number): Promise<void> {
    const value = await this.execute({ method: 'system.summary' }, signal)
    if (!object(value)) throw new Error('Invalid application summary')
    const tasks = Array.isArray(value.tasks) ? this.items(value.tasks) : []
    const projects = Array.isArray(value.repositories) ? this.items(value.repositories) : []
    const version = object(value.version) && typeof value.version.version === 'string' ? value.version.version : typeof value.version === 'string' ? value.version : ''
    const statuses = new Map<string, number>()
    for (const task of tasks) if (task.status) statuses.set(task.status, (statuses.get(task.status) ?? 0) + 1)
    const lines = [`⚒ ${this.t('telegram.title')}`, version ? `${this.t('version')}: ${version}` : '', this.t('telegram.overview', { projects: projects.length, tasks: tasks.length }), ...[...statuses].slice(0, 8).map(([status, count]) => `${this.statusText(status)} · ${this.t('telegram.tasks')}: ${formatNumber(this.language(), count)}`)]
    await this.card(lines.filter(Boolean).join('\n'), this.menu(), signal, messageId)
  }
  private async languages(signal: AbortSignal, page = 0, messageId?: number): Promise<void> {
    page = this.pageIndex(page, UI_LANGUAGES.length)
    const rows = UI_LANGUAGES.slice(page * 8, (page + 1) * 8).map(item => [this.button(`${this.languageOverride === item.id ? '✓' : '🌐'} ${item.name}`, { kind: 'language', locale: item.id, page })])
    await this.card(`🌐 ${this.t('telegram.language')}\n${this.t('telegram.languageHint')}\n\n${this.count(UI_LANGUAGES.length, page)}`, [
      [this.button(`${this.languageOverride === null ? '✓' : '↳'} ${this.t('telegram.useAppLanguage')}`, { kind: 'language', locale: null, page })],
      ...rows, ...this.pages(UI_LANGUAGES.length, page, next => ({ kind: 'languages', page: next })), ...this.nav({ kind: 'home' }, { kind: 'languages', page }),
    ], signal, messageId)
  }
  private async execute(request: ControlRequest, signal: AbortSignal): Promise<unknown> {
    this.open(signal)
    validateControlRequest(request)
    return this.options.execute(request)
  }
  private button(text: string, action: ButtonTarget): Button {
    for (const [id, entry] of this.actions) if (entry.expires < Date.now()) this.actions.delete(id)
    while (this.actions.size >= 256) this.actions.delete(this.actions.keys().next().value!)
    const id = randomBytes(12).toString('hex')
    this.actions.set(id, { ...action, expires: Date.now() + 15 * 60 * 1000 })
    return { text: Array.from(this.cleaned(text).replace(/[\r\n]+/g, ' ')).slice(0, 60).join(''), callback_data: `action:${id}` }
  }
  private items(value: unknown): Item[] {
    if (!Array.isArray(value) || value.some(item => !object(item) || !validId(item.id))) throw new Error('Invalid application list')
    return value as Item[]
  }
  private async task(taskId: string, signal: AbortSignal): Promise<Item> {
    if (!validId(taskId)) throw new Error('Invalid task identity')
    const task = this.items(await this.execute({ method: 'getTasks' }, signal)).find(item => item.id === taskId)
    if (!task) throw new Error('Task not found')
    return task
  }
  private gate(snapshot: Record<string, unknown>): Record<string, unknown> | undefined {
    const value = object(snapshot.codeFlow) ? snapshot.codeFlow.pending : snapshot.pending
    return object(value) ? value : undefined
  }
  private async taskCard(task: Item, snapshot: unknown, signal: AbortSignal, messageId?: number, notice?: string): Promise<void> {
    const flow = object(snapshot) ? snapshot : undefined
    const gate = flow && this.gate(flow)
    const steps = flow && (Array.isArray(flow.steps) ? flow.steps : Array.isArray(flow.plan) ? flow.plan : [])
    const done = steps?.filter(step => object(step) && step.status === 'completed').length ?? 0
    const lines = [`${task.workFlowVersion === 1 ? '✍️' : '⚒'} ${task.name ?? task.id}`, this.statusText(flow?.status ?? task.status)]
    if (notice) lines.push(notice)
    if (!flow) lines.push(this.t('telegram.noWorkflow'))
    else {
      if (steps?.length) lines.push(this.t('telegram.progress', { done, total: steps.length }))
      if (typeof flow.updatedAt === 'number' && Number.isFinite(flow.updatedAt)) lines.push(`🕒 ${formatDate(this.language(), flow.updatedAt)}`)
      if (typeof flow.reason === 'string') lines.push(flow.reason)
      if (gate) {
        lines.push(`🔐 ${this.t('telegram.gatePending')}`)
        if (typeof gate.summary === 'string') lines.push(gate.summary)
        if (Array.isArray(gate.questions)) for (const question of gate.questions.slice(0, 3)) if (object(question) && typeof question.question === 'string') lines.push(`❓ ${question.question}`)
      }
    }
    if (task.providerModel) lines.push(`${this.t('model')}: ${task.providerModel}`)
    else if (task.model) lines.push(`${this.t('agent_chat_preset')}: ${task.model}`)
    const actions: Button[] = []
    if (flow && safeNumber(flow.revision) && !gate && !['running', 'completed', 'cancelled'].includes(String(flow.status))) actions.push(this.button(`▶️ ${this.t('telegram.runContinue')}`, { kind: 'run', taskId: task.id }))
    if (flow?.status === 'running') actions.push(this.button(`⏸ ${this.t('telegram.pause')}`, { kind: 'pause', taskId: task.id }))
    await this.card(lines.join('\n\n'), [
      ...(actions.length ? [actions] : []),
      [this.button(`💬 ${this.t('chats')}`, { kind: 'chats', taskId: task.id })],
      ...this.nav({ kind: 'tasks', ...(task.repoId ? { repoId: task.repoId } : {}) }, { kind: 'task', taskId: task.id }),
    ], signal, messageId)
  }
  private async taskAction(kind: 'task' | 'run' | 'pause', taskId: string, updateId: number, signal: AbortSignal, messageId?: number): Promise<void> {
    const task = await this.task(taskId, signal)
    const prefix = task.workFlowVersion === 1 ? 'workFlows' : 'workflows'
    const snapshot = await this.execute({ method: `${prefix}.get`, args: [{ taskId }] }, signal)
    if (kind === 'task') { await this.taskCard(task, snapshot, signal, messageId); return }
    if (!object(snapshot) || !safeNumber(snapshot.revision)) throw new Error('No saved workflow')
    // A button never substitutes for an explicit document, plan or review decision.
    if (kind === 'run' && this.gate(snapshot)) { await this.taskCard(task, snapshot, signal, messageId); return }
    const commandId = `telegram-${this.options.owner}-${updateId}`
    const request = kind === 'run' ? { taskId, revision: snapshot.revision, commandId } : { taskId }
    const outcome = await this.execute({ method: `${prefix}.${kind === 'run' ? 'start' : 'pause'}`, args: [request], requestId: commandId }, signal)
    await this.taskCard(task, outcome, signal, messageId)
  }
  private async list(kind: 'projects' | 'tasks', signal: AbortSignal, repoId?: string, page = 0, messageId?: number): Promise<void> {
    let projectName: string | undefined
    if (repoId) {
      if (!validId(repoId)) throw new Error('Invalid project')
      const project = this.items(await this.execute({ method: 'getRepositories' }, signal)).find(item => item.id === repoId)
      if (!project) throw new Error('Project no longer exists')
      projectName = project.name ?? project.id
    }
    let items = this.items(await this.execute({ method: kind === 'projects' ? 'getRepositories' : 'getTasks' }, signal))
    if (repoId) items = items.filter(item => item.repoId === repoId)
    page = this.pageIndex(page, items.length)
    const subset = items.slice(page * 8, (page + 1) * 8)
    const heading = `${kind === 'projects' ? '📁' : '☷'} ${projectName ?? this.t(`telegram.${kind}`)}`
    const text = subset.map(item => `${kind === 'projects' ? '📁' : this.statusText(item.status)} ${item.name ?? item.id}`).join('\n')
    const rows = subset.map(item => [this.button(`${kind === 'projects' ? '📁' : '▸'} ${item.name ?? item.id}`, kind === 'projects' ? { kind: 'project', repoId: item.id } : { kind: 'task', taskId: item.id })])
    const target = (next: number): ButtonTarget => kind === 'projects' ? { kind: 'projects', page: next } : { kind: 'tasks', repoId, page: next }
    await this.card(`${heading}\n${this.count(items.length, page)}${text ? `\n\n${text}` : ''}`, [
      ...rows, ...this.pages(items.length, page, target), ...this.nav(kind === 'projects' || !repoId ? { kind: 'home' } : { kind: 'projects' }, target(page)),
    ], signal, messageId)
  }
  private async context(taskId: string, signal: AbortSignal, chatId?: string): Promise<Record<string, unknown>> {
    if (!validId(taskId) || chatId !== undefined && !validId(chatId)) throw new Error('Invalid chat identity')
    const value = await this.execute({ method: 'system.context', args: [{ taskId, ...(chatId ? { chatId } : {}) }] }, signal)
    if (!object(value) || !object(value.task) || value.task.id !== taskId) throw new Error('Task context changed')
    return value
  }
  private chatsFrom(context: Record<string, unknown>): Chat[] {
    const chats = new Map<string, Chat>()
    const add = (id: unknown, name: unknown) => { if (validId(id)) chats.set(id, { id, name: typeof name === 'string' && name ? name : id }) }
    const saved = object(context.chats) ? context.chats : {}
    for (const item of [...(Array.isArray(saved.centralTabs) ? saved.centralTabs : []), ...(Array.isArray(saved.recentTabs) ? saved.recentTabs : [])]) if (object(item) && item.type === 'chat') add(item.id, item.name)
    if (!chats.has('chat-main')) add('chat-main', this.t('ui.discussion'))
    const workflow = object(context.workflow) ? context.workflow : {}
    if (object(workflow.codeFlow) && Array.isArray(workflow.codeFlow.dialogue)) add('forge-discussion', `⚒ ${this.t('ui.discussion')}`)
    const session = (value: unknown, title: string) => { if (object(value) && !chats.has(String(value.chatId))) add(value.chatId, title) }
    const rows = Array.isArray(workflow.steps) ? [...workflow.steps] : []
    if (object(workflow.codeFlow) && Array.isArray(workflow.codeFlow.retiredSteps)) for (const item of workflow.codeFlow.retiredSteps) if (object(item)) rows.push(item.state)
    for (const step of rows) if (object(step) && Array.isArray(step.attempts)) for (const attempt of step.attempts) if (object(attempt)) {
      const plan = object(workflow.plan) && Array.isArray(workflow.plan.steps) ? workflow.plan.steps : []
      const definition = plan.find(item => object(item) && item.id === step.id)
      const title = object(definition) && typeof definition.title === 'string' ? definition.title : this.t('steps')
      session(attempt.session, title); session(attempt.reviewerSession, this.label('Review'))
      if (object(attempt.architect)) session(attempt.architect.session, this.label('Report architect'))
      for (const key of ['helperSources', 'reviewSources', 'multiStages']) if (Array.isArray(attempt[key])) for (const source of attempt[key]) if (object(source)) session(source.session, `${title} · ${typeof source.kind === 'string' ? this.phaseLabel(source.kind) : this.label(key === 'helperSources' ? 'Helper' : 'Review')}`)
    }
    if (Array.isArray(workflow.stages)) for (const stage of workflow.stages) if (object(stage) && Array.isArray(stage.invocations)) for (const invocation of stage.invocations) if (object(invocation)) session(invocation.session, this.phaseLabel(stage.phase))
    return [...chats.values()]
  }
  private async chats(taskId: string, signal: AbortSignal, page = 0, messageId?: number): Promise<void> {
    const context = await this.context(taskId, signal), chats = this.chatsFrom(context)
    page = this.pageIndex(page, chats.length)
    const rows = chats.slice(page * 8, (page + 1) * 8).map(chat => [this.button(`💬 ${chat.name}`, { kind: 'chat', taskId, chatId: chat.id })])
    const title = object(context.task) && typeof context.task.name === 'string' ? context.task.name : this.t('telegram.tasks')
    await this.card(`💬 ${title}\n${this.count(chats.length, page)}\n\n${this.t('telegram.chatReadOnly')}`, [
      ...rows, ...this.pages(chats.length, page, next => ({ kind: 'chats', taskId, page: next })), ...this.nav({ kind: 'task', taskId }, { kind: 'chats', taskId, page }),
    ], signal, messageId)
  }
  private async chat(taskId: string, chatId: string, signal: AbortSignal, messageId?: number): Promise<void> {
    // Re-enumerate authoritative task references; opaque callbacks cannot grant
    // access to a made-up or another task's session. Attach never sends a prompt.
    let context = await this.context(taskId, signal)
    const selected = this.chatsFrom(context).find(chat => chat.id === chatId)
    if (!selected) throw new Error('Chat no longer exists')
    const workflow = object(context.workflow) ? context.workflow : {}
    let entries: unknown[] = []
    let session: Record<string, unknown> | undefined
    if (chatId === 'forge-discussion' && object(workflow.codeFlow) && Array.isArray(workflow.codeFlow.dialogue)) entries = workflow.codeFlow.dialogue
    else {
      context = await this.context(taskId, signal, chatId)
      session = object(context.session) ? context.session : undefined
      if (session && Array.isArray(session.feed)) entries = session.feed
      else if (object(context.chats) && object(context.chats.customTabFeeds) && Array.isArray(context.chats.customTabFeeds[chatId])) {
        // Saved terminal-era FeedItems use type rather than role. Project only
        // conversational text; tool, prompt, commit and thinking data stay private.
        entries = context.chats.customTabFeeds[chatId].flatMap((item: unknown) => object(item) &&
          (item.type === 'user' || item.type === 'ai') && typeof item.text === 'string'
          ? [{ role: item.type === 'user' ? 'user' : 'assistant', text: item.text }] : [])
      }
    }
    const messages = entries.filter(item => object(item) && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string' && item.text).slice(-6)
    const lines = [`💬 ${selected.name}`]
    if (session) lines.push([this.statusText(object(session.activeTurn) ? session.activeTurn.status : session.sessionStatus), session.model].filter(item => typeof item === 'string').join(' · '))
    lines.push(this.t(chatId.startsWith('wf-') || chatId.startsWith('work-') || chatId === 'forge-discussion' ? 'telegram.chatManaged' : 'telegram.chatReadOnly'))
    if (!messages.length) lines.push(this.t('telegram.noMessages'))
    for (const item of messages) if (object(item)) {
      const text = Array.from(String(item.text))
      lines.push(`${item.role === 'user' ? '👤' : '🤖'} ${text.length > 200 ? '…' : ''}${text.slice(-200).join('')}`)
    }
    await this.card(lines.join('\n\n'), this.nav({ kind: 'chats', taskId }, { kind: 'chat', taskId, chatId }), signal, messageId)
  }
  private async navigate(action: ButtonTarget, updateId: number, signal: AbortSignal, messageId?: number): Promise<void> {
    if (action.kind === 'home') return this.overview(signal, messageId)
    if (action.kind === 'help') return this.card(this.help(), this.menu(), signal, messageId)
    if (action.kind === 'screenshot') return this.screenshot(signal)
    if (action.kind === 'projects') return this.list('projects', signal, undefined, action.page, messageId)
    if (action.kind === 'tasks') return this.list('tasks', signal, action.repoId, action.page, messageId)
    if (action.kind === 'project') return this.list('tasks', signal, action.repoId, 0, messageId)
    if (action.kind === 'chats') return this.chats(action.taskId, signal, action.page, messageId)
    if (action.kind === 'chat') return this.chat(action.taskId, action.chatId, signal, messageId)
    if (action.kind === 'languages') return this.languages(signal, action.page, messageId)
    if (action.kind === 'language') {
      if (action.locale !== null && !UI_LANGUAGES.some(item => item.id === action.locale)) throw new Error('Invalid Telegram language')
      this.open(signal)
      this.languageStore.write({ version: 1, botId: this.botId, owner: this.options.owner, locale: action.locale })
      this.languageOverride = action.locale
      return this.languages(signal, action.page, messageId)
    }
    if (action.kind === 'task' || action.kind === 'run' || action.kind === 'pause') return this.taskAction(action.kind, action.taskId, updateId, signal, messageId)
    throw new Error('Unknown Telegram navigation action')
  }
  private async screenshot(signal: AbortSignal) {
    this.open(signal)
    const result = await this.options.screenshot()
    this.open(signal)
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(result.dataUrl)
    if (!match || match[2].length > 12 * 1024 * 1024) throw new Error('Unsupported screenshot')
    const bytes = Buffer.from(match[2], 'base64')
    if (!bytes.length || bytes.length > 9 * 1024 * 1024) throw new Error('Screenshot exceeds limit')
    const form = new FormData()
    form.set('chat_id', this.options.owner)
    form.set('caption', this.t('telegram.screenshotCaption'))
    form.set('photo', new Blob([new Uint8Array(bytes)], { type: `image/${match[1]}` }), `ziaforge.${match[1] === 'jpeg' ? 'jpg' : 'png'}`)
    await this.api('sendPhoto', form, signal)
  }
  private async handle(update: TelegramUpdate, signal: AbortSignal): Promise<void> {
    const callback = update.callback_query
    if (callback) {
      if (typeof callback.id !== 'string' || callback.id.length > 300 || typeof callback.data !== 'string') return
      await this.api('answerCallbackQuery', { callback_query_id: callback.id }, signal)
      if (callback.data.startsWith('action:')) {
        const id = callback.data.slice(7), action = this.actions.get(id)
        if (action?.messageId !== undefined && action.messageId !== callback.message?.message_id) { await this.send(this.t('telegram.staleButton'), signal); return }
        this.actions.delete(id) // Single-use action; a second click cannot repeat mutation.
        if (!action || action.expires < Date.now()) { await this.send(this.t('telegram.staleButton'), signal); return }
        await this.navigate(action, update.update_id, signal, callback.message?.message_id); return
      }
      if (!/^menu:(status|projects|tasks|screenshot|help)$/.test(callback.data)) return
      await this.command(callback.data.slice(5), '', update.update_id, signal); return
    }
    const text = update.message?.text
    if (typeof text !== 'string' || !text.trim() || text.length > 12000 || text.includes('\0')) return
    const match = /^\/([a-z]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/.exec(text.trim())
    if (match) await this.command(match[1], match[2]?.trim() ?? '', update.update_id, signal)
    else if (text.trim().startsWith('/')) await this.send(this.help(), signal, this.menu())
    else await this.ask(text, signal)
  }
  private async ask(text: string, signal: AbortSignal): Promise<void> {
    if (!text) { await this.send(this.t('telegram.askPrompt'), signal); return }
    this.open(signal)
    const result = await this.options.assistant(text)
    this.open(signal)
    const response = result.entries.filter(entry => entry.role === 'assistant').at(-1)?.text
    await this.send(result.error ? this.t('telegram.assistantError') : result.busy ? this.t('telegram.assistantBusy') : response || this.t('telegram.assistantEmpty'), signal)
  }
  private async command(name: string, text: string, updateId: number, signal: AbortSignal): Promise<void> {
    if (name === 'help') { await this.card(this.help(), this.menu(), signal); return }
    if (['start', 'menu', 'status'].includes(name)) { await this.overview(signal); return }
    if (name === 'language') { await this.languages(signal); return }
    if (name === 'projects' || name === 'tasks') { await this.list(name, signal, name === 'tasks' ? text : undefined); return }
    if (name === 'screenshot') { await this.screenshot(signal); return }
    if (name === 'task' || name === 'run' || name === 'pause') { await this.taskAction(name, text, updateId, signal); return }
    if (name === 'ask') { await this.ask(text, signal); return }
    if (name === 'command' || name === 'new') {
      let parsed: unknown
      try { parsed = JSON.parse(text) } catch { await this.send(this.t('telegram.invalidJson'), signal); return }
      const request = name === 'new' ? { method: 'createTask', args: [parsed] } : parsed
      validateControlRequest(request)
      // The owner's JSON cannot override delivery identity or local-owner policy.
      const outcome = await this.execute({ ...request, requestId: `telegram-${this.options.owner}-${updateId}` }, signal)
      await this.send(outcome, signal); return
    }
    await this.send(this.help(), signal, this.menu())
  }
}
