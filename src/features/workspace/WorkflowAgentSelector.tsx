import type { SpecializationSelection } from '../../../shared/specializations'
import { useEffect, useState } from 'react'
import type { WorkflowCustomAgentConfiguration } from '../../../shared/workflow'
import type { AgentExecutionOptions } from '../../../shared/agent-models'
import type { AgentSessionProvider } from '../../../shared/agent-session'
import type { ApiConnection } from '../../../shared/api-provider'
import type { Preset, Task } from '../../store'
import { useTranslation } from '../../i18n'
import { configurationForProvider, configurationFromPreset, defaultPermissions, providerAgents } from './agentConfiguration'
import { ModelCatalogInput } from './ModelCatalogInput'
import { WorkflowAgentOptions } from './WorkflowAgentOptions'

export interface WorkflowAgentSelection extends AgentExecutionOptions {
  presetName: string
  specialization?: SpecializationSelection
  configuration?: WorkflowCustomAgentConfiguration
}
const control = 'mt-1 w-full rounded border border-zinc-700 bg-[#111317] px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-50'

/** Role selection is independent of other roles; source IDs own their sessions. */
export function WorkflowAgentSelector({ value, onChange, presets, task, label, prefix, readOnly = false, disabled, inherit, providers }: {
  value: WorkflowAgentSelection; onChange: (next: WorkflowAgentSelection) => void
  presets: Preset[]; task?: Task; providers?: AgentSessionProvider[]; label: string; prefix: string; readOnly?: boolean; disabled?: boolean
  inherit?: WorkflowAgentSelection
}) {
  const { t } = useTranslation()
  const change = (next: WorkflowAgentSelection) => onChange({ reasoningEffort: undefined, permissions: undefined, specialization: value.specialization, ...next })
  const selected = value.presetName || !inherit ? value : { ...inherit,
    reasoningEffort: value.reasoningEffort === undefined ? inherit.reasoningEffort : value.reasoningEffort,
    permissions: value.permissions ?? inherit.permissions,
    specialization: value.specialization ?? inherit.specialization,
  }
  const preset = presets.find(item => item.name === selected.presetName)
  const custom = selected.presetName === '@custom' ? selected.configuration : undefined
  const taskPreset = presets.find(item => item.name === task?.model)
  const taskBase = taskPreset && configurationFromPreset(taskPreset)
  const taskProvider = task?.agentProvider ?? taskBase?.provider ?? 'codex'
  const taskProviderChanged = !taskBase || taskProvider !== taskBase.provider
  const taskConfiguration: WorkflowCustomAgentConfiguration = {
    provider: taskProvider, model: task?.providerModel ?? (taskProviderChanged ? 'auto' : taskBase.model),
    apiConnectionId: taskProvider === 'api' ? task?.apiConnectionId ?? (taskBase?.provider === 'api' ? taskBase.apiConnectionId : undefined) : undefined,
    permissions: task?.permissions ?? (taskProviderChanged ? defaultPermissions(taskProvider) : taskBase.permissions),
    reasoningEffort: task?.reasoningEffort !== undefined ? task?.reasoningEffort : taskProviderChanged ? undefined : taskBase.reasoningEffort,
  }
  const base = custom ?? (preset ? configurationFromPreset(preset) : taskConfiguration)
  const effective: WorkflowCustomAgentConfiguration = {
    provider: base.provider, model: base.model, apiConnectionId: base.apiConnectionId,
    reasoningEffort: selected.reasoningEffort === undefined ? base.reasoningEffort : selected.reasoningEffort,
    permissions: readOnly ? base.provider === 'antigravity' ? 'CLI settings' : 'Read only' : selected.permissions ?? base.permissions,
  }
  return <div className="space-y-2">
    <label className="block text-xs text-zinc-400">{label}<select className={control} aria-label={label} disabled={disabled} value={value.presetName} data-testid={inherit ? `${prefix}-preset` : prefix} onChange={event => {
      const presetName = event.target.value
      change({ presetName, configuration: presetName === '@custom' ? effective : undefined, ...(presetName === '@custom' ? { specialization: selected.specialization ?? preset?.specialization } : {}) })
    }}>
      <option value="">{t(inherit ? 'workflow_inherit_agent' : 'agent_chat_select_preset')}</option>
      {task && <option value="@task" disabled={providers && !providers.includes(taskProvider)}>{t('workflow_task_agent')}</option>}
      <option value="@custom">{t('composer_custom')}</option>
      {value.presetName && !['@task', '@custom'].includes(value.presetName) && !presets.some(item => item.name === value.presetName) && <option value={value.presetName}>{value.presetName}</option>}
      {presets.map(item => <option key={item.name} value={item.name} disabled={providers && !providers.includes(configurationFromPreset(item).provider)}>{item.name}</option>)}
    </select></label>
    {value.presetName === '@custom' && <CustomAgentFields value={effective} providers={providers} readOnly={readOnly} disabled={disabled} prefix={prefix} onChange={configuration => change({ presetName: '@custom', configuration })} />}
    <WorkflowAgentOptions preset={preset} task={selected.presetName === '@task' ? task : undefined} configuration={custom ?? (selected.presetName === '@task' ? taskConfiguration : undefined)}
      value={{ reasoningEffort: selected.reasoningEffort, permissions: selected.permissions, specialization: selected.specialization ?? preset?.specialization }} readOnly={readOnly} disabled={disabled} prefix={prefix}
      onChange={options => change(value.presetName === '@custom' ? { presetName: '@custom', specialization: options.specialization, configuration: { ...effective, reasoningEffort: options.reasoningEffort, permissions: options.permissions ?? effective.permissions } } : { ...value, ...options })} />
    {readOnly && (preset || custom || selected.presetName === '@task') && <p data-testid={`${prefix}-access-hint`} className="text-[10px] leading-relaxed text-zinc-400">{t(effective.provider === 'antigravity' ? 'workflow_native_review_hint' : 'workflow_read_only_hint')}</p>}
  </div>
}

