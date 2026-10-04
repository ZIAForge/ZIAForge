import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { TaskChatHistory } from '../TaskChatHistory'
import type { ChatHistory } from '../../../shared/legacy-ipc'

const directories: string[] = []
const temp = () => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'task-history-'))); directories.push(dir); return dir }
const main = { id: 'chat-main', name: 'Discussion Feed', type: 'chat' as const }
const chat = (id: string) => ({ id, name: id, type: 'chat' as const })
function owner(root: string, taskId: string, chatId: string) {
  const runId = `run-${chatId}`
  const directory = path.join(root, 'agent-sessions/artifacts/worktrees', taskId, 'runs', runId)
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, 'session.json'), JSON.stringify({ version: 1, taskId, chatId, runId,
    sessionId: `session-${createHash('sha256').update(JSON.stringify([taskId, chatId])).digest('hex').slice(0, 40)}` }))
}
afterEach(() => { for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }) })
describe('task-scoped chat history', () => {
  it('persists independent open/active/recent tabs, feeds and drafts through a fresh store', () => {
    const dir = temp(); const store = new TaskChatHistory(dir)
    const a: ChatHistory = { centralTabs: [main, chat('chat-a')], activeTabId: 'chat-a', recentTabs: [chat('closed-a')],
      customTabFeeds: { 'closed-a': [{ id: 'reply-a', type: 'ai', text: 'Retained reply' }] }, drafts: { 'chat-a': 'unsent A' } }
    const b: ChatHistory = { centralTabs: [main], activeTabId: main.id, recentTabs: [chat('chat-b')], customTabFeeds: {}, drafts: { 'chat-b': 'unsent B' } }
    store.save('task-a', a); store.save('task-b', b)
    const restarted = new TaskChatHistory(dir)
    expect(restarted.read('task-a')).toMatchObject(a)
    expect(restarted.read('task-b')).toMatchObject(b)
    expect(restarted.read('task-c').centralTabs).toEqual([main])
    expect(fs.statSync(path.join(dir, 'task-chat-history/task-a.json')).mode & 0o777).toBe(0o600)
  })
  it('migrates only globally unique proven chat owners, never global main, files, unknown or ambiguous chats', () => {
    const dir = temp(); const store = new TaskChatHistory(dir)
    const legacy = Buffer.from(JSON.stringify({ centralTabs: [main, chat('chat-a'), chat('chat-b'), chat('unknown'), chat('ambiguous'), { id: 'file-/other/task.txt', name: 'task.txt', type: 'file', filePath: '/other/task.txt' }],
      customTabFeeds: { 'chat-a': [{ id: 'reply', type: 'ai', text: 'A only' }] } }))
    fs.writeFileSync(path.join(dir, 'chat-history.json'), legacy)
    owner(dir, 'task-a', 'chat-a'); owner(dir, 'task-b', 'chat-b')
    owner(dir, 'task-a', 'ambiguous'); owner(dir, 'task-b', 'ambiguous')
    expect(store.read('task-a').centralTabs.map(tab => tab.id)).toEqual(['chat-main', 'chat-a'])
    expect(store.read('task-b').centralTabs.map(tab => tab.id)).toEqual(['chat-main', 'chat-b'])
    expect(store.read('task-c').centralTabs).toEqual([main])
    store.save('task-a', store.read('task-a'))
    expect(fs.readFileSync(path.join(dir, 'chat-history.json'))).toEqual(legacy)
  })
  it('cannot assign legacy chats when another ownership record is unreadable', () => {
    const dir = temp(); owner(dir, 'task-a', 'chat-a'); owner(dir, 'task-b', 'chat-a')
    fs.writeFileSync(path.join(dir, 'chat-history.json'), JSON.stringify({ centralTabs: [main, chat('chat-a')], customTabFeeds: {} }))
    fs.writeFileSync(path.join(dir, 'agent-sessions/artifacts/worktrees/task-b/runs/run-chat-a/session.json'), '{')
    expect(new TaskChatHistory(dir).read('task-a').centralTabs).toEqual([main])
  })
  it('preserves corrupt scoped bytes and refuses overwrite or cross-task identity', () => {
    const dir = temp(); const store = new TaskChatHistory(dir)
    store.save('task-a', { centralTabs: [main], customTabFeeds: {} })
    const file = path.join(dir, 'task-chat-history/task-a.json')
    fs.writeFileSync(file, '{truncated')
    expect(() => store.read('task-a')).toThrow(/damaged/)
    expect(() => store.save('task-a', { centralTabs: [main], customTabFeeds: {} })).toThrow()
    expect(fs.readFileSync(file, 'utf8')).toBe('{truncated')
    expect(() => store.read('../task-a')).toThrow(/identity/)
  })
})
