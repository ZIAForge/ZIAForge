import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  ArrowUp,
  Square,
  Paperclip,
  LoaderCircle,
} from 'lucide-react'
import { useTranslation } from '../../i18n'
import {
  ModelSelectorDropdown,
  type ModelOption,
} from './ModelSelectorDropdown'
import {
  ComposerAttachments,
  type ComposerAttachment,
} from './ComposerAttachments'
import {
  ActiveProcessesToolbar,
  type ActiveProcessItem,
} from './ActiveProcessesToolbar'

export type { ModelOption, ComposerAttachment, ActiveProcessItem }

export interface ComposerProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onSend?: (message: string, attachments: ComposerAttachment[]) => void | Promise<void>
  onStop?: () => void | Promise<void>
  onQueue?: () => void
  canQueue?: boolean
  isQueueing?: boolean
  queueRetry?: boolean
  isRunning?: boolean
  disabled?: boolean
  canSend?: boolean
  canInterrupt?: boolean
  supportsInterrupt?: boolean
  supportsAttachments?: boolean
  modelSelectionDisabled?: boolean
  onOpenModelSettings?: () => void
  configurationControls?: React.ReactNode
  processState?: 'starting' | 'running' | 'approval' | 'response' | 'interrupting' | 'ready' | 'unavailable'
  placeholder?: string
  selectedModel?: string
  onSelectModel?: (model: string) => void
  modelOptions?: ModelOption[]
  // Custom agent configuration
  onCustomAgentChange?: (agent: string) => void
  customAgent?: string
  agentOptions?: string[]
  customModels?: string[]
  customPermissions?: string
  onCustomPermissionsChange?: (permissions: string) => void
  isLoadingModels?: boolean
  // File attachments
  attachments?: ComposerAttachment[]
  onAttachmentsChange?: (attachments: ComposerAttachment[]) => void
  /** Main-owned chooser for structured attachments; bypasses renderer file-path handling. */
  onPickAttachments?: () => Promise<ComposerAttachment[]>
  // Active processes toolbar
  activeProcesses?: ActiveProcessItem[]
  onKillProcess?: (processId: string, pid?: number) => void
  // Keyboard handlers
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  className?: string
}

