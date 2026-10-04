import { uiText } from '../../uiText'
import { useEffect, useRef, useState } from 'react'
import { BrainCircuit, Check, Lightbulb, PenLine, Search, Sparkles, Workflow } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { CreateTaskConfig, StoredTask } from '../../../shared/legacy-ipc'
import type { WorkInputRef, WorkKind } from '../../../shared/work-flow'
import type { WorkflowReviewSource } from '../../../shared/workflow'
import { useStore, type Task } from '../../store'
import { AgentSelectionFields, type ChatConfiguration } from './ChatSettingsPanel'
import { WorkflowAgentSelector } from './WorkflowAgentSelector'
import { presetProvider } from './agentConfiguration'
import { clearWorkStartIntent, readWorkStartIntent, saveWorkStartIntent, submitWorkCopies } from './workStartIntent'

const draftKey = 'ziaforge-new-work-draft-v1'
const control = 'w-full rounded border border-zinc-700 bg-[#111317] p-2 text-xs text-zinc-200 disabled:opacity-50'
const button = 'rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40'
type FolderChoice = { id: string; path: string; name: string } | null
interface Draft { description: string; kind: WorkKind; copies: ChatConfiguration[]; inputs: WorkInputRef[]; folder: FolderChoice; advance: 'auto' | 'manual'; review: boolean; reviewers: WorkflowReviewSource[]; workers: WorkflowReviewSource[] }
const selections = (request: CreateTaskConfig): ChatConfiguration => ({ presetName: request.model ?? '', provider: request.provider ?? 'codex', model: request.providerModel ?? 'auto', apiConnectionId: request.apiConnectionId, permissions: request.permissions, reasoningEffort: request.reasoningEffort })
const validSelection = (selection: ChatConfiguration) => Boolean(selection.model.trim() && (selection.provider !== 'api' || selection.apiConnectionId))
const validRole = (role: WorkflowReviewSource) => Boolean(role.presetName && (role.presetName !== '@custom' || typeof role.configuration?.model === 'string' && role.configuration.model.trim() && (role.configuration.provider !== 'api' || role.configuration.apiConnectionId)))
const workModes = [
  { kind: 'auto', title: 'Auto', icon: Sparkles, color: 'bg-amber-500/10 text-amber-400' },
  { kind: 'brainstorm', title: 'Brainstorm', icon: Lightbulb, color: 'bg-orange-500/10 text-orange-400' },
  { kind: 'deep-brainstorm', title: 'Deep Brainstorm', icon: BrainCircuit, color: 'bg-violet-500/10 text-violet-400' },
  { kind: 'research', title: 'Research', icon: Search, color: 'bg-cyan-500/10 text-cyan-400' },
  { kind: 'write', title: 'Write', icon: PenLine, color: 'bg-emerald-500/10 text-emerald-400' },
] as const satisfies readonly { kind: WorkKind; title: string; icon: typeof Sparkles; color: string }[]

