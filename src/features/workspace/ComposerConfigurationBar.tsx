import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Cpu, Plus, Settings2, SlidersHorizontal } from 'lucide-react'
import type { Preset } from '../../../shared/legacy-ipc'
import type { AgentSessionProvider } from '../../../shared/agent-session'
import type { ApiConnection } from '../../../shared/api-provider'
import { useStore } from '../../store'
import { useTranslation } from '../../i18n'
import { ConfigurationPopover } from './ConfigurationPopover'
import { ModelCatalogInput } from './ModelCatalogInput'
import { useModelCatalog } from './useModelCatalog'
import { AgentOptionsFields } from './AgentOptionsFields'
import { PresetEditorDialog } from './PresetEditorDialog'
import { configurationForProvider, configurationFromPreset, defaultPermissions, permissionLabelKey, presetProvider, providerAgents, type ChatConfiguration } from './agentConfiguration'

type Menu = 'preset' | 'provider' | 'model' | 'options'
const segment = 'flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-[11px] text-zinc-300 transition-colors hover:bg-[#2a2b30] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-40'

function ProviderFields({ value, onChange, disabled }: { value: ChatConfiguration; onChange: (next: ChatConfiguration) => void; disabled: boolean }) {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<ApiConnection[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    if (value.provider !== 'api') return
    let current = true
    void Promise.resolve().then(() => window.ziafAPI.apiConnections.list()).then(items => { if (current) setConnections(items) }).catch(() => { if (current) setError(true) })
    return () => { current = false }
  }, [value.provider])
  const selectedConnection = connections.find(item => item.id === value.apiConnectionId)
  return <div className="space-y-3">
    <label className="block text-zinc-400">{t('coding_agent')}<select data-testid="agent-chat-provider" disabled={disabled} value={value.provider} onChange={event => onChange(configurationForProvider(event.target.value as AgentSessionProvider))} className="mt-2 w-full rounded-md border border-[#34363c] bg-[#111215] p-2.5 text-zinc-100">{Object.entries(providerAgents).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    {value.provider === 'api' && <label className="block text-zinc-400">{t('agent_chat_api_connection')}<select data-testid="agent-chat-api-connection" disabled={disabled} value={value.apiConnectionId || ''} onChange={event => { const item = connections.find(connection => connection.id === event.target.value); onChange({ ...value, apiConnectionId: item?.id, model: item?.model || 'auto' }) }} className="mt-2 w-full rounded-md border border-[#34363c] bg-[#111215] p-2.5 text-zinc-100"><option value="">{t('agent_chat_select_connection')}</option>{value.apiConnectionId && !connections.some(item => item.id === value.apiConnectionId) && <option value={value.apiConnectionId}>{t('agent_chat_connection_unavailable')}</option>}{connections.map(item => <option key={item.id} value={item.id} disabled={!item.enabled}>{item.name}</option>)}</select>{(error || !connections.length) && <span className="mt-2 block text-amber-300">{t('agent_chat_connections_hint')}</span>}</label>}
    {value.provider === 'api' && selectedConnection && <div className="space-y-2 text-xs text-zinc-400" data-testid="agent-chat-api-connection-protocol">
      <p>{selectedConnection.transport === 'responses' ? 'Responses' : 'Chat Completions'}</p>
      <p>{t(selectedConnection.transport === 'responses' ? 'api_responses_hint' : 'api_chat_completions_hint')}</p>
      <button type="button" className="text-orange-400 hover:underline" disabled={disabled} onClick={() => useStore.getState().setActiveTab('connections')}>{t('api_open_connections')}</button>
      <p>{t('api_connection_apply_hint')}</p>
    </div>}
  </div>
}

function Options({ value, onChange, disabled }: { value: ChatConfiguration; onChange: (next: ChatConfiguration) => void; disabled: boolean }) {
  const { t } = useTranslation()
  const { catalog, loading } = useModelCatalog(providerAgents[value.provider], value.apiConnectionId)
  return <><AgentOptionsFields value={value} onChange={onChange} disabled={disabled} catalog={catalog} />{loading && <p role="status" className="mt-3 text-[10px] text-zinc-400">{t('agent_chat_loading_models')}</p>}</>
}

