import { uiText } from '../uiText'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecoveryAPI, RecoveryDocument } from '../../shared/recovery'
import { useTranslation } from '../i18n'


const key = (document: RecoveryDocument) => JSON.stringify(document.target)
const label = (document: RecoveryDocument) => `${document.target.domain}${'repoId' in document.target ? ` · ${document.target.repoId}` : 'taskId' in document.target ? ` · ${document.target.taskId}` : ''}${'runId' in document.target ? ` · ${document.target.runId}` : 'sessionId' in document.target ? ` · ${document.target.sessionId}` : ''}`


export function RecoveryPanel({ api = window.ziafAPI?.recovery, onRestored = () => window.location.reload() }: { api?: RecoveryAPI; onRestored?: () => void }) {
  const { formatDate, formatNumber } = useTranslation()
  const [documents, setDocuments] = useState<RecoveryDocument[]>([])
  const [selected, setSelected] = useState('')
  const [backup, setBackup] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)
  const cancelRefresh = useCallback(() => { sequence.current++ }, [])
  const refresh = useCallback(async () => {
    if (!api) return
    const current = ++sequence.current
    try {
      const list = await api.list()
      if (sequence.current !== current) return
      setDocuments(list); setSelected(old => list.some(item => key(item) === old) ? old : list[0] ? key(list[0]) : '')
      setBackup(''); setError('')
    } catch (failure) { if (sequence.current === current) setError(failure instanceof Error ? failure.message : String(failure)) }
  }, [api])
  useEffect(() => {
    void refresh()
    const off = api?.onChanged(() => { void refresh() })
    return () => { cancelRefresh(); off?.() }
  }, [api, refresh, cancelRefresh])
  const document = documents.find(item => key(item) === selected)
  if (!api || !documents.length && !error) return null
  const restore = async () => {
    if (!document?.fingerprint || !backup || busy) return
    const request = { target: document.target, expectedFingerprint: document.fingerprint, backupId: backup }
    setBusy(true); setError('')
    try { await api.restore(request); onRestored() }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  return <aside data-testid="recovery-panel" role="alert" className="fixed top-3 right-3 z-[100] w-[min(560px,90vw)] rounded-lg border border-amber-500/60 bg-[#202025] p-4 text-sm text-zinc-100 shadow-xl">
    <h2 className="mb-2 font-semibold text-amber-300">{uiText("Saved data needs recovery")}</h2>
    <p>{uiText("The damaged file is preserved. Execution and saving are blocked for the affected data.")}</p>
    {documents.length > 1 && <select aria-label={uiText("Recovery document")} data-testid="recovery-document" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setBackup(''); setError('') }} className="my-2 w-full rounded bg-zinc-800 p-2">{documents.map(item => <option key={key(item)} value={key(item)}>{label(item)}</option>)}</select>}
    {document && <>
      <p className="my-2 font-mono text-xs break-all">{label(document)}</p>
      {document.target.domain === 'message-queue' && <p className="my-2 text-xs text-amber-200">{uiText("Restored messages have an uncertain delivery status and will not be sent automatically. Check the conversation before copying a message to a new draft.")}</p>}
      {!!document.backups.length && document.fingerprint ? <>
        <select aria-label={uiText("Choose a backup")} data-testid="recovery-backup" value={backup} disabled={busy} onChange={event => setBackup(event.target.value)} className="mb-2 w-full rounded bg-zinc-800 p-2">
          <option value="">{uiText("Choose a backup")}</option>
          {document.backups.map(item => <option key={item.id} value={item.id}>{formatDate(item.savedAt)} · {item.id.slice(0, 12)} · {formatNumber(item.bytes)} B</option>)}
        </select>
        <p className="text-xs text-zinc-400">{uiText("Restoring keeps the exact damaged bytes in a separate archive. The app reloads after recovery.")}</p>
        <button data-testid="recovery-restore" disabled={!backup || busy} onClick={() => { void restore() }} className="mt-3 rounded bg-amber-600 px-3 py-2 font-medium disabled:opacity-40">{busy ? uiText("Restoring\u2026") : uiText("Restore selected backup and reload")}</button>
      </> : <p className="my-2 text-zinc-300">{uiText("No validated backup is available. Keep the damaged file and restore a known good copy outside the app.")}</p>}
      {document.error && <p className="mt-2 break-words text-xs text-amber-200">{document.error}</p>}
    </>}
    {error && <p data-testid="recovery-error" className="mt-2 break-words text-red-300">{uiText("Recovery inspection failed")}: {error}</p>}
    <button data-testid="recovery-refresh" disabled={busy} onClick={() => { void refresh() }} className="mt-3 ml-2 rounded border border-zinc-600 px-3 py-2">{uiText("Check again")}</button>
  </aside>
}
