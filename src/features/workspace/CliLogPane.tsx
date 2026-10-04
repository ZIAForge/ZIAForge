import { currentLocale } from '../../uiText'
import { formatDate } from '../../i18n-core'
import { useState } from 'react'
import { useTranslation } from '../../i18n'

export interface CliLogEntry { id: string; timestamp: number; level: 'info' | 'warning' | 'error'; source: 'session' | 'stdout' | 'stderr'; message: string }

/** Read-only, backend-sanitized CLI output. This component never writes to a PTY. */
export function CliLogPane({ entries }: { entries: CliLogEntry[] }) {
  const { t } = useTranslation()
  const [source, setSource] = useState('all')
  const visible = source === 'all' ? entries : entries.filter(entry => entry.source === source)
  return <section aria-label={t('agent_chat_logs')} data-testid="agent-cli-log-pane" className="shrink-0 border-t border-[#2b2e33] bg-[#090a0b] text-xs">
    <div className="flex items-center justify-between gap-3 px-4 py-2"><span className="text-zinc-400">{t('agent_chat_logs_hint')}</span>
      <select aria-label={t('agent_chat_log_source')} value={source} onChange={event => setSource(event.target.value)} className="rounded border border-[#2b2e33] bg-[#141619] px-2 py-1"><option value="all">{t('agent_chat_all_logs')}</option><option value="stdout">stdout</option><option value="stderr">stderr</option><option value="session">{t('agent_chat_lifecycle')}</option></select>
    </div>
    <div className="max-h-56 overflow-auto px-4 pb-3 font-mono" data-testid="agent-cli-log-lines">
      {!visible.length && <p className="text-zinc-500">{t('agent_chat_no_logs')}</p>}
      {visible.map(entry => <div key={entry.id} className={`whitespace-pre-wrap break-words ${entry.level === 'error' ? 'text-rose-300' : entry.source === 'stderr' ? 'text-amber-200' : 'text-zinc-300'}`}><span className="mr-2 text-zinc-500">{formatDate(currentLocale(), entry.timestamp, { timeStyle: 'medium' })} [{entry.source}]</span>{entry.message}</div>)}
    </div>
  </section>
}