export function WorkNewTask({ initialSelection, ru }: { initialSelection: ChatConfiguration; ru: boolean }) {
  const { presets, acceptWorkTasks, selectTask } = useStore()
  const { t, direction } = useTranslation()
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const [restored] = useState(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      const value = raw ? JSON.parse(raw) as Draft : null
      if (value && (typeof value.description !== 'string' || !['auto', 'brainstorm', 'deep-brainstorm', 'research', 'write'].includes(value.kind) ||
        !Array.isArray(value.copies) || !value.copies.length || value.copies.length > 4 || value.copies.some(item => !item || typeof item.model !== 'string' || typeof item.presetName !== 'string' || !['codex', 'claude', 'antigravity', 'api'].includes(item.provider)) ||
        !Array.isArray(value.inputs) || value.inputs.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string') ||
        !Array.isArray(value.workers) || !Array.isArray(value.reviewers) || [...value.workers, ...value.reviewers].some(item => !item || typeof item.id !== 'string' || typeof item.presetName !== 'string') ||
        value.folder && (typeof value.folder.id !== 'string' || typeof value.folder.path !== 'string' || typeof value.folder.name !== 'string'))) throw new Error(uiText("Invalid saved Work draft"))
      return { draft: value, intent: readWorkStartIntent(), error: '' }
    } catch { return { draft: null, intent: null, error: label('The saved Work request cannot be read. Restore local storage before creating another task.', 'Не удалось прочитать сохранённый Work-запрос. Восстановите локальное хранилище перед созданием новой задачи.') } }
  })
  const [draft, setDraft] = useState<Draft>(() => restored.draft ?? { description: '', kind: 'auto', copies: [initialSelection], inputs: [], folder: null, advance: 'auto', review: true,
    reviewers: [{ id: 'reviewer', presetName: '@task' }], workers: Array.from({ length: 3 }, (_, index) => ({ id: `worker-${index + 1}`, presetName: presets.filter(presetProvider)[index]?.name ?? '@task' })) })
  const [intent, setIntent] = useState(restored.intent)
  const intentRef = useRef(intent)
  const [accepted, setAccepted] = useState<StoredTask[]>(restored.intent?.accepted ?? [])
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mounted = useRef(false)
  const [error, setError] = useState(restored.error)
  const [sourceMenu, setSourceMenu] = useState(false)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const revision = useRef(0)
  const locked = busy || !!intent || !!restored.error
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (!restored.error) { try { localStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* Start persists strictly before mutation. */ } } }, [draft, restored.error])
  useEffect(() => {
    if (!restored.draft?.inputs.length) return
    let current = true
    void window.ziafAPI.workInputs.list({ ids: restored.draft.inputs.map(input => input.id) }).then(inputs => {
      if (current && inputs.length !== restored.draft!.inputs.length) setError(label('Some saved inputs are unavailable. Remove or attach them again before starting.', 'Некоторые сохранённые источники недоступны. Удалите их или приложите заново перед запуском.'))
    }).catch(failure => { if (current) setError(String(failure)) })
    return () => { current = false }
  // A read-only validation of the initial saved attachments, never a selection reset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const change = (patch: Partial<Draft>) => { revision.current++; setDraft(previous => ({ ...previous, ...patch })) }
  const task: Task = { id: 'work-selection', repoId: 'work-folder', name: '', status: 'idle', logs: [], feed: [], todoSteps: [], gitChanges: [],
    model: draft.copies[0].presetName, agentProvider: draft.copies[0].provider, providerModel: draft.copies[0].model, apiConnectionId: draft.copies[0].apiConnectionId, permissions: draft.copies[0].permissions, reasoningEffort: draft.copies[0].reasoningEffort }
  const picker = async (kind: 'folder' | 'inputs') => {
    if (locked || busyRef.current) return
    busyRef.current = true; setBusy(true); setError('')
    try {
      if (kind === 'folder') { const folder = await window.ziafAPI.workFolders.pick(); if (mounted.current && folder) change({ folder }) }
      else { const inputs = await window.ziafAPI.workInputs.pick(); if (mounted.current) setDraft(previous => ({ ...previous, inputs: [...new Map([...previous.inputs, ...inputs].map(input => [input.id, input])).values()] })) }
    } catch (failure) { if (mounted.current) setError(String(failure)) }
    finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }
  const create = async (start: boolean) => {
    if (busyRef.current || restored.error) return
    if (!intentRef.current && (!draft.description.trim() || draft.description.includes('\0') || draft.description.length > 18000 || draft.copies.some(item => !validSelection(item)) || draft.review && draft.reviewers.some(item => !validRole(item)) || draft.kind === 'deep-brainstorm' && draft.workers.some(item => !validRole(item)))) {
      setError(label('Complete the request, model and required roles. API selections need a connection. Remove NUL characters.', 'Заполните запрос, модель и необходимые роли. Для API выберите подключение. Удалите NUL из текста.')); return
    }
    const atRevision = revision.current
    busyRef.current = true; setBusy(true); setError('')
    try {
      let batch = intentRef.current
      if (!batch) {
        const name = draft.description.trim().split('\n')[0].slice(0, 80)
        batch = { id: crypto.randomUUID(), accepted: [], requests: draft.copies.map((selection, index) => ({
          createRequestId: crypto.randomUUID(), startWorkflow: start, name: draft.copies.length > 1 ? `${name} (${index + 1} · ${selection.presetName || selection.provider})` : name,
          repoId: 'work-folder', branchType: 'Folder', branchName: draft.folder?.name ?? 'Work', workflow: draft.kind, description: draft.description.trim(),
          model: selection.presetName, provider: selection.provider, providerModel: selection.model, apiConnectionId: selection.apiConnectionId, permissions: selection.permissions, reasoningEffort: selection.reasoningEffort,
          workOptions: { kind: draft.kind, advance: draft.advance, review: draft.review, reviewers: draft.reviewers, inputIds: draft.inputs.map(input => input.id), folderGrantId: draft.folder?.id,
            ...(draft.kind === 'deep-brainstorm' ? { deep: { workers: draft.workers } } : {}) },
        })) }
        saveWorkStartIntent(batch); intentRef.current = batch; setIntent(batch)
      }
      const result = await submitWorkCopies(batch, window.ziafAPI, next => { saveWorkStartIntent(next); intentRef.current = next; if (mounted.current) setIntent(next) })
      const completed = !result.batch.requests.length
      const allAccepted = completed && !result.batch.rejected?.length
      if (completed) { clearWorkStartIntent(result.batch.id); intentRef.current = null }
      if (allAccepted && !result.batch.accepted.some(item => item.startupError) && revision.current === atRevision) {
        // Commit draft cleanup before navigation unmounts this form. A newer
        // draft has a different edit revision and must remain available.
        const cleared = { ...draft, description: '', inputs: [] }
        try { localStorage.setItem(draftKey, JSON.stringify(cleared)) } catch { /* Accepted tasks remain in the backend; draft cleanup is not another creation. */ }
        if (mounted.current) setDraft(cleared)
      }
      await acceptWorkTasks(result.batch.accepted, allAccepted && mounted.current ? result.batch.accepted[0]?.id : undefined)
      if (!mounted.current) return
      setAccepted(result.batch.accepted); setIntent(completed ? null : result.batch)
      if (result.batch.rejected?.length && completed) change({ copies: result.batch.rejected.map(selections) })
      setError([...result.errors, ...result.batch.accepted.flatMap(item => item.startupError ? [item.startupError] : [])].join('\n'))
    } catch (failure) { if (mounted.current) setError(String(failure)) }
    finally { busyRef.current = false; if (mounted.current) setBusy(false) }
  }
  const source = (input: WorkInputRef) => {
    const field = descriptionRef.current
    const begin = field?.selectionStart ?? draft.description.length
    const end = field?.selectionEnd ?? begin
    const mention = `[${input.name.replaceAll('[', '').replaceAll(']', '')}](work-input:${input.id})`
    change({ description: draft.description.slice(0, begin) + mention + draft.description.slice(end) }); setSourceMenu(false)
    field?.focus({ preventScroll: true })
  }
  return <section className="space-y-4 text-left" data-testid="new-work-form">
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-[#15171a] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" className={button} disabled={locked} onClick={() => change({ folder: null })} data-testid="new-work-default-folder">{uiText("Default")}</button>
        <button type="button" className={button} disabled={locked} onClick={() => void picker('folder')} data-testid="new-work-pick-folder">{label('Pick a folder', 'Выбрать папку')}</button>
        <span className="min-w-0 break-all text-zinc-400" data-testid="new-work-folder">{draft.folder?.path ?? label('A separate folder will be created for each task.', 'Для каждой задачи будет создана отдельная папка.')}</span>
      </div>
      <textarea ref={descriptionRef} className={`${control} min-h-36 text-sm`} aria-label={label('Work request', 'Задание Work')} placeholder={label('Describe the result you need. Attach sources or use @.', 'Опишите нужный результат. Приложите источники или используйте @.')} value={draft.description} maxLength={18000}
        onChange={event => { change({ description: event.target.value }); if (event.target.value.endsWith('@')) setSourceMenu(true) }} data-testid="new-work-description" />
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={locked} onClick={() => void picker('inputs')} data-testid="new-work-attach">{label('Attach sources', 'Приложить источники')}</button>
        <button type="button" className={button} disabled={locked || !draft.inputs.length} onClick={() => setSourceMenu(value => !value)} data-testid="new-work-mention">@ {label('Source', 'Источник')}</button></div>
      {sourceMenu && <div className="rounded border border-zinc-700 p-2" data-testid="new-work-source-menu">{draft.inputs.length ? draft.inputs.map(input => <button type="button" className={`${button} mr-2`} key={input.id} disabled={locked} onClick={() => source(input)}>{input.name}</button>) : <p className="text-xs text-zinc-500">{label('Attach a source first.', 'Сначала приложите источник.')}</p>}</div>}
      {!!draft.inputs.length && <ul className="space-y-1 text-xs">{draft.inputs.map(input => <li key={input.id} className="flex items-center justify-between gap-2"><span className="break-all">{input.name}</span><button type="button" className={button} disabled={locked} onClick={() => change({ inputs: draft.inputs.filter(item => item.id !== input.id) })} aria-label={`${label('Remove source', 'Удалить источник')} ${input.name}`}>×</button></li>)}</ul>}
      <label className="block text-xs text-zinc-400">{label('Independent task copies', 'Независимые копии задачи')}<select className={`${control} mt-1 max-w-24`} value={draft.copies.length} disabled={locked} data-testid="new-work-copies" onChange={event => { const count = Number(event.target.value); change({ copies: Array.from({ length: count }, (_, index) => draft.copies[index] ?? { ...draft.copies[0] }) }) }}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>×{count}</option>)}</select></label>
      {draft.copies.map((selection, index) => <div key={index} className="space-y-2 rounded border border-zinc-800 p-3 text-xs"><p className="text-zinc-400">{label('Task', 'Задача')} {index + 1}</p><AgentSelectionFields value={selection} onChange={next => change({ copies: draft.copies.map((item, i) => i === index ? next : item) })} presets={presets} disabled={locked} prefix={`new-work-agent-${index}`} /></div>)}
      <details className="rounded border border-zinc-800 p-3" data-testid="new-work-options"><summary className="cursor-pointer text-xs">{label('Workflow settings and roles', 'Настройки процесса и роли')}</summary><fieldset disabled={locked} className="mt-3 space-y-3 text-xs">
        <label className="flex gap-2"><input type="checkbox" checked={draft.advance === 'auto'} onChange={event => change({ advance: event.target.checked ? 'auto' : 'manual' })} data-testid="new-work-auto" />{label('Continue automatically between stages', 'Продолжать автоматически между этапами')}</label>
        <label className="flex gap-2"><input type="checkbox" checked={draft.review} onChange={event => change({ review: event.target.checked })} data-testid="new-work-review" />{label('Independent review of the result', 'Независимое ревью результата')}</label>
        {draft.review && draft.reviewers.map((role, index) => <div key={role.id} className="space-y-2"><WorkflowAgentSelector value={role} onChange={next => change({ reviewers: draft.reviewers.map(item => item.id === role.id ? { ...next, id: role.id } : item) })} presets={presets} task={task} label={`${label('Reviewer', 'Ревьюер')} ${index + 1}`} prefix={`new-work-reviewer-${index}`} readOnly disabled={locked} /><button type="button" className={button} disabled={locked || draft.reviewers.length <= 1} onClick={() => change({ reviewers: draft.reviewers.filter(item => item.id !== role.id) })}>{label('Remove reviewer', 'Удалить ревьюера')}</button></div>)}
        {draft.review && <button type="button" className={button} disabled={locked || draft.reviewers.length >= 8} onClick={() => change({ reviewers: [...draft.reviewers, { id: crypto.randomUUID(), presetName: '@task' }] })}>{label('Add reviewer', 'Добавить ревьюера')}</button>}
        <p className="text-zinc-500">{label('Questions and report decisions still need your answer. Task selection means the executor of each copy.', 'Вопросы и решения по отчёту по-прежнему требуют вашего ответа. Агент задачи означает исполнителя каждой копии.')}</p>
      </fieldset></details>
      {draft.kind === 'deep-brainstorm' && <section className="space-y-3 rounded border border-zinc-700 p-3" data-testid="new-work-workers"><h3 className="text-sm">{label('Ordered independent workers', 'Упорядоченные независимые участники')}</h3><p className="text-xs text-zinc-500">{label('Choose actual models. These workers belong to each task, not to the × task copies.', 'Выберите реальные модели. Эти участники работают внутри каждой задачи, отдельно от × копий задач.')}</p>
        {draft.workers.map((role, index) => <div className="space-y-2 border-t border-zinc-800 pt-2" key={role.id}><WorkflowAgentSelector value={role} onChange={next => change({ workers: draft.workers.map(item => item.id === role.id ? { ...next, id: role.id } : item) })} presets={presets} task={task} label={`${label('Worker', 'Участник')} ${index + 1}`} prefix={`new-work-worker-${index}`} readOnly disabled={locked} /><div className="flex gap-2">{[-1, 1].map(delta => <button type="button" key={delta} className={button} disabled={locked || index + delta < 0 || index + delta >= draft.workers.length} onClick={() => { const workers = [...draft.workers]; [workers[index], workers[index + delta]] = [workers[index + delta], workers[index]]; change({ workers }) }}>{delta < 0 ? '↑' : '↓'}</button>)}<button type="button" className={button} disabled={locked || draft.workers.length <= 1} onClick={() => change({ workers: draft.workers.filter(item => item.id !== role.id) })}>{label('Remove', 'Удалить')}</button></div></div>)}
        <button type="button" className={button} disabled={locked || draft.workers.length >= 8} onClick={() => change({ workers: [...draft.workers, { id: crypto.randomUUID(), presetName: '@task' }] })}>{label('Add worker', 'Добавить участника')}</button>
      </section>}
      {intent && <p role="status" className="text-xs text-amber-200" data-testid="new-work-pending">{label('Retry keeps the saved configurations and request IDs. Your edited description is preserved separately.', 'Повтор сохраняет прежние настройки и IDs запросов. Изменённое описание сохранено отдельно.')}</p>}
      {error && <p role="alert" className="whitespace-pre-wrap break-words text-xs text-rose-300">{error}</p>}
      {!!accepted.length && <div className="flex flex-wrap gap-2">{accepted.map(item => <button type="button" key={item.id} className={button} onClick={() => selectTask(item.id)}>{label('Open accepted task', 'Открыть созданную задачу')}: {item.name}</button>)}</div>}
      <div className="flex justify-end gap-2">{intent ? <button type="button" className={button} disabled={busy || !!restored.error} onClick={() => void create(intent.requests[0]?.startWorkflow ?? false)} data-testid="new-work-retry">{label('Retry saved request', 'Повторить сохранённый запрос')}</button> : <><button type="button" className={button} disabled={locked || !draft.description.trim()} onClick={() => void create(false)} data-testid="new-work-save-draft">{label('Save draft', 'Сохранить черновик')}</button><button type="button" className={`${button} border-orange-600 bg-orange-600 text-white`} disabled={locked || !draft.description.trim()} onClick={() => void create(true)} data-testid="new-task-start">{label('Start', 'Начать')}</button></>}</div>
    </div>
    <div className="space-y-3 text-start" dir={direction}>
      <h2 id="new-work-workflow-heading" className="flex items-center gap-2 ps-1 text-xs font-semibold text-zinc-400">
        <Workflow aria-hidden="true" className="h-4 w-4 shrink-0 text-[#ff6b00]" />{t('pick_workflow')}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-labelledby="new-work-workflow-heading">
        {workModes.map(mode => {
          const Icon = mode.icon
          const isSelected = draft.kind === mode.kind
          return <button
            type="button"
            key={mode.kind}
            disabled={locked}
            aria-pressed={isSelected}
            onClick={() => change({ kind: mode.kind })}
            data-testid={`new-workflow-${mode.kind}`}
            className={`relative flex min-w-0 flex-col items-center justify-start gap-2 rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1012] disabled:cursor-not-allowed disabled:opacity-40 ${
              isSelected
                ? 'border-[#ff6b00]/65 bg-[#ff6b00]/[0.06] text-white'
                : 'border-[#1e2024] bg-[#15171a] text-zinc-400 enabled:hover:border-zinc-700 enabled:hover:bg-[#1a1c21] enabled:hover:text-zinc-200'
            }`}
          >
            {isSelected && <Check aria-hidden="true" className="absolute end-2 top-2 h-3 w-3 text-[#ff6b00]" />}
            <span aria-hidden="true" className={`rounded-lg p-2 ${mode.color}`}><Icon className="h-4 w-4" /></span>
            <span className="block min-h-8 w-full break-words text-xs font-bold leading-4 [overflow-wrap:anywhere]">{uiText(mode.title)}</span>
          </button>
        })}
      </div>
    </div>
  </section>
}
