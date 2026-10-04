import { uiText } from '../../uiText'
import { SpecializationSelect } from './SpecializationSelect'
import type { CodeProposedStep } from '../../../shared/code-flow'
import type { VerificationCommand } from '../../../shared/workflow'

const control = 'mt-1 w-full rounded border border-zinc-700 bg-[#111317] px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-50'
const button = 'rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40'
const shellQuote = (value: string) => /^[\w./=-]+$/.test(value) ? value : `'${value.replace(/'/g, `'"'"'`)}'`
const commandText = (command: VerificationCommand) => command.executable === '/bin/sh' && command.args[0] === '-lc' ? command.args[1] : [command.executable, ...command.args].map(shellQuote).join(' ')

/** The editable proposal is still data; only explicit approval authorizes these commands. */
export function CodePlanProposal({ steps, onChange, disabled, ru, workspace, maxSteps = 16 }: {
  steps: CodeProposedStep[]; onChange: (steps: CodeProposedStep[]) => void; disabled: boolean; ru: boolean; workspace: string; maxSteps?: number
}) {
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const update = (index: number, values: Partial<CodeProposedStep>) => onChange(steps.map((step, i) => i === index ? { ...step, ...values } : step))
  const move = (index: number, delta: number) => { const next = [...steps]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next) }
  return <fieldset className="space-y-3" disabled={disabled} data-testid="code-proposal-editor">
    {steps.map((step, index) => <article key={index} className="space-y-2 rounded border border-zinc-700 p-2 text-xs" data-testid={`code-proposed-step-${index}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{index + 1}. {step.title}</strong><div className="flex gap-1">
        <button type="button" className={button} disabled={disabled || index === 0} aria-label={uiText("Move step {value1} up", { value1: index + 1 }, ru ? 'ru' : undefined)} onClick={() => move(index, -1)}>↑</button>
        <button type="button" className={button} disabled={disabled || index === steps.length - 1} aria-label={uiText("Move step {value1} down", { value1: index + 1 }, ru ? 'ru' : undefined)} onClick={() => move(index, 1)}>↓</button>
        <button type="button" className={button} onClick={() => onChange(steps.filter((_, i) => i !== index))}>{label('Remove', 'Удалить')}</button>
      </div></div>
      <label className="block">{label('Title', 'Название')}<input className={control} value={step.title} maxLength={200} data-testid={`code-proposal-title-${index}`} onChange={event => update(index, { title: event.target.value })} /></label>
      <label className="block">{label('Instructions', 'Задание')}<textarea className={control} value={step.instructions} rows={3} maxLength={14000} data-testid={`code-proposal-instructions-${index}`} onChange={event => update(index, { instructions: event.target.value })} /></label>
      <label className="block">{label('Acceptance criteria (one per line)', 'Критерии готовности (по одному на строку)')}<textarea className={control} value={step.acceptance.join('\n')} rows={2} data-testid={`code-proposal-acceptance-${index}`} onChange={event => update(index, { acceptance: event.target.value.split('\n') })} /></label>
      <p className="text-[10px] text-zinc-500">{label('Up to 20 criteria, 3,000 characters each; up to 10 verification commands.', 'До 20 критериев по 3 000 символов; до 10 команд проверки.')}</p>
      <SpecializationSelect value={step.specialization} onChange={specialization => update(index, { specialization })} disabled={disabled} prefix={`code-proposal-specialization-${index}`} ru={ru} />
      {step.verification.map((command, commandIndex) => <div key={commandIndex} className="rounded border border-amber-700/30 bg-amber-500/5 p-2">
        <label className="block">{label('Verification command', 'Команда проверки')}<input className={`${control} font-mono`} value={commandText(command)} maxLength={8000} data-testid={`code-proposal-check-${index}-${commandIndex}`} onChange={event => update(index, { verification: step.verification.map((item, i) => i === commandIndex ? { executable: '/bin/sh', args: ['-lc', event.target.value], timeoutMs: item.timeoutMs } : item) })} /></label>
        <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] text-zinc-400">{JSON.stringify({ ...command, cwd: workspace }, null, 2)}</pre>
        <button type="button" className={`${button} mt-2`} onClick={() => update(index, { verification: step.verification.filter((_, i) => i !== commandIndex) })}>{label('Remove check', 'Удалить проверку')}</button>
      </div>)}
      <button type="button" className={button} disabled={disabled || step.verification.length >= 10} onClick={() => update(index, { verification: [...step.verification, { executable: '/bin/sh', args: ['-lc', ''], timeoutMs: 60000 }] })}>{label('Add check', 'Добавить проверку')}</button>
      {step.red && <div className="rounded border border-amber-700/30 p-2"><label className="block">{label('Red check (expected failure before implementation)', 'Red-проверка (ожидается падение до реализации)')}<input className={control} value={commandText(step.red)} maxLength={8000} onChange={event => update(index, { red: { executable: '/bin/sh', args: ['-lc', event.target.value], timeoutMs: step.red!.timeoutMs } })} /></label><pre className="mt-1 whitespace-pre-wrap break-all text-[10px]">{JSON.stringify({ ...step.red, cwd: workspace }, null, 2)}</pre><button type="button" className={`${button} mt-2`} onClick={() => update(index, { red: undefined })}>{label('Remove Red check', 'Удалить Red-проверку')}</button></div>}
    </article>)}
    {maxSteps === 1 && <p className="text-[10px] text-zinc-400">{label('Multi-model executes one consolidated implementation step. Edit its instructions and criteria to include every planned change.', 'Multi-model выполняет один сводный шаг реализации. Укажите все изменения в его задании и критериях готовности.')}</p>}
    <button type="button" className={button} disabled={disabled || steps.length >= maxSteps} data-testid="code-proposal-add" onClick={() => onChange([...steps, { title: '', instructions: '', acceptance: [], verification: [] }])}>{label('Add implementation step', 'Добавить шаг реализации')}</button>
  </fieldset>
}
