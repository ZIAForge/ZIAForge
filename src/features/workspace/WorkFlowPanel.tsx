import { statusLabel, flowLabel } from './localizedLabels'
import { formatDate } from '../../i18n-core'
import { uiText, currentLocale } from '../../uiText'
import { useEffect, useRef, useState } from 'react'
import type { WorkArtifactReceipt, WorkFlowAPI, WorkFlowDefinition, WorkFlowResponse, WorkFlowSnapshot, WorkFollowUpRequest, WorkGate, WorkGateAction } from '../../../shared/work-flow'
import { useStore, type Task } from '../../store'
import { MarkdownMessage } from '../../components/MarkdownMessage'
import { WorkflowAgentSelector } from './WorkflowAgentSelector'
import { workPhaseTitle, workStatusTitle } from './useWorkFlow'
import type { ReviewTeamPreset } from '../../../shared/review-team'
import { ReviewTeamEditor } from './ReviewTeamEditor'
import { newReviewTeam } from './reviewTeamDraft'

const button = 'rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40'
const control = 'w-full rounded border border-zinc-700 bg-[#111317] p-2 text-xs text-zinc-200 disabled:opacity-50'
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const roleLabel = (definition: WorkFlowDefinition, role: string, id: string, ru: boolean) => {
  const name = definition.roleLabels?.[`${role}:${id}`]
  return name === 'Custom' ? uiText("Saved custom configuration", undefined, (ru) ? 'ru' : undefined) : name ? `${uiText("Preset snapshot", undefined, (ru) ? 'ru' : undefined)} ${name}` : null
}
type Operation = { method: 'start'; payload: Parameters<WorkFlowAPI['start']>[0] } | { method: 'respond'; payload: WorkFlowResponse } | { method: 'followUp'; payload: WorkFollowUpRequest }

