import { uiText } from '../../uiText'
import { useEffect, useRef, useState } from 'react'
import type { CodeFlowDiscussion } from '../../../shared/code-flow'
import type { WorkflowSnapshot } from '../../../shared/workflow'

interface DiscussionDraft { text: string; edit: number; phase?: CodeFlowDiscussion['phase']; request?: CodeFlowDiscussion; submittedEdit?: number }
const empty = (): DiscussionDraft => ({ text: '', edit: 0 })
const active = new Map<string, Promise<WorkflowSnapshot>>()
const eventName = 'ziaforge-code-discussion-draft'
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

function read(key: string, taskId: string): DiscussionDraft {
  const raw = localStorage.getItem(key)
  if (!raw) return empty()
  const value = JSON.parse(raw) as DiscussionDraft
  if (!value || typeof value.text !== 'string' || !Number.isSafeInteger(value.edit) || value.edit < 0
    || value.request && (value.request.taskId !== taskId || typeof value.request.commandId !== 'string' || typeof value.request.text !== 'string')) throw new Error(uiText("The saved discussion draft is invalid. Its bytes have been preserved."))
  return value
}
function write(key: string, value: DiscussionDraft) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent(eventName, { detail: key }))
}

/** A durable discussion intent is separate from approval and from the editable next draft. */
export function useCodeDiscussion(snapshot: WorkflowSnapshot | null, channel: string, onSnapshot: (next: WorkflowSnapshot) => void, ownerTaskId?: string) {
  const taskId = ownerTaskId ?? snapshot?.taskId ?? ''
  const key = `ziaforge-code-discussion:${taskId}:${channel}`
  const [draft, setDraft] = useState<DiscussionDraft>(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const bound = useRef(key)
  const callback = useRef(onSnapshot)
  const mounted = useRef(false)
  const unreadable = useRef('')
  const draftRef = useRef(draft)
  const draftOwner = useRef(key)
  callback.current = onSnapshot
  bound.current = key
  useEffect(() => {
    mounted.current = true
    const refresh = () => {
      try {
        const stored = read(key, taskId)
        const value = draftOwner.current === key && draftRef.current.edit > stored.edit ? draftRef.current : stored
        unreadable.current = ''; draftOwner.current = key; draftRef.current = value; setDraft(value); setBusy(active.has(key))
      }
      catch (failure) { unreadable.current = errorText(failure); setError(unreadable.current) }
    }
    refresh()
    const listener = (event: Event) => { if ((event as CustomEvent<string>).detail === key) refresh() }
    window.addEventListener(eventName, listener)
    return () => { mounted.current = false; window.removeEventListener(eventName, listener) }
  }, [key, taskId])
  const edit = (update: Partial<Pick<DiscussionDraft, 'text' | 'phase'>>) => {
    const next = { ...draftRef.current, ...update, edit: draftRef.current.edit + 1 }
    draftRef.current = next; setDraft(next)
    if (unreadable.current) { setError(unreadable.current); return }
    try { write(key, next); setError('') } catch (failure) { setError(errorText(failure)) }
  }
  const send = async (text: string, scope: Pick<CodeFlowDiscussion, 'phase' | 'stepId' | 'artifactEdits'> = {}) => {
    if (!snapshot || snapshot.taskId !== taskId) throw new Error(uiText("The saved Code workflow is not available."))
    if (unreadable.current) throw new Error(unreadable.current)
    if (active.has(key)) throw new Error(uiText("A discussion message is awaiting confirmation."))
    read(key, taskId) // Never replace an unreadable intent with a fresh conversation.
    const original = draftRef.current
    const request = original.request ?? { taskId, revision: snapshot.revision, commandId: crypto.randomUUID(), text, ...scope }
    if (!request.text.trim() || request.text.length > 12000 || request.text.includes('\0')) throw new Error(uiText("Use 1–12,000 characters without NUL for a discussion message."))
    if (request.artifactEdits && (!request.artifactEdits.length || request.artifactEdits.length > 8 || request.artifactEdits.some(edit => !edit.content.trim() || edit.content.length > 30000 || edit.content.includes('\0')))) throw new Error(uiText("Each document revision must contain 1–30,000 characters without NUL; at most 8 documents may be revised together."))
    // Persist BEFORE IPC. Failure never produces an ambiguous native delivery.
    const stored = { ...original, request, submittedEdit: original.request ? original.submittedEdit : original.edit }
    write(key, stored)
    draftRef.current = stored; setDraft(stored); setBusy(true); setError('')
    const acknowledge = (accepted: boolean) => {
      const disk = read(key, taskId)
      const latest = draftOwner.current === key && draftRef.current.edit > disk.edit ? draftRef.current : disk
      if (latest.request?.commandId !== request.commandId) return
      write(key, { ...latest, request: undefined, submittedEdit: undefined,
        text: accepted && latest.edit === stored.submittedEdit ? '' : latest.text })
    }
    const promise = Promise.resolve().then(() => window.ziafAPI.workflows.discuss(request))
    active.set(key, promise)
    try {
      const next = await promise
      if (next.taskId !== taskId || !next.commandIds.includes(request.commandId)) throw new Error(uiText("The discussion acknowledgement does not match this task and message."))
      acknowledge(true)
      if (mounted.current && bound.current === key) callback.current(next)
      return next
    } catch (failure) {
      if (mounted.current && bound.current === key) setError(errorText(failure))
      try {
        // get is serialized after discuss. Absence is definitive only after this read.
        const current = await window.ziafAPI.workflows.get({ taskId })
        if (current?.taskId === taskId) {
          const saved = current.codeFlow?.discussions?.find(item => item.commandId === request.commandId)
          // Property order is not a protocol identity. Match each explicit request field.
          const same = !!saved && saved.revision === request.revision && saved.text === request.text && saved.phase === request.phase && saved.stepId === request.stepId && JSON.stringify(saved.artifactEdits) === JSON.stringify(request.artifactEdits)
          if (same || !saved && !current.commandIds.includes(request.commandId)) acknowledge(same)
          if (mounted.current && bound.current === key) callback.current(current)
          if (same) { if (mounted.current && bound.current === key) setError(''); return current }
        }
      } catch { /* Unknown ACK: keep the exact request and its immutable payload. */ }
      throw failure
    } finally {
      active.delete(key)
      window.dispatchEvent(new CustomEvent(eventName, { detail: key }))
      if (mounted.current && bound.current === key) setBusy(false)
    }
  }
  return { draft, busy, error, setText: (text: string) => edit({ text }), setPhase: (phase: DiscussionDraft['phase']) => edit({ phase }), send }
}
