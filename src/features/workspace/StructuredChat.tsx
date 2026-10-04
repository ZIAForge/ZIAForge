import { uiText } from '../../uiText'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AgentSessionProvider, AgentSessionSnapshot, AgentSessionsAPI } from '../../../shared/agent-session'
import type { Preset } from '../../../shared/legacy-ipc'
import { useTranslation } from '../../i18n'
import { Composer } from './Composer'
import { ConversationFeed } from './ConversationFeed'
import type { ChatConfiguration } from './agentConfiguration'
import type { AgentExecutionOptions } from '../../../shared/agent-models'
import { ComposerConfigurationBar } from './ComposerConfigurationBar'
import { CliLogPane } from './CliLogPane'

interface Draft {
  text: string
  initialized: boolean
  pending?: { id: string; text: string }
  queuePending?: { id: string; text: string }
}

const drafts = new Map<string, Draft>()
const draftEditRevisions = new Map<string, number>()
const draftListeners = new Set<() => void>()
const draftStorageKey = (key: string) => `ziaf-agent-draft:${key}`
// Match the public session IPC boundary before retaining an ambiguous queue ID.
const validQueueText = (text: string) => text.trim().length > 0 && text.length <= 100_000 && !text.includes('\0')

function readDraft(key: string): Draft {
  const existing = drafts.get(key)
  if (existing) {
    if (!existing.queuePending || validQueueText(existing.queuePending.text)) return existing
    // This content could never pass IPC validation; valid uncertain attempts stay intact.
    const editable = { ...existing, queuePending: undefined }
    drafts.set(key, editable)
    return editable
  }
  let draft: Draft = { text: '', initialized: false }
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(draftStorageKey(key)) || 'null')
    if (stored && typeof stored === 'object' && 'text' in stored && typeof stored.text === 'string') {
      draft = { text: stored.text, initialized: true }
      if ('pending' in stored && stored.pending && typeof stored.pending === 'object' &&
          'id' in stored.pending && typeof stored.pending.id === 'string' &&
          'text' in stored.pending && typeof stored.pending.text === 'string') {
        draft.pending = { id: stored.pending.id, text: stored.pending.text }
      }
      if ('queuePending' in stored && stored.queuePending && typeof stored.queuePending === 'object' &&
          'id' in stored.queuePending && typeof stored.queuePending.id === 'string' &&
          'text' in stored.queuePending && typeof stored.queuePending.text === 'string' && validQueueText(stored.queuePending.text)) {
        draft.queuePending = { id: stored.queuePending.id, text: stored.queuePending.text }
      }
    }
  } catch {
    // A damaged or unavailable draft cache must not prevent opening history.
  }
  drafts.set(key, draft)
  return draft
}

function writeDraft(key: string, draft: Draft): void {
  drafts.set(key, draft)
  try {
    localStorage.setItem(draftStorageKey(key), JSON.stringify(draft))
  } catch {
    // Retain the in-memory draft if browser storage is unavailable or full.
  }
  draftListeners.forEach(listener => listener())
}

