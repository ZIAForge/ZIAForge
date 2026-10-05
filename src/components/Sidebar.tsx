import { uiText } from '../uiText'
import React, { useState, useEffect } from 'react'
import { useStore, Task, SidebarGroup, Repository } from '../store'
import { useTranslation } from '../i18n'
import { 
  Plus, 
  Sparkles, 
  Link2, 
  Activity, 
  Settings, 
  Folder,
  CheckCircle,
  AlertCircle,
  FolderOpen,
  Globe,
  MessageSquare,
  Search,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  BookOpen,
  X
} from 'lucide-react'

export const Sidebar: React.FC<{ onOpenHelp?: () => void; helpActive?: boolean }> = ({ onOpenHelp, helpActive = false }) => {
  const { t, language } = useTranslation()
  const { 
    activeTab, 
    settings,
    setActiveTab, 
    repositories, 
    tasks, 
    activeTaskId, 
    selectTask,
    groups,
    addGroup,
    toggleGroup,
    deleteGroup,
    renameGroup,
    changeGroupColor,
    moveRepoToGroup,
    setActiveRepoId,
    appVersion,
    addRepositoryInteractive,
    showPrompt,
    favoriteColors,
    setFavoriteColors,
    deleteRepository,
    showDeleteRepoDialog
  } = useStore()

  const [collapsedRepos, setCollapsedRepos] = useState<Record<string, boolean>>({})
  const [hoveredRepoId, setHoveredRepoId] = useState<string | null>(null)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'group' | 'repo'
    targetId: string
  } | null>(null)

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null)
    }
    window.addEventListener('click', handleGlobalClick)

    const unsubscribeAbout = window.ziafAPI.onOpenAbout(() => {
      setShowAboutModal(true)
    })

    const unsubscribeNavigate = window.ziafAPI.onNavigate((tab) => {
      setActiveTab(tab)
    })

    return () => {
      window.removeEventListener('click', handleGlobalClick)
      unsubscribeAbout()
      unsubscribeNavigate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // Helper functions for context menu
  const getAllGroupsFlat = (gList: typeof groups): typeof groups => {
    let result: typeof groups = []
    gList.forEach(g => {
      result.push(g)
      if (g.children.length > 0) {
        result = [...result, ...getAllGroupsFlat(g.children)]
      }
    })
    return result
  }

  const findGroupById = (gList: typeof groups, id: string): typeof groups[0] | null => {
    for (const g of gList) {
      if (g.id === id) return g
      const found = findGroupById(g.children, id)
      if (found) return found
    }
    return null
  }

  const resolveHexColor = (color?: string): string | null => {
    if (!color || color === 'default') return null
    if (color.startsWith('#')) return color
    switch (color) {
      case 'red': return '#f43f5e'
      case 'orange': return '#ff6b00'
      case 'blue': return '#0ea5e9'
      case 'green': return '#10b981'
      case 'purple': return '#8b5cf6'
      default: return null
    }
  }

  // Group tasks by repository
  const tasksByRepo: Record<string, Task[]> = {}
  tasks.forEach(task => {
    if (!tasksByRepo[task.repoId]) {
      tasksByRepo[task.repoId] = []
    }
    task.repoId && tasksByRepo[task.repoId].push(task)
  })

  // Collect all assigned repository IDs from groups recursively
  const getAssignedRepoIds = (gList: typeof groups): string[] => {
    let ids: string[] = []
    for (const g of gList) {
      ids = [...ids, ...g.repoIds, ...getAssignedRepoIds(g.children)]
    }
    return ids
  }
  const assignedRepoIds = getAssignedRepoIds(groups)
  const unassignedRepos = repositories.filter(r => !assignedRepoIds.includes(r.id))

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="flex h-4 w-4 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-[#ff6b00]" />
          </span>
        )
      case 'done':
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
      case 'failed':
        return <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
      default:
        return <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 mr-1" />
    }
  }

  const renderRepository = (repo: Repository, hexColor?: string | null) => {
    const repoTasks = tasksByRepo[repo.id] || []
    const isRepoActive = repoTasks.some(t => t.id === activeTaskId && activeTab === 'workspace')
    const isRepoCollapsed = collapsedRepos[repo.id]

    return (
      <div key={repo.id} className="space-y-0.5">
        <div className="flex items-center group/repo">
          <button
            onClick={() => setCollapsedRepos(prev => ({ ...prev, [repo.id]: !prev[repo.id] }))}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, type: 'repo', targetId: repo.id })
            }}
            aria-expanded={!isRepoCollapsed}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors flex-1 text-left select-none cursor-pointer"
            style={
              isRepoActive 
                ? { color: '#ff6b00' } 
                : (hexColor 
                    ? { color: hoveredRepoId === repo.id ? hexColor : `${hexColor}aa` } 
                    : undefined
                  )
            }
            onMouseEnter={() => setHoveredRepoId(repo.id)}
            onMouseLeave={() => setHoveredRepoId(null)}
          >
            {isRepoCollapsed ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
            {isRepoActive ? <FolderOpen className="h-3.5 w-3.5 shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{repo.name}</span>
            {repoTasks.length > 0 && (
              <span className="text-[9px] font-bold px-1 bg-[#1e2024] rounded-full text-zinc-600 ml-auto shrink-0">
                {repoTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveRepoId(repo.id)
              setActiveTab('new-task')
            }}
            className="p-0.5 rounded text-zinc-500 hover:text-zinc-200 opacity-0 group-hover/repo:opacity-100 focus-visible:opacity-100 transition-all mr-2 cursor-pointer"
            title={t('new_task')}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {!isRepoCollapsed && (
          repoTasks.length === 0 ? (
            <div className="pl-10 text-[10px] text-zinc-600 italic py-0.5 select-none">{t('no_active_tasks')}</div>
          ) : (
            <div className="space-y-0.5 pl-5 border-l border-[#1e2024]/60 ml-5">
              {repoTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => selectTask(task.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[11.5px] transition-all gap-2 ${
                    activeTaskId === task.id && activeTab === 'workspace'
                      ? 'bg-[#1e2024] text-white font-semibold'
                      : 'hover:bg-[#15171a] hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate flex-1">{task.name}</span>
                  <div className="shrink-0">
                    {getStatusIcon(task.status)}
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    )
  }

  const renderGroup = (group: SidebarGroup, depth: number = 0) => {
    const groupRepos = repositories.filter(r => group.repoIds.includes(r.id))
    const hexColor = resolveHexColor(group.color)

    return (
      <div 
        key={group.id} 
        className={`space-y-0.5 transition-all ${
          hexColor 
            ? 'border rounded-xl p-2.5 my-3' 
            : 'bg-transparent border-transparent rounded-none p-0 my-1'
        }`} 
        style={{ 
          paddingLeft: depth === 0 ? 0 : 8,
          backgroundColor: hexColor ? `${hexColor}0d` : undefined,
          borderColor: hexColor ? `${hexColor}1a` : undefined
        }}
      >
        <div className="flex items-center group/grp">
          <button
            onClick={() => toggleGroup(group.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, type: 'group', targetId: group.id })
            }}
            className="flex items-center gap-1.5 flex-1 px-3 py-1 text-[9px] font-bold tracking-widest uppercase hover:text-zinc-300 transition-colors select-none"
            style={hexColor ? { color: hexColor } : { color: '#71717a' }}
          >
            {group.collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span>{group.name}</span>
            <span className="text-[8px] text-zinc-700 ml-auto">{groupRepos.length + group.children.length}</span>
          </button>
          <button
            onClick={() => {
              showPrompt(t('enter_subgroup_name'), '', (name) => {
                if (name) addGroup(name, group.id)
              })
            }}
            className="p-0.5 rounded text-zinc-500 hover:text-zinc-200 opacity-0 group-hover/grp:opacity-100 transition-all mr-2 cursor-pointer"
            title={t('add_subgroup')}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {!group.collapsed && (
          <div className="space-y-0.5">
            {/* Nested subgroups */}
            {group.children.map(child => renderGroup(child, depth + 1))}

            {/* Repos in this group */}
            {groupRepos.map(repo => renderRepository(repo, hexColor))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="zf-sidebar flex h-full w-full flex-col border-r border-[#1e2024] bg-[#0f1012] select-none text-zinc-400">
      {/* Title Bar Spacer for macOS title bar padding */}
      <div className="h-10 w-full drag-region shrink-0" />

      {/* App Logo */}
      <div className="px-4 py-2 mb-2 flex items-center gap-3 shrink-0 select-none">
        <img 
          src="./app-logo.jpeg" 
          alt="ZIAForge Logo" 
          className="h-8 w-8 rounded-lg object-cover border border-[#ff6b00]/30 shadow-md animate-fade-in"
        />
        <div className="flex flex-col">
          <span className="text-xs font-extrabold text-white tracking-wide">ZIAForge</span>
          <span className="text-[9px] text-[#ff6b00] font-bold uppercase tracking-wider font-mono">FORGE. DON'T VIBE.</span>
        </div>
      </div>

      {/* Main Actions */}
      <div className="px-3 py-2 space-y-1.5 shrink-0">
        <button
          onClick={() => setActiveTab('new-task')}
          className={`zf-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'new-task' 
              ? 'bg-[#1e2024] text-white shadow-sm' 
              : 'hover:bg-[#15171a] hover:text-zinc-200'
          }`}
        >
          <Plus className="h-4 w-4 text-[#ff6b00]" />
          <span>{t('new_task')}</span>
        </button>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          className="zf-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold tracking-wide transition-all hover:bg-[#15171a] hover:text-zinc-200"
        >
          <Search className="h-4 w-4 text-zinc-400" />
          <div className="flex w-full items-center justify-between">
            <span>{t('search') || 'Search'}</span>
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-zinc-600 bg-[#15171a] px-1 rounded border border-[#2b2e33]">
              <span>⌘</span><span>K</span>
            </span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('assistant')}
          className={`zf-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'assistant' 
              ? 'bg-[#1e2024] text-white shadow-sm' 
              : 'hover:bg-[#15171a] hover:text-zinc-200'
          }`}
        >
          <Sparkles className="h-4 w-4 text-[#ff8c3a]" />
          <span>{t('ziaf_assistant')}</span>
        </button>

        <button
          onClick={() => setActiveTab('connections')}
          className={`zf-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'connections' 
              ? 'bg-[#1e2024] text-white shadow-sm' 
              : 'hover:bg-[#15171a] hover:text-zinc-200'
          }`}
        >
          <Link2 className="h-4 w-4 text-[#ff6b00]" />
          <span>{t('connections')}</span>
        </button>

        <button
          onClick={() => setActiveTab('automations')}
          className={`zf-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'automations' 
              ? 'bg-[#1e2024] text-white shadow-sm' 
              : 'hover:bg-[#15171a] hover:text-zinc-200'
          }`}
        >
          <Activity className="h-4 w-4 text-zinc-400" />
          <span>{t('automations')}</span>
        </button>
      </div>

      <hr className="border-[#1e2024]/60 mx-3 my-2 shrink-0" />

      {/* Tasks Section */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1 scrollbar-thin">
        <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-zinc-500 px-3 py-1 uppercase select-none">
          <span>{t('tasks')}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                showPrompt(t('enter_group_name'), '', (name) => {
                  if (name) addGroup(name)
                })
              }}
              className="flex items-center gap-0.5 text-[9px] bg-[#1e2024] px-1.5 py-0.5 rounded-full text-zinc-400 font-medium hover:bg-[#2b2e33] hover:text-white transition-colors cursor-pointer"
            >
              <Plus className="h-2.5 w-2.5" />
              <span>{t('group')}</span>
            </button>
            <button
              onClick={() => addRepositoryInteractive()}
              className="flex items-center gap-0.5 text-[9px] bg-[#1e2024] px-1.5 py-0.5 rounded-full text-zinc-400 font-medium hover:bg-[#2b2e33] hover:text-white transition-colors cursor-pointer"
            >
              <Plus className="h-2.5 w-2.5" />
              <span>{t('repository')}</span>
            </button>
          </div>
        </div>

        <div className="mt-2 space-y-1 pb-8">
          {groups.map(group => renderGroup(group))}

          {unassignedRepos.length > 0 && (
            <div className="space-y-0.5 transition-all bg-transparent border-transparent rounded-none p-0 my-1 pt-4 border-t border-[#1e2024]/40">
              <div className="flex items-center px-3 py-1 text-[9px] font-mono font-bold tracking-widest uppercase text-zinc-500 select-none">
                <span>{t('unassigned_projects') || 'Unassigned Projects'}</span>
                <span className="text-[8px] text-zinc-700 ml-auto">{unassignedRepos.length}</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {unassignedRepos.map(repo => renderRepository(repo))}
              </div>
            </div>
          )}
        </div>
      </div>

      {onOpenHelp && <div className="px-3 pb-3 shrink-0"><button type="button" data-testid="sidebar-help" onClick={onOpenHelp} aria-current={helpActive ? 'page' : undefined} className={`zf-nav-item flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${helpActive ? 'border-[#ff6b00]/35 bg-[#ff6b00]/[0.06] text-white' : 'border-[#2b2e33] text-zinc-400 hover:bg-[#15171a] hover:text-white'}`}><BookOpen aria-hidden="true" className="h-4 w-4 text-[#ff8c3a]" /><span>{uiText("User guide", undefined, (language === 'ru') ? 'ru' : undefined)}</span></button></div>}

      {/* Footer / Bottom Toolbar */}
      <div className="px-3 py-2 border-t border-[#1e2024] bg-[#0c0d0e] shrink-0">
        <div className="flex items-center gap-3">
          {settings?.useMockData === true && <button
            type="button"
            className="text-zinc-500 hover:text-white transition-colors"
            title={t('profile')}
          >
            <Globe className="h-4 w-4" />
          </button>}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="text-zinc-500 hover:text-white transition-colors"
            title={t('settings')}
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className="text-zinc-500 hover:text-white transition-colors"
            title={t('ziaf_assistant')}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="text-zinc-500 hover:text-white transition-colors"
            title={t('command_palette')}
          >
            <Search className="h-4 w-4" />
          </button>
          {settings?.useMockData === true && <button
            type="button"
            className="text-zinc-500 hover:text-white transition-colors"
            title={t('more')}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>}
          <button
            onClick={() => setShowAboutModal(true)}
            className="ml-auto flex items-center gap-1.5 text-[9px] text-zinc-600 hover:text-zinc-300 font-mono transition-colors"
            title={t('about_ziaforge')}
          >
            {t('version')} {appVersion ? appVersion.fullVersion : '…'}
            <span className="flex h-1.5 w-1.5 rounded-full bg-rose-500 hover:scale-125 transition-transform" />
          </button>
        </div>
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed bg-[#15171a] border border-[#2b2e33] rounded-xl shadow-2xl overflow-hidden py-1.5 z-50 text-[11px] text-zinc-300 w-44 select-none animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'group' && (
            <>
              <button
                onClick={() => {
                  const g = findGroupById(groups, contextMenu.targetId)
                  setContextMenu(null)
                  showPrompt(t('rename_group'), g?.name || "", (newName) => {
                    if (newName) renameGroup(contextMenu.targetId, newName)
                  })
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#1e2024] hover:text-white transition-colors cursor-pointer"
              >
                {t('rename_group')}
              </button>
              <button
                onClick={() => {
                  setContextMenu(null)
                  showPrompt(t('enter_subgroup_name'), '', (newSub) => {
                    if (newSub) addGroup(newSub, contextMenu.targetId)
                  })
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#1e2024] hover:text-white transition-colors cursor-pointer"
              >
                {t('add_subgroup')}
              </button>
              
              <div className="border-t border-[#1e2024]/60 my-1" />
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{t('group_color')}</span>
                <button
                  onClick={() => {
                    changeGroupColor(contextMenu.targetId, 'default')
                    setContextMenu(null)
                  }}
                  className="text-[9px] text-zinc-500 hover:text-zinc-300 font-bold cursor-pointer transition-colors"
                >
                  {t('reset') || 'Reset'}
                </button>
              </div>

              {/* Favorites grid */}
              <div className="grid grid-cols-6 gap-1.5 px-3 py-1.5">
                {favoriteColors.map((color, idx) => (
                  <button
                    key={`${color}-${idx}`}
                    title={color}
                    onClick={() => {
                      changeGroupColor(contextMenu.targetId, color)
                      setContextMenu(null)
                    }}
                    className="h-4 w-4 rounded-full border border-[#2b2e33]/60 hover:scale-115 transition-transform cursor-pointer relative"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Custom Picker */}
              <div className="flex items-center justify-between px-3 py-1.5 gap-2 border-t border-[#1e2024]/30">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{t('custom')}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    defaultValue={resolveHexColor(findGroupById(groups, contextMenu.targetId)?.color) || '#ff6b00'}
                    onChange={(e) => {
                      changeGroupColor(contextMenu.targetId, e.target.value)
                    }}
                    className="h-5 w-5 bg-transparent border-0 rounded cursor-pointer p-0"
                  />
                  <button
                    onClick={() => {
                      const g = findGroupById(groups, contextMenu.targetId)
                      const hex = resolveHexColor(g?.color)
                      if (hex) {
                        const updated = [hex, ...favoriteColors.filter(c => c !== hex)].slice(0, 12)
                        setFavoriteColors(updated)
                      }
                    }}
                    className="text-[9px] font-bold bg-[#1e2024] hover:bg-[#2b2e33] text-zinc-400 hover:text-white px-2 py-0.5 rounded cursor-pointer transition-colors"
                    title={uiText("Add to Favorites")}
                  >
                    {t('save_color') || '+ Save'}
                  </button>
                </div>
              </div>
              
              <div className="border-t border-[#1e2024]/60 my-1" />
              <button
                onClick={() => {
                  deleteGroup(contextMenu.targetId)
                  setContextMenu(null)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 hover:text-rose-400 text-rose-500 transition-colors"
              >
                {t('delete_group')}
              </button>
            </>
          )}

          {contextMenu.type === 'repo' && (
            <>
              <div className="px-3 py-1 text-[9px] font-bold text-[#ff6b00] uppercase tracking-wider">{t('move_to_group')}</div>
              <button
                onClick={() => {
                  moveRepoToGroup(contextMenu.targetId, null)
                  setContextMenu(null)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#1e2024] hover:text-white transition-colors pl-6"
              >
                {t('none_unassigned')}
              </button>
              {getAllGroupsFlat(groups).map(g => (
                <button
                  key={g.id}
                  onClick={() => {
                    moveRepoToGroup(contextMenu.targetId, g.id)
                    setContextMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#1e2024] hover:text-white transition-colors pl-6 truncate"
                >
                  {g.name}
                </button>
              ))}
              
              <div className="border-t border-[#1e2024]/60 my-1" />
              <button
                onClick={() => {
                  const repoId = contextMenu.targetId
                  const repoName = repositories.find(r => r.id === repoId)?.name || 'Project'
                  showDeleteRepoDialog(repoId, repoName, (options) => {
                    void deleteRepository(repoId, options).catch(error => alert(error instanceof Error ? error.message : String(error)))
                  })
                  setContextMenu(null)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 hover:text-rose-400 text-rose-500 transition-colors cursor-pointer"
              >
                {t('delete_repository') || 'Delete Repository'}
              </button>
            </>
          )}
        </div>
      )}

      {/* About ZIAForge Modal Overlay */}
      {showAboutModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setShowAboutModal(false)}
        >
          <div 
            className="relative bg-[#0c0d0e]/95 border border-[#ff6b00]/30 shadow-[0_0_50px_rgba(255,107,0,0.15)] rounded-2xl w-[420px] overflow-hidden p-0 flex flex-col items-center text-center animate-scale-up animate-duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Right Close Button */}
            <button 
              onClick={() => setShowAboutModal(false)}
              className="absolute top-3.5 right-3.5 z-20 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-[#2b2e33]/50"
              title={t('close')}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Widescreen Splash Banner instead of app icon */}
            <div className="w-full h-60 overflow-hidden relative bg-[#090a0c] border-b border-[#1e2024]">
              <img 
                src="./splash-logo.jpeg" 
                alt={uiText("ZIAForge Splash")}
                className="w-full h-full object-cover"
              />
            </div>

            {/* App details & Content */}
            <div className="px-7 pb-7 pt-4 space-y-4 w-full flex flex-col items-center">
              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-white tracking-widest font-mono">ZIAFORGE</h2>
                <p className="text-[10px] text-[#ff6b00] font-bold uppercase tracking-widest font-mono">{t('about_slogan')}</p>
                <p className="text-[11.5px] text-zinc-400 font-mono">
                  {t('version')} {appVersion ? appVersion.fullVersion : '…'}
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#121316] border border-[#2b2e33] text-[9.5px] font-bold font-mono text-zinc-400 mt-1 select-none">
                  <span className={`w-1.5 h-1.5 rounded-full ${appVersion?.isDev !== false ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span>{t('build_type')}: {appVersion?.isDev !== false ? t('build_dev') : t('build_release')}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-[11.5px] text-zinc-400 leading-relaxed px-1 select-text">
                {t('about_desc')}
              </p>

              <a
                href="https://ziaforge.studio/"
                onClick={(e) => {
                  e.preventDefault()
                  window.ziafAPI.openExternal('https://ziaforge.studio/').catch(err => console.error('Failed to open project website:', err))
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 w-full rounded-xl text-xs font-bold text-white bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-zinc-800 hover:to-zinc-700 border border-zinc-700 hover:border-[#ff6b00]/30 shadow-md transition-all select-none cursor-pointer"
              >
                <Globe className="h-4 w-4 text-[#ff6b00]" aria-hidden="true" />
                <span>{t('browser_preview_open')} · <bdi>ziaforge.studio</bdi></span>
              </a>

              {/* Github Repository button */}
              <a 
                href="https://github.com/ziaforge/ziaforge" 
                onClick={(e) => {
                  e.preventDefault()
                  window.ziafAPI.openExternal("https://github.com/ziaforge/ziaforge")
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 w-full rounded-xl text-xs font-bold text-white bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-zinc-800 hover:to-zinc-700 border border-zinc-700 hover:border-[#ff6b00]/30 shadow-md transition-all select-none cursor-pointer"
              >
                <Link2 className="h-4 w-4 text-[#ff6b00]" />
                <span>{t('github_repository')}</span>
              </a>

              {/* Copyright Footer */}
              <div className="w-full pt-4 border-t border-[#1e2024]/60 text-[10px] text-zinc-600 font-medium font-mono">
                Copyright &copy; 2026 ZIAForge
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
