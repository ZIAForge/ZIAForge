/** @vitest-environment happy-dom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { WorkflowSnapshot } from '../../../../shared/workflow'
import { useWorkflowProgress } from '../useWorkflowProgress'

afterEach(cleanup)
it('follows backend progress with the editor closed and fences stale loads, tasks and subscriptions', async () => {
  const listeners = new Set<(value: WorkflowSnapshot) => void>()
  const loads: Array<(value: WorkflowSnapshot) => void> = []
  const get = vi.fn(() => new Promise<WorkflowSnapshot>(resolve => loads.push(resolve)))
  Object.defineProperty(window, 'ziafAPI', { configurable: true, value: { workflows: { get,
    onEvent: (listener: (value: WorkflowSnapshot) => void) => { listeners.add(listener); return () => listeners.delete(listener) },
  } } })
  const value = (taskId: string, sequence: number, done: boolean): WorkflowSnapshot => ({ taskId, sequence,
    schemaVersion: 1, runId: 'run', revision: 1, status: 'paused', iterations: 0, updatedAt: 1, commandIds: [],
    plan: { title: 'Plan', coderPreset: 'Coding', review: false, advance: 'manual', maxFailures: 3, maxIterations: 50, steps: [] },
    steps: [{ id: 'step', status: done ? 'completed' : 'pending', attempts: [], failures: 0 }],
  })
  const { result, rerender, unmount } = renderHook(({ taskId }) => useWorkflowProgress(taskId), { initialProps: { taskId: 'first' } })
  act(() => listeners.forEach(listener => listener(value('first', 2, true))))
  expect(result.current).toEqual({ completed: 1, total: 1 })
  await act(async () => loads[0](value('first', 1, false)))
  expect(result.current.completed).toBe(1)
  const oldListener = [...listeners][0]
  rerender({ taskId: 'second' })
  expect(result.current).toEqual({ completed: 0, total: 0 })
  act(() => oldListener(value('first', 3, false)))
  await act(async () => loads[1](value('second', 1, false)))
  await waitFor(() => expect(result.current).toEqual({ completed: 0, total: 1 }))
  act(() => listeners.forEach(listener => listener(value('second', 2, true))))
  expect(result.current.completed).toBe(1)
  unmount()
  expect(listeners.size).toBe(0)
})
