import { useEffect, useRef, useState } from 'react'
import { CLAUDE_DEFAULT_MAX_TOKENS, type ClaudeConnectionOptions, type ClaudeConnectorInspection } from '../../../shared/api-provider'
import { useTranslation } from '../../i18n'

const control = 'mt-1 w-full rounded-lg border border-zinc-700 bg-[#111317] p-2 text-sm text-white disabled:opacity-50'
const label = 'block text-xs text-zinc-400'

export function ClaudeConnectionFields({ value = {}, onChange, disabled, inspection, modelId }: {
  value?: ClaudeConnectionOptions; onChange: (value: ClaudeConnectionOptions) => void; disabled: boolean; inspection?: ClaudeConnectorInspection; modelId: string
}) {
  const { t } = useTranslation()
  const model = inspection?.models.find(item => item.id === modelId)
  const update = (change: Partial<ClaudeConnectionOptions>) => onChange({ ...value, ...change })
  const selected = value.nativeTools ?? []
  const tools = inspection?.tools ?? []
  const permittedInMode = (name: string) => value.mode === 'native' || ['WebSearch', 'WebFetch'].includes(name)
  const maxTokens = value.maxTokens ?? CLAUDE_DEFAULT_MAX_TOKENS
  const thinkingType = value.thinking?.type ?? ''
  const thinkingTypes = ['', 'disabled', ...(model?.supportsAdaptiveThinking === true ? ['adaptive'] : []), ...(model?.supportsManualThinking === true ? ['enabled'] : [])]
  const display = inspection?.thinking.display ?? []
  const schemaRef = useRef(value.outputSchema)
  const schemaInput = useRef<HTMLTextAreaElement>(null)
  const [schema, setSchema] = useState(value.outputSchema ? JSON.stringify(value.outputSchema, null, 2) : '')
  const [schemaError, setSchemaError] = useState(false)
  useEffect(() => {
    if (schemaRef.current === value.outputSchema) return
    schemaRef.current = value.outputSchema
    setSchema(value.outputSchema ? JSON.stringify(value.outputSchema, null, 2) : '')
    setSchemaError(false)
    schemaInput.current?.setCustomValidity('')
  }, [value.outputSchema])
  return <div data-testid="api-claude-fields" className="space-y-4 rounded-xl border border-orange-900/40 bg-orange-950/5 p-4">
    <p className="text-xs leading-relaxed text-zinc-400">{t('claude_connector_profile_hint')}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>{t('claude_execution_mode')}<select data-testid="api-claude-mode" className={control} disabled={disabled} value={value.mode ?? 'caller'} onChange={event => update({ mode: event.target.value as ClaudeConnectionOptions['mode'] })}>
        <option value="caller">{t('claude_mode_caller')}</option><option value="native">{t('claude_mode_native')}</option>
      </select></label>
      <label className={label}>{t('claude_permission_mode')}<select data-testid="api-claude-permissions" className={control} disabled={disabled} value={value.permissionMode ?? 'manual'} onChange={event => update({ permissionMode: event.target.value as ClaudeConnectionOptions['permissionMode'] })}>
        <option value="manual">{t('claude_permission_manual')}</option><option value="plan">{t('claude_permission_plan')}</option><option value="acceptEdits">{t('claude_permission_accept_edits')}</option><option value="dontAsk">{t('claude_permission_dont_ask')}</option>
      </select></label>
    </div>
    <p className="text-xs text-zinc-500">{t('claude_permission_hint')}</p>
    <fieldset className="space-y-2 rounded-lg border border-zinc-800 p-3" disabled={disabled}>
      <legend className="px-1 text-xs text-zinc-300">{t('claude_native_tools')}</legend>
      <p className="text-xs text-zinc-500">{t(inspection ? 'claude_native_tools_hint' : 'claude_inspect_save_first')}</p>
      <div className="grid gap-2 sm:grid-cols-2">{tools.filter(tool => tool.enabled && permittedInMode(tool.name) || selected.includes(tool.name)).map(tool => <label key={tool.name} className="flex items-center gap-2 text-xs">
        <input data-testid={`api-claude-tool-${tool.name}`} type="checkbox" checked={selected.includes(tool.name)} disabled={disabled || (!tool.enabled || !permittedInMode(tool.name)) && !selected.includes(tool.name)} onChange={event => update({ nativeTools: event.target.checked ? [...selected, tool.name] : selected.filter(name => name !== tool.name) })} />
        <bdi>{tool.name}</bdi>{(!tool.enabled || !permittedInMode(tool.name)) && <span className="text-amber-300">{t('claude_not_advertised')}</span>}
      </label>)}</div>
      {selected.filter(name => !tools.some(tool => tool.name === name)).map(name => <label key={name} className="flex items-center gap-2 text-xs text-amber-300"><input type="checkbox" checked onChange={() => update({ nativeTools: selected.filter(item => item !== name) })} /><bdi>{name}</bdi> · {t('claude_not_advertised')}</label>)}
      {!selected.length && <p className="text-xs text-zinc-400">{t('claude_native_tools_none')}</p>}
    </fieldset>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>{t('claude_max_tokens')}<input data-testid="api-claude-max-tokens" className={control} type="number" min={1} max={Math.min(128000, model?.maxOutputTokens ?? 128000)} step={1} required disabled={disabled} value={value.maxTokens ?? ''} onChange={event => update({ maxTokens: event.target.value ? Number(event.target.value) : undefined })} /></label>
      <label className={label}>{t('claude_max_turns')}<input data-testid="api-claude-max-turns" className={control} type="number" min={1} max={100} step={1} required disabled={disabled} value={value.maxTurns ?? ''} onChange={event => update({ maxTurns: event.target.value ? Number(event.target.value) : undefined })} /></label>
    </div>
    <p className="text-xs text-zinc-500">{t('claude_token_limit_hint')}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>{t('claude_thinking')}<select data-testid="api-claude-thinking" className={control} disabled={disabled} value={thinkingType} onChange={event => update({ thinking: event.target.value ? { type: event.target.value as NonNullable<ClaudeConnectionOptions['thinking']>['type'], ...(event.target.value === 'enabled' ? { budget_tokens: 1024 } : {}) } : undefined })}>
        <option value="">{t('grok_provider_default')}</option><option value="disabled">{t('claude_thinking_disabled')}</option>
        {model?.supportsAdaptiveThinking === true && <option value="adaptive">{t('claude_thinking_adaptive')}</option>}
        {model?.supportsManualThinking === true && <option value="enabled" disabled={maxTokens <= 1024}>{t('claude_thinking_enabled')}</option>}
        {!thinkingTypes.includes(thinkingType) && <option value={thinkingType}>{thinkingType} · {t('claude_not_advertised')}</option>}
      </select></label>
      {value.thinking && value.thinking.type !== 'disabled' && <label className={label}>{t('claude_thinking_display')}<select data-testid="api-claude-thinking-display" className={control} disabled={disabled} value={value.thinking.display ?? ''} onChange={event => update({ thinking: { ...value.thinking!, display: event.target.value ? event.target.value as 'summarized' | 'omitted' : undefined } })}>
        <option value="">{t('grok_provider_default')}</option>{display.map(option => <option key={option} value={option}>{t(option === 'summarized' ? 'claude_display_summarized' : 'claude_display_omitted')}</option>)}
        {value.thinking.display && !display.includes(value.thinking.display) && <option value={value.thinking.display}>{value.thinking.display} · {t('claude_not_advertised')}</option>}
      </select></label>}
      {value.thinking?.type === 'enabled' && <label className={label}>{t('claude_thinking_budget')}<input data-testid="api-claude-thinking-budget" className={control} type="number" required min={1024} max={maxTokens - 1} step={1} disabled={disabled} value={value.thinking.budget_tokens ?? ''} onChange={event => update({ thinking: { ...value.thinking!, budget_tokens: event.target.value ? Number(event.target.value) : undefined } })} /></label>}
    </div>
    <p className="text-xs text-zinc-500">{t('claude_thinking_hint')}</p>
    <label className={label}>{t('claude_output_schema')}<textarea ref={schemaInput} data-testid="api-claude-output-schema" dir="ltr" className={`${control} min-h-24 font-mono`} disabled={disabled} value={schema} maxLength={131072} onChange={event => {
      const input = event.target.value; setSchema(input)
      try {
        const parsed: unknown = input.trim() ? JSON.parse(input) : undefined
        if (parsed !== undefined && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) throw new Error('object required')
        schemaRef.current = parsed as Record<string, unknown> | undefined
        update({ outputSchema: schemaRef.current }); setSchemaError(false); event.target.setCustomValidity('')
      } catch { setSchemaError(true); event.target.setCustomValidity(t('claude_schema_invalid')) }
    }} /></label>
    {schemaError && <p role="alert" className="text-xs text-rose-300">{t('claude_schema_invalid')}</p>}
    <p className="text-xs text-zinc-500">{t('claude_schema_hint')}</p>
    <label className={label}>{t('claude_history_mode')}<select data-testid="api-claude-history" className={control} disabled={disabled} value={value.historyMode ?? 'reject'} onChange={event => update({ historyMode: event.target.value as 'reject' | 'context' })}>
      <option value="reject">{t('claude_history_reject')}</option><option value="context">{t('claude_history_context')}</option>
    </select></label>
    <p className={`text-xs ${value.historyMode === 'context' ? 'text-amber-300' : 'text-zinc-500'}`}>{t('claude_history_hint')}</p>
  </div>
}

