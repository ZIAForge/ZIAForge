/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeInteraction } from '../../../../shared/claude-interactions'
import { useStore, type Settings } from '../../../store'
import { ProviderInteractionCard } from '../ProviderInteractionCard'
const approval = (): ClaudeInteraction => ({ provider: 'claude', interactionId: 'claude-approval', responseId: 'resp-fixture', kind: 'approval', state: 'pending', expiresAt: Date.now() + 60_000, request: { toolName: 'Write', input: { file_path: '/workspace/report.md' } } })
beforeEach(() => useStore.setState({ settings: { uiLanguage: 'en' } as Settings }))
afterEach(() => { cleanup(); vi.useRealTimers() })
describe('Claude native decisions', () => {
  it('submits allow once with the Claude envelope, never replays an unknown acknowledgement', async () => {
    const resolve = vi.fn().mockRejectedValue(new Error('Unknown acknowledgement'))
    render(<ProviderInteractionCard interaction={approval()} onResolve={resolve} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Allow' })))
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }))
    expect(resolve).toHaveBeenCalledExactlyOnceWith('claude-approval', { provider: 'claude', kind: 'approval', behavior: 'allow' })
    expect(screen.getByRole('alert').textContent).toBe('Unknown acknowledgement')
  })
  it('preserves exact questions and free-form answers separately from Grok arrays', async () => {
    const resolve = vi.fn().mockResolvedValue(undefined)
    const question: ClaudeInteraction = { provider: 'claude', interactionId: 'claude-question', responseId: 'resp-fixture', kind: 'question', state: 'pending', expiresAt: Date.now() + 60_000, request: { questions: [{ question: ' Exact question? ', options: [{ label: 'Linux' }, { label: 'Windows' }], multiSelect: true }, { question: 'Additional context?', options: [] }] } }
    render(<ProviderInteractionCard interaction={question} onResolve={resolve} />)
    const groups = screen.getAllByRole('group')
    fireEvent.click(within(groups[0]).getByRole('checkbox', { name: 'Linux' }))
    fireEvent.click(within(groups[0]).getByRole('checkbox', { name: 'Windows' }))
    fireEvent.change(within(groups[1]).getByRole('textbox'), { target: { value: '  Context\nСтрока  ' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send answer' })))
    expect(resolve).toHaveBeenCalledExactlyOnceWith('claude-question', { provider: 'claude', kind: 'question', outcome: 'accepted', answers: { ' Exact question? ': 'Linux, Windows', 'Additional context?': '  Context\nСтрока  ' } })
  })
  it('keeps historical and expired decisions read-only and ignores late rejected ACK after resolution', async () => {
    let reject!: (e: Error) => void
    const resolve = vi.fn(() => new Promise<void>((_, no) => { reject = no })), value = approval()
    const view = render(<ProviderInteractionCard interaction={value} />)
    fireEvent.click(screen.getByRole('button', { name: 'Allow' })); expect(resolve).not.toHaveBeenCalled()
    view.rerender(<ProviderInteractionCard interaction={value} onResolve={resolve} />)
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }))
    view.rerender(<ProviderInteractionCard interaction={{ ...value, state: 'resolved', answer: { provider: 'claude', kind: 'approval', behavior: 'allow' } as const }} onResolve={resolve} />)
    await act(async () => reject(new Error('Late rejection')))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Resolved')
    view.rerender(<ProviderInteractionCard interaction={{ ...value, interactionId: 'expired', expiresAt: Date.now() - 1 }} onResolve={resolve} />)
    expect((screen.getByRole('button', { name: 'Deny' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
