import { uiText } from '../../uiText'
import type { CreateTaskConfig, StoredTask } from '../../../shared/legacy-ipc'

const key = 'ziaforge-work-start-intent-v1'
export type WorkCreateIntent = CreateTaskConfig & { createRequestId: string; startWorkflow: boolean }
export interface WorkStartBatch { id: string; requests: WorkCreateIntent[]; accepted: StoredTask[]; rejected?: WorkCreateIntent[] }

export function readWorkStartIntent(): WorkStartBatch | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  if (raw.length > 400000) throw new Error(uiText("Invalid saved Work request"))
  const value = JSON.parse(raw) as WorkStartBatch
  if (!value || typeof value.id !== 'string' || !Array.isArray(value.requests) || value.requests.length > 4 || !Array.isArray(value.accepted)) throw new Error(uiText("Invalid saved Work request"))
  const ids = new Set<string>()
  for (const request of value.requests) {
    if (!request || typeof request.createRequestId !== 'string' || !/^[\w-]{1,128}$/.test(request.createRequestId) || ids.has(request.createRequestId) ||
      request.branchType !== 'Folder' || typeof request.startWorkflow !== 'boolean' || typeof request.description !== 'string' || !request.workOptions) throw new Error(uiText("Invalid saved Work copy"))
    ids.add(request.createRequestId)
  }
  if (value.accepted.some(task => !task || typeof task.id !== 'string' || task.workFlowVersion !== 1)) throw new Error(uiText("Invalid saved Work receipt"))
  return value
}

export function saveWorkStartIntent(value: WorkStartBatch): void { localStorage.setItem(key, JSON.stringify(value)) }
export function clearWorkStartIntent(id: string): void {
  if (readWorkStartIntent()?.id === id) localStorage.removeItem(key)
}

/** Each copy has its own durable identity. A failed neighbour never recreates it. */
export async function submitWorkCopies(batch: WorkStartBatch, api: {
  createTask: (request: CreateTaskConfig) => Promise<StoredTask>
  lookupWorkStart: (request: { createRequestId: string }) => Promise<StoredTask | null>
}, persist: (value: WorkStartBatch) => void): Promise<{ batch: WorkStartBatch; errors: string[] }> {
  let current: WorkStartBatch = { ...batch, accepted: [...batch.accepted] }
  const errors: string[] = []
  for (const request of batch.requests) {
    let accepted: StoredTask | null = null
    let definite = false
    try { accepted = await api.createTask(request) }
    catch (failure) {
      errors.push(failure instanceof Error ? failure.message : String(failure))
      try { accepted = await api.lookupWorkStart({ createRequestId: request.createRequestId }); definite = accepted === null }
      catch { /* Unknown acceptance retains the exact immutable request. */ }
    }
    if (accepted || definite) {
      current = { ...current, requests: current.requests.filter(item => item.createRequestId !== request.createRequestId),
        rejected: definite ? [...(current.rejected ?? []), request] : current.rejected,
        accepted: accepted ? [...current.accepted.filter(item => item.id !== accepted.id), accepted] : current.accepted }
      // Save before another copy: loss of local persistence cannot erase accepted IDs.
      persist(current)
    }
  }
  return { batch: current, errors }
}
