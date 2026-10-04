import { statusLabel } from './localizedLabels'
import { uiText } from '../../uiText'
import { useEffect, useState } from 'react'
import type { WorkflowSnapshot } from '../../../shared/workflow'
import { useStore } from '../../store'

/** Overview of actual engine runs; it never fabricates scheduled integrations. */
export function WorkflowRuns({ taskId }: { taskId?: string }) {
  const { tasks, settings, selectTask } = useStore()
  const [runs, setRuns] = useState<Record<string, WorkflowSnapshot>>({})
  const [error, setError] = useState('')
  const ru = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  useEffect(() => {
    let current = true
    const accept = (snapshot: WorkflowSnapshot) => { if (current && (!taskId || snapshot.taskId === taskId)) setRuns(previous => !previous[snapshot.taskId] || previous[snapshot.taskId].sequence <= snapshot.sequence ? { ...previous, [snapshot.taskId]: snapshot } : previous) }
    const off = window.ziafAPI.workflows.onEvent(accept)
    setRuns({})
    void Promise.allSettled(tasks.filter(task => !taskId || task.id === taskId).map(async task => { const snapshot = await window.ziafAPI.workflows.get({ taskId: task.id }); if (snapshot) accept(snapshot) })).then(results => { if (current && results.some(result => result.status === 'rejected')) setError(uiText("Some plans are unavailable. Open the affected task for diagnostics.", undefined, (ru) ? 'ru' : undefined)) })
    return () => { current = false; off() }
  }, [tasks, taskId, ru])
  return <section className="min-h-0 flex-1 space-y-4 overflow-auto p-5" data-testid="workflow-runs">
    <h1 className="text-lg font-semibold">{uiText("Plan runs", undefined, (ru) ? 'ru' : undefined)}</h1>
    <p className="text-xs text-zinc-400">{uiText("Saved plans, verification and review status. Configure automatic advancement in each task.", undefined, (ru) ? 'ru' : undefined)}</p>
    {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
    {!Object.keys(runs).length && <p className="text-sm text-zinc-500">{uiText("No saved plans yet.", undefined, (ru) ? 'ru' : undefined)}</p>}
    {Object.values(runs).map(run => <div className="space-y-2 rounded border border-zinc-800 p-3 text-xs" key={run.taskId}><div className="flex items-center justify-between gap-3"><strong>{run.plan.title}</strong><span>{statusLabel(run.status, ru)}</span></div><p className="text-zinc-500">{run.steps.filter(step => step.status === 'completed').length}/{run.steps.length} · {uiText("Attempts", undefined, (ru) ? 'ru' : undefined)}: {run.iterations}</p>{run.reason && <p className="break-words text-amber-300">{run.reason}</p>}<button className="rounded border border-zinc-700 px-3 py-1" onClick={() => selectTask(run.taskId)}>{uiText("Open task", undefined, (ru) ? 'ru' : undefined)}</button></div>)}
  </section>
}
