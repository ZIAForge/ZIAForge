import { useEffect, useId, useRef } from 'react'
import type { AgentModelCatalog } from '../../../shared/agent-models'
import { useTranslation } from '../../i18n'

import { useModelCatalog, type ModelCatalogLoader } from './useModelCatalog'
export type { ModelCatalogLoader } from './useModelCatalog'

interface Props {
  agent: string
  apiConnectionId?: string
  value: string
  onChange: (model: string) => void
  disabled?: boolean
  testId?: string
  loadCatalog?: ModelCatalogLoader
  onCatalog?: (catalog: AgentModelCatalog | null) => void
}

/** Catalog refresh never changes a deliberate selection or a manually typed ID. */
export function ModelCatalogInput({ agent, apiConnectionId, value, onChange, disabled, testId = 'model-id', loadCatalog, onCatalog }: Props) {
  const { t } = useTranslation()
  const { catalog, loading, refresh } = useModelCatalog(agent, apiConnectionId, loadCatalog)
  const callback = useRef(onCatalog)
  callback.current = onCatalog
  useEffect(() => { callback.current?.(catalog) }, [catalog])
  const listId = `models-${useId().replace(/:/g, '')}`
  const models = catalog?.status === 'ready' ? catalog.models : []
  const available = [...new Map(models.map(model => [model.id, model])).values()]
  return <div className="min-w-0 space-y-1.5" data-testid={`${testId}-field`}>
    <select aria-label={t('model_catalog_choose')} data-testid={`${testId}-catalog`} disabled={disabled} value={value === 'auto' || available.some(model => model.id === value) ? value : '__manual__'} onChange={event => { if (event.target.value !== '__manual__') onChange(event.target.value) }} className="w-full rounded border border-[#2b2e33] bg-[#0b0c0e] p-2 text-zinc-200">
      <option value="auto">{t('model_auto')}</option>
      {available.filter(model => model.id !== 'auto').map(model => <option key={model.id} value={model.id}>{model.label === model.id ? model.id : `${model.label} · ${model.id}`}</option>)}
      <option value="__manual__">{t('model_catalog_manual')}</option>
    </select>
    <input aria-label={t('agent_chat_model')} data-testid={testId} list={listId} disabled={disabled} maxLength={200} value={value} onChange={event => onChange(event.target.value)} placeholder={t('agent_chat_model')} className="w-full min-w-0 rounded border border-[#2b2e33] bg-[#0b0c0e] p-2 text-zinc-200" />
    <datalist id={listId}>{[...new Set(['auto', ...available.map(model => model.id)])].map(id => <option key={id} value={id} />)}</datalist>
    <div className="flex items-start gap-2 text-[10px] text-zinc-400">
      <span role="status" data-testid={`${testId}-catalog-status`} className="min-w-0 flex-1 break-words">{loading ? t('agent_chat_loading_models') : catalog?.status === 'ready' ? `${t('model_catalog_source')}: ${catalog.command}` : t('model_catalog_unavailable')}</span>
      <button type="button" disabled={disabled || loading} onClick={refresh} data-testid={`${testId}-refresh`} className="shrink-0 text-[#ff6b00] disabled:opacity-40">{t('model_catalog_refresh')}</button>
    </div>
    {!loading && catalog?.error && <p className="break-words text-[10px] text-amber-300" data-testid={`${testId}-catalog-error`}>{catalog.error}</p>}
  </div>
}
