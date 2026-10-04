import type { AgentModelCatalog } from '../../../shared/agent-models'
import { useTranslation } from '../../i18n'
import { defaultPermissions, providerPermissions, permissionLabelKey, type ChatConfiguration } from './agentConfiguration'

export function AgentOptionsFields({ value, onChange, catalog, disabled, prefix = 'agent-chat', readOnlyPermissions = false }: {
  value: ChatConfiguration; onChange: (value: ChatConfiguration) => void
  catalog: AgentModelCatalog | null; disabled?: boolean; prefix?: string; readOnlyPermissions?: boolean
}) {
  const { t } = useTranslation()
  const permission = value.permissions || defaultPermissions(value.provider)
  const permissions = providerPermissions[value.provider]
  const model = catalog?.models.find(item => item.id === value.model)
  const efforts = model?.supportedReasoningEfforts ?? catalog?.reasoningEfforts ?? []
  const manualAllowed = Boolean(catalog?.manualReasoningEffort && !model?.supportedReasoningEfforts)
  const explicit = value.reasoningEffort
  const advertised = explicit && efforts.includes(explicit)
  const unverified = Boolean(explicit && !advertised)
  const selectValue = explicit == null ? '__default__' : advertised ? explicit : '__manual__'
  return <div className="space-y-4" data-testid={`${prefix}-options`}>
    {!readOnlyPermissions && <label className="block text-xs font-medium text-zinc-300">{t('permissions')}
      <select aria-label={t('permissions')} data-testid={`${prefix}-permissions`} disabled={disabled} value={permission} onChange={event => onChange({ ...value, permissions: event.target.value })} className="mt-2 w-full rounded-md border border-[#34363c] bg-[#111215] px-3 py-2.5 text-zinc-100 focus-visible:outline-orange-500">
        {!permissions.includes(permission) && <option value={permission}>{t(permissionLabelKey(permission))}</option>}
        {permissions.map(item => <option key={item} value={item}>{t(permissionLabelKey(item))}</option>)}
      </select>
      <span className="mt-1.5 block text-[11px] font-normal leading-relaxed text-zinc-400">{t(value.provider === 'antigravity' ? 'agy_permission_hint' : value.provider === 'claude' && permission === 'Read only' ? 'claude_plan_permission_hint' : 'composer_permission_hint')}</span>
    </label>}
    <label className="block border-t border-[#2c2e34] pt-4 text-xs font-medium text-zinc-300">{t('composer_reasoning')}
      <select aria-label={t('composer_reasoning')} data-testid={`${prefix}-reasoning-effort`} disabled={disabled} value={selectValue} onChange={event => {
        const next = event.target.value
        onChange({ ...value, reasoningEffort: next === '__default__' ? null : next === '__manual__' ? explicit || '' : next })
      }} className="mt-2 w-full rounded-md border border-[#34363c] bg-[#111215] px-3 py-2.5 text-zinc-100 focus-visible:outline-orange-500">
        <option value="__default__">{t('composer_provider_default')}{model?.defaultReasoningEffort ? ` · ${model.defaultReasoningEffort}` : ''}</option>
        {[...new Set(efforts)].map(effort => <option key={effort} value={effort}>{effort === 'none' ? t('composer_reasoning_none') : effort}</option>)}
        {(manualAllowed || unverified) && <option value="__manual__">{t('composer_reasoning_manual')}</option>}
      </select>
    </label>
    {(selectValue === '__manual__' || explicit === '') && <input aria-label={t('composer_reasoning_manual')} data-testid={`${prefix}-reasoning-manual`} value={explicit ?? ''} disabled={disabled || !manualAllowed} maxLength={64} onChange={event => onChange({ ...value, reasoningEffort: event.target.value })} className="w-full rounded-md border border-[#34363c] bg-[#111215] px-3 py-2 text-xs text-zinc-200 disabled:opacity-60" />}
    <p className={`text-[11px] leading-relaxed ${unverified ? 'text-amber-300' : 'text-zinc-400'}`} data-testid={`${prefix}-reasoning-hint`}>{t(unverified ? 'composer_reasoning_unverified' : efforts.length ? 'composer_reasoning_catalog' : manualAllowed ? 'composer_reasoning_manual_hint' : 'composer_reasoning_unavailable')}</p>
  </div>
}
