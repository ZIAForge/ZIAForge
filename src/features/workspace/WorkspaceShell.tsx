import { uiText } from '../../uiText'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  ListTodo,
  Folder,
  GitBranch,
  Terminal as TerminalIcon,
  Activity,
  Globe,
  X,
  FileText,
  MessageSquare,
} from 'lucide-react'
import { useTranslation } from '../../i18n'

export type RightPanelTabType =
  | 'todo'
  | 'files'
  | 'git'
  | 'terminal'
  | 'automations'
  | 'browser'
  | null

export interface CentralTabItem {
  id: string
  name: string
  type: 'chat' | 'file'
  filePath?: string
}

export interface WorkspaceShellProps {
  // Header slots
  title?: React.ReactNode
  subtitle?: React.ReactNode
  headerActions?: React.ReactNode

  // Right Panel Navigation
  rightPanelTab?: RightPanelTabType
  onSelectRightPanelTab?: (tab: RightPanelTabType) => void
  todoProgress?: { completed: number; total: number }
  todoStatus?: string
  gitChangesCount?: number

  // Central Tabs Navigation
  centralTabs?: CentralTabItem[]
  activeTabId?: string
  onSelectTab?: (tabId: string) => void
  onCloseTab?: (tabId: string) => void
  tabsPrefix?: React.ReactNode
  tabsSuffix?: React.ReactNode

  // Toolbar extra actions
  toolbarActions?: React.ReactNode

  // Central Slots
  feed?: React.ReactNode
  composer?: React.ReactNode
  fileViewer?: React.ReactNode

  // Right Panel Slots & Width
  rightPanelContent?: React.ReactNode
  rightPanelWidth?: number
  onRightPanelWidthChange?: (width: number) => void
  onCloseRightPanel?: () => void

