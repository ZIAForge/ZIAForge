/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReconstructedMessage } from '../../../../shared/agent-events'
import { useStore } from '../../../store'
import { ConversationFeed } from '../ConversationFeed'

const saved = useStore.getState()
const message = (text: string, props: Partial<ReconstructedMessage> = {}): ReconstructedMessage => ({ id: 'reply', role: 'assistant', text, thinking: '', status: 'completed', timestamp: 1, ...props })
const phase = { status: 'needs_input', summary: '**Evidence collected.**', artifacts: [{ name: 'requirements.md', content: '# Actual requirements\n\nPreserve user drafts.' }], questions: [{ id: 'mode', question: 'Which behavior?', options: ['Strict', 'Permissive'] }], steps: [] }
const fenced = (value: unknown, kind = 'phase') => '```ziaforge-' + kind + '\n' + JSON.stringify(value) + '\n```'
beforeEach(() => useStore.setState({ settings: { ...saved.settings!, uiLanguage: 'en' } }))
afterEach(() => { cleanup(); useStore.setState(saved) })

describe('workflow-owned message presentation without journal mutation', () => {
  it('collapses instructions behind an exact original while retaining the phase and request', () => {
    const original = 'You are carrying out one preparation phase.\nTask: Preserve drafts\n\nInternal protocol <tag>\n  Keep exact whitespace.\n'
    const input = Object.freeze(message(original, { id: 'instruction', role: 'user' }))
    render(<ConversationFeed workflowTitle="Requirements" messages={[input]} />)
    expect(screen.getByTestId('workflow-instructions-instruction').textContent).toContain('Stage instructions: Requirements')
    expect(screen.getByText('Preserve drafts')).not.toBeNull()
    expect((screen.getByTestId('workflow-raw-instruction') as HTMLDetailsElement).open).toBe(false)
    expect(screen.getByTestId('workflow-raw-text-instruction').textContent).toBe(original)
    fireEvent.click(screen.getByText('Show original instructions'))
    expect((screen.getByTestId('workflow-raw-instruction') as HTMLDetailsElement).open).toBe(true)
    expect(input.text).toBe(original)
  })

  it('renders phase summary, actual document Markdown and questions with unchanged raw bytes', () => {
    const raw = fenced(phase)
    render(<ConversationFeed workflowTitle="Requirements" messages={[message(raw)]} />)
    expect(screen.getByTestId('workflow-result-reply').querySelector('strong')?.textContent).toBe('Evidence collected.')
    expect(screen.getByText('Which behavior?')).not.toBeNull()
    expect(screen.getByText('Strict')).not.toBeNull()
    fireEvent.click(screen.getByText('requirements.md'))
    expect(screen.getByRole('heading', { name: 'Actual requirements' })).not.toBeNull()
    expect(screen.getByTestId('workflow-raw-text-reply').textContent).toBe(raw)
    expect(screen.queryByRole('button', { name: /approve|continue/i })).toBeNull()
  })

  it('shows only received structured progress until the assistant completes it', () => {
    const raw = fenced({ summary: 'A real exploration report.', artifacts: [{ name: 'exploration_1.md', content: 'Located actual callers.' }] }, 'stage')
    const view = render(<ConversationFeed workflowTitle="Exploration 1" messages={[message(raw.slice(0, 60), { status: 'streaming' })]} />)
    expect(screen.getByTestId('workflow-result-streaming-reply')).not.toBeNull()
    expect(screen.queryByTestId('workflow-result-reply')).toBeNull()
    view.rerender(<ConversationFeed workflowTitle="Exploration 1" messages={[message(raw)]} />)
    expect(screen.getByTestId('workflow-result-reply').textContent).toContain('A real exploration report.')
    view.rerender(<ConversationFeed workflowTitle="Exploration 1" messages={[message(raw, { status: 'error' })]} />)
    expect(screen.queryByTestId('workflow-result-reply')).toBeNull()
    expect(screen.getByTestId('message-content-reply').textContent).toContain('exploration_1.md')
  })

  it('projects the last completed protocol fence while retaining all surrounding Markdown and exact original', () => {
    const raw = '**Before the result.**\n\n' + fenced({ ...phase, summary: 'Earlier draft.' }) + '\n\nAdditional evidence.\n\n' + fenced(phase) + '\n\n_After the result._'
    render(<ConversationFeed workflowTitle="Requirements" messages={[message(raw)]} />)
    const result = screen.getByTestId('workflow-result-reply')
    expect(result.querySelector('strong')?.textContent).toBe('Before the result.')
    expect(result.querySelector('em')?.textContent).toBe('After the result.')
    expect(result.querySelector('code')?.textContent).toContain('Earlier draft.')
    expect(result.textContent).toContain('Additional evidence.')
    expect(screen.getByText('Evidence collected.')).not.toBeNull()
    expect(screen.getByTestId('workflow-raw-text-reply').textContent).toBe(raw)
  })

  it('displays strict reviewer evidence while tools and approvals keep their original handlers', () => {
    const resolve = vi.fn()
    const raw = JSON.stringify({ outcome: 'changes_requested', summary: 'One source defect.', findings: [{ severity: 'blocking', location: 'src/input.ts:4', evidence: 'A replaced draft is cleared.', action: 'Fence the acknowledgement by draft revision.' }] })
    const input = message(raw, { tools: [{ callId: 'read', toolName: 'Read', status: 'completed', output: 'Source inspected.' }], approvals: [{ approvalId: 'permission', state: 'pending', command: 'node check.cjs', description: 'Read-only check', riskLevel: 'low' }] })
    render(<ConversationFeed workflowTitle="Review coordinator" messages={[input]} onResolveApproval={resolve} />)
    expect(screen.getByTestId('workflow-result-reply').textContent).toContain("Reviewer's conclusion: Changes requested")
    expect(screen.getByTestId('workflow-result-reply').querySelector('article')?.textContent).toContain('src/input.ts:4')
    expect(screen.getByTestId('tool-item-read')).not.toBeNull()
    fireEvent.click(screen.getByTestId('approval-deny-permission'))
    expect(resolve).toHaveBeenCalledWith('permission', 'deny')
    expect(screen.getByTestId('workflow-raw-text-reply').textContent).toBe(raw)
  })

  it.each([
    '{"outcome":["approved"],"summary":"Untrusted","findings":[]}',
    '{"outcome":"approved","summary":"Untrusted","findings":[],"otherApplication":true}',
    '```ziaforge-phase\n{"status":"ready","summary":"Broken","artifacts":null}\n```',
  ])('leaves unrelated or invalid JSON as visible Markdown instead of inventing a typed result: %s', raw => {
    render(<ConversationFeed workflowTitle="Preparation" messages={[message(raw)]} />)
    expect(screen.queryByTestId('workflow-result-reply')).toBeNull()
    expect(screen.getByTestId('message-content-reply').textContent).toContain(raw.includes('Broken') ? 'Broken' : 'Untrusted')
  })

  it('keeps ordinary chat Markdown and user text unchanged even when they resemble the protocol', () => {
    const raw = fenced(phase)
    render(<ConversationFeed messages={[message('**literal user**', { id: 'user', role: 'user' }), message(raw)]} />)
    expect(screen.queryByTestId('workflow-result-reply')).toBeNull()
    expect(screen.getByTestId('user-message-user').textContent).toContain('**literal user**')
    expect(screen.getByTestId('user-message-user').querySelector('strong')).toBeNull()
    expect(screen.getByTestId('message-content-reply').querySelector('code')?.textContent).toContain('"status":"needs_input"')
  })

  it('shows Work documents and questions only in Work phase chats, preserving raw response and Code presentation', () => {
    const raw = 'Found a useful direction.\n\n' + fenced({ ...phase, status: 'needs_input', sources: [], outputs: [] }, 'work') + '\n\nChoose the audience first.'
    const view = render(<ConversationFeed workflowTitle="Research" workflowKind="work" messages={[message(raw)]} />)
    expect(screen.getByTestId('workflow-result-reply').textContent).toContain('Found a useful direction.')
    expect(screen.getByTestId('workflow-result-reply').textContent).toContain('Choose the audience first.')
    expect(screen.getByText('Which behavior?')).not.toBeNull()
    expect(screen.getByTestId('workflow-raw-text-reply').textContent).toBe(raw)
    view.rerender(<ConversationFeed workflowTitle="Code preparation" messages={[message(raw)]} />)
    expect(screen.queryByTestId('workflow-result-reply')).toBeNull()
    expect(screen.getByTestId('message-content-reply').querySelector('code')?.textContent).toContain('"sources":[]')
    view.rerender(<ConversationFeed messages={[message(raw)]} />)
    expect(screen.queryByTestId('workflow-result-reply')).toBeNull()
    expect(screen.queryByTestId('workflow-raw-reply')).toBeNull()
  })
})
