import { uiText } from './uiText'
import { RecoveryPanel } from './components/RecoveryPanel'
import { ArchitectAssistant } from './features/workspace/ArchitectAssistant'
import { Help } from './components/Help'
import { WorkflowRuns } from './features/workspace/WorkflowRuns'
import { ApiConnectionsPanel } from './features/workspace/ApiConnectionsPanel'
import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { NewTaskForm } from './components/NewTaskForm'
import { Workspace } from './components/Workspace'
import { Settings } from './components/Settings'
import { Assistant } from './components/Assistant'
import { Connections } from './components/Connections'
import { Automations } from './components/Automations'
import { CommandPalette } from './components/CommandPalette'

import { useTranslation } from './i18n'

function App() {
  const { 
    activeTab, 
    loadInitialData, 
    promptDialog, 
    closePrompt, 
    deleteRepoDialog, 
    closeDeleteRepoDialog,
    brokenReposList,
    resolveBrokenRepos,
    deleteGroupDialog,
    closeDeleteGroupDialog
  } = useStore()
  const { t, language, direction } = useTranslation()
  
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = direction }, [language, direction])

  const [sidebarWidth, setSidebarWidth] = useState(260)
  const isResizingSidebar = useRef(false)

  useEffect(() => {
    loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Send updated menu labels to main process
    const menuLabels = {
      menu_about: t('menu_about'),
      menu_preferences: t('menu_preferences'),
      menu_new_task: t('menu_new_task'),
      menu_assistant: t('menu_assistant'),
      menu_connections: t('menu_connections'),
      menu_automations: t('menu_automations'),
      menu_github: t('menu_github'),
      menu_quit: t('menu_quit'),
      menu_edit: t('menu_edit'),
      menu_view: t('menu_view'),
      menu_navigate: t('menu_navigate'),
      menu_window: t('menu_window'),
      menu_help: t('menu_help'),
      menu_undo: t('menu_undo'),
      menu_redo: t('menu_redo'),
      menu_cut: t('menu_cut'),
      menu_copy: t('menu_copy'),
      menu_paste: t('menu_paste'),
      menu_select_all: t('menu_select_all'),
      menu_toggle_developer_tools: t('menu_toggle_developer_tools'),
      menu_fullscreen: t('menu_fullscreen'),
      menu_minimize: t('menu_minimize'),
      menu_zoom: t('menu_zoom'),
      menu_close: t('menu_close')
    }
    window.ziafAPI.updateMenu(menuLabels).catch(err => console.error('Menu update error:', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // Sidebar Resize
  const startResizingSidebar = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingSidebar.current = true
    document.addEventListener('mousemove', handleMouseMoveSidebar)
    document.addEventListener('mouseup', stopResizingSidebar)
  }

  const handleMouseMoveSidebar = (e: MouseEvent) => {
    if (!isResizingSidebar.current) return
    const newWidth = Math.max(180, Math.min(450, direction === 'rtl' ? window.innerWidth - e.clientX : e.clientX))
    setSidebarWidth(newWidth)
  }

  const stopResizingSidebar = () => {
    isResizingSidebar.current = false
    document.removeEventListener('mousemove', handleMouseMoveSidebar)
    document.removeEventListener('mouseup', stopResizingSidebar)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0c0e] text-zinc-300">
      
      {/* Left Sidebar wrapper with dynamic width */}
      <div style={{ width: sidebarWidth }} className="shrink-0 flex h-full">
        <Sidebar onOpenHelp={()=>useStore.getState().setActiveTab('help')} helpActive={activeTab==='help'} />
      </div>

      {/* Sidebar Resize handle */}
      <div 
        onMouseDown={startResizingSidebar} 
        className="w-[3px] hover:w-[5px] cursor-col-resize hover:bg-[#ff6b00]/50 bg-[#1e2024]/40 self-stretch transition-all shrink-0 z-40" 
      />

      {/* Main Viewport Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden h-full">
        {activeTab === 'help' && <Help />}
        {activeTab === 'new-task' && <NewTaskForm />}
        {activeTab === 'workspace' && <Workspace />}
        {activeTab === 'settings' && <Settings />}
        {activeTab === 'assistant' && (useStore.getState().settings?.useMockData === true ? <Assistant /> : <ArchitectAssistant />)}
        {activeTab === 'connections' && (useStore.getState().settings?.useMockData === true ? <Connections /> : <ApiConnectionsPanel />)}
        {activeTab === 'automations' && (useStore.getState().settings?.useMockData === true ? <Automations /> : <WorkflowRuns />)}
      </div>

      <RecoveryPanel />

      {/* Global Command Palette */}
      <CommandPalette />

      {/* Custom Prompt Dialog */}
      {promptDialog && (
        <PromptModal 
          dialog={promptDialog} 
          onClose={closePrompt} 
          t={t}
        />
      )}

      {/* Delete Repository Confirmation Dialog */}
      {deleteRepoDialog && (
        <DeleteRepoModal
          dialog={deleteRepoDialog}
          onClose={closeDeleteRepoDialog}
          t={t}
        />
      )}

      {/* Startup Config Recovery Dialog */}
      {brokenReposList.length > 0 && (
        <StartupConfigModal
          brokenList={brokenReposList}
          onResolve={resolveBrokenRepos}
          t={t}
        />
      )}

      {/* Delete Group Confirmation Dialog */}
      {deleteGroupDialog && (
        <DeleteGroupModal
          dialog={deleteGroupDialog}
          onClose={closeDeleteGroupDialog}
          t={t}
        />
      )}
    </div>
  )
}

interface DeleteRepoModalProps {
  dialog: {
    repoId: string
    repoName: string
    onConfirm: (options: { deleteWorkspaceDir: boolean, deleteSourceDir: boolean }) => void
  }
  onClose: () => void
  t: (key: string) => string
}

const DeleteRepoModal: React.FC<DeleteRepoModalProps> = ({ dialog, onClose, t }) => {
  const [deleteWorkspaceDir, setDeleteWorkspaceDir] = useState(false)
  const [deleteSourceDir, setDeleteSourceDir] = useState(false)

  const handleConfirm = () => {
    if (deleteSourceDir) {
      if (!confirm(t('confirm_delete_source_warning') || 'Are you absolutely sure you want to delete source code and Git history?')) {
        return
      }
    }
    dialog.onConfirm({ deleteWorkspaceDir, deleteSourceDir })
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0d0e]/95 border border-[#ff6b00]/30 shadow-[0_0_50px_rgba(255,107,0,0.15)] rounded-2xl w-[420px] p-6 space-y-5 flex flex-col animate-scale-up animate-duration-150"
      >
        <h3 className="text-xs font-extrabold text-white font-mono uppercase tracking-wider">
          {t('delete_repository') || 'Delete Repository'}
        </h3>
        
        <p className="text-xs text-zinc-400 font-sans leading-relaxed">
          {t('delete_confirm_text') || `Are you sure you want to remove project "${dialog.repoName}" from ZIAForge?`}
        </p>

        <div className="space-y-3 pt-2">
          <label className="flex gap-3 items-start cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={deleteWorkspaceDir}
              onChange={(e) => setDeleteWorkspaceDir(e.target.checked)}
              className="mt-0.5 accent-[#ff6b00] cursor-pointer"
            />
            <div className="flex-1">
              <span className="text-xs font-bold text-zinc-200">
                {t('delete_workspace_dir') || 'Delete local workspace project folder'}
              </span>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {t('delete_workspace_desc') || 'Deletes chats history, task configurations, and workspace settings.'}
              </p>
            </div>
          </label>

          <label className="flex gap-3 items-start cursor-pointer select-none border-t border-[#1e2024]/40 pt-3">
            <input 
              type="checkbox" 
              checked={deleteSourceDir}
              onChange={(e) => setDeleteSourceDir(e.target.checked)}
              className="mt-0.5 accent-rose-600 cursor-pointer"
            />
            <div className="flex-1">
              <span className="text-xs font-bold text-rose-500">
                {t('delete_source_dir') || 'Delete original repository source code completely'}
              </span>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {t('delete_source_desc') || 'CAUTION: Removes the entire physical source directory and all Git history on disk!'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2 text-[11px] font-mono pt-2">
          <button 
            type="button" 
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#2b2e33] hover:bg-[#15171a] hover:text-white transition-colors cursor-pointer"
          >
            {t('cancel') || 'Cancel'}
          </button>
          <button 
            type="button"
            onClick={handleConfirm}
            className={`px-3.5 py-1.5 rounded-lg font-extrabold transition-colors cursor-pointer ${
              deleteSourceDir 
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]' 
                : 'bg-[#ff6b00] text-black hover:bg-[#ff8c3a]'
            }`}
          >
            {t('delete') || 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface PromptModalProps {
  dialog: {
    title: string
    defaultValue: string
    submitText?: string
    cancelText?: string
    onSubmit: (value: string) => void
  }
  onClose: () => void
  t: (key: string) => string
}

const PromptModal: React.FC<PromptModalProps> = ({ dialog, onClose, t }) => {
  const [value, setValue] = useState(dialog.defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    dialog.onSubmit(value)
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in"
      onClick={onClose}
    >
      <form 
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0d0e]/95 border border-[#ff6b00]/30 shadow-[0_0_50px_rgba(255,107,0,0.15)] rounded-2xl w-[380px] p-6 space-y-4 flex flex-col animate-scale-up animate-duration-150"
      >
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">{dialog.title}</h3>
        <input 
          ref={inputRef}
          type="text" 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          className="w-full bg-[#15171a] border border-[#2b2e33] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff6b00] font-mono"
        />
        <div className="flex justify-end gap-2 text-[11px] font-mono">
          <button 
            type="button" 
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#2b2e33] hover:bg-[#15171a] hover:text-white transition-colors cursor-pointer"
          >
            {dialog.cancelText || t('cancel') || 'Cancel'}
          </button>
          <button 
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-[#ff6b00] text-black font-extrabold hover:bg-[#ff8c3a] transition-colors cursor-pointer"
          >
            {dialog.submitText || t('ok') || 'OK'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface BrokenRepoItem {
  id: string
  name: string
  path?: string
  isWorkspaceMissing?: boolean
  isRepoMissing?: boolean
}

interface StartupConfigModalProps {
  brokenList: BrokenRepoItem[]
  onResolve: (action: 'cleanup' | 'ignore') => void
  t: (key: string) => string
}

const StartupConfigModal: React.FC<StartupConfigModalProps> = ({ brokenList, onResolve, t }) => {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in select-none">
      <div className="bg-[#0c0d0e]/95 border border-[#ff6b00]/30 shadow-[0_0_50px_rgba(255,107,0,0.2)] rounded-2xl w-[480px] p-6 space-y-5 flex flex-col animate-scale-up animate-duration-150 font-sans">
        <h3 className="text-xs font-extrabold text-rose-500 font-mono uppercase tracking-wider">
          ⚠️ {t('broken_repos_title')}
        </h3>
        
        <p className="text-xs text-zinc-300 leading-relaxed">
          {t('broken_repos_desc')}
        </p>

        <div className="bg-[#15171a] border border-[#2b2e33] rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
          {brokenList.map(r => (
            <div key={r.id} className="text-[11px] font-mono text-zinc-400 border-b border-[#2b2e33]/30 pb-2 last:border-0 last:pb-0">
              <span className="font-bold text-white">{r.name}</span>
              <p className="text-[10px] text-zinc-500 truncate mt-0.5">{r.path}</p>
              <div className="flex gap-2 mt-1">
                {r.isWorkspaceMissing && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-rose-950/40 text-rose-400 rounded">
                    {uiText("Workspace Missing")}</span>
                )}
                {r.isRepoMissing && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-950/40 text-amber-400 rounded">
                    {uiText("Source Repo Missing")}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-2 text-xs font-mono">
          <button 
            onClick={() => onResolve('cleanup')}
            className="w-full py-2 rounded-lg bg-[#ff6b00] text-black font-extrabold hover:bg-[#ff8c3a] transition-colors cursor-pointer text-center"
          >
            {t('broken_repos_cleanup')}
          </button>
          
          <div className="flex gap-2 w-full">
            <button 
              onClick={() => onResolve('ignore')}
              className="flex-1 py-2 rounded-lg border border-[#2b2e33] hover:bg-[#15171a] hover:text-white transition-colors cursor-pointer text-center text-zinc-300"
            >
              {t('broken_repos_ignore')}
            </button>
            <button 
              onClick={() => window.ziafAPI.quitApp()}
              className="flex-1 py-2 rounded-lg border border-rose-950/40 hover:bg-rose-950/20 text-rose-500 transition-colors cursor-pointer text-center"
            >
              {t('broken_repos_quit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DeleteGroupModalProps {
  dialog: {
    groupId: string
    groupName: string
    projectsCount: number
    onConfirm: (action: 'keep' | 'delete_list' | 'delete_all') => void
  }
  onClose: () => void
  t: (key: string) => string
}

const DeleteGroupModal: React.FC<DeleteGroupModalProps> = ({ dialog, onClose, t }) => {
  const [selectedAction, setSelectedAction] = useState<'keep' | 'delete_list' | 'delete_all'>('keep')

  const handleConfirm = () => {
    dialog.onConfirm(selectedAction)
    onClose()
  }

  const getFormattedDesc = () => {
    let text = t('delete_group_desc') || 'The group "{groupName}" contains {count} projects. What would you like to do with these projects?'
    text = text.replace('{groupName}', dialog.groupName)
    text = text.replace('{count}', String(dialog.projectsCount))
    return text
  }

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0d0e]/95 border border-[#ff6b00]/30 shadow-[0_0_50px_rgba(255,107,0,0.15)] rounded-2xl w-[460px] p-6 space-y-5 flex flex-col animate-scale-up animate-duration-150 font-sans"
      >
        <h3 className="text-xs font-extrabold text-white font-mono uppercase tracking-wider">
          {t('delete_group_title') || 'Delete Group'}
        </h3>
        
        <p className="text-xs text-zinc-300 leading-relaxed">
          {getFormattedDesc()}
        </p>

        <div className="space-y-2.5 pt-1">
          <label className="flex gap-3 items-center cursor-pointer p-3 rounded-lg border border-[#2b2e33]/50 bg-[#15171a]/50 hover:bg-[#15171a] transition-all">
            <input 
              type="radio" 
              name="group-delete-action"
              checked={selectedAction === 'keep'}
              onChange={() => setSelectedAction('keep')}
              className="accent-[#ff6b00] cursor-pointer"
            />
            <span className="text-xs font-bold text-zinc-200">
              {t('delete_group_keep') || 'Keep projects (Move to unassigned)'}
            </span>
          </label>

          <label className="flex gap-3 items-center cursor-pointer p-3 rounded-lg border border-[#2b2e33]/50 bg-[#15171a]/50 hover:bg-[#15171a] transition-all">
            <input 
              type="radio" 
              name="group-delete-action"
              checked={selectedAction === 'delete_list'}
              onChange={() => setSelectedAction('delete_list')}
              className="accent-[#ff6b00] cursor-pointer"
            />
            <span className="text-xs font-bold text-zinc-200">
              {t('delete_group_delete_list') || 'Remove projects from ZIAForge list only'}
            </span>
          </label>

          <label className="flex gap-3 items-center cursor-pointer p-3 rounded-lg border border-rose-950/30 bg-rose-950/10 hover:bg-rose-950/20 transition-all">
            <input 
              type="radio" 
              name="group-delete-action"
              checked={selectedAction === 'delete_all'}
              onChange={() => setSelectedAction('delete_all')}
              className="accent-rose-600 cursor-pointer"
            />
            <span className="text-xs font-bold text-rose-500">
              {t('delete_group_delete_all') || 'Completely delete projects and their files'}
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 text-[11px] font-mono pt-2">
          <button 
            type="button" 
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#2b2e33] hover:bg-[#15171a] hover:text-white transition-colors cursor-pointer"
          >
            {t('cancel') || 'Cancel'}
          </button>
          <button 
            type="button"
            onClick={handleConfirm}
            className={`px-3.5 py-1.5 rounded-lg font-extrabold transition-colors cursor-pointer ${
              selectedAction === 'delete_all' 
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]' 
                : 'bg-[#ff6b00] text-black hover:bg-[#ff8c3a]'
            }`}
          >
            {t('delete') || 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
