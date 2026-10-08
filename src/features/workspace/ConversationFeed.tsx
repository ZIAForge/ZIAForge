import { uiText } from '../../uiText'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Cpu,
  User,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Square,
  Terminal,
  GitCommit,
  FileText,
  HelpCircle,
} from 'lucide-react'
import { useTranslation } from '../../i18n'
import type {
  ReconstructedMessage,
  ReconstructedToolItem,
} from '../../../shared/agent-events'
import type { FeedItem } from '../../store'
import { MemoApprovalCard } from './ApprovalCard'
import { MarkdownMessage } from '../../components/MarkdownMessage'
import { WorkflowMessageText } from './WorkflowMessageText'
import { GeneratedMedia, type AgentMediaOwner } from './GeneratedMedia'

export interface ConversationFeedProps {
  messages?: ReconstructedMessage[]
  feedItems?: FeedItem[]
  answeredPromptIds?: Record<string, string>
  onResolveApproval?: (approvalId: string, decision: 'allow' | 'deny') => void | Promise<void>
  onStopTool?: (callId: string, command?: string) => void
  onReviewWithModel?: (model: string, diff?: string) => void
  onPromptAction?: (actionId: string, promptId: string) => void
  className?: string
  autoScroll?: boolean
  workflowTitle?: string
  workflowKind?: 'work'
  mediaOwner?: AgentMediaOwner
}

export type FeedRow =
  | { kind: 'message'; message: ReconstructedMessage }
  | { kind: 'legacy'; item: FeedItem }

/**
 * Extracts a runnable shell/process command string from a tool's input payload.
 */
function commandFromInput(input: unknown): string | undefined {
  if (typeof input === 'string') return input
  if (
    input !== null &&
    typeof input === 'object' &&
    'command' in input &&
    typeof (input as { command: unknown }).command === 'string'
  ) {
    return (input as { command: string }).command
  }
  return undefined
}

/**
 * Formats arbitrary payloads safely into string representation without discarding 0 or false.
 */