export const Composer: React.FC<ComposerProps> = ({
  value: controlledValue,
  defaultValue = '',
  onChange: onControlledChange,
  onSend,
  onStop,
  onQueue,
  canQueue = false,
  isQueueing = false,
  queueRetry = false,
  isRunning = false,
  disabled = false,
  canSend = true,
  canInterrupt = true,
  supportsInterrupt = true,
  supportsAttachments = true,
  modelSelectionDisabled = false,
  onOpenModelSettings,
  configurationControls,
  processState,
  placeholder,
  selectedModel = 'auto',
  onSelectModel,
  modelOptions,
  onCustomAgentChange,
  customAgent = 'Google Antigravity',
  agentOptions,
  customModels = [],
  customPermissions = 'Read & Write',
  onCustomPermissionsChange,
  isLoadingModels = false,
  attachments: controlledAttachments,
  onAttachmentsChange: onControlledAttachmentsChange,
  onPickAttachments,
  activeProcesses = [],
  onKillProcess,
  onKeyDown: onExternalKeyDown,
  className = '',
}) => {
  const { t } = useTranslation()

  // Uncontrolled vs Controlled internal states
  const [internalText, setInternalText] = useState<string>(defaultValue)
  const isControlled = controlledValue !== undefined
  const currentText = isControlled ? controlledValue : internalText

  const [internalAttachments, setInternalAttachments] = useState<ComposerAttachment[]>([])
  const isAttachmentsControlled = controlledAttachments !== undefined
  const currentAttachments = isAttachmentsControlled ? controlledAttachments : internalAttachments

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [lastSendError, setLastSendError] = useState<string | null>(null)
  const [isPicking, setIsPicking] = useState(false)

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(false)
  const submittingRef = useRef(false)
  const textEditRevision = useRef(0)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Handle textarea text change
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value
      textEditRevision.current += 1
      setLastSendError(null)
      if (!isControlled) {
        setInternalText(newVal)
      }
      onControlledChange?.(newVal)
    },
    [isControlled, onControlledChange]
  )

  // Adjust textarea height dynamically
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 200)
    textarea.style.height = `${Math.max(newHeight, 44)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [currentText, adjustHeight])

  // Attachments update helper
  const updateAttachments = useCallback(
    (nextAttachments: ComposerAttachment[]) => {
      if (!isAttachmentsControlled) {
        setInternalAttachments(nextAttachments)
      }
      onControlledAttachmentsChange?.(nextAttachments)
    },
    [isAttachmentsControlled, onControlledAttachmentsChange]
  )
  const updateAttachmentsRef = useRef(updateAttachments)
  updateAttachmentsRef.current = updateAttachments

  // Add files
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !supportsAttachments || onPickAttachments) return
    const files = e.target.files
    if (!files || files.length === 0) return

    const newAttachments: ComposerAttachment[] = Array.from(files).map((file, idx) => ({
      id: `att-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      size: file.size,
      path: (file as { path?: string }).path || undefined,
    }))

    updateAttachments([...currentAttachments, ...newAttachments])

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Remove file
  const handleRemoveAttachment = (attachmentId: string) => {
    if (disabled) return
    const filtered = currentAttachments.filter((att) => att.id !== attachmentId)
    updateAttachments(filtered)
  }

  const latestControlledValueRef = useRef(controlledValue)
  latestControlledValueRef.current = controlledValue

  const latestControlledAttachmentsRef = useRef(controlledAttachments)
  latestControlledAttachmentsRef.current = controlledAttachments

  const latestInternalTextRef = useRef(internalText)
  latestInternalTextRef.current = internalText

  const latestInternalAttachmentsRef = useRef(internalAttachments)
  latestInternalAttachmentsRef.current = internalAttachments

  // Send action: protects draft against data loss upon onSend rejection and preserves newly injected draft
  const handleSend = useCallback(async () => {
    const trimmed = currentText.trim()
    if (!trimmed && currentAttachments.length === 0) return
    if (disabled || submittingRef.current || !canSend) return

    const messageToSend = currentText
    const sentTextRevision = textEditRevision.current
    const attachmentsToSend = [...currentAttachments]

    submittingRef.current = true
    // Focus belongs to the accepted user action, never to a delayed ACK.
    // Keeping the textarea enabled lets the next draft be typed immediately.
    textareaRef.current?.focus({ preventScroll: true })
    setIsSubmitting(true)
    setLastSendError(null)

    try {
      if (onSend) {
        await Promise.resolve(onSend(messageToSend, attachmentsToSend))
      }
      // A remounted chat may already contain a newer draft. Its old Composer
      // must not invoke controlled onChange after the original view is gone.
      if (!mountedRef.current) return
      // Clear ONLY if the user/parent has not changed the draft during transmission
      if (!isControlled) {
        if (textEditRevision.current === sentTextRevision && latestInternalTextRef.current === messageToSend) {
          setInternalText('')
          onControlledChange?.('')
        }
      } else {
        if (textEditRevision.current === sentTextRevision && latestControlledValueRef.current === messageToSend) {
          onControlledChange?.('')
        }
      }

      const sentIds = new Set(attachmentsToSend.map((a) => a.id))
      if (!isAttachmentsControlled) {
        const next = latestInternalAttachmentsRef.current.filter((a) => !sentIds.has(a.id))
        setInternalAttachments(next)
        onControlledAttachmentsChange?.(next)
      } else {
        if (
          latestControlledAttachmentsRef.current &&
          latestControlledAttachmentsRef.current.some((a) => sentIds.has(a.id))
        ) {
          const next = latestControlledAttachmentsRef.current.filter((a) => !sentIds.has(a.id))
          onControlledAttachmentsChange?.(next)
        }
      }
    } catch (err) {
      if (!mountedRef.current) return
      const errMsg = err instanceof Error ? err.message : String(err)
      setLastSendError(errMsg)
      // Draft and attachments are PRESERVED for retry
    } finally {
      submittingRef.current = false
      if (mountedRef.current) setIsSubmitting(false)
    }
  }, [
    currentText,
    currentAttachments,
    disabled,
    canSend,
    isControlled,
    isAttachmentsControlled,
    onControlledChange,
    onControlledAttachmentsChange,
    onSend,
  ])

  // Key down handler with IME composition guard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore Enter if composing with IME (Japanese, Chinese, etc.)
    if ((e.nativeEvent as KeyboardEvent).isComposing) {
      return
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      onExternalKeyDown?.(e)
      return
    }

    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault()
        if (currentText.trim() || currentAttachments.length > 0) {
          handleSend()
        } else {
          onExternalKeyDown?.(e)
        }
        return
      }
    }

    onExternalKeyDown?.(e)
  }

  const hasContent = currentText.trim().length > 0 || currentAttachments.length > 0
  const effectivePlaceholder = placeholder || t('chat_input_placeholder') || 'Введите ваш запрос...'

  return (
    <div className={`space-y-2 select-none ${className}`} data-testid="composer-container">
      {/* Active Processes Toolbar if any */}
      <ActiveProcessesToolbar
        activeProcesses={activeProcesses}
        disabled={disabled}
        onKillProcess={onKillProcess}
      />

      {/* Attachments Chips List */}
      <ComposerAttachments
        attachments={currentAttachments}
        disabled={disabled}
        onRemoveAttachment={handleRemoveAttachment}
      />

      {processState && <div role="status" data-testid="composer-process-status" data-state={processState} className="flex items-center gap-2 px-1 text-xs text-zinc-400">
        {['starting', 'running', 'interrupting'].includes(processState) ? <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin text-[#ff6b00]" /> : <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${processState === 'ready' ? 'bg-emerald-400' : processState === 'approval' || processState === 'response' ? 'bg-amber-400' : 'bg-zinc-500'}`} />}
        <span>{t(processState === 'response' ? 'provider_interaction_waiting' : `composer_process_${processState}`)}</span>
      </div>}

      {/* Error Banner if transmission failed */}
      {lastSendError && (
        <div role="alert" className="px-3 py-1.5 text-xs text-rose-300 bg-rose-950/20 border border-rose-500/30 rounded-lg flex items-center justify-between">
          <span>{lastSendError}</span>
          <button
            type="button"
            onClick={() => setLastSendError(null)}
            className="text-zinc-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Input Container */}
      <div className="relative border border-[#2b2e33] rounded-xl bg-[#0f1012] focus-within:border-[#ff6b00]/60 transition-colors shadow-lg">
        <textarea
              dir="auto"
          ref={textareaRef}
          data-testid="composer-input"
          value={currentText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent border-none px-4 pt-3 pb-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed min-h-[52px]"
        />

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={disabled || !supportsAttachments || Boolean(onPickAttachments)}
          onChange={handleFilesSelected}
          className="hidden"
          data-testid="composer-file-input"
        />

        {/* Bottom Actions Bar */}
        <div className="relative flex flex-wrap items-end justify-between gap-y-2 px-3 pb-2.5 pointer-events-auto">
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-3">
            {/* Attachment Button */}
            <button
              type="button"
              disabled={disabled || isSubmitting || isPicking || !supportsAttachments}
              onClick={() => {
                if (!onPickAttachments) { fileInputRef.current?.click(); return }
                setIsPicking(true)
                void onPickAttachments().then(items => { if (mountedRef.current && items.length) updateAttachmentsRef.current([...(latestControlledAttachmentsRef.current ?? latestInternalAttachmentsRef.current), ...items]) })
                  .catch(error => { if (mountedRef.current) setLastSendError(error instanceof Error ? error.message : String(error)) })
                  .finally(() => { if (mountedRef.current) setIsPicking(false) })
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2024] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={t(supportsAttachments ? 'attach_files' : 'attachments_unavailable')}
              data-testid="composer-attach-button"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Model Selector Dropdown */}
            {configurationControls ?? (onOpenModelSettings ? <button type="button" data-testid="composer-model-selector-btn" disabled={disabled || isSubmitting || modelSelectionDisabled} onClick={onOpenModelSettings} className="min-w-0 max-w-64 truncate rounded-lg border border-[#2b2e33] bg-[#1e2024] px-2 py-1 text-xs text-zinc-300 disabled:opacity-40" title={t('agent_chat_settings')}>{selectedModel}</button> : <ModelSelectorDropdown
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
              modelOptions={modelOptions}
              customAgent={customAgent}
              agentOptions={agentOptions}
              onCustomAgentChange={onCustomAgentChange}
              customModels={customModels}
              customPermissions={customPermissions}
              onCustomPermissionsChange={onCustomPermissionsChange}
              isLoadingModels={isLoadingModels}
              disabled={disabled || isSubmitting || modelSelectionDisabled}
            />)}
          </div>

          {/* Right Action: Queue, Send and/or Stop */}
          <div className="flex shrink-0 items-center gap-2">
            {onQueue && <button type="button" data-testid="composer-queue-button" disabled={disabled || !canQueue || (!currentText.trim() && !queueRetry) || isSubmitting || isQueueing} onClick={onQueue} className="rounded-lg border border-[#2b2e33] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white disabled:opacity-40">{t(isQueueing ? 'agent_queue_saving' : queueRetry ? 'agent_queue_retry' : 'agent_queue_add')}</button>}
            {isRunning && supportsInterrupt && (
              <button
                type="button"
                disabled={disabled || !canInterrupt}
                onClick={onStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-rose-400 hover:text-white border border-rose-500/30 transition-all font-semibold text-xs cursor-pointer shadow-sm"
                data-testid="composer-stop-button"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>{t('stop') || 'Остановить'}</span>
              </button>
            )}
            {(!isRunning || !supportsInterrupt || hasContent) && (
              <button
                type="button"
                disabled={disabled || !canSend || !hasContent || isSubmitting}
                onClick={handleSend}
                className="p-2 rounded-lg bg-[#ff6b00] hover:bg-[#ff7c1a] disabled:opacity-40 disabled:hover:bg-[#ff6b00] disabled:cursor-not-allowed text-white transition-all cursor-pointer shadow-md"
                data-testid="composer-send-button"
                title={t('start') || 'Отправить'}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const MemoComposer = React.memo(Composer)
