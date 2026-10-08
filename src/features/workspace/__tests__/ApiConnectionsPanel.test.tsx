/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiConnection, ApiConnectionsAPI } from '../../../../shared/api-provider'
import { useStore, type Settings } from '../../../store'
import { ApiConnectionsPanel } from '../ApiConnectionsPanel'

const legacy: ApiConnection = { id: 'connection-legacy', name: 'Encrypted gateway', baseUrl: 'http://127.0.0.1:9876/v1', model: 'fixture-model', enabled: true, hasApiKey: true }
const originalAPI = Object.getOwnPropertyDescriptor(window, 'ziafAPI')
function fixture(connections = [legacy]) {
  const api = {
    list: vi.fn<ApiConnectionsAPI['list']>().mockResolvedValue(connections),
    save: vi.fn<ApiConnectionsAPI['save']>(async request => ({ ...request, id: request.id ?? 'new-connection', hasApiKey: true })),
    remove: vi.fn<ApiConnectionsAPI['remove']>().mockResolvedValue(undefined),
  }
  Object.defineProperty(window, 'ziafAPI', { configurable: true, writable: true, value: { apiConnections: api } })
  return api
}
const transport = () => screen.getByTestId('api-connection-transport') as HTMLSelectElement
const profile = () => screen.getByTestId('api-connection-profile') as HTMLSelectElement
const key = () => screen.getByTestId('api-connection-key') as HTMLInputElement
const submit = () => act(async () => { fireEvent.submit(screen.getByTestId('api-connection-save').closest('form')!) })
beforeEach(() => useStore.setState({ settings: { uiLanguage: 'en' } as Settings }))
afterEach(() => {
  cleanup()
  if (originalAPI) Object.defineProperty(window, 'ziafAPI', originalAPI)
  else Reflect.deleteProperty(window, 'ziafAPI')
})

describe('explicit API connection transport', () => {
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
