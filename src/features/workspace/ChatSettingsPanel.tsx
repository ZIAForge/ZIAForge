import { useEffect, useMemo, useState } from 'react'
import type { ApiConnection } from '../../../shared/api-provider'
import type { AgentSessionProvider } from '../../../shared/agent-session'
import type { Preset } from '../../../shared/legacy-ipc'
import { useTranslation } from '../../i18n'
import { ModelCatalogInput, type ModelCatalogLoader } from './ModelCatalogInput'
import type { AgentModelCatalog } from '../../../shared/agent-models'
import { AgentOptionsFields } from './AgentOptionsFields'
import { configurationForProvider, configurationFromPreset, presetProvider, providerAgents, type ChatConfiguration } from './agentConfiguration'
export type { ChatConfiguration } from './agentConfiguration'

interface Props {
  current: ChatConfiguration
  presets: Preset[]
  busy: boolean
  applying: boolean
  onApply: (configuration: ChatConfiguration) => Promise<void>
  onClose: () => void
  loadModels?: (agent: string) => Promise<string[]>
}

export function AgentSelectionFields({ value, onChange, presets, disabled, prefix = 'agent-chat', loadCatalog, showPreset = true }: { value: ChatConfiguration; onChange: (value: ChatConfiguration) => void; presets: Preset[]; disabled?: boolean; prefix?: string; loadCatalog?: ModelCatalogLoader; showPreset?: boolean }) {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<ApiConnection[]>([])
  const [connectionsError, setConnectionsError] = useState(false)
  const [catalog, setCatalog] = useState<AgentModelCatalog | null>(null)
  useEffect(() => {
    if (value.provider !== 'api') return
    let current = true
    setConnectionsError(false)
    void Promise.resolve().then(() => window.ziafAPI.apiConnections.list()).then(items => {
      if (current) setConnections(items)
    }).catch(() => { if (current) { setConnections([]); setConnectionsError(true) } })
    return () => { current = false }
  }, [value.provider])
  const available = presets.filter(preset => presetProvider(preset))
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {showPreset && <label className="flex min-w-0 flex-col gap-1 text-zinc-400">{t('agent_chat_preset')}
      <select data-testid={`${prefix}-preset`} disabled={disabled} value={value.presetName} onChange={event => {
        const preset = available.find(item => item.name === event.target.value)
        if (preset) onChange(configurationFromPreset(preset))
        else if (event.target.value === '') onChange({ ...value, presetName: '' })
      }} className="min-w-0 rounded border border-[#2b2e33] bg-[#0b0c0e] p-2 text-zinc-200">
        <option value="">{t('agent_chat_direct_cli')}</option>
        {value.presetName && !available.some(preset => preset.name === value.presetName) && <option value={value.presetName}>{value.presetName}</option>}
        {available.map(preset => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
      </select>
    </label>}
    <label className="flex min-w-0 flex-col gap-1 text-zinc-400">{t('coding_agent')}
      <select data-testid={`${prefix}-provider`} disabled={disabled} value={value.provider} onChange={event => onChange(configurationForProvider(event.target.value as AgentSessionProvider))} className="rounded border border-[#2b2e33] bg-[#0b0c0e] p-2 text-zinc-200">
        {Object.entries(providerAgents).map(([provider, label]) => <option key={provider} value={provider}>{label}</option>)}
      </select>
    </label>
    {value.provider === 'api' && <label className="flex min-w-0 flex-col gap-1 text-zinc-400">{t('agent_chat_api_connection')}
      <select data-testid={`${prefix}-api-connection`} disabled={disabled} value={value.apiConnectionId || ''} onChange={event => {
        const connection = connections.find(item => item.id === event.target.value)
        onChange({ ...value, presetName: '', apiConnectionId: connection?.id, model: connection?.model || value.model })
      }} className="rounded border border-[#2b2e33] bg-[#0b0c0e] p-2 text-zinc-200">
        <option value="">{t('agent_chat_select_connection')}</option>
        {value.apiConnectionId && !connections.some(item => item.id === value.apiConnectionId) && <option value={value.apiConnectionId}>{t('agent_chat_connection_unavailable')}</option>}
        {connections.map(item => <option key={item.id} value={item.id} disabled={!item.enabled}>{item.name}{item.enabled ? '' : ` (${t('agent_chat_connection_disabled')})`}</option>)}
      </select>
      {(connectionsError || !connections.length) && <span role="status" className="text-amber-300">{t('agent_chat_connections_hint')}</span>}
    </label>}
    <div className="flex min-w-0 flex-col gap-1 text-zinc-400"><label>{t('agent_chat_model')}</label><ModelCatalogInput agent={providerAgents[value.provider] || value.provider} apiConnectionId={value.apiConnectionId} value={value.model} onChange={model => onChange({ ...value, model })} disabled={disabled} testId={`${prefix}-model`} loadCatalog={loadCatalog} onCatalog={setCatalog} /></div>
    <div className="sm:col-span-2"><AgentOptionsFields value={value} onChange={onChange} catalog={catalog?.agent === providerAgents[value.provider] ? catalog : null} disabled={disabled} prefix={prefix} /></div>
  </div>
}

/** Edits a proposal; the active configuration changes only after backend acknowledgement. */
export function ChatSettingsPanel({ current, presets, busy, applying, onApply, onClose, loadModels }: Props) {
  const { t } = useTranslation()
  const [selection, setSelection] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const loadCatalog = useMemo<ModelCatalogLoader | undefined>(() => loadModels ? async agent => ({ agent, models: (await loadModels(agent)).map(id => ({ id, label: id })), status: 'ready', source: 'cli', command: agent, queriedAt: Date.now() }) : undefined, [loadModels])
  const submit = async () => {
    if (busy || applying || (selection.provider === 'api' && !selection.apiConnectionId)) return
    setError(null)
    try { await onApply({ ...selection, model: selection.model.trim() || 'auto' }) }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
  }
  return <section aria-label={t('agent_chat_settings')} data-testid="agent-chat-settings" className="shrink-0 border-b border-[#2b2e33] bg-[#141619] p-4 text-xs">
    <div className="mb-3 flex items-center justify-between"><strong>{t('agent_chat_settings')}</strong><button type="button" onClick={onClose} disabled={applying} className="text-zinc-400 disabled:opacity-40">{t('close')}</button></div>
    <AgentSelectionFields value={selection} onChange={setSelection} presets={presets} disabled={applying} loadCatalog={loadCatalog} />
    <p className="mt-3 text-zinc-400">{t(busy ? 'agent_chat_wait_idle' : 'agent_chat_apply_hint')}</p>
    {presetProvider(presets.find(item => item.name === selection.presetName)) !== selection.provider && <p className="mt-2 text-amber-300">{t('agent_chat_provider_policy')}</p>}
    {error && <p role="alert" className="mt-2 text-rose-300">{error}</p>}
    <div className="mt-3 flex justify-end"><button type="button" data-testid="agent-chat-apply" disabled={busy || applying || (selection.provider === 'api' && !selection.apiConnectionId)} onClick={() => void submit()} className="rounded bg-[#ff6b00] px-3 py-2 font-semibold text-white disabled:opacity-40">{t(applying ? 'agent_chat_applying' : 'agent_chat_apply')}</button></div>
  </section>
}
