import { statusLabel } from './localizedLabels'
import { uiText } from '../../uiText'
import { useEffect, useRef, useState } from 'react'
import type { CodeArtifactReceipt, CodeFlowGate, CodeFlowResponse, CodeProposedStep } from '../../../shared/code-flow'
import type { VerificationCommand, WorkflowSnapshot } from '../../../shared/workflow'
import { MarkdownMessage } from '../../components/MarkdownMessage'
import { CodePlanProposal } from './CodePlanProposal'
import { useCodeDiscussion } from './useCodeDiscussion'

const button = 'rounded border border-zinc-700 px-2 py-1.5 text-xs hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40'
const control = 'w-full rounded border border-zinc-700 bg-[#111317] px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-50'
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const invalidText = (value: string, maximum: number, allowEmpty = false) => value.length > maximum || value.includes('\0') || !allowEmpty && !value.trim()
const invalidCommand = (command: VerificationCommand) => invalidText(command.executable, 4096) || command.args.length > 100 || command.args.some(arg => invalidText(arg, 8000, true)) || !Number.isInteger(command.timeoutMs) || command.timeoutMs < 100 || command.timeoutMs > 600000 || command.executable === '/bin/sh' && !command.args[1]?.trim()

/** Presentation only: accepting a gate never directly sends to a native session. */
export function CodeFlowPanel({ snapshot, ru, workspace, disabled, onSnapshot, onBusy }: {
  snapshot: WorkflowSnapshot; ru: boolean; workspace?: string; disabled: boolean
  onSnapshot: (next: WorkflowSnapshot) => void
  onBusy: (gateId: string, busy: boolean) => void
}) {
  const state = snapshot.codeFlow
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  if (!state) return null
  return <div className="space-y-3" data-testid="code-flow-panel">
    <div className="rounded-lg border border-zinc-800 p-3 text-xs">
      <p className="font-medium text-zinc-200">{label('Code workflow', 'Процесс Code')}: {snapshot.plan.title}</p>
      {state.complexity && <p className="mt-1 text-zinc-400">{label('Assessment', 'Оценка')}: {({ trivial: label('Trivial', 'Минимальная'), small: label('Small', 'Небольшая'), medium: label('Medium', 'Средняя'), large: label('Large', 'Крупная') })[state.complexity]}</p>}
      {state.preamble && <p className="mt-2 whitespace-pre-wrap break-words text-zinc-400">{state.preamble}</p>}
    </div>
    {state.pending && <CodeGatePanel key={`${snapshot.taskId}:${snapshot.runId}:${state.pending.id}`} snapshot={snapshot} gate={state.pending} ru={ru} workspace={workspace} disabled={disabled} onSnapshot={onSnapshot} onBusy={onBusy} />}
    {!state.pending && snapshot.status === 'completed' && snapshot.plan.codeFlow?.kind === 'multi-model' && snapshot.plan.codeFlow.multi?.version === 1 && <CodeGatePanel
      key={`${snapshot.taskId}:${snapshot.runId}:completed-review`} snapshot={snapshot} ru={ru} workspace={workspace} disabled={disabled} onSnapshot={onSnapshot} onBusy={onBusy} rereview
      gate={{ id: 'completed-review', kind: 'review-decision', stepId: '', attemptId: '', artifactIds: [], summary: label('The workflow is complete. You can explicitly request a new independent review of its current result. Implementation is not repeated automatically.', 'Процесс завершён. Можно явно запросить новое независимое ревью текущего результата. Реализация автоматически не повторяется.') }} />}
    {!!state.artifacts.length && <section className="space-y-2" aria-label={label('Workflow documents', 'Документы процесса')} data-testid="code-artifacts">
      <h4 className="text-xs font-medium text-zinc-300">{label('Documents', 'Документы')}</h4>
      {state.artifacts.map(receipt => <ArtifactViewer key={`${snapshot.taskId}:${receipt.id}`} snapshot={snapshot} receipt={receipt} ru={ru} disabled={disabled} onSnapshot={onSnapshot} onBusy={onBusy} />)}
    </section>}
    {!!state.acceptedDocuments?.length && <details className="rounded border border-zinc-800 p-2 text-xs" data-testid="code-accepted-documents"><summary className="cursor-pointer text-zinc-400">{label('Document acceptance history', 'История согласования документов')}</summary>{state.acceptedDocuments.map(item => <div key={item.commandId} className="mt-2 break-words"><p>{statusLabel(item.phase, ru)} · {label('Basis revision', 'Версия основания')} {item.basisRevision} · {item.invalidatedAt ? label('Superseded; new acceptance required', 'Пересмотрено; нужно новое согласование') : label('Accepted', 'Принято')}</p>{item.artifacts.map(artifact => <p key={artifact.id} className="font-mono text-[10px] text-zinc-500">{artifact.id} · {artifact.sha256}</p>)}</div>)}</details>}
    {!!state.acceptedPlans?.length && <details className="rounded border border-zinc-800 p-2 text-xs" data-testid="code-accepted-plans"><summary className="cursor-pointer text-zinc-400">{label('Implementation approval history', 'История разрешений на реализацию')}</summary>{state.acceptedPlans.map(item => <div key={item.commandId} className="mt-2 break-words"><p>{label('Basis revision', 'Версия основания')} {item.basisRevision} · {item.invalidatedAt ? label('Superseded', 'Пересмотрено') : label('Accepted', 'Принято')}</p><p>{item.stepIds.map(id => snapshot.plan.steps.find(step => step.id === id)?.title ?? id).join(' → ')}</p><p className="font-mono text-[10px] text-zinc-500">{item.workspaceFingerprint}</p></div>)}</details>}
    {!!state.retiredSteps?.length && <details className="rounded border border-zinc-800 p-2 text-xs" data-testid="code-retired-steps"><summary className="cursor-pointer text-zinc-400">{label('Superseded stages and retained evidence', 'Пересмотренные этапы и сохранённые результаты')}</summary>{state.retiredSteps.map((item, index) => <div key={`${item.commandId}:${item.step.id}:${index}`} className="mt-2"><p>{item.step.title} · {statusLabel(item.state.status, ru)}</p><p className="text-zinc-500">{item.reason}</p><p className="text-zinc-500">{label('Saved attempts', 'Сохранённые попытки')}: {item.state.attempts.length}</p></div>)}</details>}
    {!!state.answers.length && <details className="rounded border border-zinc-800 p-2 text-xs" data-testid="code-decisions">
      <summary className="cursor-pointer text-zinc-400">{label('Saved answers and decisions', 'Сохранённые ответы и решения')} ({state.answers.length})</summary>
      {state.answers.map((answer, index) => <p key={`${answer.at}:${index}`} className="mt-2 whitespace-pre-wrap break-words text-zinc-300">{answer.text || label('Approved', 'Принято')}</p>)}
    </details>}
  </div>
}