/** Saved command IDs survive missing replies; only a serialized read can unlock them. */
function useWorkOperation(key: string, snapshot: WorkFlowSnapshot, api: WorkFlowAPI, onSnapshot: (value: WorkFlowSnapshot) => void) {
  const [restored] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      const request = raw ? JSON.parse(raw) as Operation : null
      if (request && (!['start', 'respond', 'followUp'].includes(request.method) || request.payload?.taskId !== snapshot.taskId || typeof request.payload.commandId !== 'string' || request.method !== 'start' && request.payload.runId !== snapshot.runId)) throw new Error(uiText("Invalid saved Work decision"))
      return { request, error: '' }
    } catch { return { request: null, error: 'Saved Work decision cannot be read. Restore local storage before continuing.' } }
  })
  const [pending, setPending] = useState(restored.request)
  const pendingRef = useRef(pending)
  const [error, setError] = useState(restored.error)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const clear = () => {
    try { localStorage.removeItem(key) } catch { /* Backend command receipts still prevent redelivery. */ }
    pendingRef.current = null; if (mounted.current) setPending(null)
  }
  useEffect(() => {
    if (pendingRef.current && snapshot.commandReceipts.some(receipt => receipt.commandId === pendingRef.current!.payload.commandId)) clear()
  // Only reconcile a backend receipt; never initiate a command from an effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.commandReceipts])
  const perform = async (operation: Operation) => {
    if (busyRef.current || restored.error) return
    const request = pendingRef.current ?? operation
    busyRef.current = true; setBusy(true); setError('')
    try {
      localStorage.setItem(key, JSON.stringify(request)); pendingRef.current = request; setPending(request)
      const next = request.method === 'start' ? await api.start(request.payload) : request.method === 'respond' ? await api.respond(request.payload) : await api.followUp(request.payload)
      if (!mounted.current) return
      clear(); onSnapshot(next)
    } catch (failure) {
      if (!mounted.current) return
      setError(message(failure))
      try {
        const current = await api.get({ taskId: request.payload.taskId })
        if (!mounted.current || !current || current.taskId !== snapshot.taskId) return
        // Both presence and absence are authoritative after the command barrier.
        const accepted = current.commandReceipts.some(receipt => receipt.commandId === request.payload.commandId)
        clear(); onSnapshot(current)
        if (accepted) setError('')
      } catch { /* Unknown acceptance: retain payload and ID, not a newly edited answer. */ }
    } finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }
  return { pending, busy, error, setError, perform, blocked: busy || !!restored.error }
}

export function WorkFlowPanel({ task, snapshot, loadError, onSnapshot, onClose, onOpenChat, api = window.ziafAPI.workFlows }: {
  task: Task; snapshot: WorkFlowSnapshot | null; loadError?: string
  onSnapshot: (value: WorkFlowSnapshot) => void; onClose: () => void; onOpenChat: (id: string, title: string) => void; api?: WorkFlowAPI
}) {
  const { settings } = useStore()
  const ru = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  return <section className="flex h-full min-h-0 flex-col" data-testid="work-flow-panel">
    <header className="flex items-center justify-between border-b border-zinc-800 p-3"><h3 className="text-sm font-medium">Work · {flowLabel(snapshot?.definition.kind ?? task.workflow ?? 'auto')}</h3><button type="button" className={button} onClick={onClose} aria-label={label('Close Work panel', 'Закрыть панель Work')}>×</button></header>
    <div className="flex-1 space-y-4 overflow-auto p-3">
      {(loadError || task.startupError) && <p role="alert" className="break-words text-xs text-rose-300">{loadError || task.startupError}</p>}
      {snapshot && snapshot.taskId === task.id ? <WorkFlowBody key={`${snapshot.taskId}:${snapshot.runId}`} task={task} snapshot={snapshot} ru={ru} api={api} onSnapshot={onSnapshot} onOpenChat={onOpenChat} /> : <p className="text-xs text-zinc-400">{label('Loading the saved Work process…', 'Загружаем сохранённый процесс Work…')}</p>}
    </div>
  </section>
}

function WorkFlowBody({ task, snapshot, ru, api, onSnapshot, onOpenChat }: {
  task: Task; snapshot: WorkFlowSnapshot; ru: boolean; api: WorkFlowAPI; onSnapshot: (value: WorkFlowSnapshot) => void; onOpenChat: (id: string, title: string) => void
}) {
  const { presets } = useStore()
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const [definition, setDefinition] = useState(snapshot.definition)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reviewTeams, setReviewTeams] = useState<ReviewTeamPreset[]>([])
  const savingRef = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (!dirty) setDefinition(snapshot.definition) }, [snapshot.definition, dirty])
  const operation = useWorkOperation(`ziaf-work-start:${task.id}:${snapshot.runId}`, snapshot, api, onSnapshot)
  useEffect(() => {
    if (!settingsOpen) return
    let current = true
    void Promise.resolve().then(() => window.ziafAPI.reviewTeams.list()).then(items => { if (current) setReviewTeams(items) }).catch(failure => { if (current) operation.setError(message(failure)) })
    return () => { current = false }
  // setError is a stable React setter; only opening settings triggers discovery.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen])
  const draft = snapshot.status === 'draft' && !snapshot.stages.some(stage => stage.invocations.length)
  const settingsLocked = !draft || saving || operation.blocked || !!operation.pending
  const set = (patch: Partial<WorkFlowDefinition>) => { setDefinition(previous => ({ ...previous, ...patch })); setDirty(true) }
  const pickInputs = async () => {
    if (settingsLocked || savingRef.current) return
    savingRef.current = true; setSaving(true)
    try { const inputs = await window.ziafAPI.workInputs.pick(); if (mounted.current) set({ inputs: [...new Map([...definition.inputs, ...inputs].map(input => [input.id, input])).values()] }) }
    catch (failure) { if (mounted.current) operation.setError(message(failure)) }
    finally { savingRef.current = false; if (mounted.current) setSaving(false) }
  }
  const assignFolder = async (custom: boolean) => {
    if (settingsLocked || savingRef.current) return
    savingRef.current = true; setSaving(true); operation.setError('')
    try {
      const folder = custom ? await window.ziafAPI.workFolders.pick() : null
      if (!mounted.current || custom && !folder) return
      const updated = await window.ziafAPI.workFolders.assign({ taskId: task.id, ...(folder ? { grantId: folder.id } : {}) })
      if (mounted.current) await useStore.getState().acceptWorkTasks([updated], task.id)
    } catch (failure) { if (mounted.current) operation.setError(message(failure)) }
    finally { savingRef.current = false; if (mounted.current) setSaving(false) }
  }
  const save = async (): Promise<WorkFlowSnapshot | null> => {
    if (savingRef.current || operation.blocked || operation.pending) return null
    savingRef.current = true; setSaving(true); operation.setError('')
    try {
      const next = await api.save({ taskId: task.id, expectedRevision: snapshot.revision, definition })
      if (!mounted.current) return null
      setDirty(false); setDefinition(next.definition); onSnapshot(next); return next
    } catch (failure) {
      if (mounted.current) {
        operation.setError(message(failure))
        try { const current = await api.get({ taskId: task.id }); if (mounted.current && current) { onSnapshot(current); if (JSON.stringify(current.definition) === JSON.stringify(definition)) setDirty(false) } } catch { /* Retain the editable proposal. */ }
      }
      return null
    } finally { savingRef.current = false; if (mounted.current) setSaving(false) }
  }
  const start = async () => {
    if (operation.pending) { await operation.perform(operation.pending); return }
    const current = dirty ? await save() : snapshot
    if (!current || !mounted.current) return
    await operation.perform({ method: 'start', payload: { taskId: task.id, revision: current.revision, commandId: crypto.randomUUID() } })
  }
  const pause = async () => { try { const current = await api.pause({ taskId: task.id }); if (mounted.current) onSnapshot(current) } catch (failure) { if (mounted.current) operation.setError(message(failure)) } }
  const phaseHasRun = snapshot.stages.some(stage => stage.invocations.length)
  const lastResult = [...snapshot.stages].reverse().flatMap(stage => [...stage.invocations].reverse()).find(invocation => invocation.result)?.result
  return <>
    <div className="space-y-2 text-xs"><p data-testid="work-flow-status" data-status={snapshot.status} className="font-medium text-orange-300">{workStatusTitle(snapshot.status, ru)}</p>{snapshot.reason && <p className="whitespace-pre-wrap break-words text-amber-200">{snapshot.reason}</p>}
      <p className="break-all text-zinc-500">{task.worktreePath}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={saving || operation.blocked || snapshot.status === 'running' || !!snapshot.pending || snapshot.status === 'completed' || snapshot.status === 'cancelled'} onClick={() => void start()} data-testid="work-flow-start">{operation.pending ? label('Retry saved start', 'Повторить сохранённый запуск') : phaseHasRun ? label('Resume', 'Продолжить') : label('Start', 'Начать')}</button>
        <button type="button" className={button} disabled={snapshot.status !== 'running'} onClick={() => void pause()} data-testid="work-flow-pause">{label('Stop', 'Остановить')}</button>
        <button type="button" className={button} disabled={!dirty || saving || operation.blocked || !!operation.pending || (!draft && snapshot.status !== 'paused')} onClick={() => void save()} data-testid="work-flow-save">{label('Save settings', 'Сохранить настройки')}</button>
      </div>
      {operation.error && <p role="alert" className="whitespace-pre-wrap text-rose-300">{operation.error}</p>}
    </div>
    <details open={settingsOpen} onToggle={event => setSettingsOpen(event.currentTarget.open)} className="space-y-3 rounded border border-zinc-800 p-3" data-testid="work-flow-settings"><summary className="cursor-pointer text-xs">{label('Request, roles and execution settings', 'Задание, роли и настройки выполнения')}</summary>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={settingsLocked} onClick={() => void assignFolder(false)} data-testid="work-flow-default-folder">{uiText("Default")}</button><button type="button" className={button} disabled={settingsLocked} onClick={() => void assignFolder(true)} data-testid="work-flow-pick-folder">{label('Choose another folder', 'Выбрать другую папку')}</button></div>
      <label className="block text-xs text-zinc-400">{label('Request', 'Задание')}<textarea className={`${control} mt-1`} rows={4} disabled={settingsLocked} value={definition.request} onChange={event => set({ request: event.target.value })} data-testid="work-flow-request" /></label>
      <label className="flex gap-2 text-xs"><input type="checkbox" checked={definition.advance === 'auto'} disabled={saving || operation.blocked || !!operation.pending || (!draft && snapshot.status !== 'paused')} onChange={event => set({ advance: event.target.checked ? 'auto' : 'manual' })} data-testid="work-flow-auto" />{label('Continue automatically between stages', 'Продолжать автоматически между этапами')}</label>
      <label className="flex gap-2 text-xs"><input type="checkbox" disabled={settingsLocked} checked={definition.review} onChange={event => set({ review: event.target.checked })} data-testid="work-flow-review" />{label('Independent review', 'Независимое ревью')}</label>
      <WorkflowAgentSelector value={definition.executor} onChange={next => set({ executor: { ...next, id: definition.executor.id } })} task={task} presets={presets} label={label('Executor / coordinator', 'Исполнитель / координатор')} prefix="work-flow-executor" disabled={settingsLocked} />
      {roleLabel(definition, 'executor', definition.executor.id, ru) && <p className="text-[10px] text-zinc-500">{roleLabel(definition, 'executor', definition.executor.id, ru)}</p>}
      {definition.review && <label className="block text-xs text-zinc-400">{label('Review team', 'Команда ревью')}<select className={control} data-testid="work-flow-review-team" disabled={settingsLocked} value={definition.reviewTeam?.id ?? ''} onChange={event => {
        if (!event.target.value) { set({ reviewTeam: undefined }); return }
        const team = event.target.value === '@new' ? newReviewTeam() : reviewTeams.find(item => item.id === event.target.value)
        if (team) set({ reviewTeam: structuredClone(team) })
      }}><option value="">{label('Individual reviewers', 'Отдельные ревьюеры')}</option><option value="@new">{label('Custom team', 'Своя команда')}</option>{definition.reviewTeam && !reviewTeams.some(team => team.id === definition.reviewTeam!.id) && <option value={definition.reviewTeam.id}>{definition.reviewTeam.name}</option>}{reviewTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
      {definition.review && definition.reviewTeam && <ReviewTeamEditor value={definition.reviewTeam} onChange={reviewTeam => set({ reviewTeam })} task={task} presets={presets} ru={ru} disabled={settingsLocked} />}
      {definition.review && !definition.reviewTeam && definition.reviewers.map((source, index) => <div key={source.id} className="space-y-2"><WorkflowAgentSelector value={source} onChange={next => set({ reviewers: definition.reviewers.map(item => item.id === source.id ? { ...next, id: source.id } : item) })} task={task} presets={presets} label={`${label('Reviewer', 'Ревьюер')} ${index + 1}`} prefix={`work-flow-reviewer-${index}`} readOnly disabled={settingsLocked} />{roleLabel(definition, 'reviewer', source.id, ru) && <p className="text-[10px] text-zinc-500">{roleLabel(definition, 'reviewer', source.id, ru)}</p>}<button type="button" className={button} disabled={settingsLocked || definition.reviewers.length <= 1} onClick={() => set({ reviewers: definition.reviewers.filter(item => item.id !== source.id) })}>{label('Remove reviewer', 'Удалить ревьюера')}</button></div>)}
      {definition.review && !definition.reviewTeam && <button type="button" className={button} disabled={settingsLocked || definition.reviewers.length >= 8} onClick={() => set({ reviewers: [...definition.reviewers, { id: crypto.randomUUID(), presetName: '@task' }] })}>{label('Add reviewer', 'Добавить ревьюера')}</button>}
      {definition.helpers?.map((source, index) => <div key={source.id} className="space-y-2 rounded border border-zinc-800 p-2"><WorkflowAgentSelector value={source} onChange={next => set({ helpers: definition.helpers!.map(item => item.id === source.id ? { ...next, id: source.id, instructions: source.instructions } : item) })} task={task} presets={presets} label={`${label('Supporting specialist', 'Помощник-специалист')} ${index + 1}`} prefix={`work-flow-helper-${index}`} readOnly disabled={settingsLocked} /><textarea className={control} maxLength={10000} disabled={settingsLocked} value={source.instructions} aria-label={label('Helper assignment', 'Задание помощника')} onChange={event => set({ helpers: definition.helpers!.map(item => item.id === source.id ? { ...item, instructions: event.target.value } : item) })} /><button type="button" className={button} disabled={settingsLocked} onClick={() => set({ helpers: definition.helpers!.filter(item => item.id !== source.id) })}>{label('Remove helper', 'Удалить помощника')}</button></div>)}
      <button type="button" className={button} disabled={settingsLocked || (definition.helpers?.length ?? 0) >= 4} onClick={() => set({ helpers: [...definition.helpers ?? [], { id: crypto.randomUUID(), presetName: '@task', instructions: label('Research the assigned question and report evidence and limitations.', 'Исследуйте поставленный вопрос, приведите доказательства и ограничения.') }] })}>{label('Add supporting specialist', 'Добавить помощника-специалиста')}</button>
      {definition.deep?.workers.map((source, index) => <div key={source.id} className="space-y-2"><WorkflowAgentSelector value={source} onChange={next => set({ deep: { workers: definition.deep!.workers.map(item => item.id === source.id ? { ...next, id: source.id } : item) } })} task={task} presets={presets} label={`${label('Worker', 'Участник')} ${index + 1}`} prefix={`work-flow-worker-${index}`} readOnly disabled={settingsLocked} />{roleLabel(definition, 'worker', source.id, ru) && <p className="text-[10px] text-zinc-500">{roleLabel(definition, 'worker', source.id, ru)}</p>}<div className="flex gap-2">{[-1, 1].map(delta => <button type="button" key={delta} className={button} disabled={settingsLocked || index + delta < 0 || index + delta >= definition.deep!.workers.length} onClick={() => { const workers = [...definition.deep!.workers]; [workers[index], workers[index + delta]] = [workers[index + delta], workers[index]]; set({ deep: { workers } }) }}>{delta < 0 ? '↑' : '↓'}</button>)}<button type="button" className={button} disabled={settingsLocked || definition.deep!.workers.length <= 1} onClick={() => set({ deep: { workers: definition.deep!.workers.filter(item => item.id !== source.id) } })}>{label('Remove', 'Удалить')}</button></div></div>)}
      {definition.deep && <button type="button" className={button} disabled={settingsLocked || definition.deep.workers.length >= 8} onClick={() => set({ deep: { workers: [...definition.deep!.workers, { id: crypto.randomUUID(), presetName: '@task' }] } })}>{label('Add worker', 'Добавить участника')}</button>}
      {phaseHasRun && <p className="text-xs text-zinc-500">{label('This run keeps its saved roles and context. Pause to change automatic advancement.', 'Этот запуск сохраняет выбранные роли и контекст. Для изменения автопродолжения остановите выполнение.')}</p>}
      <button type="button" className={button} disabled={settingsLocked} onClick={() => void pickInputs()} data-testid="work-flow-attach">{label('Attach sources', 'Приложить источники')}</button>
      {!!definition.inputs.length && <ul className="space-y-1 text-xs text-zinc-400">{definition.inputs.map(input => <li key={input.id} className="break-all">{input.name} · {uiText("Bytes: {count}", { count: input.sizeBytes })} · {input.sha256.slice(0, 12)} <button type="button" className={button} disabled={settingsLocked} onClick={() => set({ inputs: definition.inputs.filter(item => item.id !== input.id) })}>{label('Remove', 'Удалить')}</button></li>)}</ul>}
    </details>
    {snapshot.pending && <WorkGatePanel key={`${snapshot.runId}:${snapshot.pending.id}`} snapshot={snapshot} gate={snapshot.pending} workspace={task.worktreePath} ru={ru} api={api} onSnapshot={onSnapshot} />}
    {snapshot.plan?.length ? <section className="space-y-2" data-testid="work-flow-plan"><h4 className="text-xs font-medium">{label('To-do', 'План действий')}</h4>{snapshot.plan.map(step => <article key={step.id} className="rounded border border-zinc-800 p-2 text-xs"><p className={step.status === 'completed' ? 'text-emerald-300' : 'text-zinc-200'}>{step.status === 'completed' ? '✓ ' : ''}{step.title}</p><p className="mt-1 whitespace-pre-wrap text-zinc-500">{step.instructions}</p></article>)}</section> : <p data-testid="work-flow-no-plan" className="text-xs text-zinc-500">{label('No separate plan has been created. Stages and results appear as the task progresses.', 'Отдельный план пока не создан. Этапы и результаты появятся по мере выполнения.')}</p>}
    {lastResult && <section data-testid="work-flow-result" className="space-y-2 text-xs"><h4 className="font-medium">{label('Latest result', 'Последний результат')}</h4><MarkdownMessage text={lastResult.summary} /></section>}
    <section className="space-y-2" data-testid="work-flow-stages"><h4 className="text-xs font-medium">{label('Stages and conversations', 'Этапы и чаты')}</h4>{snapshot.stages.map(stage => <article key={stage.id} className="space-y-2 rounded border border-zinc-800 p-2 text-xs" data-testid={`work-stage-${stage.id}`}>
      <p>{workPhaseTitle(stage.phase, ru)} · {workStatusTitle(stage.status, ru)} · {label('Round', 'Раунд')} {stage.round}</p><p className="text-zinc-500">{roleLabel(snapshot.definition, stage.phase === 'worker' ? 'worker' : stage.phase === 'review' ? 'reviewer' : stage.phase === 'review-architect' ? 'architect' : stage.phase === 'helper' ? 'helper' : 'executor', stage.sourceId ?? stage.source.id, ru) ?? stage.source.presetName} · {stage.source.configuration?.provider} {stage.source.configuration?.model}</p>
      {stage.error && <p className="whitespace-pre-wrap text-rose-300">{stage.error}</p>}
      {stage.invocations.map(invocation => <div key={invocation.id} className="flex flex-wrap items-center gap-2"><span className="text-zinc-500">{workStatusTitle(invocation.purpose, ru)} · {workStatusTitle(invocation.status, ru)}</span>{invocation.session && <button type="button" className={button} onClick={() => onOpenChat(invocation.session!.chatId, workPhaseTitle(stage.phase, ru))} data-testid={`work-chat-${invocation.id}`}>{label('Agent / approvals', 'Агент / разрешения')}</button>}{invocation.error && <span className="break-words text-rose-300">{invocation.error}</span>}</div>)}
      {stage.verification.map((receipt, index) => <details key={index}><summary className="cursor-pointer text-zinc-400">{label('Check', 'Проверка')} {index + 1}</summary><pre className="overflow-auto whitespace-pre-wrap break-all text-[10px]">{JSON.stringify(receipt, null, 2)}</pre></details>)}
    </article>)}</section>
    {!!snapshot.artifacts.length && <section className="space-y-2" data-testid="work-flow-artifacts"><h4 className="text-xs font-medium">{label('Saved documents and versions', 'Сохранённые документы и версии')}</h4>{snapshot.artifacts.map(artifact => <WorkArtifact key={artifact.id} receipt={artifact} taskId={task.id} api={api} ru={ru} />)}</section>}
    {!!snapshot.sources.length && <section className="space-y-2 text-xs" data-testid="work-flow-sources"><h4 className="font-medium">{label('Sources', 'Источники')}</h4>{snapshot.sources.map(source => <article key={source.id} className="break-words rounded border border-zinc-800 p-2"><p>{source.title}</p><p className="text-zinc-400">{source.url}</p><p className="text-zinc-500">{statusLabel(source.kind, ru)} · {source.provenance === 'provided' ? label('Provided source', 'Предоставленный источник') : label('Reported by the model; retrieval is not independently verified', 'Указан моделью; получение не подтверждено независимо')} · {Number.isNaN(Date.parse(source.accessedAt)) ? source.accessedAt : formatDate(currentLocale(), Date.parse(source.accessedAt))}</p></article>)}</section>}
    {snapshot.status === 'completed' && <WorkFollowUp key={`${snapshot.runId}:${snapshot.round}`} snapshot={snapshot} ru={ru} api={api} onSnapshot={onSnapshot} />}
  </>
}

function WorkArtifact({ receipt, taskId, api, ru }: { receipt: WorkArtifactReceipt; taskId: string; api: WorkFlowAPI; ru: boolean }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const read = async () => { if (busy) return; setBusy(true); setError(''); try { const value = await api.readArtifact({ taskId, artifactId: receipt.id }); if (mounted.current) setContent(value.content) } catch (failure) { if (mounted.current) setError(message(failure)) } finally { if (mounted.current) setBusy(false) } }
  const open = async () => { if (busy) return; setBusy(true); setError(''); try { await api.openArtifact({ taskId, artifactId: receipt.id }) } catch (failure) { if (mounted.current) setError(message(failure)) } finally { if (mounted.current) setBusy(false) } }
  return <article className="space-y-2 rounded border border-zinc-700 p-2 text-xs" data-testid={`work-artifact-${receipt.id}`}><p className="break-all font-medium">{receipt.name} · v{receipt.version}</p><p className="break-all text-[10px] text-zinc-500">{uiText("Bytes: {count}", { count: receipt.bytes })} · SHA256 {receipt.sha256}</p><div className="flex gap-2">{!receipt.binary && <button type="button" className={button} disabled={busy} onClick={() => void read()}>{uiText("Read document", undefined, (ru) ? 'ru' : undefined)}</button>}<button type="button" className={button} disabled={busy} onClick={() => void open()}>{uiText("Open file", undefined, (ru) ? 'ru' : undefined)}</button></div>{error && <p role="alert" className="text-rose-300">{error}</p>}{content !== null && <div data-testid={`work-artifact-content-${receipt.id}`}><MarkdownMessage text={content} /></div>}</article>
}

function WorkGatePanel({ snapshot, gate, workspace, ru, api, onSnapshot }: { snapshot: WorkFlowSnapshot; gate: WorkGate; workspace?: string; ru: boolean; api: WorkFlowAPI; onSnapshot: (value: WorkFlowSnapshot) => void }) {
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const key = `ziaf-work-gate-draft:${snapshot.taskId}:${snapshot.runId}:${gate.id}`
  const [draft] = useState(() => { try { const value = JSON.parse(localStorage.getItem(key) ?? '{}') as { text?: string; answers?: Record<string, string> }; return { text: typeof value.text === 'string' ? value.text : '', answers: value.answers && Object.values(value.answers).every(item => typeof item === 'string') ? value.answers : {} } } catch { return { text: '', answers: {} } } })
  const [text, setText] = useState(draft.text)
  const [answers, setAnswers] = useState<Record<string, string>>(draft.answers)
  const operation = useWorkOperation(`ziaf-work-gate-command:${snapshot.taskId}:${snapshot.runId}:${gate.id}`, snapshot, api, onSnapshot)
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify({ text, answers })) } catch { /* In-memory drafts remain. Command acceptance uses strict persistence. */ } }, [key, text, answers])
  const gateTitles: Record<WorkGate['kind'], [string, string]> = { questions: ['Questions', 'Вопросы'], 'brainstorm-direction': ['Choose a direction', 'Выбор направления'], plan: ['Proposed plan', 'Предложенный план'], outline: ['Proposed outline', 'Предложенная структура'], 'artifact-review': ['Review the result', 'Оценка результата'], continue: ['Next stage', 'Следующий этап'], recovery: ['Resolve an interrupted stage', 'Разобраться с прерванным этапом'] }
  const actionLabels: Record<WorkGateAction, [string, string]> = { answer: ['Send answers', 'Отправить ответы'], more: ['More ideas', 'Ещё идеи'], evaluate: ['Evaluate options', 'Оценить варианты'], approve: ['Approve and continue', 'Принять и продолжить'], 'approve-with-comments': ['Accept with comments', 'Принять с комментарием'], changes: ['Address changes', 'Внести изменения'], cancel: ['Stop here', 'Остановиться здесь'], finish: ['Finish', 'Завершить'], continue: ['Continue', 'Продолжить'] }
  const respond = (action: WorkGateAction) => {
    const selectedAnswers = gate.questions?.map(question => ({ questionId: question.id, text: answers[question.id]?.trim() ?? '' }))
    if (text.includes('\0') || text.length > 12000 || selectedAnswers?.some(answer => answer.text.includes('\0') || answer.text.length > 4000)) { operation.setError(label('Remove NUL and keep the response within its text limits.', 'Удалите NUL и сократите ответ до допустимого объёма.')); return }
    void operation.perform({ method: 'respond', payload: { taskId: snapshot.taskId, runId: snapshot.runId, revision: snapshot.revision, gateId: gate.id, commandId: crypto.randomUUID(), action, ...(text.trim() ? { text: text.trim() } : {}), ...(action === 'answer' ? { answers: selectedAnswers } : {}) } })
  }
  return <section className="space-y-3 rounded border border-orange-500/50 bg-orange-500/5 p-3 text-xs" data-testid="work-flow-gate"><h4 className="font-medium text-orange-300">{label('Your decision is needed', 'Нужно ваше решение')} · {uiText(gateTitles[gate.kind][0], undefined, ru ? 'ru' : undefined)}</h4><MarkdownMessage text={gate.summary} />
    {gate.questions?.map(question => <label key={question.id} className="block space-y-2"><span>{question.question}</span>{!!question.options?.length && <span className="flex flex-wrap gap-1">{question.options.map(option => <button type="button" className={button} key={option} disabled={operation.blocked || !!operation.pending} onClick={() => setAnswers(previous => ({ ...previous, [question.id]: option }))}>{option}</button>)}</span>}<textarea className={control} rows={2} maxLength={4000} value={answers[question.id] ?? ''} disabled={operation.blocked || !!operation.pending} onChange={event => setAnswers(previous => ({ ...previous, [question.id]: event.target.value }))} data-testid={`work-question-${question.id}`} /></label>)}
    {gate.proposedSteps?.map(step => <article key={step.id} className="space-y-2 rounded border border-zinc-700 p-2"><h5>{step.title}</h5><p className="whitespace-pre-wrap">{step.instructions}</p>{step.acceptance.map((item, index) => <p key={index} className="text-zinc-400">• {item}</p>)}{step.verification.map((command, index) => <pre key={index} className="whitespace-pre-wrap break-all text-[10px] text-amber-200" data-testid="work-proposed-command">{JSON.stringify({ ...command, cwd: workspace ?? 'Registered task folder' }, null, 2)}</pre>)}</article>)}
    {!!gate.proposedSteps?.some(step => step.verification.length) && <p className="text-amber-200">{label('Approval allows these exact commands in this task folder.', 'Согласие разрешает эти конкретные команды в папке задачи.')}</p>}
    {gate.artifactIds.map(id => { const artifact = snapshot.artifacts.find(item => item.id === id); return artifact ? <WorkArtifact key={id} receipt={artifact} taskId={snapshot.taskId} api={api} ru={ru} /> : null })}
    <label className="block space-y-1"><span>{label('Comments or changes', 'Комментарии или изменения')}</span><textarea className={control} rows={3} maxLength={12000} value={text} disabled={operation.blocked || !!operation.pending} onChange={event => setText(event.target.value)} data-testid="work-gate-comments" /></label>
    {operation.error && <p role="alert" className="whitespace-pre-wrap text-rose-300">{operation.error}</p>}
    <div className="flex flex-wrap gap-2">{operation.pending ? <button type="button" className={button} disabled={operation.blocked} onClick={() => void operation.perform(operation.pending!)} data-testid="work-gate-retry">{label('Retry saved decision', 'Повторить сохранённое решение')}</button> : gate.actions.map(action => <button type="button" key={action} className={button} disabled={operation.blocked || (action === 'changes' || action === 'approve-with-comments') && !text.trim() || action === 'answer' && (!gate.questions?.length || gate.questions.some(question => !answers[question.id]?.trim()))} onClick={() => respond(action)} data-testid={`work-gate-${action}`}>{uiText(actionLabels[action][0], undefined, ru ? 'ru' : undefined)}</button>)}</div>
    <p className="text-[10px] text-zinc-500">{label('Closing the panel does not accept this decision.', 'Закрытие панели не означает согласия.')}</p>
  </section>
}

