/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentMediaAPI, AgentMediaRef } from '../../../../shared/agent-media'
import { MAX_IMAGE_BYTES } from '../../../../shared/agent-media'
import { useStore, type Settings } from '../../../store'
import { GeneratedMedia } from '../GeneratedMedia'
import { safeMediaBlob } from '../generatedMediaData'

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const media: AgentMediaRef = { id: 'media-11111111-1111-4111-8111-111111111111', sourceRunId: 'earlier-run', mime: 'image/png', bytes: png.byteLength, sha256: 'a'.repeat(64), width: 2, height: 1 }
const owner = { sessionId: 'current-session', runId: 'current-run' }
const image = () => screen.getByTestId(`generated-image-${media.id}`) as HTMLImageElement
const saveButton = () => screen.getByTestId(`generated-media-save-${media.id}`) as HTMLButtonElement
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline })
  return { promise, resolve, reject }
}
function fixture() {
  const api = { read: vi.fn<AgentMediaAPI['read']>().mockResolvedValue({ bytes: png, mime: 'image/png' }), save: vi.fn<AgentMediaAPI['save']>().mockResolvedValue({ cancelled: false }) }
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { agentMedia: api } })
  return api
}
let urlSequence = 0
const createURL = vi.fn(() => `blob:owned-image-${++urlSequence}`)
const revokeURL = vi.fn()
const urlDescriptors = Object.fromEntries(['createObjectURL', 'revokeObjectURL'].map(key => [key, Object.getOwnPropertyDescriptor(URL, key)]))
const originalAPI = Object.getOwnPropertyDescriptor(window, 'ziafAPI')
beforeEach(() => {
  useStore.setState({ settings: { uiLanguage: 'en' } as Settings })
  urlSequence = 0
  createURL.mockClear(); revokeURL.mockClear()
  vi.stubGlobal('IntersectionObserver', undefined)
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeURL })
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  for (const key of ['createObjectURL', 'revokeObjectURL']) {
    if (urlDescriptors[key]) Object.defineProperty(URL, key, urlDescriptors[key])
    else Reflect.deleteProperty(URL, key)
  }
  if (originalAPI) Object.defineProperty(window, 'ziafAPI', originalAPI)
  else Reflect.deleteProperty(window, 'ziafAPI')
})

