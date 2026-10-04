import { uiText } from '../../uiText'
import React, { useState } from 'react'
import {
  Check,
  ChevronRight,
  FileJson,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { TodoStep } from '../../store'
import { EditStepModal } from './EditStepModal'

export interface PlanPanelProps {
  taskId?: string
  todoSteps: TodoStep[]
  onToggleStep?: (stepId: string) => void
  onAddStep?: (text: string) => void
  onUpdateStep?: (stepId: string, updates: Partial<TodoStep>, taskId?: string) => void
  onDeleteStep?: (stepId: string, taskId?: string) => void
  onSelectStep?: (step: TodoStep) => void
  onClose?: () => void
  autoStartEnabled?: boolean
  onToggleAutoStart?: (enabled: boolean) => void
  onOpenStructuredPlan?: () => void
  newStepText?: string
  onNewStepTextChange?: (text: string) => void
  className?: string
}

export const PlanPanel: React.FC<PlanPanelProps> = ({
  taskId,
  todoSteps = [],
  onToggleStep,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onSelectStep,
  onClose,
  autoStartEnabled = false,
  onToggleAutoStart,
  onOpenStructuredPlan,
  newStepText,
  onNewStepTextChange,
  className = '',
}) => {
  const { t } = useTranslation()
  const [internalNewStepText, setInternalNewStepText] = useState('')
  const [editingStep, setEditingStep] = useState<TodoStep | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>(taskId)

  // Reset modal when active task changes to prevent updating wrong task
  React.useEffect(() => {
    setEditingStep(null)
    setEditingTaskId(taskId)
  }, [taskId])

  const stepDraft = newStepText !== undefined ? newStepText : internalNewStepText
  const handleDraftChange = (val: string) => {
    if (onNewStepTextChange) {
      onNewStepTextChange(val)
    } else {
      setInternalNewStepText(val)
    }
  }

  const completedCount = todoSteps.filter((s) => s.done).length
  const totalCount = todoSteps.length

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = stepDraft.trim()
    if (!trimmed) return
    onAddStep?.(trimmed)
    handleDraftChange('')
  }

  const handleOpenStep = (step: TodoStep) => {
    onSelectStep?.(step)
    setEditingStep(step)
    setEditingTaskId(taskId)
  }

  return (
    <div
      className={`flex-1 flex flex-col overflow-hidden font-sans bg-[#0f1012] shrink-0 h-full ${className}`}
      data-testid="plan-panel"
    >
      {/* Header */}
      <div className="p-3 border-b border-[#1e2024]/60 bg-[#0c0d0e]/40 select-none">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-white">{uiText("To-do")}</h3>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded bg-[#ff6b00]/20 text-[#ff6b00] font-mono font-bold"
              data-testid="plan-progress-counter"
            >
              {completedCount}/{totalCount}
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-zinc-600 hover:text-white transition-colors cursor-pointer"
              data-testid="plan-panel-close-btn"
              title={t('close') || 'Закрыть'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Structured plan link + Auto-start toggle */}
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={onOpenStructuredPlan}
            className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-[#ff6b00] transition-colors cursor-pointer"
            data-testid="plan-structured-link"
          >
            <FileJson className="h-3 w-3" />
            <span>{t('structured_plan') || 'Структурированный план'} · plan.json</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </button>

          <button
            type="button"
            onClick={() => onToggleAutoStart?.(!autoStartEnabled)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            data-testid="plan-autostart-toggle"
          >
            <span>{t('auto_start') || 'Авто-старт'}</span>
            {autoStartEnabled ? (
              <ToggleRight className="h-4 w-4 text-[#ff6b00]" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-zinc-600" />
            )}
          </button>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2" data-testid="plan-steps-list">
        {todoSteps.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs">
            {t('no_steps') || 'Нет шагов в плане'}
          </div>
        ) : (
          todoSteps.map((step) => (
            <div
              key={step.id}
              className={`group flex items-start gap-3 rounded-lg border p-3 transition-all ${
                step.active
                  ? 'bg-[#ff6b00]/5 border-[#ff6b00]/20 text-white font-medium shadow-sm'
                  : step.done
                  ? 'bg-[#15171a]/30 border-transparent text-zinc-500'
                  : 'bg-[#15171a] border-[#1e2024] text-zinc-300 hover:border-zinc-700'
              }`}
              data-testid={`todo-step-${step.id}`}
            >
              {/* Checkbox triggers done toggle */}
              <button
                type="button"
                onClick={() => onToggleStep?.(step.id)}
                className="flex mt-0.5 items-center justify-center shrink-0 cursor-pointer"
                data-testid={`todo-checkbox-${step.id}`}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500 bg-emerald-500/10 p-0.5 rounded-full" />
                ) : step.active ? (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border border-[#ff6b00] border-t-transparent"
                    data-testid={`todo-active-spinner-${step.id}`}
                  />
                ) : (
                  <div className="h-3.5 w-3.5 rounded border border-zinc-700 hover:border-zinc-500 bg-transparent" />
                )}
              </button>

              <div
                onClick={() => handleOpenStep(step)}
                className="flex-1 min-w-0 cursor-pointer"
                data-testid={`todo-text-${step.id}`}
              >
                <span
                  className={`text-[11.5px] block truncate ${
                    step.done ? 'line-through text-zinc-600' : ''
                  }`}
                >
                  {step.text}
                </span>
                {step.description && !step.done && (
                  <span className="text-[9.5px] text-zinc-500 block truncate mt-0.5">
                    {step.description}
                  </span>
                )}
              </div>

              <ChevronRight
                onClick={() => handleOpenStep(step)}
                className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                data-testid={`todo-chevron-${step.id}`}
              />
            </div>
          ))
        )}
      </div>

      {/* Add Step Form */}
      <div className="p-3 border-t border-[#1e2024] bg-[#0c0d0e] select-none">
        <form onSubmit={handleAddSubmit} className="flex gap-2">
          <input
            type="text"
            required
            placeholder={t('add_step_placeholder') || 'Добавить шаг...'}
            value={stepDraft}
            onChange={(e) => handleDraftChange(e.target.value)}
            className="flex-1 bg-[#15171a] border border-[#2b2e33] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff6b00]"
            data-testid="plan-add-input"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-[#1e2024] hover:bg-[#2b2e33] border border-[#2b2e33] text-xs font-bold text-white transition-all shrink-0 cursor-pointer"
            data-testid="plan-add-button"
          >
            {t('add') || 'Добавить'}
          </button>
        </form>
      </div>

      {/* Modal for editing step */}
      {editingStep && (
        <EditStepModal
          step={editingStep}
          onSave={(updates) => {
            if (editingTaskId === taskId) {
              if (editingTaskId !== undefined) {
                onUpdateStep?.(editingStep.id, updates, editingTaskId)
              } else {
                onUpdateStep?.(editingStep.id, updates)
              }
            }
            setEditingStep(null)
          }}
          onDelete={(id) => {
            if (editingTaskId === taskId) {
              if (editingTaskId !== undefined) {
                onDeleteStep?.(id, editingTaskId)
              } else {
                onDeleteStep?.(id)
              }
            }
            setEditingStep(null)
          }}
          onClose={() => setEditingStep(null)}
        />
      )}
    </div>
  )
}

export const MemoPlanPanel = React.memo(PlanPanel)
