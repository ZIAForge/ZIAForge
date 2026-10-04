// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Settings } from '../Settings'
import { useStore, type Settings as AppSettings } from '../../store'

const initialState = useStore.getState()
const settings: AppSettings = {
  theme: 'dark', language: 'en', uiLanguage: 'en', defaultIDE: 'VSCode', autoArchive: 'never',
  soundAlerts: false, soundType: 'Doorbell', desktopNotifications: false, launchAtLogin: false,
  preventSleep: false, useMockData: false,
}
beforeEach(() => useStore.setState({ ...initialState, settings, presets: [], repositories: [], saveSettings: vi.fn() }))
afterEach(() => { cleanup(); useStore.setState(initialState) })

describe('settings reflect available capabilities', () => {
  it('ordinary mode exposes real settings and task Git guidance without inactive system or Git controls', () => {
    render(<Settings />)
    for (const text of ['Theme', 'Response Language', 'Default IDE', 'Auto-Archive', 'Launch at Login', 'Prevent Sleep', 'Sound Alerts']) {
      expect(screen.queryByText(text, { exact: false }), text).toBeNull()
    }
    expect(screen.getByText('Interface Language')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Git' }))
    expect(screen.getByTestId('settings-git-guidance').textContent).toContain('Git panel')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(useStore.getState().settings?.launchAtLogin).toBe(false)
  })

  it('explicit mock mode keeps simulated Git controls', () => {
    useStore.setState({ settings: { ...settings, useMockData: true } })
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: 'Git' }))
    expect(screen.queryByTestId('settings-git-guidance')).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })
})