/** Compact proposals stay in the Composer; only an acknowledged mutation becomes current. */
export function ComposerConfigurationBar({ current, presets, busy, applying, disabled = false, reportedError, onApply }: {
  current: ChatConfiguration; presets: Preset[]; busy: boolean; applying: boolean; disabled?: boolean; reportedError?: string | null
  onApply: (configuration: ChatConfiguration) => Promise<void>
}) {
  const { t } = useTranslation()
  const [menu, setMenu] = useState<Menu | null>(null)
  const [proposal, setProposal] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [creating, setCreating] = useState(false)
  const pendingRef = useRef(false)
  const mounted = useRef(false)
  const presetAnchor = useRef<HTMLButtonElement>(null)
  const providerAnchor = useRef<HTMLButtonElement>(null)
  const modelAnchor = useRef<HTMLButtonElement>(null)
  const optionsAnchor = useRef<HTMLButtonElement>(null)
  const anchors = { preset: presetAnchor, provider: providerAnchor, model: modelAnchor, options: optionsAnchor }
  const identity = JSON.stringify(current)
  useEffect(() => { setProposal(JSON.parse(identity) as ChatConfiguration) }, [identity])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const close = useCallback((restore = false) => {
    const target = menu === 'preset' ? presetAnchor : menu === 'provider' ? providerAnchor : menu === 'model' ? modelAnchor : optionsAnchor
    setMenu(null)
    if (restore) target.current?.focus({ preventScroll: true })
  }, [menu])
  const blocked = busy || applying || pending || disabled
  const apply = async (next: ChatConfiguration) => {
    if (blocked || pendingRef.current) return
    const initiatingFocus = document.activeElement
    pendingRef.current = true; setPending(true); setError(null)
    try { await onApply({ ...next, model: next.model.trim() || 'auto' }); if (mounted.current) { setProposal(next); close(document.activeElement === initiatingFocus) } }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { pendingRef.current = false; if (mounted.current) setPending(false) }
  }
  const custom = !current.presetName
  const dirty = JSON.stringify(proposal) !== identity
  const summary = `${providerAgents[current.provider]} · ${current.model} · ${t(permissionLabelKey(current.permissions || defaultPermissions(current.provider)))} · ${current.reasoningEffort ?? t('composer_provider_default')}`
  const open = (kind: Menu) => { if (!disabled && !applying && !pending) { setMenu(previous => previous === kind ? null : kind); setError(null) } }
  const initialPreset: Preset = { name: '', agent: providerAgents[proposal.provider], model: proposal.model, permissions: proposal.permissions || defaultPermissions(proposal.provider), reasoningEffort: proposal.reasoningEffort, apiConnectionId: proposal.apiConnectionId }
  return <div className="min-w-0 max-w-full" data-testid="composer-configuration-bar">
    <div className="inline-flex max-w-full items-stretch divide-x divide-[#34363b] overflow-hidden rounded-md border border-[#34363b] bg-[#1b1c20]">
      <button ref={presetAnchor} type="button" data-testid="composer-preset-button" aria-label={`${t('agent_chat_preset')}: ${current.presetName || t('composer_custom')}. ${summary}`} title={summary} aria-haspopup="dialog" aria-expanded={menu === 'preset'} disabled={disabled} aria-disabled={disabled || applying || pending} onClick={() => open('preset')} className={`${segment} max-w-[18rem] aria-disabled:opacity-40`}><Settings2 size={14} className="shrink-0 text-zinc-400" /><span className="truncate">{current.presetName || t('composer_custom')}</span><ChevronDown size={12} className="shrink-0" /></button>
      {custom && <><button ref={providerAnchor} type="button" data-testid="composer-provider-button" title={providerAgents[current.provider]} aria-label={t('coding_agent')} aria-haspopup="dialog" aria-expanded={menu === 'provider'} disabled={disabled || applying || pending} onClick={() => open('provider')} className={`${segment} max-w-[10rem]`}><Cpu size={13} className="hidden shrink-0 sm:block" /><span className="truncate">{current.provider === 'antigravity' ? 'Antigravity' : current.provider === 'api' ? 'API' : providerAgents[current.provider]}</span><ChevronDown size={12} className="shrink-0" /></button><button ref={modelAnchor} type="button" data-testid="composer-model-button" title={current.model} aria-label={t('agent_chat_model')} aria-haspopup="dialog" aria-expanded={menu === 'model'} disabled={disabled || applying || pending} onClick={() => open('model')} className={`${segment} max-w-[12rem]`}><span className="truncate">{current.model}</span><ChevronDown size={12} className="shrink-0" /></button><button ref={optionsAnchor} type="button" data-testid="composer-options-button" aria-label={t('composer_options')} title={summary} aria-haspopup="dialog" aria-expanded={menu === 'options'} disabled={disabled || applying || pending} onClick={() => open('options')} className={`${segment} shrink-0`}><SlidersHorizontal size={14} />{dirty && <span aria-label={t('composer_unsaved_configuration')} className="h-1.5 w-1.5 rounded-full bg-orange-500" />}</button></>}
    </div>
    {error && error !== reportedError && !menu && <p role="alert" className="mt-1 max-w-lg text-[11px] text-rose-300">{error}</p>}
    {menu && <ConfigurationPopover key={menu} anchor={anchors[menu]} label={t(menu === 'preset' ? 'agent_chat_preset' : menu === 'provider' ? 'coding_agent' : menu === 'model' ? 'agent_chat_model' : 'composer_options')} onClose={close} testId="agent-chat-settings" width={menu === 'preset' ? 320 : 348}>
      {menu === 'preset' ? <div role="menu" aria-label={t('agent_chat_preset')}>
        {presets.filter(item => presetProvider(item)).map(preset => <button key={preset.name} type="button" role="menuitemradio" aria-checked={current.presetName === preset.name} disabled={blocked} data-testid={`composer-preset-${preset.name}`} onClick={() => void apply(configurationFromPreset(preset))} className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left hover:bg-[#2b2c32] disabled:opacity-40"><Cpu size={15} className="shrink-0 text-orange-400" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{preset.name}</span><span className="block truncate text-[10px] text-zinc-500">{preset.agent} · {preset.model}</span></span>{current.presetName === preset.name && <Check size={14} />}</button>)}
        <button type="button" role="menuitem" data-testid="composer-create-preset" disabled={blocked} onClick={() => { setMenu(null); setCreating(true) }} className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-zinc-300 hover:bg-[#2b2c32] disabled:opacity-40"><Plus size={15} />{t('composer_create_preset')}</button>
        <div className="mt-1 border-t border-[#34363b] pt-1"><button type="button" role="menuitemradio" aria-checked={custom} disabled={blocked} data-testid="composer-custom-option" onClick={() => void apply({ ...current, presetName: '' })} className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left hover:bg-[#2b2c32] disabled:opacity-40"><Settings2 size={15} /><span className="flex-1">{t('composer_custom')}</span>{custom && <Check size={14} />}</button></div>
        {busy && <p className="px-3 py-2 text-[10px] text-zinc-400">{t('agent_chat_wait_idle')}</p>}
      </div> : <div className="p-3">
        <h3 className="mb-4 text-xs font-semibold text-zinc-100">{t(menu === 'options' ? 'composer_options' : menu === 'provider' ? 'coding_agent' : 'agent_chat_model')}</h3>
        {dirty && <p data-testid="agent-chat-proposal-summary" className="mb-3 break-words text-[11px] leading-relaxed text-amber-300">{t('composer_pending_configuration')}: {providerAgents[proposal.provider]} · {proposal.model || t('model_auto')}</p>}
        {menu === 'provider' && <ProviderFields value={proposal} onChange={setProposal} disabled={blocked} />}
        {menu === 'model' && <ModelCatalogInput agent={providerAgents[proposal.provider]} apiConnectionId={proposal.apiConnectionId} value={proposal.model} onChange={model => setProposal({ ...proposal, model })} disabled={blocked} testId="agent-chat-model" />}
        {menu === 'options' && <Options value={proposal} onChange={setProposal} disabled={blocked} />}
        <p className="mt-4 text-[10px] leading-relaxed text-zinc-400">{t(busy ? 'agent_chat_wait_idle' : 'agent_chat_apply_hint')}</p>
        <div className="mt-4 flex justify-end gap-2 border-t border-[#303137] pt-3"><button type="button" disabled={applying || pending} onClick={() => { setProposal(current); close(true) }} className="rounded border border-[#34363b] px-3 py-2 text-zinc-400 hover:text-white">{t('cancel')}</button><button type="button" data-testid="agent-chat-apply" disabled={blocked || (proposal.provider === 'api' && !proposal.apiConnectionId)} onClick={() => void apply(proposal)} className="rounded bg-[#ff6b00] px-3 py-2 font-semibold text-white disabled:opacity-40">{t(applying || pending ? 'agent_chat_applying' : 'agent_chat_apply')}</button></div>
      </div>}
      {error && error !== reportedError && <p role="alert" className="px-3 pb-3 text-xs text-rose-300">{error}</p>}
    </ConfigurationPopover>}
    {creating && <PresetEditorDialog returnFocus={presetAnchor} initial={initialPreset} existingNames={presets.map(item => item.name)} onSave={preset => useStore.getState().addPreset(preset)} onSaved={preset => { void apply(configurationFromPreset(preset)) }} onClose={() => setCreating(false)} />}
  </div>
}
