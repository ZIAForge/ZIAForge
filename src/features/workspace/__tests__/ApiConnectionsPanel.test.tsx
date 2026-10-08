/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiConnection, ApiConnectionsAPI } from '../../../../shared/api-provider'
import { useStore, type Settings } from '../../../store'
import { uiKey } from '../../../uiText'
import { ApiConnectionsPanel } from '../ApiConnectionsPanel'

const legacy: ApiConnection = { id: 'connection-legacy', name: 'Encrypted gateway', baseUrl: 'http://127.0.0.1:9876/v1', model: 'fixture-model', enabled: true, hasApiKey: true }
const originalAPI = Object.getOwnPropertyDescriptor(window, 'ziafAPI')
function fixture(connections = [legacy]) {
  const api = {
    list: vi.fn<ApiConnectionsAPI['list']>().mockResolvedValue(connections),
    save: vi.fn<ApiConnectionsAPI['save']>(async request => ({ ...request, id: request.id ?? 'new-connection', hasApiKey: true })),
    remove: vi.fn<ApiConnectionsAPI['remove']>().mockResolvedValue(undefined),
    inspect: vi.fn<ApiConnectionsAPI['inspect']>().mockResolvedValue({ version: 1, fetchedAt: 1000, tools: ['image_gen'], imageInput: true, imageGeneration: true, imageEdit: true, videoAvailable: false, videoRestriction: 'Not enabled for this account', interactiveQuestions: true, reasoningSummaries: false, contextWindows: [32000, 64000], usage: { creditUsagePercent: null, periodEnd: null }, warnings: [] }),
  }
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { apiConnections: api, getAgentModelCatalog: vi.fn().mockResolvedValue({ status: 'ready', models: [{ id: 'fixture-model', label: 'Fixture', contextWindows: [32000], defaultContextWindow: 32000 }, { id: 'other-model', label: 'Other', contextWindows: [64000] }] }) } })
  return api
}
const transport = () => screen.getByTestId('api-connection-transport') as HTMLSelectElement
const profile = () => screen.getByTestId('api-connection-profile') as HTMLSelectElement
const key = () => screen.getByTestId('api-connection-key') as HTMLInputElement
const submit = () => act(async () => { fireEvent.submit(screen.getByTestId('api-connection-save').closest('form')!) })
beforeEach(() => useStore.setState({ settings: { uiLanguage: 'en' } as Settings }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  if (originalAPI) Object.defineProperty(window, 'ziafAPI', originalAPI)
  else Reflect.deleteProperty(window, 'ziafAPI')
})