  // Additional elements / Modals
  modals?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  title,
  subtitle,
  headerActions,
  rightPanelTab = null,
  onSelectRightPanelTab,
  todoProgress = { completed: 0, total: 0 },
  todoStatus,
  gitChangesCount = 0,
  centralTabs = [],
  activeTabId,
  onSelectTab,
  onCloseTab,
  tabsPrefix,
  tabsSuffix,
  toolbarActions,
  feed,
  composer,
  fileViewer,
  rightPanelContent,
  rightPanelWidth = 380,
  onRightPanelWidthChange,
  onCloseRightPanel,
  modals,
  className = '',
  children,
}) => {
  const { t, direction } = useTranslation()
  const [internalWidth, setInternalWidth] = useState<number>(rightPanelWidth)
  const isResizingRef = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(rightPanelWidth)
  const cleanupDragRef = useRef<(() => void) | null>(null)

  const currentWidth = onRightPanelWidthChange ? rightPanelWidth : internalWidth

  const stopResize = useCallback(() => {
    if (cleanupDragRef.current) {
      cleanupDragRef.current()
      cleanupDragRef.current = null
    }
    isResizingRef.current = false
  }, [])

  useEffect(() => {
    return () => {
      stopResize()
    }
  }, [stopResize])

  useEffect(() => {
    if (rightPanelTab === null) {
      stopResize()
    }
  }, [rightPanelTab, stopResize])

  const toggleTab = (tab: RightPanelTabType) => {
    if (rightPanelTab === tab) {
      onCloseRightPanel?.()
      onSelectRightPanelTab?.(null)
    } else {
      onSelectRightPanelTab?.(tab)
    }
  }

  // Handle panel resize
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      stopResize()

      isResizingRef.current = true
      startXRef.current = e.clientX
      startWidthRef.current = currentWidth

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizingRef.current) return
        const delta = (startXRef.current - moveEvent.clientX) * (direction === 'rtl' ? -1 : 1)
        const newWidth = Math.max(280, Math.min(800, startWidthRef.current + delta))
        if (onRightPanelWidthChange) {
          onRightPanelWidthChange(newWidth)
        } else {
          setInternalWidth(newWidth)
        }
      }

      const handleMouseUp = () => {
        stopResize()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      cleanupDragRef.current = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    },
    [currentWidth, onRightPanelWidthChange, stopResize, direction]
  )

  const activeTabItem = centralTabs.find((t) => t.id === activeTabId)
  const isFileActive = activeTabItem?.type === 'file'

  return (
    <div
      className={`flex flex-col h-full w-full bg-[#0b0c0e] text-zinc-300 select-none overflow-hidden ${className}`}
      data-testid="workspace-shell"
    >
      {/* Top Header Bar */}
      <header
        className="h-11 border-b border-[#1e2024] bg-[#0c0d0e]/95 flex items-center justify-between px-3 gap-2 shrink-0 z-10"
        data-testid="workspace-header"
      >
        {/* Left: Task / Repo info */}
        <div className="flex items-center gap-2 min-w-0">
          {title && (
            <div className="font-bold text-xs text-white truncate max-w-xs">{title}</div>
          )}
          {subtitle && (
            <div className="text-[11px] text-zinc-500 truncate max-w-[200px]">{subtitle}</div>
          )}
        </div>

        {/* Center: Optional header actions */}
        {headerActions && (
          <div className="flex items-center gap-2">{headerActions}</div>
        )}

        {/* Right: Sidebar toggle buttons */}
        <div className="flex items-center gap-1">
          {/* Todo / Plan Button */}
          <button
            type="button"
            onClick={() => toggleTab('todo')}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
              rightPanelTab === 'todo'
                ? 'text-white bg-[#1e2024]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            data-testid="tab-btn-todo"
            title={t('todo') || 'План'}
          >
            <ListTodo className="h-3.5 w-3.5" />
            <span>{t('todo') || 'План'}</span>
            <span
              className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                rightPanelTab === 'todo'
                  ? 'bg-[#ff6b00]/20 text-[#ff6b00]'
                  : 'bg-[#1e2024] text-zinc-500'
              }`}
            >
              {todoStatus ?? `${todoProgress.completed}/${todoProgress.total}`}
            </span>
          </button>

          {/* Files Button */}
          <button
            type="button"
            onClick={() => toggleTab('files')}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
              rightPanelTab === 'files'
                ? 'text-white bg-[#1e2024]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            data-testid="tab-btn-files"
            title={t('files') || 'Файлы'}
          >
            <Folder className="h-3.5 w-3.5" />
            <span>{t('files') || 'Файлы'}</span>
          </button>

          {/* Git Button */}
          <button
            type="button"
            onClick={() => toggleTab('git')}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
              rightPanelTab === 'git'
                ? 'text-white bg-[#1e2024]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            data-testid="tab-btn-git"
            title={t('git') || 'Git'}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>{t('git') || 'Git'}</span>
            <span className="text-[9px] bg-[#1e2024] px-1 py-0.5 rounded text-zinc-500 font-mono">
              {gitChangesCount}
            </span>
          </button>

          <div className="h-4 border-l border-[#1e2024] mx-1" />

          {/* Terminal Button */}
          <button
            type="button"
            onClick={() => toggleTab('terminal')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              rightPanelTab === 'terminal'
                ? 'text-white bg-[#1e2024]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            data-testid="tab-btn-terminal"
            title={t('terminal') || 'Терминал'}
          >
            <TerminalIcon className="h-3.5 w-3.5" />
          </button>

          {/* Automations Button */}
          <button
            type="button"
            onClick={() => toggleTab('automations')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              rightPanelTab === 'automations'
                ? 'text-white bg-[#1e2024]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            data-testid="tab-btn-automations"
            title={t('automations') || 'Автоматизации'}
          >
            <Activity className="h-3.5 w-3.5" />
          </button>

          {/* Browser Button */}
          <button
            type="button"
            onClick={() => toggleTab('browser')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              rightPanelTab === 'browser'
                ? 'text-white bg-[#1e2024]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            data-testid="tab-btn-browser"
            title={t('browser') || 'Браузер'}
          >
            <Globe className="h-3.5 w-3.5" />
          </button>

          {toolbarActions}
        </div>
      </header>

      {/* Main Content Area: Left/Center Workspace + Right Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Central Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#090a0c] overflow-hidden">
          {/* Central Tabs (Chat vs Opened Files) if provided */}
          {centralTabs.length > 0 && (
            <div
              className="flex items-center justify-between px-2 border-b border-[#1e2024] bg-[#0c0d0e]/60 select-none shrink-0 h-9"
              data-testid="central-tabs-bar"
            >
              {tabsPrefix && (
                <div className="flex items-center shrink-0 z-20">
                  {tabsPrefix}
                </div>
              )}
              <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
                {centralTabs.map((tab) => {
                  const isActive = tab.id === activeTabId
                  return (
                    <div
                      key={tab.id}
                      onClick={() => onSelectTab?.(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-t-lg border-b-2 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#15171a] text-white border-[#ff6b00] font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-[#121316]'
                      }`}
                      data-testid={`central-tab-${tab.id}`}
                    >
                      {tab.type === 'file' ? (
                        <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-[#ff6b00] shrink-0" />
                      )}
                      <span className="truncate max-w-[140px]">{tab.name}</span>
                      {onCloseTab && centralTabs.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onCloseTab(tab.id)
                          }}
                          className="p-0.5 rounded text-zinc-500 hover:text-white"
                          data-testid={`close-tab-${tab.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {tabsSuffix && <div className="flex items-center shrink-0 ml-2">{tabsSuffix}</div>}
            </div>
          )}

          {/* Central View Body */}
          <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
            {isFileActive ? (
              fileViewer ? (
                <div className="flex-1 overflow-auto" data-testid="file-viewer-container">
                  {fileViewer}
                </div>
              ) : (
                <div
                  className="flex-1 flex items-center justify-center text-zinc-500 text-xs select-none"
                  data-testid="file-viewer-loading"
                >
                  {t('loading_file') || 'Loading file...'}
                </div>
              )
            ) : (
              <>
                {/* Conversation Feed */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0" data-testid="feed-container">
                  {feed}
                </div>

                {/* Composer at the bottom */}
                {composer && (
                  <div className="p-3 border-t border-[#1e2024]/60 bg-[#0c0d0e]/80 shrink-0" data-testid="composer-wrapper">
                    {composer}
                  </div>
                )}
              </>
            )}

            {children}
          </div>
        </main>

        {/* Resizer Handle between Center and Right Sidebar */}
        {rightPanelTab !== null && (
          <div
            onMouseDown={startResize}
            className="w-1 cursor-col-resize hover:bg-[#ff6b00] bg-[#1e2024] transition-colors z-20 shrink-0 select-none"
            data-testid="right-panel-resizer"
            title={uiText("Resize Panel")}
          />
        )}

        {/* Right Sidebar Panel */}
        {rightPanelTab !== null && (
          <aside
            style={{ width: `${currentWidth}px` }}
            className="flex flex-col bg-[#0f1012] border-l border-[#1e2024] shrink-0 h-full overflow-hidden"
            data-testid="workspace-right-sidebar"
          >
            {rightPanelContent}
          </aside>
        )}
      </div>

      {/* Modals & Overlays */}
      {modals}
    </div>
  )
}

export const MemoWorkspaceShell = React.memo(WorkspaceShell)