describe('owned generated raster media', () => {
  it('copies the exact typed-array view and refuses unsafe MIME, mismatched size, bad signatures and over-budget refs', async () => {
    const buffer = new Uint8Array([0, ...png, 0])
    const blob = safeMediaBlob(media, { bytes: buffer.subarray(1, 9), mime: 'image/png' })
    buffer.fill(0)
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(8)
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(png)
    expect(() => safeMediaBlob(media, { bytes: png, mime: 'image/svg+xml' } as unknown as Awaited<ReturnType<AgentMediaAPI['read']>>)).toThrow('Invalid generated image data')
    expect(() => safeMediaBlob(media, { bytes: png.subarray(0, 7), mime: 'image/png' })).toThrow('Invalid generated image data')
    expect(() => safeMediaBlob(media, { bytes: new Uint8Array(8), mime: 'image/png' })).toThrow('Invalid generated image data')
    expect(() => safeMediaBlob({ ...media, bytes: MAX_IMAGE_BYTES + 1 }, { bytes: png, mime: 'image/png' })).toThrow('Invalid generated image data')
  })

  it('reads an old reference through its current owner, reserves aspect ratio and avoids reload for equal snapshot refs', async () => {
    const api = fixture()
    const view = render(<GeneratedMedia media={media} owner={owner} />)
    await waitFor(() => expect(image().src).toBe('blob:owned-image-1'))
    expect(api.read).toHaveBeenCalledExactlyOnceWith({ ...owner, mediaId: media.id })
    expect(image().closest('button')?.parentElement?.style.aspectRatio).toBe('2 / 1')
    expect(image().width).toBe(2); expect(image().height).toBe(1)
    view.rerender(<GeneratedMedia media={{ ...media }} owner={{ ...owner }} />)
    expect(api.read).toHaveBeenCalledTimes(1)
    expect(revokeURL).not.toHaveBeenCalled()
    view.unmount()
    expect(revokeURL).toHaveBeenCalledExactlyOnceWith('blob:owned-image-1')
  })

  it('discards reads from the previous owner and after unmount without allocating stale Blob URLs', async () => {
    const api = fixture()
    const old = deferred<Awaited<ReturnType<AgentMediaAPI['read']>>>(), current = deferred<Awaited<ReturnType<AgentMediaAPI['read']>>>()
    api.read.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise)
    const view = render(<GeneratedMedia media={media} owner={owner} />)
    const nextOwner = { sessionId: 'another-session', runId: 'another-run' }
    view.rerender(<GeneratedMedia media={media} owner={nextOwner} />)
    await act(async () => old.resolve({ bytes: png, mime: 'image/png' }))
    expect(createURL).not.toHaveBeenCalled()
    expect(api.read).toHaveBeenLastCalledWith({ ...nextOwner, mediaId: media.id })
    view.unmount()
    await act(async () => current.resolve({ bytes: png, mime: 'image/png' }))
    expect(createURL).not.toHaveBeenCalled()
  })

  it('opens the already loaded image, restores focus on close and keeps Save available without another read', async () => {
    const api = fixture()
    render(<GeneratedMedia media={media} owner={owner} />)
    await waitFor(() => expect(image().src).toBe('blob:owned-image-1'))
    const open = screen.getByTestId(`generated-media-open-${media.id}`)
    open.focus()
    fireEvent.click(image())
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect((screen.getByTestId('image-viewer-image') as HTMLImageElement).src).toBe(image().src)
    fireEvent.click(screen.getByTestId('image-viewer-zoom-in'))
    expect(screen.getByTestId('image-viewer-scale').textContent).toBe('125%')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(open)
    expect(api.read).toHaveBeenCalledTimes(1)
    expect(createURL).toHaveBeenCalledTimes(1)
    expect(revokeURL).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(saveButton()))
    expect(api.save).toHaveBeenCalledExactlyOnceWith({ ...owner, mediaId: media.id })
    expect(screen.getByRole('status').textContent).toBe('Image saved')
  })

  it('closes the portal on owner or media change and never reopens for a stale read or decode error', async () => {
    const api = fixture()
    const view = render(<GeneratedMedia media={media} owner={owner} />)
    await waitFor(() => expect(image().src).toBe('blob:owned-image-1'))
    fireEvent.click(image())
    const oldViewerImage = screen.getByTestId('image-viewer-image')
    const pending = deferred<Awaited<ReturnType<AgentMediaAPI['read']>>>()
    api.read.mockReturnValueOnce(pending.promise)
    const nextOwner = { sessionId: 'next-session', runId: 'next-run' }
    view.rerender(<GeneratedMedia media={media} owner={nextOwner} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(revokeURL).toHaveBeenCalledExactlyOnceWith('blob:owned-image-1')
    view.rerender(<GeneratedMedia media={media} owner={owner} />)
    await waitFor(() => expect(image().src).toBe('blob:owned-image-2'))
    await act(async () => pending.resolve({ bytes: png, mime: 'image/png' }))
    fireEvent.error(oldViewerImage)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(image().src).toBe('blob:owned-image-2')
    expect(createURL).toHaveBeenCalledTimes(2)
    fireEvent.click(image())
    view.rerender(<GeneratedMedia media={{ ...media, sha256: 'b'.repeat(64) }} owner={owner} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(image().src).toBe('blob:owned-image-3'))
    fireEvent.click(image())
    view.unmount()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(revokeURL.mock.calls.map(([url]) => url)).toEqual(['blob:owned-image-1', 'blob:owned-image-2', 'blob:owned-image-3'])
  })

  it('holds the authenticated preview while the viewer is open offscreen and releases it after close', async () => {
    const api = fixture()
    let observe!: IntersectionObserverCallback
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { observe = callback }
      observe() {}
      disconnect() {}
    })
    render(<GeneratedMedia media={media} owner={owner} />)
    const target = screen.getByTestId(`generated-media-${media.id}`)
    const intersect = (isIntersecting: boolean) => observe([{ target, isIntersecting } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    act(() => intersect(true))
    await waitFor(() => expect(image().src).toBe('blob:owned-image-1'))
    fireEvent.click(image())
    act(() => intersect(false))
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(api.read).toHaveBeenCalledTimes(1)
    expect(revokeURL).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('image-viewer-close'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByTestId(`generated-image-${media.id}`)).toBeNull()
    expect(revokeURL).toHaveBeenCalledExactlyOnceWith('blob:owned-image-1')
  })

  it('revokes replaced previews and keeps stale Save acknowledgements out of another owner', async () => {
    const api = fixture(), acknowledgement = deferred<{ cancelled: boolean }>()
    api.save.mockImplementationOnce(() => acknowledgement.promise)
    const view = render(<GeneratedMedia media={media} owner={owner} />)
    await waitFor(() => expect(image().src).toBe('blob:owned-image-1'))
    fireEvent.click(saveButton())
    const nextOwner = { sessionId: 'another-session', runId: 'another-run' }
    view.rerender(<GeneratedMedia media={media} owner={nextOwner} />)
    await waitFor(() => expect(image().src).toBe('blob:owned-image-2'))
    expect(revokeURL).toHaveBeenCalledWith('blob:owned-image-1')
    view.rerender(<GeneratedMedia media={media} owner={owner} />)
    await waitFor(() => expect(image().src).toBe('blob:owned-image-3'))
    expect(revokeURL).toHaveBeenCalledWith('blob:owned-image-2')
    await act(async () => acknowledgement.resolve({ cancelled: false }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(saveButton().disabled).toBe(false)
    view.unmount()
    expect(revokeURL).toHaveBeenCalledWith('blob:owned-image-3')
  })

  it('allows explicit retry after cache failure and treats Save cancellation, rejection and success separately', async () => {
    const api = fixture()
    api.read.mockRejectedValueOnce(new Error('Cache unavailable'))
    render(<GeneratedMedia media={media} owner={owner} />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not load image: Cache unavailable'))
    expect(createURL).not.toHaveBeenCalled()
    expect(saveButton().disabled).toBe(true)
    fireEvent.click(screen.getByTestId(`generated-media-retry-${media.id}`))
    await waitFor(() => expect(image().src).toBe('blob:owned-image-1'))
    const cancelled = deferred<{ cancelled: boolean }>()
    api.save.mockImplementationOnce(() => cancelled.promise)
    act(() => { fireEvent.click(saveButton()); fireEvent.click(saveButton()) })
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(saveButton().disabled).toBe(true)
    await act(async () => cancelled.resolve({ cancelled: true }))
    expect(screen.getByRole('status').textContent).toBe('Image save cancelled')
    api.save.mockRejectedValueOnce(new Error('Export denied'))
    await act(async () => fireEvent.click(saveButton()))
    expect(screen.getByRole('alert').textContent).toContain('Could not save image: Export denied')
    expect(image().src).toBe('blob:owned-image-1')
    await act(async () => fireEvent.click(saveButton()))
    expect(screen.getByRole('status').textContent).toBe('Image saved')
    expect(api.save).toHaveBeenLastCalledWith({ ...owner, mediaId: media.id })
    expect(api.read).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid IPC image data and revokes an image that fails to decode', async () => {
    const api = fixture()
    api.read.mockResolvedValueOnce({ bytes: png, mime: 'image/webp' })
    render(<GeneratedMedia media={media} owner={owner} />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Invalid generated image data'))
    expect(createURL).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId(`generated-media-retry-${media.id}`))
    await waitFor(() => expect(image().src).toBe('blob:owned-image-1'))
    fireEvent.error(image())
    expect(screen.queryByTestId(`generated-image-${media.id}`)).toBeNull()
    expect(revokeURL).toHaveBeenCalledExactlyOnceWith('blob:owned-image-1')
  })

  it('keeps missing IPC or owner unavailable without any read or Save attempt', () => {
    const api = fixture()
    const view = render(<GeneratedMedia media={media} />)
    expect(api.read).not.toHaveBeenCalled(); expect(saveButton().disabled).toBe(true)
    Object.defineProperty(window, 'ziafAPI', { configurable: true, value: {} })
    view.rerender(<GeneratedMedia media={media} owner={owner} />)
    expect(screen.getByRole('alert').textContent).toBe('Image unavailable')
    expect(api.save).not.toHaveBeenCalled()
  })

  it('loads only cards near the viewport and releases Blob memory while offscreen', async () => {
    const api = fixture(), disconnect = vi.fn()
    let observe!: IntersectionObserverCallback
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { observe = callback }
      observe() {}
      disconnect = disconnect
    })
    const view = render(<GeneratedMedia media={media} owner={owner} />)
    const target = screen.getByTestId(`generated-media-${media.id}`)
    const intersect = (isIntersecting: boolean) => observe([{ target, isIntersecting } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(api.read).not.toHaveBeenCalled()
    act(() => intersect(true))
    await waitFor(() => expect(image().src).toBe('blob:owned-image-1'))
    act(() => intersect(false))
    expect(revokeURL).toHaveBeenCalledWith('blob:owned-image-1')
    expect(screen.queryByTestId(`generated-image-${media.id}`)).toBeNull()
    act(() => intersect(true))
    await waitFor(() => expect(image().src).toBe('blob:owned-image-2'))
    view.unmount()
    expect(revokeURL).toHaveBeenCalledWith('blob:owned-image-2')
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
