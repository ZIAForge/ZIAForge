// @vitest-environment happy-dom
import { StrictMode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTaskChatHistory } from '../useTaskChatHistory'
import type { ChatHistory, LegacyZiafAPI } from '../../../../shared/legacy-ipc'

const main = { id: 'chat-main', name: 'Discussion Feed', type: 'chat' as const }
const chat = (id: string) => ({ id, name: id, type: 'chat' as const })
const empty = (): ChatHistory => ({ centralTabs: [main], customTabFeeds: {} })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
function memoryAPI() {
  const disk = new Map<string, ChatHistory>()
  const api = {
    getChatHistory: vi.fn<LegacyZiafAPI['getChatHistory']>(async id => structuredClone(disk.get(id) ?? empty())),
    saveChatHistory: vi.fn<LegacyZiafAPI['saveChatHistory']>(async value => { disk.set(value.taskId, structuredClone(value)); return { success: true } }),
  }
  return { api, disk }
}
afterEach(cleanup)
describe('task chat state lifecycle', () => {
  it('keeps open/active/closed chats and drafts independent after task switches and remount', async () => {
    const { api } = memoryAPI()
    const a = renderHook(() => useTaskChatHistory('a', [], api))
    await act(async () => {})
    act(() => {
      a.result.current.setCentralTabs([main, chat('chat-a')]); a.result.current.setActiveTabId('chat-a')
      a.result.current.setRecentTabs([chat('closed-a')]); a.result.current.setDrafts({ 'chat-a': 'A draft' })
    })
    a.unmount()
    const b = renderHook(() => useTaskChatHistory('b', [], api))
    await act(async () => {})
    expect(b.result.current.centralTabs).toEqual([main])
    expect(b.result.current.drafts).toEqual({})
    act(() => b.result.current.setDrafts({ 'chat-main': 'B draft' }))
    b.unmount()
    const again = renderHook(() => useTaskChatHistory('a', [], api))
    await waitFor(() => expect(again.result.current.activeTabId).toBe('chat-a'))
    expect(again.result.current.recentTabs).toEqual([chat('closed-a')])
    expect(again.result.current.drafts).toEqual({ 'chat-a': 'A draft' })
    expect(api.saveChatHistory.mock.calls.every(([value]) => value.taskId === 'a' || value.taskId === 'b')).toBe(true)
  })
  it('does not apply a late task A load to task B, and saves edits made before A hydration', async () => {
    const { api, disk } = memoryAPI(); const loading = deferred<ChatHistory>()
    api.getChatHistory.mockImplementation(id => id === 'a' ? loading.promise : Promise.resolve(empty()))
    const a = renderHook(() => useTaskChatHistory('a', [], api))
    act(() => { a.result.current.setCentralTabs(tabs => [...tabs, chat('a-new')]); a.result.current.setActiveTabId('a-new') })
    a.unmount()
    const b = renderHook(() => useTaskChatHistory('b', [], api))
    await act(async () => loading.resolve({ ...empty(), centralTabs: [main, chat('a-old')] }))
    await waitFor(() => expect(disk.get('a')?.centralTabs.map(tab => tab.id)).toEqual(['chat-main', 'a-old', 'a-new']))
    expect(b.result.current.centralTabs).toEqual([main])
    expect(disk.has('b')).toBe(false)
  })
  it('loads once in StrictMode and keeps stable setters and post-load edits', async () => {
    const { api } = memoryAPI(); const loading = deferred<ChatHistory>()
    api.getChatHistory.mockReturnValue(loading.promise)
    const view = renderHook(() => useTaskChatHistory('a', [], api), { wrapper: StrictMode })
    const setter = view.result.current.setCentralTabs
    await act(async () => loading.resolve(empty()))
    act(() => { setter(tabs => [...tabs, chat('new')]); view.result.current.setActiveTabId('new') })
    view.rerender()
    await act(async () => {})
    expect(api.getChatHistory).toHaveBeenCalledExactlyOnceWith('a')
    expect(view.result.current.setCentralTabs).toBe(setter)
    expect(view.result.current.activeTabId).toBe('new')
    expect(view.result.current.centralTabs.map(tab => tab.id)).toEqual(['chat-main', 'new'])
  })
  it('waits for the previous instance save before remount reads and preserves already task-scoped Recent', async () => {
    const { api, disk } = memoryAPI(); const saving = deferred<{ success: boolean }>()
    api.saveChatHistory.mockImplementation(async value => { await saving.promise; disk.set(value.taskId, value); return { success: true } })
    const first = renderHook(() => useTaskChatHistory('a', [chat('old-recent')], api))
    await act(async () => {})
    expect(first.result.current.recentTabs).toEqual([chat('old-recent')])
    act(() => first.result.current.setCentralTabs([main, chat('a-new')]))
    first.unmount()
    const second = renderHook(() => useTaskChatHistory('a', [], api))
    expect(api.getChatHistory).toHaveBeenCalledTimes(1)
    await act(async () => saving.resolve({ success: true }))
    await waitFor(() => expect(second.result.current.centralTabs.map(tab => tab.id)).toContain('a-new'))
    expect(second.result.current.recentTabs).toEqual([chat('old-recent')])
  })
  it('flushes pending current-task state on pagehide without requiring a React unmount', async () => {
    const { api, disk } = memoryAPI()
    const view = renderHook(() => useTaskChatHistory('a', [], api))
    await act(async () => {})
    act(() => {
      view.result.current.setRecentTabs([chat('closed')])
      view.result.current.setDrafts({ 'chat-main': 'Unsent draft' })
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(api.saveChatHistory).toHaveBeenCalledTimes(1)
    expect(disk.get('a')).toMatchObject({ centralTabs: [main], activeTabId: 'chat-main', recentTabs: [chat('closed')], drafts: { 'chat-main': 'Unsent draft' } })
    await act(async () => {})
    act(() => window.dispatchEvent(new Event('beforeunload')))
    expect(api.saveChatHistory).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite damaged history after a failed load', async () => {
    const { api } = memoryAPI(); api.getChatHistory.mockRejectedValue(new Error('Saved data is damaged'))
    const view = renderHook(() => useTaskChatHistory('a', [], api))
    await waitFor(() => expect(view.result.current.error).toContain('damaged'))
    act(() => view.result.current.setDrafts({ 'chat-main': 'Preserve me' }))
    view.unmount()
    expect(api.saveChatHistory).not.toHaveBeenCalled()
  })
})