function subscribeDraft(listener: () => void): () => void {
  draftListeners.add(listener)
  return () => draftListeners.delete(listener)
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

/** Journal, queue and diagnostics advance independently, including buffered resume events. */
function mergeSessionSnapshot(current: AgentSessionSnapshot, next: AgentSessionSnapshot): AgentSessionSnapshot {
  if (current.sessionId !== next.sessionId || current.runId !== next.runId) return current
  const newerQueue = (next.queue?.revision ?? -1) > (current.queue?.revision ?? -1)
  const newerLogs = (next.diagnosticsRevision || 0) > (current.diagnosticsRevision || 0)
  if (next.cursor < current.cursor && !newerQueue && !newerLogs) return current
  const base = next.cursor < current.cursor ? current : next
  return { ...base,
    queue: newerQueue ? next.queue : current.queue,
    diagnostics: newerLogs ? next.diagnostics : current.diagnostics,
    diagnosticsRevision: newerLogs ? next.diagnosticsRevision : current.diagnosticsRevision,
  }
}

export interface StructuredChatProps extends AgentExecutionOptions {
  taskId: string
  chatId: string
  presetName: string
  provider?: AgentSessionProvider
  model?: string
  apiConnectionId?: string
  initialPrompt?: string
  workflowTitle?: string
  workflowKind?: 'work'
  onOpenCodeDiscussion?: () => void
  api?: AgentSessionsAPI
  presets?: Preset[]
}

/** The backend owns processes and history. Mounting only attaches to an existing chat. */
export function StructuredChat(props: StructuredChatProps) {
  // The identity boundary also fences promises when a parent reuses this component.
  return <StructuredChatSession key={JSON.stringify([props.taskId, props.chatId])} {...props} />
}

function StructuredChatSession({ taskId, chatId, presetName, provider = 'codex', model, apiConnectionId, permissions, reasoningEffort, initialPrompt = '', workflowTitle, workflowKind, onOpenCodeDiscussion, api: providedAPI, presets = [] }: StructuredChatProps) {
  const { t } = useTranslation()
  const api = providedAPI || window.ziafAPI?.agentSessions
  const draftKey = JSON.stringify([taskId, chatId])
  const managedByPlan = chatId.startsWith('wf-')
  const draft = useSyncExternalStore(subscribeDraft, () => readDraft(draftKey))
  const [snapshot, setSnapshot] = useState<AgentSessionSnapshot | null>(null)
  const snapshotRef = useRef<AgentSessionSnapshot | null>(null)
  const [isAttaching, setIsAttaching] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isTerminating, setIsTerminating] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [pendingInterrupt, setPendingInterrupt] = useState<{ runId: string; turnId: string } | null>(null)
  const mountedRef = useRef(false)
  const sendInFlight = useRef(false)
  const [reload, setReload] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isQueueBusy, setIsQueueBusy] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const queueOperationRef = useRef<object | null>(null)
  const [mutation, setMutation] = useState<'resume' | 'reconfigure' | null>(null)
  const mutationRef = useRef<{ runId: string; buffered: Map<string, AgentSessionSnapshot> } | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)
  const selectedPreset = presets.find(preset => preset.name === presetName)
  const baseConfiguration: ChatConfiguration = { presetName, provider, model: model || selectedPreset?.model || 'auto', apiConnectionId: apiConnectionId || selectedPreset?.apiConnectionId, permissions: permissions ?? selectedPreset?.permissions, reasoningEffort: reasoningEffort === undefined ? selectedPreset?.reasoningEffort : reasoningEffort }
  const [configuration, setConfiguration] = useState<ChatConfiguration>(() => {
    const fallback = baseConfiguration
    try {
      const saved = JSON.parse(localStorage.getItem(`ziaf-agent-config:${draftKey}`) || 'null') as Partial<ChatConfiguration> | null
      if (saved && typeof saved.presetName === 'string' && typeof saved.model === 'string' && saved.provider && ['codex', 'claude', 'antigravity', 'api'].includes(saved.provider)) return { presetName: saved.presetName, provider: saved.provider, model: saved.model, ...(typeof saved.apiConnectionId === 'string' ? { apiConnectionId: saved.apiConnectionId } : {}), permissions: typeof saved.permissions === 'string' ? saved.permissions : baseConfiguration.permissions, reasoningEffort: saved.reasoningEffort === null || typeof saved.reasoningEffort === 'string' ? saved.reasoningEffort : baseConfiguration.reasoningEffort }
    } catch { /* A corrupt optional selection cannot hide the chat. */ }
    return fallback
  })
  const [hasConfigurationOverride, setHasConfigurationOverride] = useState(() => {
    try { return Boolean(localStorage.getItem(`ziaf-agent-config:${draftKey}`)) } catch { return false }
  })

  const applySnapshot = useCallback((next: AgentSessionSnapshot, authoritative = false) => {
    if (!mountedRef.current || next.taskId !== taskId || next.chatId !== chatId) return
    const current = snapshotRef.current
    const sameRun = current?.sessionId === next.sessionId && current.runId === next.runId
    if (current && !sameRun && !authoritative) return
    if (sameRun) next = mergeSessionSnapshot(current, next)
    snapshotRef.current = next
    setSnapshot(next)
  }, [taskId, chatId])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    let attaching = true
    const buffered: AgentSessionSnapshot[] = []
    setIsAttaching(true)
    setConnectionError(null)
    if (!api) {
      setConnectionError(t('agent_session_unavailable'))
      setIsAttaching(false)
      return () => { mountedRef.current = false }
    }
    // Subscribe before reading the snapshot. Its cursor fences any overlapping
    // delivery so remount cannot duplicate deltas or miss a fast completion.
    const unsubscribe = api.onEvent(({ snapshot: next }) => {
      if (cancelled || next.taskId !== taskId || next.chatId !== chatId) return
      if (attaching) buffered.push(next)
      else if (mutationRef.current && next.runId !== mutationRef.current.runId) {
        // A fast new process can publish before reconfigure/resume resolves.
        const pending = mutationRef.current.buffered
        if (pending.size < 8 || pending.has(next.runId)) {
          const previous = pending.get(next.runId)
          pending.set(next.runId, previous ? mergeSessionSnapshot(previous, next) : next)
        }
      } else applySnapshot(next)
    })
    void api.attach({ taskId, chatId }).then(current => {
      if (cancelled) return
      if (current) applySnapshot(current, true)
      for (const next of buffered) applySnapshot(next)
      attaching = false
      const savedDraft = readDraft(draftKey)
      if (!savedDraft.initialized) {
        writeDraft(draftKey, {
          text: snapshotRef.current?.feed.length ? '' : initialPrompt,
          initialized: true,
        })
      }
      setIsAttaching(false)
    }).catch(error => {
      if (cancelled) return
      attaching = false
      setConnectionError(errorMessage(error))
      setIsAttaching(false)
    })
    return () => {
      cancelled = true
      mountedRef.current = false
      unsubscribe()
    }
    // t changes with every store update; connection identity alone owns attach.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, taskId, chatId, draftKey, initialPrompt, reload, applySnapshot])

  const send = async (text: string) => {
    if (!api) throw new Error(t('agent_session_unavailable'))
    if (managedByPlan) throw new Error(t('agent_chat_managed_by_plan'))
    if (isAttaching || sendInFlight.current || queueOperationRef.current || mutationRef.current || isTerminating) throw new Error(t('agent_session_starting'))
    if (snapshotRef.current?.activeTurn) throw new Error(t('agent_turn_busy'))
    if (snapshotRef.current?.queue?.items.length) throw new Error(t('agent_queue_order_hint'))
    const textRevision = draftEditRevisions.get(draftKey) || 0
    const existingDraft = readDraft(draftKey)
    if (existingDraft.queuePending) throw new Error(t('agent_queue_pending_hint'))
    const pending = existingDraft.pending?.text === text
      ? existingDraft.pending
      : { id: crypto.randomUUID(), text }
    writeDraft(draftKey, { ...existingDraft, pending })
    sendInFlight.current = true
    setIsSending(true)
    setOperationError(null)
    try {
      let current = snapshotRef.current
      if (!current || current.sessionStatus !== 'ready') {
        current = await api.create({ taskId, chatId, ...(hasConfigurationOverride ? configuration : baseConfiguration), requestId: `create-${pending.id}` })
        applySnapshot(current, true)
      }
      const receipt = await api.send({
        sessionId: current.sessionId,
        runId: current.runId,
        clientMessageId: pending.id,
        text,
      })
      if (receipt.sessionId !== current.sessionId || receipt.runId !== current.runId || receipt.clientMessageId !== pending.id) {
        throw new Error(t('agent_send_receipt_mismatch'))
      }
      // A late acknowledgement can clear only its own unchanged draft. The
      // cache is shared across remounts, not across task/chat identities.
      const latest = readDraft(draftKey)
      if (receipt.outcome === 'rejected') {
        // A definitive provider rejection permits a new explicit attempt. An
        // ambiguous transport failure keeps its original deduplication ID.
        if (latest.pending?.id === pending.id) {
          writeDraft(draftKey, { text: latest.text, initialized: true })
        }
        throw new Error(receipt.error || t('agent_send_failed'))
      }
      if (latest.pending?.id === pending.id) {
        writeDraft(draftKey, { text: latest.text === text && (draftEditRevisions.get(draftKey) || 0) === textRevision ? '' : latest.text, initialized: true })
      }
      // A coalesced update may not have reached this renderer before the receipt.
      // Refresh is read-only and cannot turn a delivered message into a failure.
      void api.snapshot({ sessionId: current.sessionId, runId: current.runId })
        .then(next => applySnapshot(next))
        .catch(() => {})
    } finally {
      sendInFlight.current = false
      if (mountedRef.current) setIsSending(false)
    }
  }

  const changeQueue = async (action: 'enqueue' | 'pause' | 'continue' | 'cancel', clientMessageId?: string) => {
    const current = snapshotRef.current
    if (managedByPlan || !api || !current || isAttaching || connectionError || queueOperationRef.current || sendInFlight.current || mutationRef.current || isTerminating) return
    const saved = readDraft(draftKey)
    const queueTextRevision = draftEditRevisions.get(draftKey) || 0
    if (action === 'enqueue' && current.sessionStatus !== 'ready') return
    if (action === 'enqueue' && !validQueueText(saved.queuePending?.text ?? saved.text)) {
      setQueueError(t('agent_queue_invalid_text'))
      return
    }
    const pending = action === 'enqueue' ? saved.queuePending ?? { id: crypto.randomUUID(), text: saved.text } : undefined
    if (pending) writeDraft(draftKey, { ...saved, queuePending: pending })
    const operation = {}
    queueOperationRef.current = operation
    setIsQueueBusy(true)
    setQueueError(null)
    try {
      const reference = { sessionId: current.sessionId, runId: current.runId }
      const next = pending ? await api.queue({ ...reference, clientMessageId: pending.id, text: pending.text })
        : action === 'cancel' ? await api.cancelQueued({ ...reference, clientMessageId: clientMessageId! })
        : await api.setQueuePaused({ ...reference, paused: action === 'pause' })
      if (next.taskId !== taskId || next.chatId !== chatId || next.sessionId !== current.sessionId || next.runId !== current.runId) throw new Error(t('agent_send_receipt_mismatch'))
      if (pending) {
        const latest = readDraft(draftKey)
        // A durable ACK may arrive after the item has already been dispatched.
        // Clear only this accepted draft, preserving newer typing and send IDs.
        if (latest.queuePending?.id === pending.id) writeDraft(draftKey, { ...latest, text: latest.text === pending.text && (draftEditRevisions.get(draftKey) || 0) === queueTextRevision ? '' : latest.text, queuePending: undefined })
      }
      if (mountedRef.current && queueOperationRef.current === operation) applySnapshot(next)
    } catch (error) {
      if (mountedRef.current && queueOperationRef.current === operation && snapshotRef.current?.runId === current.runId) setQueueError(errorMessage(error))
    } finally {
      if (queueOperationRef.current === operation) queueOperationRef.current = null
      if (mountedRef.current) setIsQueueBusy(false)
    }
  }

  const saveConfiguration = (next: ChatConfiguration) => {
    setConfiguration(next)
    setHasConfigurationOverride(true)
    try { localStorage.setItem(`ziaf-agent-config:${draftKey}`, JSON.stringify(next)) } catch { /* Keep the in-memory selection. */ }
  }

  const changeSession = async (kind: 'resume' | 'reconfigure', nextConfiguration?: ChatConfiguration) => {
    const current = snapshotRef.current
    if (managedByPlan) throw new Error(t('agent_chat_managed_by_plan'))
    if (!api || isAttaching || sendInFlight.current || queueOperationRef.current || mutationRef.current || isTerminating || current?.activeTurn || current?.sessionStatus === 'starting' || current?.sessionStatus === 'stopping') throw new Error(t('agent_chat_wait_idle'))
    if (kind === 'reconfigure' && (current?.queue?.items.length || readDraft(draftKey).queuePending)) throw new Error(t('agent_queue_config_hint'))
    if (!current) {
      if (nextConfiguration) {
        saveConfiguration(nextConfiguration)
        // This is an explicit new configuration, not a retry of the old launch.
        writeDraft(draftKey, { text: readDraft(draftKey).text, initialized: true })
      }
      return
    }
    const operation = { runId: current.runId, buffered: new Map<string, AgentSessionSnapshot>() }
    mutationRef.current = operation
    setMutation(kind)
    setOperationError(null)
    try {
      const reference = { sessionId: current.sessionId, runId: current.runId }
      const next = kind === 'resume'
        ? await api.resume(reference)
        : await api.reconfigure({ ...reference, ...nextConfiguration!, requestId: crypto.randomUUID() })
      if (!mountedRef.current || mutationRef.current !== operation) return
      if (next.sessionId !== current.sessionId || next.taskId !== taskId || next.chatId !== chatId || snapshotRef.current?.runId !== current.runId) throw new Error(t('agent_chat_changed_elsewhere'))
      applySnapshot(next, true)
      const buffered = operation.buffered.get(next.runId)
      if (buffered) applySnapshot(buffered)
      saveConfiguration({ presetName: next.presetName, provider: next.provider, model: next.model || 'auto', apiConnectionId: next.apiConnectionId, permissions: next.permissions, reasoningEffort: next.reasoningEffort })
      const latest = readDraft(draftKey)
      writeDraft(draftKey, { text: latest.text, initialized: true, queuePending: latest.queuePending })
    } catch (error) {
      if (mountedRef.current && mutationRef.current === operation) {
        // Startup can fail after the old process has exited. Read back the
        // backend's actual owner instead of allowing Send to use a stale run.
        try {
          const actual = await api.attach({ taskId, chatId })
          if (mountedRef.current && mutationRef.current === operation) {
            if (actual) {
              applySnapshot(actual, true)
              const buffered = operation.buffered.get(actual.runId)
              if (buffered) applySnapshot(buffered)
              if (kind === 'resume') setOperationError(errorMessage(error))
            } else setConnectionError(t('agent_chat_changed_elsewhere'))
          }
        } catch (refreshError) {
          if (mountedRef.current && mutationRef.current === operation) setConnectionError(errorMessage(refreshError))
        }
      }
      throw error
    } finally {
      if (mutationRef.current === operation) mutationRef.current = null
      if (mountedRef.current) setMutation(null)
    }
  }

  const interrupt = async () => {
    const current = snapshotRef.current
    const turnId = current?.activeTurn?.turnId
    if (managedByPlan || !api || !current || !turnId || pendingInterrupt) return
    setOperationError(null)
    setPendingInterrupt({ runId: current.runId, turnId })
    try {
      await api.interrupt({ sessionId: current.sessionId, runId: current.runId, turnId })
      // ACK does not end the turn. Only a later backend snapshot unlocks Send.
    } catch (error) {
      if (mountedRef.current && snapshotRef.current?.runId === current.runId && snapshotRef.current?.sessionId === current.sessionId) {
        setOperationError(errorMessage(error))
        setPendingInterrupt(previous => previous?.runId === current.runId && previous.turnId === turnId ? null : previous)
      }
    }
  }

  useEffect(() => {
    if (pendingInterrupt && (snapshot?.runId !== pendingInterrupt.runId || snapshot?.activeTurn?.turnId !== pendingInterrupt.turnId)) {
      setPendingInterrupt(null)
    }
  }, [pendingInterrupt, snapshot])

  const resolveApproval = async (approvalId: string, decision: 'allow' | 'deny') => {
    const current = snapshotRef.current
    const approval = current?.pendingApprovals.find(item => item.approvalId === approvalId)
    const turnId = approval?.turnId || current?.activeTurn?.turnId
    if (!api || !current || !approval || !turnId || !current.capabilities.interactiveApprovals) {
      throw new Error(t('approval_expired'))
    }
    await api.resolveApproval({ sessionId: current.sessionId, runId: current.runId, turnId, approvalId, decision })
  }

  const terminate = async () => {
    const current = snapshotRef.current
    if (managedByPlan || !api || !current || isTerminating || mutationRef.current || sendInFlight.current) return
    setIsTerminating(true)
    setOperationError(null)
    try {
      await api.terminate({ sessionId: current.sessionId, runId: current.runId })
      applySnapshot(await api.snapshot({ sessionId: current.sessionId, runId: current.runId }))
    } catch (error) {
      if (mountedRef.current) setOperationError(errorMessage(error))
    } finally {
      if (mountedRef.current) setIsTerminating(false)
    }
  }

  const activeTurn = snapshot?.activeTurn
  const turnError = !activeTurn && snapshot?.lastTurn?.status === 'failed' ? snapshot.lastTurn.error || t('agent_turn_failed') : null
  const visibleError = connectionError || operationError || snapshot?.error || turnError
  const isStarting = isAttaching || snapshot?.sessionStatus === 'starting'
  const isUnavailable = snapshot?.sessionStatus === 'disconnected' || snapshot?.sessionStatus === 'stopped' || snapshot?.sessionStatus === 'error'
  const queue = snapshot?.queue
  const hasQueue = Boolean(queue?.items.length)
  const canSend = !draft.queuePending && !hasQueue && !isQueueBusy && !managedByPlan && !isTerminating && !mutation && !isStarting && !connectionError && !activeTurn && !isUnavailable && snapshot?.sessionStatus !== 'stopping'
  const sessionBusy = Boolean(isStarting || isSending || isQueueBusy || isTerminating || activeTurn || snapshot?.sessionStatus === 'stopping')
  const configurationBusy = sessionBusy || hasQueue || Boolean(draft.queuePending)
  const showQueueButton = !managedByPlan && Boolean(snapshot && (activeTurn || hasQueue || isUnavailable || draft.queuePending))
  const canQueue = !connectionError && !isAttaching && !isSending && !isQueueBusy && !isTerminating && !mutation && snapshot?.sessionStatus === 'ready'
  const currentConfiguration: ChatConfiguration = snapshot ? { presetName: snapshot.presetName, provider: snapshot.provider, model: snapshot.model || 'auto', apiConnectionId: snapshot.apiConnectionId, permissions: snapshot.permissions, reasoningEffort: snapshot.reasoningEffort } : hasConfigurationOverride ? configuration : baseConfiguration
  const canInterrupt = Boolean(!managedByPlan && snapshot?.capabilities.interruptTurn && activeTurn?.turnId && !pendingInterrupt && activeTurn.status !== 'interrupting')
  const statusLabel = isStarting || isSending && !activeTurn || activeTurn?.status === 'starting' ? 'agent_session_starting'
    : pendingInterrupt || activeTurn?.status === 'interrupting' ? 'agent_turn_interrupting'
    : activeTurn?.status === 'waiting_for_approval' ? 'agent_turn_waiting_for_approval'
    : activeTurn ? 'agent_turn_running'
    : connectionError || snapshot?.sessionStatus === 'error' ? 'agent_session_error'
    : isUnavailable ? 'agent_session_disconnected'
    : turnError ? 'agent_turn_failed'
    : 'agent_session_ready'

  return (
    <div className="flex min-h-0 flex-1 flex-col h-full" data-testid={`structured-${currentConfiguration.provider}-chat`} data-provider={currentConfiguration.provider} data-session-status={snapshot?.sessionStatus || 'absent'}>
      <div className="flex items-center justify-between border-b border-[#1e2024] px-5 py-2 text-xs text-zinc-400">
        <span className="min-w-0 truncate text-zinc-500">{currentConfiguration.provider} · {currentConfiguration.model}</span>
        <div className="ml-3 flex shrink-0 items-center gap-4"><button type="button" data-testid="agent-cli-logs-toggle" aria-expanded={logsOpen} onClick={() => setLogsOpen(value => !value)} className="hover:text-white">{t('agent_chat_logs')}</button><span role="status" data-testid="agent-session-status">{t(statusLabel)}</span></div>
      </div>
      {managedByPlan && <p data-testid="agent-chat-plan-owned" className="px-5 py-2 text-xs text-zinc-400">{t('agent_chat_managed_by_plan')}{onOpenCodeDiscussion && <button type="button" data-testid="code-execution-discuss" className="ml-3 text-orange-400 underline" onClick={onOpenCodeDiscussion}>{uiText("Forge")}</button>}</p>}
      {visibleError && (
        <div role="alert" className="m-3 rounded border border-rose-500/30 p-3 text-xs text-rose-300">
          {visibleError}
          {connectionError && <button type="button" className="ml-3 underline" onClick={() => setReload(value => value + 1)}>{t('retry')}</button>}
        </div>
      )}
      {isUnavailable && !managedByPlan && <div className="px-5 py-3 text-xs text-zinc-400"><p>{t(snapshot?.resumeAvailable ? 'agent_chat_resume_hint' : 'agent_chat_reconfigure_hint')}</p>{snapshot?.resumeAvailable && <button type="button" data-testid="agent-session-resume" disabled={Boolean(mutation) || sessionBusy} onClick={() => void changeSession('resume').catch(() => {})} className="mt-2 text-[#ff6b00] disabled:opacity-40">{t(mutation === 'resume' ? 'agent_chat_resuming' : 'agent_chat_resume')}</button>}</div>}
      {activeTurn && snapshot && !managedByPlan && !snapshot.capabilities.interruptTurn && <div className="px-5 py-2 text-xs text-zinc-400">
        <span>{t('agent_session_end_hint')}</span>
        <button type="button" data-testid="agent-session-terminate" disabled={isTerminating} onClick={() => void terminate()} className="ml-3 text-rose-300 underline disabled:opacity-50">{t('agent_session_end')}</button>
      </div>}
      <ConversationFeed
        className="min-h-0"
        messages={snapshot?.feed || []}
        workflowTitle={managedByPlan ? workflowTitle : undefined}
        workflowKind={managedByPlan ? workflowKind : undefined}
        onResolveApproval={snapshot?.capabilities.interactiveApprovals ? resolveApproval : undefined}
      />
      {(hasQueue || queue?.error || queueError || draft.queuePending) && <section data-testid="agent-message-queue" aria-label={t('agent_queue_title')} className="shrink-0 border-t border-[#2b2e33] bg-[#141619] px-5 py-3 text-xs">
        <div className="flex items-center justify-between gap-3"><strong>{t('agent_queue_title')} · {queue?.items.length || 0}</strong><div className="flex items-center gap-3"><span role="status" data-testid="agent-queue-status" className="text-zinc-400">{t(!hasQueue ? 'agent_queue_empty' : queue?.paused ? 'agent_queue_paused' : 'agent_queue_automatic')}</span>{hasQueue && !managedByPlan && <button type="button" data-testid="agent-queue-toggle" disabled={isQueueBusy || Boolean(mutation) || isTerminating || isAttaching || Boolean(connectionError) || (queue?.paused && (snapshot?.sessionStatus !== 'ready' || queue.items.some(item => item.status === 'uncertain')))} onClick={() => void changeQueue(queue?.paused ? 'continue' : 'pause')} className="text-[#ff6b00] disabled:opacity-40">{t(queue?.paused ? 'agent_queue_continue' : 'agent_queue_pause')}</button>}</div></div>
        {draft.queuePending && !isQueueBusy && <div className="mt-2 text-amber-300"><p>{t('agent_queue_pending_hint')}</p><p data-testid="agent-queue-pending-text" className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap break-words">{draft.queuePending.text}</p></div>}
        {(queueError || queue?.error) && <p role="alert" className="mt-2 break-words text-rose-300">{queueError || queue?.error}</p>}
        {hasQueue && <><p className="mt-2 text-zinc-400">{t(isUnavailable ? 'agent_queue_resume_hint' : queue?.paused ? 'agent_queue_paused_hint' : 'agent_queue_order_hint')}</p><ol className="mt-2 max-h-40 space-y-2 overflow-y-auto">{queue!.items.map(item => <li key={item.clientMessageId} data-testid={`agent-queue-item-${item.clientMessageId}`} data-state={item.status} className="rounded border border-[#2b2e33] p-2"><div className="flex items-start justify-between gap-3"><span className="whitespace-pre-wrap break-words min-w-0 flex-1">{item.text}</span><button type="button" data-testid={`agent-queue-cancel-${item.clientMessageId}`} disabled={managedByPlan || isQueueBusy || Boolean(mutation) || isTerminating || item.status === 'dispatching'} onClick={() => void changeQueue('cancel', item.clientMessageId)} className="shrink-0 text-zinc-400 underline disabled:opacity-40">{t(item.status === 'uncertain' ? 'agent_queue_dismiss' : 'cancel')}</button></div><p className={`mt-1 ${item.status === 'uncertain' ? 'text-amber-300' : 'text-zinc-500'}`}>{t(item.status === 'uncertain' ? 'agent_queue_uncertain' : item.status === 'dispatching' ? 'agent_queue_dispatching' : 'agent_queue_waiting')}</p>{item.error && <p className="mt-1 break-words text-rose-300">{item.error}</p>}</li>)}</ol><p className="mt-2 text-zinc-500">{t('agent_queue_config_hint')}</p></>}
      </section>}
      {logsOpen && <CliLogPane entries={snapshot?.diagnostics || []} />}
      {snapshot?.usage && <p data-testid="agent-usage" className="shrink-0 px-5 py-1 text-[10px] text-zinc-500">{t('agent_usage_current_run')}: {t('agent_usage_input')} {snapshot.usage.inputTokens} · {t('agent_usage_output')} {snapshot.usage.outputTokens} · {t('agent_usage_total')} {snapshot.usage.totalTokens}</p>}
      <div className="shrink-0 border-t border-[#1e2024] p-4">
        <Composer
          value={draft.text}
          onChange={text => { draftEditRevisions.set(draftKey, (draftEditRevisions.get(draftKey) || 0) + 1); writeDraft(draftKey, { ...readDraft(draftKey), text, initialized: true }) }}
          onSend={send}
          onStop={interrupt}
          onQueue={showQueueButton ? () => void changeQueue('enqueue') : undefined}
          canQueue={Boolean(canQueue)}
          isQueueing={isQueueBusy}
          queueRetry={Boolean(draft.queuePending)}
          processState={isStarting || isSending && !activeTurn || activeTurn?.status === 'starting' || Boolean(mutation) ? 'starting' : pendingInterrupt || activeTurn?.status === 'interrupting' ? 'interrupting' : activeTurn?.status === 'waiting_for_approval' ? 'approval' : activeTurn ? 'running' : isUnavailable ? 'unavailable' : 'ready'}
          isRunning={Boolean(activeTurn)}
          canSend={Boolean(canSend)}
          canInterrupt={canInterrupt}
          supportsInterrupt={!managedByPlan && (snapshot?.capabilities.interruptTurn ?? false)}
          supportsAttachments={snapshot?.capabilities.attachments ?? false}
          modelSelectionDisabled={managedByPlan || Boolean(mutation)}
          configurationControls={<ComposerConfigurationBar reportedError={visibleError} current={currentConfiguration} presets={presets} busy={configurationBusy} applying={Boolean(mutation)} disabled={managedByPlan} onApply={next => changeSession('reconfigure', next)} />}
          selectedModel={`${currentConfiguration.presetName || currentConfiguration.provider} · ${currentConfiguration.model}`}
          customAgent={currentConfiguration.provider === 'claude' ? 'Claude Code' : currentConfiguration.provider === 'antigravity' ? 'Google Antigravity' : 'Codex'}
          placeholder={t('chat_placeholder')}
        />
      </div>
    </div>
  )
}
