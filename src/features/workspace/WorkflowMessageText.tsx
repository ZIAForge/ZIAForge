import { uiText } from '../../uiText'
import { useMemo } from 'react'
import type { ReconstructedMessage } from '../../../shared/agent-events'
import { MarkdownMessage } from '../../components/MarkdownMessage'
import { useTranslation } from '../../i18n'

type Document = { name: string; content: string }
type Question = { id: string; question: string; options?: string[] }
type Finding = { severity: 'blocking' | 'suggestion'; location: string; evidence: string; action: string }
type Result = { kind: 'phase' | 'stage' | 'work'; summary: string; artifacts: Document[]; questions: Question[]; proposedSteps: number }
  | { kind: 'review'; summary: string; outcome: 'approved' | 'changes_requested'; findings: Finding[] }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string'
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key))

/** Display projection only. The engine, never this parser, accepts workflow output. */
function workflowResult(raw: string, format?: 'work'): (Result & { before?: string; after?: string }) | null {
  if (raw.length > 512000) return null
  const fenced = [...raw.matchAll(/```ziaforge-(phase|stage|work)\s*\n([\s\S]*?)\n```/g)].filter(match => format === 'work' ? match[1] === 'work' : match[1] !== 'work').at(-1)
  try {
    const value: unknown = JSON.parse(fenced ? fenced[2] : raw)
    if (!object(value) || !text(value.summary)) return null
    if (!fenced) {
      if (!keys(value, ['outcome', 'summary', 'findings']) || (value.outcome !== 'approved' && value.outcome !== 'changes_requested') || !Array.isArray(value.findings) || value.findings.length > 64) return null
      if (!value.findings.every(item => object(item) && keys(item, ['severity', 'location', 'evidence', 'action']) && (item.severity === 'blocking' || item.severity === 'suggestion') && text(item.location) && text(item.evidence) && text(item.action))) return null
      return { kind: 'review', summary: value.summary, outcome: value.outcome as 'approved' | 'changes_requested', findings: value.findings as Finding[] }
    }
    const kind = fenced[1] as 'phase' | 'stage' | 'work'
    const allowed = kind === 'stage' ? ['summary', 'artifacts'] : kind === 'work' ? ['status', 'summary', 'complexity', 'nextPhase', 'followUpSize', 'questions', 'artifacts', 'sources', 'steps', 'review', 'outputs'] : ['status', 'summary', 'artifacts', 'questions', 'steps', 'preamble', 'complexity', 'intent']
    if (!keys(value, allowed) || !Array.isArray(value.artifacts) || value.artifacts.length > 16 || !value.artifacts.every(item => object(item) && keys(item, ['name', 'content']) && text(item.name) && text(item.content))) return null
    if (kind === 'phase' && ((value.status !== 'ready' && value.status !== 'needs_input') || !Array.isArray(value.questions) || value.questions.length > 8 || !value.questions.every(item => object(item) && keys(item, ['id', 'question', 'options']) && text(item.id) && text(item.question) && (item.options === undefined || Array.isArray(item.options) && item.options.every(text))) || !Array.isArray(value.steps))) return null
    if (kind === 'work' && (!['complete', 'needs_input', 'plan', 'continue'].includes(String(value.status)) || !Array.isArray(value.questions) || !value.questions.every(item => object(item) && keys(item, ['id', 'question', 'options']) && text(item.id) && text(item.question) && (item.options === undefined || Array.isArray(item.options) && item.options.every(text))) || !Array.isArray(value.steps) || !Array.isArray(value.sources))) return null
    return { kind, summary: value.summary, artifacts: value.artifacts as Document[], questions: kind !== 'stage' ? value.questions as Question[] : [], proposedSteps: kind !== 'stage' ? (value.steps as unknown[]).length : 0, before: raw.slice(0, fenced.index), after: raw.slice(fenced.index! + fenced[0].length) }
  } catch { return null }
}

function Original({ message, label }: { message: ReconstructedMessage; label: string }) {
  return <details className="mt-3 border-t border-zinc-700/50 pt-2" data-testid={`workflow-raw-${message.id}`}>
    <summary className="cursor-pointer text-[11px] text-zinc-400">{label}</summary>
    <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-zinc-400" data-testid={`workflow-raw-text-${message.id}`}>{message.text}</pre>
  </details>
}

