import { uiText, uiKey } from '../../uiText'
import { useEffect, useRef, useState } from 'react'
import { normalizeClaudeConnectionOptions, type ApiConnection, type ApiConnectorInspection, type ApiProfile, type ApiTransport, type GrokConnectorInspection, type SaveApiConnection } from '../../../shared/api-provider'
import { useStore } from '../../store'
import type { AgentModelCatalog } from '../../../shared/agent-models'
import { useTranslation } from '../../i18n'
import { ClaudeCapabilities, ClaudeConnectionFields } from './ClaudeConnectionSettings'

const blank: SaveApiConnection = { name: '', baseUrl: 'https://api.openai.com/v1', model: '', enabled: true, transport: 'chat-completions', profile: 'openai-compatible', allowCommands: false }
const control = 'w-full rounded border border-zinc-700 bg-[#111317] p-2 text-sm text-white'
const button = 'rounded border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800 disabled:opacity-40'

function GrokCapabilities({ inspection }: { inspection: GrokConnectorInspection }) {
  const { t, formatDate, formatNumber } = useTranslation()
  const available = (value: boolean) => t(value ? 'grok_available' : 'grok_unavailable')
  const usage = inspection.usage
  return <div data-testid="api-grok-capabilities" className="space-y-2 rounded border border-sky-900/50 bg-sky-950/10 p-3 text-xs text-zinc-400">
    <p>{t('grok_inspection_time', { time: formatDate(inspection.fetchedAt, { dateStyle: 'medium', timeStyle: 'short' }) })}{inspection.cliVersion && <> · CLI <bdi>{inspection.cliVersion}</bdi></>}</p>
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
      {([['grok_image_input', inspection.imageInput], ['grok_image_generation', inspection.imageGeneration], ['grok_image_edit', inspection.imageEdit], ['grok_video', inspection.videoAvailable], ['grok_questions_capability', inspection.interactiveQuestions]] as const).map(([key, value]) => <div key={key} className="contents"><dt>{t(key)}</dt><dd>{available(value)}</dd></div>)}
    </dl>
    {inspection.videoRestriction && <p className="break-words">{inspection.videoRestriction}</p>}
    <p>{t('grok_media_limits')}</p>
    <details><summary className="cursor-pointer">{t('grok_provider_tools')} · {inspection.tools.length}</summary><p className="mt-1">{t('grok_provider_tools_hint')}</p><p className="mt-2 break-words font-mono" dir="ltr">{inspection.tools.join(', ') || '—'}</p></details>
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
      <dt>{t('grok_usage_tier')}</dt><dd>{usage?.tier ?? t('grok_unknown')}</dd>
      <dt>{t('grok_usage_percent')}</dt><dd data-testid="api-grok-credit-usage">{usage?.creditUsagePercent == null ? t('grok_unknown') : formatNumber(usage.creditUsagePercent / 100, { style: 'percent', maximumFractionDigits: 2 })}</dd>
      <dt>{t('grok_usage_period')}</dt><dd>{usage?.periodEnd ?? t('grok_unknown')}</dd>
    </dl>
    <p>{t('grok_usage_hint')}</p>
    {inspection.warnings.map((warning, index) => <p key={index} className="break-words text-amber-300">{warning}</p>)}
  </div>
}

