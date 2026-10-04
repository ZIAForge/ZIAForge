/** @vitest-environment happy-dom */
import { useRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigurationPopover } from '../ConfigurationPopover'

const popupFocusVisibility: string[] = []
beforeEach(() => {
  popupFocusVisibility.length = 0
  const nativeFocus = HTMLElement.prototype.focus
  // Browsers reject focusing a hidden overlay. Happy DOM otherwise permits it,
  // which concealed the actual Electron opening/Tab/Escape regression.
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
    const popup = this.closest<HTMLElement>('[data-testid="test-popup"]')
    if (popup) {
      popupFocusVisibility.push(popup.style.visibility)
      if (popup.style.visibility === 'hidden') return
    }
    nativeFocus.call(this, options)
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function Host({ disabled = false, label = 'First' }: { disabled?: boolean; label?: string }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return <><button ref={anchor} onClick={() => setOpen(true)}>Open</button><input aria-label="Composer" />
    {open && <ConfigurationPopover anchor={anchor} label="Configuration" testId="test-popup" onClose={restore => { setOpen(false); if (restore) anchor.current?.focus() }}>
      <button disabled={disabled}>{label}</button><input disabled={disabled} aria-label="Model" /><button disabled={disabled}>Last</button>
    </ConfigurationPopover>}
  </>
}
describe('ConfigurationPopover committed visibility and keyboard ownership', () => {
  it('focuses only after visible commit, contains Tab and restores its anchor on Escape', () => {
    render(<Host />)
    const trigger = screen.getByRole('button', { name: 'Open' }); trigger.focus(); fireEvent.click(trigger)
    expect(popupFocusVisibility).toEqual(['visible'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }))
    const last = screen.getByRole('button', { name: 'Last' }); last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByTestId('test-popup')).toBeNull(); expect(document.activeElement).toBe(trigger)
  })
  it('never refocuses on content refresh, resize or scroll after opening', () => {
    const view = render(<Host />); fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const field = screen.getByLabelText('Model'); field.focus()
    fireEvent.change(field, { target: { value: 'future-model' } })
    const count = popupFocusVisibility.length
    view.rerender(<Host label="Refreshed catalog" />)
    act(() => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('scroll')) })
    expect(popupFocusVisibility).toHaveLength(count); expect(document.activeElement).toBe(field)
    const composer = screen.getByLabelText('Composer'); composer.focus()
    act(() => window.dispatchEvent(new Event('resize')))
    expect(document.activeElement).toBe(composer)
  })
  it('focuses the visible dialog itself when all actions are disabled so Escape still works', () => {
    render(<Host disabled />)
    const trigger = screen.getByRole('button', { name: 'Open' }); trigger.focus(); fireEvent.click(trigger)
    expect(document.activeElement).toBe(screen.getByTestId('test-popup'))
    expect(popupFocusVisibility).toEqual(['visible'])
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByTestId('test-popup')).toBeNull(); expect(document.activeElement).toBe(trigger)
  })
})
