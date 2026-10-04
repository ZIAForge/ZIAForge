import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { ChatHistory, ChatTab, LegacyZiafAPI } from '../../../shared/legacy-ipc'

type State = Required<ChatHistory>
type HistoryAPI = Pick<LegacyZiafAPI, 'getChatHistory' | 'saveChatHistory'>
const pending = new WeakMap<HistoryAPI, Map<string, Promise<unknown>>>()
function ordered<T>(api: HistoryAPI, taskId: string, action: () => Promise<T>): Promise<T> {
  let tasks = pending.get(api)
  if (!tasks) { tasks = new Map(); pending.set(api, tasks) }
  const previous = tasks.get(taskId)
  const next = previous ? previous.catch(() => {}).then(action) : action()
  tasks.set(taskId, next)
  void next.finally(() => { if (tasks.get(taskId) === next) tasks.delete(taskId) }).catch(() => {})
  return next
}
function normalized(value: ChatHistory | undefined, recent: ChatTab[]): State {
  const centralTabs = value?.centralTabs?.length ? value.centralTabs : [{ id: 'chat-main', name: 'Discussion Feed', type: 'chat' as const }]
  return {
    centralTabs,
    activeTabId: centralTabs.some(tab => tab.id === value?.activeTabId) ? value!.activeTabId! : centralTabs[0].id,
    recentTabs: (value?.recentTabs ?? recent).filter(tab => tab.type === 'chat' && !centralTabs.some(open => open.id === tab.id)),
    customTabFeeds: value?.customTabFeeds ?? {}, drafts: value?.drafts ?? {},
  }
}

/** A keyed Workspace owns one task. Reads/writes are serialized even across remounts. */
export function useTaskChatHistory(taskId: string | undefined, recent: ChatTab[] = [], api: HistoryAPI = window.ziafAPI) {
  const [history, setHistory] = useState<State>(() => normalized(undefined, recent))
  const latest = useRef(history)
  const initialRecent = useRef(recent)
  const loaded = useRef(false)
  const loadStarted = useRef(false)
  const mounted = useRef(true)
  const dirty = useRef(false)
  const deferred = useRef<Array<(state: State) => State>>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const save = useRef<() => void>(() => {})
  save.current = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (!taskId || !loaded.current || !dirty.current) return
    dirty.current = false
    const snapshot = latest.current
    void ordered(api, taskId, () => api.saveChatHistory({ ...snapshot, taskId })).then(result => {
      if (result && !result.success) throw new Error(result.error || 'Could not save chat history')
    }).catch(reason => {
      dirty.current = true
      if (mounted.current) setError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  const update = useCallback((apply: (state: State) => State, immediately = false) => {
    if (!loaded.current) deferred.current.push(apply)
    const next = apply(latest.current)
    if (next === latest.current) return
    latest.current = next
    dirty.current = true
    setHistory(latest.current)
    if (timer.current) clearTimeout(timer.current)
    if (immediately) save.current()
    else timer.current = setTimeout(() => save.current(), 200)
  }, [])
  const change = useCallback(<K extends keyof State>(key: K): Dispatch<SetStateAction<State[K]>> => value => {
    update(state => ({ ...state, [key]: typeof value === 'function' ? (value as (current: State[K]) => State[K])(state[key]) : value }))
  }, [update])
  const setters = useMemo(() => ({
    setCentralTabs: change('centralTabs'), setActiveTabId: change('activeTabId'),
    setRecentTabs: change('recentTabs'), setCustomTabFeeds: change('customTabFeeds'), setDrafts: change('drafts'),
  }), [change])
  const flush = useCallback(() => save.current(), [])
  useEffect(() => {
    // Reload does not run React unmount cleanup. This is only best-effort:
    // completed tab transactions also flush immediately before this boundary.
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [flush])
  useEffect(() => {
    mounted.current = true
    if (taskId && !loadStarted.current) {
      loadStarted.current = true
      void ordered(api, taskId, () => api.getChatHistory(taskId)).then(value => {
        let next = normalized(value, initialRecent.current)
        for (const apply of deferred.current) next = apply(next)
        deferred.current = []
        latest.current = next
        loaded.current = true
        if (mounted.current) { setHistory(next); setHydrated(true) }
        // A user may have opened a tab before this read completed, then switched tasks.
        if (dirty.current) save.current()
      }).catch(reason => { if (mounted.current) setError(reason instanceof Error ? reason.message : String(reason)) })
    }
    return () => {
      mounted.current = false
      save.current()
    }
  }, [api, taskId])
  return {
    ...history, error, hydrated, update, save: flush, ...setters,
  }
}
