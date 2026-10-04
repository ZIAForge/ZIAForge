import { randomUUID } from 'node:crypto'
import type { VerificationCommand, WorkflowPlan, WorkflowStep } from '../../shared/workflow'
import type { CodeFlowKind, CodePhase } from '../../shared/code-flow'

export const CODE_TEMPLATES = ['Auto', 'Fix a bug', 'Spec first', 'Requirements first', 'Multi-model'] as const
export const WORK_TEMPLATES = ['Auto-Pilot', 'Concept Design', 'Deep Ideation', 'Technical Research', 'Draft & Document'] as const
const codeKinds: Record<typeof CODE_TEMPLATES[number], CodeFlowKind> = { Auto: 'auto', 'Fix a bug': 'fix-bug', 'Spec first': 'spec-first', 'Requirements first': 'requirements-first', 'Multi-model': 'multi-model' }
const firstPhases: Record<CodeFlowKind, CodePhase> = { auto: 'discovery', 'fix-bug': 'investigation', 'spec-first': 'specification', 'requirements-first': 'requirements', 'multi-model': 'planning' }
const phaseTitles: Record<CodePhase, string> = { discovery: 'Discover scope', investigation: 'Investigate the defect', requirements: 'Define requirements', specification: 'Write the technical specification', planning: 'Propose the implementation plan', implementation: 'Implement the approved change', delivery: 'Report verified results' }

/** Preparation has its own result/artifact proof. It never pretends to run code checks. */
export function codePreparationStep(phase: Exclude<CodePhase, 'implementation'>, dependsOn: string[] = []): WorkflowStep {
  return { id: `step-${randomUUID()}`, title: phaseTitles[phase], instructions: '', acceptance: ['Produce the required phase result with repository evidence and explicit unresolved questions.'], dependsOn, newContext: true, stopAfter: false, verification: [], codePhase: phase }
}
const guidance: Record<string, [string, string, string]> = {
  Auto: ['Inspect the requirements and existing code; record a scoped plan in planning.md.', 'Implement the requested change and regression tests. Preserve unrelated changes.', 'Verify the complete result and write a concise handoff with evidence and limits.'],
  'Fix a bug': ['Reproduce the reported bug and document the expected and actual behavior.', 'Add a regression test and fix the cause of the bug.', 'Verify the regression and related behavior; explain the root cause and fix.'],
  'Spec first': ['Write technical_design.md with interfaces, alternatives and acceptance criteria.', 'Implement the approved design in small testable changes.', 'Check implementation against the design and document remaining tradeoffs.'],
  'Requirements first': ['Write product_requirements.md with user journeys and measurable acceptance criteria.', 'Implement the requirements and their tests.', 'Check every acceptance criterion and document the outcome.'],
  'Multi-model': ['Write a scoped design and explicit review questions in planning.md.', 'Implement the design and tests; prepare evidence for independent reviewers.', 'Resolve review disagreements using evidence and verify the complete result.'],
  'Auto-Pilot': ['Inspect the request and available source material; write an outline.', 'Produce the requested artifact in this folder with sources and assumptions.', 'Review the artifact against the request and prepare a concise handoff.'],
  'Concept Design': ['Identify audience, requirements, constraints and alternative concepts.', 'Develop the selected concept and its concrete artifacts.', 'Evaluate the concept against requirements and document tradeoffs.'],
  'Deep Ideation': ['Document the problem, constraints and useful perspectives.', 'Develop diverse candidate solutions with explicit assumptions.', 'Compare candidates using evidence and produce a prioritized recommendation.'],
  'Technical Research': ['Define research questions, scope and evidence standards.', 'Research the questions; record sources, dates and uncertainty.', 'Synthesize findings and verify that the conclusions follow from sources.'],
  'Draft & Document': ['Create an outline, audience definition and source inventory.', 'Write the requested document with citations where appropriate.', 'Edit for accuracy, structure and completeness; provide the final artifact.'],
}

/** A proposal saved as a draft. Commands run only after the user starts the plan. */
export function createWorkflowTemplate(config: {
  title: string; description: string; mode: 'code' | 'work'; template: string
  coderPreset: string; reviewerPreset: string; verification?: VerificationCommand
}): WorkflowPlan {
  const allowed: readonly string[] = config.mode === 'work' ? WORK_TEMPLATES : CODE_TEMPLATES
  if (!allowed.includes(config.template)) throw new Error('Workflow template does not match the selected task mode')
  if (config.mode === 'code') {
    const kind = codeKinds[config.template as typeof CODE_TEMPLATES[number]]
    const phase = firstPhases[kind]
    if (phase === 'implementation') throw new Error('Code workflows must begin with preparation')
    // Implementation and commands are proposed from the actual repository, then
    // accepted at a durable human gate. A canned template is not executable proof.
    return { title: config.title, coderPreset: config.coderPreset, reviewerPreset: config.reviewerPreset, review: true, advance: 'auto', maxFailures: 3, maxIterations: 50, steps: [{ ...codePreparationStep(phase), codeBasis: 1 }], codeFlow: { version: 1, kind, request: config.description, interaction: { version: 1 }, ...(kind === 'multi-model' ? { multi: { version: 1 as const, reviewDecision: 'auto' as const } } : {}) } }
  }
  const steps: WorkflowStep[] = guidance[config.template].map((instructions, index) => ({
    id: `step-${randomUUID()}`, title: ['Prepare', 'Create artifact', 'Review and deliver'][index],
    instructions: `${instructions}\n\nUser request:\n${config.description}`,
    acceptance: [index === 0 ? 'A concrete outline and source inventory exist; assumptions and next actions are explicit.' : 'The requested artifact exists in the task folder and its claims have supporting evidence.'],
    dependsOn: [], newContext: true, stopAfter: index === 0 && ['Spec first', 'Requirements first', 'Concept Design'].includes(config.template),
    verification: [],
  }))
  steps.forEach((step, index) => { if (index) step.dependsOn = [steps[index - 1].id] })
  return { title: config.title, coderPreset: config.coderPreset, reviewerPreset: config.reviewerPreset, review: true, advance: 'auto', maxFailures: 3, maxIterations: 50, steps }
}
