import React, { useState } from 'react'
import { ChevronDown, Check, Trash2 } from 'lucide-react'
import { useTranslation } from '../../i18n'
import type { TodoStep } from '../../store'

export interface EditStepModalProps {
  step: TodoStep
  onSave: (updatedStep: Partial<TodoStep>) => void
  onDelete?: (stepId: string) => void
  onClose: () => void
}

const PRESET_OPTIONS = [
  { value: 'Default Coder', label: 'ZIAFCoder (Default)' },
  { value: 'Claude Code Pro', label: 'Claude Code Pro' },
  { value: 'GPT 5.5 Codex', label: 'GPT 5.5 Codex' },
  { value: 'Gemini 3.5 Flash', label: 'Gemini 3.5 Flash' },
]

export const EditStepModal: React.FC<EditStepModalProps> = ({
  step,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t } = useTranslation()
  const [text, setText] = useState(step.text)
  const [description, setDescription] = useState(step.description || '')
  const [preset, setPreset] = useState(step.preset || 'Default Coder')
  const [startNewChat, setStartNewChat] = useState(Boolean(step.startNewChat))
  const [stopAfterCompletion, setStopAfterCompletion] = useState(Boolean(step.stopAfterCompletion))
  const [showPresetDropdown, setShowPresetDropdown] = useState(false)

  const handleSave = () => {
    onSave({
      text: text.trim() || step.text,
      description: description.trim() || undefined,
      preset,
      startNewChat,
      stopAfterCompletion,
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none"
      data-testid="edit-step-modal"
    >
      <div className="bg-[#15171a] border border-[#2b2e33] rounded-xl shadow-2xl overflow-auto text-left text-xs max-w-lg w-full">
        {/* Header */}
        <div className="bg-[#0f1012] border-b border-[#1e2024] p-4 flex justify-between items-center">
          <span className="font-bold text-white uppercase tracking-wider">
            {t('configure_checklist_step') || 'Настройка шага чек-листа'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-base"
            data-testid="edit-step-close-btn"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-zinc-400 font-semibold mb-1">
              {t('step_name') || 'Название шага'}
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-[#ff6b00]"
              data-testid="edit-step-name-input"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">
              {t('subtext_description') || 'Подтекст / описание'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t('step_desc_placeholder') || 'Дополнительные инструкции для этого шага...'}
              className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-[#ff6b00] resize-none"
              data-testid="edit-step-desc-textarea"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">
              {t('preset_agent_env') || 'Пресет агента / окружения'}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPresetDropdown((prev) => !prev)}
                className="w-full flex items-center justify-between bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2.5 py-2 text-white focus:outline-none hover:border-zinc-600 transition-colors cursor-pointer"
                data-testid="edit-step-preset-btn"
              >
                <span>{preset === 'Default Coder' ? 'ZIAFCoder (Default)' : preset}</span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              </button>
              {showPresetDropdown && (
                <div
                  className="absolute top-full left-0 mt-1 w-full bg-[#15171a] border border-[#2b2e33] rounded-xl shadow-2xl overflow-hidden z-50"
                  data-testid="edit-step-preset-dropdown"
                >
                  {PRESET_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setPreset(opt.value)
                        setShowPresetDropdown(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-all text-left cursor-pointer ${
                        preset === opt.value
                          ? 'text-white bg-[#1e2024]'
                          : 'text-zinc-400 hover:bg-[#1e2024] hover:text-white'
                      }`}
                      data-testid={`preset-opt-${opt.value}`}
                    >
                      <span>{opt.label}</span>
                      {preset === opt.value && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={startNewChat}
                onChange={(e) => setStartNewChat(e.target.checked)}
                className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                data-testid="edit-step-new-chat-checkbox"
              />
              <div>
                <span className="text-zinc-300 font-semibold block">
                  {t('start_new_chat') || 'Начать новый чат'}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {t('delete_cache_desc') || 'Очистить кэш контекста'}
                </span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer border-t border-[#1e2024]/60 pt-3">
              <input
                type="checkbox"
                checked={stopAfterCompletion}
                onChange={(e) => setStopAfterCompletion(e.target.checked)}
                className="rounded bg-[#1e2024] border-[#2b2e33] text-[#ff6b00] focus:ring-[#ff6b00]"
                data-testid="edit-step-stop-checkbox"
              />
              <div>
                <span className="text-zinc-300 font-semibold block">
                  {t('stop_after_completion') || 'Остановить после завершения'}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {t('wait_user_review_desc') || 'Ждать подтверждения пользователя'}
                </span>
              </div>
            </label>
          </div>

          <div className="flex justify-between items-center border-t border-[#1e2024] pt-4 mt-2">
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(step.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-500 bg-rose-500/5 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all font-semibold cursor-pointer"
                data-testid="edit-step-delete-btn"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('delete_step') || 'Удалить шаг'}</span>
              </button>
            )}

            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-semibold cursor-pointer transition-colors"
                data-testid="edit-step-cancel-btn"
              >
                {t('cancel') || 'Отмена'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg bg-[#ff6b00] hover:bg-[#ff7c1a] text-white font-semibold cursor-pointer transition-colors shadow-md"
                data-testid="edit-step-save-btn"
              >
                {t('save_changes') || 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const MemoEditStepModal = React.memo(EditStepModal)