function ArtifactViewer({ snapshot, receipt, ru, disabled, onSnapshot, onBusy }: { snapshot: WorkflowSnapshot; receipt: CodeArtifactReceipt; ru: boolean; disabled: boolean; onSnapshot: (next: WorkflowSnapshot) => void; onBusy: (id: string, busy: boolean) => void }) {
  const taskId = snapshot.taskId
  const [content, setContent] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const discussion = useCodeDiscussion(snapshot, `artifact-${receipt.id}`, onSnapshot)
  const generation = useRef(0)
  useEffect(() => { generation.current += 1; return () => { generation.current += 1 } }, [taskId, receipt.id])
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const editable = ['requirements.md', 'spec.md', 'investigation.md', 'plan.md', 'planning.md', 'final_plan.md'].includes(receipt.name)
    && !snapshot.codeFlow?.artifacts.some(item => item.name === receipt.name && item.version > receipt.version)
  const saveEdit = async () => {
    onBusy(receipt.id, true)
    try {
      await discussion.send(uiText("Revise {value1} using my edited document. Discuss any unresolved decisions; this is not approval to implement.", { value1: receipt.name }, ru ? 'ru' : undefined),
        { artifactEdits: [{ artifactId: receipt.id, expectedSha256: receipt.sha256, content: discussion.draft.text }] })
      setEditing(false)
    } catch { /* The durable request and editor remain available for an exact retry. */ }
    finally { onBusy(receipt.id, false) }
  }
  const read = async () => {
    if (loading) return
    if (open) { setOpen(false); return }
    if (content !== null) { setOpen(true); return }
    const current = generation.current
    setLoading(true); setError('')
    try {
      const artifact = await window.ziafAPI.workflows.readArtifact({ taskId, artifactId: receipt.id })
      if (current !== generation.current) return
      if (artifact.sha256 !== receipt.sha256 || artifact.version !== receipt.version || artifact.name !== receipt.name) throw new Error(label('The document receipt changed. Reload the saved workflow.', 'Квитанция документа изменилась. Перечитайте сохранённый процесс.'))
      setContent(artifact.content); setOpen(true)
    } catch (failure) { if (current === generation.current) setError(message(failure)) }
    finally { if (current === generation.current) setLoading(false) }
  }
  return <article className="rounded border border-zinc-800 bg-[#15171a] p-2" data-testid={`code-artifact-${receipt.id}`}>
    <button className="flex w-full items-center justify-between gap-2 text-left text-xs disabled:opacity-40" disabled={loading} onClick={() => void read()} aria-expanded={open} data-testid={`code-artifact-open-${receipt.id}`}>
      <span className="break-all font-medium">{receipt.name}</span><span className="shrink-0 text-zinc-500">v{receipt.version} · {receipt.bytes} B {loading ? '…' : open ? '▾' : '▸'}</span>
    </button>
    <details className="mt-1 text-[10px] text-zinc-500"><summary className="cursor-pointer">{label('Receipt and file location', 'Квитанция и расположение файла')}</summary><p className="mt-1 break-all">{receipt.path}</p><p className="break-all">SHA-256: {receipt.sha256}</p><p className="break-all">{label('Attempt', 'Попытка')}: {receipt.attemptId}</p></details>
    {error && <p role="alert" className="mt-2 break-words text-xs text-red-300">{error}</p>}
    {open && content !== null && <div className="mt-3 border-t border-zinc-800 pt-3">
      <div className="max-h-[32rem] overflow-auto" data-testid={`code-artifact-content-${receipt.id}`}><MarkdownMessage text={content} /></div>
      {(editable || discussion.draft.request) && <div className="mt-3 space-y-2">
        {!editing && <button type="button" className={button} disabled={disabled || discussion.busy} data-testid={`code-artifact-edit-${receipt.id}`} onClick={() => { if (!discussion.draft.edit) discussion.setText(content); setEditing(true) }}>{label('Edit a new draft', 'Редактировать новый черновик')}</button>}
        {editing && <><textarea className={`${control} min-h-48 font-mono`} rows={12} maxLength={30000} data-testid={`code-artifact-editor-${receipt.id}`} value={discussion.draft.text} disabled={discussion.busy} onChange={event => discussion.setText(event.target.value)} />
          <p className="text-[10px] text-zinc-400">{label('The accepted file is unchanged. Save sends a new document revision for discussion and invalidates affected approvals.', 'Принятый файл не изменяется. Сохранение передаёт новую редакцию для обсуждения и отменяет зависимые согласования.')}</p>
          <div className="flex gap-2"><button type="button" className={button} data-testid={`code-artifact-save-${receipt.id}`} disabled={disabled || discussion.busy || !discussion.draft.request && !discussion.draft.text.trim()} onClick={() => void saveEdit()}>{discussion.draft.request ? label('Retry saved revision', 'Повторить сохранённую редакцию') : label('Save and discuss revision', 'Сохранить и обсудить правку')}</button><button type="button" className={button} onClick={() => setEditing(false)}>{label('Close editor; keep draft', 'Закрыть редактор, сохранив черновик')}</button></div>
        </>}
        {discussion.error && <p role="alert" className="text-xs text-red-300">{discussion.error}</p>}
      </div>}
    </div>}
  </article>
}

