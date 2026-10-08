/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GrokInteraction, GrokInteractionAnswer } from '../../../../shared/grok-interactions'
import { useStore, type Settings } from '../../../store'
import { ProviderInteractionCard } from '../ProviderInteractionCard'
import { ConversationFeed } from '../ConversationFeed'

const approval = (): GrokInteraction => ({ interactionId: 'native-permission', responseId: 'response-1', kind: 'approval', state: 'pending', expiresAt: Date.now() + 120_000,
  request: { sessionId: 'native-session', toolCall: { toolCallId: 'native-image', title: 'Generate image', rawInput: { prompt: 'fixture only' } }, options: [{ optionId: 'native-deny-once', name: 'Decline this action', kind: 'reject_once' }, { optionId: 'native-allow-once', name: 'Allow for this request only', kind: 'allow_once' }] } })
const question = (mode: 'default' | 'plan' = 'default'): GrokInteraction => ({ interactionId: 'native-question', responseId: 'response-2', kind: 'question', state: 'pending', expiresAt: Date.now() + 120_000,
  request: { sessionId: 'native-session', toolCallId: 'native-ask', mode, questions: [{ question: 'Какие платформы? Exact / text', multiSelect: true, options: [{ label: 'Linux', description: 'Desktop' }, { label: 'Windows', description: 'Desktop' }] }, { question: '  Точный вопрос — ответ?  ', multiSelect: false, options: [{ label: 'Default choice', description: 'Offered by the provider' }] }] } })
function deferred() { let resolve!: () => void; let reject!: (error: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
beforeEach(() => useStore.setState({ settings: { uiLanguage: 'en' } as Settings }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('provider-native interactions', () => {
  it('sends the offered native option ID once and ignores an old rejection after terminal replay', async () => {
    const pending = deferred(), resolve = vi.fn(() => pending.promise), value = approval()
    const view = render(<ProviderInteractionCard interaction={value} onResolve={resolve} />)
    expect(resolve).not.toHaveBeenCalled()
    const button = screen.getByRole('button', { name: 'Allow for this request only' })
    fireEvent.click(button); fireEvent.click(button)
    expect(resolve).toHaveBeenCalledExactlyOnceWith('native-permission', { kind: 'approval', optionId: 'native-allow-once' })
    expect((screen.getByRole('button', { name: 'Decline this action' }) as HTMLButtonElement).disabled).toBe(true)
    view.rerender(<ProviderInteractionCard interaction={{ ...value, state: 'resolved', answer: { kind: 'approval', optionId: 'native-allow-once' } }} onResolve={resolve} />)
    await act(async () => pending.reject(new Error('late transport failure')))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Resolved')
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('preserves exact native question text and labels across multi-select and a written answer', async () => {
    const resolve = vi.fn<(_: string, answer: GrokInteractionAnswer) => Promise<void>>().mockResolvedValue(undefined)
    render(<ProviderInteractionCard interaction={question()} onResolve={resolve} />)
    const groups = screen.getAllByRole('group')
    expect((screen.getByRole('button', { name: 'Send answer' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(groups[0]).getByRole('checkbox', { name: 'Linux Desktop' }))
    fireEvent.click(within(groups[0]).getByRole('checkbox', { name: 'Windows Desktop' }))
    fireEvent.click(within(groups[1]).getByRole('radio', { name: 'Other — write your answer' }))
    fireEvent.change(within(groups[1]).getByRole('textbox'), { target: { value: '  Собственный ответ: αβ\nSecond line  ' } })
    expect(resolve).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send answer' })))
    expect(resolve).toHaveBeenCalledExactlyOnceWith('native-question', { kind: 'question', outcome: 'accepted', answers: { 'Какие платформы? Exact / text': ['Linux', 'Windows'], '  Точный вопрос — ответ?  ': ['Other'] }, annotations: { '  Точный вопрос — ответ?  ': { notes: '  Собственный ответ: αβ\nSecond line  ' } } })
  })

  it('keeps cancellation distinct and exposes the two alternative outcomes only in plan mode', async () => {
    const resolve = vi.fn<(_: string, answer: GrokInteractionAnswer) => Promise<void>>().mockResolvedValue(undefined)
    const view = render(<ProviderInteractionCard interaction={question()} onResolve={resolve} />)
    expect(screen.queryByRole('button', { name: 'Skip interview' })).toBeNull()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel question' })))
    expect(resolve).toHaveBeenLastCalledWith('native-question', { kind: 'question', outcome: 'cancelled' })
    view.rerender(<ProviderInteractionCard interaction={{ ...question('plan'), interactionId: 'plan-discuss' }} onResolve={resolve} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Discuss these questions' })))
    expect(resolve).toHaveBeenLastCalledWith('plan-discuss', { kind: 'question', outcome: 'chat_about_this' })
    view.rerender(<ProviderInteractionCard interaction={{ ...question('plan'), interactionId: 'plan-skip' }} onResolve={resolve} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Skip interview' })))
    expect(resolve).toHaveBeenLastCalledWith('plan-skip', { kind: 'question', outcome: 'skip_interview' })
  })

  it('expires pending actions by their native deadline without sending a decision', () => {
    vi.useFakeTimers(); const resolve = vi.fn().mockResolvedValue(undefined)
    render(<ProviderInteractionCard interaction={{ ...approval(), expiresAt: Date.now() + 1000 }} onResolve={resolve} />)
    act(() => vi.advanceTimersByTime(1001))
    fireEvent.click(screen.getByRole('button', { name: 'Allow for this request only' }))
    expect(resolve).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('This request is no longer active')
  })

  it('renders historical native requests read-only and does not route them through local approvals', () => {
    const resolve = vi.fn(), local = vi.fn(), value = approval()
    const message = { id: 'historical-request', role: 'assistant' as const, thinking: '', text: '', status: 'completed' as const, timestamp: 1, interactions: [value] }
    const view = render(<ConversationFeed messages={[message]} onResolveInteraction={resolve} onResolveApproval={local} />)
    fireEvent.click(screen.getByRole('button', { name: 'Allow for this request only' }))
    expect(resolve).not.toHaveBeenCalled(); expect(local).not.toHaveBeenCalled()
    view.rerender(<ConversationFeed messages={[{ ...message, interactions: [{ ...value, state: 'expired' }] }]} actionableInteractionIds={[value.interactionId]} onResolveInteraction={resolve} />)
    expect((screen.getByRole('button', { name: 'Allow for this request only' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('retains an uncertain decision without enabling another POST after an unknown ACK', async () => {
    const resolve = vi.fn().mockRejectedValue(new Error('ACK unavailable'))
    render(<ProviderInteractionCard interaction={approval()} onResolve={resolve} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Allow for this request only' })))
    expect(screen.getByRole('alert').textContent).toBe('ACK unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Decline this action' }))
    expect(resolve).toHaveBeenCalledTimes(1)
  })
})