export function ApiConnectionsPanel() {
  const settings = useStore(state => state.settings)
  const ru = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const [connections, setConnections] = useState<ApiConnection[]>([])
  const [draft, setDraft] = useState<SaveApiConnection>({ ...blank })
  const [key, setKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [catalogs, setCatalogs] = useState<Record<string, string>>({})
  const [inspections, setInspections] = useState<Record<string, { signature: string; value: ApiConnectorInspection; models: AgentModelCatalog['models'] }>>({})
  const busyRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const refresh = async () => setConnections(await window.ziafAPI.apiConnections.list())
  useEffect(() => { let current = true; void window.ziafAPI.apiConnections.list().then(value => { if (current) setConnections(value) }).catch(failure => { if (current) setError(String(failure.message ?? failure)) }); return () => { current = false } }, [])
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true); setError(''); setSaved(false)
    try { await action(); await refresh() } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) } finally { busyRef.current = false; setBusy(false) }
  }
  const edit = (connection?: ApiConnection, setupResponses = false) => {
    const nextDraft: SaveApiConnection = connection ? { id: connection.id, name: connection.name, baseUrl: connection.baseUrl, model: connection.model, enabled: connection.enabled, transport: connection.transport ?? 'chat-completions', profile: connection.transport === 'responses' || connection.transport === 'anthropic-messages' ? connection.profile ?? 'openai-compatible' : 'openai-compatible', allowCommands: (connection.transport === 'responses' || connection.transport === 'anthropic-messages') && connection.allowCommands === true, ...(connection.transport === 'responses' && connection.profile === 'grok-connector-v1' && connection.grok ? { grok: { ...connection.grok } } : {}), ...(connection.transport === 'anthropic-messages' && connection.profile === 'claude-connector-v1' ? { claude: normalizeClaudeConnectionOptions(connection.claude) } : {}) } : { ...blank }
    setDraft(setupResponses ? { ...nextDraft, transport: 'responses', profile: 'openai-compatible', allowCommands: false } : nextDraft)
    setKey(''); setClearKey(false); setError(''); setSaved(false)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    nameRef.current?.focus({ preventScroll: true })
  }
  const signature = (connection: Pick<ApiConnection, 'baseUrl' | 'transport' | 'profile'>) => JSON.stringify([connection.baseUrl, connection.transport, connection.profile])
  const draftInspection = draft.id && inspections[draft.id]?.signature === signature(draft) ? inspections[draft.id] : undefined
  const contextWindows = draftInspection?.models.find(item => item.id === draft.model)?.contextWindows ?? []
  const claudeInspection = draftInspection?.value.provider === 'claude' ? draftInspection.value : undefined
  return <div className="min-h-0 flex-1 overflow-auto p-8 text-zinc-200" data-testid="api-connections">
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold">{label('AI connections', 'Подключения ИИ')}</h1>
      <p className="text-sm text-zinc-400">{label('Native CLI tools use their own sign-in. Add an OpenAI-compatible API or local gateway here, then select the connection in a chat or preset.', 'CLI используют собственную авторизацию. Здесь можно добавить совместимый с OpenAI API или локальный шлюз, затем выбрать подключение в чате или пресете.')}</p>
      {error && <p role="alert" className="break-words rounded border border-rose-900 p-3 text-sm text-rose-300">{error}</p>}
      <div className="space-y-3">{connections.map(connection => <section key={connection.id} className="space-y-2 rounded-lg border border-zinc-800 p-4" data-testid={`api-connection-${connection.id}`}>
        <div className="flex items-center justify-between gap-3"><strong>{connection.name}</strong><span className="text-xs text-zinc-400">{connection.enabled ? label('Enabled', 'Включено') : label('Disabled', 'Отключено')}</span></div>
        <p className="break-all text-xs text-zinc-500">{connection.baseUrl} · {connection.model} · {connection.hasApiKey ? label('Key saved', 'Ключ сохранён') : label('No key', 'Без ключа')}</p>
        <p className="text-xs text-zinc-500">{connection.transport === 'anthropic-messages' ? uiKey('claude_messages_transport') : connection.transport === 'responses' ? label('Responses', 'Responses') : label('Chat Completions', 'Chat Completions')}{connection.transport === 'anthropic-messages' ? <> · {uiKey('claude_connector_profile')}</> : connection.transport === 'responses' && <> · {connection.profile === 'grok-connector-v1' ? uiKey('grok_connector_profile') : connection.profile === 'codex-connector' ? label('Codex connector', 'Коннектор Codex') : label('OpenAI-compatible', 'Совместимый с OpenAI')}</>}</p>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => edit(connection)}>{uiKey('edit')}</button>{connection.transport !== 'responses' && connection.transport !== 'anthropic-messages' && <button className={button} disabled={busy} data-testid={`api-connection-responses-${connection.id}`} onClick={() => edit(connection, true)}>{uiKey('api_setup_responses')}</button>}<button className={button} disabled={busy || !connection.enabled} onClick={() => void run(async () => {
          const catalog = await window.ziafAPI.getAgentModelCatalog({ agent: 'OpenAI-compatible API', apiConnectionId: connection.id })
          setCatalogs(previous => ({ ...previous, [connection.id]: catalog.status === 'ready' ? `${label('Models endpoint responded', 'Каталог моделей доступен')}: ${catalog.models.map(model => model.id).join(', ') || '—'}` : catalog.error || label('Unavailable', 'Недоступен') }))
        })}>{label('Check model catalog', 'Проверить каталог моделей')}</button><button className={`${button} text-rose-300`} disabled={busy} onClick={() => void run(async () => { await window.ziafAPI.apiConnections.remove({ id: connection.id }); if (draft.id === connection.id) edit() })}>{label('Remove connection', 'Удалить подключение')}</button></div>
        {connection.transport === 'responses' && connection.profile === 'grok-connector-v1' && <button type="button" className={button} disabled={busy || !connection.enabled} data-testid={`api-grok-inspect-${connection.id}`} onClick={() => void run(async () => {
          const value = await window.ziafAPI.apiConnections.inspect({ id: connection.id })
          setInspections(previous => ({ ...previous, [connection.id]: { signature: signature(connection), value, models: [] } }))
          const catalog = await window.ziafAPI.getAgentModelCatalog({ agent: 'OpenAI-compatible API', apiConnectionId: connection.id })
          setInspections(previous => ({ ...previous, [connection.id]: { signature: signature(connection), value, models: catalog.status === 'ready' ? catalog.models : [] } }))
          if (catalog.status !== 'ready') throw new Error(catalog.error || uiKey('grok_catalog_unavailable'))
        })}>{uiKey('grok_inspect')}</button>}
        {connection.transport === 'anthropic-messages' && connection.profile === 'claude-connector-v1' && <button type="button" className={button} disabled={busy || !connection.enabled} data-testid={`api-claude-inspect-${connection.id}`} onClick={() => void run(async () => {
          const value = await window.ziafAPI.apiConnections.inspect({ id: connection.id })
          if (value.provider !== 'claude') throw new Error(uiKey('claude_discovery_mismatch'))
          setInspections(previous => ({ ...previous, [connection.id]: { signature: signature(connection), value, models: value.models.map(model => ({ id: model.id, label: model.label, supportedReasoningEfforts: model.reasoningEfforts, contextWindows: model.contextWindows })) } }))
        })}>{uiKey('claude_inspect')}</button>}
        {inspections[connection.id]?.signature === signature(connection) && <ConnectorCapabilities inspection={inspections[connection.id].value} />}
        {catalogs[connection.id] && <p className="break-words text-xs text-zinc-400">{catalogs[connection.id]}</p>}
      </section>)}</div>
      <form ref={formRef} className="space-y-3 rounded-lg border border-zinc-800 p-5" onSubmit={event => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; void run(async () => { await window.ziafAPI.apiConnections.save({ ...draft, ...(clearKey ? { apiKey: '' } : key ? { apiKey: key } : {}) }); if (draft.id) setInspections(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => id !== draft.id))); edit(); setSaved(true) }) }}>
        <div className="flex items-center justify-between"><h2 className="font-medium">{draft.id ? label('Edit connection', 'Изменение подключения') : label('New connection', 'Новое подключение')}</h2>{draft.id && <button type="button" className={button} disabled={busy} onClick={() => edit()}>{label('New', 'Создать новое')}</button>}</div>
        {saved && <p role="status" data-testid="api-connection-saved" className="text-sm text-emerald-300">{uiKey('api_connection_saved_hint')}</p>}
        <label className="block text-xs text-zinc-400">{label('Name', 'Название')}<input ref={nameRef} data-testid="api-connection-name" className={control} value={draft.name} required maxLength={200} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label>
        <label className="block text-xs text-zinc-400">{draft.profile === 'claude-connector-v1' ? uiKey('claude_origin_url') : label('Base URL including /v1', 'Базовый URL, включая /v1')}<input data-testid="api-connection-url" className={control} value={draft.baseUrl} type="url" required disabled={busy} onChange={event => setDraft(previous => ({ ...previous, baseUrl: event.target.value }))} /></label>
        <label className="block text-xs text-zinc-400">{label('Default model ID', 'ID модели по умолчанию')}<input data-testid="api-connection-model" className={control} value={draft.model} required maxLength={200} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, model: event.target.value }))} /></label>
        <label className="block text-xs text-zinc-400">{label('API transport', 'Транспорт API')}<select data-testid="api-connection-transport" className={control} value={draft.transport ?? 'chat-completions'} disabled={busy} onChange={event => {
          const transport = event.target.value as ApiTransport
          setDraft(previous => ({ ...previous, transport, ...(transport === 'anthropic-messages' ? { profile: 'claude-connector-v1' as const, grok: undefined, allowCommands: false, claude: normalizeClaudeConnectionOptions(previous.claude) } : transport === 'chat-completions' || previous.transport === 'anthropic-messages' ? { profile: 'openai-compatible' as const, allowCommands: false, grok: undefined, claude: undefined } : {}) }))
        }}><option value="chat-completions">{label('Chat Completions', 'Chat Completions')}</option><option value="responses">{label('Responses', 'Responses')}</option><option value="anthropic-messages">{uiKey('claude_messages_transport')}</option></select></label>
        <p className="text-xs text-zinc-500">{uiKey(draft.transport === 'anthropic-messages' ? 'claude_messages_hint' : draft.transport === 'responses' ? 'api_responses_hint' : 'api_chat_completions_hint')}</p>
        <label className="block text-xs text-zinc-400">{label('API profile', 'Профиль API')}<select data-testid="api-connection-profile" className={control} value={draft.profile ?? 'openai-compatible'} disabled={busy || draft.transport === 'chat-completions'} onChange={event => {
          const profile = event.target.value as ApiProfile
          setDraft(previous => ({ ...previous, profile, ...(profile === 'claude-connector-v1' ? { transport: 'anthropic-messages' as const, grok: undefined, allowCommands: false, claude: normalizeClaudeConnectionOptions(previous.claude) } : { ...(previous.transport === 'anthropic-messages' ? { transport: 'responses' as const, allowCommands: false } : {}), claude: undefined, ...(profile === 'grok-connector-v1' ? {} : { grok: undefined }) }) }))
        }}><option value="openai-compatible">{label('OpenAI-compatible', 'Совместимый с OpenAI')}</option><option value="codex-connector">{label('Codex connector', 'Коннектор Codex')}</option><option value="grok-connector-v1">{uiKey('grok_connector_profile')}</option><option value="claude-connector-v1">{uiKey('claude_connector_profile')}</option></select></label>
        {draft.transport === 'anthropic-messages' && draft.profile === 'claude-connector-v1' && <ClaudeConnectionFields key={draft.id ?? 'new'} value={draft.claude} disabled={busy} inspection={claudeInspection} modelId={draft.model} onChange={claude => setDraft(previous => ({ ...previous, claude }))} />}
        {draft.transport === 'responses' && draft.profile === 'grok-connector-v1' && <p data-testid="api-grok-profile-hint" className="text-xs leading-relaxed text-zinc-400">{uiKey('grok_connector_profile_hint')}</p>}
        {draft.transport === 'responses' && draft.profile === 'grok-connector-v1' && <div className="space-y-3 rounded border border-zinc-800 p-3">
          <label className="block text-xs text-zinc-400">{uiKey('grok_context_window')}<select data-testid="api-grok-context-window" className={control} disabled={busy} value={draft.grok?.contextWindow ?? ''} onChange={event => setDraft(previous => ({ ...previous, grok: { ...previous.grok, contextWindow: event.target.value ? Number(event.target.value) : undefined } }))}>
            <option value="">{uiKey('grok_provider_default')}</option>
            {draft.grok?.contextWindow && !contextWindows.includes(draft.grok.contextWindow) && <option value={draft.grok.contextWindow}>{draft.grok.contextWindow} · {uiKey('grok_context_unverified')}</option>}
            {contextWindows.map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <p className="text-xs text-zinc-500">{uiKey(draftInspection ? 'grok_context_model_hint' : 'grok_inspect_save_first')}</p>
          <label className="block text-xs text-zinc-400">{uiKey('grok_max_turns')}<input data-testid="api-grok-max-turns" className={control} type="number" min={1} max={100} step={1} placeholder={uiKey('grok_provider_default')} disabled={busy} value={draft.grok?.maxTurns ?? ''} onChange={event => setDraft(previous => ({ ...previous, grok: { ...previous.grok, maxTurns: event.target.value ? Number(event.target.value) : undefined } }))} /></label>
          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <label className="flex items-start gap-2 text-xs text-zinc-200"><input data-testid="api-grok-auto-approve-permissions" aria-describedby="api-grok-auto-approve-hint" type="checkbox" checked={draft.grok?.autoApproveNativePermissions === true} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, grok: { ...previous.grok, autoApproveNativePermissions: event.target.checked } }))} className="mt-0.5 shrink-0 accent-orange-500" />{uiKey('grok_auto_approve_permissions')}</label>
            <p id="api-grok-auto-approve-hint" className="text-xs leading-relaxed text-zinc-400">{uiKey('grok_auto_approve_permissions_hint')}</p>
          </div>
        </div>}
        {(draft.transport === 'responses' || draft.transport === 'anthropic-messages') && <div className="space-y-1"><label className="flex gap-2 text-xs"><input data-testid="api-connection-commands" type="checkbox" checked={draft.allowCommands === true} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, allowCommands: event.target.checked }))} />{label('Allow local commands', 'Разрешить локальные команды')}</label><p className="text-xs text-zinc-500">{label('Commands run locally after your approval. This is not an operating-system sandbox.', 'Команды выполняются локально после вашего одобрения. Это не песочница операционной системы.')}</p></div>}
        <label className="block text-xs text-zinc-400">{label('API key (leave blank to keep the saved key)', 'API-ключ (пустое поле сохраняет прежний ключ)')}<input data-testid="api-connection-key" className={control} type="password" autoComplete="off" value={key} disabled={busy || clearKey} onChange={event => setKey(event.target.value)} /></label>
        {draft.id && !clearKey && connections.find(connection => connection.id === draft.id)?.hasApiKey && <p className="text-xs text-zinc-500">{uiKey('api_saved_key_hint')}</p>}
        {draft.id && <label className="flex gap-2 text-xs"><input type="checkbox" checked={clearKey} disabled={busy} onChange={event => setClearKey(event.target.checked)} />{label('Remove the saved key', 'Удалить сохранённый ключ')}</label>}
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={draft.enabled} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, enabled: event.target.checked }))} />{label('Enabled', 'Включено')}</label>
        <p className="text-xs text-zinc-500">{label('Keys are encrypted using the operating system. Local loopback gateways may work without a key. A catalog check does not certify model generation.', 'Ключи шифруются средствами операционной системы. Локальный шлюз может работать без ключа. Проверка каталога не подтверждает генерацию ответа.')}</p>
        <button className={`${button} bg-orange-700`} type="submit" data-testid="api-connection-save" disabled={busy}>{label('Save connection', 'Сохранить подключение')}</button>
      </form>
    </div>
  </div>
}

function ConnectorCapabilities({ inspection }: { inspection: ApiConnectorInspection }) {
  return inspection.provider === 'claude' ? <ClaudeCapabilities inspection={inspection} /> : <GrokCapabilities inspection={inspection} />
}
