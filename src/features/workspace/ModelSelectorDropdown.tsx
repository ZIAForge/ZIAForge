import React, { useState, useEffect, useRef } from 'react'
import { Settings, ChevronDown, Check } from 'lucide-react'
import { useTranslation } from '../../i18n'

export interface ModelOption {
  id: string
  label: string
  icon?: string
}

export interface ModelSelectorDropdownProps {
  selectedModel?: string
  onSelectModel?: (model: string) => void
  modelOptions?: ModelOption[]
  customAgent?: string
  agentOptions?: string[]
  onCustomAgentChange?: (agent: string) => void
  customModels?: string[]
  customPermissions?: string
  onCustomPermissionsChange?: (permissions: string) => void
  isLoadingModels?: boolean
  disabled?: boolean
}

export const ModelSelectorDropdown: React.FC<ModelSelectorDropdownProps> = ({
  selectedModel = 'auto',
  onSelectModel,
  modelOptions,
  customAgent = 'Google Antigravity',
  agentOptions = ['Google Antigravity', 'Claude Code', 'Codex'],
  onCustomAgentChange,
  customModels = [],
  customPermissions = 'Read & Write',
  onCustomPermissionsChange,
  isLoadingModels = false,
  disabled = false,
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [tab, setTab] = useState<'presets' | 'custom'>('presets')
  const [localCustomModel, setLocalCustomModel] = useState<string>(() => {
    return modelOptions?.some(preset => preset.label === selectedModel) ? 'auto' : selectedModel
  })
  const [customInput, setCustomInput] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const prevAgentRef = useRef(customAgent)
  const prevSelectedModelRef = useRef<string>(selectedModel)
  // A refreshed catalog must not overwrite an explicit choice or custom input.
  useEffect(() => {
    if (prevAgentRef.current !== customAgent) {
      prevAgentRef.current = customAgent
      setLocalCustomModel('auto')
      setCustomInput(false)
    }
  }, [customAgent])

  // Sync with external selectedModel ONLY when selectedModel prop actually changes
  useEffect(() => {
    if (prevSelectedModelRef.current !== selectedModel) {
      prevSelectedModelRef.current = selectedModel
      setLocalCustomModel(modelOptions?.some(preset => preset.label === selectedModel) ? 'auto' : selectedModel)
      setCustomInput(false)
    }
  }, [selectedModel, modelOptions])

  const showCustomInput = customInput || (localCustomModel !== 'auto' && !customModels.includes(localCustomModel))

  // Close when disabled
  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false)
    }
  }, [disabled, isOpen])

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const translatePermission = (perm: string) => {
    if (perm === 'Dangerously skip permissions') return t('dangerously_skip_permission') || perm
    if (perm === 'Danger full access') return t('danger_full_access') || perm
    if (perm === 'Read only') return t('read_only') || perm
    if (perm === 'Read & Write') return t('read_write') || perm
    return perm
  }

  const effectivePresets = modelOptions || []
  const availableModels = ['auto', ...customModels.filter(model => model !== 'auto')]

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#2b2e33] bg-[#1a1c20] hover:bg-[#24272c] disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-xs font-medium transition-all cursor-pointer"
        data-testid="composer-model-selector-btn"
      >
        <Settings className="h-3 w-3 text-zinc-400" />
        <span className="truncate max-w-[150px]">{selectedModel}</span>
        <ChevronDown className="h-3 w-3 text-zinc-500" />
      </button>

      {isOpen && !disabled && (
        <div
          className="absolute bottom-full left-0 mb-2 w-72 bg-[#15171a] border border-[#2b2e33] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
          data-testid="model-selector-dropdown"
        >
          {/* Dropdown Tabs */}
          <div className="flex border-b border-[#1e2024] bg-[#0c0d0e]/80">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setTab('presets')}
              className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                tab === 'presets'
                  ? 'bg-[#1c1e22] text-[#ff6b00] border-b-2 border-[#ff6b00]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              data-testid="model-tab-presets"
            >
              {t('presets') || 'Presets'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setTab('custom')}
              className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                tab === 'custom'
                  ? 'bg-[#1c1e22] text-[#ff6b00] border-b-2 border-[#ff6b00]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              data-testid="model-tab-custom"
            >
              {t('custom_model') || 'Custom'}
            </button>
          </div>

          {/* Presets Tab */}
          {tab === 'presets' && (
            <div className="max-h-72 overflow-y-auto">
              <div className="p-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-b border-[#1e2024] bg-[#111215]">
                {t('presets') || 'Presets'}
              </div>
              <div className="py-1">
                {effectivePresets.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onSelectModel?.(model.label)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#1e2024] transition-all text-left cursor-pointer ${
                      selectedModel === model.label
                        ? 'text-white font-semibold bg-[#1a1c20]'
                        : 'text-zinc-400'
                    }`}
                  >
                    <span>{model.icon || '🤖'}</span>
                    <span className="flex-1 truncate">{model.label}</span>
                    {selectedModel === model.label && (
                      <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {/* Fast Switch Standard Models */}
              <div className="p-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-t border-b border-[#1e2024] bg-[#111215]">
                {t('models') || 'Models'}
              </div>
              <div className="py-1">
                {availableModels.map((model) => ({ id: model, label: model, icon: '🤖' })).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onSelectModel?.(m.label)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#1e2024] transition-all text-left cursor-pointer ${
                      selectedModel === m.label
                        ? 'text-white font-semibold bg-[#1a1c20]'
                        : 'text-zinc-400'
                    }`}
                  >
                    <span>{m.icon || '🤖'}</span>
                    <span className="flex-1 truncate">{m.label}</span>
                    {selectedModel === m.label && (
                      <Check className="h-3.5 w-3.5 text-white shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Tab */}
          {tab === 'custom' && (
            <div className="p-3.5 space-y-3 bg-[#111215]">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                  {t('coding_agent') || 'Coding Agent'}
                </label>
                <select
                  disabled={disabled}
                  value={customAgent}
                  onChange={(e) => onCustomAgentChange?.(e.target.value)}
                  className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  data-testid="composer-custom-agent-select"
                >
                  {agentOptions.map(agent => <option key={agent} value={agent}>{agent}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                  {t('model') || 'Model'}{' '}
                  {isLoadingModels && <span className="text-zinc-500 font-normal">...</span>}
                </label>
                <select
                  disabled={disabled}
                  value={showCustomInput ? '__custom__' : localCustomModel}
                  onChange={(e) => {
                    const value = e.target.value
                    setCustomInput(value === '__custom__')
                    setLocalCustomModel(value === '__custom__' ? '' : value)
                  }}
                  className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  data-testid="composer-custom-model-select"
                >
                  <option value="auto">{t('model_auto') || 'auto'}</option>
                  {customModels.filter(model => model !== 'auto').map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__custom__">{t('other_custom') || 'Other / Custom'}...</option>
                </select>
                {showCustomInput && (
                  <input
                    value={localCustomModel}
                    onChange={event => setLocalCustomModel(event.target.value)}
                    disabled={disabled}
                    aria-label={t('model') || 'Model'}
                    placeholder={t('agent_chat_model')}
                    data-testid="composer-custom-model-input"
                    className="mt-2 w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                  {t('permissions') || 'Permissions'}
                </label>
                <select
                  disabled={disabled}
                  value={customPermissions}
                  onChange={(e) => onCustomPermissionsChange?.(e.target.value)}
                  className="w-full bg-[#1e2024] border border-[#2b2e33] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  data-testid="composer-custom-permissions-select"
                >
                  <option value="Dangerously skip permissions">
                    {translatePermission('Dangerously skip permissions')}
                  </option>
                  <option value="Danger full access">
                    {translatePermission('Danger full access')}
                  </option>
                  <option value="Read only">{translatePermission('Read only')}</option>
                  <option value="Read & Write">
                    {translatePermission('Read & Write')}
                  </option>
                </select>
              </div>

              <p className="text-[11px] leading-relaxed text-zinc-400" data-testid="legacy-reasoning-unavailable">{t('composer_legacy_reasoning_unavailable')}</p>

              <button
                type="button"
                disabled={disabled || !localCustomModel.trim()}
                onClick={() => {
                  onSelectModel?.(localCustomModel.trim())
                  setIsOpen(false)
                }}
                className="w-full py-1.5 rounded-lg bg-[#ff6b00] hover:bg-[#ff7c1a] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                data-testid="composer-apply-custom-model-btn"
              >
                {t('apply') || 'Apply'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const MemoModelSelectorDropdown = React.memo(ModelSelectorDropdown)
