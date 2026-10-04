import { createHash } from 'node:crypto'
import type { WorkflowAttempt, WorkflowHelperSource, WorkflowPlan, WorkflowReviewSource } from '../../shared/workflow'

export type MultiStageRecord = NonNullable<WorkflowAttempt['multiStages']>[number]
export type MultiStageKind = MultiStageRecord['kind']
export const nativeMulti = (plan: WorkflowPlan): boolean => plan.codeFlow?.kind === 'multi-model' && plan.codeFlow.multi?.version === 1
export const evidenceHash = (evidence: string): string => createHash('sha256').update(evidence).digest('hex')

export function plannerSelection(plan: WorkflowPlan): WorkflowReviewSource {
  return plan.codeFlow?.planner ?? { id: 'planner', presetName: plan.coderPreset, configuration: plan.coderConfiguration, reasoningEffort: plan.coderReasoningEffort }
}
export function explorationSources(plan: WorkflowPlan): WorkflowHelperSource[] {
  if (plan.codeFlow?.multi?.explorers) return plan.codeFlow.multi.explorers
  if (plan.helpers?.length) return plan.helpers
  const base = plannerSelection(plan)
  return [
    { ...base, id: 'explore-behavior', instructions: 'Locate the relevant implementation, public interfaces, all callers and the request boundary. Cite actual file and symbol locations; distinguish facts from unknowns.' },
    { ...base, id: 'explore-checks', instructions: 'Locate regression fixtures, accepted verification commands, failure handling and project conventions relevant to this request. Report evidence and missing coverage without changing files.' },
  ]
}
export function designSources(plan: WorkflowPlan): WorkflowReviewSource[] {
  return plan.codeFlow?.multi?.designers ?? ['simplicity', 'correctness', 'conventions'].map(id => ({ ...plannerSelection(plan), id: `design-${id}` }))
}
export function reviewSources(plan: WorkflowPlan): WorkflowReviewSource[] {
  const base = { presetName: plan.reviewerPreset ?? plan.coderPreset, configuration: plan.reviewerPreset ? plan.reviewerConfiguration : plan.coderConfiguration, reasoningEffort: plan.reviewerReasoningEffort }
  return plan.reviewers ?? [1, 2, 3].map(index => ({ ...base, id: `review-worker-${index}` }))
}
export function reviewCoordinator(plan: WorkflowPlan): WorkflowReviewSource {
  return plan.codeFlow?.multi?.reviewCoordinator ?? { ...reviewSources(plan)[0], id: 'review-coordinator' }
}

/** Only obvious, bounded documentation changes qualify for an inferred skip.
 * Ambiguous code changes go to a durable human decision, never silent approval. */
export function reviewDecision(plan: WorkflowPlan, evidence: string, completePatch: string): { decision: 'review' | 'skip' | 'ask'; reason: string } {
  if (!plan.review || plan.codeFlow?.multi?.reviewDecision === 'never') return { decision: 'skip', reason: 'Independent review was explicitly disabled; accepted executable checks remain required.' }
  if (plan.codeFlow?.multi?.reviewDecision === 'always' || plan.reviewers || plan.reviewerConfiguration || !plan.codeFlow?.multi?.reviewDecision) return { decision: 'review', reason: 'The saved review policy or explicit reviewer configuration requires whole-task review.' }
  try {
    const parsed: unknown = JSON.parse(evidence)
    if (!parsed || typeof parsed !== 'object' || !('files' in parsed) || !Array.isArray(parsed.files) || !('diff' in parsed) || typeof parsed.diff !== 'string') throw new Error('Unknown evidence shape')
    const files = parsed.files.map(item => item && typeof item === 'object' && typeof item.path === 'string' ? item.path : undefined)
    if (files.some(item => !item)) throw new Error('Incomplete paths')
    const changedLines = completePatch.split('\n').filter(line => /^[+-](?![+-])/.test(line)).length
    const critical = files.some(name => /(?:auth|security|permission|credential|payment|billing|migrat|session|crypt|concurr|lock)/i.test(name!))
    if (files.length > 10 || changedLines > 200 || Buffer.byteLength(completePatch) > 32000 || critical) return { decision: 'review', reason: 'Changed-file size or critical code paths require whole-task independent review.' }
    if (files.length === 0 && !completePatch.trim()) return { decision: 'skip', reason: 'The actual workspace evidence contains no changed files or patch to review.' }
    if (files.length <= 3 && changedLines <= 50 && Buffer.byteLength(completePatch) <= 8000 && files.every(name => /\.(md|txt|rst)$/i.test(name!))) return { decision: 'skip', reason: 'The actual change is limited to at most three small documentation files and has no critical code path.' }
    return { decision: 'ask', reason: 'The change is neither an obvious small documentation edit nor clearly high risk. Choose whether to run the configured independent review workers.' }
  } catch {
    return { decision: 'ask', reason: 'The evidence does not support a safe automatic review decision. Choose whether to run independent whole-task review.' }
  }
}

export function multiStageIdentity(kind: MultiStageKind, index: number, cycle: number): string { return `multi-${kind}-${cycle}-${index}` }
