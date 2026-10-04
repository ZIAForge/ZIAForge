import { uiText } from '../../uiText'
import type { ReviewTeamPreset } from '../../../shared/review-team'
import type { Preset, Task } from '../../store'
import { WorkflowAgentSelector } from './WorkflowAgentSelector'

export function ReviewTeamEditor({ value, onChange, presets, task, ru = false, disabled = false }: {
  value: ReviewTeamPreset; onChange: (value: ReviewTeamPreset) => void; presets: Preset[]; task?: Task; ru?: boolean; disabled?: boolean
}) {
  return <fieldset disabled={disabled} className="space-y-3 rounded border border-zinc-700 p-3" data-testid="review-team-editor">
    <label className="block text-xs text-zinc-400">{uiText("Team name", undefined, (ru) ? 'ru' : undefined)}<input className="mt-1 w-full rounded border border-zinc-700 bg-[#111317] p-2" maxLength={200} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></label>
    <p className="text-[11px] text-zinc-400">{uiText("Reviewers run in parallel in separate contexts. The architect receives anonymous reports only, without source access or tools. Any failed report or blocking finding prevents advancement.", undefined, (ru) ? 'ru' : undefined)}</p>
    {value.reviewers.map((source, index) => <div key={source.id} className="space-y-2 border-b border-zinc-800 pb-3">
      <WorkflowAgentSelector presets={presets} task={task} prefix={`team-reviewer-${index}`} label={uiText("Reviewer {value1}", { value1: index + 1 }, (ru) ? 'ru' : undefined)} value={source} readOnly disabled={disabled} onChange={next => onChange({ ...value, reviewers: value.reviewers.map(item => item.id === source.id ? { ...next, id: item.id } : item) })} />
      <button type="button" className="text-xs text-zinc-400 underline disabled:opacity-40" disabled={disabled || value.reviewers.length <= 1} onClick={() => onChange({ ...value, reviewers: value.reviewers.filter(item => item.id !== source.id) })}>{uiText("Remove reviewer", undefined, (ru) ? 'ru' : undefined)}</button>
    </div>)}
    <button type="button" className="rounded border border-zinc-700 p-2 text-xs disabled:opacity-40" disabled={disabled || value.reviewers.length >= 8} onClick={() => onChange({ ...value, reviewers: [...value.reviewers, { id: `reviewer-${crypto.randomUUID()}`, presetName: task ? '@task' : presets[0]?.name ?? '@custom', ...(!task && !presets.length ? { configuration: { provider: 'claude' as const, model: 'auto', permissions: 'Read only' } } : {}) }] })}>{uiText("Add reviewer", undefined, (ru) ? 'ru' : undefined)}</button>
    <WorkflowAgentSelector presets={presets} task={task} prefix="team-architect" label={uiText("Report architect", undefined, (ru) ? 'ru' : undefined)} value={value.architect} readOnly disabled={disabled} providers={['claude', 'api']} onChange={next => onChange({ ...value, architect: { ...next, id: value.architect.id } })} />
    <p className="text-[10px] text-zinc-500">{uiText("The architect supports Claude and API with enforced tool denial. Codex and Antigravity do not currently provide this contract; there is no automatic substitution.", undefined, (ru) ? 'ru' : undefined)}</p>
  </fieldset>
}
