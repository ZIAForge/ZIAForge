/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore, type Settings } from '../../../store'
import { uiKey } from '../../../uiText'
import { ImageViewer } from '../ImageViewer'

const scale = () => screen.getByTestId('image-viewer-scale').textContent
const button = (name: string) => screen.getByTestId(`image-viewer-${name}`) as HTMLButtonElement
function fixture() {
  const onClose = vi.fn(), onError = vi.fn()
  const view = render(<ImageViewer url="blob:authenticated-preview" width={2000} height={1000} onClose={onClose} onError={onError} />)
  const viewport = screen.getByTestId('image-viewer-viewport')
  Object.defineProperties(viewport, { clientWidth: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 600 } })
  fireEvent(window, new Event('resize'))
  return { ...view, viewport, onClose, onError }
}
beforeEach(() => useStore.setState({ settings: { uiLanguage: 'en' } as Settings }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('authenticated image viewer', () => {
  it('fits the measured viewport, zooms within bounds and supports 100%, fit and keyboard shortcuts', () => {
    fixture()
    const dialog = screen.getByRole('dialog', { name: uiKey('image_viewer_title') })
    const image = screen.getByTestId('image-viewer-image') as HTMLImageElement
    expect(image.src).toBe('blob:authenticated-preview')
    expect(scale()).toBe('48%')
    expect(image.style.width).toBe('968px')
    fireEvent.click(button('zoom-in'))
    expect(scale()).toBe('61%')
    fireEvent.click(button('zoom-out'))
    expect(scale()).toBe('48%')
    fireEvent.click(button('actual-size'))
    expect(scale()).toBe('100%'); expect(image.style.width).toBe('2000px')
    fireEvent.click(button('fit'))
    expect(scale()).toBe('48%')
    fireEvent.keyDown(dialog, { key: '1' }); expect(scale()).toBe('100%')
    fireEvent.keyDown(dialog, { key: '+' }); expect(scale()).toBe('125%')
    fireEvent.keyDown(dialog, { key: '-' }); expect(scale()).toBe('100%')
    fireEvent.keyDown(dialog, { key: '0' }); expect(scale()).toBe('48%')
    for (let index = 0; index < 30; index++) fireEvent.click(button('zoom-in'))
    expect(scale()).toBe('800%'); expect(button('zoom-in').disabled).toBe(true)
    for (let index = 0; index < 40; index++) fireEvent.click(button('zoom-out'))
    expect(scale()).toBe('10%'); expect(button('zoom-out').disabled).toBe(true)
  })

  it('moves a large image by dragging its scroll viewport and stops on pointer cancellation', () => {
    const { viewport } = fixture()
    fireEvent.click(button('actual-size'))
    expect(viewport.className).toContain('overflow-auto')
    const left = viewport.scrollLeft, top = viewport.scrollTop
    fireEvent.pointerDown(viewport, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(viewport, { pointerId: 7, clientX: 50, clientY: 75 })
    expect(viewport.scrollLeft).toBe(left + 50)
    expect(viewport.scrollTop).toBe(top + 25)
    expect(viewport.style.cursor).toBe('grabbing')
    fireEvent.pointerCancel(viewport, { pointerId: 7 })
    fireEvent.pointerMove(viewport, { pointerId: 7, clientX: 0, clientY: 0 })
    expect(viewport.scrollLeft).toBe(left + 50)
    expect(viewport.scrollTop).toBe(top + 25)
    expect(viewport.style.cursor).toBe('grab')
  })

  it('traps and restores focus, handles Escape and closes only on a true backdrop click', () => {
    const opener = document.createElement('button')
    document.body.append(opener); opener.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'scroll'
    const { viewport, onClose, unmount } = fixture()
    const dialog = screen.getByTestId('image-viewer')
    expect(document.activeElement).toBe(button('close'))
    expect(document.body.style.overflow).toBe('hidden')
    viewport.focus()
    fireEvent.keyDown(viewport, { key: 'Tab' })
    expect(document.activeElement).toBe(button('zoom-out'))
    fireEvent.keyDown(button('zoom-out'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(viewport)
    opener.focus()
    expect(document.activeElement).toBe(button('close'))
    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(button('close'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByTestId('image-viewer-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
    unmount()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('scroll')
    document.body.style.overflow = previousOverflow
    opener.remove()
  })

  it('reports decode failure to the URL owner without reading or replacing the URL', () => {
    const { onError } = fixture()
    fireEvent.error(screen.getByTestId('image-viewer-image'))
    expect(onError).toHaveBeenCalledTimes(1)
    expect((screen.getByTestId('image-viewer-image') as HTMLImageElement).src).toBe('blob:authenticated-preview')
  })
})
