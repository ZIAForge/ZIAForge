// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkNewTask } from '../WorkNewTask'
import { useStore } from '../../../store'
import type { StoredTask } from '../../../../shared/legacy-ipc'

vi.mock('../ChatSettingsPanel', () => ({ AgentSelectionFields: ({ value, onChange, prefix, disabled }: { value: { model: string }; onChange: (value: unknown) => void; prefix: string; disabled: boolean }) => <input data-testid={`${prefix}-model`} disabled={disabled} value={value.model} onChange={event => onChange({ ...value, model: event.target.value })} /> }))
vi.mock('../WorkflowAgentSelector', () => ({ WorkflowAgentSelector: ({ value, onChange, prefix, disabled }: { value: { presetName: string }; onChange: (value: unknown) => void; prefix: string; disabled: boolean }) => <input data-testid={prefix} disabled={disabled} value={value.presetName} onChange={event => onChange({ ...value, presetName: event.target.value })} /> }))

const initial = useStore.getState()
const selection = { presetName: '', provider: 'codex' as const, model: 'model-one', permissions: 'Workspace write', reasoningEffort: 'high' }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
const receipt = (id: string): StoredTask => ({ id, name: id, repoId: 'folder-repo', status: 'running', logs: [], workFlowVersion: 1 })

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ ...initial, presets: [], acceptWorkTasks: vi.fn().mockResolvedValue(undefined) })
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: {
    createTask: vi.fn(async (request: { createRequestId: string }) => receipt(request.createRequestId)), lookupWorkStart: vi.fn().mockResolvedValue(null),
    workFolders: { pick: vi.fn().mockResolvedValue({ id: 'folder-grant', path: '/chosen/documents', name: 'Documents' }) },
    workInputs: { list: vi.fn().mockResolvedValue([]), pick: vi.fn().mockResolvedValue([{ id: 'source-id', name: 'notes.md', sizeBytes: 12, sha256: 'a'.repeat(64) }]) },
  } })
})
afterEach(() => { cleanup(); useStore.setState(initial) })

describe('new Work task creation', () => {
  it('saves two separate drafts with selected copy models, chosen folder grant and registered source IDs', async () => {
    render(<WorkNewTask initialSelection={selection} ru={false} />)
    fireEvent.change(screen.getByTestId('new-work-description'), { target: { value: 'Write useful notes' } })
    fireEvent.change(screen.getByTestId('new-work-copies'), { target: { value: '2' } })
    fireEvent.change(screen.getByTestId('new-work-agent-1-model'), { target: { value: 'model-two' } })
    await act(async () => fireEvent.click(screen.getByTestId('new-work-pick-folder')))
    await act(async () => fireEvent.click(screen.getByTestId('new-work-attach')))
    fireEvent.click(screen.getByTestId('new-work-mention'))
    fireEvent.click(screen.getByRole('button', { name: 'notes.md' }))
    fireEvent.click(screen.getByTestId('new-workflow-write'))
    await act(async () => fireEvent.click(screen.getByTestId('new-work-save-draft')))
    const requests = vi.mocked(window.ziafAPI.createTask).mock.calls.map(([request]) => request)
    expect(requests).toHaveLength(2)
    expect(new Set(requests.map(item => item.createRequestId)).size).toBe(2)
    expect(requests.map(item => item.providerModel)).toEqual(['model-one', 'model-two'])
    for (const request of requests) {
      expect(request).toMatchObject({ startWorkflow: false, reasoningEffort: 'high', workOptions: { kind: 'write', folderGrantId: 'folder-grant', inputIds: ['source-id'] } })
      expect(request.description).toContain('(work-input:source-id)')
      expect(JSON.stringify(request)).not.toContain('/chosen/documents')
    }
    expect(useStore.getState().acceptWorkTasks).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ workFlowVersion: 1 })]), expect.any(String))
  })

  it('keeps a newer description when an earlier Start response is delayed', async () => {
    const pending = deferred<StoredTask>()
    vi.mocked(window.ziafAPI.createTask).mockReturnValue(pending.promise)
    render(<WorkNewTask initialSelection={selection} ru={false} />)
    fireEvent.change(screen.getByTestId('new-work-description'), { target: { value: 'Initial work' } })
    fireEvent.click(screen.getByTestId('new-task-start'))
    await waitFor(() => expect(window.ziafAPI.createTask).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByTestId('new-work-description'), { target: { value: 'Next unsent work' } })
    await act(async () => pending.resolve(receipt('first')))
    expect((screen.getByTestId('new-work-description') as HTMLTextAreaElement).value).toBe('Next unsent work')
    expect(JSON.parse(localStorage.getItem('ziaforge-new-work-draft-v1')!).description).toBe('Next unsent work')
    expect(window.ziafAPI.createTask).toHaveBeenCalledTimes(1)
  })

  it('keeps Deep worker order separate from task copies and preserves an explicit same-preset choice', async () => {
    render(<WorkNewTask initialSelection={selection} ru={false} />)
    fireEvent.change(screen.getByTestId('new-work-description'), { target: { value: 'Explore product directions' } })
    fireEvent.click(screen.getByTestId('new-workflow-deep-brainstorm'))
    fireEvent.change(screen.getByTestId('new-work-worker-0'), { target: { value: 'One preset' } })
    fireEvent.change(screen.getByTestId('new-work-worker-1'), { target: { value: 'One preset' } })
    fireEvent.change(screen.getByTestId('new-work-worker-2'), { target: { value: 'Other preset' } })
    await act(async () => fireEvent.click(screen.getByTestId('new-task-start')))
    expect(window.ziafAPI.createTask).toHaveBeenCalledTimes(1)
    const request = vi.mocked(window.ziafAPI.createTask).mock.calls[0][0]
    expect(request.workOptions?.deep?.workers.map(item => item.presetName)).toEqual(['One preset', 'One preset', 'Other preset'])
    expect(new Set(request.workOptions?.deep?.workers.map(item => item.id)).size).toBe(3)
  })
})
