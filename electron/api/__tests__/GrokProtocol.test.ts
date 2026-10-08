import { describe, expect, it, vi } from 'vitest'
import { answerMatchesInteraction } from '../../../shared/grok-interactions'
import { consumeResponsesStream, type ResponsesStreamOptions } from '../ResponsesProtocol'
import { parseGrokEvent } from '../GrokProtocol'

const responseId = `resp_${'1'.repeat(32)}`
const approvalId = `approval_${'2'.repeat(32)}`
const questionId = `question_${'3'.repeat(32)}`
const base = { version: 1, response_id: responseId, sequence_number: 1 }
const approval = { type: 'grok.approval', ...base, approval: { id: approvalId, expires_in: 120, request: { sessionId: 'native-session', toolCall: { toolCallId: 'native-tool', title: 'Fetch webpage', rawInput: { url: 'https://example.invalid', api_key: 'do-not-project' } }, options: [{ optionId: 'exact-allow', name: 'Allow once', kind: 'allow_once' }, { optionId: 'exact-deny', name: 'Reject', kind: 'reject_once' }] } } }
const question = { type: 'grok.question', ...base, question: { id: questionId, request: { sessionId: 'native-session', toolCallId: 'question-tool', mode: 'plan', expiresAt: new Date(Date.now() + 600_000).toISOString(), questions: [{ question: 'Which design?', options: [{ label: 'Minimal', description: 'A small change', preview: '<b>plain text</b>' }, { label: 'Complete', description: 'A full design' }], multiSelect: false }, { question: 'Which targets?', options: [{ label: 'Mac', description: '' }, { label: 'Windows', description: '' }], multiSelect: true }] } } }
const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`
const created = { type: 'response.created', response: { id: responseId, grok: { version: 1, artifacts: [] } } }
const completed = { type: 'response.completed', response: { id: responseId, status: 'completed', output: [], grok: { version: 1, artifacts: [] } } }
function options(): ResponsesStreamOptions { return { signal: new AbortController().signal, onText: vi.fn(), onHosted: vi.fn(), onImage: vi.fn(), onResponseId: vi.fn(), onGrok: vi.fn() } }

describe('Grok Connector v1 protocol and exact native decisions', () => {
  it('preserves offered native option identities and strips private observation fields', () => {
    const event = parseGrokEvent(approval, responseId, 1000)
    expect(event).toMatchObject({ type: 'grok.approval', interaction: { expiresAt: 121000, request: { options: approval.approval.request.options } } })
    expect(JSON.stringify(event)).not.toContain('do-not-project')
    if (event.type !== 'grok.approval') throw new Error('Wrong event')
    expect(answerMatchesInteraction(event.interaction, { kind: 'approval', optionId: 'exact-allow' })).toBe(true)
    expect(answerMatchesInteraction(event.interaction, { kind: 'approval', optionId: 'allow' })).toBe(false)
  })
  it('matches exact question text, multi-select labels, Other notes and plan outcomes', () => {
    const event = parseGrokEvent(question, responseId)
    if (event.type !== 'grok.question') throw new Error('Wrong event')
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'accepted', answers: { 'Which design?': ['Other'], 'Which targets?': ['Mac', 'Windows'] }, annotations: { 'Which design?': { notes: 'Owner choice' } } })).toBe(true)
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'accepted', answers: { 'Which design?': ['Minimal', 'Complete'], 'Which targets?': ['Mac'] } })).toBe(false)
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'accepted', answers: { 'Which design?': ['Minimal'], 'Which targets?': ['Unknown'] } })).toBe(false)
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'chat_about_this', partial_answers: { 'Which design?': 'Minimal' } })).toBe(true)
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'skip_interview' })).toBe(true)
    if (event.interaction.kind !== 'question') throw new Error('Wrong interaction')
    event.interaction.request.mode = 'default'
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'skip_interview' })).toBe(false)
  })
  it('rejects inherited question keys and accepts exact own prototype-like text without throwing', () => {
    const event = parseGrokEvent(question, responseId)
    if (event.type !== 'grok.question' || event.interaction.kind !== 'question') throw new Error('Wrong interaction')
    event.interaction.request.questions = [{ question: '__proto__', options: [{ label: 'One', description: '' }], multiSelect: false }]
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'accepted', answers: { unrelated: ['One'] } })).toBe(false)
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'accepted', answers: JSON.parse('{"__proto__":["One"]}') })).toBe(true)
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'accepted', answers: JSON.parse('{"__proto__":"One"}') })).toBe(false)
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'chat_about_this', partial_answers: { unrelated: 'One' } })).toBe(false)
    expect(answerMatchesInteraction(event.interaction, { kind: 'question', outcome: 'chat_about_this', partial_answers: JSON.parse('{"__proto__":"One"}') })).toBe(true)
  })
  it.each([{ version: 2 }, { response_id: `resp_${'4'.repeat(32)}` }, { sequence_number: -1 }])('rejects wrong version, response ownership or sequence (%j)', override => {
    expect(() => parseGrokEvent({ ...approval, ...override }, responseId)).toThrow('invalid v1 event')
  })
  it('keeps questions independent from hosted tools and local permissions', async () => {
    const callbacks = options()
    const result = await consumeResponsesStream(new Response(frame(created) + frame(question) + frame(completed)), callbacks)
    expect(result.calls).toEqual([])
    expect(callbacks.onHosted).not.toHaveBeenCalled()
    expect(callbacks.onGrok).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'grok.question', interaction: expect.objectContaining({ kind: 'question' }) }))
  })
  it('does not opt generic or Codex streams into Grok interactions', async () => {
    const callbacks = options(); delete callbacks.onGrok
    expect((await consumeResponsesStream(new Response(frame(created) + frame({ ...approval, version: 999 }) + frame(completed)), callbacks)).calls).toEqual([])
    expect(callbacks.onHosted).not.toHaveBeenCalled()
  })
  it('rejects unsupported media and oversized question metadata before UI projection', () => {
    expect(() => parseGrokEvent({ type: 'grok.artifact', ...base, artifact: { id: `file_${'5'.repeat(32)}`, object: 'file', kind: 'video', mime_type: 'video/mp4', bytes: 20, sha256: 'a'.repeat(64) } }, responseId)).toThrow()
    const oversized = JSON.parse(JSON.stringify(question))
    oversized.question.request.questions[0].options[0].preview = 'a'.repeat(65537)
    expect(() => parseGrokEvent(oversized, responseId)).toThrow()
  })
})
