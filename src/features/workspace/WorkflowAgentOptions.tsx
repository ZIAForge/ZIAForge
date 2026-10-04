import type { SpecializationSelection } from '../../../shared/specializations'
import { SpecializationSelect } from './SpecializationSelect'
import { useStore } from '../../store'
import { useState } from 'react'
import type { AgentExecutionOptions } from '../../../shared/agent-models'
import type { WorkflowCustomAgentConfiguration } from '../../../shared/workflow'
import type { Preset, Task } from '../../store'
import { useTranslation } from '../../i18n'
import { AgentOptionsFields } from './AgentOptionsFields'
import { useModelCatalog } from './useModelCatalog'
import { configurationFromPreset, defaultPermissions, providerAgents, type ChatConfiguration } from './agentConfiguration'

/** Role overrides are explicit; collapsing the section does not change the saved policy. */
export function WorkflowAgentOptions({ preset, task, configuration, value, onChange, readOnly = false, disabled, prefix }: {
  preset?: Preset; task?: Task; value: AgentExecutionOptions & { specialization?: SpecializationSelection }; onChange: (next: AgentExecutionOptions & { specialization?: SpecializationSelection }) => void
  configuration?: WorkflowCustomAgentConfiguration
  readOnly?: boolean; disabled?: boolean; prefix: string
}) {
  const { t } = useTranslation()
  const ru = useStore(state => (state.settings?.uiLanguage ?? state.settings?.language ?? 'en').startsWith('ru'))
  const [open, setOpen] = useState(false)
  const provider = task?.agentProvider || 'codex'
  const inherited: ChatConfiguration | null = configuration ? { ...configuration, presetName: '' } : preset ? configurationFromPreset(preset) : task ? {
    presetName: '', provider, model: task.providerModel || 'auto', apiConnectionId: task.apiConnectionId,
    permissions: task.permissions || defaultPermissions(provider), reasoningEffort: task.reasoningEffort,
  } : null
  const effective = inherited && { ...inherited,
    permissions: readOnly ? inherited.provider === 'antigravity' ? 'CLI settings' : 'Read only' : value.permissions ?? inherited.permissions,
    reasoningEffort: value.reasoningEffort === undefined ? inherited.reasoningEffort : value.reasoningEffort,
  }
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="rounded border border-zinc-800 px-2 py-1.5" data-testid={`${prefix}-execution-options`}>
    <summary className="cursor-pointer text-[11px] text-zinc-400">{t('composer_options')} · {effective?.reasoningEffort ?? t('composer_provider_default')}{readOnly ? ` · ${t(effective?.provider === 'antigravity' ? 'cli_settings' : 'read_only')}` : ''}</summary>
    {open && effective && <div className="space-y-2 pt-3"><RoleFields value={effective} onChange={next => onChange(readOnly ? { reasoningEffort: next.reasoningEffort, specialization: value.specialization } : { reasoningEffort: next.reasoningEffort, permissions: next.permissions, specialization: value.specialization })} readOnly={readOnly} disabled={disabled} prefix={prefix} />
      <SpecializationSelect value={value.specialization} onChange={specialization => onChange({ ...value, specialization })} disabled={disabled} prefix={`${prefix}-specialization`} ru={ru} />
      <button type="button" className="text-[11px] text-zinc-400 underline disabled:opacity-40" disabled={disabled} onClick={() => onChange({ reasoningEffort: undefined, permissions: undefined, specialization: undefined })}>{t('composer_inherit_preset')}</button>
    </div>}
    {open && !effective && <p className="py-2 text-[11px] text-zinc-500">{t('agent_chat_select_preset')}</p>}
  </details>
}
function RoleFields({ value, onChange, readOnly, disabled, prefix }: { value: ChatConfiguration; onChange: (next: ChatConfiguration) => void; readOnly: boolean; disabled?: boolean; prefix: string }) {
  const { catalog } = useModelCatalog(providerAgents[value.provider], value.apiConnectionId)
  return <AgentOptionsFields value={value} onChange={onChange} catalog={catalog} readOnlyPermissions={readOnly} disabled={disabled} prefix={prefix} />
}