function CodeGatePanel({ snapshot, gate, ru, workspace, disabled, onSnapshot, onBusy, rereview = false }: {
  snapshot: WorkflowSnapshot; gate: CodeFlowGate; ru: boolean; workspace?: string; disabled: boolean
  rereview?: boolean
  onSnapshot: (next: WorkflowSnapshot) => void
  onBusy: (gateId: string, busy: boolean) => void
}) {
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const storageKey = `ziaforge-code-gate:${snapshot.taskId}:${snapshot.runId}:${gate.id}`
  const initialProposal = (): CodeProposedStep[] => (gate.proposedSteps ?? []).filter(step => !step.codePhase || step.codePhase === 'implementation')
    .map(({ title, instructions, acceptance, verification, red, specialization }) => ({ title, instructions, acceptance, verification, ...(red ? { red } : {}), ...(specialization ? { specialization } : {}) }))
  const [restored] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return { answers: {} as Record<string, string>, comments: '', proposedSteps: initialProposal(), request: null as CodeFlowResponse | null, error: '' }
      const value = JSON.parse(raw) as { answers?: Record<string, string>; comments?: string; proposedSteps?: CodeProposedStep[]; request?: CodeFlowResponse }
      if (!value || typeof value !== 'object' || value.answers && (typeof value.answers !== 'object' || Object.values(value.answers).some(answer => typeof answer !== 'string')) || value.comments !== undefined && typeof value.comments !== 'string') throw new Error(uiText("Invalid saved gate draft"))
      if (value.request && (value.request.taskId !== snapshot.taskId || value.request.gateId !== gate.id || typeof value.request.commandId !== 'string')) throw new Error(uiText("Invalid saved gate response"))
      if (value.proposedSteps && (!Array.isArray(value.proposedSteps) || value.proposedSteps.some(step => !step || typeof step.title !== 'string' || typeof step.instructions !== 'string' || !Array.isArray(step.acceptance) || !Array.isArray(step.verification)))) throw new Error(uiText("Invalid saved plan proposal"))
      return { answers: value.answers ?? {}, comments: value.comments ?? '', proposedSteps: value.proposedSteps ?? initialProposal(), request: value.request ?? null, error: '' }
    } catch { return { answers: {} as Record<string, string>, comments: '', proposedSteps: initialProposal(), request: null, error: label('The saved response cannot be read. Restore local storage before replying.', 'Не удалось прочитать сохранённый ответ. Восстановите локальное хранилище перед отправкой.') } }
  })
  const [answers, setAnswers] = useState(restored.answers)
  const [comments, setComments] = useState(restored.comments)
  const [proposedSteps, setProposedSteps] = useState(restored.proposedSteps)
  const [request, setRequest] = useState<CodeFlowResponse | null>(restored.request)
  const requestRef = useRef(request)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState(restored.error)
  const mounted = useRef(false)
  const busyCallback = useRef(onBusy)
  busyCallback.current = onBusy
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; busyCallback.current(gate.id, false) } }, [gate.id])
  useEffect(() => {
    if (restored.error) return
    try { localStorage.setItem(storageKey, JSON.stringify({ answers, comments, proposedSteps, request })) }
    catch { /* The in-memory draft remains intact. Acceptance has a strict write below. */ }
  }, [answers, comments, proposedSteps, request, storageKey, restored.error])
  useEffect(() => {
    // A completed explicit re-review may have outlived this panel. Its durable
    // receipt clears an old unknown ACK; it must not become another request.
    const pending = requestRef.current
    if (!pending || !snapshot.commandIds.includes(pending.commandId) && !snapshot.codeFlow?.responses?.some(item => item.commandId === pending.commandId)) return
    requestRef.current = null; setRequest(null)
    try { localStorage.removeItem(storageKey) } catch { /* Backend retains the deduplication receipt. */ }
  }, [snapshot.commandIds, snapshot.codeFlow?.responses, storageKey])
  const respond = async (action: CodeFlowResponse['action']) => {
    if (disabled || busyRef.current || restored.error) return
    const text = action === 'answer' ? (gate.questions ?? []).map(question => `${question.id}. ${question.question}\n${answers[question.id]?.trim() ?? ''}`).join('\n\n') + (comments.trim() ? `\n\n${comments.trim()}` : '')
      : action === 'changes' && gate.kind === 'review-decision' ? comments.trim() || label('User chose to skip independent review for this result.', 'Пользователь выбрал пропуск независимого ревью этого результата.') : comments.trim()
    if (!requestRef.current && ((action === 'answer' && !(gate.questions?.length && gate.questions.every(question => answers[question.id]?.trim()))) || action === 'changes' && gate.kind !== 'review-decision' && !text)) return
    const next: CodeFlowResponse = requestRef.current ?? { taskId: snapshot.taskId, revision: snapshot.revision, gateId: gate.id, commandId: crypto.randomUUID(), action, ...(text ? { text } : {}), ...(action === 'approve' && gate.kind === 'plan' ? { proposedSteps: proposedSteps.map(step => ({ ...step, acceptance: step.acceptance.filter(item => item.trim()) })) } : {}) }
    if (!requestRef.current && (text.length > 12000 || text.includes('\0'))) { setError(label('Keep the response within 12,000 characters and remove NUL characters.', 'Ответ должен быть не длиннее 12 000 символов и не содержать NUL.')); return }
    busyRef.current = true; setBusy(true); busyCallback.current(gate.id, true); setError('')
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers, comments, proposedSteps, request: next }))
      requestRef.current = next; setRequest(next)
      const accepted = await window.ziafAPI.workflows.respond(next)
      if (!mounted.current) return
      // The receipt may already include a newer phase. Do not infer native completion.
      try { localStorage.removeItem(storageKey) } catch { /* Backend command deduplication still owns retry. */ }
      requestRef.current = null; setRequest(null)
      onSnapshot(accepted)
    } catch (failure) {
      if (!mounted.current) return
      setError(message(failure))
      try {
        // Engine.get is a read-after-command barrier. Only a successful fresh
        // snapshot can distinguish a rejected decision from a missing ACK.
        const current = await window.ziafAPI.workflows.get({ taskId: next.taskId })
        if (!mounted.current || !current?.codeFlow || current.taskId !== next.taskId) return
        const saved = current.codeFlow.responses?.find(item => item.commandId === next.commandId)
        const accepted = saved?.gateId === next.gateId && saved.revision === next.revision && saved.action === next.action && saved.text === next.text && JSON.stringify(saved.proposedSteps) === JSON.stringify(next.proposedSteps)
        if (accepted || !saved && !current.commandIds.includes(next.commandId)) {
          requestRef.current = null; setRequest(null)
          try { localStorage.setItem(storageKey, JSON.stringify({ answers, comments, proposedSteps, request: null })) } catch { /* Keep the in-memory draft; a saved old ID is safe to recheck. */ }
          if (accepted) setError('')
        }
        onSnapshot(current)
      } catch { /* Unknown delivery: retain the exact request identity for retry. */ }
    } finally {
      busyRef.current = false
      if (mounted.current) { setBusy(false); busyCallback.current(gate.id, false) }
    }
  }
  const blocked = disabled || busy || !!restored.error
  const questions = gate.questions ?? []
  const unverifiedPlan = gate.kind === 'plan' && !snapshot.plan.review && proposedSteps.some(step => !step.verification.length)
  const invalidProposal = gate.kind === 'plan' && (!proposedSteps.length || proposedSteps.length > (snapshot.plan.codeFlow?.multi?.version === 1 ? 1 : 16) || proposedSteps.some(step => {
    const criteria = step.acceptance.filter(item => item.trim())
    return invalidText(step.title, 200) || invalidText(step.instructions, 14000) || !criteria.length || criteria.length > 20 || criteria.some(item => invalidText(item, 3000)) || step.verification.length > 10 || step.verification.some(invalidCommand) || !!step.red && invalidCommand(step.red)
  }))
  const suggestionsOnly = gate.kind === 'review' && gate.reviewOutcome === 'approved'
  const fix = snapshot.codeFlow?.fix
  const fixerUsed = gate.kind === 'review' && !suggestionsOnly && !!fix?.attemptId && fix.reviewAttemptId === gate.attemptId
  const title = rereview ? label('Review the completed result', 'Ревью завершённого результата') : gate.kind === 'document' ? label('Accept this document version', 'Согласуйте эту версию документа') : gate.kind === 'review-decision' ? label('Choose whether to run independent review', 'Выберите, запускать ли независимое ревью') : gate.kind === 'questions' ? label('Your answer is needed', 'Нужен ваш ответ') : gate.kind === 'review' ? label('Review findings need a decision', 'Нужно решение по замечаниям ревью') : label('Approve the proposed plan', 'Согласуйте предложенный план')
  return <section className="space-y-3 rounded-lg border border-orange-500/40 bg-orange-500/5 p-3" aria-label={title} data-testid="code-flow-gate">
    <h4 className="text-sm font-medium text-orange-200">{title}</h4>
    <p className="whitespace-pre-wrap break-words text-xs text-zinc-300">{gate.summary}</p>
    {!!gate.artifactIds.length && <p className="text-[10px] text-zinc-400">{label('Documents for this decision:', 'Документы для этого решения:')} {gate.artifactIds.map(id => {
      const artifact = snapshot.codeFlow?.artifacts.find(item => item.id === id)
      return artifact ? `${artifact.name} · v${artifact.version}` : id
    }).join(', ')}</p>}
    {gate.kind === 'document' && <div className="space-y-1 rounded border border-zinc-700 p-2 text-xs"><p>{label('Read the document below before accepting this exact version. A message or edit is discussion, never acceptance.', 'Откройте документ ниже перед согласованием именно этой версии. Сообщение или правка означает обсуждение, а не согласие.')}</p>{gate.artifactHashes?.map(artifact => <p key={artifact.id} className="break-all font-mono text-[10px] text-zinc-500">{snapshot.codeFlow?.artifacts.find(item => item.id === artifact.id)?.name ?? artifact.id}: {artifact.sha256}</p>)}</div>}
    {gate.kind === 'questions' && snapshot.plan.codeFlow?.interaction?.version === 1 && <p className="text-xs text-orange-200">{label('You can answer freely or ask a counterquestion in the discussion composer. Completing every field below is optional; it is only needed for the separate “answers and continue” action.', 'Можно ответить свободно или задать встречный вопрос в поле обсуждения. Заполнение всех полей ниже необязательно: оно нужно только для отдельного действия «Ответить и продолжить».')}</p>}
    {questions.map(question => <label key={question.id} className="block space-y-2 text-xs text-zinc-200">
      <span>{question.question}</span>
      {!!question.options?.length && <span className="flex flex-wrap gap-1">{question.options.map(option => <button type="button" className={button} key={option} disabled={blocked || !!request} onClick={() => setAnswers(previous => ({ ...previous, [question.id]: option }))}>{option}</button>)}</span>}
      <textarea className={control} rows={2} maxLength={4000} disabled={blocked || !!request} value={answers[question.id] ?? ''} onChange={event => setAnswers(previous => ({ ...previous, [question.id]: event.target.value }))} data-testid={`code-question-${question.id}`} />
    </label>)}
    {gate.kind === 'plan' && <CodePlanProposal steps={proposedSteps} onChange={setProposedSteps} disabled={blocked || !!request} ru={ru} workspace={workspace ?? label('Registered task workspace', 'Зарегистрированная рабочая папка задачи')} maxSteps={snapshot.plan.codeFlow?.multi?.version === 1 ? 1 : 16} />}
    {gate.kind === 'plan' && !!proposedSteps.some(step => step.verification.length || step.red) && <p className="text-xs text-amber-200">{label('Approval authorizes these exact checks in this task workspace. The displayed model proposal has not executed them.', 'Согласие разрешает эти конкретные проверки в рабочей папке задачи. Предложение модели ещё не означает их выполнение.')}</p>}
    <label className="block text-xs text-zinc-400">{label('Comments or requested changes', 'Комментарии или необходимые изменения')}<textarea className={`${control} mt-1`} rows={2} maxLength={8000} disabled={blocked || !!request} value={comments} onChange={event => setComments(event.target.value)} data-testid="code-gate-comments" /></label>
    {request && <p role="status" className="text-xs text-amber-200">{label('Awaiting confirmation of the saved decision. Retry sends the same decision once.', 'Ожидается подтверждение сохранённого решения. Повтор отправит то же решение без дублирования.')}</p>}
    {error && <p role="alert" className="break-words text-xs text-red-300">{error}</p>}
    {unverifiedPlan && <p role="status" className="text-xs text-amber-200">{label('Enable independent review and save, or request verification commands before approving this plan.', 'Перед принятием включите независимое ревью и сохраните настройки либо запросите команды проверки.')}</p>}
    {invalidProposal && <p role="status" className="text-xs text-amber-200">{label('Complete the proposal before approval: at most 16 steps (one for Multi-model), 20 criteria of 3,000 characters and 10 checks per step. Titles: 200 characters; instructions: 14,000; command arguments: 8,000. Empty required fields and NUL characters are not accepted.', 'Перед согласованием заполните предложение: до 16 шагов (один для Multi-model), 20 критериев по 3 000 символов и 10 проверок на шаг. Название: 200 символов; задание: 14 000; аргумент команды: 8 000. Пустые обязательные поля и NUL не допускаются.')}</p>}
    {fixerUsed && <p role="status" className="text-xs text-amber-200">{label('The authorized correction already ran. Inspect its findings and create explicit follow-up work.', 'Разрешённая попытка исправления уже выполнена. Изучите замечания и создайте отдельную задачу для дальнейшей работы.')}</p>}
    <div className="flex flex-wrap gap-2">
      {request ? <button className={button} disabled={blocked} onClick={() => void respond(request.action)} data-testid="code-gate-retry">{label('Retry saved decision', 'Повторить сохранённое решение')}</button> : <>
        {rereview ? <button className={button} disabled={blocked} onClick={() => void respond('rereview')} data-testid="code-rereview">{label('Run a new review', 'Запустить новое ревью')}</button> : gate.kind === 'questions' ? <button className={button} disabled={blocked || !questions.length || questions.some(question => !answers[question.id]?.trim())} onClick={() => void respond('answer')} data-testid="code-gate-answer">{label('Send answers and continue', 'Ответить и продолжить')}</button> : <button className={button} disabled={blocked || unverifiedPlan || invalidProposal || fixerUsed} onClick={() => void respond('approve')} data-testid="code-gate-approve">{suggestionsOnly ? label('Acknowledge and continue', 'Принять замечания и продолжить') : gate.kind === 'document' ? label('Accept document and continue', 'Принять документ и продолжить') : gate.kind === 'review-decision' ? label('Run independent review', 'Запустить независимое ревью') : gate.kind === 'review' ? label('Approve one correction', 'Разрешить одно исправление') : label('Approve and continue', 'Принять и продолжить')}</button>}
        {(gate.kind === 'plan' || gate.kind === 'document') && <button className={button} disabled={blocked || !comments.trim()} onClick={() => void respond('changes')} data-testid="code-gate-changes">{label('Request changes', 'Запросить изменения')}</button>}
        {gate.kind === 'review' && snapshot.plan.codeFlow?.multi?.version === 1 && <button className={button} disabled={blocked || !comments.trim()} onClick={() => void respond('changes')} data-testid="code-gate-review-feedback">{label('Reassess review with comments', 'Пересмотреть ревью с комментариями')}</button>}
        {!rereview && gate.kind === 'review-decision' && <button className={button} disabled={blocked} onClick={() => void respond('changes')} data-testid="code-gate-skip-review">{label('Skip review and continue', 'Пропустить ревью и продолжить')}</button>}
        {!rereview && <button className={button} disabled={blocked} onClick={() => void respond('cancel')} data-testid="code-gate-cancel">{label('Stop here', 'Остановиться здесь')}</button>}
      </>}
    </div>
    <p className="text-[10px] text-zinc-500">{label('Closing this panel or restarting the app does not approve this decision.', 'Закрытие панели или перезапуск приложения не означает согласия.')}</p>
  </section>
}
