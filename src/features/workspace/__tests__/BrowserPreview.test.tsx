// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BrowserPreview } from '../BrowserPreview'
import { normalizePreviewUrl } from '../browserPreviewUrl'
import { useStore, type Settings } from '../../../store'

afterEach(cleanup)

describe('external browser preview', () => {
  it('accepts explicit web URLs and loopback shorthand but refuses other handlers and credentials', () => {
    expect(normalizePreviewUrl('localhost:3000/path')).toBe('http://localhost:3000/path')
    expect(normalizePreviewUrl('127.0.0.1:5173')).toBe('http://127.0.0.1:5173/')
    expect(normalizePreviewUrl('[::1]:3000')).toBe('http://[::1]:3000/')
    expect(normalizePreviewUrl(' https://example.test/demo ')).toBe('https://example.test/demo')
    for (const value of ['javascript:alert(1)', 'file:///tmp/index.html', 'data:text/html,test', 'mailto:test@example.test', 'https://user:password@example.test', 'https://example.test/\nsecret', '', 'nonsense']) {
      expect(normalizePreviewUrl(value), value).toBeNull()
    }
  })

  it('opens only on explicit submission, waits for acknowledgement and preserves an address on failure', async () => {
    useStore.setState({ settings: { uiLanguage: 'en' } as Settings })
    let reject: (reason: Error) => void = () => { throw new Error('No pending open') }
    const openExternal = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
    Object.defineProperty(window, 'ziafAPI', { configurable: true, value: { openExternal } })
    render(<BrowserPreview />)
    expect(openExternal).not.toHaveBeenCalled()
    const input = screen.getByTestId('browser-preview-url') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'localhost:3000' } })
    fireEvent.click(screen.getByTestId('browser-preview-open'))
    expect(openExternal).toHaveBeenCalledExactlyOnceWith('http://localhost:3000/')
    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByTestId('browser-preview-open') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => reject(new Error('OS open failed')))
    expect(input.value).toBe('localhost:3000')
    expect(screen.getByRole('alert').textContent).toContain('Could not open')
    expect(screen.queryByRole('status')).toBeNull()
    openExternal.mockImplementation(() => Promise.resolve())
    await act(async () => fireEvent.click(screen.getByTestId('browser-preview-open')))
    expect(screen.getByRole('status').textContent).toContain('sent to your system browser')
    expect(screen.queryByText(/Page Loaded/)).toBeNull()
    fireEvent.change(input, { target: { value: 'file:///tmp/preview.html' } })
    fireEvent.click(screen.getByTestId('browser-preview-open'))
    expect(screen.getByRole('alert').textContent).toContain('HTTP or HTTPS')
    expect(openExternal).toHaveBeenCalledTimes(2)
  })
})
