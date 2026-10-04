import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X, LoaderCircle } from 'lucide-react'
import { SpecializationSelect } from './SpecializationSelect'
import type { Preset } from '../../../shared/legacy-ipc'
import { isReasoningEffort } from '../../../shared/agent-models'
import { useTranslation } from '../../i18n'
import { AgentSelectionFields } from './ChatSettingsPanel'
import { configurationFromPreset, defaultPermissions, providerAgents } from './agentConfiguration'

export function PresetEditorDialog({ initial, existingNames, isEdit = false, onSave, onSaved, onClose, returnFocus }: {
  initial: Preset; existingNames: string[]; isEdit?: boolean
  onSave: (preset: Preset) => Promise<void>; onSaved?: (preset: Preset) => void; onClose: () => void; returnFocus?: RefObject<HTMLElement | null>
}) {
  const { t,language } = useTranslation()
  const [specialization,setSpecialization]=useState(initial.specialization)
  const [name, setName] = useState(initial.name)
  const [configuration, setConfiguration] = useState(() => configurationFromPreset(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  const returnFocusRef = useRef(returnFocus)
  returnFocusRef.current = returnFocus
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    mounted.current = true
    const previous = document.activeElement as HTMLElement | null
    const dialog = panel.current
    panel.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    return () => {
      mounted.current = false
      const target = returnFocusRef.current?.current || previous
      if (target?.isConnected && (document.activeElement === document.body || dialog?.contains(document.activeElement))) target.focus({ preventScroll: true })
    }
  }, [])
  const save = async () => {
    if (pending.current) return
    const cleanName = name.trim()
    if (!cleanName) { setError(t('enter_preset_name')); return }
    if (existingNames.some(item => item === cleanName && (!isEdit || item !== initial.name))) { setError(t('composer_preset_duplicate')); return }
    if (configuration.reasoningEffort != null && !isReasoningEffort(configuration.reasoningEffort)) { setError(t('composer_reasoning_invalid')); return }
    if (configuration.provider === 'api' && !configuration.apiConnectionId) { setError(t('agent_chat_select_connection')); return }
    const preset: Preset = { ...initial, specialization, name: cleanName, agent: providerAgents[configuration.provider], model: configuration.model.trim() || 'auto', permissions: configuration.permissions || defaultPermissions(configuration.provider), reasoningEffort: configuration.reasoningEffort, apiConnectionId: configuration.provider === 'api' ? configuration.apiConnectionId : undefined }
    pending.current = true; setSaving(true); setError(null)
    try {
      await onSave(preset)
      if (!mounted.current) return
      onSaved?.(preset)
      closeRef.current()
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { pending.current = false; if (mounted.current) setSaving(false) }
  }
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !pending.current) onClose() }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={t(isEdit ? 'edit_preset' : 'composer_create_preset')} data-testid="preset-editor" className="flex max-h-[calc(100vh-32px)] w-full max-w-[560px] flex-col rounded-xl border border-[#383a40] bg-[#16171a] text-zinc-200 shadow-2xl" onKeyDown={event => {
      if (event.key === 'Escape' && !pending.current) { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const items = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') || [])]
        const index = items.indexOf(document.activeElement as HTMLElement)
        if (items.length && (event.shiftKey ? index <= 0 : index === items.length - 1)) { event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus() }
      }
    }}>
      <header className="flex shrink-0 items-center justify-between border-b border-[#292b30] px-6 py-5"><h2 className="text-base font-semibold tracking-tight">{t(isEdit ? 'edit_preset' : 'composer_create_preset')}</h2><button type="button" aria-label={t('close')} disabled={saving} onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-40"><X size={18} /></button></header>
      <div className="space-y-5 overflow-y-auto px-6 py-5">
        <label className="block text-xs font-medium text-zinc-300">{t('preset_name')}<input data-testid="preset-name" aria-label={t('preset_name')} disabled={saving} value={name} maxLength={160} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-md border border-[#34363c] bg-[#111215] px-3 py-2.5 text-sm text-zinc-100 focus-visible:outline-orange-500" /></label>
        <AgentSelectionFields value={configuration} onChange={setConfiguration} presets={[]} showPreset={false} disabled={saving} prefix="preset" />
        <SpecializationSelect value={specialization} onChange={setSpecialization} disabled={saving} prefix="preset-specialization" ru={language.startsWith('ru')} />
        {error && <p role="alert" className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</p>}
      </div>
      <footer className="flex shrink-0 justify-end gap-3 border-t border-[#292b30] px-6 py-4"><button type="button" disabled={saving} onClick={onClose} className="rounded-md border border-[#36383e] px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">{t('cancel')}</button><button type="button" data-testid="preset-save" disabled={saving} onClick={() => void save()} className="flex items-center gap-2 rounded-md bg-[#ff6b00] px-4 py-2 text-xs font-semibold text-white hover:bg-[#ff7c1a] disabled:opacity-50">{saving && <LoaderCircle size={14} className="animate-spin" />}{t(saving ? 'saving' : 'save')}</button></footer>
    </div>
  </div>, document.body)
}
