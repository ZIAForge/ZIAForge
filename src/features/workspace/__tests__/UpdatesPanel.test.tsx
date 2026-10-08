/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdatesAPI, UpdateStatus } from '../../../../shared/control'
import { useStore, type Settings } from '../../../store'
import { UpdatesPanel } from '../UpdatesPanel'

const available: UpdateStatus = {
  configured: true, repository: 'ZIAForge/ZIAForge', currentChannel: 'stable', automatic: false,
  currentVersion: '1.0.8', version: '1.0.9', state: 'available', canInstall: true, installKind: 'mac-zip',
  releaseUrl: 'https://github.com/ZIAForge/ZIAForge/releases/tag/v1.0.9',
}
const originalAPI = Object.getOwnPropertyDescriptor(window, 'ziafAPI')
const originalRemote = Object.getOwnPropertyDescriptor(window, 'ziafRemote')
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline })
  return { promise, resolve, reject }
}
function fixture(status: UpdateStatus = available) {
  const updates = {
    status: vi.fn<UpdatesAPI['status']>().mockResolvedValue(status),
    check: vi.fn<UpdatesAPI['check']>().mockResolvedValue(status),
    configure: vi.fn<UpdatesAPI['configure']>().mockResolvedValue(status),
    download: vi.fn<UpdatesAPI['download']>().mockResolvedValue({ ...status, state: 'downloaded' }),
    install: vi.fn<UpdatesAPI['install']>().mockResolvedValue(undefined),
  }
  const openExternal = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window, 'ziafAPI', { configurable: true, value: { updates, openExternal } })
  return { updates, openExternal }
}
async function mount() { await act(async () => { render(<UpdatesPanel />) }) }
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement
beforeEach(() => {
  useStore.setState({ settings: { uiLanguage: 'en' } as Settings, appVersion: null })
  Object.defineProperty(window, 'ziafRemote', { configurable: true, value: false })
})
afterEach(() => {
  cleanup(); vi.useRealTimers()
  if (originalAPI) Object.defineProperty(window, 'ziafAPI', originalAPI)
  else Reflect.deleteProperty(window, 'ziafAPI')
  if (originalRemote) Object.defineProperty(window, 'ziafRemote', originalRemote)
  else Reflect.deleteProperty(window, 'ziafRemote')
})

describe('GitHub update controls', () => {
  it('one update click waits for the verified download before installing and blocks duplicate clicks', async () => {
    const { updates } = fixture()
    const download = deferred<UpdateStatus>()
    updates.download.mockReturnValue(download.promise)
    await mount()
    expect(screen.getByText('1.0.8')).toBeTruthy()
    expect(screen.getByText('1.0.9')).toBeTruthy()
    const update = button('Update now')
    await act(async () => { fireEvent.click(update); fireEvent.click(update) })
    expect(updates.download).toHaveBeenCalledTimes(1)
    expect(updates.install).not.toHaveBeenCalled()
    expect(button('Check for updates').disabled).toBe(true)
    await act(async () => { download.resolve({ ...available, state: 'downloaded' }) })
    expect(updates.install).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status').textContent).toBe('Installing update…')
  })

  it.each(['rejected', 'reported'] as const)('never installs after a %s download failure', async kind => {
    const { updates } = fixture()
    if (kind === 'rejected') updates.download.mockRejectedValue(new Error('SHA-256 mismatch'))
    else updates.download.mockResolvedValue({ ...available, state: 'error', message: 'SHA-256 mismatch' })
    await mount()
    await act(async () => fireEvent.click(button('Update now')))
    expect(updates.install).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('SHA-256 mismatch')
    expect(button('Check for updates').disabled).toBe(false)
  })

  it('keeps an edited configuration and save error across status polling, then retries the same draft', async () => {
    vi.useFakeTimers()
    const { updates } = fixture()
    updates.configure.mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValueOnce({ ...available, repository: 'Owner/Repository' })
    await mount()
    fireEvent.click(screen.getByText('Update settings'))
    const repository = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(repository, { target: { value: 'Owner/Repository' } })
    expect(button('Check for updates').disabled).toBe(true)
    await act(async () => fireEvent.click(button('Save settings')))
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(repository.value).toBe('Owner/Repository')
    expect(screen.getByRole('alert').textContent).toContain('Storage unavailable')
    await act(async () => fireEvent.click(button('Save settings')))
    expect(updates.configure).toHaveBeenLastCalledWith({ repository: 'Owner/Repository', channel: 'stable', automatic: false })
    expect(button('Check for updates').disabled).toBe(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers the release page for manual installation without downloading to an inaccessible cache', async () => {
    const { updates, openExternal } = fixture({ ...available, canInstall: false, installKind: 'manual' })
    await mount()
    expect(screen.queryByRole('button', { name: 'Update now' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(updates.download).not.toHaveBeenCalled()
    expect(updates.install).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Install and restart' })).toBeNull()
    await act(async () => fireEvent.click(button('View release')))
    expect(openExternal).toHaveBeenCalledExactlyOnceWith(available.releaseUrl)
  })

  it('shows localized download progress and does not install an automatically downloaded update', async () => {
    vi.useFakeTimers()
    useStore.setState({ settings: { uiLanguage: 'ru' } as Settings })
    const { updates } = fixture({ ...available, automatic: true, state: 'downloading', progress: 42.2 })
    await mount()
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('42.2')
    expect(screen.getByRole('status').textContent).toContain('42%')
    updates.status.mockResolvedValue({ ...available, automatic: true, state: 'downloaded' })
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(updates.install).not.toHaveBeenCalled()
    expect(button('Установить и перезапустить').disabled).toBe(false)
    expect(document.querySelector('fieldset')?.disabled).toBe(true)
  })

  it('lets the owner discard a settings draft when a background download finishes', async () => {
    vi.useFakeTimers()
    const { updates } = fixture({ ...available, automatic: true })
    await mount()
    fireEvent.click(screen.getByText('Update settings'))
    const repository = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(repository, { target: { value: 'Owner/Repository' } })
    updates.status.mockResolvedValue({ ...available, automatic: true, state: 'downloaded' })
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(document.querySelector('fieldset')?.disabled).toBe(true)
    expect(button('Install and restart').disabled).toBe(true)
    fireEvent.click(button('Cancel'))
    expect(repository.value).toBe('ZIAForge/ZIAForge')
    expect(button('Install and restart').disabled).toBe(false)
    expect(updates.configure).not.toHaveBeenCalled()
    expect(updates.install).not.toHaveBeenCalled()
  })

  it('keeps update controls local to the owner desktop, including the status request', async () => {
    const { updates } = fixture()
    Object.defineProperty(window, 'ziafRemote', { configurable: true, value: true })
    await mount()
    expect(screen.getByText('Manage updates in the desktop app on this computer.')).toBeTruthy()
    expect(button('Check for updates').disabled).toBe(true)
    expect(updates.status).not.toHaveBeenCalled()
    expect(updates.check).not.toHaveBeenCalled()
  })
})
