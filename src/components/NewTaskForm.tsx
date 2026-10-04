import { flowLabel } from '../features/workspace/localizedLabels'
import { uiText } from '../uiText'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, type Task } from '../store'
import type { WorkflowReviewSource } from '../../shared/workflow'
import { useTranslation } from '../i18n'
import { resolveDefaultPreset, structuredProvider } from '../features/workspace/modelSelection'
import { AgentSelectionFields, type ChatConfiguration } from '../features/workspace/ChatSettingsPanel'
import { WorkflowAgentSelector } from '../features/workspace/WorkflowAgentSelector'
import { WorkNewTask } from '../features/workspace/WorkNewTask'
import { clearCodeStartIntent, readCodeStartIntent, saveCodeStartIntent } from '../features/workspace/codeStartIntent'
import { 
  ArrowRight,
  Sparkles,
  Bug,
  BookOpen,
  FileCheck,
  Zap,
  Check,
  ChevronDown,
  Plus,
  Code2,
  BriefcaseBusiness,
  FolderGit2,
  GitBranch,
  Workflow
} from 'lucide-react'

export const NewTaskForm: React.FC = () => {
  const { t } = useTranslation()
  const { 
    repositories, 
    presets, 
    settings,
    createTask, 
    activeRepoId,
    addRepositoryInteractive
  } = useStore()

  const ru = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const [savedStart] = useState(() => {
    try { return { intent: readCodeStartIntent(), error: '' } }
    catch { return { intent: null, error: 'Saved Code start could not be read. Restore access to local storage before starting another Code task.' } }
  })
  const [startIntent, setStartIntent] = useState(savedStart.intent)
  const intentRef = useRef(startIntent)
  const submitting = useRef(false)
  const textRevision = useRef(0)

  const [activeMode, setActiveMode] = useState<'code' | 'work'>('code')
  const [selectedRepoId, setSelectedRepoId] = useState(savedStart.intent?.repoId || activeRepoId || '')
  const [branchType, setBranchType] = useState(savedStart.intent?.branchType || 'Worktree')
  const [branchName, setBranchName] = useState(() => savedStart.intent?.branchName || `task-${crypto.randomUUID().slice(0, 8)}`)
  const [taskDescription, setTaskDescription] = useState(() => { try { return localStorage.getItem('ziaforge-new-task-draft') ?? savedStart.intent?.description ?? '' } catch { return '' } })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaultModel = resolveDefaultPreset(presets, settings?.defaultCodingPreset)
  const [selectionOverride, setSelection] = useState<ChatConfiguration | null>(() => savedStart.intent ? { presetName: savedStart.intent.model ?? '', provider: savedStart.intent.provider ?? 'codex', model: savedStart.intent.providerModel ?? 'auto', apiConnectionId: savedStart.intent.apiConnectionId, permissions: savedStart.intent.permissions, reasoningEffort: savedStart.intent.reasoningEffort } : null)
  const defaultPreset = presets.find(preset => preset.name === defaultModel)
  const selection: ChatConfiguration = selectionOverride ?? {
    presetName: defaultPreset?.name || '',
    provider: structuredProvider(defaultModel, presets) || 'codex',
    model: defaultPreset?.model || 'auto', apiConnectionId: defaultPreset?.apiConnectionId, permissions: defaultPreset?.permissions, reasoningEffort: defaultPreset?.reasoningEffort,
  }
  const [selectedWorkflow, setSelectedWorkflow] = useState(savedStart.intent?.workflow ?? 'Auto')
  const [advance, setAdvance] = useState<'auto' | 'manual'>(savedStart.intent?.workflowOptions?.advance ?? 'manual')
  const [review, setReview] = useState(savedStart.intent?.workflowOptions?.review ?? true)
  const [reviewer, setReviewer] = useState<WorkflowReviewSource>(() => savedStart.intent?.workflowOptions?.reviewer ?? { id: 'reviewer', presetName: '@task' })
  const [planner, setPlanner] = useState<WorkflowReviewSource>(() => savedStart.intent?.workflowOptions?.planner ?? { id: 'planner', presetName: '@task' })
  const [fixer, setFixer] = useState<WorkflowReviewSource>(() => savedStart.intent?.workflowOptions?.fixer ?? { id: 'fixer', presetName: '@task' })
  const draftTask: Task = { id: 'new-task-selection', repoId: selectedRepoId, name: '', status: 'idle', logs: [], feed: [], todoSteps: [], gitChanges: [],
    model: selection.presetName, agentProvider: selection.provider, providerModel: selection.model, apiConnectionId: selection.apiConnectionId,
    permissions: selection.permissions, reasoningEffort: selection.reasoningEffort }
  const configurationLocked = creating || activeMode === 'code' && !!startIntent
  const codeRepositories = repositories.filter(repo => repo.kind !== 'folder')
  useEffect(() => { try { localStorage.setItem('ziaforge-new-task-draft', taskDescription) } catch { /* The in-memory draft remains usable. */ } }, [taskDescription])

  // Dropdown open/close states
  const [showRepoDropdown, setShowRepoDropdown] = useState(false)
  const [showBranchTypeDropdown, setShowBranchTypeDropdown] = useState(false)

  // Refs for click-outside detection
  const repoDropdownRef = useRef<HTMLDivElement>(null)
  const branchTypeDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (startIntent) return
    if (repositories.some(repo => repo.id === activeRepoId && repo.kind !== 'folder')) {
      setSelectedRepoId(activeRepoId!)
    } else {
      setSelectedRepoId(repositories.find(repo => repo.kind !== 'folder')?.id || '')
    }
  }, [activeRepoId, repositories, startIntent])

  // Close dropdowns when clicking outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    if (repoDropdownRef.current && !repoDropdownRef.current.contains(target)) {
      setShowRepoDropdown(false)
    }
    if (branchTypeDropdownRef.current && !branchTypeDropdownRef.current.contains(target)) {
      setShowBranchTypeDropdown(false)
    }


  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (showRepoDropdown) { setShowRepoDropdown(false); repoDropdownRef.current?.querySelector('button')?.focus() }
      if (showBranchTypeDropdown) { setShowBranchTypeDropdown(false); branchTypeDropdownRef.current?.querySelector('button')?.focus() }
    }
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', escape) }
  }, [handleClickOutside, showRepoDropdown, showBranchTypeDropdown])

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskDescription.trim() && !(activeMode === 'code' && intentRef.current)) return
    if (activeMode === 'code' && !selectedRepoId && !intentRef.current) return

    if (submitting.current || activeMode === 'code' && savedStart.error) return
    if (activeMode === 'code' && !intentRef.current) {
      const selectedRoles = [...(review ? [reviewer] : []), ...(selectedWorkflow === 'Multi-model' ? [planner, fixer] : [])]
      const incompleteRole = selectedRoles.some(role => !role.presetName || role.presetName === '@custom' && (!role.configuration?.model.trim() || role.configuration.provider === 'api' && !role.configuration.apiConnectionId))
      if (!selection.model.trim() || selection.provider === 'api' && !selection.apiConnectionId || incompleteRole || taskDescription.includes('\0')) {
        setError(label('Choose a model and all required workflow roles, select an API connection when needed, and remove NUL characters from the description.', 'Выберите модель и необходимые роли процесса, укажите подключение для API и удалите NUL из описания.'))
        return
      }
    }
    submitting.current = true
    setCreating(true)
    setError(null)
    const submittedRevision = textRevision.current
    const firstLine = taskDescription.trim().split('\n')[0]
    const taskName = firstLine.length > 80 ? firstLine.substring(0, 80) + '…' : firstLine
    try {
      const config = intentRef.current ?? {
        createRequestId: crypto.randomUUID(), startWorkflow: true as const,
        name: taskName, repoId: selectedRepoId, model: selection.presetName, workflow: selectedWorkflow,
        branchType, branchName, description: taskDescription.trim(), provider: selection.provider,
        providerModel: selection.model, apiConnectionId: selection.apiConnectionId, permissions: selection.permissions, reasoningEffort: selection.reasoningEffort,
        workflowOptions: { advance, review, reviewer, ...(selectedWorkflow === 'Multi-model' ? { planner, fixer } : {}) },
      }
      if (config && !intentRef.current) {
        saveCodeStartIntent(config)
        intentRef.current = config; setStartIntent(config)
      }
      const task = await createTask(config.name, config.repoId, config.model ?? '', config.workflow ?? 'Auto', config.branchType ?? 'Worktree', config.branchName ?? '', config.description,
          { provider: config.provider, providerModel: config.providerModel, apiConnectionId: config.apiConnectionId, permissions: config.permissions, reasoningEffort: config.reasoningEffort },
          { createRequestId: config.createRequestId, startWorkflow: true, workflowOptions: config.workflowOptions })
      if (config) {
        clearCodeStartIntent(config.createRequestId)
        intentRef.current = null; setStartIntent(null)
      }
      if (!task.startupError && textRevision.current === submittedRevision && (!config || config.description === taskDescription.trim())) {
        try { localStorage.removeItem('ziaforge-new-task-draft') } catch { /* Creation already succeeded. */ }
      }
      if (task.startupError) setError(task.startupError)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      const attempted = activeMode === 'code' ? intentRef.current : null
      if (attempted) {
        try {
          // A successful read-after-create barrier is the only proof that a
          // rejected preflight did not create a task. Unknown ACKs retain the ID.
          const existing = await window.ziafAPI.lookupCodeStart({ repoId: attempted.repoId, createRequestId: attempted.createRequestId })
          if (existing === null) {
            clearCodeStartIntent(attempted.createRequestId)
            intentRef.current = null; setStartIntent(null)
          }
        } catch { /* Retry the same immutable request if acceptance is unknown. */ }
      }
    } finally { submitting.current = false; setCreating(false) }
  }

  const codeWorkflows = [
    { id: 'Auto', name: t('wf_auto_name'), desc: t('wf_auto_desc'), icon: Sparkles, color: 'text-amber-500 bg-amber-500/10' },
    { id: 'Fix a bug', name: t('wf_fix_bug_name'), desc: t('wf_fix_bug_desc'), icon: Bug, color: 'text-rose-500 bg-rose-500/10' },
    { id: 'Spec first', name: t('wf_spec_first_name'), desc: t('wf_spec_first_desc'), icon: BookOpen, color: 'text-blue-500 bg-blue-500/10' },
    { id: 'Requirements first', name: t('wf_req_first_name'), desc: t('wf_req_first_desc'), icon: FileCheck, color: 'text-purple-500 bg-purple-500/10' },
    { id: 'Multi-model', name: t('wf_multimodel_name'), desc: t('wf_multimodel_desc'), icon: Zap, color: 'text-teal-500 bg-teal-500/10' }
  ]

  const workflows = codeWorkflows

  const selectedRepoName = repositories.find(r => r.id === selectedRepoId)?.name || t('select_repository')
  const branchTypes = ['Worktree', 'Branch']

  return (
    <div className="zf-new-task flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto bg-[#0b0c0e] px-5 text-center text-zinc-300 sm:px-8">
      <div className="h-10 w-full drag-region shrink-0" />
      <div className="max-w-3xl w-full space-y-6 animate-fade-in mt-4 pb-12">
        {/* App Logo */}
        <div className="flex justify-center mb-2">
          <img 
            src="./app-logo.jpeg" 
            alt="ZIAForge Logo" 
            className="h-14 w-14 rounded-2xl object-cover border border-[#ff6b00]/30 shadow-lg"
          />
        </div>

        {/* Title */}
        <div className="space-y-2 border-none">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            {activeMode === 'code' ? t('what_build') : t('what_accomplish')}
          </h2>
          <p className="text-zinc-400 text-sm">
            {activeMode === 'code' 
              ? t('code_mode_desc') 
              : t('work_mode_desc')}
          </p>
        </div>

        {/* Navigation Tab */}
        <div className="flex justify-center select-none">
          <div className="zf-mode-switch flex gap-1 bg-[#15171a] p-1 rounded-xl text-sm border border-[#2b2e33]">
            <button 
              type="button"
              aria-pressed={activeMode === 'code'}
              onClick={() => {
                setActiveMode('code')
                if (startIntent) setSelectedWorkflow(startIntent.workflow ?? 'Auto')
                if (startIntent) setSelection({ presetName: startIntent.model ?? '', provider: startIntent.provider ?? 'codex', model: startIntent.providerModel ?? 'auto', apiConnectionId: startIntent.apiConnectionId, permissions: startIntent.permissions, reasoningEffort: startIntent.reasoningEffort })
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
                activeMode === 'code' ? 'bg-[#1e2024] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Code2 aria-hidden="true" className="h-4 w-4" />{t('code_mode')}
            </button>
            <button 
              type="button"
              aria-pressed={activeMode === 'work'}
              onClick={() => {
                setActiveMode('work')
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
                activeMode === 'work' ? 'bg-[#1e2024] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />{t('work_mode')}
            </button>
          </div>
        </div>

        {activeMode === 'work' ? <WorkNewTask initialSelection={selection} ru={ru} /> : <>
        {/* Input Card Container */}
        <form onSubmit={handleStart} className="zf-task-card bg-[#15171a] border border-[#2b2e33] rounded-2xl p-4 sm:p-5 space-y-4 text-left">
          
          {/* Card Top Row: Selectors */}
          <fieldset disabled={configurationLocked} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Repository Dropdown */}
              <div ref={repoDropdownRef} className="relative">
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">{t('repository')}</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowRepoDropdown(v => !v)
                    setShowBranchTypeDropdown(false)
                  }}
                  className="w-full flex items-center justify-between bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#ff6b00] transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-2"><FolderGit2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-zinc-400" /><span className="truncate">{selectedRepoName}</span></span>
                  <ChevronDown className={`h-3 w-3 text-zinc-500 shrink-0 ml-1 transition-transform ${showRepoDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showRepoDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full z-50 bg-[#15171a] border border-[#2b2e33] rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-3 py-2 border-b border-[#1e2024]">
                      {t('select_repository')}
                    </div>
                    {codeRepositories.map(repo => {
                      const isSelected = repo.id === selectedRepoId
                      return (
                        <button
                          key={repo.id}
                          type="button"
                          onClick={() => {
                            setSelectedRepoId(repo.id)
                            setShowRepoDropdown(false)
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'bg-[#ff6b00]/10 text-[#ff8c3a]'
                              : 'text-zinc-400 hover:bg-[#1e2024] hover:text-white'
                          }`}
                        >
                          <span className="truncate">{repo.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-2" />}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={async () => {
                        setShowRepoDropdown(false)
                        const repoId = await addRepositoryInteractive()
                        if (repoId) {
                          setSelectedRepoId(repoId)
                        }
                      }}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-[#ff6b00] hover:bg-[#1e2024] border-t border-[#1e2024] cursor-pointer font-semibold transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t('add_repository') || 'Add Repository'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Branch Type Dropdown */}
              <div ref={branchTypeDropdownRef} className="relative">
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">{t('branch_type')}</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchTypeDropdown(v => !v)
                    setShowRepoDropdown(false)
                  }}
                  className="w-full flex items-center justify-between bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#ff6b00] transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-2"><GitBranch aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-zinc-400" /><span className="truncate">{t(branchType.toLowerCase())}</span></span>
                  <ChevronDown className={`h-3 w-3 text-zinc-500 shrink-0 ml-1 transition-transform ${showBranchTypeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showBranchTypeDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full z-50 bg-[#15171a] border border-[#2b2e33] rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-3 py-2 border-b border-[#1e2024]">
                      {t('select_branch_type')}
                    </div>
                    {branchTypes.map(type => {
                      const isSelected = type === branchType
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setBranchType(type)
                            setShowBranchTypeDropdown(false)
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'text-white bg-[#1e2024]'
                              : 'text-zinc-400 hover:bg-[#1e2024] hover:text-white'
                          }`}
                        >
                          <span>{t(type.toLowerCase())}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-2 text-[#ff8c3a]" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Branch Name (stays as input) */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">{t('branch_name')}</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="new-task-xxxx"
                  className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#ff6b00]"
                />
              </div>
            </fieldset>
          <div className="relative border border-[#2b2e33] rounded-xl bg-[#0f1012] focus-within:border-[#ff6b00]/60 transition-colors">
            <textarea
              aria-label={label('Task description', 'Описание задачи')}
              value={taskDescription}
              onChange={(e) => { textRevision.current += 1; setTaskDescription(e.target.value) }}
              placeholder={
                activeMode === 'code'
                  ? t('textarea_placeholder_code')
                  : t('textarea_placeholder_work')
              }
              rows={5}
              maxLength={18000}
              className="w-full bg-transparent resize-none border-none p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-0"
            />
            
            <div className="border-t border-[#1e2024] p-3 text-xs">
              <AgentSelectionFields value={selection} onChange={setSelection} presets={presets} disabled={configurationLocked} prefix="new-task-agent" />
              {activeMode === 'code' && <details className="mt-3 rounded-lg border border-zinc-800 p-3 text-left" data-testid="new-code-options">
                <summary className="cursor-pointer text-xs text-zinc-300">{label('Workflow settings and roles', 'Настройки процесса и роли')}</summary>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">{label('Start opens the Forge conversation. Add requirements or discuss technical choices there. Sending a message does not approve a document or implementation plan.', 'Start открывает обсуждение Forge. В нём можно дополнять требования и обсуждать технические решения. Отправка сообщения не означает принятие документа или плана реализации.')}</p>
                <fieldset disabled={configurationLocked} className="mt-3 space-y-3">
                  <label className="flex items-start gap-2"><input type="checkbox" checked={advance === 'auto'} onChange={event => setAdvance(event.target.checked ? 'auto' : 'manual')} data-testid="new-code-auto" />{label('Continue automatically after verified steps', 'Продолжать автоматически после проверенных шагов')}</label>
                  <label className="flex items-start gap-2"><input type="checkbox" checked={review} onChange={event => setReview(event.target.checked)} data-testid="new-code-review" />{label('Independent review', 'Независимое ревью')}</label>
                  <p className="text-[10px] text-zinc-500">{label('Questions and proposed commands always wait for your decision. Disabling review still requires actual verification before implementation can complete.', 'Вопросы и предложенные команды всегда ждут вашего решения. При выключенном ревью завершение реализации всё равно требует реальной проверки.')}</p>
                  {review && <WorkflowAgentSelector value={reviewer} onChange={next => setReviewer({ ...next, id: reviewer.id })} presets={presets} task={draftTask} label={label('Reviewer', 'Ревьюер')} prefix="new-code-reviewer" readOnly disabled={configurationLocked} />}
                  {selectedWorkflow === 'Multi-model' && <>
                    <WorkflowAgentSelector value={planner} onChange={next => setPlanner({ ...next, id: planner.id })} presets={presets} task={draftTask} label={label('Planner', 'Планировщик')} prefix="new-code-planner" readOnly disabled={configurationLocked} />
                    <WorkflowAgentSelector value={fixer} onChange={next => setFixer({ ...next, id: fixer.id })} presets={presets} task={draftTask} label={label('Fixer', 'Исправления после ревью')} prefix="new-code-fixer" disabled={configurationLocked} />
                  </>}
                </fieldset>
              </details>}
              {activeMode === 'code' && startIntent && <p role="status" className="mt-3 text-amber-200" data-testid="new-code-saved-intent">{label('Retry resumes this saved request without creating another task:', 'Повтор продолжит сохранённый запрос без создания второй задачи:')} {startIntent.name} · {flowLabel(startIntent.workflow ?? "")} · {startIntent.providerModel}<br />{label('New draft edits are preserved for later.', 'Новые изменения черновика сохраняются отдельно.')}</p>}
              {activeMode === 'code' && savedStart.error && <p role="alert" className="mt-3 text-rose-300">{label(savedStart.error, 'Не удалось прочитать сохранённый запуск Code. Восстановите доступ к локальному хранилищу перед созданием новой Code-задачи.')}</p>}
              {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
              <div className="mt-3 flex items-center justify-end gap-3">
                <span className="text-[10px] text-zinc-500">{t('draft_saved')}</span>
                <button type="submit" data-testid="new-task-start" disabled={creating || (!taskDescription.trim() && !(activeMode === 'code' && startIntent)) || (activeMode === 'code' && ((!selectedRepoId && !startIntent) || !!savedStart.error))} className="flex items-center gap-1.5 rounded-lg bg-[#ff6b00] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
                  <span>{creating ? label('Starting…', 'Запускается…') : activeMode === 'code' && startIntent ? label('Retry saved start', 'Повторить сохранённый запуск') : t('start')}</span><ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Workflow Selection under the card */}
        <div className="space-y-3 text-left">
          <span className="flex items-center gap-2 text-xs font-semibold text-zinc-400 pl-1"><Workflow aria-hidden="true" className="h-4 w-4 text-[#ff6b00]" />{t('pick_workflow')}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {workflows.map(wf => {
              const Icon = wf.icon
              const isSelected = selectedWorkflow === wf.id
              return (
                <button
                  key={wf.id}
                  type="button"
                  disabled={configurationLocked}
                  aria-pressed={isSelected}
                  data-testid={`new-workflow-${wf.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  onClick={() => setSelectedWorkflow(wf.id)}
                  className={`flex flex-col items-center justify-start p-3 rounded-xl border text-center transition-colors ${
                    isSelected
                      ? 'bg-[#ff6b00]/[0.06] border-[#ff6b00]/65 text-white'
                      : 'bg-[#15171a] border-[#1e2024] hover:bg-[#1a1c21] hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${wf.color} mb-2`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="block min-h-8 w-full break-words text-xs font-bold leading-4">{wf.name}</span>
                  <span className="mt-1 min-h-8 text-[11px] leading-4 text-zinc-400">{wf.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
        </>}
      </div>
    </div>
  )
}
