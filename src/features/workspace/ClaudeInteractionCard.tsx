import { useEffect, useRef, useState } from 'react'
import { MessageCircle, ShieldAlert } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { claudeAnswerMatchesInteraction, type ClaudeInteraction, type ClaudeInteractionAnswer } from '../../../shared/claude-interactions'

const button = 'rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40'
/** Native server decisions never authorize local tools or another provider. */
export function ClaudeInteractionCard({ interaction, onResolve }: { interaction: ClaudeInteraction; onResolve?: (id: string, answer: ClaudeInteractionAnswer) => Promise<void> }) {
  const { t } = useTranslation()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [expired, setExpired] = useState(() => interaction.expiresAt <= Date.now())
  const lock = useRef(false), mounted = useRef(false), previous = useRef(interaction.state), generation = useRef(0)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1 } }, [])
  useEffect(() => {
    const remaining = interaction.expiresAt - Date.now()
    setExpired(remaining <= 0)
    if (remaining <= 0) return
    const timer = setTimeout(() => setExpired(true), Math.min(remaining, 2_147_483_647))
    return () => clearTimeout(timer)
  }, [interaction.expiresAt])
  useEffect(() => {
    if (previous.current === 'submitting' && interaction.state === 'pending') { generation.current += 1; lock.current = false; setSubmitted(false) }
    if (['resolved', 'expired', 'failed'].includes(interaction.state)) generation.current += 1
    previous.current = interaction.state
  }, [interaction.state])
  const actionable = interaction.state === 'pending' && !expired && !submitted && !!onResolve
  const accepted = interaction.answer?.kind === 'question' && interaction.answer.outcome === 'accepted' ? interaction.answer.answers : undefined
  const answer: ClaudeInteractionAnswer = { provider: 'claude', kind: 'question', outcome: 'accepted', answers }
  const submit = async (value: ClaudeInteractionAnswer) => {
    if (!actionable || lock.current || !onResolve || interaction.expiresAt <= Date.now()) return
    if (!claudeAnswerMatchesInteraction(interaction, value)) { setError(t('provider_interaction_required')); return }
    const attempt = ++generation.current
    lock.current = true; setSubmitted(true); setError(null)
    try { await onResolve(interaction.interactionId, value) }
    catch (failure) { if (mounted.current && generation.current === attempt) setError(failure instanceof Error ? failure.message : String(failure)) }
    // An unknown acknowledgement must never permit replay of a native decision.
  }
  const toggle = (question: string, label: string, multi: boolean) => {
    const current = Object.hasOwn(selected, question) ? selected[question] : []
    const next = multi ? current.includes(label) ? current.filter(item => item !== label) : [...current, label] : [label]
    setSelected(previous => ({ ...previous, [question]: next }))
    setAnswers(previous => ({ ...previous, [question]: next.join(', ') }))
  }
  return <section data-testid={`provider-interaction-${interaction.interactionId}`} data-state={interaction.state} className="space-y-3 rounded-xl border border-sky-500/25 bg-sky-950/10 p-3.5">
    <h3 className="flex items-center gap-2 text-xs font-semibold text-sky-200">{interaction.kind === 'approval' ? <ShieldAlert size={15} /> : <MessageCircle size={15} />}{t(interaction.kind === 'approval' ? 'provider_interaction_approval' : 'provider_interaction_question')}</h3>
    <p className="text-xs text-zinc-400">{t(interaction.kind === 'approval' ? 'claude_native_permission_hint' : 'provider_interaction_question_hint')}</p>
    {interaction.kind === 'approval' ? <>
      <p dir="auto" className="break-words text-xs text-zinc-200">{interaction.request.toolName}{interaction.request.description ? ` · ${interaction.request.description}` : ''}</p>
      {interaction.request.input !== undefined && <pre dir="auto" className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-950 p-2 text-[11px] text-zinc-400">{JSON.stringify(interaction.request.input, null, 2)}</pre>}
      <div className="flex flex-wrap gap-2">{(['allow', 'deny'] as const).map(behavior => <button key={behavior} type="button" data-testid={`claude-${behavior}-${interaction.interactionId}`} disabled={!actionable} className={button} onClick={() => void submit({ provider: 'claude', kind: 'approval', behavior })}>{t(behavior)}</button>)}</div>
      {interaction.answer?.kind === 'approval' && <p className="text-xs text-zinc-300">{t(interaction.answer.behavior)}</p>}
    </> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(answer) }}>
      {interaction.request.questions.map((question, index) => <fieldset key={`${index}:${question.question}`} disabled={!actionable} className="space-y-2">
        <legend dir="auto" className="whitespace-pre-wrap text-xs font-medium text-zinc-200">{question.question}</legend>
        <p className="text-[11px] text-zinc-500">{t(question.multiSelect ? 'provider_interaction_multi' : 'provider_interaction_single')}</p>
        {question.options.map((option, optionIndex) => <label key={optionIndex} className="flex items-start gap-2 rounded-lg border border-zinc-800 p-2 text-xs text-zinc-300"><input type={question.multiSelect ? 'checkbox' : 'radio'} name={`${interaction.interactionId}:${index}`} checked={Object.hasOwn(selected, question.question) && selected[question.question].includes(option.label)} onChange={() => toggle(question.question, option.label, !!question.multiSelect)} /><span dir="auto">{option.label}{option.description && <span className="mt-1 block text-zinc-500">{option.description}</span>}</span></label>)}
        <label className="block text-xs text-zinc-400">{t('provider_interaction_response')}<textarea dir="auto" maxLength={16_384} value={(accepted && Object.hasOwn(accepted, question.question) ? accepted[question.question] : Object.hasOwn(answers, question.question) ? answers[question.question] : '')} onChange={event => { setSelected(previous => ({ ...previous, [question.question]: [] })); setAnswers(previous => ({ ...previous, [question.question]: event.target.value })) }} className="mt-1 min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-zinc-200" /></label>
      </fieldset>)}
      <div className="flex flex-wrap gap-2"><button type="submit" className={button} disabled={!actionable || !claudeAnswerMatchesInteraction(interaction, answer)}>{t('provider_interaction_submit')}</button><button type="button" className={button} disabled={!actionable} onClick={() => void submit({ provider: 'claude', kind: 'question', outcome: 'cancelled' })}>{t('provider_interaction_cancel')}</button></div>
    </form>}
    {(error || interaction.error) && <p role="alert" className="text-xs text-rose-300">{interaction.error || error}</p>}
    <p role="status" className="text-xs text-zinc-400">{t(interaction.state === 'resolved' ? interaction.answer?.kind === 'question' && interaction.answer.outcome === 'cancelled' ? 'provider_interaction_cancelled' : 'provider_interaction_resolved' : interaction.state === 'expired' || expired ? 'provider_interaction_expired' : interaction.state === 'failed' || !onResolve ? 'provider_interaction_readonly' : interaction.state === 'submitting' ? 'provider_interaction_submitting' : submitted ? 'provider_interaction_submitted' : 'provider_interaction_waiting')}</p>
  </section>
}