describe('explicit API connection transport', () => {
  it('offers explicit Grok discovery and only the selected model context choices without inventing usage', async () => {
    const connection: ApiConnection = { ...legacy, transport: 'responses', profile: 'grok-connector-v1', grok: { maxTurns: 12 } }
    const api = fixture([connection])
    render(<ApiConnectionsPanel />)
    await waitFor(() => expect(screen.getByTestId(`api-connection-${legacy.id}`)).not.toBeNull())
    fireEvent.click(within(screen.getByTestId(`api-connection-${legacy.id}`)).getByRole('button', { name: 'Edit' }))
    expect(profile().value).toBe('grok-connector-v1')
    expect(api.inspect).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByTestId(`api-grok-inspect-${legacy.id}`)))
    expect(api.inspect).toHaveBeenCalledExactlyOnceWith({ id: legacy.id })
    expect(screen.getByTestId('api-grok-credit-usage').textContent).toBe('No data')
    expect(screen.getByText('Not enabled for this account')).not.toBeNull()
    const choices = screen.getByTestId('api-grok-context-window') as HTMLSelectElement
    expect(Array.from(choices.options, option => option.value)).toEqual(['', '32000'])
    fireEvent.change(choices, { target: { value: '32000' } })
    await submit()
    expect(api.save.mock.calls[0][0]).toMatchObject({ profile: 'grok-connector-v1', grok: { contextWindow: 32000, maxTurns: 12 } })
    expect(api.save.mock.calls[0][0]).not.toHaveProperty('apiKey')
  })

  it.each(['openai-compatible', 'chat-completions'])('clears Grok-only settings when explicitly selecting %s', async selection => {
    const connection: ApiConnection = { ...legacy, transport: 'responses', profile: 'grok-connector-v1', grok: { contextWindow: 32000, maxTurns: 7 } }
    const api = fixture([connection])
    render(<ApiConnectionsPanel />)
    await waitFor(() => expect(screen.getByTestId(`api-connection-${legacy.id}`)).not.toBeNull())
    fireEvent.click(within(screen.getByTestId(`api-connection-${legacy.id}`)).getByRole('button', { name: 'Edit' }))
    fireEvent.change(selection === 'chat-completions' ? transport() : profile(), { target: { value: selection } })
    expect(screen.queryByTestId('api-grok-context-window')).toBeNull()
    await submit()
    expect(api.save.mock.calls[0][0].grok).toBeUndefined()
    expect(api.save.mock.calls[0][0]).not.toHaveProperty('apiKey')
  })

  it('sets up Responses as an unsaved draft and retains the saved key on explicit Save', async () => {
    const oldConnection: ApiConnection = { ...legacy, profile: 'codex-connector', allowCommands: true }
    const migrated: ApiConnection = { ...legacy, transport: 'responses', profile: 'openai-compatible', allowCommands: false }
    const api = fixture([oldConnection])
    api.list.mockResolvedValueOnce([oldConnection]).mockResolvedValue([migrated])
    let finishSave!: (value: ApiConnection) => void
    api.save.mockReturnValueOnce(new Promise(resolve => { finishSave = resolve }))
    render(<ApiConnectionsPanel />)
    await waitFor(() => expect(screen.getByTestId(`api-connection-${legacy.id}`)).not.toBeNull())
    expect(screen.getByText(uiKey('api_chat_completions_hint'))).not.toBeNull()
    const form = screen.getByTestId('api-connection-save').closest('form')!
    const scroll = vi.spyOn(form, 'scrollIntoView').mockImplementation(() => {})
    fireEvent.change(key(), { target: { value: 'unsaved-new-key' } })
    fireEvent.click(screen.getByTestId(`api-connection-responses-${legacy.id}`))
    const name = screen.getByTestId('api-connection-name') as HTMLInputElement
    expect(name.value).toBe(legacy.name)
    expect((screen.getByTestId('api-connection-url') as HTMLInputElement).value).toBe(legacy.baseUrl)
    expect((screen.getByTestId('api-connection-model') as HTMLInputElement).value).toBe(legacy.model)
    expect(transport().value).toBe('responses')
    expect(profile().value).toBe('openai-compatible')
    expect(profile().disabled).toBe(false)
    expect((screen.getByTestId('api-connection-commands') as HTMLInputElement).checked).toBe(false)
    expect(key().value).toBe('')
    expect(screen.getByText(uiKey('api_responses_hint'))).not.toBeNull()
    expect(screen.getByText(uiKey('api_saved_key_hint'))).not.toBeNull()
    expect(document.activeElement).toBe(name)
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(api.save).not.toHaveBeenCalled()
    expect(api.remove).not.toHaveBeenCalled()
    expect(api.list).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('api-connection-saved')).toBeNull()
    await submit()
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.save.mock.calls[0][0]).toEqual({ id: legacy.id, name: legacy.name, baseUrl: legacy.baseUrl, model: legacy.model, enabled: legacy.enabled, transport: 'responses', profile: 'openai-compatible', allowCommands: false })
    expect(api.save.mock.calls[0][0]).not.toHaveProperty('apiKey')
    expect(screen.queryByTestId('api-connection-saved')).toBeNull()
    await act(async () => { finishSave(migrated) })
    expect(screen.getByTestId('api-connection-saved').textContent).toBe(uiKey('api_connection_saved_hint'))
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId(`api-connection-responses-${legacy.id}`)).toBeNull()
    expect(transport().value).toBe('chat-completions')
  })

  it('keeps legacy transport and encrypted-key omission when editing an older connection', async () => {
    const api = fixture()
    render(<ApiConnectionsPanel />)
    await waitFor(() => expect(screen.getByTestId(`api-connection-${legacy.id}`)).not.toBeNull())
    fireEvent.click(within(screen.getByTestId(`api-connection-${legacy.id}`)).getByRole('button', { name: 'Edit' }))
    expect(transport().value).toBe('chat-completions')
    expect(profile().value).toBe('openai-compatible'); expect(profile().disabled).toBe(true)
    expect(screen.queryByTestId('api-connection-commands')).toBeNull()
    expect(key().value).toBe('')
    await submit()
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ id: legacy.id, transport: 'chat-completions', profile: 'openai-compatible', allowCommands: false }))
    expect(api.save.mock.calls[0][0]).not.toHaveProperty('apiKey')
  })

  it('saves Responses, connector profile and an explicit command choice without replacing the saved key', async () => {
    const api = fixture()
    render(<ApiConnectionsPanel />)
    await waitFor(() => expect(screen.getByTestId(`api-connection-${legacy.id}`)).not.toBeNull())
    fireEvent.click(within(screen.getByTestId(`api-connection-${legacy.id}`)).getByRole('button', { name: 'Edit' }))
    fireEvent.change(transport(), { target: { value: 'responses' } })
    expect(profile().disabled).toBe(false)
    const commands = screen.getByTestId('api-connection-commands') as HTMLInputElement
    expect(commands.checked).toBe(false)
    expect(screen.getByText('Commands run locally after your approval. This is not an operating-system sandbox.')).not.toBeNull()
    fireEvent.change(profile(), { target: { value: 'codex-connector' } })
    fireEvent.click(commands)
    await submit()
    expect(api.save.mock.calls[0][0]).toMatchObject({ id: legacy.id, transport: 'responses', profile: 'codex-connector', allowCommands: true })
    expect(api.save.mock.calls[0][0]).not.toHaveProperty('apiKey')
  })

  it('turns commands off and resets the profile when returning to Chat Completions', async () => {
    const connection: ApiConnection = { ...legacy, transport: 'responses', profile: 'codex-connector', allowCommands: true }
    const api = fixture([connection])
    render(<ApiConnectionsPanel />)
    await waitFor(() => expect(screen.getByTestId(`api-connection-${legacy.id}`)).not.toBeNull())
    expect(screen.queryByTestId(`api-connection-responses-${connection.id}`)).toBeNull()
    fireEvent.click(within(screen.getByTestId(`api-connection-${legacy.id}`)).getByRole('button', { name: 'Edit' }))
    expect((screen.getByTestId('api-connection-commands') as HTMLInputElement).checked).toBe(true)
    fireEvent.change(transport(), { target: { value: 'chat-completions' } })
    expect(screen.queryByTestId('api-connection-commands')).toBeNull()
    expect(profile().value).toBe('openai-compatible')
    await submit()
    expect(api.save.mock.calls[0][0]).toMatchObject({ transport: 'chat-completions', profile: 'openai-compatible', allowCommands: false })
  })

  it('removes credentials only on the explicit saved-key checkbox', async () => {
    const api = fixture()
    render(<ApiConnectionsPanel />)
    await waitFor(() => expect(screen.getByTestId(`api-connection-${legacy.id}`)).not.toBeNull())
    fireEvent.click(within(screen.getByTestId(`api-connection-${legacy.id}`)).getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Remove the saved key' }))
    expect(key().disabled).toBe(true)
    await submit()
    expect(api.save.mock.calls[0][0]).toMatchObject({ id: legacy.id, apiKey: '' })
  })
})
