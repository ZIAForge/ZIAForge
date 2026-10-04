import { statusLabel } from './localizedLabels'
import { uiText, uiKey } from '../../uiText'
import type { ReviewTeamPreset } from '../../../shared/review-team'
import { ReviewTeamEditor } from './ReviewTeamEditor'
import { newReviewTeam } from './reviewTeamDraft'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Play, Plus, Save, Square, Trash2, X } from 'lucide-react'
import type { VerificationCommand, WorkflowAttempt, WorkflowGitPolicy, WorkflowPlan, WorkflowSnapshot, WorkflowSourceResult, WorkflowStep } from '../../../shared/workflow'
import type { GitStatus } from '../../../shared/git'
import { useStore, type Task } from '../../store'
import { WorkflowAgentSelector } from './WorkflowAgentSelector'
import { CodeFlowPanel } from './CodeFlowPanel'
import { CODE_DIALOGUE_TAB, multiStageTitle } from './useWorkflowChats'
import type { CodeFlowDefinition } from '../../../shared/code-flow'
import { MultiRoleSettings } from './MultiRoleSettings'

const commandText = (command?: VerificationCommand) => !command ? '' : command.executable === '/bin/sh' && command.args[0] === '-lc' ? command.args[1] : [command.executable, ...command.args].join(' ')
const shellCheck = (text: string): VerificationCommand[] => text.trim() ? [{ executable: '/bin/sh', args: ['-lc', text], timeoutMs: 60000 }] : []
const control = 'w-full rounded border border-zinc-700 bg-[#111317] px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-50'
const button = 'rounded border border-zinc-700 px-2 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed'

