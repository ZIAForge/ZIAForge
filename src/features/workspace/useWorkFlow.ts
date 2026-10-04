import { uiText, currentLocale } from '../../uiText'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WorkFlowAPI, WorkFlowSnapshot, WorkPhase } from '../../../shared/work-flow'
import type { useTaskChatHistory } from './useTaskChatHistory'
import { mergeWorkflowChats, type WorkflowChats } from './useWorkflowChats'

export function workPhaseTitle(phase: WorkPhase, ru: boolean, locale = currentLocale()): string {
  const titles: Record<WorkPhase, [string, string]> = {
    intake: ['Task', 'Задание'], requirements: ['Requirements', 'Требования'], planning: ['Plan', 'План'], execution: ['Execution', 'Выполнение'],
    divergence: ['Ideas', 'Идеи'], convergence: ['Evaluate options', 'Оценка вариантов'], research: ['Research', 'Исследование'], outline: ['Outline', 'Структура'],
    draft: ['Draft', 'Черновик'], worker: ['Independent perspective', 'Независимое мнение'], synthesis: ['Synthesis', 'Сводный результат'], revision: ['Revision', 'Правки'],
    helper: ['Supporting work', 'Дополнительная работа'], review: ['Review', 'Ревью'], 'review-architect': ['Report architect', 'Архитектор отчётов'], delivery: ['Result', 'Результат'], 'follow-up': ['Follow-up', 'Продолжение'],
  }
  return uiText(titles[phase][0], undefined, ru ? 'ru' : locale)
}

export function workStatusTitle(status: string, ru: boolean, locale = currentLocale()): string {
  const titles: Record<string, [string, string]> = { draft: ['Draft', 'Черновик'], running: ['Working', 'Выполняется'], waiting: ['Your decision', 'Нужно решение'], waiting_input: ['Awaiting an answer', 'Ожидается ответ'], paused: ['Paused', 'Остановлено'], completed: ['Completed', 'Завершено'], cancelled: ['Cancelled', 'Отменено'], blocked: ['Needs attention', 'Нужна помощь'], pending: ['Waiting', 'Ожидает'], failed: ['Failed', 'Ошибка'], interrupted: ['Interrupted', 'Прервано'], uncertain: ['Outcome unknown', 'Исход неизвестен'], initial: ['Initial request', 'Первый запрос'], answer: ['Answer', 'Ответ'], repair: ['Report recovery', 'Восстановление отчёта'], continuation: ['Continuation', 'Продолжение'] }
  return titles[status] ? uiText(titles[status][0], undefined, ru ? 'ru' : locale) : status
}

export function workFlowChats(snapshot: WorkFlowSnapshot, ru = false, locale = currentLocale()): WorkflowChats {
  const tabs = new Map<string, { id: string; name: string; type: 'chat' }>()
  let latest: string | undefined
  let working: string | undefined
  let gate: string | undefined
  for (const stage of snapshot.stages) {
    const workerIndex = snapshot.definition.deep?.workers.findIndex(source => source.id === stage.sourceId) ?? -1
    const name = `${workPhaseTitle(stage.phase, ru, locale)}${workerIndex >= 0 ? ` ${workerIndex + 1}` : ''}${stage.round > 0 ? ` · ${uiText("Round", undefined, ru ? 'ru' : locale)} ${stage.round}` : ''}`
    for (const invocation of stage.invocations) {
      const id = invocation.session?.chatId
      if (!id) continue
      tabs.set(id, { id, name, type: 'chat' }); latest = id
      if (invocation.status === 'running') working = id
      if (snapshot.pending?.stageId === stage.id) gate = id
    }
  }
  return { tabs: [...tabs.values()], currentId: gate ?? working ?? latest }
}

/** One task-bound subscription also serves the workspace while its panel is closed. */
export function useWorkFlow(taskId: string | undefined, api: WorkFlowAPI | undefined = window.ziafAPI.workFlows) {
  const [view, setView] = useState<{ taskId?: string; snapshot: WorkFlowSnapshot | null; error: string }>({ taskId, snapshot: null, error: '' })
  const accept = useCallback((snapshot: WorkFlowSnapshot | null) => {
    if (!snapshot || snapshot.taskId !== taskId) return
    setView(previous => {
      const current = previous.taskId === taskId ? previous.snapshot : null
      if (current && (current.runId === snapshot.runId ? snapshot.sequence <= current.sequence : snapshot.updatedAt <= current.updatedAt)) return previous
      return { taskId, snapshot, error: '' }
    })
  }, [taskId])
  useEffect(() => {
    if (!taskId || !api) return
    let active = true
    const receive = (snapshot: WorkFlowSnapshot | null) => { if (active) accept(snapshot) }
    const off = api.onEvent(receive)
    void api.get({ taskId }).then(receive).catch(failure => {
      if (active) setView(previous => ({ taskId, snapshot: previous.taskId === taskId ? previous.snapshot : null, error: failure instanceof Error ? failure.message : String(failure) }))
    })
    return () => { active = false; off() }
  }, [taskId, api, accept])
  return { snapshot: view.taskId === taskId ? view.snapshot : null, error: view.taskId === taskId ? view.error : '', accept }
}

type History = Pick<ReturnType<typeof useTaskChatHistory>, 'hydrated' | 'update' | 'centralTabs' | 'activeTabId' | 'recentTabs'>
const preference = (id?: string): boolean | null => {
  try { const value = id && localStorage.getItem(`ziaf-follow-work:${id}`); return value === 'true' ? true : value === 'false' ? false : null } catch { return null }
}
export function useWorkFlowChats(taskId: string | undefined, value: WorkFlowSnapshot | null, history: History, ru: boolean) {
  const snapshot = taskId && value?.taskId === taskId ? value : null
  const [choice, setChoice] = useState<{ taskId?: string; follow: boolean | null }>(() => ({ taskId, follow: preference(taskId) }))
  const following = choice.taskId === taskId ? choice.follow : preference(taskId)
  const followingRef = useRef(following); followingRef.current = following
  const { hydrated, update, activeTabId, centralTabs, recentTabs } = history
  const locale = currentLocale()
  const projection = useMemo<WorkflowChats>(() => snapshot ? workFlowChats(snapshot, ru, locale) : { tabs: [] }, [snapshot, ru, locale])
  const choose = useCallback((follow: boolean) => {
    if (!taskId) return
    followingRef.current = follow; setChoice({ taskId, follow })
    try { localStorage.setItem(`ziaf-follow-work:${taskId}`, String(follow)) } catch { /* View preference only. */ }
  }, [taskId])
  useEffect(() => {
    if (!snapshot || !hydrated) return
    const follow = followingRef.current ?? (activeTabId === 'chat-main' || projection.tabs.some(tab => tab.id === activeTabId))
    if (followingRef.current === null) choose(follow)
    update(state => mergeWorkflowChats(state, projection, follow), true)
  }, [snapshot, hydrated, activeTabId, centralTabs, recentTabs, projection, choose, update])
  const select = useCallback((id: string) => { if (taskId) choose(id === projection.currentId) }, [taskId, choose, projection.currentId])
  const stopFollowing = useCallback(() => { if (taskId) choose(false) }, [taskId, choose])
  const follow = useCallback(() => {
    if (!taskId || !projection.currentId) return
    choose(true)
    update(state => mergeWorkflowChats({ ...state, recentTabs: state.recentTabs.filter(tab => tab.id !== projection.currentId) }, projection, true), true)
  }, [taskId, projection, choose, update])
  return { currentId: projection.currentId, following: following === true, select, stopFollowing, follow }
}