function formatPayload(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const legacyRowCache = new WeakMap<FeedItem, FeedRow[]>()

/**
 * Unifies incoming messages array or legacy store feed items into FeedRow items.
 */
function unifyFeedRows(
  messages?: ReconstructedMessage[],
  feedItems?: FeedItem[]
): FeedRow[] {
  if (messages) {
    return messages.map((m) => ({ kind: 'message', message: m }))
  }

  if (!feedItems) return []

  const rows: FeedRow[] = []

  for (const item of feedItems) {
    const cached = legacyRowCache.get(item)
    if (cached) {
      rows.push(...cached)
      continue
    }

    let itemRows: FeedRow[] = []

    if (item.type === 'user') {
      itemRows = [
        {
          kind: 'message',
          message: {
            id: item.id,
            role: 'user',
            text: item.text || '',
            thinking: '',
            status: 'completed',
            timestamp: Date.now(),
          },
        },
      ]
    } else if (item.type === 'ai') {
      itemRows = [
        {
          kind: 'message',
          message: {
            id: item.id,
            role: 'assistant',
            text: item.text || '',
            thinking: '',
            status: 'completed',
            timestamp: Date.now(),
          },
        },
      ]
    } else if (item.type === 'tools') {
      const legacyTools = item.tools ?? []
      const thinking = legacyTools
        .filter((t) => t.type === 'thinking')
        .map((t) => t.content)
        .filter(Boolean)
        .join('\n\n')

      const ranTools: ReconstructedToolItem[] = legacyTools
        .filter((t) => t.type === 'ran')
        .map((t, idx) => ({
          callId: (t as { id?: string }).id || `tool-${item.id}-${idx}`,
          toolName: t.title || 'command',
          input: t.content,
          status: t.isRunning ? 'running' : 'completed',
        }))

      const promptTools: FeedItem[] = legacyTools
        .filter((t) => t.type === 'prompt')
        .map((t, idx) => ({
          id: t.id || `prompt-${item.id}-${idx}`,
          type: 'prompt' as const,
          text: t.text || t.content || '',
          promptActions: t.promptActions,
        }))

      const mainRow: FeedRow = {
        kind: 'message',
        message: {
          id: item.id,
          role: 'assistant',
          text: '',
          thinking,
          status: 'completed',
          timestamp: Date.now(),
          tools: ranTools,
        },
      }

      itemRows = [
        mainRow,
        ...promptTools.map((p): FeedRow => ({ kind: 'legacy', item: p })),
      ]
    } else if (item.type === 'prompt' || item.type === 'commit') {
      itemRows = [{ kind: 'legacy', item }]
    } else {
      itemRows = [
        {
          kind: 'message',
          message: {
            id: item.id,
            role: 'assistant',
            text: item.text || '',
            thinking: '',
            status: 'completed',
            timestamp: Date.now(),
          },
        },
      ]
    }

    legacyRowCache.set(item, itemRows)
    rows.push(...itemRows)
  }

  return rows
}

export const ConversationFeed: React.FC<ConversationFeedProps> = ({
  messages,
  feedItems,
  answeredPromptIds,
  onResolveApproval,
  onStopTool,
  onReviewWithModel,
  onPromptAction,
  className = '',
  autoScroll = true,
  workflowTitle,
  workflowKind,
  mediaOwner,
}) => {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScrolledUp = useRef<boolean>(false)

  const rows = useMemo(
    () => unifyFeedRows(messages, feedItems),
    [messages, feedItems]
  )

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const distanceToBottom = scrollHeight - scrollTop - clientHeight
    isUserScrolledUp.current = distanceToBottom > 80
  }

  useEffect(() => {
    if (!autoScroll || isUserScrolledUp.current) return
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [rows, autoScroll])

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto p-4 space-y-6 select-text ${className}`}
      data-testid="conversation-feed"
    >
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-zinc-600 select-none">
          <Cpu className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-sm font-medium text-zinc-400">
            {t('no_messages_yet') || 'Нет сообщений в ленте'}
          </p>
          <p className="text-xs text-zinc-600 mt-1 max-w-sm">
            {uiText('Messages and agent progress appear here for the current task.')}
          </p>
        </div>
      ) : (
        rows.map((row) =>
          row.kind === 'message' ? (
            <MemoMessageBubble
              key={row.message.id}
              message={row.message}
              workflowTitle={workflowTitle}
              workflowKind={workflowKind}
              mediaOwner={mediaOwner}
              onResolveApproval={onResolveApproval}
              onStopTool={onStopTool}
            />
          ) : (
            <MemoLegacyRow
              key={row.item.id}
              item={row.item}
              answeredPromptIds={answeredPromptIds}
              onPromptAction={onPromptAction}
              onReviewWithModel={onReviewWithModel}
            />
          )
        )
      )}
    </div>
  )
}

interface MessageBubbleProps {
  workflowTitle?: string
  workflowKind?: 'work'
  message: ReconstructedMessage
  onResolveApproval?: (approvalId: string, decision: 'allow' | 'deny') => void | Promise<void>
  onStopTool?: (callId: string, command?: string) => void
  mediaOwner?: AgentMediaOwner
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  workflowTitle,
  workflowKind,
  onResolveApproval,
  onStopTool,
  mediaOwner,
}) => {
  const { t, language } = useTranslation()
  const [isThinkingExpanded, setIsThinkingExpanded] = useState<boolean>(false)
  const [areToolsExpanded, setAreToolsExpanded] = useState<boolean>(true)

  if (message.role === 'user') {
    return (
      <div
        className="flex gap-3 text-sm animate-fade-in items-start max-w-2xl ml-auto flex-row-reverse"
        data-testid={`user-message-${message.id}`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 shadow-md">
          <User className="h-4 w-4" />
        </div>
        <div className="space-y-1 text-right max-w-full">
          <span className="text-[10px] font-bold text-zinc-500">
            {workflowTitle ? uiText("Workflow", undefined, (language.startsWith('ru')) ? 'ru' : undefined) : t('you') || 'Вы'}
          </span>
          <div className="rounded-xl bg-[#ff6b00]/10 border border-[#ff6b00]/25 p-3 text-zinc-200 leading-relaxed text-xs shadow-sm text-left whitespace-pre-wrap select-text break-words">
            {workflowTitle ? <WorkflowMessageText message={message} title={workflowTitle} kind={workflowKind} /> : message.text}
          </div>
          {message.status === 'error' && (
            <div className="text-xs text-red-400" data-testid={`message-send-error-${message.id}`}>
              {t('agent_send_failed')}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Assistant Message
  return (
    <div
      className="flex gap-3 text-sm animate-fade-in items-start max-w-2xl"
      data-testid={`assistant-message-${message.id}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff6b00] to-[#ff8c3a] text-white shadow-md">
        <Cpu className="h-4 w-4" />
      </div>

      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-400">
            ZIAForge
          </span>
          {message.status === 'streaming' && (
            <span
              className="flex h-2 w-2 relative"
              title={t('streaming_response') || 'Streaming response'}
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff6b00] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff6b00]"></span>
            </span>
          )}
        </div>

        {/* 1. Thinking block (if present) */}
        {message.thinking && message.thinking.trim().length > 0 && (
          <div
            className="rounded-lg bg-[#15171a]/50 border border-[#1e2024] overflow-hidden"
            data-testid={`thinking-block-${message.id}`}
          >
            <button
              type="button"
              onClick={() => setIsThinkingExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1d21] transition-colors select-none cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-amber-500/80" />
                <span>{t('thinking') || 'Мышление'}</span>
              </div>
              {isThinkingExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>

            {isThinkingExpanded && (
              <div className="px-3 pb-3 pt-1 text-[11px] text-zinc-400 leading-relaxed border-t border-[#1e2024]/60 select-text">
                <MarkdownMessage text={message.thinking} />
              </div>
            )}
          </div>
        )}

        {/* 2. Tool calls (if present) */}
        {message.tools && message.tools.length > 0 && (
          <div
            className="space-y-2"
            data-testid={`tools-block-${message.id}`}
          >
            <button
              type="button"
              onClick={() => setAreToolsExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors select-none cursor-pointer"
            >
              {areToolsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>
                {t('tools') || 'Инструменты'} ({message.tools.length})
              </span>
            </button>

            {areToolsExpanded && (
              <div className="space-y-1.5 pl-2 border-l border-[#1e2024]">
                {message.tools.map((tool) => (
                  <MemoToolItemCard
                    key={tool.callId}
                    tool={tool}
                    onStopTool={onStopTool}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Media remains visible independently of Tools and generic Output. */}
        {message.tools?.some(tool => tool.media?.length) && <div className="space-y-3" data-testid={`media-block-${message.id}`}>
          {(message.tools ?? []).flatMap(tool => (tool.media ?? []).map(media => <GeneratedMedia key={`${tool.callId}:${media.id}`} media={media} owner={mediaOwner} />))}
        </div>}

        {/* 3. Approvals / Permission requests (if present) */}
        {message.approvals && message.approvals.length > 0 && (
          <div
            className="space-y-2 pt-1"
            data-testid={`approvals-block-${message.id}`}
          >
            {message.approvals.map((approval) => (
              <MemoApprovalCard
                key={approval.approvalId}
                approval={approval}
                onResolveApproval={onResolveApproval}
              />
            ))}
          </div>
        )}

        {/* 4. Main message text */}
        {message.text && message.text.trim().length > 0 && (
          <div
            className="rounded-xl bg-[#15171a] border border-[#1e2024] p-3 text-zinc-300 leading-relaxed text-xs shadow-sm select-text break-words"
            data-testid={`message-content-${message.id}`}
          >
            {workflowTitle ? <WorkflowMessageText message={message} title={workflowTitle} kind={workflowKind} /> : <MarkdownMessage text={message.text} />}
          </div>
        )}
      </div>
    </div>
  )
}

const MemoMessageBubble = React.memo(MessageBubble, (previous, next) => {
  const a = previous.message
  const b = next.message

  if (
    a.id !== b.id ||
    a.role !== b.role ||
    a.status !== b.status ||
    a.text !== b.text ||
    a.thinking !== b.thinking ||
    previous.onResolveApproval !== next.onResolveApproval ||
    previous.onStopTool !== next.onStopTool ||
    previous.workflowTitle !== next.workflowTitle ||
    previous.workflowKind !== next.workflowKind ||
    previous.mediaOwner?.sessionId !== next.mediaOwner?.sessionId ||
    previous.mediaOwner?.runId !== next.mediaOwner?.runId
  ) {
    return false
  }

  if (a.revision !== undefined && b.revision !== undefined) {
    return a.revision === b.revision
  }

  return a.tools === b.tools && a.approvals === b.approvals
})

interface ToolItemCardProps {
  tool: ReconstructedToolItem
  onStopTool?: (callId: string, command?: string) => void
}

const ToolItemCard: React.FC<ToolItemCardProps> = ({ tool, onStopTool }) => {
  const { t } = useTranslation()
  const [isOutputExpanded, setIsOutputExpanded] = useState<boolean>(false)

  const hasInput =
    tool.input !== undefined && tool.input !== null && tool.input !== ''
  const hasOutput =
    tool.output !== undefined && tool.output !== null && tool.output !== ''

  const toolInputText = useMemo(
    () => (hasInput ? formatPayload(tool.input) : ''),
    [hasInput, tool.input]
  )

  const toolOutputText = useMemo(
    () => (isOutputExpanded && hasOutput ? formatPayload(tool.output) : ''),
    [isOutputExpanded, hasOutput, tool.output]
  )

  return (
    <div
      className="rounded-lg border border-[#1e2024] bg-[#121316] p-2 text-xs space-y-1"
      data-testid={`tool-item-${tool.callId}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Terminal className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <span className="font-semibold text-zinc-300 text-[11px] truncate">
            {tool.toolName}
          </span>
          {tool.executor === 'provider' && <span data-testid={`tool-provider-${tool.callId}`} className="shrink-0 rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-300">{uiText('Provider tool')}</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tool.status === 'running' && (
            <>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
                </span>
                {t('running') || 'Выполняется'}
              </span>

              {onStopTool && tool.executor !== 'provider' && (
                <button
                  type="button"
                  onClick={() =>
                    onStopTool(tool.callId, commandFromInput(tool.input))
                  }
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[9px] font-bold uppercase transition-colors cursor-pointer"
                  title={t('stop_command') || 'Остановить команду'}
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  <span>{t('stop') || 'Остановить'}</span>
                </button>
              )}
            </>
          )}

          {tool.status === 'completed' && (
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>{t('completed') || 'Завершено'}</span>
            </span>
          )}

          {tool.status === 'error' && (
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              <span>{t('error') || 'Ошибка'}</span>
            </span>
          )}

          {tool.status === 'cancelled' && (
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{t('cancelled') || 'Отменено'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Tool Input / Command */}
      {hasInput && (
        <div className="font-mono text-[10.5px] text-zinc-400 bg-[#0c0d0f] px-2 py-1 rounded border border-[#1a1d21] truncate select-all">
          {toolInputText}
        </div>
      )}

      {/* Tool Output (collapsible) */}
      {hasOutput && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsOutputExpanded((prev) => !prev)}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors select-none cursor-pointer"
          >
            {isOutputExpanded ? (
              <ChevronDown className="h-2.5 w-2.5" />
            ) : (
              <ChevronRight className="h-2.5 w-2.5" />
            )}
            <span>{t('output') || 'Вывод'}</span>
          </button>

          {isOutputExpanded && (
            <pre className="mt-1 font-mono text-[10px] text-zinc-400 bg-[#090a0c] p-2 rounded border border-[#16181b] overflow-x-auto max-h-40 whitespace-pre-wrap select-text">
              {toolOutputText}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

const MemoToolItemCard = React.memo(ToolItemCard)


interface LegacyFeedRowProps {
  item: FeedItem
  answeredPromptIds?: Record<string, string>
  onPromptAction?: (actionId: string, promptId: string) => void
  onReviewWithModel?: (model: string, diff?: string) => void
}

const LegacyFeedRow: React.FC<LegacyFeedRowProps> = ({
  item,
  answeredPromptIds,
  onPromptAction,
}) => {
  const { t } = useTranslation()

  if (item.type === 'prompt') {
    const answeredActionId = answeredPromptIds?.[item.id]
    const isAnswered = Boolean(answeredActionId)

    return (
      <div
        className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2.5 max-w-2xl animate-fade-in"
        data-testid={`legacy-prompt-${item.id}`}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>{item.text || t('permission_requested')}</span>
        </div>

        {item.promptActions && item.promptActions.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            {item.promptActions.map((act) => {
              const isSelected = answeredActionId === act.id
              return (
                <button
                  key={act.id}
                  type="button"
                  disabled={!onPromptAction || isAnswered}
                  onClick={() => onPromptAction?.(act.id, item.id)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isAnswered
                      ? 'bg-[#1e2024]/50 text-zinc-500 border-transparent opacity-50 cursor-not-allowed'
                      : 'bg-[#1e2024] hover:bg-[#2b2e33] text-zinc-300 border-[#2b2e33]'
                  }`}
                >
                  {act.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (item.type === 'commit') {
    const files = item.committedFiles ?? []
    return (
      <div
        className="rounded-xl border border-[#1e2024] bg-[#0f1012] p-3.5 space-y-2.5 max-w-2xl animate-fade-in"
        data-testid={`legacy-commit-${item.id}`}
      >
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-white">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-[#ff6b00]" />
            <span>
              {t('committed_changes') || 'Зафиксированные изменения'}{' '}
              {item.commitHash ? `(${item.commitHash.slice(0, 7)})` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="text-emerald-400">
              +{item.totalAdditions ?? 0}
            </span>
            <span className="text-rose-400">
              -{item.totalDeletions ?? 0}
            </span>
          </div>
        </div>

        {files.length > 0 && (
          <div className="border border-[#1e2024]/80 rounded-lg overflow-hidden divide-y divide-[#1e2024]/40 bg-[#0a0b0d]">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-[#121316] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <span className="font-semibold text-zinc-200 truncate">
                    {file.filename}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono truncate">
                    {file.directory}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                  {file.isNew && (
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">
                      {t('new_file_badge') || 'НОВЫЙ'}
                    </span>
                  )}
                  <span className="text-emerald-400">+{file.additions}</span>
                  <span className="text-rose-400">-{file.deletions}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

const MemoLegacyRow = React.memo(LegacyFeedRow)
