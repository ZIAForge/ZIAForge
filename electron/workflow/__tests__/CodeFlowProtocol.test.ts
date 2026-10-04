import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CodeArtifactStore } from '../CodeArtifacts'
import { codePhasePrompt, parseCodePhaseResult } from '../CodeFlowProtocol'
import { createWorkflowTemplate } from '../WorkflowTemplates'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })
const proposal = () => ({ status: 'ready', summary: 'Diagnosis', questions: [], artifacts: [{ name: 'investigation.md', content: '# Root cause' }], steps: [{ title: 'Fix the parser', instructions: 'Fix the affected parser and regression', acceptance: ['The reported input is accepted'], verification: [{ executable: '/usr/bin/true', args: [], timeoutMs: 1000 }] }] })

describe('Code preparation boundary', () => {
  it('accepts the final structured phase after progress, but rejects policy/path/completion fields and incomplete phases', () => {
    const valid = proposal()
    expect(parseCodePhaseResult('Progress\n```ziaforge-phase\n' + JSON.stringify(valid) + '\n```', 'investigation', 'fix-bug')).toEqual(valid)
    for (const value of [
      { ...valid, status: 'completed' },
      { ...valid, permissions: 'danger-full-access' },
      { ...valid, artifacts: [{ name: '../investigation.md', content: '# Escape' }] },
      { ...valid, artifacts: [] },
      { ...valid, steps: [{ ...valid.steps[0], verification: [{ ...valid.steps[0].verification[0], cwd: '/tmp' }] }] },
      { ...valid, status: 'needs_input', questions: [{ id: 'scope', question: 'Which scope?' }] },
    ]) expect(() => parseCodePhaseResult(JSON.stringify(value), 'investigation', 'fix-bug')).toThrow()
    expect(() => parseCodePhaseResult('Tool output: ' + JSON.stringify(valid), 'investigation', 'fix-bug')).toThrow()
  })

  it('keeps questions non-executable and requires actual delivery documents', () => {
    const questions = { status: 'needs_input', summary: 'Need scope', questions: [{ id: 'scope', question: 'Which scope?', options: ['One package', 'All packages'] }], artifacts: [], steps: [] }
    expect(parseCodePhaseResult(JSON.stringify(questions), 'requirements', 'requirements-first').questions).toHaveLength(1)
    expect(() => parseCodePhaseResult(JSON.stringify({ ...questions, questions: [...questions.questions, ...questions.questions] }), 'requirements', 'requirements-first')).toThrow()
    expect(() => parseCodePhaseResult(JSON.stringify({ ...questions, status: 'ready', questions: [] }), 'delivery', 'spec-first')).toThrow('report.md')
  })

  it('preserves descriptive native counterquestion choices as canonical text without accepting malformed choices or executable work', () => {
    // Native agents can emit choice objects after a free-form counterquestion.
    // This reproduces the wire shape using synthetic, non-private wording.
    const choices = [{ label: 'ASCII', description: 'Predictable interoperability; limited writing systems.' },
      { label: 'Unicode 🌍', description: 'International names.\nNormalization remains an explicit decision.' }]
    const response = { status: 'needs_input', summary: 'Both options explained; no choice has been accepted.', preamble: 'The counterquestion is not approval.',
      questions: [{ id: 'character-policy', question: 'Which policy should the requirements describe?', options: choices }],
      artifacts: [{ name: 'requirements.md', content: '# Draft\nCharacter policy remains unresolved.' }], steps: [] }
    const parse = (value: unknown) => parseCodePhaseResult('```ziaforge-phase\n' + JSON.stringify(value) + '\n```', 'requirements', 'requirements-first')
    const expected = { ...response, questions: [{ ...response.questions[0], options: choices.map(choice => `${choice.label} — ${choice.description}`) }] }
    expect(parse(response)).toEqual(expected)
    expect(parse(expected)).toEqual(expected)
    for (const invalid of [null, { label: 'ASCII' }, { label: 'ASCII', description: null }, { label: '', description: 'Empty label' },
      { label: 'ASCII', description: 'x'.repeat(495) }, { label: 'ASCII', description: 'Text', permissions: 'danger-full-access' }]) {
      expect(() => parse({ ...response, questions: [{ ...response.questions[0], options: [invalid, choices[1]] }] })).toThrow('Invalid workflow question choice')
    }
    expect(() => parse({ ...response, status: 'ready' })).toThrow('Question status')
    expect(() => parse({ ...response, steps: proposal().steps })).toThrow('Resolve questions')
    const plan = createWorkflowTemplate({ title: 'Identifier validator', description: 'Discuss character policy first.', mode: 'code', template: 'Requirements first', coderPreset: '@task', reviewerPreset: '@task' })
    const prompt = codePhasePrompt({ plan, step: plan.steps[0], context: '' })
    expect(prompt).toContain('"options":["ASCII — explanation","Unicode — explanation"]')
    expect(prompt).toContain('not label/description objects')
  })

  it('keeps repeated routing metadata inert on a ready document without bypassing phase or Auto answer guards', () => {
    // Synthetic equivalent of a native response to a Requirements-stage answer:
    // "answer" describes this exchange, not a request to cancel implementation.
    const response = { status: 'ready', summary: 'The product rules are documented; the technical interface remains a later decision.',
      preamble: 'Do not infer approval of the document or of source changes.', questions: [],
      artifacts: [{ name: 'requirements.md', content: '# Requirements\nUser-selected product rules.\nTechnical interface is deferred.' }], steps: [], complexity: 'trivial', intent: 'answer' }
    const parse = (value: unknown, phase: Parameters<typeof parseCodePhaseResult>[1] = 'requirements', kind: Parameters<typeof parseCodePhaseResult>[2] = 'requirements-first') =>
      parseCodePhaseResult('```ziaforge-phase\n' + JSON.stringify(value) + '\n```', phase, kind)
    expect(parse(response)).toEqual(response)
    expect(() => parse({ ...response, artifacts: [] })).toThrow('requirements.md')
    expect(() => parse({ ...response, intent: 'approved' })).toThrow('Invalid task intent')
    expect(() => parse({ ...response, questions: [{ id: 'choice', question: 'Still unresolved?' }] })).toThrow('Question status')
    expect(() => parse({ ...response, artifacts: [] }, 'planning')).toThrow('concrete implementation steps')
    const planning = { ...response, artifacts: [{ name: 'plan.md', content: '# Proposed changes, still awaiting command approval' }], steps: proposal().steps }
    expect(parse(planning, 'planning')).toEqual(planning)
    const answer = { ...response, artifacts: [{ name: 'answer.md', content: '# An answer without a source change' }] }
    expect(parse(answer, 'discovery', 'auto')).toEqual(answer)
    expect(() => parse({ ...answer, steps: proposal().steps }, 'discovery', 'auto')).toThrow('Only Auto discovery')
    expect(() => parse(answer, 'discovery', 'requirements-first')).toThrow('Only Auto discovery')
    const plan = createWorkflowTemplate({ title: 'Identifier validator', description: 'Discuss rules first.', mode: 'code', template: 'Requirements first', coderPreset: '@task', reviewerPreset: '@task' })
    expect(codePhasePrompt({ plan, step: plan.steps[0], context: '' })).toContain('Omit intent and complexity in this phase')
    const auto = createWorkflowTemplate({ title: 'Answer a question', description: 'Explain the existing behavior.', mode: 'code', template: 'Auto', coderPreset: '@task', reviewerPreset: '@task' })
    expect(codePhasePrompt({ plan: auto, step: auto.steps[0], context: '' })).toContain('classify the WHOLE TASK')
  })

  it('preserves planning document aliases while preventing replacement of accepted foundation documents', () => {
    const parse = (value: unknown, kind: Parameters<typeof parseCodePhaseResult>[2] = 'requirements-first') => parseCodePhaseResult(JSON.stringify(value), 'planning', kind)
    const planning = { ...proposal(), summary: 'One proposed implementation; approval is still required.', artifacts: [{ name: 'final_plan.md', content: '# Plan\nOne bounded change with unchanged verification.' }] }
    for (const name of ['plan.md', 'planning.md', 'final_plan.md']) {
      const result = { ...planning, artifacts: [{ ...planning.artifacts[0], name }] }
      expect(parse(result)).toEqual(result)
    }
    for (const name of ['requirements.md', 'spec.md', 'report.md', 'answer.md']) {
      expect(() => parse({ ...planning, artifacts: [...planning.artifacts, { name, content: '# Unauthorized replacement' }] })).toThrow('different workflow phase')
    }
    expect(() => parse({ ...planning, steps: [] })).toThrow('concrete implementation steps')
    expect(parse(planning, 'multi-model')).toEqual(planning)
    expect(() => parse({ ...planning, artifacts: [] }, 'multi-model')).toThrow('final_plan.md')
    expect(() => parse({ ...planning, artifacts: [{ name: 'plan.md', content: '# Not the mandatory Multi result' }] }, 'multi-model')).toThrow('different workflow phase')
    const plan = createWorkflowTemplate({ title: 'Small validator', description: 'Approved product and interface decisions.', mode: 'code', template: 'Requirements first', coderPreset: '@task', reviewerPreset: '@task' })
    const step = { ...plan.steps[0], codePhase: 'planning' as const }
    const prompt = codePhasePrompt({ plan, step, context: '' })
    expect(prompt).toContain('Use these artifact names only for this phase: plan.md, planning.md, final_plan.md.')
    expect(prompt).toContain("Documents outside this phase's allowed output names are read-only inputs; return only listed names")
    expect(prompt).toContain('Only for Multi-model: use final_plan.md instead of plan.md')
    expect(prompt).toContain('"artifacts":[{"name":"plan.md"')
    expect(codePhasePrompt({ plan, step: plan.steps[0], context: '' })).toContain('Use these artifact names only for this phase: requirements.md.')
  })
})

