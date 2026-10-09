/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentArtifactRef } from '../../../../shared/agent-artifacts'
import { useStore, type Settings } from '../../../store'
import { GeneratedArtifacts } from '../GeneratedArtifacts'

const artifact: AgentArtifactRef = { id: 'artifact-11111111-1111-4111-8111-111111111111', sourceRunId: 'earlier-run', filename: 'report.pdf', mime: 'application/pdf', bytes: 2048, sha256: 'a'.repeat(64), providerFileId: `file_${'a'.repeat(32)}`, revision: 2, supersedesFileId: `file_${'b'.repeat(32)}` }
const owner = { sessionId: 'current-session', runId: 'current-run' }
const saveButton = (id = artifact.id) => screen.getByTestId(`generated-artifact-save-${id}`) as HTMLButtonElement
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline })
  return { promise, resolve, reject }
}
beforeEach(() => useStore.setState({ settings: { uiLanguage: 'en' } as Settings }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('generated artifact download cards', () => {
  it('displays name, byte size, MIME and revision outside any collapsed text output', () => {
    const onSave = vi.fn().mockResolvedValue({ cancelled: false })
    const { container } = render(<GeneratedArtifacts artifacts={[artifact]} owner={owner} onSave={onSave} />)
    expect(screen.getByTestId(`artifact-name-${artifact.id}`).textContent).toBe('report.pdf')
    expect(screen.getByTestId(`generated-artifact-${artifact.id}`).textContent).toContain('2 KiB')
    expect(screen.getByTestId(`generated-artifact-${artifact.id}`).textContent).toContain('application/pdf')
    expect(screen.getByTestId(`artifact-revision-${artifact.id}`).textContent).toContain('2')
    expect(screen.getByTestId(`artifact-supersedes-${artifact.id}`).textContent).toContain(artifact.supersedesFileId)
    expect(saveButton().disabled).toBe(false)
    expect(container.querySelector('details, iframe, object, embed, img, video, a')).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps both immutable revisions separately downloadable and sends only their opaque IDs', async () => {
    const previous: AgentArtifactRef = { ...artifact, id: 'artifact-22222222-2222-4222-8222-222222222222', providerFileId: artifact.supersedesFileId!, revision: 1 }
    delete previous.supersedesFileId
    const onSave = vi.fn().mockResolvedValue({ cancelled: false })
    render(<GeneratedArtifacts artifacts={[previous, artifact]} owner={owner} onSave={onSave} />)
    await act(async () => fireEvent.click(saveButton(previous.id)))
    await act(async () => fireEvent.click(saveButton()))
    expect(onSave.mock.calls).toEqual([[previous.id], [artifact.id]])
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('deduplicates pending Save and distinguishes cancellation, failure/retry and success', async () => {
    const pending = deferred<{ cancelled: boolean }>(), onSave = vi.fn().mockImplementationOnce(() => pending.promise).mockRejectedValueOnce(new Error('Export denied')).mockResolvedValue({ cancelled: false })
    render(<GeneratedArtifacts artifacts={[artifact]} owner={owner} onSave={onSave} />)
    act(() => { fireEvent.click(saveButton()); fireEvent.click(saveButton()) })
    expect(onSave).toHaveBeenCalledExactlyOnceWith(artifact.id); expect(saveButton().disabled).toBe(true)
    await act(async () => pending.resolve({ cancelled: true }))
    expect(screen.getByRole('status').textContent).toMatch(/cancel/i)
    await act(async () => fireEvent.click(saveButton()))
    expect(screen.getByRole('alert').textContent).toContain('Export denied')
    expect(screen.queryByRole('status')).toBeNull(); expect(saveButton().disabled).toBe(false)
    await act(async () => fireEvent.click(screen.getByTestId(`generated-artifact-retry-${artifact.id}`)))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('File saved!')
    expect(onSave).toHaveBeenCalledTimes(3)
  })

  it('ignores an old Save acknowledgement after owner changes, including switching back', async () => {
    const pending = deferred<{ cancelled: boolean }>(), onSave = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue({ cancelled: false })
    const view = render(<GeneratedArtifacts artifacts={[artifact]} owner={owner} onSave={onSave} />)
    fireEvent.click(saveButton())
    view.rerender(<GeneratedArtifacts artifacts={[artifact]} owner={{ sessionId: 'another-session', runId: 'another-run' }} onSave={onSave} />)
    expect(saveButton().disabled).toBe(false)
    view.rerender(<GeneratedArtifacts artifacts={[artifact]} owner={owner} onSave={onSave} />)
    await act(async () => pending.resolve({ cancelled: false }))
    expect(screen.queryByRole('status')).toBeNull()
    await act(async () => fireEvent.click(saveButton()))
    expect(screen.getByRole('status').textContent).toBe('File saved!')
    view.unmount()
  })

  it('does not apply a late failure to a changed artifact or an unmounted card', async () => {
    const pending = deferred<{ cancelled: boolean }>(), onSave = vi.fn().mockReturnValue(pending.promise)
    const view = render(<GeneratedArtifacts artifacts={[artifact]} owner={owner} onSave={onSave} />)
    fireEvent.click(saveButton())
    view.rerender(<GeneratedArtifacts artifacts={[{ ...artifact, sha256: 'b'.repeat(64) }]} owner={owner} onSave={onSave} />)
    await act(async () => pending.reject(new Error('Old failure')))
    expect(screen.queryByRole('alert')).toBeNull()
    const next = deferred<{ cancelled: boolean }>(); onSave.mockReturnValueOnce(next.promise)
    fireEvent.click(saveButton()); view.unmount()
    await act(async () => next.resolve({ cancelled: false }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders HTML/SVG filenames only as literal text and never loads artifact bytes', async () => {
    const onSave = vi.fn().mockResolvedValue({ cancelled: false })
    const html: AgentArtifactRef = { ...artifact, filename: '<script>alert(1)<script>.html', mime: 'application/octet-stream' }
    const { container } = render(<GeneratedArtifacts artifacts={[html]} owner={owner} onSave={onSave} />)
    expect(container.querySelector('script, iframe, img, object, embed')).toBeNull()
    expect(screen.getByTestId(`artifact-name-${artifact.id}`).textContent).toBe(html.filename)
    await act(async () => fireEvent.click(saveButton()))
    expect(onSave).toHaveBeenCalledExactlyOnceWith(artifact.id)
  })

  it('disables missing callbacks or invalid references and reacts to locale changes', async () => {
    const onSave = vi.fn().mockResolvedValue({ cancelled: false })
    const view = render(<GeneratedArtifacts artifacts={[artifact]} owner={owner} />)
    expect(saveButton().disabled).toBe(true)
    view.rerender(<GeneratedArtifacts artifacts={[{ ...artifact, mime: 'image/svg+xml' }]} owner={owner} onSave={onSave} />)
    expect(saveButton().disabled).toBe(true); fireEvent.click(saveButton()); expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).not.toBeNull()
    view.rerender(<GeneratedArtifacts artifacts={[artifact]} owner={owner} onSave={onSave} />)
    expect(saveButton().textContent).toContain('Save')
    act(() => useStore.setState({ settings: { uiLanguage: 'ru' } as Settings }))
    await waitFor(() => expect(saveButton().textContent).toContain('Сохранить'))
  })
})
