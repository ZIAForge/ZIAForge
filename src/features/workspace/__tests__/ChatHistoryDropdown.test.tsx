// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatHistoryDropdown } from '../ChatHistoryDropdown'

vi.mock('../../../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)
describe('task chat history menu', () => {
  it('portals outside clipped tabs, searches Open/Recent, restores focus on Escape, closes outside', () => {
    const onOpen = vi.fn()
    const view = render(<div style={{ overflow: 'hidden' }}><ChatHistoryDropdown tabs={[{ id: 'chat-a', name: 'Alpha open', type: 'chat' }]}
      recent={[{ id: 'chat-b', name: 'Beta closed', type: 'chat' }]} activeTabId="chat-a" onOpen={onOpen} onCloseAll={vi.fn()} /></div>)
    const trigger = screen.getByTestId('chat-history-button')
    fireEvent.click(trigger)
    const menu = screen.getByTestId('chat-history-dropdown')
    expect(view.container.contains(menu)).toBe(false)
    expect(document.activeElement).toBe(screen.getByTestId('chat-history-search'))
    fireEvent.change(screen.getByTestId('chat-history-search'), { target: { value: 'beta' } })
    expect(screen.queryByTestId('open-chat-chat-a')).toBeNull()
    fireEvent.click(screen.getByTestId('recent-chat-chat-b'))
    expect(onOpen).toHaveBeenCalledExactlyOnceWith({ id: 'chat-b', name: 'Beta closed', type: 'chat' })
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByTestId('chat-history-search'), { key: 'Escape' })
    expect(screen.queryByTestId('chat-history-dropdown')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(trigger); fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('chat-history-dropdown')).toBeNull()
  })
  it('offers close-all separately and excludes file tabs from chat search', () => {
    const onCloseAll = vi.fn()
    render(<ChatHistoryDropdown tabs={[{ id: 'chat-main', name: 'Discussion Feed', type: 'chat' }, { id: 'file-private', name: 'Private file', type: 'file' }]}
      recent={[]} activeTabId="chat-main" onOpen={vi.fn()} onCloseAll={onCloseAll} />)
    fireEvent.click(screen.getByTestId('chat-history-button'))
    expect(screen.queryByText('Private file')).toBeNull()
    fireEvent.click(screen.getByTestId('chat-history-close-all'))
    expect(onCloseAll).toHaveBeenCalledOnce()
  })
})