describe('Code artifact storage', () => {
  it('retains immutable versions, reads only the task receipt, and rejects substitutions', async () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-artifacts-')))
    roots.push(root)
    const store = new CodeArtifactStore(() => root)
    const request = { taskId: 'task-a', stepId: 'step-a', attemptId: 'attempt-a', artifacts: [{ name: 'spec.md', content: '# Version one' }], previous: [] }
    const [first] = await store.write(request)
    expect((await store.write({ ...request, previous: [first] }))[0]).toEqual(first)
    await expect(store.write({ ...request, artifacts: [{ name: 'spec.md', content: '# Other bytes' }] })).rejects.toThrow('immutable')
    const [second] = await store.write({ ...request, attemptId: 'attempt-b', previous: [first], artifacts: [{ name: 'spec.md', content: '# Version two' }] })
    expect(second.version).toBe(2)
    expect((await store.read('task-a', first)).content).toBe('# Version one')
    expect(await store.context('task-a', [first, second])).toContain('# Version two')
    expect(await store.context('task-a', [first, second])).not.toContain('# Version one')
    await expect(store.read('task-a', { ...first, path: second.path })).rejects.toThrow('does not belong')
    fs.unlinkSync(first.path)
    fs.symlinkSync(second.path, first.path)
    await expect(store.read('task-a', first)).rejects.toThrow()
    fs.unlinkSync(first.path)
    fs.writeFileSync(first.path, '# Changed bytes')
    await expect(store.read('task-a', first)).rejects.toThrow('changed')
  })
})