function CustomAgentFields({ value, onChange, readOnly, disabled, prefix, providers }: {
  value: WorkflowCustomAgentConfiguration; onChange: (next: WorkflowCustomAgentConfiguration) => void
  readOnly: boolean; disabled?: boolean; prefix: string; providers?: AgentSessionProvider[]
}) {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<ApiConnection[]>([])
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (value.provider !== 'api') return
    let current = true
    setFailed(false)
    void Promise.resolve().then(() => window.ziafAPI.apiConnections.list()).then(items => { if (current) setConnections(items) }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [value.provider])
  return <div className="space-y-3 rounded border border-zinc-800 p-2" data-testid={`${prefix}-custom`}>
    <label className="block text-xs text-zinc-400">{t('coding_agent')}<select className={control} value={value.provider} data-testid={`${prefix}-provider`} disabled={disabled} onChange={event => {
      const provider = event.target.value as AgentSessionProvider
      const { model, permissions, reasoningEffort } = configurationForProvider(provider)
      onChange({ provider, model, reasoningEffort, permissions: readOnly ? provider === 'antigravity' ? 'CLI settings' : 'Read only' : permissions })
    }}>{Object.entries(providerAgents).map(([id, name]) => <option key={id} value={id} disabled={providers && !providers.includes(id as AgentSessionProvider)}>{name}</option>)}</select></label>
    {value.provider === 'api' && <label className="block text-xs text-zinc-400">{t('agent_chat_api_connection')}<select className={control} data-testid={`${prefix}-api-connection`} disabled={disabled} value={value.apiConnectionId || ''} onChange={event => {
      const connection = connections.find(item => item.id === event.target.value)
      onChange({ ...value, apiConnectionId: connection?.id, model: connection?.model || 'auto' })
    }}><option value="">{t('agent_chat_select_connection')}</option>{value.apiConnectionId && !connections.some(item => item.id === value.apiConnectionId) && <option value={value.apiConnectionId}>{t('agent_chat_connection_unavailable')}</option>}{connections.map(item => <option key={item.id} value={item.id} disabled={!item.enabled}>{item.name}</option>)}</select>{(failed || !connections.length) && <span className="mt-1 block text-amber-300">{t('agent_chat_connections_hint')}</span>}</label>}
    <div className="text-xs"><span className="mb-1 block text-zinc-400">{t('agent_chat_model')}</span><ModelCatalogInput agent={providerAgents[value.provider]} apiConnectionId={value.apiConnectionId} value={value.model} onChange={model => onChange({ ...value, model })} disabled={disabled} testId={`${prefix}-model`} /></div>
  </div>
}
