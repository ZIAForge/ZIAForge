import { uiText } from '../../uiText'
import type { CodeFlowDefinition } from '../../../shared/code-flow'
import type { WorkflowPlan, WorkflowReviewSource } from '../../../shared/workflow'
import type { Preset, Task } from '../../store'
import { WorkflowAgentSelector } from './WorkflowAgentSelector'

type Multi = NonNullable<CodeFlowDefinition['multi']>
const button = 'rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40'
const control = 'w-full rounded border border-zinc-700 bg-[#111317] px-2 py-1.5 text-xs'

/** Editing role references does not rewrite presets or start native sessions. */
export function MultiRoleSettings({ plan, task, presets, ru, disabled, onChange }: {
  plan: WorkflowPlan; task: Task; presets: Preset[]; ru: boolean; disabled: boolean; onChange: (update: Partial<Multi>) => void
}) {
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const multi = plan.codeFlow?.multi
  const planner: WorkflowReviewSource = plan.codeFlow?.planner ?? { id: 'planner', presetName: '@task' }
  const coordinator = multi?.reviewCoordinator ?? plan.reviewers?.[0] ?? { id: 'coordinator', presetName: plan.reviewerPreset || '@task', configuration: plan.reviewerConfiguration, reasoningEffort: plan.reviewerReasoningEffort }
  const source = () => ({ ...planner, id: `multi-source-${crypto.randomUUID()}` })
  const instructions = label('Inspect relevant files and report concrete evidence without changing them.', 'Изучите относящиеся к задаче файлы и сообщите конкретные факты без изменения файлов.')
  return <div className="space-y-3 border-t border-zinc-800 pt-3" data-testid="workflow-multi-roles">
    <label className="block space-y-1 text-xs text-zinc-400"><span>{label('Review start policy', 'Политика запуска ревью')}</span>
      <select className={control} value={multi?.reviewDecision ?? 'auto'} disabled={disabled} onChange={event => onChange({ reviewDecision: event.target.value as Multi['reviewDecision'] })} data-testid="workflow-multi-review-decision">
        <option value="auto">{label('Decide from the result', 'По результату работы')}</option><option value="always">{label('Always review', 'Всегда проводить ревью')}</option><option value="never">{label('Skip review', 'Пропустить ревью')}</option>
      </select>
    </label>
    <p className="text-[10px] text-zinc-500">{label('Independent contexts use your configured agents. Defaults do not silently choose another model.', 'Независимые контексты используют выбранных вами агентов. Настройки по умолчанию не подменяют модель.')}</p>
    <WorkflowAgentSelector task={task} presets={presets} label={label('Review coordinator', 'Координатор ревью')} prefix="workflow-multi-coordinator" readOnly disabled={disabled} value={coordinator}
      onChange={next => onChange({ reviewCoordinator: { ...next, id: multi?.reviewCoordinator?.id ?? `multi-coordinator-${crypto.randomUUID()}` } })} />
    {multi?.reviewCoordinator && <button type="button" className={button} disabled={disabled} onClick={() => onChange({ reviewCoordinator: undefined })}>{label('Inherit first reviewer', 'Наследовать первого ревьюера')}</button>}
    <div className="space-y-2" data-testid="workflow-multi-explorers">
      <p className="text-xs text-zinc-400">{label('Exploration contexts', 'Контексты исследования')}</p>
      {!multi?.explorers ? <><p className="text-[10px] text-zinc-500">{label('Default: saved helpers, or two independent contexts using the planner selection.', 'По умолчанию: сохранённые помощники либо два независимых контекста с настройками планировщика.')}</p>
        <button type="button" className={button} disabled={disabled} data-testid="workflow-multi-custom-explorers" onClick={() => onChange({ explorers: plan.helpers?.length ? plan.helpers.map(item => ({ ...item, id: `multi-source-${crypto.randomUUID()}` })) : Array.from({ length: 2 }, () => ({ ...source(), instructions })) })}>{label('Configure explorers', 'Настроить исследователей')}</button></>
        : <>{multi.explorers.map((item, index) => <div key={item.id} className="space-y-2 rounded border border-zinc-800 p-2">
          <WorkflowAgentSelector task={task} presets={presets} label={uiText("Explorer {value1}", { value1: index + 1 }, ru ? 'ru' : undefined)} prefix={`workflow-multi-explorer-${index}`} value={item} readOnly disabled={disabled}
            onChange={next => onChange({ explorers: multi.explorers!.map(row => row.id === item.id ? { ...next, id: row.id, instructions: row.instructions } : row) })} />
          <textarea className={control} value={item.instructions} disabled={disabled} aria-label={uiText("Explorer instructions {value1}", { value1: index + 1 }, ru ? 'ru' : undefined)} onChange={event => onChange({ explorers: multi.explorers!.map(row => row.id === item.id ? { ...row, instructions: event.target.value } : row) })} />
          <button type="button" className={button} disabled={disabled || multi.explorers!.length <= 1} onClick={() => onChange({ explorers: multi.explorers!.filter(row => row.id !== item.id) })}>{label('Remove explorer', 'Удалить исследователя')}</button>
        </div>)}<button type="button" className={button} disabled={disabled || multi.explorers.length >= 6} onClick={() => onChange({ explorers: [...multi.explorers!, { ...source(), instructions }] })}>{label('Add explorer', 'Добавить исследователя')}</button>{' '}
          <button type="button" className={button} disabled={disabled} onClick={() => onChange({ explorers: undefined })}>{label('Use default explorers', 'Исследователи по умолчанию')}</button></>}
    </div>
    <div className="space-y-2" data-testid="workflow-multi-designers">
      <p className="text-xs text-zinc-400">{label('Design contexts', 'Контексты проектирования')}</p>
      {!multi?.designers ? <><p className="text-[10px] text-zinc-500">{label('Default: three independent contexts using the planner selection.', 'По умолчанию: три независимых контекста с настройками планировщика.')}</p>
        <button type="button" className={button} disabled={disabled} data-testid="workflow-multi-custom-designers" onClick={() => onChange({ designers: Array.from({ length: 3 }, source) })}>{label('Configure designers', 'Настроить проектировщиков')}</button></>
        : <>{multi.designers.map((item, index) => <div key={item.id} className="space-y-2 rounded border border-zinc-800 p-2">
          <WorkflowAgentSelector task={task} presets={presets} label={uiText("Designer {value1}", { value1: index + 1 }, ru ? 'ru' : undefined)} prefix={`workflow-multi-designer-${index}`} value={item} readOnly disabled={disabled}
            onChange={next => onChange({ designers: multi.designers!.map(row => row.id === item.id ? { ...next, id: row.id } : row) })} />
          <button type="button" className={button} disabled={disabled || multi.designers!.length <= 1} onClick={() => onChange({ designers: multi.designers!.filter(row => row.id !== item.id) })}>{label('Remove designer', 'Удалить проектировщика')}</button>
        </div>)}<button type="button" className={button} disabled={disabled || multi.designers.length >= 3} onClick={() => onChange({ designers: [...multi.designers!, source()] })}>{label('Add designer', 'Добавить проектировщика')}</button>{' '}
          <button type="button" className={button} disabled={disabled} onClick={() => onChange({ designers: undefined })}>{label('Use default designers', 'Проектировщики по умолчанию')}</button></>}
    </div>
  </div>
}
