/** @vitest-environment happy-dom */
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Composer } from '../Composer'

function deferred() {
  let resolve!: () => void; let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const input = () => screen.getByTestId('composer-input') as HTMLTextAreaElement
const change = (value: string) => fireEvent.change(input(), { target: { value } })
function Controlled({ send, disabled = false }: { send: () => Promise<void>; disabled?: boolean }) {
  const [text, setText] = useState('first')
  return <><Composer value={text} onChange={setText} onSend={send} disabled={disabled} /><input aria-label="Other control" /></>
}
afterEach(cleanup)
describe('Composer focus ownership and draft revision', () => {
  it.each(['mouse', 'keyboard'])('keeps editing immediately after %s Send and never refocuses on ACK', async method => {
    const reply = deferred(); const send = vi.fn(() => reply.promise)
    render(<Controlled send={send} />)
    const textarea = input(); textarea.focus()
    if (method === 'mouse') { screen.getByTestId('composer-send-button').focus(); fireEvent.click(screen.getByTestId('composer-send-button')) }
    else fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(document.activeElement).toBe(textarea)
    expect(textarea.disabled).toBe(false)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(send).toHaveBeenCalledTimes(1)
    change('next draft')
    const other = screen.getByLabelText('Other control'); other.focus()
    await act(async () => reply.resolve())
    expect(textarea.value).toBe('next draft')
    expect(document.activeElement).toBe(other)
  })
  it.each([true, false])('does not clear a same-text replacement (controlled=%s)', async controlled => {
    const reply = deferred()
    render(controlled ? <Controlled send={() => reply.promise} /> : <Composer defaultValue="first" onSend={() => reply.promise} />)
    fireEvent.click(screen.getByTestId('composer-send-button'))
    change('replacement'); change('first')
    await act(async () => reply.resolve())
    expect(input().value).toBe('first')
    expect(document.activeElement).toBe(input())
  })
  it('preserves a newer draft and intentional focus on rejection', async () => {
    const reply = deferred(); render(<Controlled send={() => reply.promise} />)
    fireEvent.click(screen.getByTestId('composer-send-button')); change('retry something else')
    const other = screen.getByLabelText('Other control'); other.focus()
    await act(async () => reply.reject(new Error('CLI unavailable')))
    expect(input().value).toBe('retry something else'); expect(document.activeElement).toBe(other)
    expect(screen.getByRole('alert').textContent).toContain('CLI unavailable')
  })
  it('honors explicit disabled state and ignores stale completion after unmount', async () => {
    const reply = deferred(); const send = vi.fn(() => reply.promise)
    const view = render(<Controlled send={send} disabled />)
    fireEvent.keyDown(input(), { key: 'Enter' }); expect(send).not.toHaveBeenCalled()
    view.rerender(<Controlled send={send} />); fireEvent.click(screen.getByTestId('composer-send-button'))
    view.unmount(); render(<input aria-label="New chat" />)
    const other = screen.getByLabelText('New chat'); other.focus()
    await act(async () => reply.resolve()); expect(document.activeElement).toBe(other)
  })
})