export function ExecutablePlanPanel({ task, onClose, onOpenChat }: { task: Task; onClose: () => void; onOpenChat: (id: string, title: string) => void }) {
  const { presets, settings } = useStore()
  const ru = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const initial = (): WorkflowPlan => ({ title: task.name, coderPreset: task.model === '' ? '@task' : task.model || settings?.defaultCodingPreset || presets[0]?.name || '@task',
    reviewerPreset: presets.find(item => item.name === settings?.defaultReviewPreset)?.name ?? presets[0]?.name ?? '@task',
    review: true, advance: 'manual', maxFailures: 3, maxIterations: 50, steps: [] })
  const [plan, setPlan] = useState<WorkflowPlan>(initial)
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | null>(null)
  const [revision, setRevision] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [respondingGate, setRespondingGate] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string>()
  const [newTitle, setNewTitle] = useState('')
  const [rolesOpen, setRolesOpen] = useState(false)
  const [reviewTeams, setReviewTeams] = useState<ReviewTeamPreset[]>([])
  const [gitChoices, setGitChoices] = useState<Pick<GitStatus, 'branches' | 'remotes'> | null>(null)
  const generation = useRef(0)
  const sequence = useRef(-1)
  const loaded = useRef(false)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const currentTask = useRef(task.id)
  const draftKey = `ziaforge-code-plan-draft:${task.id}`
  const defaults = useRef(plan)
  defaults.current = initial()
  currentTask.current = task.id
  useEffect(() => {
    const attempt = ++generation.current
    const taskId = task.id
    sequence.current = -1; loaded.current = false
    setLoading(true); setError(''); setSnapshot(null); setRevision(0); setDirty(false); setPending(false); setRespondingGate(null); setPlan(defaults.current); setRolesOpen(false); setGitChoices(null)
    const accept = (next: WorkflowSnapshot) => {
      if (generation.current !== attempt || next.taskId !== taskId || next.sequence < sequence.current) return
      sequence.current = next.sequence; setSnapshot(next)
      if (!loaded.current && next.plan.codeFlow && task.mode !== 'work') {
        try {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const draft = JSON.parse(raw) as { taskId: string; revision: number; plan: WorkflowPlan }
            if (draft.taskId !== taskId || !Number.isSafeInteger(draft.revision) || !draft.plan?.codeFlow || !Array.isArray(draft.plan.steps)) throw new Error(uiText("The saved plan draft is invalid; its bytes have been preserved."))
            setPlan(draft.plan); setRevision(draft.revision); setDirty(true); dirtyRef.current = true; loaded.current = true
            return
          }
        } catch (failure) { setError(String(failure instanceof Error ? failure.message : failure)) }
      }
      if (!loaded.current || !dirtyRef.current) { setPlan(next.plan); setRevision(next.revision); loaded.current = true }
    }
    const off = window.ziafAPI.workflows.onEvent(accept)
    void window.ziafAPI.workflows.get({ taskId }).then(next => { if (next) accept(next) })
      .catch(caught => { if (generation.current === attempt) setError(String(caught.message ?? caught)) })
      .finally(() => { if (generation.current === attempt) setLoading(false) })
    return () => { generation.current = attempt + 1; off() }
  }, [task.id, task.mode, draftKey])
  useEffect(() => {
    if (!rolesOpen || task.mode === 'work') return
    let current = true
    void Promise.resolve().then(() => window.ziafAPI.git.status({ taskId: task.id })).then(status => { if (current) setGitChoices(status) }).catch(() => { if (current) setGitChoices(null) })
    return () => { current = false }
  }, [rolesOpen, task.id, task.mode])
  useEffect(() => {
    if (!rolesOpen) return
    let current = true
    void Promise.resolve().then(() => window.ziafAPI.reviewTeams.list()).then(items => { if (current) setReviewTeams(items) }).catch(failure => { if (current) setError(String(failure.message ?? failure)) })
    return () => { current = false }
  }, [rolesOpen])
  const running = snapshot?.status === 'running'
  const gatePending = !!snapshot?.codeFlow?.pending
  const reviewGatePending = snapshot?.codeFlow?.pending?.kind === 'review'
  const responding = !!respondingGate
  const locked = loading || pending || running || responding
  const rolesLocked = locked || reviewGatePending || snapshot?.steps.some(step => step.status === 'completed' && (!snapshot.plan.codeFlow || snapshot.plan.steps.find(item => item.id === step.id)?.codePhase === 'implementation'))
  const conflict = dirty && snapshot !== null && snapshot.revision !== revision
  const missingChecks = !plan.review && plan.steps.some(step => (!plan.codeFlow || step.codePhase === 'implementation') && !step.verification.length)
  const reviewerNames = plan.reviewTeam?.reviewers.map(source => source.presetName) ?? plan.reviewers?.map(source => source.presetName) ?? [plan.reviewerPreset]
  const needsReview = !snapshot || dirty || snapshot.steps.some(step => step.status !== 'completed')
  const missingReviewer = plan.review && needsReview && (!reviewerNames.length || reviewerNames.some(name => !name) || !!plan.reviewTeam && !plan.reviewTeam.architect.presetName)
  const startProblem = !plan.steps.length ? '' : missingChecks
    ? label('Add a verification command to each step, or enable independent review below. Auto continues only after a verified step.', 'Добавьте команду проверки для каждого шага или включите независимое ревью ниже. Авто продолжает работу только после проверенного шага.')
    : missingReviewer ? label('Select a reviewer preset below before running the plan.', 'Перед запуском плана выберите ниже пресет ревьюера.') : ''
  const edit = (next: WorkflowPlan) => {
    setPlan(next); setDirty(true); dirtyRef.current = true; setError('')
    if (next.codeFlow && task.mode !== 'work') {
      try { localStorage.setItem(draftKey, JSON.stringify({ taskId: task.id, revision, plan: next })) }
      catch { setError(label('The plan draft is in memory only. Save before closing this panel.', 'Черновик плана сохранён только в памяти. Нажмите «Сохранить» перед закрытием панели.')) }
    }
  }
  const discardDraft = () => {
    if (!snapshot) return
    if (snapshot.plan.codeFlow && task.mode !== 'work') { try { localStorage.removeItem(draftKey) } catch { setError(label('Could not remove the saved draft.', 'Не удалось удалить сохранённый черновик.')); return } }
    setPlan(snapshot.plan); setRevision(snapshot.revision); setDirty(false); dirtyRef.current = false
  }
  const editStep = (id: string, update: Partial<WorkflowStep>) => edit({ ...plan, steps: plan.steps.map(step => step.id === id ? { ...step, ...update } : step) })
  const editMulti = (update: Partial<NonNullable<CodeFlowDefinition['multi']>>) => {
    if (plan.codeFlow?.kind === 'multi-model') edit({ ...plan, codeFlow: { ...plan.codeFlow, multi: { ...plan.codeFlow.multi, version: 1, ...update } } })
  }
  const gitPolicy: WorkflowGitPolicy = plan.git ?? { commit: 'manual', merge: 'manual', push: 'manual' }
  const editGit = (update: Partial<WorkflowGitPolicy>) => edit({ ...plan, git: { ...gitPolicy, ...update } })
  const addReviewer = () => {
    const sources = plan.reviewers ?? (plan.reviewerPreset ? [{ id: `reviewer-${crypto.randomUUID()}`, presetName: plan.reviewerPreset, configuration: plan.reviewerConfiguration, reasoningEffort: plan.reviewerReasoningEffort }] : [])
    const next = presets.find(preset => !sources.some(source => source.presetName === preset.name)) ?? presets[0]
    edit({ ...plan, reviewers: [...sources, { id: `reviewer-${crypto.randomUUID()}`, presetName: next?.name ?? '@task' }], reviewPolicy: 'all', review: true })
  }
  const run = async (action: 'save' | 'start' | 'pause') => {
    if (pending || responding || action === 'save' && reviewGatePending || action === 'start' && (gatePending || startProblem)) return
    const taskId = task.id
    const attempt = generation.current
    setPending(true); setError('')
    try {
      let next = snapshot
      if (action !== 'pause' && (dirty || !next)) {
        next = await window.ziafAPI.workflows.save({ taskId, expectedRevision: revision, plan })
        if (generation.current !== attempt || currentTask.current !== taskId) return
        if (next.plan.codeFlow && task.mode !== 'work') { try { localStorage.removeItem(draftKey) } catch { /* The accepted backend revision remains authoritative; a restored stale draft shows a conflict. */ } }
        if (next.sequence >= sequence.current) { sequence.current = next.sequence; setSnapshot(next); setPlan(next.plan); setRevision(next.revision); setDirty(false); dirtyRef.current = false; loaded.current = true }
      }
      if (action === 'start' && next) next = await window.ziafAPI.workflows.start({ taskId, revision: next.revision, commandId: crypto.randomUUID() })
      if (action === 'pause') next = await window.ziafAPI.workflows.pause({ taskId })
      if (generation.current !== attempt || currentTask.current !== taskId || !next) return
      if (next.sequence >= sequence.current) { sequence.current = next.sequence; setSnapshot(next); setPlan(next.plan); setRevision(next.revision); setDirty(false); dirtyRef.current = false; loaded.current = true }
    } catch (caught) { if (generation.current === attempt) setError(caught instanceof Error ? caught.message : String(caught)) }
    finally { if (generation.current === attempt) setPending(false) }
  }
  const statusText = (value: string) => statusLabel(value, ru)
  const phaseLabels: Record<string, string> = { "discovery": uiText("Task assessment", undefined, (ru) ? 'ru' : undefined), "investigation": uiText("Bug investigation", undefined, (ru) ? 'ru' : undefined), "requirements": uiText("Requirements", undefined, (ru) ? 'ru' : undefined), "specification": uiText("Specification", undefined, (ru) ? 'ru' : undefined), "planning": uiText("Plan preparation", undefined, (ru) ? 'ru' : undefined), "implementation": uiText("Implementation", undefined, (ru) ? 'ru' : undefined), "delivery": uiText("Delivery report", undefined, (ru) ? 'ru' : undefined) }
  const acceptCodeSnapshot = (next: WorkflowSnapshot) => {
    if (next.taskId !== currentTask.current || next.sequence < sequence.current) return
    sequence.current = next.sequence; setSnapshot(next); loaded.current = true
    if (!dirtyRef.current) { setPlan(next.plan); setRevision(next.revision) }
  }
  const sourceLabel = (source: Pick<WorkflowSourceResult, 'presetName' | 'configuration'>) => source.presetName === '@custom' ? `${uiKey('composer_custom')} · ${source.configuration?.model || ''}` : source.presetName === '@task' ? label('Task agent', 'Агент задачи') : source.presetName
  const sourceRows = (sources: WorkflowSourceResult[], role: string) => sources.map(source => <details key={source.sourceId} className="rounded border border-zinc-800 p-2 text-xs" data-testid={`workflow-source-${source.sourceId}`}>
    <summary className="cursor-pointer break-words">{role}: {sourceLabel(source)} · {statusText(source.review?.outcome || source.status)}</summary>
    {source.session && <button className={`${button} mt-2`} onClick={() => onOpenChat(source.session!.chatId, `${role}: ${sourceLabel(source)}`)}>{label('Open source chat', 'Открыть чат источника')}</button>}
    {source.error && <p className="mt-2 text-red-300">{source.error}</p>}
    {source.output && <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words text-zinc-400">{source.output}</pre>}
    {source.review && <><p className="mt-2 text-zinc-300">{source.review.summary}</p>{source.review.findings.map((finding, index) => <p key={index} className="mt-2 break-words text-amber-200">{finding.severity} · {finding.location}: {finding.evidence}<br />{finding.action}</p>)}</>}
  </details>)
  const multiStageRows = (attempt: WorkflowAttempt) => attempt.multiStages?.map(stage => <details key={stage.id} className="rounded border border-zinc-800 p-2 text-xs" data-testid={`workflow-multi-stage-${stage.id}`}>
    <summary className="cursor-pointer break-words">{multiStageTitle(stage, ru)} · {statusText(stage.status)}</summary>
    {stage.source && <p className="mt-2 break-words text-zinc-400">{sourceLabel(stage.source)}</p>}
    {stage.session && <button className={`${button} mt-2`} onClick={() => onOpenChat(stage.session!.chatId, multiStageTitle(stage, ru))}>{label('Open stage chat', 'Открыть чат этапа')}</button>}
    {stage.error && <p className="mt-2 text-red-300">{stage.error}</p>}
    {stage.output && <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words text-zinc-400">{stage.output}</pre>}
    {!!stage.artifactIds?.length && <p className="mt-2 break-words text-zinc-400">{label('Documents', 'Документы')}: {stage.artifactIds.map(id => { const receipt = snapshot?.codeFlow?.artifacts.find(item => item.id === id); return receipt ? `${receipt.name} · v${receipt.version}` : id }).join(', ')}</p>}
  </details>)
  return <section className="flex h-full min-h-0 flex-col bg-[#0f1012] text-zinc-200" data-testid="executable-plan">
    <header className="shrink-0 space-y-3 border-b border-zinc-800 p-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{label('Plan', 'План')} <span className="ml-2 text-xs text-zinc-500">{snapshot?.steps.filter(step => step.status === 'completed').length ?? 0}/{plan.steps.length}</span></h3><button onClick={onClose} aria-label={label('Close plan', 'Закрыть план')}><X size={16} /></button></div>
      <div className="flex items-center justify-between text-xs"><span data-testid="workflow-status">{statusText(snapshot?.status ?? 'draft')}</span><span className="text-zinc-500">{label('Revision', 'Версия')} {revision}{dirty ? ' •' : ''}</span></div>
      <div className="flex gap-2">
        <button className={button} disabled={locked || reviewGatePending || (!dirty && !!snapshot)} onClick={() => void run('save')} data-testid="workflow-save"><Save className="mr-1 inline" size={12} />{label('Save', 'Сохранить')}</button>
        <button className={`${button} border-orange-600 bg-orange-600/20`} disabled={locked || gatePending || conflict || !!startProblem || !plan.steps.length || snapshot?.status === 'completed' && !dirty} aria-describedby={startProblem ? 'workflow-start-requirements' : undefined} onClick={() => void run('start')} data-testid="workflow-start"><Play className="mr-1 inline" size={12} />{label('Run / continue', 'Запустить / продолжить')}</button>
        {running && <button className={button} disabled={pending} onClick={() => void run('pause')} data-testid="workflow-pause"><Square size={12} className="mr-1 inline" />{label('Pause', 'Пауза')}</button>}
      </div>
      {snapshot?.reason && <p className="break-words text-xs text-amber-300" data-testid="workflow-reason">{snapshot.reason}</p>}
      {task.startupError && (!snapshot || snapshot.status === 'draft') && <p role="alert" className="break-words text-xs text-red-300" data-testid="code-startup-error">{label('The task was saved, but preparation could not start. Your draft is preserved. Use Run / continue to retry this task:', 'Задача сохранена, но подготовку не удалось запустить. Черновик сохранён. Нажмите «Запустить / продолжить», чтобы повторить запуск этой задачи:')} {task.startupError}</p>}
      {error && <p role="alert" className="break-words text-xs text-red-300">{error}</p>}
      {!loading && !running && startProblem && <p id="workflow-start-requirements" role="status" className="break-words text-xs text-amber-300" data-testid="workflow-start-requirements">{startProblem}</p>}
      {conflict && <div className="space-y-2 text-xs text-amber-300"><p>{label('The saved plan changed. Your draft is preserved; reload before running.', 'Сохранённый план изменился. Ваш черновик сохранён; перечитайте план перед запуском.')}</p><button className={button} disabled={locked} onClick={discardDraft} data-testid="workflow-reload-plan">{label('Load saved plan', 'Загрузить сохранённый план')}</button></div>}
    </header>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      {snapshot?.plan.codeFlow?.interaction?.version === 1 && <div className="space-y-2 rounded border border-orange-500/20 p-3 text-xs" data-testid="workflow-discussion-link"><p>{label('Discuss requirements, edit documents and accept decisions in the Forge conversation. This panel keeps the To-do list, execution evidence and role settings.', 'Обсуждение требований, редактор документов и согласование решений находятся в чате Forge. Здесь остаются To-do, результаты исполнения и настройки ролей.')}</p><button type="button" className={button} onClick={() => onOpenChat(CODE_DIALOGUE_TAB, label('Forge · Discussion', 'Forge · Обсуждение'))}>{label('Open Forge discussion', 'Открыть обсуждение Forge')}</button></div>}
      {snapshot?.codeFlow && snapshot.plan.codeFlow?.interaction?.version !== 1 && <CodeFlowPanel key={`${task.id}:${snapshot.runId}`} snapshot={snapshot} ru={ru} workspace={task.worktreePath} disabled={loading || pending || running || dirty} onSnapshot={acceptCodeSnapshot}
        onBusy={(gateId, busy) => { if (currentTask.current === task.id) setRespondingGate(previous => busy ? gateId : previous === gateId ? null : previous) }} />}
      {reviewGatePending && <p className="text-xs text-zinc-400">{label('Resolve the retained review before editing its verified plan or agent settings.', 'Завершите решение по сохранённому ревью, прежде чем менять проверенный план или настройки агентов.')}</p>}
      {gatePending && dirty && <p className="text-xs text-amber-300">{reviewGatePending ? label('Discard local edits to answer the review of the saved plan.', 'Отмените локальные изменения, чтобы ответить на ревью сохранённого плана.') : label('Save your role/settings changes before answering this decision.', 'Сохраните изменения ролей и настроек перед ответом.')} <button className={button} disabled={locked} onClick={discardDraft}>{label('Discard local plan edits', 'Отменить локальные изменения плана')}</button></p>}
      <fieldset className="space-y-2" disabled={locked || reviewGatePending}>
        <WorkflowAgentSelector label={label('Implementation preset', 'Пресет исполнителя')} task={task} presets={presets} prefix="workflow-coder" disabled={rolesLocked}
          value={{ presetName: plan.coderPreset, configuration: plan.coderConfiguration, reasoningEffort: plan.coderReasoningEffort, permissions: plan.coderPermissions, specialization: plan.coderSpecialization }}
          onChange={next => edit({ ...plan, coderPreset: next.presetName, coderConfiguration: next.configuration, coderReasoningEffort: next.reasoningEffort, coderPermissions: next.permissions, coderSpecialization: next.specialization })} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={plan.advance === 'auto'} onChange={event => edit({ ...plan, advance: event.target.checked ? 'auto' : 'manual' })} data-testid="workflow-auto" />{label('Automatically continue after a successful step', 'Автоматически продолжать после успешного шага')}</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={rolesLocked} checked={plan.review} onChange={event => edit({ ...plan, review: event.target.checked })} data-testid="workflow-review" />{plan.codeFlow ? label('Independent implementation review', 'Независимое ревью реализации') : label('Independent review for each step', 'Независимое ревью каждого шага')}</label>
        {plan.review && !plan.reviewTeam && !plan.reviewers && <WorkflowAgentSelector label={label('Reviewer', 'Ревьюер')} task={task} presets={presets} prefix="workflow-reviewer" readOnly disabled={rolesLocked}
          value={{ presetName: plan.reviewerPreset ?? '', configuration: plan.reviewerConfiguration, reasoningEffort: plan.reviewerReasoningEffort, specialization: plan.reviewerSpecialization }}
          onChange={next => edit({ ...plan, reviewerPreset: next.presetName, reviewerConfiguration: next.configuration, reviewerReasoningEffort: next.reasoningEffort, reviewerSpecialization: next.specialization })} />}
        <p className="text-[10px] text-zinc-500">{label('Limits:', 'Ограничения:')} {plan.maxFailures} {label('failed attempts per step,', 'неудачных попытки на шаг,')} {plan.maxIterations} {label('total attempts.', 'попыток всего.')}</p>
      </fieldset>
      <details open={rolesOpen} onToggle={event => setRolesOpen(event.currentTarget.open)} data-testid="workflow-roles-git" className="rounded border border-zinc-800 p-2">
        <summary className="cursor-pointer text-xs text-zinc-400">{label('Roles / Git', 'Роли / Git')}</summary>
        <fieldset disabled={rolesLocked} className="mt-3 space-y-3">
          {plan.codeFlow?.kind === 'multi-model' && <>
            <WorkflowAgentSelector label={label('Planner', 'Планировщик')} task={task} presets={presets} prefix="workflow-planner" readOnly disabled={rolesLocked}
              value={plan.codeFlow.planner ?? { presetName: '@task' }} onChange={next => edit({ ...plan, codeFlow: { ...plan.codeFlow!, planner: { ...next, id: plan.codeFlow?.planner?.id ?? 'planner' } } })} />
            <WorkflowAgentSelector label={label('Fixer', 'Исправления после ревью')} task={task} presets={presets} prefix="workflow-fixer" disabled={rolesLocked}
              value={plan.codeFlow.fixer ?? { presetName: '@task' }} onChange={next => edit({ ...plan, codeFlow: { ...plan.codeFlow!, fixer: { ...next, id: plan.codeFlow?.fixer?.id ?? 'fixer' } } })} />
            <MultiRoleSettings plan={plan} task={task} presets={presets} ru={ru} disabled={!!rolesLocked} onChange={editMulti} />
          </>}
          <label className="block text-xs text-zinc-400">{label('Review team', 'Команда ревью')}<select className={control} data-testid="workflow-review-team" disabled={rolesLocked} value={plan.reviewTeam?.id ?? ''} onChange={event => {
            if (!event.target.value) { edit({ ...plan, reviewTeam: undefined }); return }
            const team = event.target.value === '@new' ? newReviewTeam() : reviewTeams.find(item => item.id === event.target.value)
            if (team) edit({ ...plan, review: true, reviewTeam: structuredClone(team) })
          }}><option value="">{label('Individual reviewers', 'Отдельные ревьюеры')}</option><option value="@new">{label('Custom team', 'Своя команда')}</option>{plan.reviewTeam && !reviewTeams.some(item => item.id === plan.reviewTeam!.id) && <option value={plan.reviewTeam.id}>{plan.reviewTeam.name}</option>}{reviewTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          {plan.reviewTeam && <ReviewTeamEditor value={plan.reviewTeam} onChange={reviewTeam => edit({ ...plan, reviewTeam })} task={task} presets={presets} ru={ru} disabled={!!rolesLocked} />}
          {!plan.reviewTeam && <>
          <p className="text-[10px] text-zinc-400">{label('Every reviewer must approve. Blocking findings and disagreements remain attached to each source; no majority vote advances the step.', 'Нужно одобрение каждого ревьюера. Блокирующие замечания и разногласия сохраняются с источником; голосование не завершает шаг.')}</p>
          {plan.reviewers?.map((source, index) => <div key={source.id} className="space-y-2 rounded border border-zinc-800 p-2">
            <WorkflowAgentSelector label={uiText("Reviewer {value1}", { value1: index + 1 }, ru ? 'ru' : undefined)} task={task} presets={presets} prefix={`workflow-review-source-${index}`} value={source} readOnly disabled={rolesLocked}
              onChange={next => edit({ ...plan, reviewers: plan.reviewers!.map(item => item.id === source.id ? { ...item, presetName: next.presetName, configuration: next.configuration, reasoningEffort: next.reasoningEffort, specialization: next.specialization } : item) })} />
            <button className={button} aria-label={label('Remove reviewer', 'Удалить ревьюера')} onClick={() => { const remaining = plan.reviewers!.filter(item => item.id !== source.id); edit({ ...plan, reviewers: remaining.length ? remaining : undefined }) }}><X size={12} /></button>
          </div>)}
          <button type="button" className={button} onClick={addReviewer} disabled={(plan.reviewers?.length ?? (plan.reviewerPreset ? 1 : 0)) >= 8} data-testid="workflow-add-reviewer">{label('Add independent reviewer', 'Добавить независимого ревьюера')}</button>
          </>}
          <p className="text-xs text-zinc-400">{label('Research helpers before implementation', 'Помощники-исследователи перед реализацией')}</p>
          {plan.helpers?.map((source, index) => <div key={source.id} className="space-y-2 rounded border border-zinc-800 p-2">
            <WorkflowAgentSelector label={uiText("Helper {value1}", { value1: index + 1 }, ru ? 'ru' : undefined)} task={task} presets={presets} prefix={`workflow-helper-${index}`} value={source} readOnly disabled={rolesLocked}
              onChange={next => edit({ ...plan, helpers: plan.helpers!.map(item => item.id === source.id ? { ...item, presetName: next.presetName, configuration: next.configuration, reasoningEffort: next.reasoningEffort, specialization: next.specialization } : item) })} />
            <button className={button} aria-label={label('Remove helper', 'Удалить помощника')} onClick={() => { const helpers = plan.helpers!.filter(item => item.id !== source.id); edit({ ...plan, helpers: helpers.length ? helpers : undefined }) }}><X size={12} /></button>
            <textarea rows={2} className={control} aria-label={uiText("Helper instructions {value1}", { value1: index + 1 }, ru ? 'ru' : undefined)} value={source.instructions} onChange={event => edit({ ...plan, helpers: plan.helpers!.map(item => item.id === source.id ? { ...item, instructions: event.target.value } : item) })} />
          </div>)}
          <button type="button" className={button} disabled={(plan.helpers?.length ?? 0) >= 4} data-testid="workflow-add-helper" onClick={() => { const preset = presets.find(item => !plan.helpers?.some(source => source.presetName === item.name)) ?? presets[0]; edit({ ...plan, helpers: [...plan.helpers ?? [], { id: `helper-${crypto.randomUUID()}`, presetName: preset?.name ?? '@task', instructions: label('Inspect the relevant files and report concrete evidence. Do not modify files.', 'Изучите нужные файлы и дайте конкретные ссылки. Не изменяйте файлы.') }] }) }}>{label('Add helper', 'Добавить помощника')}</button>
        </fieldset>
        {task.mode === 'work' ? <p className="mt-3 text-[10px] text-zinc-500">{label('Work tasks use folders without Git publication.', 'Задачи Work работают с папками без публикации в Git.')}</p> : <fieldset disabled={locked} className="mt-4 space-y-2 border-t border-zinc-800 pt-3">
          <p className="text-xs text-zinc-400">{label('After the entire verified plan', 'После проверки всего плана')}</p>
          {(['commit', 'merge', 'push'] as const).map(action => <label key={action} className="flex items-center justify-between gap-2 text-xs"><span>{action}</span><select className={`${control} max-w-48`} value={gitPolicy[action]} onChange={event => editGit({ [action]: event.target.value as 'manual' | 'after-plan' })} data-testid={`workflow-git-${action}`}><option value="manual">{label('Manual', 'Вручную')}</option><option value="after-plan">{label('After verified plan', 'После проверенного плана')}</option></select></label>)}
          {gitPolicy.merge === 'after-plan' && <label className="block text-xs">{label('Existing local target branch', 'Существующая локальная ветка')}<input className={`${control} mt-1`} list="workflow-git-branches" value={gitPolicy.targetBranch || ''} onChange={event => editGit({ targetBranch: event.target.value })} data-testid="workflow-git-target" /><datalist id="workflow-git-branches">{gitChoices?.branches?.map(branch => <option key={branch.name} value={branch.name} />)}</datalist></label>}
          {gitPolicy.push === 'after-plan' && <label className="block text-xs">{label('Remote for the task branch', 'Remote для ветки задачи')}<input className={`${control} mt-1`} list="workflow-git-remotes" value={gitPolicy.remote || ''} onChange={event => editGit({ remote: event.target.value })} data-testid="workflow-git-remote" /><datalist id="workflow-git-remotes">{gitChoices?.remotes?.map(remote => <option key={remote} value={remote} />)}</datalist></label>}
          <p className="text-[10px] text-zinc-500">{label('Commit, merge and push are separate choices. Push publishes the task branch. Manual mode or Stop after the final step pauses before publication; Continue runs Git actions without repeating completed steps. Conflicts and failed publication remain blocked with receipts.', 'Commit, merge и push выбираются отдельно. Push публикует ветку задачи. Ручной режим или остановка после последнего шага создают паузу перед публикацией; «Продолжить» выполняет Git-действия без повтора готовых шагов. Конфликты и ошибки публикации сохраняются в квитанциях и блокируют завершение.')}</p>
        </fieldset>}
      </details>
      {snapshot?.finalization && <details className="rounded border border-zinc-700 p-2 text-xs" data-testid="workflow-finalization"><summary className="cursor-pointer">{label('Git finalization', 'Завершение Git')} · {statusText(snapshot.finalization.status)}</summary>{snapshot.finalization.error && <p className="mt-2 text-amber-200">{snapshot.finalization.error}</p>}{snapshot.finalization.receipt?.operations.map(receipt => <details key={receipt.operationId} className="mt-2 rounded border border-zinc-800 p-2"><summary className="cursor-pointer">{receipt.kind} · {statusText(receipt.status)} · {receipt.afterHead?.slice(0, 10)}</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px]">{JSON.stringify({ operationId: receipt.operationId, beforeHead: receipt.beforeHead, afterHead: receipt.afterHead, targetBranch: receipt.targetBranch, remote: receipt.remote, recoveryRef: receipt.recoveryRef, error: receipt.error, stdout: receipt.stdout, stderr: receipt.stderr }, null, 2)}</pre></details>)}</details>}
      {!plan.steps.length && <p className="py-3 text-xs leading-relaxed text-zinc-500">{label('Add steps with acceptance criteria. Select an actual verification command or independent review before running.', 'Добавьте шаги и критерии готовности. Для запуска нужна команда проверки или независимое ревью.')}</p>}
      {plan.steps.map((step, index) => {
        const state = snapshot?.steps.find(item => item.id === step.id)
        const attempt = state?.attempts[state.attempts.length - 1]
        const completed = state?.status === 'completed'
        const preparationStep = !!plan.codeFlow && step.codePhase !== 'implementation'
        const waitingForAnswer = snapshot?.codeFlow?.pending?.kind === 'questions' && snapshot.codeFlow.pending.attemptId === attempt?.id
        const attemptStage = preparationStep && attempt?.stage === 'implementation' ? phaseLabels[step.codePhase!] : statusText(attempt?.stage ?? '')
        const disabled = locked || completed || gatePending
        return <article key={step.id} className={`rounded-lg border ${state?.status === 'running' ? 'border-orange-500/50' : 'border-zinc-800'} bg-[#15171a]`} data-testid={`workflow-step-${index}`}>
          <button className="flex w-full items-center gap-2 p-3 text-left" onClick={() => setExpanded(expanded === step.id ? undefined : step.id)} aria-expanded={expanded === step.id}>
            {completed ? <Check className="shrink-0 text-emerald-400" size={14} /> : <span className="text-xs text-zinc-500">{index + 1}</span>}<span className="min-w-0 flex-1 break-words text-xs font-medium">{step.title}</span>{expanded === step.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <div className="flex flex-wrap items-center gap-2 px-3 pb-2 text-[10px] text-zinc-400"><span data-testid={`workflow-step-status-${index}`}>{statusText(state?.status ?? 'pending')}</span>{step.codePhase && <span data-testid={`workflow-phase-${index}`}>{phaseLabels[step.codePhase]}</span>}{attempt && <span>{label('Attempt', 'Попытка')} {attempt.number} · {attemptStage}</span>}</div>
          {attempt?.preparation && <p className="whitespace-pre-wrap break-words px-3 pb-2 text-xs text-zinc-300" data-testid={`workflow-preparation-${index}`}>{attempt.preparation.summary}</p>}
          {waitingForAnswer ? <p role="status" data-testid={`workflow-awaiting-answer-${index}`} className="break-words px-3 pb-2 text-xs text-amber-300">{label('Waiting for your answer in the discussion.', 'Ожидается ваш ответ в обсуждении.')}</p> : attempt?.error && <p className="break-words px-3 pb-2 text-xs text-red-300">{attempt.error}</p>}
          {attempt?.session && <div className="flex flex-wrap gap-2 px-3 pb-3"><button className={button} onClick={() => onOpenChat(attempt.session!.chatId, step.title)}>{label('Agent / approvals', 'Агент / разрешения')}</button>{attempt.reviewerSession && <button className={button} onClick={() => onOpenChat(attempt.reviewerSession!.chatId, `${label('Review', 'Ревью')}: ${step.title}`)}>{label('Review chat', 'Чат ревью')}</button>}</div>}
          {expanded === step.id && <div className="space-y-3 border-t border-zinc-800 p-3">
            <fieldset className="space-y-3" disabled={disabled}>
              <label className="block text-xs">{label('Title', 'Название')}<input className={`${control} mt-1`} value={step.title} onChange={event => editStep(step.id, { title: event.target.value })} /></label>
              <label className="block text-xs">{label('Instructions', 'Задание')}<textarea className={`${control} mt-1`} rows={3} value={step.instructions} onChange={event => editStep(step.id, { instructions: event.target.value })} /></label>
              <label className="block text-xs">{label('Acceptance criteria (one per line)', 'Критерии готовности (по одному на строку)')}<textarea className={`${control} mt-1`} rows={2} value={step.acceptance.join('\n')} onChange={event => editStep(step.id, { acceptance: event.target.value.split('\n') })} onBlur={() => editStep(step.id, { acceptance: step.acceptance.filter(item => item.trim()) })} /></label>
              {preparationStep ? <p className="text-xs text-zinc-400">{label('Preparation uses a fresh context and saved documents. Executable checks belong to implementation steps.', 'Подготовка использует новый контекст и сохранённые документы. Команды проверки добавляются к шагам реализации.')}</p> : <label className="block text-xs">{label('Verification command in the task workspace', 'Команда проверки в каталоге задачи')}<input className={`${control} mt-1 font-mono`} placeholder="npm test" value={commandText(step.verification[0])} onChange={event => editStep(step.id, { verification: shellCheck(event.target.value) })} data-testid={`workflow-check-${index}`} /></label>}
              <details><summary className="cursor-pointer text-xs text-zinc-400">{label('Step options', 'Параметры шага')}</summary><div className="mt-2 space-y-2">
                {!preparationStep && <label className="block text-xs">{label('Red check for TDD (optional)', 'Проверка Red для TDD (необязательно)')}<input className={`${control} mt-1 font-mono`} value={commandText(step.red)} onChange={event => editStep(step.id, { red: shellCheck(event.target.value)[0] })} /></label>}
                <WorkflowAgentSelector label={label('Step preset', 'Пресет шага')} task={task} presets={presets} prefix={`workflow-step-${index}`} disabled={disabled}
                  value={{ presetName: step.presetName ?? '', configuration: step.configuration, reasoningEffort: step.reasoningEffort, permissions: step.permissions, specialization: step.specialization }}
                  inherit={{ presetName: plan.coderPreset, configuration: plan.coderConfiguration, reasoningEffort: plan.coderReasoningEffort, permissions: plan.coderPermissions, specialization: plan.coderSpecialization }}
                  onChange={next => editStep(step.id, { ...next, presetName: next.presetName || undefined })} />
                <label className="flex gap-2 text-xs"><input type="checkbox" disabled={preparationStep} checked={step.newContext} onChange={event => editStep(step.id, { newContext: event.target.checked })} />{label('New context for this step', 'Новый контекст для шага')}</label>
                <label className="flex gap-2 text-xs"><input type="checkbox" checked={step.stopAfter} onChange={event => editStep(step.id, { stopAfter: event.target.checked })} />{label('Stop after this step', 'Остановиться после шага')}</label>
              </div></details>
              {!completed && <button className={`${button} text-red-300`} onClick={() => edit({ ...plan, steps: plan.steps.filter(item => item.id !== step.id).map(item => ({ ...item, dependsOn: item.dependsOn.filter(id => id !== step.id) })) })}><Trash2 className="mr-1 inline" size={12} />{label('Remove step', 'Удалить шаг')}</button>}
            </fieldset>
            {attempt?.verification.map(receipt => <details key={receipt.id} className="rounded border border-zinc-800 p-2 text-[10px]"><summary className="cursor-pointer">{statusText(receipt.phase)} · {statusText(receipt.status)} · {uiText("Exit code: {code}", { code: receipt.exitCode ?? "—" })}</summary><pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words">{receipt.stdout}{receipt.stderr}{receipt.error}</pre></details>)}
            {attempt?.helperSources && sourceRows(attempt.helperSources, label('Helper', 'Помощник'))}
            {attempt?.reviewSources && sourceRows(attempt.reviewSources, label('Review', 'Ревью'))}
            {attempt?.architect && sourceRows([attempt.architect], label('Blind report architect', 'Архитектор анонимных отчётов'))}
            {attempt && multiStageRows(attempt)}
            {attempt?.review && !attempt.reviewSources?.length && <div className="text-xs"><p className="text-zinc-300">{attempt.review.summary}</p>{attempt.review.findings.map((finding, i) => <p key={i} className="mt-2 text-amber-200">{finding.location}: {finding.evidence}<br />{finding.action}</p>)}</div>}
            {!!state?.attempts.length && <details className="text-[10px] text-zinc-500"><summary className="cursor-pointer">{label('Attempt history', 'История попыток')} ({state.attempts.length})</summary>{state.attempts.map(item => <div key={item.id} className="mt-2 space-y-2 break-words"><p>#{item.number} {statusText(item.status)} {item.error}</p>{item.id !== attempt?.id && <>{item.session && <button className={button} onClick={() => onOpenChat(item.session!.chatId, `${step.title} · ${label('Attempt', 'Попытка')} ${item.number}`)}>{label('Open attempt chat', 'Открыть чат попытки')}</button>}{sourceRows(item.helperSources ?? [], label('Helper', 'Помощник'))}{sourceRows(item.reviewSources ?? [], label('Review', 'Ревью'))}{multiStageRows(item)}</>}</div>)}</details>}
          </div>}
        </article>
      })}
    </div>
    <form className="flex shrink-0 gap-2 border-t border-zinc-800 p-3" onSubmit={event => {
      event.preventDefault(); if (locked || gatePending || !newTitle.trim()) return
      const id = `step-${crypto.randomUUID()}`
      edit({ ...plan, steps: [...plan.steps, { id, title: newTitle.trim(), instructions: '', acceptance: [], dependsOn: plan.steps.length ? [plan.steps[plan.steps.length - 1].id] : [], newContext: true, stopAfter: false, verification: [], ...(plan.codeFlow ? { codePhase: 'implementation' as const } : {}) }] })
      setExpanded(id); setNewTitle('')
    }}><input className={control} value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder={label('Add a plan step', 'Добавить шаг плана')} aria-label={label('New step', 'Новый шаг')} disabled={locked || gatePending} data-testid="workflow-add-title" /><button className={button} disabled={locked || gatePending || !newTitle.trim()} aria-label={label('Add step', 'Добавить шаг')} data-testid="workflow-add-step"><Plus size={16} /></button></form>
  </section>
}
