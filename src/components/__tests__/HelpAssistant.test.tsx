// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HelpAssistant } from '../HelpAssistant'
import { useStore } from '../../store'
import type { LegacyZiafAPI } from '../../../shared/legacy-ipc'
import type { HelpAssistantState } from '../../../shared/help-assistant'
import { useHelpComposition } from '../helpAssistantComposition'

const sourceSha256 = 'a'.repeat(64)
let state: HelpAssistantState
let send: ReturnType<typeof vi.fn>
let stop: ReturnType<typeof vi.fn>
beforeEach(() => {
  useHelpComposition.setState({ draft: '', preset: '', revision: 0 })
  state = { entries: [], busy: false, sourceSha256, defaultPreset: 'Owner preset', nativeEnabled: false }
  send = vi.fn(async () => state); stop = vi.fn(async () => {})
  window.ziafAPI = { helpAssistant: { state: async () => state, send, stop, clear: async () => { state = { ...state, entries: [] }; return state } } } as unknown as LegacyZiafAPI
  useStore.setState({ presets: [{ name: 'Owner preset', agent: 'Claude Code', model: 'Owner model', permissions: 'Read & Write' }, { name: 'Another provider', agent: 'Codex', model: 'Owner other model', permissions: 'Workspace write' }], settings: { theme:'dark',language:'en',uiLanguage:'en',defaultIDE:'',autoArchive:'never',soundAlerts:false,soundType:'',desktopNotifications:false,launchAtLogin:false,preventSleep:false } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('sends with the chosen connected preset, preserves focus and renders validated section-reference controls', async () => {
  const onReference = vi.fn()
  send.mockImplementation(async () => ({ ...state, entries: [{ id: 'answer', role: 'assistant', text: '**Read** the guide.', sections: ['forge'], sourceSha256, at: Date.now() }] }))
  render(<HelpAssistant sections={[{ id: 'forge', title: 'Forge decisions', paragraphs: [], links: [] }]} onReference={onReference} onClose={vi.fn()} />)
  await waitFor(() => expect((screen.getByTestId('help-assistant-preset') as HTMLSelectElement).value).toBe('Owner preset'))
  fireEvent.change(screen.getByTestId('help-assistant-preset'), { target: { value: 'Another provider' } })
  const input = screen.getByTestId('help-assistant-input') as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: 'How do Forge decisions work?' } }); input.focus()
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(send).toHaveBeenCalledWith({ text: 'How do Forge decisions work?', presetName: 'Another provider', language: 'en' }))
  await waitFor(() => expect(input.value).toBe(''))
  expect(document.activeElement).toBe(input)
  expect(screen.getByText('Read').tagName).toBe('STRONG')
  fireEvent.click(screen.getByRole('button', { name: 'Forge decisions' }))
  expect(onReference).toHaveBeenCalledWith('forge')
})

it('provides Stop during a pending answer and retains the original question after cancellation', async () => {
  let settle!: (next: HelpAssistantState) => void
  send.mockImplementation(() => new Promise(resolve => { settle = resolve }))
  render(<HelpAssistant sections={[]} onReference={vi.fn()} onClose={vi.fn()} />)
  await waitFor(() => expect((screen.getByTestId('help-assistant-preset') as HTMLSelectElement).value).toBe('Owner preset'))
  const input = screen.getByTestId('help-assistant-input') as HTMLTextAreaElement
  fireEvent.change(input, { target: { value: 'Explain Work review.' } }); fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.click(await screen.findByRole('button', { name: 'Stop answer' }))
  expect(stop).toHaveBeenCalledTimes(1)
  settle({ ...state, error: 'help.aiStopped' })
  await screen.findByText('Answer stopped. Your question is still available.')
  expect(input.value).toBe('Explain Work review.')
  expect(document.activeElement).toBe(input)
})

it('retains drafts and preset across navigation and does not erase a new identical draft or steal focus on a late answer', async () => {
  let settle!: (next: HelpAssistantState) => void
  send.mockImplementation(() => new Promise(resolve => { settle = resolve }))
  const props = { sections: [], onReference: vi.fn(), onClose: vi.fn() }
  const view = render(<><input aria-label="Guide search fixture" /><HelpAssistant {...props} /></>)
  await waitFor(() => expect((screen.getByTestId('help-assistant-preset') as HTMLSelectElement).value).toBe('Owner preset'))
  const input = screen.getByTestId('help-assistant-input') as HTMLTextAreaElement
  fireEvent.change(screen.getByTestId('help-assistant-preset'), { target: { value: 'Another provider' } })
  fireEvent.change(input, { target: { value: 'My question' } }); fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.change(input, { target: { value: 'New draft' } }); fireEvent.change(input, { target: { value: 'My question' } })
  const search = screen.getByRole('textbox', { name: 'Guide search fixture' }); search.focus()
  settle(state); await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop answer' })).toBeNull())
  expect(input.value).toBe('My question'); expect(document.activeElement).toBe(search)
  view.unmount(); render(<HelpAssistant {...props} />)
  expect((screen.getByTestId('help-assistant-input') as HTMLTextAreaElement).value).toBe('My question')
  expect((screen.getByTestId('help-assistant-preset') as HTMLSelectElement).value).toBe('Another provider')
})