function WorkFollowUp({ snapshot, ru, api, onSnapshot }: { snapshot: WorkFlowSnapshot; ru: boolean; api: WorkFlowAPI; onSnapshot: (value: WorkFlowSnapshot) => void }) {
  const key = `ziaf-work-follow-up:${snapshot.taskId}:${snapshot.runId}:${snapshot.round}`
  const [text, setText] = useState(() => { try { return localStorage.getItem(`${key}:text`) ?? '' } catch { return '' } })
  const operation = useWorkOperation(`${key}:command`, snapshot, api, onSnapshot)
  useEffect(() => { try { localStorage.setItem(`${key}:text`, text) } catch { /* Keep current draft. */ } }, [key, text])
  const send = () => { if (text.includes('\0') || !text.trim() || text.length > 12000) { operation.setError(uiText("Enter a request up to 12,000 characters without NUL.", undefined, (ru) ? 'ru' : undefined)); return } void operation.perform({ method: 'followUp', payload: { taskId: snapshot.taskId, runId: snapshot.runId, revision: snapshot.revision, commandId: crypto.randomUUID(), artifactId: snapshot.artifacts.at(-1)?.id, text: text.trim() } }) }
  return <section className="space-y-2 rounded border border-zinc-700 p-3 text-xs" data-testid="work-follow-up"><h4>{uiText("Continue working on the result", undefined, (ru) ? 'ru' : undefined)}</h4><textarea className={control} rows={3} value={text} maxLength={12000} disabled={operation.blocked || !!operation.pending} onChange={event => setText(event.target.value)} data-testid="work-follow-up-text" />{operation.error && <p role="alert" className="text-rose-300">{operation.error}</p>}<button type="button" className={button} disabled={operation.blocked || !operation.pending && !text.trim()} onClick={() => operation.pending ? void operation.perform(operation.pending) : send()} data-testid="work-follow-up-send">{operation.pending ? uiText("Retry saved request", undefined, (ru) ? 'ru' : undefined) : uiText("Send follow-up", undefined, (ru) ? 'ru' : undefined)}</button></section>
}
