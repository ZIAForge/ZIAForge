import { uiText, uiKey } from '../../uiText'
import { useEffect, useState } from 'react'
import type { ApiConnection, SaveApiConnection } from '../../../shared/api-provider'
import { useStore } from '../../store'

const blank: SaveApiConnection = { name: '', baseUrl: 'https://api.openai.com/v1', model: '', enabled: true }
const control = 'w-full rounded border border-zinc-700 bg-[#111317] p-2 text-sm text-white'
const button = 'rounded border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800 disabled:opacity-40'

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
  const [catalogs, setCatalogs] = useState<Record<string, string>>({})
  const refresh = async () => setConnections(await window.ziafAPI.apiConnections.list())
  useEffect(() => { let current = true; void window.ziafAPI.apiConnections.list().then(value => { if (current) setConnections(value) }).catch(failure => { if (current) setError(String(failure.message ?? failure)) }); return () => { current = false } }, [])
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError('')
    try { await action(); await refresh() } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) } finally { setBusy(false) }
  }
  const edit = (connection?: ApiConnection) => {
    setDraft(connection ? { id: connection.id, name: connection.name, baseUrl: connection.baseUrl, model: connection.model, enabled: connection.enabled } : { ...blank })
    setKey(''); setClearKey(false); setError('')
  }
  return <div className="min-h-0 flex-1 overflow-auto p-8 text-zinc-200" data-testid="api-connections">
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold">{label('AI connections', 'Подключения ИИ')}</h1>
      <p className="text-sm text-zinc-400">{label('Native CLI tools use their own sign-in. Add an OpenAI-compatible API or local gateway here, then select the connection in a chat or preset.', 'CLI используют собственную авторизацию. Здесь можно добавить совместимый с OpenAI API или локальный шлюз, затем выбрать подключение в чате или пресете.')}</p>
      {error && <p role="alert" className="break-words rounded border border-rose-900 p-3 text-sm text-rose-300">{error}</p>}
      <div className="space-y-3">{connections.map(connection => <section key={connection.id} className="space-y-2 rounded-lg border border-zinc-800 p-4" data-testid={`api-connection-${connection.id}`}>
        <div className="flex items-center justify-between gap-3"><strong>{connection.name}</strong><span className="text-xs text-zinc-400">{connection.enabled ? label('Enabled', 'Включено') : label('Disabled', 'Отключено')}</span></div>
        <p className="break-all text-xs text-zinc-500">{connection.baseUrl} · {connection.model} · {connection.hasApiKey ? label('Key saved', 'Ключ сохранён') : label('No key', 'Без ключа')}</p>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => edit(connection)}>{uiKey('edit')}</button><button className={button} disabled={busy || !connection.enabled} onClick={() => void run(async () => {
          const catalog = await window.ziafAPI.getAgentModelCatalog({ agent: 'OpenAI-compatible API', apiConnectionId: connection.id })
          setCatalogs(previous => ({ ...previous, [connection.id]: catalog.status === 'ready' ? `${label('Models endpoint responded', 'Каталог моделей доступен')}: ${catalog.models.map(model => model.id).join(', ') || '—'}` : catalog.error || label('Unavailable', 'Недоступен') }))
        })}>{label('Check model catalog', 'Проверить каталог моделей')}</button><button className={`${button} text-rose-300`} disabled={busy} onClick={() => void run(async () => { await window.ziafAPI.apiConnections.remove({ id: connection.id }); if (draft.id === connection.id) edit() })}>{label('Remove connection', 'Удалить подключение')}</button></div>
        {catalogs[connection.id] && <p className="break-words text-xs text-zinc-400">{catalogs[connection.id]}</p>}
      </section>)}</div>
      <form className="space-y-3 rounded-lg border border-zinc-800 p-5" onSubmit={event => { event.preventDefault(); void run(async () => { await window.ziafAPI.apiConnections.save({ ...draft, ...(clearKey ? { apiKey: '' } : key ? { apiKey: key } : {}) }); edit() }) }}>
        <div className="flex items-center justify-between"><h2 className="font-medium">{draft.id ? label('Edit connection', 'Изменение подключения') : label('New connection', 'Новое подключение')}</h2>{draft.id && <button type="button" className={button} disabled={busy} onClick={() => edit()}>{label('New', 'Создать новое')}</button>}</div>
        <label className="block text-xs text-zinc-400">{label('Name', 'Название')}<input data-testid="api-connection-name" className={control} value={draft.name} required maxLength={200} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label>
        <label className="block text-xs text-zinc-400">{label('Base URL including /v1', 'Базовый URL, включая /v1')}<input data-testid="api-connection-url" className={control} value={draft.baseUrl} type="url" required disabled={busy} onChange={event => setDraft(previous => ({ ...previous, baseUrl: event.target.value }))} /></label>
        <label className="block text-xs text-zinc-400">{label('Default model ID', 'ID модели по умолчанию')}<input data-testid="api-connection-model" className={control} value={draft.model} required maxLength={200} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, model: event.target.value }))} /></label>
        <label className="block text-xs text-zinc-400">{label('API key (leave blank to keep the saved key)', 'API-ключ (пустое поле сохраняет прежний ключ)')}<input data-testid="api-connection-key" className={control} type="password" autoComplete="off" value={key} disabled={busy || clearKey} onChange={event => setKey(event.target.value)} /></label>
        {draft.id && <label className="flex gap-2 text-xs"><input type="checkbox" checked={clearKey} disabled={busy} onChange={event => setClearKey(event.target.checked)} />{label('Remove the saved key', 'Удалить сохранённый ключ')}</label>}
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={draft.enabled} disabled={busy} onChange={event => setDraft(previous => ({ ...previous, enabled: event.target.checked }))} />{label('Enabled', 'Включено')}</label>
        <p className="text-xs text-zinc-500">{label('Keys are encrypted using the operating system. Local loopback gateways may work without a key. A catalog check does not certify model generation.', 'Ключи шифруются средствами операционной системы. Локальный шлюз может работать без ключа. Проверка каталога не подтверждает генерацию ответа.')}</p>
        <button className={`${button} bg-orange-700`} type="submit" data-testid="api-connection-save" disabled={busy}>{label('Save connection', 'Сохранить подключение')}</button>
      </form>
    </div>
  </div>
}
