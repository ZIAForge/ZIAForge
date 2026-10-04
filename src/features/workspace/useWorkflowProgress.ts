import { useEffect, useState } from 'react'
import type { WorkflowSnapshot } from '../../../shared/workflow'

/** The toolbar follows the durable plan even when its editor is closed. */
export function useWorkflowProgress(taskId: string | undefined) {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | null>(null)
  useEffect(() => {
    const api = window.ziafAPI?.workflows
    if (!taskId || !api) return
    let active = true
    const accept = (value: WorkflowSnapshot | null) => {
      if (!active || value?.taskId !== taskId) return
      setSnapshot(previous => previous?.taskId === taskId && previous.sequence >= value.sequence ? previous : value)
    }
    const unsubscribe = api.onEvent(accept)
    void api.get({ taskId }).then(accept).catch(() => { /* The Plan panel shows recovery errors. */ })
    return () => { active = false; unsubscribe() }
  }, [taskId])
  return snapshot && snapshot.taskId === taskId
    ? { completed: snapshot.steps.filter(step => step.status === 'completed').length, total: snapshot.steps.length }
    : { completed: 0, total: 0 }
}
