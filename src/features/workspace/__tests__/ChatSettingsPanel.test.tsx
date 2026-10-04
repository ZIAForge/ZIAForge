/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore, type Settings } from '../../../store'
import { ChatSettingsPanel } from '../ChatSettingsPanel'

describe('ChatSettingsPanel model discovery', () => {
  beforeEach(() => useStore.setState({ settings: { uiLanguage: 'en' } as Settings }))
  afterEach(cleanup)

  it('ignores a late model catalog from a different CLI and preserves a typed model', async () => {
    let oldResolve!: (models: string[]) => void
    const oldModels = new Promise<string[]>(resolve => { oldResolve = resolve })
    const loadModels = vi.fn().mockImplementationOnce(() => oldModels).mockResolvedValueOnce(['claude-new'])
    const apply = vi.fn().mockResolvedValue(undefined)
    render(<ChatSettingsPanel current={{ presetName: 'Default', provider: 'codex', model: 'auto' }} presets={[]} busy={false} applying={false} loadModels={loadModels} onApply={apply} onClose={() => {}} />)
    await act(async () => fireEvent.change(screen.getByTestId('agent-chat-provider'), { target: { value: 'claude' } }))
    fireEvent.change(screen.getByTestId('agent-chat-model'), { target: { value: 'custom-selected-model' } })
    await act(async () => oldResolve(['stale-codex-model']))
    expect((screen.getByTestId('agent-chat-model') as HTMLInputElement).value).toBe('custom-selected-model')
    expect(document.querySelector('datalist')?.textContent).not.toContain('stale-codex-model')
    expect([...document.querySelectorAll('datalist option')].map(option => option.getAttribute('value'))).toEqual(['auto', 'claude-new'])
    await act(async () => fireEvent.click(screen.getByTestId('agent-chat-apply')))
    expect(apply).toHaveBeenCalledWith({ presetName: '', provider: 'claude', model: 'custom-selected-model', permissions: 'Read & Write', reasoningEffort: null })
  })

  it('keeps a custom model usable when model discovery fails', async () => {
    const apply = vi.fn().mockResolvedValue(undefined)
    render(<ChatSettingsPanel current={{ presetName: 'Default', provider: 'antigravity', model: 'custom-gemini' }} presets={[]} busy={false} applying={false} loadModels={vi.fn().mockRejectedValue(new Error('Catalog unavailable'))} onApply={apply} onClose={() => {}} />)
    await act(async () => {})
    expect((screen.getByTestId('agent-chat-model') as HTMLInputElement).value).toBe('custom-gemini')
    await act(async () => fireEvent.click(screen.getByTestId('agent-chat-apply')))
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ model: 'custom-gemini' }))
  })

  it('requires an explicit API connection and forwards its identity with the selected model', async () => {
    const apply = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'ziafAPI', { configurable: true, value: { apiConnections: { list: vi.fn().mockResolvedValue([
      { id: 'api-one', name: 'Local endpoint', baseUrl: 'http://127.0.0.1:9000/v1', model: 'server-model', enabled: true, hasApiKey: true },
      { id: 'api-off', name: 'Disabled endpoint', baseUrl: 'https://example.com/v1', model: 'off', enabled: false, hasApiKey: false },
    ]) }, getAgentModelCatalog: vi.fn(async ({ apiConnectionId }: { apiConnectionId?: string }) => ({ agent: 'OpenAI-compatible API', status: 'ready', source: 'api', command: `API catalog ${apiConnectionId}`, queriedAt: 1, models: [{ id: 'server-model', label: 'Server model' }] })) } })
    render(<ChatSettingsPanel current={{ presetName: '', provider: 'codex', model: 'auto' }} presets={[]} busy={false} applying={false} onApply={apply} onClose={() => {}} />)
    await act(async () => fireEvent.change(screen.getByTestId('agent-chat-provider'), { target: { value: 'api' } }))
    expect((screen.getByTestId('agent-chat-apply') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('option', { name: /Disabled endpoint/ }) as HTMLOptionElement).disabled).toBe(true)
    await act(async () => fireEvent.change(screen.getByTestId('agent-chat-api-connection'), { target: { value: 'api-one' } }))
    expect((screen.getByTestId('agent-chat-model') as HTMLInputElement).value).toBe('server-model')
    expect(window.ziafAPI.getAgentModelCatalog).toHaveBeenLastCalledWith({ agent: 'OpenAI-compatible API', apiConnectionId: 'api-one' })
    await act(async () => fireEvent.click(screen.getByTestId('agent-chat-apply')))
    expect(apply).toHaveBeenCalledWith({ presetName: '', provider: 'api', model: 'server-model', apiConnectionId: 'api-one', permissions: 'Read & Write', reasoningEffort: null })
  })
})
