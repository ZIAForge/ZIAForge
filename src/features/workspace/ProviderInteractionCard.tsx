import { useEffect, useRef, useState } from 'react'
import { MessageCircle, ShieldAlert } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { answerMatchesInteraction, type GrokInteraction, type GrokInteractionAnswer } from '../../../shared/grok-interactions'

export interface ProviderInteractionCardProps {
  interaction: GrokInteraction
  onResolve?: (interactionId: string, answer: GrokInteractionAnswer) => Promise<void>
}

const own = <T,>(record: Record<string, T>, key: string): T | undefined => Object.hasOwn(record, key) ? record[key] : undefined
const button = 'rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40'

/** Provider-owned decisions are separate from local tool allow/deny cards. */
export function ProviderInteractionCard(props: ProviderInteractionCardProps) {
  return <InteractionForm key={`${props.interaction.responseId}:${props.interaction.interactionId}`} {...props} />
}

function InteractionForm({ interaction, onResolve }: ProviderInteractionCardProps) {
  const { t } = useTranslation()
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(() => interaction.expiresAt <= Date.now())
  const locked = useRef(false)
  const mounted = useRef(false)
  const generation = useRef(0)
  const previousState = useRef(interaction.state)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1 } }, [])
  useEffect(() => {
    const remaining = interaction.expiresAt - Date.now()
    setExpired(remaining <= 0)
    if (remaining <= 0 || !['pending', 'submitting'].includes(interaction.state)) return
    const timer = setTimeout(() => setExpired(true), Math.min(remaining, 2_147_483_647))
    return () => clearTimeout(timer)
  }, [interaction.expiresAt, interaction.state])
  useEffect(() => {
    // Only an authoritative rollback permits a changed decision after submission.
    if (previousState.current === 'submitting' && interaction.state === 'pending') {
      generation.current += 1; locked.current = false; setSubmitted(false); setBusy(false)
    }
    if (['resolved', 'expired', 'failed'].includes(interaction.state)) generation.current += 1
    previousState.current = interaction.state
  }, [interaction.state])

  const terminal = ['resolved', 'expired', 'failed'].includes(interaction.state)
  const waiting = !terminal && (busy || interaction.state === 'submitting')
  const actionable = interaction.state === 'pending' && !expired && !waiting && !submitted && Boolean(onResolve)
  const accepted = interaction.answer?.kind === 'question' && interaction.answer.outcome === 'accepted' ? interaction.answer : undefined
  const shownAnswers = accepted?.answers ?? answers
  const shownNotes = accepted?.annotations
  const questionAnswer = (): GrokInteractionAnswer => {
    const annotations = Object.fromEntries(Object.entries(answers).filter(([, labels]) => labels.includes('Other')).map(([question]) => [question, { notes: own(notes, question) ?? '' }]))
    return { kind: 'question', outcome: 'accepted', answers, ...(Object.keys(annotations).length ? { annotations } : {}) }
  }
  const submit = async (answer: GrokInteractionAnswer) => {
    if (!actionable || locked.current || !onResolve || interaction.expiresAt <= Date.now()) return
    if (!answerMatchesInteraction(interaction, answer)) { setError(t('provider_interaction_required')); return }
    const attempt = ++generation.current
    locked.current = true; setBusy(true); setSubmitted(true); setError(null)
    try { await onResolve(interaction.interactionId, answer) }
    catch (failure) {
      // An unknown acknowledgement cannot license a second native decision.
      if (mounted.current && generation.current === attempt) setError(failure instanceof Error ? failure.message : String(failure))
    } finally { if (mounted.current && generation.current === attempt) setBusy(false) }
  }
  const toggle = (question: string, label: string, multi: boolean) => {
    if (!actionable) return
    setAnswers(previous => ({ ...previous, [question]: multi ? own(previous, question)?.includes(label) ? own(previous, question)!.filter(item => item !== label) : [...(own(previous, question) ?? []), label] : [label] }))
  }
  const planOutcome = (outcome: 'chat_about_this' | 'skip_interview') => {
    const partial = Object.fromEntries(Object.entries(answers).filter(([, labels]) => labels.length === 1 && labels[0] !== 'Other').map(([question, labels]) => [question, labels[0]]))
    return submit({ kind: 'question', outcome, ...(Object.keys(partial).length ? { partial_answers: partial } : {}) })
  }
  const savedAnswer = interaction.answer
  const resolvedOption = interaction.kind === 'approval' && savedAnswer?.kind === 'approval' ? interaction.request.options.find(option => option.optionId === savedAnswer.optionId) : undefined
  return <section data-testid={`provider-interaction-${interaction.interactionId}`} data-state={interaction.state} className="space-y-3 rounded-xl border border-sky-500/25 bg-sky-950/10 p-3.5">
    <h3 className="flex items-center gap-2 text-xs font-semibold text-sky-200">{interaction.kind === 'approval' ? <ShieldAlert size={15} /> : <MessageCircle size={15} />}{t(interaction.kind === 'approval' ? 'provider_interaction_approval' : 'provider_interaction_question')}</h3>
    <p className="text-xs text-zinc-400">{t(interaction.kind === 'approval' ? 'provider_interaction_approval_hint' : 'provider_interaction_question_hint')}</p>
    {interaction.kind === 'approval' ? <>
      {interaction.request.toolCall.title && <p dir="auto" className="whitespace-pre-wrap break-words text-xs text-zinc-200">{interaction.request.toolCall.title}</p>}
      {interaction.request.toolCall.rawInput !== undefined && <pre dir="auto" className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-950 p-2 text-[11px] text-zinc-400">{typeof interaction.request.toolCall.rawInput === 'string' ? interaction.request.toolCall.rawInput : JSON.stringify(interaction.request.toolCall.rawInput, null, 2)}</pre>}
      <div className="flex flex-wrap gap-2">{interaction.request.options.map(option => <button key={option.optionId} type="button" disabled={!actionable} className={button} data-testid={`provider-option-${interaction.interactionId}-${option.optionId}`} onClick={() => void submit({ kind: 'approval', optionId: option.optionId })}><span dir="auto">{option.name}</span></button>)}</div>
      {resolvedOption && <p dir="auto" className="text-xs text-zinc-300">{resolvedOption.name}</p>}
    </> : <form onSubmit={event => { event.preventDefault(); void submit(questionAnswer()) }} className="space-y-4">
      {interaction.request.questions.map((question, index) => {
        const selected = own(shownAnswers, question.question) ?? []
        const options = question.options.some(option => option.label === 'Other') ? question.options : [...question.options, { label: 'Other', description: '' }]
        return <fieldset key={`${index}:${question.question}`} disabled={!actionable} className="space-y-2">
          <legend dir="auto" className="whitespace-pre-wrap break-words text-xs font-medium text-zinc-200">{question.question}</legend>
          <p className="text-[11px] text-zinc-500">{t(question.multiSelect ? 'provider_interaction_multi' : 'provider_interaction_single')}</p>
          {options.map((option, optionIndex) => <label key={`${optionIndex}:${option.label}`} className="flex items-start gap-2 rounded border border-zinc-800 p-2 text-xs text-zinc-300">
            <input type={question.multiSelect ? 'checkbox' : 'radio'} name={`${interaction.interactionId}-${index}`} checked={selected.includes(option.label)} onChange={() => toggle(question.question, option.label, question.multiSelect)} className="mt-0.5 shrink-0" />
            <span className="min-w-0"><span dir="auto" className="block whitespace-pre-wrap break-words">{option.label === 'Other' && !question.options.some(item => item.label === 'Other') ? t('provider_interaction_other') : option.label}</span>{option.description && <span dir="auto" className="mt-1 block whitespace-pre-wrap break-words text-zinc-500">{option.description}</span>}{option.preview && <pre dir="auto" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-zinc-400">{option.preview}</pre>}</span>
          </label>)}
          {selected.includes('Other') && <label className="block text-xs text-zinc-400">{t('provider_interaction_response')}<textarea dir="auto" maxLength={16_384} value={(shownNotes ? own(shownNotes, question.question)?.notes : undefined) ?? own(notes, question.question) ?? ''} onChange={event => setNotes(previous => ({ ...previous, [question.question]: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-zinc-200" /></label>}
        </fieldset>
      })}
      {!terminal && <div className="flex flex-wrap gap-2"><button type="submit" className={`${button} border-orange-700`} disabled={!actionable || !answerMatchesInteraction(interaction, questionAnswer())}>{t('provider_interaction_submit')}</button><button type="button" className={button} disabled={!actionable} onClick={() => void submit({ kind: 'question', outcome: 'cancelled' })}>{t('provider_interaction_cancel')}</button></div>}
      {!terminal && interaction.request.mode === 'plan' && <div className="space-y-2 border-t border-zinc-800 pt-2"><p className="text-[11px] text-zinc-500">{t('provider_interaction_plan_hint')}</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={!actionable} onClick={() => void planOutcome('chat_about_this')}>{t('provider_interaction_discuss')}</button><button type="button" className={button} disabled={!actionable} onClick={() => void planOutcome('skip_interview')}>{t('provider_interaction_skip')}</button></div></div>}
    </form>}
    {(error || interaction.error) && <p role="alert" className="whitespace-pre-wrap break-words text-xs text-rose-300">{interaction.error || error}</p>}
    <p role="status" className="text-xs text-zinc-400">{t(interaction.state === 'resolved' ? interaction.answer?.kind === 'question' && interaction.answer.outcome === 'cancelled' ? 'provider_interaction_cancelled' : 'provider_interaction_resolved' : interaction.state === 'expired' || expired ? 'provider_interaction_expired' : interaction.state === 'failed' || !onResolve ? 'provider_interaction_readonly' : waiting ? 'provider_interaction_submitting' : submitted ? 'provider_interaction_submitted' : 'provider_interaction_waiting')}</p>
  </section>
}
