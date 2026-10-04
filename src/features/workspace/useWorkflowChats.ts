import { uiText, currentLocale } from '../../uiText'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatHistory, ChatTab } from '../../../shared/legacy-ipc'
import type { WorkflowAPI, WorkflowAttempt, WorkflowSnapshot } from '../../../shared/workflow'
import type { useTaskChatHistory } from './useTaskChatHistory'

export interface WorkflowChats { tabs: ChatTab[]; currentId?: string }
export const CODE_DIALOGUE_TAB = 'forge-discussion'
export function multiStageTitle(stage: NonNullable<WorkflowAttempt['multiStages']>[number], russian: boolean, locale = currentLocale()): string {
  const labels = { "exploration": uiText("Exploration", undefined, russian ? 'ru' : locale), "design": uiText("Design", undefined, russian ? 'ru' : locale), "synthesis": uiText("Plan synthesis", undefined, russian ? 'ru' : locale), "review-worker": uiText("Review", undefined, russian ? 'ru' : locale), "review-coordinator": uiText("Review synthesis", undefined, russian ? 'ru' : locale), "fix": uiText("Correction", undefined, russian ? 'ru' : locale) }
  return `${labels[stage.kind]} ${stage.index}${stage.cycle > 0 ? ` · ${uiText("Cycle", undefined, russian ? 'ru' : locale)} ${stage.cycle}` : ''}`
}

/** Project only durable backend references; never create/send an agent session. */
export function workflowChats(snapshot: WorkflowSnapshot, russian = false, locale = currentLocale()): WorkflowChats {
  const tabs = new Map<string, ChatTab>()
  const interactive = snapshot.plan.codeFlow?.interaction?.version === 1
  if (interactive) tabs.set(CODE_DIALOGUE_TAB, { id: CODE_DIALOGUE_TAB, name: uiText("Forge · Discussion", undefined, russian ? 'ru' : locale), type: 'chat' })
  let latestId: string | undefined
  let latestAt = -Infinity
  let gateId: string | undefined
  let workingId: string | undefined
  const rows = [
    ...snapshot.plan.steps.map(step => ({ step, state: snapshot.steps.find(item => item.id === step.id), retired: false })),
    ...(snapshot.codeFlow?.retiredSteps ?? []).map(item => ({ step: item.step, state: item.state, retired: true })),
  ]
  for (const { step, state, retired } of rows) {
    for (const attempt of state?.attempts ?? []) {
      const title = `${step.title}${(state?.attempts.length ?? 0) > 1 ? ` · ${uiText("Attempt", undefined, russian ? 'ru' : locale)} ${attempt.number}` : ''}${retired ? ` · ${uiText("History", undefined, russian ? 'ru' : locale)}` : ''}`
      const add = (id: string | undefined, name: string, working = false) => {
        if (!id) return
        tabs.set(id, { id, name, type: 'chat' })
        if (!retired && attempt.startedAt >= latestAt) { latestId = id; latestAt = attempt.startedAt }
        if (!retired && snapshot.codeFlow?.pending?.attemptId === attempt.id) gateId = id
        if (!retired && working && state?.status === 'running' && attempt.status === 'running') workingId = id
      }
      for (const source of attempt.helperSources ?? []) add(source.session?.chatId, `${uiText("Helper", undefined, russian ? 'ru' : locale)}: ${title} · ${source.sourceId}`, source.status === 'running')
      add(attempt.session?.chatId, title, attempt.stage !== 'helper' && attempt.stage !== 'review')
      add(attempt.reviewerSession?.chatId, `${uiText("Review", undefined, russian ? 'ru' : locale)}: ${title}`, attempt.stage === 'review')
      add(attempt.architect?.session?.chatId, `${uiText("Report architect", undefined, russian ? 'ru' : locale)}: ${title}`, attempt.architect?.status === 'running')
      for (const source of attempt.reviewSources ?? []) add(source.session?.chatId, `${uiText("Review", undefined, russian ? 'ru' : locale)}: ${title} · ${source.sourceId}`, source.status === 'running')
      for (const stage of attempt.multiStages ?? []) add(stage.session?.chatId, `${multiStageTitle(stage, russian, locale)}: ${title}`, stage.status === 'running')
    }
  }
  return { tabs: [...tabs.values()], currentId: interactive ? CODE_DIALOGUE_TAB : workingId ?? gateId ?? latestId }
}

