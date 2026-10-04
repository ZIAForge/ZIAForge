import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { ChatHistory, ChatTab } from '../../shared/legacy-ipc'
import { RecoveryStore } from './RecoveryStore'
import { assertPrivateFile, ensurePrivateDirectory } from './privateStorage'

const safeId = /^[A-Za-z0-9_-]{1,160}$/
const mainTab: ChatTab = { id: 'chat-main', name: 'Discussion Feed', type: 'chat' }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
function taskId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !safeId.test(value)) throw new Error('Invalid task identity for chat history')
}
function validateTabs(value: unknown): asserts value is ChatTab[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Invalid chat tabs')
  const ids = new Set<string>()
  for (const tab of value) {
    if (!record(tab) || typeof tab.id !== 'string' || !tab.id || tab.id.length > 4096 || ids.has(tab.id) ||
        typeof tab.name !== 'string' || tab.name.length > 2000 || !['chat', 'file'].includes(String(tab.type)) ||
        (tab.type === 'chat' && !safeId.test(tab.id)) ||
        (tab.filePath !== undefined && typeof tab.filePath !== 'string') ||
        (tab.baseDir !== undefined && typeof tab.baseDir !== 'string')) throw new Error('Invalid chat tab')
    ids.add(tab.id)
  }
}
function validateHistory(value: unknown): asserts value is ChatHistory {
  if (!record(value)) throw new Error('Invalid chat history')
  validateTabs(value.centralTabs)
  if (!value.centralTabs.length) throw new Error('Chat history must retain a view')
  if (value.recentTabs !== undefined) {
    validateTabs(value.recentTabs)
    if (value.recentTabs.some(tab => tab.type !== 'chat')) throw new Error('Recent history only contains chats')
  }
  if (value.activeTabId !== undefined && (typeof value.activeTabId !== 'string' || !value.centralTabs.some(tab => tab.id === value.activeTabId))) throw new Error('Invalid active chat tab')
  if (!record(value.customTabFeeds) || Object.values(value.customTabFeeds).some(feed => !Array.isArray(feed) || feed.some(item => !record(item) || typeof item.id !== 'string' || typeof item.type !== 'string'))) throw new Error('Invalid saved chat feed')
  if (value.drafts !== undefined && (!record(value.drafts) || Object.values(value.drafts).some(draft => typeof draft !== 'string' || draft.length > 1000000))) throw new Error('Invalid chat draft')
}

/** Per-task UI state. Never rewrites the old, ambiguously-owned global history. */
export class TaskChatHistory {
  constructor(private readonly directory: string) {}
  private store(id: string) {
    taskId(id)
    return new RecoveryStore<ChatHistory & { taskId: string; version: 1 }>({
      filename: path.join(this.directory, 'task-chat-history', `${id}.json`),
      validate: (value): asserts value is ChatHistory & { taskId: string; version: 1 } => {
        validateHistory(value)
        if (!('taskId' in value) || value.taskId !== id || !('version' in value) || value.version !== 1) throw new Error('Chat history task identity mismatch')
      },
    })
  }

  private owners(): Map<string, Set<string>> {
    const root = path.join(this.directory, 'agent-sessions', 'artifacts', 'worktrees')
    const owners = new Map<string, Set<string>>()
    ensurePrivateDirectory(root)
    for (const task of fs.readdirSync(root, { withFileTypes: true })) {
      if (!safeId.test(task.name) || !task.isDirectory() || task.isSymbolicLink()) throw new Error('Cannot prove legacy chat ownership')
      const runs = path.join(root, task.name, 'runs')
      if (!fs.existsSync(runs)) continue
      ensurePrivateDirectory(runs)
      for (const run of fs.readdirSync(runs, { withFileTypes: true })) {
        if (!safeId.test(run.name) || !run.isDirectory() || run.isSymbolicLink()) throw new Error('Cannot prove legacy chat ownership')
        const filename = path.join(runs, run.name, 'session.json')
        assertPrivateFile(filename)
        const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
        let raw: unknown
        try {
          if (fs.fstatSync(fd).size > 1024 * 1024) throw new Error('Invalid session ownership metadata')
          raw = JSON.parse(fs.readFileSync(fd, 'utf8'))
        } finally { fs.closeSync(fd) }
        if (!record(raw) || raw.version !== 1 || raw.taskId !== task.name || raw.runId !== run.name || typeof raw.chatId !== 'string' || !safeId.test(raw.chatId) ||
            raw.sessionId !== `session-${createHash('sha256').update(JSON.stringify([task.name, raw.chatId])).digest('hex').slice(0, 40)}`) throw new Error('Cannot prove legacy chat ownership')
        const found = owners.get(raw.chatId) ?? new Set<string>()
        found.add(task.name); owners.set(raw.chatId, found)
      }
    }
    return owners
  }

  read(id: string): ChatHistory {
    const saved = this.store(id).read()
    if (saved) return saved
    const empty: ChatHistory = { centralTabs: [{ ...mainTab }], activeTabId: mainTab.id, customTabFeeds: {}, drafts: {} }
    const legacyFile = path.join(this.directory, 'chat-history.json')
    if (!fs.existsSync(legacyFile)) return empty
    // A damaged/ambiguous index cannot safely assign a global tab to any task.
    // Keep every original byte available; migration is deliberately conservative.
    try {
      assertPrivateFile(legacyFile)
      const fd = fs.openSync(legacyFile, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
      let legacy: unknown
      try {
        if (fs.fstatSync(fd).size > 16 * 1024 * 1024) return empty
        legacy = JSON.parse(fs.readFileSync(fd, 'utf8'))
      } finally { fs.closeSync(fd) }
      validateHistory(legacy)
      const owners = this.owners()
      const tabs = legacy.centralTabs.filter(tab => tab.type === 'chat' && tab.id !== mainTab.id && owners.get(tab.id)?.size === 1 && owners.get(tab.id)?.has(id))
      return { ...empty, centralTabs: [...empty.centralTabs, ...tabs], customTabFeeds: Object.fromEntries(tabs.filter(tab => legacy.customTabFeeds[tab.id]).map(tab => [tab.id, legacy.customTabFeeds[tab.id]])) }
    } catch { return empty }
  }

  save(id: string, value: ChatHistory): void {
    validateHistory(value)
    this.store(id).write({ ...value, taskId: id, version: 1 })
  }
}
