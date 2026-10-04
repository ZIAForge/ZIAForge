/** @vitest-environment happy-dom */
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentModelCatalog } from '../../../../shared/agent-models'
import { useStore, type Settings } from '../../../store'
import { ComposerConfigurationBar } from '../ComposerConfigurationBar'
import { PresetEditorDialog } from '../PresetEditorDialog'
import type { ChatConfiguration } from '../agentConfiguration'

const current: ChatConfiguration = { presetName: '', provider: 'codex', model: 'model-a', permissions: 'Workspace write', reasoningEffort: 'none' }
const presets = [{ name: 'Saved', agent: 'Codex', model: 'model-a', permissions: 'Workspace write', reasoningEffort: 'none' }]
const catalog: AgentModelCatalog = { agent: 'Codex', source: 'cli', command: 'codex app-server model/list', status: 'ready', queriedAt: 1, manualReasoningEffort: true, models: [{ id: 'model-a', label: 'Model A', supportedReasoningEfforts: ['none', 'low'], defaultReasoningEffort: 'low' }, { id: 'model-b', label: 'Model B', supportedReasoningEfforts: ['high', 'xhigh'] }] }
const inputValue = (id: string) => (screen.getByTestId(id) as HTMLInputElement).value
beforeEach(() => {
  useStore.setState({ presets, settings: { uiLanguage: 'en' } as Settings })
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: {
    getAgentModelCatalog: vi.fn().mockResolvedValue(catalog), savePresets: vi.fn().mockResolvedValue(undefined),
    apiConnections: { list: vi.fn().mockResolvedValue([{ id: 'connection', name: 'Private API', enabled: true, model: 'api-model' }]) },
  } })
})
afterEach(cleanup)
function Bar({ onApply = async () => {}, busy = false }: { onApply?: (config: ChatConfiguration) => Promise<void>; busy?: boolean }) {
  const [value, setValue] = useState(current)
  return <><ComposerConfigurationBar current={value} presets={presets} busy={busy} applying={false} onApply={async next => { await onApply(next); setValue(next) }} /><button>Outside</button></>
}
describe('Composer configuration', () => {
  it('keeps a model/options proposal across segments, uses only advertised efforts and applies once', async () => {
    const apply = vi.fn().mockResolvedValue(undefined); render(<Bar onApply={apply} />)
    fireEvent.click(screen.getByTestId('composer-model-button'))
    await waitFor(() => expect(screen.getByTestId('agent-chat-model-catalog').textContent).toContain('Model B'))
    fireEvent.change(screen.getByTestId('agent-chat-model-catalog'), { target: { value: 'model-b' } })
    fireEvent.click(screen.getByTestId('composer-options-button'))
    await waitFor(() => expect(screen.getByTestId('agent-chat-reasoning-effort').textContent).toContain('xhigh'))
    expect(screen.getByTestId('agent-chat-reasoning-effort').textContent).not.toContain('ultra')
    expect(screen.getByTestId('agent-chat-proposal-summary').textContent).toBe('Pending: Codex · model-b')
    expect(screen.getByTestId('composer-model-button').textContent).toContain('model-a')
    fireEvent.change(screen.getByTestId('agent-chat-reasoning-effort'), { target: { value: 'xhigh' } })
    fireEvent.change(screen.getByTestId('agent-chat-permissions'), { target: { value: 'Read only' } })
    expect(apply).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByTestId('agent-chat-apply')))
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith({ ...current, model: 'model-b', permissions: 'Read only', reasoningEffort: 'xhigh' })
    expect(screen.getByTestId('composer-model-button').textContent).toContain('model-b')
  })
  it('does not refocus a manual field on rerender/refresh; Escape restores the segment and outside closes', async () => {
    render(<Bar />); fireEvent.click(screen.getByTestId('composer-model-button'))
    await waitFor(() => expect(inputValue('agent-chat-model')).toBe('model-a'))
    const manual = screen.getByTestId('agent-chat-model'); manual.focus()
    fireEvent.change(manual, { target: { value: 'future-model' } })
    expect(document.activeElement).toBe(manual)
    await act(async () => fireEvent.click(screen.getByTestId('agent-chat-model-refresh')))
    expect(inputValue('agent-chat-model')).toBe('future-model')
    expect(document.activeElement).toBe(manual)
    fireEvent.keyDown(manual, { key: 'Escape' })
    expect(screen.queryByTestId('agent-chat-settings')).toBeNull()
    expect(document.activeElement).toBe(screen.getByTestId('composer-model-button'))
    fireEvent.click(screen.getByTestId('composer-model-button'))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByTestId('agent-chat-settings')).toBeNull()
  })
  it('distinguishes default from explicit none and supports manual effort only when advertised', async () => {
    const apply = vi.fn().mockResolvedValue(undefined); render(<Bar onApply={apply} />)
    fireEvent.click(screen.getByTestId('composer-options-button'))
    await waitFor(() => expect(inputValue('agent-chat-reasoning-effort')).toBe('none'))
    fireEvent.change(screen.getByTestId('agent-chat-reasoning-effort'), { target: { value: '__default__' } })
    await act(async () => fireEvent.click(screen.getByTestId('agent-chat-apply')))
    expect(apply).toHaveBeenLastCalledWith({ ...current, reasoningEffort: null })
    fireEvent.click(screen.getByTestId('composer-model-button'))
    fireEvent.change(screen.getByTestId('agent-chat-model'), { target: { value: 'future-model' } })
    fireEvent.click(screen.getByTestId('composer-options-button'))
    await waitFor(() => expect(screen.getByTestId('agent-chat-reasoning-effort').textContent).toContain('Custom effort value'))
    fireEvent.change(screen.getByTestId('agent-chat-reasoning-effort'), { target: { value: '__manual__' } })
    expect(inputValue('agent-chat-reasoning-effort')).toBe('__manual__')
    fireEvent.change(screen.getByTestId('agent-chat-reasoning-manual'), { target: { value: 'future-effort' } })
    await act(async () => fireEvent.click(screen.getByTestId('agent-chat-apply')))
    expect(apply).toHaveBeenLastCalledWith({ ...current, model: 'future-model', reasoningEffort: 'future-effort' })
  })
  it('browses while busy without changing a proposal or applying it', async () => {
    const apply = vi.fn(); render(<Bar busy onApply={apply} />)
    fireEvent.click(screen.getByTestId('composer-options-button'))
    expect((screen.getByTestId('agent-chat-permissions') as HTMLSelectElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('agent-chat-apply')); expect(apply).not.toHaveBeenCalled()
  })
  it('does not steal focus from a next draft when Apply acknowledgement arrives late', async () => {
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    render(<><Bar onApply={() => pending} /><textarea aria-label="Next draft" /></>)
    fireEvent.click(screen.getByTestId('composer-model-button'))
    fireEvent.change(screen.getByTestId('agent-chat-model'), { target: { value: 'model-b' } })
    const apply = screen.getByTestId('agent-chat-apply'); apply.focus(); fireEvent.click(apply)
    const textarea = screen.getByLabelText('Next draft') as HTMLTextAreaElement
    textarea.focus(); fireEvent.change(textarea, { target: { value: 'Keep typing here' } })
    await act(async () => finish())
    expect(document.activeElement).toBe(textarea); expect(textarea.value).toBe('Keep typing here')
    expect(screen.queryByTestId('agent-chat-settings')).toBeNull()
  })

  it('keeps active configuration after a rejected switch', async () => {
    render(<Bar onApply={async () => { throw new Error('CLI unavailable') }} />)
    fireEvent.click(screen.getByTestId('composer-model-button'))
    fireEvent.change(screen.getByTestId('agent-chat-model'), { target: { value: 'other' } })
    await act(async () => fireEvent.click(screen.getByTestId('agent-chat-apply')))
    expect(screen.getByRole('alert').textContent).toContain('CLI unavailable')
    expect(screen.getByTestId('composer-model-button').textContent).toContain('model-a')
    expect(inputValue('agent-chat-model')).toBe('other')
  })
  it.each(['Escape', 'Cancel'])('returns footer-created preset dialog focus to its surviving trigger on %s', async method => {
    render(<Bar />)
    const trigger = screen.getByTestId('composer-preset-button'); trigger.focus(); fireEvent.click(trigger)
    fireEvent.click(screen.getByTestId('composer-create-preset'))
    expect(document.activeElement).toBe(screen.getByTestId('preset-name'))
    if (method === 'Escape') fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    else fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('preset-editor')).toBeNull(); expect(document.activeElement).toBe(trigger)
    await act(async () => {})
  })
  it.each([false, true])('returns saved preset focus synchronously, then respects a deliberate later focus move (%s)', async moveFocus => {
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    render(<><Bar onApply={() => pending} /><textarea aria-label="Next draft" /></>)
    const trigger = screen.getByTestId('composer-preset-button'); trigger.focus(); fireEvent.click(trigger)
    fireEvent.click(screen.getByTestId('composer-create-preset'))
    fireEvent.change(screen.getByTestId('preset-name'), { target: { value: 'Saved with focus' } })
    const save = screen.getByTestId('preset-save'); save.focus()
    await act(async () => fireEvent.click(save))
    expect(screen.queryByTestId('preset-editor')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(trigger); expect(screen.queryByTestId('agent-chat-settings')).toBeNull()
    const textarea = screen.getByLabelText('Next draft') as HTMLTextAreaElement
    if (moveFocus) { textarea.focus(); fireEvent.change(textarea, { target: { value: 'Unsent next draft' } }) }
    await act(async () => finish())
    expect(trigger.textContent).toContain('Saved with focus')
    expect(document.activeElement).toBe(moveFocus ? textarea : trigger)
    if (moveFocus) expect(textarea.value).toBe('Unsent next draft')
  })

  it('creates a preset in place then selects the persisted configuration', async () => {
    const apply = vi.fn().mockResolvedValue(undefined); render(<Bar onApply={apply} />)
    fireEvent.click(screen.getByTestId('composer-preset-button')); fireEvent.click(screen.getByTestId('composer-create-preset'))
    fireEvent.change(screen.getByTestId('preset-name'), { target: { value: 'New saved config' } })
    await act(async () => fireEvent.click(screen.getByTestId('preset-save')))
    expect(window.ziafAPI.savePresets).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'New saved config', reasoningEffort: 'none', permissions: 'Workspace write' })]))
    expect(apply).toHaveBeenCalledWith({ ...current, presetName: 'New saved config', apiConnectionId: undefined })
    expect(screen.queryByTestId('preset-editor')).toBeNull()
  })
})
describe('Preset editor persistence', () => {
  it('preserves API identity and effort on edit; failed save stays editable without changing the store', async () => {
    const original = { name: 'API config', agent: 'OpenAI-compatible API', model: 'api-model', permissions: 'Read only', reasoningEffort: 'high', apiConnectionId: 'connection' }
    useStore.setState({ presets: [original] })
    const save = vi.mocked(window.ziafAPI.savePresets); save.mockRejectedValueOnce(new Error('Disk full'))
    const close = vi.fn()
    render(<PresetEditorDialog initial={original} isEdit existingNames={[original.name]} onSave={next => useStore.getState().updatePreset(original.name, next)} onClose={close} />)
    fireEvent.change(screen.getByTestId('preset-name'), { target: { value: 'Renamed' } })
    await act(async () => fireEvent.click(screen.getByTestId('preset-save')))
    expect(screen.getByRole('alert').textContent).toContain('Disk full')
    expect(useStore.getState().presets).toEqual([original]); expect(close).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByTestId('preset-save')))
    expect(useStore.getState().presets).toEqual([{ ...original, name: 'Renamed' }]); expect(close).toHaveBeenCalledOnce()
  })
})