/** A closed phase stays in Recent. Feed/draft/file state is never reconstructed from a workflow. */
export function mergeWorkflowChats(state: Required<ChatHistory>, projection: WorkflowChats, following: boolean): Required<ChatHistory> {
  const known = new Map(projection.tabs.map(tab => [tab.id, tab]))
  const closed = new Set(state.recentTabs.map(tab => tab.id))
  const opened = new Set(state.centralTabs.map(tab => tab.id))
  let changed = false
  const centralTabs = state.centralTabs.map(tab => {
    const name = known.get(tab.id)?.name
    if (tab.type !== 'chat' || !name || tab.name === name) return tab
    changed = true
    return { ...tab, name }
  })
  for (const tab of projection.tabs) if (!opened.has(tab.id) && !closed.has(tab.id)) { centralTabs.push(tab); changed = true }
  const activeTabId = following && projection.currentId && centralTabs.some(tab => tab.id === projection.currentId)
    ? projection.currentId : state.activeTabId
  return changed || activeTabId !== state.activeTabId ? { ...state, centralTabs, activeTabId } : state
}

type History = Pick<ReturnType<typeof useTaskChatHistory>, 'hydrated' | 'update' | 'centralTabs' | 'activeTabId' | 'recentTabs'>
function preference(taskId: string): boolean | null {
  try { const value = localStorage.getItem(`ziaf-follow-workflow:${taskId}`); return value === 'true' ? true : value === 'false' ? false : null } catch { return null }
}

/** Lives with the task Workspace, including while its Plan panel is closed. */
export function useWorkflowChats(taskId: string | undefined, enabled: boolean, history: History, russian = false, api: WorkflowAPI = window.ziafAPI.workflows) {
  const [view, setView] = useState<{ taskId: string | undefined; snapshot: WorkflowSnapshot | null; following: boolean | null }>(() => ({ taskId, snapshot: null, following: taskId ? preference(taskId) : null }))
  // Render-time task binding prevents even one effect pass from projecting the
  // previous task while the next task's asynchronous load is still pending.
  const snapshot = view.taskId === taskId && view.snapshot?.taskId === taskId ? view.snapshot : null
  const following = view.taskId === taskId ? view.following : taskId ? preference(taskId) : null
  const accepted = useRef<WorkflowSnapshot | null>(null)
  const followingRef = useRef(following)
  followingRef.current = following
  const { hydrated, update, activeTabId, centralTabs, recentTabs } = history
  const chooseFollowing = useCallback((value: boolean) => {
    followingRef.current = value
    setView(previous => ({ taskId, snapshot: previous.taskId === taskId ? previous.snapshot : null, following: value }))
    if (taskId && enabled) { try { localStorage.setItem(`ziaf-follow-workflow:${taskId}`, String(value)) } catch { /* Optional view preference only. */ } }
  }, [taskId, enabled])
  useEffect(() => {
    if (!enabled || !taskId || !api) return
    let mounted = true
    accepted.current = null
    const accept = (next: WorkflowSnapshot | null) => {
      if (!mounted || !next || next.taskId !== taskId || !next.plan.codeFlow) return
      const current = accepted.current
      if (current?.taskId === taskId && (next.runId === current.runId ? next.sequence <= current.sequence : next.updatedAt <= current.updatedAt)) return
      accepted.current = next
      setView(previous => ({ taskId, snapshot: next, following: previous.taskId === taskId ? previous.following : preference(taskId) }))
    }
    const off = api.onEvent(accept)
    void api.get({ taskId }).then(accept).catch(() => { /* Plan/recovery owns actionable load errors; do not invent chats. */ })
    return () => { mounted = false; off() }
  }, [api, enabled, taskId])
  const locale = currentLocale()
  const projection = useMemo<WorkflowChats>(() => snapshot ? workflowChats(snapshot, russian, locale) : { tabs: [] }, [snapshot, russian, locale])
  useEffect(() => {
    if (!enabled || !hydrated || !snapshot) return
    const follow = followingRef.current ?? (activeTabId === 'chat-main' || projection.tabs.some(tab => tab.id === activeTabId))
    if (followingRef.current === null) chooseFollowing(follow)
    update(state => mergeWorkflowChats(state, projection, follow), true)
  }, [enabled, hydrated, snapshot, projection, update, activeTabId, centralTabs, recentTabs, chooseFollowing])
  const select = useCallback((id: string) => {
    if (enabled) chooseFollowing(id === projection.currentId)
  }, [enabled, chooseFollowing, projection.currentId])
  const stopFollowing = useCallback(() => { if (enabled) chooseFollowing(false) }, [enabled, chooseFollowing])
  const follow = useCallback(() => {
    if (!enabled || !projection.currentId) return
    chooseFollowing(true)
    // Explicit Follow may reopen the current phase; background events cannot.
    update(state => mergeWorkflowChats({ ...state, recentTabs: state.recentTabs.filter(tab => tab.id !== projection.currentId) }, projection, true), true)
  }, [enabled, chooseFollowing, update, projection])
  return { currentId: projection.currentId, following: following === true, select, stopFollowing, follow }
}
