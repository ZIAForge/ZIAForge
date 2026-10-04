import { useRef, useState } from 'react'
import { Check, History, MessageSquare, Search } from 'lucide-react'
import type { ChatTab } from '../../../shared/legacy-ipc'
import { useTranslation } from '../../i18n'
import { ConfigurationPopover } from './ConfigurationPopover'

export function ChatHistoryDropdown({ tabs, recent, activeTabId, onOpen, onCloseAll, error }: {
  tabs: ChatTab[]; recent: ChatTab[]; activeTabId: string; onOpen: (tab: ChatTab) => void; onCloseAll: () => void; error?: string | null
}) {
  const { t } = useTranslation()
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const close = (restore = false) => { setOpen(false); if (restore) anchor.current?.focus({ preventScroll: true }) }
  const label = (tab: ChatTab) => tab.id === 'chat-main' ? t('discussion_feed') : tab.name
  const matching = (tab: ChatTab) => label(tab).toLocaleLowerCase().includes(search.toLocaleLowerCase())
  const chats = tabs.filter(tab => tab.type === 'chat')
  return <div className="shrink-0 flex items-center">
    <button ref={anchor} onClick={() => { setOpen(!open); setSearch('') }} title={t('chat_history')} aria-label={t('chat_history')} aria-expanded={open} aria-haspopup="dialog"
      data-testid="chat-history-button" className={`p-1.5 rounded-md transition-colors ${open || error ? 'text-orange-400 bg-[#1e2024]' : 'text-zinc-500 hover:text-zinc-300'}`}>
      <History className="h-3.5 w-3.5" />
    </button>
    {open && <ConfigurationPopover anchor={anchor} label={t('chat_history')} testId="chat-history-dropdown" width={320} onClose={close}>
      <div className="flex items-center gap-2 p-2 border-b border-zinc-800 mb-2">
        <Search className="h-3.5 w-3.5 text-zinc-500" />
        <input data-testid="chat-history-search" aria-label={t('search_tabs')} placeholder={t('search_tabs')} value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none text-zinc-100" />
      </div>
      {error && <p role="alert" className="px-2 pb-2 text-orange-300">{t('chat_history_error')}: {error}</p>}
      <div className="flex items-center justify-between px-2 py-1 text-zinc-500 text-[10px] uppercase tracking-wider">
        <span>{t('open')}</span>
        <button data-testid="chat-history-close-all" disabled={tabs.length === 1 && tabs[0].id === 'chat-main'} onClick={onCloseAll} className="normal-case tracking-normal text-zinc-400 hover:text-white disabled:opacity-40">{t('close_all_tabs')}</button>
      </div>
      {chats.filter(matching).map(tab => <button key={tab.id} data-testid={`open-chat-${tab.id}`} onClick={() => { onOpen(tab); close(true) }}
        className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[#24262b]">
        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-purple-400" /><span className="truncate flex-1">{label(tab)}</span>{tab.id === activeTabId && <Check className="h-3.5 w-3.5 text-orange-400" />}
      </button>)}
      <div className="px-2 pt-3 pb-1 text-zinc-500 text-[10px] uppercase tracking-wider">{t('recent')}</div>
      {recent.filter(matching).map(tab => <button key={tab.id} data-testid={`recent-chat-${tab.id}`} onClick={() => { onOpen(tab); close(true) }}
        className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-zinc-400 hover:bg-[#24262b] hover:text-white">
        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-purple-400" /><span className="truncate">{label(tab)}</span>
      </button>)}
      {!recent.length && <p className="px-2 py-2 text-zinc-500 text-[11px]">{t('no_recently_closed_tabs')}</p>}
      {search && ![...chats, ...recent].some(matching) && <p className="px-2 py-2 text-zinc-500">{t('no_matching_tabs')}</p>}
    </ConfigurationPopover>}
  </div>
}
