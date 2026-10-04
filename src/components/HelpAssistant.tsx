import { useEffect, useRef, useState } from 'react'
import { Bot, LoaderCircle, Send, Square, Trash2, X, BookOpen } from 'lucide-react'
import { useStore } from '../store'
import { useTranslation } from '../i18n'
import type { HelpAssistantState } from '../../shared/help-assistant'
import { MarkdownMessage } from './MarkdownMessage'
import type { HelpSection } from './helpContent'
import { useHelpComposition } from './helpAssistantComposition'

export function HelpAssistant({ sections, onReference, onClose }: { sections: HelpSection[]; onReference(id: string): void; onClose(): void }) {
  const { t, language } = useTranslation()
  const presets = useStore(state => state.presets)
  const [state, setState] = useState<HelpAssistantState>()
  const { preset, setPreset, draft, setDraft, revision, clearAccepted } = useHelpComposition()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const tail = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  const busy = pending || !!state?.busy
  const apply = (next: HelpAssistantState) => { if (mounted.current) setState(next) }
  useEffect(() => {
    mounted.current = true
    void window.ziafAPI.helpAssistant.state().then(apply).catch(() => { if (mounted.current) setError('help.aiFailed') })
    const timer = setInterval(() => { void window.ziafAPI.helpAssistant.state().then(apply).catch(() => {}) }, 1500)
    return () => { mounted.current = false; clearInterval(timer) }
  }, [])
  useEffect(() => { if (!preset && state?.defaultPreset && presets.some(item => item.name === state.defaultPreset)) setPreset(state.defaultPreset) }, [state?.defaultPreset, presets, preset, setPreset])
  useEffect(() => { tail.current?.scrollIntoView({ block: 'nearest' }) }, [state?.entries.length])
  const message = (reason: unknown) => {
    const text = reason instanceof Error ? reason.message : ''
    return ['help.aiBusy', 'help.aiInvalidRequest', 'help.aiSelectPreset', 'help.aiNativeRequired', 'help.aiPresetChanged'].find(key => text.includes(key)) ?? 'help.aiFailed'
  }
  const send = async () => {
    if (busy || !draft.trim()) return
    if (!presets.some(item => item.name === preset)) { setError('help.aiSelectPreset'); return }
    const text = draft, acceptedRevision = revision
    setPending(true); setError(''); input.current?.focus()
    try {
      const next = await window.ziafAPI.helpAssistant.send({ text, presetName: preset, language })
      apply(next)
      // A late answer must not erase any subsequent edit, even identical text.
      if (!next.error) clearAccepted(acceptedRevision)
    } catch (reason) { if (mounted.current) setError(message(reason)) }
    finally { if (mounted.current) setPending(false) }
  }
  const stop = async () => { try { await window.ziafAPI.helpAssistant.stop() } catch { setError('help.aiFailed') } }
  const clear = async () => { if (busy) return; try { apply(await window.ziafAPI.helpAssistant.clear()); setError('') } catch { setError('help.aiFailed') } }
  const stateError = state?.error
  return <aside className="zf-help-assistant" aria-label={t('help.aiTitle')} data-testid="help-assistant">
    <header><div><Bot size={18} aria-hidden="true" /><h2>{t('help.aiTitle')}</h2></div><div><button type="button" onClick={clear} disabled={busy || !state?.entries.length} aria-label={t('help.aiClear')} title={t('help.aiClear')}><Trash2 size={15} /></button><button type="button" onClick={onClose} aria-label={t('help.aiClose')}><X size={17} /></button></div></header>
    <p className="zf-help-assistant-description">{t('help.aiDescription')}</p>
    <label className="zf-help-assistant-preset">{t('help.aiPreset')}<select value={preset} onChange={event => setPreset(event.target.value)} disabled={busy} data-testid="help-assistant-preset"><option value="">{t('help.aiSelectPreset')}</option>{presets.map(item => <option key={item.name} value={item.name}>{item.name} · {item.model}</option>)}</select></label>
    <div className="zf-help-assistant-messages" role="log" aria-live="polite" aria-busy={busy}>
      {!state?.entries.length && <p className="zf-help-assistant-empty"><BookOpen size={24} aria-hidden="true" />{t('help.aiWelcome')}</p>}
      {state?.entries.map(entry => <article key={entry.id} className={`zf-help-assistant-message ${entry.role}`}><span className="zf-help-assistant-role">{entry.role === 'user' ? t('help.aiYou') : 'ZIAForge'}</span><MarkdownMessage text={entry.text} />{entry.sourceSha256 !== state.sourceSha256 && <p className="zf-help-assistant-old">{t('help.aiOldAnswer')}</p>}{entry.sections.length > 0 && entry.sourceSha256 === state.sourceSha256 && <div className="zf-help-assistant-references">{entry.sections.map(id => { const section = sections.find(item => item.id === id); return section && <button type="button" key={id} onClick={() => onReference(id)}><BookOpen size={12} aria-hidden="true" />{section.title}</button> })}</div>}</article>)}<div ref={tail} />
    </div>
    {(error || stateError) && <p className="zf-help-assistant-error" role="alert">{t(error || (stateError?.startsWith('help.') ? stateError : 'help.aiFailed'))}</p>}
    <form className="zf-help-assistant-composer" onSubmit={event => { event.preventDefault(); void send() }}>
      <textarea ref={input} value={draft} onChange={event => setDraft(event.target.value)} maxLength={12000} placeholder={t('help.aiPlaceholder')} aria-label={t('help.aiPlaceholder')} data-testid="help-assistant-input" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} />
      <div className="zf-help-assistant-toolbar"><span role="status">{busy && <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />}{t(busy ? 'help.aiWorking' : 'help.aiReady')}</span>{busy ? <button type="button" onClick={() => void stop()} aria-label={t('help.aiStop')}><Square size={15} /></button> : <button type="submit" disabled={!draft.trim() || !preset} aria-label={t('help.aiSend')}><Send size={15} /></button>}</div>
    </form>
  </aside>
}
