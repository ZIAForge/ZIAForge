import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TelegramBot, type TelegramBotOptions } from '../TelegramBot'
import type { ControlRequest } from '../../../shared/control'
import { UI_LANGUAGES } from '../../../src/languages'

const token = '123456789:fixture_token_for_offline_tests_only'
const owner = '12345'
const message = (id: number, text: string, from = Number(owner), chat = Number(owner), type = 'private') => ({ update_id: id, message: { from: { id: from }, chat: { id: chat, type }, text } })
let directory: string
const bots: TelegramBot[] = []
beforeEach(() => { directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ziaf-telegram-')) })
afterEach(async () => {
  for (const bot of bots.splice(0)) await bot.close()
  vi.unstubAllGlobals()
  fs.rmSync(directory, { recursive: true, force: true })
})
function setup(batches: unknown[][], options: Partial<TelegramBotOptions> = {}, tail: unknown[] = []) {
  const calls: { method: string; body: Record<string, unknown> | FormData }[] = []
  const execute = vi.fn(async (_request: ControlRequest): Promise<unknown> => { void _request; return { ok: true } })
  const assistant = vi.fn(async () => ({ entries: [{ id: 'answer', role: 'assistant' as const, text: 'Answer', at: 1 }], busy: false }))
  const network = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const method = String(input).split('/').at(-1)!
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : init!.body as FormData
    calls.push({ method, body })
    if (method !== 'getUpdates') return Response.json({ ok: true, result: {} })
    if (!(body instanceof FormData) && body.offset === -1) return Response.json({ ok: true, result: tail })
    if (batches.length) return Response.json({ ok: true, result: batches.shift() })
    return await new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) reject(new Error('aborted'))
      else init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })
  })
  vi.stubGlobal('fetch', network)
  const bot = new TelegramBot({ token, owner, directory, execute, assistant, screenshot: async () => ({ dataUrl: 'data:image/png;base64,aGVsbG8=' }), ...options })
  bots.push(bot)
  return { bot, calls, network, execute, assistant }
}
const sent = (calls: { method: string; body: unknown }[]) => calls.filter(call => call.method === 'sendMessage')
type Card = { text: string; message_id?: number; reply_markup: { inline_keyboard: { text: string; callback_data: string }[][] } }
function interaction(steps: ((card: Card) => unknown[])[], options: Partial<TelegramBotOptions>) {
  const calls: { method: string; body: Record<string, unknown> }[] = []
  let card: Card, completed = 0, messageId = 100
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const method = String(input).split('/').at(-1)!, body = JSON.parse(String(init?.body)) as Record<string, unknown>
    calls.push({ method, body })
    if (method === 'sendMessage' || method === 'editMessageText') {
      card = body as unknown as Card
      if (method === 'sendMessage') card.message_id = ++messageId
      return Response.json({ ok: true, result: { message_id: card.message_id } })
    }
    if (method !== 'getUpdates') return Response.json({ ok: true, result: {} })
    if (body.offset === -1) return Response.json({ ok: true, result: [] })
    const next = steps.shift()
    if (next) { completed++; return Response.json({ ok: true, result: next(card) }) }
    return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
  }))
  const bot = new TelegramBot({ token, owner, directory, execute: async () => { throw new Error('Unexpected command') }, assistant: async () => { throw new Error('No inference') }, screenshot: async () => { throw new Error('No capture') }, ...options })
  bots.push(bot)
  return { bot, calls, latest: () => card, completed: () => completed }
}
const click = (id: number, card: Card, matches: (text: string) => boolean, from = Number(owner), messageId = card.message_id) => {
  const button = card.reply_markup.inline_keyboard.flat().find(item => matches(item.text))
  expect(button).toBeDefined()
  return { update_id: id, callback_query: { id: `click-${id}`, data: button!.callback_data, from: { id: from }, message: { message_id: messageId, chat: { id: Number(owner), type: 'private' } } } }
}