export function ClaudeCapabilities({ inspection }: { inspection: ClaudeConnectorInspection }) {
  const { t, formatDate, formatNumber } = useTranslation()
  const status = (value: boolean | null) => t(value === null ? 'grok_unknown' : value ? 'grok_available' : 'grok_unavailable')
  const count = (value: number | null) => value === null ? t('grok_unknown') : formatNumber(value)
  const time = (value: string | null) => value ? formatDate(new Date(value).getTime(), { dateStyle: 'medium', timeStyle: 'short' }) : t('grok_unknown')
  return <div data-testid="api-claude-capabilities" className="space-y-3 rounded-xl border border-orange-900/40 bg-orange-950/5 p-4 text-xs text-zinc-400">
    <p>{t('grok_inspection_time', { time: formatDate(inspection.fetchedAt, { dateStyle: 'medium', timeStyle: 'short' }) })}{inspection.cliVersion && <> · CLI <bdi>{inspection.cliVersion}</bdi></>}{inspection.sdkVersion && <> · SDK <bdi>{inspection.sdkVersion}</bdi></>}</p>
    <p>{t('claude_discovery_hint')}</p>
    <details><summary className="cursor-pointer text-zinc-200">{t('claude_native_tools')} · {formatNumber(inspection.tools.length)}</summary>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-start"><thead><tr>{['claude_tool_name', 'claude_discovered', 'claude_enabled', 'claude_verified'].map(key => <th className="px-2 py-1 text-start font-medium" key={key}>{t(key)}</th>)}</tr></thead><tbody>{inspection.tools.map(tool => <tr key={tool.name} className="border-t border-zinc-800"><td className="p-2"><bdi>{tool.name}</bdi>{tool.reason && <p className="max-w-sm break-words text-zinc-500">{tool.reason}</p>}</td><td className="p-2">{status(tool.available)}</td><td className="p-2">{status(tool.enabled)}</td><td className="p-2">{status(tool.verified)}</td></tr>)}</tbody></table></div>
    </details>
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
      {([['claude_caller_tools', inspection.callerTools], ['grok_image_input', inspection.imageInput], ['claude_document_input', inspection.documentInput], ['claude_artifacts', inspection.artifacts]] as const).map(([key, capability]) => <div key={key} className="contents"><dt>{t(key)}</dt><dd>{status(capability.enabled)} · {t('claude_verified')}: {status(capability.verified)}</dd></div>)}
      <dt>{t('claude_owned_sessions')}</dt><dd>{count(inspection.status.ownedSessions)}</dd><dt>{t('claude_active')}</dt><dd>{count(inspection.status.active)}</dd><dt>{t('claude_queued')}</dt><dd>{count(inspection.status.queued)}</dd><dt>{t('claude_awaiting_tools')}</dt><dd>{count(inspection.status.awaitingTools)}</dd><dt>{t('claude_connected')}</dt><dd>{status(inspection.status.connected)}</dd>
    </dl>
    <details><summary className="cursor-pointer text-zinc-200">{t('claude_model_capabilities')} · {formatNumber(inspection.models.length)}</summary><div className="mt-2 space-y-2">{inspection.models.map(model => <div key={model.id} className="rounded-lg border border-zinc-800 p-2"><bdi>{model.label}</bdi> · <code>{model.id}</code><p>{t('claude_efforts')}: {model.reasoningEfforts.join(', ') || t('grok_unknown')}</p><p>{t('claude_thinking_adaptive')}: {status(model.supportsAdaptiveThinking)} · {t('claude_thinking_enabled')}: {status(model.supportsManualThinking)}</p><p>{t('claude_max_tokens')}: {count(model.maxOutputTokens)}</p></div>)}</div></details>
    <div className="space-y-2 border-t border-zinc-800 pt-3">
      <p>{t('claude_limits')} · {status(inspection.usage.available)}{inspection.usage.subscriptionType && <> · <bdi>{inspection.usage.subscriptionType}</bdi></>}</p>
      {!inspection.usage.available && <p className="text-amber-300">{t('claude_limits_unknown')}</p>}
      {inspection.usage.windows.map(window => <div key={window.name} className="rounded-lg border border-zinc-800 p-2"><bdi>{window.name}</bdi> · {t('claude_used')}: {window.usedPercent === null ? t('grok_unknown') : formatNumber(window.usedPercent / 100, { style: 'percent', maximumFractionDigits: 2 })} · {t('claude_remaining')}: {window.remainingPercent === null ? t('grok_unknown') : formatNumber(window.remainingPercent / 100, { style: 'percent', maximumFractionDigits: 2 })}<p>{t('claude_resets_at')}: {time(window.resetsAt)}</p></div>)}
      <p>{t('claude_manual_renewal')}: {inspection.usage.renewalSource === 'manual' ? time(inspection.usage.renewsAt) : t('grok_unknown')}</p><p>{t('claude_renewal_hint')}</p>
    </div>
  </div>
}
