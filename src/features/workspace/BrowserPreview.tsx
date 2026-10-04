import { useRef, useState, type FormEvent } from 'react'
import { ExternalLink, Globe } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { normalizePreviewUrl } from './browserPreviewUrl'

/** External preview uses the existing URL-only IPC; it never starts a server. */
export function BrowserPreview() {
  const { t } = useTranslation()
  const [address, setAddress] = useState('')
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [opened, setOpened] = useState(false)
  const inFlight = useRef(false)

  async function open(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    setOpened(false)
    const url = normalizePreviewUrl(address)
    if (!url) { setError(t('browser_preview_invalid')); return }
    inFlight.current = true
    setOpening(true)
    setError(null)
    try {
      await window.ziafAPI.openExternal(url)
      setOpened(true)
    } catch {
      setError(t('browser_preview_failed'))
    } finally {
      inFlight.current = false
      setOpening(false)
    }
  }

  return <section data-testid="browser-preview" className="flex-1 overflow-y-auto p-5 text-zinc-300">
    <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-white"><Globe className="h-4 w-4" />{t('browser_preview_title')}</div>
    <p className="mb-4 text-xs leading-relaxed text-zinc-400">{t('browser_preview_description')}</p>
    <form onSubmit={open} className="space-y-3">
      <label className="block text-xs text-zinc-400" htmlFor="browser-preview-url">{t('browser_preview_address')}</label>
      <input id="browser-preview-url" data-testid="browser-preview-url" value={address} disabled={opening} onChange={event => { setAddress(event.target.value); setError(null); setOpened(false) }} maxLength={4096} placeholder="http://localhost:3000" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="w-full rounded-lg border border-zinc-700 bg-[#15171a] px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#ff6b00]" />
      <button data-testid="browser-preview-open" type="submit" disabled={opening || !address.trim()} className="flex items-center gap-2 rounded-lg bg-[#ff6b00] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><ExternalLink className="h-3.5 w-3.5" />{t(opening ? 'browser_preview_opening' : 'browser_preview_open')}</button>
    </form>
    {error && <p role="alert" className="mt-3 text-xs text-rose-400">{error}</p>}
    {opened && <p role="status" className="mt-3 text-xs text-zinc-400">{t('browser_preview_opened')}</p>}
  </section>
}
