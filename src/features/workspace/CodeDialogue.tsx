import { uiText } from '../../uiText'
import { useEffect, useRef, useState } from 'react'
import type { WorkflowSnapshot } from '../../../shared/workflow'
import type { CodeFlowDiscussion } from '../../../shared/code-flow'
import { useStore, type Task } from '../../store'
import { MarkdownMessage } from '../../components/MarkdownMessage'
import { Composer } from './Composer'
import { ComposerConfigurationBar } from './ComposerConfigurationBar'
import { configurationFromPreset, defaultPermissions, type ChatConfiguration } from './agentConfiguration'
import { CodeFlowPanel } from './CodeFlowPanel'
import { useCodeDiscussion } from './useCodeDiscussion'
import { CODE_DIALOGUE_TAB } from './useWorkflowChats'

export { CODE_DIALOGUE_TAB }
const button = 'rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40'

/** The conversation belongs to the workflow. It never sends directly into an owned native run. */
interface CodeDialogueProps { task: Task; onOpenChat: (id: string, title: string) => void; onOpenPlan: () => void }
export function CodeDialogue(props: CodeDialogueProps) { return <CodeDialogueSession key={props.task.id} {...props} /> }
function CodeDialogueSession({ task, onOpenChat, onOpenPlan }: CodeDialogueProps) {
  const { presets, settings } = useStore()
  const ru = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [mutation, setMutation] = useState(false)
  const [gateBusy, setGateBusy] = useState(false)
  const mounted = useRef(false)
  const saved = useRef<WorkflowSnapshot | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const accept = (next: WorkflowSnapshot) => {
    if (!mounted.current || next.taskId !== task.id) return
    const current = saved.current
    if (current && (next.runId === current.runId ? next.sequence < current.sequence : next.updatedAt <= current.updatedAt)) return
    saved.current = next; setSnapshot(next)
  }
  const acceptRef = useRef(accept)
  acceptRef.current = accept
  useEffect(() => {
    mounted.current = true; saved.current = null; setSnapshot(null); setLoading(true); setError('')
    let current = true
    const off = window.ziafAPI.workflows.onEvent(next => { if (current) acceptRef.current(next) })
    void window.ziafAPI.workflows.get({ taskId: task.id }).then(next => { if (current && next) acceptRef.current(next) })
      .catch(failure => { if (current) setError(String(failure.message ?? failure)) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false; mounted.current = false; off() }
  }, [task.id])
  const discussion = useCodeDiscussion(snapshot, 'conversation', next => acceptRef.current(next), task.id)
  const running = snapshot?.status === 'running'
  const entries = snapshot?.codeFlow?.dialogue ?? []
  useEffect(() => {
    if (atBottom.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
  }, [entries.length, snapshot?.sequence])
  const currentStep = snapshot?.plan.steps.find(step => snapshot.codeFlow?.pending?.stepId === step.id)
    ?? snapshot?.plan.steps.find(step => snapshot.steps.find(state => state.id === step.id)?.status === 'running')
    ?? snapshot?.plan.steps.find(step => snapshot.steps.find(state => state.id === step.id)?.status !== 'completed')
  const stage = snapshot?.steps.find(step => step.id === currentStep?.id)
  const attempt = stage?.attempts.at(-1)
  const activeSession = attempt?.multiStages?.find(item => item.status === 'running')?.session ?? attempt?.session
  const selectedPhase = discussion.draft.phase ?? currentStep?.codePhase ?? 'planning'
  const selectedStep = discussion.draft.phase ? [...snapshot?.plan.steps ?? []].reverse().find(step => step.codePhase === selectedPhase) : currentStep
  const selectedState = snapshot?.steps.find(step => step.id === selectedStep?.id)
  const plannerRole = selectedPhase !== 'implementation' && selectedPhase !== 'delivery' ? snapshot?.plan.codeFlow?.planner : undefined
  const multiPlanning = selectedPhase === 'planning' && snapshot?.plan.codeFlow?.multi?.version === 1
  // A completed phase selected for a new discussion creates a fresh step. An
  // unfinished/pending phase retains its saved override, as the runner does.
  const retainedStep = selectedStep && (!discussion.draft.phase || selectedState?.status !== 'completed' || snapshot?.codeFlow?.pending?.stepId === selectedStep.id) ? selectedStep : undefined
  const stepRole = !plannerRole && !multiPlanning && retainedStep && (retainedStep.presetName || retainedStep.reasoningEffort !== undefined || retainedStep.permissions !== undefined) ? retainedStep : undefined
  const role = plannerRole ?? {
    presetName: stepRole?.presetName ?? snapshot?.plan.coderPreset ?? '@task',
    configuration: stepRole?.presetName ? stepRole.configuration : snapshot?.plan.coderConfiguration,
    permissions: stepRole?.permissions ?? (stepRole?.presetName ? undefined : snapshot?.plan.coderPermissions),
    reasoningEffort: stepRole?.reasoningEffort !== undefined ? stepRole.reasoningEffort : stepRole?.presetName ? undefined : snapshot?.plan.coderReasoningEffort,
  }
  const named = role.presetName === '@task' ? task.model : role.presetName
  const preset = presets.find(item => item.name === named)
  const presetBase = preset ? configurationFromPreset(preset) : undefined
  const taskProvider = task.agentProvider ?? presetBase?.provider ?? 'codex'
  const base: ChatConfiguration = role.presetName === '@task' || !presetBase
    ? { presetName: task.model || '', provider: taskProvider, model: task.providerModel ?? presetBase?.model ?? 'auto', apiConnectionId: task.apiConnectionId ?? presetBase?.apiConnectionId,
      permissions: task.permissions ?? presetBase?.permissions ?? defaultPermissions(taskProvider), reasoningEffort: task.reasoningEffort === undefined ? presetBase?.reasoningEffort : task.reasoningEffort }
    : presetBase
  const custom = role.configuration
  const selected = custom ?? base
  const configuration: ChatConfiguration = {
    provider: selected.provider, model: selected.model, apiConnectionId: selected.provider === 'api' ? selected.apiConnectionId : undefined, presetName: custom ? '' : preset?.name ?? '',
    permissions: role.permissions ?? selected.permissions ?? defaultPermissions(selected.provider),
    reasoningEffort: role.reasoningEffort === undefined ? selected.reasoningEffort : role.reasoningEffort,
  }
  const answersAcceptedStep = !discussion.draft.phase && snapshot?.codeFlow?.pending?.kind === 'questions' && currentStep?.codePhase === 'implementation'
  const provedImplementation = snapshot?.steps.some(item => item.status === 'completed' && snapshot.plan.steps.find(step => step.id === item.id)?.codePhase === 'implementation')
  const stepConfigLocked = !!stepRole && (selectedState?.status === 'completed' || !!snapshot?.codeFlow?.pending)
  const configLocked = loading || !snapshot || !!running || mutation || discussion.busy || !!discussion.draft.request || gateBusy || snapshot.codeFlow?.pending?.kind === 'review' || !!provedImplementation || stepConfigLocked
  const applyConfiguration = async (next: ChatConfiguration) => {
    if (!saved.current || configLocked) throw new Error(label('Pause the workflow before changing its settings.', 'Приостановите процесс перед изменением настроек.'))
    setMutation(true); setError('')
    try {
      const { presetName, ...configuration } = next
      const current = saved.current
      const plan = plannerRole ? { ...current.plan, codeFlow: { ...current.plan.codeFlow!, planner: { ...current.plan.codeFlow!.planner!,
        presetName: presetName || '@custom', configuration: presetName ? undefined : configuration, reasoningEffort: next.reasoningEffort, permissions: next.permissions } } }
        : stepRole ? { ...current.plan, steps: current.plan.steps.map(step => step.id === stepRole.id ? { ...step,
          presetName: presetName || '@custom', configuration: presetName ? undefined : configuration, reasoningEffort: next.reasoningEffort, permissions: next.permissions } : step) }
        : { ...current.plan, coderPreset: presetName || '@custom', coderConfiguration: presetName ? undefined : configuration,
          coderReasoningEffort: next.reasoningEffort, coderPermissions: next.permissions }
      const updated = await window.ziafAPI.workflows.save({ taskId: task.id, expectedRevision: current.revision, plan })
      acceptRef.current(updated)
    } finally { if (mounted.current) setMutation(false) }
  }
  const stop = async () => {
    if (mutation) return
    setMutation(true); setError('')
    try { acceptRef.current(await window.ziafAPI.workflows.pause({ taskId: task.id })) }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { if (mounted.current) setMutation(false) }
  }
  const phases: Array<[CodeFlowDiscussion['phase'] | '', string]> = [
    ['', label('Current stage', 'Текущий этап')], ['requirements', label('Revisit requirements', 'Пересмотреть требования')],
    ['specification', label('Revisit technical design', 'Пересмотреть техническое решение')], ['planning', label('Revisit plan', 'Пересмотреть план')],
  ]
  return <div className="flex h-full min-h-0 flex-1 flex-col" data-testid="code-dialogue">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-5 py-3">
      <div><h2 className="text-sm font-medium text-zinc-100">Forge · {label('Discussion', 'Обсуждение')}</h2><p className="mt-1 text-xs text-zinc-400" data-testid="code-dialogue-stage">{currentStep?.title ?? label('Code task', 'Задача Code')} · {loading ? label('Loading…', 'Загрузка…') : running ? label('Working', 'Выполняется') : label('Ready for discussion', 'Можно обсудить')}</p></div>
      <div className="flex gap-2">{activeSession && <button type="button" className={button} data-testid="code-dialogue-execution" onClick={() => onOpenChat(activeSession.chatId, currentStep?.title ?? 'Code')}>{label('Execution / logs', 'Исполнение / логи')}</button>}<button type="button" className={button} onClick={onOpenPlan}>{label('Plan and roles', 'План и роли')}</button></div>
    </header>
    <div ref={viewport} onScroll={() => { const node = viewport.current; if (node) atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80 }} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4" data-testid="code-dialogue-feed">
      {!entries.length && <article className="rounded-lg border border-zinc-800 p-3"><p className="mb-2 text-xs text-zinc-500">{label('Initial request', 'Исходная задача')}</p><MarkdownMessage text={snapshot?.plan.codeFlow?.request || task.description || task.name} /></article>}
      {entries.map(entry => <article key={entry.id} data-testid={`code-dialogue-message-${entry.id}`} data-role={entry.role} className={`rounded-lg border p-3 ${entry.role === 'user' ? 'border-orange-500/20 bg-orange-500/5' : 'border-zinc-800'}`}>
        <p className="mb-2 text-xs text-zinc-500">{entry.role === 'user' ? label('You', 'Вы') : label('Agent', 'Агент')} · {snapshot?.plan.steps.find(step => step.id === entry.stepId)?.title ?? snapshot?.codeFlow?.retiredSteps?.find(item => item.step.id === entry.stepId)?.step.title ?? ''}</p>
        <MarkdownMessage text={entry.text} />
        {entry.questions?.map(question => <div key={question.id} className="mt-3 rounded border border-zinc-700 p-2 text-sm"><p>{question.question}</p>{question.options?.map(option => <button type="button" key={option} className={`${button} mr-2 mt-2`} onClick={() => discussion.setText(`${discussion.draft.text}${discussion.draft.text ? '\n' : ''}${question.question}\n${option}`)}>{option}</button>)}</div>)}
      </article>)}
      {running && <p role="status" className="text-xs text-orange-300">{label('The agent is working. You can stop or send a clarification; a clarification pauses current work before it is discussed.', 'Агент работает. Можно остановить процесс или отправить уточнение: текущая работа сначала будет приостановлена.')}</p>}
      {snapshot?.codeFlow && snapshot.plan.codeFlow?.interaction?.version === 1 && <CodeFlowPanel snapshot={snapshot} ru={ru} workspace={task.worktreePath} disabled={loading || mutation || discussion.busy || gateBusy || !!running} onSnapshot={next => acceptRef.current(next)} onBusy={(_, busy) => setGateBusy(busy)} />}
      {snapshot?.codeFlow && snapshot.plan.codeFlow?.interaction?.version !== 1 && <p className="text-xs text-zinc-400">{label('Sending here starts a versioned discussion for this saved Code task. Its existing decisions remain in Plan until then.', 'Сообщение здесь откроет версионируемое обсуждение этой сохранённой Code-задачи. До этого её решения остаются в панели «План».')}</p>}
    </div>
    <div className="shrink-0 space-y-2 border-t border-zinc-800 p-4">
      {(error || discussion.error) && <p role="alert" className="text-xs text-rose-300">{error || discussion.error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400"><label>{label('Discuss', 'Обсудить')} <select data-testid="code-dialogue-phase" className="ml-2 rounded border border-zinc-700 bg-[#111317] px-2 py-1" value={discussion.draft.phase ?? ''} disabled={discussion.busy || !!discussion.draft.request || mutation} onChange={event => discussion.setPhase(event.target.value ? event.target.value as CodeFlowDiscussion['phase'] : undefined)}>{phases.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><span>{answersAcceptedStep ? label('An answer continues this already accepted step. Choose “Revisit plan” for a new scope.', 'Ответ продолжит уже согласованный шаг. Для нового объёма работ выберите «Пересмотреть план».') : label('Sending does not approve documents or start implementation.', 'Отправка не означает принятие документов или запуск реализации.')}</span></div>
      {discussion.draft.phase && <p className="text-xs text-amber-200">{label('This explicitly revisits that foundation and replans future work. Completed evidence is retained.', 'Это явный пересмотр выбранного основания и будущих шагов. Результаты выполненных проверок сохраняются.')}</p>}
      {discussion.draft.request && <p role="status" className="text-xs text-amber-200">{label('Confirmation is pending. Retry sends the original saved message; your new draft stays separate.', 'Подтверждение не получено. Повтор отправит исходное сохранённое сообщение; новый черновик сохранится отдельно.')} <button className={button} disabled={discussion.busy || mutation} data-testid="code-dialogue-retry" onClick={() => void discussion.send(discussion.draft.request!.text).catch(() => {})}>{label('Retry', 'Повторить')}</button></p>}
      {provedImplementation && <p className="text-[10px] text-zinc-500">{label('Agent settings remain bound to the verified implementation. Discussion preserves them.', 'Настройки агента привязаны к проверенной реализации. Обсуждение сохраняет их.')}</p>}
      {stepConfigLocked && <p data-testid="code-dialogue-step-policy-locked" className="text-[10px] text-zinc-500">{label('This step has its own agent settings. Its saved decision or completed evidence prevents changing them here; changing the workflow default would not change this step.', 'У шага собственные настройки агента. Ожидающее решение или сохранённый результат запрещают их изменение здесь; смена общих настроек не изменит этот шаг.')}</p>}
      <p data-testid="code-dialogue-agent-role" className="text-[10px] text-zinc-500">{plannerRole ? label('Planner for this discussion stage.', 'Планировщик этого этапа обсуждения.') : stepRole ? label('Saved agent override for this step.', 'Собственные настройки агента этого шага.') : label('Workflow executor for this stage.', 'Исполнитель workflow для этого этапа.')} {selectedPhase !== 'implementation' && selectedPhase !== 'delivery' ? label('Preparation is read-only; provider-native policy still applies. Reviewers remain separate in Plan and roles.', 'Подготовка не изменяет исходники; действует политика выбранного провайдера. Ревьюеры настраиваются отдельно в «План и роли».') : label('Reviewers remain separate in Plan and roles.', 'Ревьюеры настраиваются отдельно в «План и роли».')}</p>
      <Composer value={discussion.draft.text} onChange={discussion.setText} onSend={text => discussion.send(text, { phase: discussion.draft.phase }).then(() => {})} onStop={stop}
        canSend={!!snapshot && !loading && !mutation && !discussion.busy && !discussion.draft.request && !gateBusy} isRunning={!!running} canInterrupt={!mutation} supportsInterrupt supportsAttachments={false}
        processState={mutation || discussion.busy ? 'starting' : running ? 'running' : 'ready'} placeholder={label('Ask a question, add a requirement, or discuss a technical choice…', 'Задайте вопрос, добавьте требование или обсудите техническое решение…')}
        configurationControls={<ComposerConfigurationBar current={configuration} presets={presets} busy={!!configLocked} applying={mutation} disabled={loading || !snapshot} onApply={applyConfiguration} />} />
    </div>
  </div>
}
