import { describe, expect, it } from 'vitest'
import type { CodeFlowResponse } from '../../../shared/code-flow'
import type { WorkflowSnapshot } from '../../../shared/workflow'
import { createWorkflowTemplate } from '../WorkflowTemplates'
import { validateWorkflowResponseCheckpoint } from '../WorkflowValidation'

// This is the exact pre-prepare guard used by workflow:respond in main. It is
// deliberately separate from the engine's verification/evidence authorization.
function fixture() {
  const current: WorkflowSnapshot = {
    schemaVersion: 1, taskId: 'task', runId: 'workflow', revision: 3, sequence: 92,
    plan: createWorkflowTemplate({ title: 'Review after explicit correction', description: 'Complete a bounded change', mode: 'code', template: 'Multi-model', coderPreset: 'Coder', reviewerPreset: 'Reviewer' }),
    status: 'completed', iterations: 5, steps: [], updatedAt: 1, commandIds: [],
    codeFlow: { artifacts: [], answers: [], multi: { reviewCycle: 2, fixCycle: 1, decision: 'review' } },
  }
  const request: CodeFlowResponse = { taskId: 'task', revision: 3, gateId: 'completed-review', commandId: 'fresh-review', action: 'rereview' }
  return { current, request }
}

describe('workflow:respond checkpoint admission', () => {
  it('admits the explicit completed-review sentinel without inventing a pending Gate B', () => {
    const { current, request } = fixture()
    expect(() => validateWorkflowResponseCheckpoint(current, request)).not.toThrow()
    expect(current.codeFlow!.pending).toBeUndefined()
    expect(() => validateWorkflowResponseCheckpoint(current, { ...request, action: 'approve' })).toThrow('checkpoint changed')
  })
  it('refuses stale task/revision/sentinel and unfinished, legacy or other-template flows', () => {
    const { current, request } = fixture()
    for (const modified of [{ ...request, taskId: 'other' }, { ...request, revision: 2 }, { ...request, gateId: 'another-gate' }]) expect(() => validateWorkflowResponseCheckpoint(current, modified)).toThrow()
    for (const status of ['running', 'paused', 'blocked', 'draft'] as const) expect(() => validateWorkflowResponseCheckpoint({ ...current, status }, request)).toThrow()
    const legacy = structuredClone(current); delete legacy.plan.codeFlow!.multi
    expect(() => validateWorkflowResponseCheckpoint(legacy, request)).toThrow()
    const different = structuredClone(current); different.plan.codeFlow!.kind = 'auto'
    expect(() => validateWorkflowResponseCheckpoint(different, request)).toThrow()
    expect(() => validateWorkflowResponseCheckpoint(null, request)).toThrow()
  })
  it('retains exact ordinary gate ownership and never treats a pending decision as completed re-review', () => {
    const { current, request } = fixture()
    current.status = 'paused'
    current.codeFlow!.pending = { id: 'gate-current', kind: 'review', reviewOutcome: 'changes_requested', stepId: 'step', attemptId: 'attempt', summary: 'Read the retained findings', artifactIds: [] }
    expect(() => validateWorkflowResponseCheckpoint(current, { ...request, action: 'approve', gateId: 'gate-current' })).not.toThrow()
    expect(() => validateWorkflowResponseCheckpoint(current, { ...request, action: 'approve', gateId: 'gate-stale' })).toThrow()
    expect(() => validateWorkflowResponseCheckpoint(current, request)).toThrow()
    current.status = 'completed'
    expect(() => validateWorkflowResponseCheckpoint(current, request)).toThrow()
  })
})