describe('owner-activated Telegram control', () => {
  it('does nothing before explicit start, discards startup backlog and accepts only the owner private chat once', async () => {
    const fixture = setup([[
      message(11, '/status', Number(owner), Number(owner), 'group'),
      message(12, '/status', 999), message(13, '/status', Number(owner), 999),
      message(14, '/status'), message(14, '/status'),
    ]], {}, [message(10, '/ask old message')])
    expect(fixture.network).not.toHaveBeenCalled()
    await fixture.bot.start()
    await vi.waitFor(() => expect(fixture.execute).toHaveBeenCalledTimes(1))
    expect(fixture.assistant).not.toHaveBeenCalled()
    expect(fixture.execute).toHaveBeenCalledWith({ method: 'system.summary' })
    await vi.waitFor(() => expect(sent(fixture.calls)).toHaveLength(1))
    await fixture.bot.close()
    const filename = path.join(directory, 'telegram-123456789-12345.json')
    expect(JSON.parse(fs.readFileSync(filename, 'utf8')).offset).toBe(15)
    expect(fs.statSync(filename).mode & 0o777).toBe(0o600)
    expect(fixture.bot.status()).toBe('stopped')
  })

  it('stores acceptance before dispatch and never leaks or automatically retries a failed command', async () => {
    const execute = vi.fn(async (_request: ControlRequest) => {
      void _request
      const state = JSON.parse(fs.readFileSync(path.join(directory, 'telegram-123456789-12345.json'), 'utf8'))
      expect(state.offset).toBe(22)
      throw new Error(`request to /bot${token}/failed`)
    })
    const fixture = setup([[message(21, '/command {"method":"createTask","args":[{"name":"task"}]}')]], { execute })
    await fixture.bot.start()
    await vi.waitFor(() => expect(sent(fixture.calls)).toHaveLength(1))
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0][0]).toMatchObject({ requestId: 'telegram-12345-21' })
    expect(JSON.stringify(sent(fixture.calls))).not.toContain(token)
    await fixture.bot.close()
    const restarted = setup([], { execute }, [message(21, '/command {"method":"createTask"}')])
    await restarted.bot.start()
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('checks current Code revision and never treats Run as gate approval', async () => {
    const execute = vi.fn(async (request: ControlRequest): Promise<unknown> => {
      if (request.method === 'getTasks') return [{ id: 'task-a', name: 'Task' }]
      if (request.method === 'workflows.get') return { revision: 7, codeFlow: { pending: { kind: 'document' } } }
      throw new Error('No mutation expected')
    })
    const fixture = setup([[message(1, '/run task-a')]], { execute })
    await fixture.bot.start()
    await vi.waitFor(() => expect(sent(fixture.calls)).toHaveLength(1))
    expect(execute.mock.calls.map(([request]) => request.method)).toEqual(['getTasks', 'workflows.get'])
    expect(JSON.stringify(sent(fixture.calls))).toContain('Run does not approve')
  })

  it('opens only the owner selected project tasks and rejects consumed, missing and invalid project buttons without mutation', async () => {
    const calls: { method: string; body: Record<string, unknown> }[] = []
    let polls = 0, projectReads = 0
    const execute = vi.fn(async (request: ControlRequest): Promise<unknown> => {
      if (request.method === 'getRepositories') return ++projectReads < 3
        ? [{ id: 'project-a', name: 'Project A' }, { id: 'project-b', name: 'Project B' }]
        : [{ id: 'project-a', name: 'Project A' }]
      if (request.method === 'getTasks') return [
        { id: 'task-a1', repoId: 'project-a', name: 'A first' },
        { id: 'task-b', repoId: 'project-b', name: 'B private task' },
        { id: 'task-a2', repoId: 'project-a', name: 'A second' },
      ]
      throw new Error('No mutation expected')
    })
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const method = String(input).split('/').at(-1)!, body = JSON.parse(String(init?.body)) as Record<string, unknown>
      calls.push({ method, body })
      if (method !== 'getUpdates') return Response.json({ ok: true, result: {} })
      if (body.offset === -1) return Response.json({ ok: true, result: [] })
      if (++polls === 1) return Response.json({ ok: true, result: [message(1, '/projects')] })
      if (polls === 2) {
        const initial = sent(calls)[0].body as { reply_markup: { inline_keyboard: { text: string; callback_data: string }[][] } }
        const buttons = initial.reply_markup.inline_keyboard.flat()
        const a = buttons.find(button => button.text === '📁 Project A')!.callback_data
        const b = buttons.find(button => button.text === '📁 Project B')!.callback_data
        expect(a).toMatch(/^action:[a-f0-9]{24}$/)
        expect(b).toMatch(/^action:[a-f0-9]{24}$/)
        const callback = (id: number, data: string, from = Number(owner)) => ({ update_id: id, callback_query: { id: `callback-${id}`, data, from: { id: from }, message: { chat: { id: Number(owner), type: 'private' } } } })
        return Response.json({ ok: true, result: [callback(2, a, 999), callback(3, a), callback(4, a), callback(5, b), callback(6, 'action:invalid')] })
      }
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
    }))
    const bot = new TelegramBot({ token, owner, directory, execute, assistant: async () => { throw new Error('No inference expected') }, screenshot: async () => { throw new Error('No capture expected') } })
    bots.push(bot)
    await bot.start()
    await vi.waitFor(() => expect(sent(calls)).toHaveLength(5))
    const scoped = sent(calls)[1].body as { text: string; reply_markup: { inline_keyboard: { text: string }[][] } }
    expect(scoped.text).toContain('A first')
    expect(scoped.text).toContain('A second')
    expect(scoped.text).not.toContain('B private task')
    expect(scoped.reply_markup.inline_keyboard.slice(0, 2).flat().map(button => button.text)).toEqual(['▸ A first', '▸ A second'])
    expect(scoped.reply_markup.inline_keyboard.at(-1)).toHaveLength(3)
    expect(execute.mock.calls.map(([request]) => request.method)).toEqual(['getRepositories', 'getRepositories', 'getTasks', 'getRepositories'])
    expect(calls.filter(call => call.method === 'answerCallbackQuery').map(call => call.body.callback_query_id)).toEqual(['callback-3', 'callback-4', 'callback-5', 'callback-6'])
    expect(String((sent(calls)[2].body as { text: string }).text)).toContain('This button has expired')
    expect(String((sent(calls)[4].body as { text: string }).text)).toContain('This button has expired')
  })

  it('routes Work start and pause with the actual shared DTO, using fresh revision', async () => {
    const execute = vi.fn(async (request: ControlRequest): Promise<unknown> => {
      if (request.method === 'getTasks') return [{ id: 'task-w', workFlowVersion: 1 }]
      if (request.method === 'workFlows.get') return { revision: 9, runId: 'work-run', status: 'paused' }
      return { revision: 10, status: 'running' }
    })
    const fixture = setup([[message(1, '/run task-w'), message(2, '/pause task-w')]], { execute })
    await fixture.bot.start()
    await vi.waitFor(() => expect(sent(fixture.calls)).toHaveLength(2))
    expect(execute).toHaveBeenCalledWith({ method: 'workFlows.start', args: [{ taskId: 'task-w', revision: 9, commandId: 'telegram-12345-1' }], requestId: 'telegram-12345-1' })
    expect(execute).toHaveBeenCalledWith({ method: 'workFlows.pause', args: [{ taskId: 'task-w' }], requestId: 'telegram-12345-2' })
  })

  it('navigates project, task and read-only chats by editing one owned card without prompts or approval', async () => {
    const task = { id: 'task-a', repoId: 'project-a', name: 'Write guide', workFlowVersion: 1, status: 'waiting' }
    const flow = { revision: 4, status: 'waiting', plan: [{ status: 'completed' }, { status: 'pending' }], pending: { summary: 'Approve the outline', questions: [{ question: 'Who is the reader?' }] } }
    const execute = vi.fn(async (request: ControlRequest): Promise<unknown> => {
      if (request.method === 'getRepositories') return [{ id: 'project-a', name: 'Docs' }]
      if (request.method === 'getTasks') return [task, { id: 'other-task', repoId: 'elsewhere', name: 'Not selected' }]
      if (request.method === 'workFlows.get') return flow
      if (request.method === 'system.context') return { task, workflow: flow, chats: { centralTabs: [{ id: 'chat-main', type: 'chat', name: 'Discussion' }], recentTabs: [{ id: 'closed-chat', type: 'chat', name: 'Earlier notes' }, { id: 'file-doc', type: 'file', name: 'Source file' }] }, session: { sessionStatus: 'ready', model: 'fixture-model', feed: [{ role: 'assistant', text: 'Saved answer <b>literal</b>', thinking: 'private reasoning excluded' }] } }
      throw new Error('No mutation expected')
    })
    const fixture = interaction([
      () => [message(1, '/projects')],
      card => [click(2, card, text => text.includes('Docs'))],
      card => { expect(card.text).not.toContain('Not selected'); return [click(3, card, text => text.includes('Write guide'))] },
      card => {
        expect(card.text).toContain('Who is the reader?')
        expect(card.reply_markup.inline_keyboard.flat().some(button => button.text.startsWith('▶️'))).toBe(false)
        return [click(4, card, text => text.startsWith('💬'))]
      },
      card => {
        expect(card.reply_markup.inline_keyboard.flat().some(button => button.text.includes('Source file'))).toBe(false)
        return [click(5, card, text => text.includes('Earlier notes'))]
      },
      card => { expect(card.text).toContain('Saved answer <b>literal</b>'); expect(card.text).not.toContain('private reasoning'); return [click(6, card, text => text.startsWith('↻'))] },
      card => [click(7, card, text => text.startsWith('←'))],
    ], { execute })
    await fixture.bot.start()
    await vi.waitFor(() => expect(fixture.calls.filter(call => call.method === 'editMessageText')).toHaveLength(6))
    expect(sent(fixture.calls)).toHaveLength(1)
    expect(fixture.calls.filter(call => call.method === 'editMessageText').every(call => call.body.message_id === 101)).toBe(true)
    expect(fixture.calls.every(call => !Object.hasOwn(call.body, 'parse_mode'))).toBe(true)
    expect(execute.mock.calls.every(([request]) => ['getRepositories', 'getTasks', 'workFlows.get', 'system.context'].includes(request.method))).toBe(true)
    expect(execute).toHaveBeenCalledWith({ method: 'system.context', args: [{ taskId: 'task-a', chatId: 'closed-chat' }] })
    await fixture.bot.close()
  })

  it('previews saved legacy user and ai text without leaking tools or thinking', async () => {
    const task = { id: 'legacy-task', name: 'Legacy discussion', status: 'paused' }
    const flow = { revision: 1, status: 'paused' }
    const execute = vi.fn(async (request: ControlRequest): Promise<unknown> => {
      if (request.method === 'getTasks') return [task]
      if (request.method === 'workflows.get') return flow
      if (request.method === 'system.context') return { task, workflow: flow, chats: {
        centralTabs: [{ id: 'legacy-chat', type: 'chat', name: 'Earlier discussion' }],
        customTabFeeds: { 'legacy-chat': [
          { id: 'u', type: 'user', text: 'Saved human question' },
          { id: 'tool', type: 'tools', role: 'assistant', text: 'PRIVATE_TOOL_OUTPUT', tools: [{ content: 'PRIVATE_TOOL_CONTENT' }] },
          { id: 'a', type: 'ai', text: 'Saved assistant answer', thinking: 'PRIVATE_THINKING', tools: [{ type: 'thinking', text: 'PRIVATE_NESTED_THINKING' }] },
          { id: 'approval', type: 'prompt', text: 'PRIVATE_APPROVAL_PROMPT' },
          { id: 'commit', type: 'commit', text: 'PRIVATE_COMMIT_DETAIL' },
        ] },
      }, session: null }
      throw new Error('No mutation expected')
    })
    const assistant = vi.fn(async () => { throw new Error('No inference expected') })
    const fixture = interaction([
      () => [message(1, '/task legacy-task')],
      card => [click(2, card, text => text.startsWith('💬'))],
      card => [click(3, card, text => text.includes('Earlier discussion'))],
    ], { execute, assistant })
    await fixture.bot.start()
    await vi.waitFor(() => expect(fixture.calls.filter(call => call.method === 'editMessageText')).toHaveLength(2))
    expect(fixture.latest().text).toContain('👤 Saved human question')
    expect(fixture.latest().text).toContain('🤖 Saved assistant answer')
    expect(fixture.latest().text).not.toContain('PRIVATE_')
    expect(sent(fixture.calls)).toHaveLength(1)
    expect(assistant).not.toHaveBeenCalled()
    expect(execute.mock.calls.every(([request]) => ['getTasks', 'workflows.get', 'system.context'].includes(request.method))).toBe(true)
    expect(execute).toHaveBeenCalledWith({ method: 'system.context', args: [{ taskId: 'legacy-task', chatId: 'legacy-chat' }] })
    await fixture.bot.close()
  })

  it('rechecks gates for an old Run button and binds callbacks to the published owner message', async () => {
    let gate = false
    const execute = vi.fn(async (request: ControlRequest): Promise<unknown> => {
      if (request.method === 'getTasks') return [{ id: 'task-a', name: 'Task' }]
      if (request.method === 'workflows.get') return { revision: gate ? 8 : 7, status: 'paused', codeFlow: gate ? { pending: { kind: 'document', summary: 'Read this document' } } : {} }
      throw new Error('No mutation or inference expected')
    })
    let run: ReturnType<typeof click>
    const fixture = interaction([
      () => [message(1, '/task task-a')],
      card => {
        run = click(4, card, text => text.startsWith('▶️'))
        gate = true
        return [click(2, card, text => text.startsWith('▶️'), 999), click(3, card, text => text.startsWith('▶️'), Number(owner), 999), run]
      },
      card => { expect(card.text).toContain('Read this document'); return [{ ...run, update_id: 5, callback_query: { ...run.callback_query, id: 'duplicate' } }] },
    ], { execute })
    await fixture.bot.start()
    await vi.waitFor(() => expect(fixture.calls.filter(call => call.method === 'answerCallbackQuery')).toHaveLength(3))
    await vi.waitFor(() => expect(sent(fixture.calls)).toHaveLength(3)) // Original + explicit stale notices; no duplicate action.
    expect(execute.mock.calls.map(([request]) => request.method)).toEqual(['getTasks', 'workflows.get', 'getTasks', 'workflows.get'])
    expect(fixture.calls.filter(call => call.method === 'editMessageText')).toHaveLength(1)
    await fixture.bot.close()
  })

  it('paginates all 56 languages, saves only the owner override and restores app-language following', async () => {
    const seen = new Set<string>()
    let update = 1
    const steps: ((card: Card) => unknown[])[] = [() => [message(update++, '/language')]]
    for (let page = 0; page < 7; page++) steps.push(card => {
      for (const button of card.reply_markup.inline_keyboard.slice(1, 9).flat()) {
        const entry = UI_LANGUAGES.find(item => button.text.endsWith(item.name))
        expect(entry).toBeDefined(); seen.add(entry!.id)
      }
      return page < 6 ? [click(update++, card, text => text.endsWith('›'))] : [message(update++, '/language')]
    })
    steps.push(card => [click(update++, card, text => text.includes('Русский'), 999), click(update++, card, text => text.includes('Русский'))])
    const fixture = interaction(steps, { getLanguage: () => 'en' })
    await fixture.bot.start()
    const filename = path.join(directory, 'telegram-language-123456789-12345.json')
    await vi.waitFor(() => expect(fs.existsSync(filename) && JSON.parse(fs.readFileSync(filename, 'utf8')).locale).toBe('ru'))
    expect(seen.size).toBe(56)
    expect(fs.statSync(filename).mode & 0o777).toBe(0o600)
    await fixture.bot.close()
    const execute = vi.fn(async () => ({ repositories: [], tasks: [], version: { version: '0.0.test' } }))
    const restored = interaction([
      () => [message(50, '/status')],
      card => { expect(card.reply_markup.inline_keyboard.flat().some(button => button.text.includes('Проекты'))).toBe(true); return [message(51, '/language')] },
      card => [click(52, card, text => text.startsWith('↳'))],
    ], { execute, getLanguage: () => 'en' })
    await restored.bot.start()
    await vi.waitFor(() => expect(JSON.parse(fs.readFileSync(filename, 'utf8')).locale).toBeNull())
    await restored.bot.close()
    expect(execute.mock.calls).toHaveLength(1)
    expect(restored.calls.filter(call => call.method === 'editMessageText')).toHaveLength(1)
  })

  it('does not launch a pending task action after close while task lookup is settling', async () => {
    let resolve!: (value: unknown) => void
    const execute = vi.fn((_request: ControlRequest) => { void _request; return new Promise<unknown>(done => { resolve = done }) })
    const fixture = setup([[message(1, '/run task-a')]], { execute })
    await fixture.bot.start()
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    const closing = fixture.bot.close()
    resolve([{ id: 'task-a' }])
    await closing
    expect(execute).toHaveBeenCalledTimes(1)
    expect(sent(fixture.calls)).toHaveLength(0)
    expect(fixture.bot.status()).toBe('stopped')
  })

  it('fails closed on damaged offset instead of accepting updates with a fabricated empty state', async () => {
    const fixture = setup([[message(1, '/status')]])
    fs.writeFileSync(path.join(directory, 'telegram-123456789-12345.json'), '{ damaged', { mode: 0o600 })
    await expect(fixture.bot.start()).rejects.toThrow('storage unavailable')
    expect(fixture.network).not.toHaveBeenCalled()
    expect(fixture.execute).not.toHaveBeenCalled()
    expect(fs.readFileSync(path.join(directory, 'telegram-123456789-12345.json'), 'utf8')).toBe('{ damaged')
  })

  it('refuses another owner or an unknown language in persisted menu preferences before polling', async () => {
    const fixture = setup([[message(1, '/language')]])
    const filename = path.join(directory, 'telegram-language-123456789-12345.json')
    const damaged = JSON.stringify({ version: 1, botId: '123456789', owner: '999', locale: 'not-a-locale' })
    fs.writeFileSync(filename, damaged, { mode: 0o600 })
    await expect(fixture.bot.start()).rejects.toThrow('storage unavailable')
    expect(fixture.network).not.toHaveBeenCalled()
    expect(fs.readFileSync(filename, 'utf8')).toBe(damaged)
  })

  it('redacts credential fields and splits astral text inside Telegram message limits', async () => {
    const execute = vi.fn(async () => ({ apiKey: 'fixture-private-key', value: '🌍'.repeat(4500), token }))
    const fixture = setup([[message(1, '/command {"method":"system.summary"}')]], { execute })
    await fixture.bot.start()
    await vi.waitFor(() => expect(sent(fixture.calls).length).toBeGreaterThan(1))
    await vi.waitFor(() => expect(fixture.calls.filter(call => call.method === 'getUpdates')).toHaveLength(3))
    for (const call of sent(fixture.calls)) {
      const body = call.body as { text: string }
      expect(body.text.length).toBeLessThanOrEqual(4096)
      expect(body.text).not.toContain(token)
      expect(body.text).not.toContain('fixture-private-key')
    }
  })
})
