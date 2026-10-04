import { describe, expect, it } from 'vitest'
import { parseWorkResult } from '../WorkTaskProtocol'
import { validateWorkResult } from '../WorkTaskValidation'

const fenced = (value: unknown) => '```ziaforge-work\n' + JSON.stringify(value) + '\n```'

describe('native Work result normalization', () => {
  it('accepts the captured outline transition with omitted empty collections and retains its exact semantic fields', () => {
    // Shape retained from the real 0.0.16 Codex failure; task prose shortened.
    const native = {
      status: 'continue', summary: 'Outline prepared for manual review.', complexity: 'medium', nextPhase: 'draft', followUpSize: 'large',
      artifacts: [{ name: 'outline.md', content: '## Before the first meeting\n\n- Prepare the invitation.\n\n## At the first meeting\n\n- Agree on discussion rules.\n\n## After the first meeting\n\n- Confirm the next date.' }],
    }
    const parsed = parseWorkResult(fenced(native))
    expect(parsed).toEqual({ ...native, questions: [], sources: [], steps: [] })
    expect(parsed).not.toHaveProperty('outputs')
    expect(() => validateWorkResult(native)).toThrow() // Persisted receipts remain strict.
    expect(() => validateWorkResult(parsed)).not.toThrow()
    expect(parseWorkResult(fenced({ status: 'complete', summary: 'A direct answer.' }))).toEqual({ status: 'complete', summary: 'A direct answer.', questions: [], artifacts: [], sources: [], steps: [] })
  })

  it('does not normalize explicit null, wrong collection types, unknown fields or incomplete semantic transitions', () => {
    const complete = { status: 'complete', summary: 'A direct answer.' }
    for (const field of ['questions', 'artifacts', 'sources', 'steps']) {
      for (const invalid of [null, {}, '', 0, false]) expect(() => parseWorkResult(fenced({ ...complete, [field]: invalid })), `${field}=${JSON.stringify(invalid)}`).toThrow()
    }
    const step = { title: 'An approved step', instructions: 'Produce the requested document.', acceptance: ['A complete document exists.'], verification: [] }
    for (const invalid of [
      { ...complete, status: 'needs_input' },
      { ...complete, status: 'plan' },
      { ...complete, status: 'continue' },
      { ...complete, status: 'continue', nextPhase: 'execution' },
      { ...complete, questions: [{ id: 'scope', question: 'Which audience?' }] },
      { ...complete, steps: [step] },
      { ...complete, cwd: '/untrusted' },
      { status: 'complete' },
      null, [],
    ]) expect(() => parseWorkResult(fenced(invalid))).toThrow()
    const questions = { status: 'needs_input', summary: 'Need audience.', questions: [{ id: 'scope', question: 'Which audience?' }] }
    expect(parseWorkResult(fenced(questions))).toEqual({ ...questions, artifacts: [], sources: [], steps: [] })
    const plan = { status: 'plan', summary: 'Proposed document work.', steps: [step] }
    expect(parseWorkResult(fenced(plan))).toEqual({ ...plan, questions: [], artifacts: [], sources: [] })
    expect(() => parseWorkResult(fenced(complete) + '\n' + fenced(complete))).toThrow(/exactly one/)
  })
})
