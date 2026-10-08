/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentMediaRef } from '../../../../shared/agent-media'
import type { ReconstructedMessage } from '../../../../shared/agent-events'
import { useStore, type Settings } from '../../../store'
import { ConversationFeed } from '../ConversationFeed'

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const media: AgentMediaRef = { id: 'media-22222222-2222-4222-8222-222222222222', sourceRunId: 'original-run', mime: 'image/png', bytes: 8, sha256: 'b'.repeat(64), width: 2, height: 1 }
const message: ReconstructedMessage = { id: 'media-message', role: 'assistant', text: '', thinking: '', status: 'completed', timestamp: 1, revision: 1, tools: [
  { callId: 'image-tool', toolName: 'image_generation', executor: 'provider', status: 'completed', output: 'Private provider details', media: [media] },
  { callId: 'provider-tool', toolName: 'web_search', executor: 'provider', status: 'running', input: { command: 'provider command' } },
  { callId: 'local-tool', toolName: 'run_command', executor: 'caller', status: 'running', input: { command: 'echo local' } },
] }
const urlDescriptors = Object.fromEntries(['createObjectURL', 'revokeObjectURL'].map(key => [key, Object.getOwnPropertyDescriptor(URL, key)]))
const originalAPI = Object.getOwnPropertyDescriptor(window, 'ziafAPI')
beforeEach(() => {
  useStore.setState({ settings: { uiLanguage: 'en' } as Settings })
  vi.stubGlobal('IntersectionObserver', undefined)
  let index = 0
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:feed-media-${++index}`) })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  for (const key of ['createObjectURL', 'revokeObjectURL']) {
    if (urlDescriptors[key]) Object.defineProperty(URL, key, urlDescriptors[key])
    else Reflect.deleteProperty(URL, key)
  }
  if (originalAPI) Object.defineProperty(window, 'ziafAPI', originalAPI)
  else Reflect.deleteProperty(window, 'ziafAPI')
})

describe('media feed ownership and executor controls', () => {
  it('keeps images and Save visible outside collapsed Tools/Output and suppresses local Stop for provider tools', async () => {
    const read = vi.fn().mockResolvedValue({ bytes, mime: 'image/png' }), save = vi.fn().mockResolvedValue({ cancelled: false }), onStopTool = vi.fn()
    Object.defineProperty(window, 'ziafAPI', { configurable: true, value: { agentMedia: { read, save } } })
    render(<ConversationFeed messages={[message]} mediaOwner={{ sessionId: 'current-session', runId: 'current-run' }} onStopTool={onStopTool} />)
    await waitFor(() => expect(screen.getByTestId(`generated-image-${media.id}`)).not.toBeNull())
    expect(screen.queryByText('Private provider details')).toBeNull()
    expect(screen.getByTestId('tool-provider-provider-tool').textContent).toBe('Provider tool')
    const stop = screen.getByRole('button', { name: 'Stop' })
    fireEvent.click(stop)
    expect(onStopTool).toHaveBeenCalledExactlyOnceWith('local-tool', 'echo local')
    fireEvent.click(within(screen.getByTestId(`tools-block-${message.id}`)).getAllByRole('button')[0])
    expect(screen.queryByTestId('tool-item-image-tool')).toBeNull()
    expect(screen.getByTestId(`generated-image-${media.id}`)).not.toBeNull()
    expect((screen.getByTestId(`generated-media-save-${media.id}`) as HTMLButtonElement).disabled).toBe(false)
    expect(read).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('updates the media owner even when an unchanged versioned row would normally stay memoized', async () => {
    const read = vi.fn().mockResolvedValue({ bytes, mime: 'image/png' })
    Object.defineProperty(window, 'ziafAPI', { configurable: true, value: { agentMedia: { read, save: vi.fn() } } })
    const view = render(<ConversationFeed messages={[message]} mediaOwner={{ sessionId: 'current-session', runId: 'run-two' }} />)
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    view.rerender(<ConversationFeed messages={[message]} mediaOwner={{ sessionId: 'current-session', runId: 'run-three' }} />)
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(read).toHaveBeenLastCalledWith({ sessionId: 'current-session', runId: 'run-three', mediaId: media.id })
  })
})
