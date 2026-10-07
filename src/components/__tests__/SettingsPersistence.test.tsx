// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Settings } from '../Settings'
import { useStore, type Settings as AppSettings } from '../../store'
import { translate } from '../../i18n-core'

const initialState = useStore.getState()
const settings: AppSettings = {
  theme: 'dark', language: 'en', uiLanguage: 'en', defaultIDE: 'VSCode', autoArchive: 'never',
  soundAlerts: false, soundType: 'Doorbell', desktopNotifications: false, launchAtLogin: false,
  preventSleep: false, useMockData: false,
}

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const languageInput = () => screen.getByRole('combobox') as HTMLSelectElement

beforeEach(() => {
  useStore.setState({ ...initialState, settings, presets: [], repositories: [], activeTab: 'settings' })
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: {
    saveSettings: vi.fn().mockResolvedValue(undefined),
    getRepositories: vi.fn().mockResolvedValue([]),
  } })
})
afterEach(() => { cleanup(); useStore.setState(initialState); vi.restoreAllMocks() })

describe('Settings persistence feedback', () => {
  it.each(['en', 'ru'])('retains a changed draft after refusal, reports the error in %s and allows retry', async locale => {
    useStore.setState({ settings: { ...settings, uiLanguage: locale } })
    const reply = deferred()
    vi.mocked(window.ziafAPI.saveSettings).mockReturnValueOnce(reply.promise)
    const unhandled = vi.fn()
    const reload = vi.spyOn(window.location, 'reload')
    window.addEventListener('unhandledrejection', unhandled)
    try {
      render(<Settings />)
      const selected = locale === 'en' ? 'ru' : 'en'
      fireEvent.change(languageInput(), { target: { value: selected } })
      fireEvent.click(screen.getByRole('button', { name: translate(locale, 'save_changes') }))
      expect(window.ziafAPI.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ uiLanguage: selected }))
      // A later edit remains available for retry when the pending write fails.
      fireEvent.change(languageInput(), { target: { value: 'fr' } })
      await act(async () => reply.reject(new Error('Storage is unavailable')))

      expect(screen.getByRole('alert').textContent).toBe(translate(locale, 'ui.error', { value1: 'Storage is unavailable' }))
      expect(languageInput().value).toBe('fr')
      expect(useStore.getState().settings?.uiLanguage).toBe(locale)
      expect(useStore.getState().activeTab).toBe('settings')
      expect(window.ziafAPI.getRepositories).not.toHaveBeenCalled()
      expect((screen.getByRole('button', { name: translate(locale, 'save_changes') }) as HTMLButtonElement).disabled).toBe(false)
      expect(unhandled).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()

      await act(async () => fireEvent.click(screen.getByRole('button', { name: translate(locale, 'save_changes') })))
      expect(window.ziafAPI.saveSettings).toHaveBeenCalledTimes(2)
      expect(window.ziafAPI.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ uiLanguage: 'fr' }))
      expect(useStore.getState().settings?.uiLanguage).toBe('fr')
      expect(screen.getByRole('heading', { name: translate('fr', 'general_settings') })).not.toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByRole('button', { name: translate('fr', 'save_changes') })).toBeNull()
      expect(reload).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('unhandledrejection', unhandled)
    }
  })

  it('submits once during a pending write and applies the language only after acknowledgement', async () => {
    const reply = deferred()
    vi.mocked(window.ziafAPI.saveSettings).mockReturnValueOnce(reply.promise)
    render(<Settings />)
    fireEvent.change(languageInput(), { target: { value: 'ru' } })
    const button = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(window.ziafAPI.saveSettings).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(useStore.getState().settings?.uiLanguage).toBe('en')
    expect(window.ziafAPI.getRepositories).not.toHaveBeenCalled()

    await act(async () => reply.resolve())
    expect(window.ziafAPI.getRepositories).toHaveBeenCalledTimes(1)
    expect(useStore.getState().settings?.uiLanguage).toBe('ru')
    expect(screen.getByRole('heading', { name: translate('ru', 'general_settings') })).not.toBeNull()
    expect(screen.queryByRole('button', { name: translate('ru', 'saving') })).toBeNull()
    expect(screen.queryByRole('button', { name: translate('ru', 'save_changes') })).toBeNull()
    expect(useStore.getState().activeTab).toBe('settings')
  })

  it('applies acknowledged settings when repository refresh fails and retains the existing repositories', async () => {
    const repository = { id: 'existing-project', name: 'Existing project', path: '/fixture/existing-project' }
    useStore.setState({ repositories: [repository], activeRepoId: repository.id })
    let rejectRefresh!: (error: Error) => void
    const refresh = new Promise<typeof repository[]>((_resolve, reject) => { rejectRefresh = reject })
    vi.mocked(window.ziafAPI.getRepositories).mockReturnValueOnce(refresh)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.spyOn(window.location, 'reload')
    render(<Settings />)
    fireEvent.change(languageInput(), { target: { value: 'ru' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save Changes' })))

    // Persistence is already acknowledged while the repository refresh remains pending.
    expect(useStore.getState().settings?.uiLanguage).toBe('ru')
    expect(screen.getByRole('heading', { name: translate('ru', 'general_settings') })).not.toBeNull()
    expect(useStore.getState().repositories).toEqual([repository])
    const refreshError = new Error('Repository refresh unavailable')
    await act(async () => rejectRefresh(refreshError))

    expect(window.ziafAPI.saveSettings).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('Failed to refresh repositories after saving settings', refreshError)
    expect(useStore.getState().settings?.uiLanguage).toBe('ru')
    expect(useStore.getState().repositories).toEqual([repository])
    expect(useStore.getState().activeRepoId).toBe(repository.id)
    expect(useStore.getState().activeTab).toBe('settings')
    expect(languageInput().value).toBe('ru')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: translate('ru', 'save_changes') })).toBeNull()
    expect(screen.queryByRole('button', { name: translate('ru', 'saving') })).toBeNull()
    expect(reload).not.toHaveBeenCalled()
  })
})
