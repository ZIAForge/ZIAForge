import React, { useEffect, useState, useRef } from 'react'
import { useStore } from '../store'
import { useTranslation } from '../i18n'
import { Search, FileText, CheckCircle, X, Folder, Settings, Sparkles, Link2, Activity } from 'lucide-react'

export const CommandPalette: React.FC = () => {
  const { t } = useTranslation()
  const { tasks, selectTask, repositories, setActiveTab, setActiveRepoId, settings } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen to global ⌘ K shortcut and custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    
    const handleOpenEvent = () => setIsOpen(true)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('open-command-palette', handleOpenEvent as EventListener)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('open-command-palette', handleOpenEvent as EventListener)
    }
  }, [])

  // Auto focus input when open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSearchQuery('')
    }
  }, [isOpen])

  if (!isOpen) return null

  // Mocked files list for search matching
  const mockFiles = [
    'SESSION_CONTEXT_FULL.md',
    'ZIAForge_Spec.md',
    'package.json',
    'electron/main.ts',
    'src/App.tsx',
    'src/index.css'
  ]

  // App views
  const appViews = [
    { id: 'settings', name: t('settings'), icon: Settings, tab: 'settings' as const },
    { id: 'assistant', name: t('ziaf_assistant'), icon: Sparkles, tab: 'assistant' as const },
    { id: 'connections', name: t('connections'), icon: Link2, tab: 'connections' as const },
    { id: 'automations', name: t('automations'), icon: Activity, tab: 'automations' as const }
  ]

  const q = searchQuery.toLowerCase()

  // Filter lists
  const filteredTasks = tasks.filter(t => t.name.toLowerCase().includes(q))
  const filteredFiles = settings?.useMockData === true ? mockFiles.filter(f => f.toLowerCase().includes(q)) : []
  const filteredRepos = repositories.filter(r => r.name.toLowerCase().includes(q))
  const filteredAppViews = appViews.filter(v => v.name.toLowerCase().includes(q))

  const hasResults = filteredTasks.length > 0 || filteredFiles.length > 0 || filteredRepos.length > 0 || filteredAppViews.length > 0

  const handleSelectTask = (taskId: string) => {
    selectTask(taskId)
    setIsOpen(false)
  }

  const handleSelectTab = (tab: Parameters<typeof setActiveTab>[0]) => {
    setActiveTab(tab)
    setIsOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[#2b2e33] bg-[#15171a] shadow-2xl animate-scale-up">
        
        {/* Search Input Header */}
        <div className="flex items-center border-b border-[#1e2024] px-4 py-3 bg-[#0f1012]">
          <Search className="h-5 w-5 text-zinc-500 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
          <button 
            onClick={() => setIsOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Results */}
        <div className="max-h-[350px] overflow-y-auto p-2 space-y-3">
          
          {/* App Views Results */}
          {filteredAppViews.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 block mb-1">{t('app_views') || 'App'}</span>
              {filteredAppViews.map(view => (
                <button
                  key={view.id}
                  onClick={() => handleSelectTab(view.tab)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-[#1e2024] text-zinc-300 hover:text-white transition-colors"
                >
                  <view.icon className="h-4 w-4 text-zinc-500" />
                  <span className="truncate">{view.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Repositories Results */}
          {filteredRepos.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 block mb-1">{t('repositories')}</span>
              {filteredRepos.map(repo => (
                <button
                  key={repo.id}
                  onClick={() => { setActiveRepoId(repo.id); setActiveTab('new-task'); setIsOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-[#1e2024] text-zinc-300 hover:text-white transition-colors"
                >
                  <Folder className="h-4 w-4 text-[#ff6b00]" />
                  <span className="truncate">{repo.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tasks Results */}
          {filteredTasks.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 block mb-1">{t('tasks')}</span>
              {filteredTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleSelectTask(task.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-[#1e2024] text-zinc-300 hover:text-white transition-colors"
                >
                  <span className="truncate">{task.name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                    {task.status === 'done' ? (
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                    ) : task.status === 'running' ? (
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                    ) : null}
                    <span className="capitalize">{task.status}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Files Results */}
          {filteredFiles.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 block mb-1">{t('recent_files')}</span>
              {filteredFiles.map(file => (
                <button
                  key={file}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-[#1e2024] text-zinc-300 hover:text-white transition-colors"
                >
                  <FileText className="h-4 w-4 text-zinc-500" />
                  <span className="truncate">{file}</span>
                </button>
              ))}
            </div>
          )}

          {/* No results placeholder */}
          {!hasResults && (
            <div className="py-8 text-center text-xs text-zinc-600 italic">
              {t('no_results_placeholder')}
            </div>
          )}

        </div>
        
        {/* Footer shortcuts */}
        <div className="flex justify-between items-center bg-[#0c0d0e] border-t border-[#1e2024] px-4 py-2 text-[10px] text-zinc-600 font-mono">
          <span>{t('esc_to_close')}</span>
          <span className="flex items-center gap-1 bg-[#1e2024] px-1.5 py-0.5 rounded text-zinc-400">
            <span>⌘</span>
            <span>K</span>
          </span>
        </div>

      </div>
    </div>
  )
}