/** Used exclusively for a workflow-owned chat; ordinary chat Markdown is unchanged. */
export function WorkflowMessageText({ message, title, kind }: { message: ReconstructedMessage; title: string; kind?: 'work' }) {
  const { language } = useTranslation()
  const ru = language.startsWith('ru')
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const result = useMemo(() => message.role === 'assistant' && message.status === 'completed' ? workflowResult(message.text, kind) : null, [message.role, message.status, message.text, kind])
  if (message.role === 'user') {
    const request = message.text.match(/^(?:Task: |Original task:\n|Original request:\n|User request \(data\):\n)([^\n]+)/m)?.[1]
    return <section className="whitespace-normal" data-testid={`workflow-instructions-${message.id}`}>
      <p className="font-medium text-zinc-100">{label('Stage instructions', 'Задание этапа')}: {title}</p>
      {request && <p className="mt-2 whitespace-pre-wrap break-words text-zinc-300">{request.length > 240 ? `${request.slice(0, 240)}…` : request}</p>}
      <Original message={message} label={label('Show original instructions', 'Показать исходное задание')} />
    </section>
  }
  if (message.status === 'streaming' && (kind === 'work' ? /^```ziaforge-work(?:\s|$)/ : /^```ziaforge-(phase|stage)(?:\s|$)/).test(message.text.trimStart())) return <section data-testid={`workflow-result-streaming-${message.id}`}>
    <p className="text-zinc-400">{label('Receiving the structured stage result…', 'Получаем структурированный результат этапа…')}</p>
    <Original message={message} label={label('Show original response so far', 'Показать полученную часть ответа')} />
  </section>
  if (!result) return <><MarkdownMessage text={message.text} /><Original message={message} label={label('Show original response', 'Показать исходный ответ')} /></>
  return <section className="space-y-3" data-testid={`workflow-result-${message.id}`}>
    <p className="text-[11px] font-medium text-zinc-400">{label('Agent result', 'Результат агента')} · {title}</p>
    {result.before && <MarkdownMessage text={result.before} />}
    <MarkdownMessage text={result.summary} />
    {result.kind === 'review' ? <>
      <p className={result.outcome === 'approved' ? 'text-emerald-300' : 'text-amber-200'}>{label("Reviewer's conclusion", 'Вывод ревьюера')}: {result.outcome === 'approved' ? label('Approved', 'Одобрено') : label('Changes requested', 'Нужны исправления')}</p>
      {result.findings.map((finding, index) => <article key={index} className="space-y-2 rounded border border-zinc-700 p-2">
        <p className="font-medium text-zinc-300">{finding.severity === 'blocking' ? label('Blocking finding', 'Блокирующее замечание') : label('Suggestion', 'Рекомендация')} · {finding.location}</p>
        <MarkdownMessage text={finding.evidence} /><MarkdownMessage text={finding.action} />
      </article>)}
    </> : <>
      {!!result.artifacts.length && <div className="space-y-2"><p className="font-medium text-zinc-300">{label('Documents in this response', 'Документы в этом ответе')}</p>{result.artifacts.map((artifact, index) => <details key={`${index}:${artifact.name}`} className="rounded border border-zinc-700 p-2" data-testid={`workflow-document-${message.id}-${index}`}>
        <summary className="cursor-pointer break-all font-medium text-orange-300">{artifact.name}</summary>
        <div className="mt-3"><MarkdownMessage text={artifact.content} /></div>
      </details>)}</div>}
      {!!result.questions.length && <div className="space-y-2"><p className="font-medium text-amber-200">{label('Questions for you', 'Вопросы к вам')}</p>{result.questions.map(question => <div key={question.id}><p className="whitespace-pre-wrap">{question.question}</p>{!!question.options?.length && <ul className="mt-1 list-disc pl-5 text-zinc-400">{question.options.map((option, index) => <li key={index}>{option}</li>)}</ul>}</div>)}</div>}
      {result.proposedSteps > 0 && <p className="text-zinc-400">{kind === 'work' ? label('Proposed steps', 'Предложенные шаги') : label('Proposed implementation steps', 'Предложено шагов реализации')}: {result.proposedSteps}</p>}
    </>}
    {result.after && <MarkdownMessage text={result.after} />}
    <p className="text-[11px] text-zinc-500">{kind === 'work' ? label('The Work panel shows saved documents, checks and decisions. This is the agent response.', 'Сохранённые документы, проверки и решения показаны в панели Work. Здесь ответ агента.') : label('The Plan panel shows saved documents, accepted checks and decisions. This is the agent response.', 'Сохранённые документы, принятые проверки и решения показаны в панели плана. Здесь ответ агента.')}</p>
    <Original message={message} label={label('Show original response', 'Показать исходный ответ')} />
  </section>
}
