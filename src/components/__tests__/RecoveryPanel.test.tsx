/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecoveryPanel } from '../RecoveryPanel'
import type { RecoveryAPI, RecoveryDocument } from '../../../shared/recovery'

function fixture() {
  const document: RecoveryDocument = { target: { domain: 'settings' }, state: 'corrupt', fingerprint: 'a'.repeat(64), backups: [{ id: 'b'.repeat(64), bytes: 102, savedAt: 1 }], invalidBackups: 0 }
  const listeners = new Set<() => void>()
  const api: RecoveryAPI = {
    list: vi.fn(async () => [document]), inspect: vi.fn(async () => document),
    restore: vi.fn(async () => ({ fingerprint: 'b'.repeat(64), preservedFingerprint: 'a'.repeat(64) })),
    onChanged: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
  return { document, api, listeners, onRestored: vi.fn() }
}
afterEach(cleanup)
describe('explicit recovery panel', () => {
  it('shows damage without restoring automatically; sends only the selected backup and observed fingerprint', async () => {
    const test = fixture()
    render(<RecoveryPanel api={test.api} onRestored={test.onRestored} />)
    await screen.findByTestId('recovery-panel')
    expect(test.api.restore).not.toHaveBeenCalled()
    expect((screen.getByTestId('recovery-restore') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('recovery-backup'), { target: { value: 'b'.repeat(64) } })
    fireEvent.click(screen.getByTestId('recovery-restore'))
    await waitFor(() => expect(test.onRestored).toHaveBeenCalledTimes(1))
    expect(test.api.restore).toHaveBeenCalledWith({ target: { domain: 'settings' }, expectedFingerprint: 'a'.repeat(64), backupId: 'b'.repeat(64) })
  })
  it('keeps a rejected stale restoration visible and clears the old selection when refreshed', async () => {
    const test = fixture()
    vi.mocked(test.api.restore).mockRejectedValue(new Error('Damaged data changed'))
    render(<RecoveryPanel api={test.api} onRestored={test.onRestored} />)
    await screen.findByTestId('recovery-backup')
    fireEvent.change(screen.getByTestId('recovery-backup'), { target: { value: 'b'.repeat(64) } })
    fireEvent.click(screen.getByTestId('recovery-restore'))
    expect((await screen.findByTestId('recovery-error')).textContent).toContain('Damaged data changed')
    expect(test.onRestored).not.toHaveBeenCalled()
    act(() => test.listeners.forEach(listener => listener()))
    await waitFor(() => expect((screen.getByTestId('recovery-backup') as HTMLSelectElement).value).toBe(''))
  })
  it('does not invent recovery when no valid backup exists and releases subscriptions on unmount', async () => {
    const test = fixture(); test.document.backups = []
    const view = render(<RecoveryPanel api={test.api} onRestored={test.onRestored} />)
    await screen.findByTestId('recovery-panel')
    expect(screen.queryByTestId('recovery-restore')).toBeNull()
    expect(test.api.restore).not.toHaveBeenCalled()
    view.unmount()
    expect(test.listeners.size).toBe(0)
  })
})
