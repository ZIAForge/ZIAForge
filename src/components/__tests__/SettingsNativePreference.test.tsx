// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Settings } from '../Settings'
import { useStore, type Settings as AppSettings } from '../../store'
const initial = useStore.getState()
afterEach(() => { cleanup(); useStore.setState(initial) })
it('defaults to native Claude and persists a reversible app-only PATH preference', async () => {
  const settings: AppSettings = { theme: 'dark', language: 'en', uiLanguage: 'en', defaultIDE: 'VSCode', autoArchive: 'never', soundAlerts: false, soundType: 'Doorbell', desktopNotifications: false, launchAtLogin: false, preventSleep: false }
  useStore.setState({ ...initial, settings, presets: [] })
  const saveSettings = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { saveSettings, getRepositories: vi.fn().mockResolvedValue([]) } })
  const view = render(<Settings />)
  const preference = screen.getByRole('checkbox', { name: /Prefer native Claude executable/ }) as HTMLInputElement
  expect(preference.checked).toBe(true)
  fireEvent.click(preference)
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => expect(useStore.getState().settings?.preferNativeClaude).toBe(false))
  expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ preferNativeClaude: false }))
  view.unmount()
  render(<Settings />)
  expect((screen.getByRole('checkbox', { name: /Prefer native Claude executable/ }) as HTMLInputElement).checked).toBe(false)
})
