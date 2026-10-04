import { uiText } from '../../uiText'
import { SPECIALIZATIONS, type SpecializationSelection } from '../../../shared/specializations'

export function SpecializationSelect({ value, onChange, disabled, prefix = 'specialization', ru = false }: {
  value?: SpecializationSelection; onChange: (value: SpecializationSelection | undefined) => void; disabled?: boolean; prefix?: string; ru?: boolean
}) {
  const mode = value?.mode ?? 'none'
  return <div className="space-y-2 text-xs" data-testid={prefix}>
    <label className="block text-zinc-400">{uiText("Prompt specialization", undefined, (ru) ? 'ru' : undefined)}<select className="mt-1 w-full rounded border border-zinc-700 bg-[#111317] p-2 text-zinc-100" disabled={disabled} value={mode} data-testid={`${prefix}-mode`} onChange={event => {
      const next = event.target.value as SpecializationSelection['mode']
      onChange(next === 'manual' ? { mode: next, ids: ['general'] } : { mode: next })
    }}>{[['none', uiText("None", undefined, (ru) ? 'ru' : undefined)], ['standard', uiText("Standard", undefined, (ru) ? 'ru' : undefined)], ['auto', uiText("Auto by task", undefined, (ru) ? 'ru' : undefined)], ['manual', uiText("Manual", undefined, (ru) ? 'ru' : undefined)]].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    {mode === 'manual' && <>
      <div className="grid grid-cols-1 gap-1">{SPECIALIZATIONS.map(item => <label key={item.id} className="flex items-center gap-2"><input type="checkbox" disabled={disabled || !value?.ids?.includes(item.id) && (value?.ids?.length ?? 0) >= 4} checked={value?.ids?.includes(item.id) ?? false} onChange={event => onChange({ ...value!, mode: 'manual', ids: event.target.checked ? [...value?.ids ?? [], item.id] : value?.ids?.filter(id => id !== item.id) })} />{uiText(item.name, undefined, ru ? 'ru' : undefined)}</label>)}</div>
      <textarea rows={3} maxLength={4000} className="w-full rounded border border-zinc-700 bg-[#111317] p-2 text-zinc-100" disabled={disabled} value={value?.instructions ?? ''} aria-label={uiText("Custom specialist guidance", undefined, (ru) ? 'ru' : undefined)} placeholder={uiText("Additional guidance (optional)", undefined, (ru) ? 'ru' : undefined)} onChange={event => onChange({ ...value!, mode: 'manual', instructions: event.target.value || undefined })} />
    </>}
    {mode === 'auto' && <p className="text-[10px] text-zinc-500">{uiText("Profiles are selected from the current step text without an additional model call.", undefined, (ru) ? 'ru' : undefined)}</p>}
    {mode !== 'none' && <p className="text-[10px] text-zinc-500">{uiText("Role guidance only; access, verification and approvals stay unchanged.", undefined, (ru) ? 'ru' : undefined)}</p>}
  </div>
}
