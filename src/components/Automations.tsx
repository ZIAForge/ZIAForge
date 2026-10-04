import { uiText } from '../uiText'
import React, { useState, useMemo } from 'react'
import { useStore, Automation } from '../store'
import { useTranslation } from '../i18n'
import { Activity, Play, Pause, Plus, RefreshCcw, Sparkles, Folder, ListTodo, ArrowRight, Calendar, BarChart3 } from 'lucide-react'

export const Automations: React.FC = () => {
  const { t } = useTranslation()
  const { automations, updateAutomationStatus, addAutomation, runAutomationNow } = useStore()
  
  const [automationTab, setAutomationTab] = useState<'workspace' | 'in-task'>('workspace')
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Alert banner states for instant run triggers
  const [triggeredAlerts, setTriggeredAlerts] = useState<Record<string, boolean>>({})

  // Form State for new automation
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newSchedule, setNewSchedule] = useState('Every 24 hours')
  const [newTarget, setNewTarget] = useState('ZIAForge')

  const handleToggle = (id: string, currentStatus: Automation['status']) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active'
    updateAutomationStatus(id, nextStatus)
  }

  const handleRunNow = (id: string) => {
    runAutomationNow(id)
    setTriggeredAlerts(prev => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setTriggeredAlerts(prev => ({ ...prev, [id]: false }))
    }, 2500)
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    addAutomation({
      name: newName,
      description: newDesc,
      schedule: automationTab === 'workspace' ? newSchedule : undefined,
      type: automationTab === 'in-task' ? 'task' : 'workspace',
      status: 'active',
      targetProject: newTarget
    })
    setShowAddModal(false)
    setNewName('')
    setNewDesc('')
  }

  const filtered = automations.filter(a =>
    automationTab === 'workspace' ? a.type === 'workspace' : a.type === 'task'
  )

  // Group filtered automations by targetProject
  const groupedByProject = useMemo(() => {
    const groups: Record<string, Automation[]> = {}
    for (const auto of filtered) {
      const project = auto.targetProject || 'Ungrouped'
      if (!groups[project]) groups[project] = []
      groups[project].push(auto)
    }
    return groups
  }, [filtered])

  return (
    <div className="flex flex-col h-full bg-[#0b0c0e] text-zinc-300 overflow-hidden relative">
      
      {/* Header */}
      <div className="h-12 border-b border-[#1e2024] bg-[#0f1012] flex items-center px-6 gap-3 shrink-0 select-none justify-between drag-region">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-indigo-400" />
          <span className="text-sm font-semibold text-white">{t('manage_automations')}</span>
          <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium font-mono uppercase tracking-wider">{uiText("Loops")}</span>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 bg-[#1e2024] hover:bg-[#2b2e33] text-zinc-200 border border-[#2b2e33] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors no-drag-region"
        >
          <Plus className="h-3.5 w-3.5 text-indigo-400" />
          <span>{t('new_automation')}</span>
        </button>
      </div>

      {/* Tab Toggle */}
      <div className="px-6 pt-4 pb-2 shrink-0 select-none no-drag-region">
        <div className="bg-[#0f1012] rounded-lg border border-[#1e2024] inline-flex p-1 gap-1">
          <button
            onClick={() => setAutomationTab('workspace')}
            className={`flex items-center gap-1.5 text-xs font-medium transition-all ${
              automationTab === 'workspace'
                ? 'bg-[#1e2024] text-white rounded-md px-3 py-1.5'
                : 'text-zinc-400 hover:text-zinc-200 px-3 py-1.5'
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            <span>{t('workspace')}</span>
          </button>
          <button
            onClick={() => setAutomationTab('in-task')}
            className={`flex items-center gap-1.5 text-xs font-medium transition-all ${
              automationTab === 'in-task'
                ? 'bg-[#1e2024] text-white rounded-md px-3 py-1.5'
                : 'text-zinc-400 hover:text-zinc-200 px-3 py-1.5'
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" />
            <span>{t('in_task')}</span>
          </button>
        </div>
      </div>

      {/* Automations Cards View — grouped by project */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-zinc-600 text-xs italic select-none">
            {t('no_automations_placeholder')}
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            {Object.entries(groupedByProject).map(([project, items]) => (
              <div key={project}>
                {/* Project group header */}
                <div className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
                  {project}
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
                </div>

                {/* Automation cards for this project */}
                <div className="grid grid-cols-2 gap-4">
                  {items.map(auto => {
                    const isActive = auto.status === 'active'
                    const isTriggered = triggeredAlerts[auto.id] === true
                    
                    return (
                      <div 
                        key={auto.id}
                        className={`bg-[#15171a] border rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-md transition-all ${
                          isActive ? 'border-[#1e2024]' : 'border-dashed border-zinc-800 opacity-60'
                        }`}
                      >
                        
                        {/* Card Title & Pause trigger */}
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="text-xs font-bold text-white block truncate">{auto.name}</span>
                            <p className="text-[10.5px] text-zinc-500 mt-1 leading-normal line-clamp-2 select-text">{auto.description}</p>
                          </div>

                          <button
                            onClick={() => handleToggle(auto.id, auto.status)}
                            className={`p-1.5 rounded-lg border transition-all shrink-0 select-none ${
                              isActive 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20' 
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                          </button>
                        </div>

                        {/* Telemetry data rows */}
                        <div className="grid grid-cols-3 gap-2 bg-[#0f1012] rounded-lg p-2.5 text-[10px] text-zinc-500 border border-[#1e2024]/40 font-mono">
                          <div className="space-y-0.5">
                            <span className="text-zinc-600 block uppercase font-bold text-[8px]">{uiText("Trigger")}</span>
                            <span className="text-zinc-400 truncate block">
                              {auto.schedule ? auto.schedule : 'Manual Run'}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-zinc-600 block uppercase font-bold text-[8px]">{uiText("Target Repository")}</span>
                            <span className="text-zinc-400 truncate block">
                              {auto.targetProject ? auto.targetProject : 'Global'}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-zinc-600 block uppercase font-bold text-[8px]">{uiText("Executions")}</span>
                            <span className="text-zinc-400 block font-bold">
                              {auto.runsCount} {t('runs')}
                            </span>
                          </div>
                        </div>

                        {/* Triggered Success Alert inline banner */}
                        {isTriggered && (
                          <div className="bg-indigo-500/10 border border-indigo-500/25 p-2 rounded text-[10px] text-indigo-400 flex items-center gap-1.5 font-bold animate-fade-in font-mono">
                            <Check className="h-3 w-3 animate-pulse" />
                            <span>{t('automation_success_alert')}</span>
                          </div>
                        )}

                        {/* Status footer labels & Run now button */}
                        <div className="flex justify-between items-center text-[10px] select-none border-t border-[#1e2024]/40 pt-3">
                          <span className="text-zinc-600 font-bold uppercase tracking-wider font-mono">
                            {t('state')}: {auto.status}
                          </span>
                          
                          <button 
                            onClick={() => handleRunNow(auto.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1e2024] hover:bg-[#2b2e33] text-zinc-300 font-semibold border border-[#2b2e33] transition-colors"
                          >
                            <RefreshCcw className="h-3 w-3 text-indigo-400" />
                            <span>{t('run_now')}</span>
                          </button>
                        </div>

                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* How in-task automations work — only on in-task tab */}
        {automationTab === 'in-task' && (
          <div className="mt-8 max-w-4xl">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">{t('how_task_automations_work')}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#15171a] rounded-xl border border-[#1e2024] p-5">
                <Sparkles className="h-5 w-5 text-zinc-400 mb-3" />
                <div className="text-sm font-semibold text-white mb-2">{t('create_from_chat')}</div>
                <p className="text-xs text-zinc-500 leading-relaxed">{uiText("Open a task and ask the agent to set up a recurring automation from the chat.")}</p>
              </div>
              <div className="bg-[#15171a] rounded-xl border border-[#1e2024] p-5">
                <Calendar className="h-5 w-5 text-zinc-400 mb-3" />
                <div className="text-sm font-semibold text-white mb-2">{t('runs_on_schedule')}</div>
                <p className="text-xs text-zinc-500 leading-relaxed">{uiText("The agent runs recurring sessions inside the task at the interval you set.")}</p>
              </div>
              <div className="bg-[#15171a] rounded-xl border border-[#1e2024] p-5">
                <BarChart3 className="h-5 w-5 text-zinc-400 mb-3" />
                <div className="text-sm font-semibold text-white mb-2">{t('track_progress_here')}</div>
                <p className="text-xs text-zinc-500 leading-relaxed">{uiText("View all in-task automations across your workspace, pause them, or check run history.")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Automation Modal Overlay */}
      {showAddModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-[#15171a] border border-[#2b2e33] rounded-xl shadow-2xl overflow-hidden animate-scale-up text-left text-xs">
            <div className="bg-[#0f1012] border-b border-[#1e2024] p-4 flex gap-2 items-center">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="font-bold text-white uppercase tracking-wider">{t('configure_automation_loop')}</span>
            </div>

            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">{t('automation_title')}</label>
                <input 
                  type="text" 
                  required
                  placeholder={t('automation_title_placeholder')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">{t('detailed_description')}</label>
                <textarea
                  rows={3}
                  placeholder={t('detailed_description_placeholder')}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">{t('target_repository')}</label>
                  <select 
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2 py-2 text-white focus:outline-none"
                  >
                    <option value="ZIAForge">ZIAForge</option>
                    <option value="app.deepaudit.ai">app.deepaudit.ai</option>
                    <option value="ZIAForge AI Engine">ZIAForge AI Engine</option>
                    <option value="SaaS Billing Portal">SaaS Billing Portal</option>
                  </select>
                </div>

                {automationTab === 'workspace' && (
                  <div>
                    <label className="block text-zinc-400 font-semibold mb-1">{t('schedule_interval')}</label>
                    <select
                      value={newSchedule}
                      onChange={(e) => setNewSchedule(e.target.value)}
                      className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2 py-2 text-white focus:outline-none"
                    >
                      <option value="Every 30 minutes">{uiText("Every 30 minutes")}</option>
                      <option value="Every 4 hours">{uiText("Every 4 hours")}</option>
                      <option value="Every 24 hours">{uiText("Every 24 hours")}</option>
                      <option value="Every Saturday, 12:00">{uiText("Every Saturday, 12:00")}</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-[#1e2024] pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md"
                >
                  {t('deploy_automation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

// Inline check icon definition
const Check: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)
