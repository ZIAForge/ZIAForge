import { validateSpecialization } from '../../shared/specializations'
import type { ReviewTeamPreset } from '../../shared/review-team'
import { isReasoningEffort } from '../../shared/agent-models'
import { isPermissionLabel, validateReasoningEffort } from '../runtime/AgentExecutionPolicy'
import type { VerificationCommand, WorkflowCustomAgentConfiguration, WorkflowGitReceipt, WorkflowPlan, WorkflowReview, WorkflowSnapshot } from '../../shared/workflow'
import { gitBranch } from '../git/GitValidation'
import path from 'node:path'
import type { CodeFlowDefinition, CodeFlowResponse, CodeFlowState } from '../../shared/code-flow'
import { preparationRequiredArtifacts, validateArtifactDrafts, validateCodeProposals } from './CodeFlowProtocol'
import { CODE_DIALOGUE_ENTRIES, CODE_DIALOGUE_LIMIT } from './CodeFlowDialogue'
import type { CodeFlowDiscussion } from '../../shared/code-flow'
import { validateCodePromptProfile } from './CodePromptProfile'
import { nativeMulti, multiStageIdentity } from './MultiModelPipeline'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
export function workflowId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw new Error('Invalid workflow identity')
}
function text(value: unknown, max: number, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max || value.includes('\0')) throw new Error('Invalid workflow text')
}
function exact(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  if (!isRecord(value) || required.some(key => !Object.prototype.hasOwnProperty.call(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) throw new Error('Invalid workflow fields')
}
function integer(value: unknown, min: number, max: number): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error('Invalid workflow limit or revision')
}
export function validateVerification(value: unknown): asserts value is VerificationCommand {
  exact(value, ['executable', 'args', 'timeoutMs'])
  text(value.executable, 4096)
  if (!Array.isArray(value.args) || value.args.length > 100) throw new Error('Invalid verification arguments')
  value.args.forEach(arg => text(arg, 10000, true))
  integer(value.timeoutMs, 100, 600000)
}
export function validateWorkflowConfiguration(value: unknown): asserts value is WorkflowCustomAgentConfiguration {
  exact(value, ['provider', 'model'], ['apiConnectionId', 'reasoningEffort', 'permissions'])
  if (typeof value.provider !== 'string' || !['codex', 'claude', 'antigravity', 'api'].includes(value.provider)) throw new Error('Invalid workflow provider')
  text(value.model, 200)
  if ([...value.model].some(char => char.charCodeAt(0) < 32)) throw new Error('Invalid workflow model identifier')
  if (value.provider === 'api') workflowId(value.apiConnectionId)
  else if (value.apiConnectionId !== undefined) throw new Error('Only API roles may select an API connection')
  validateReasoningEffort(value.provider as WorkflowCustomAgentConfiguration['provider'], value.reasoningEffort)
  if (value.permissions !== undefined && !isPermissionLabel(value.permissions)) throw new Error('Invalid workflow access selection')
}
function configuredSelection(name: unknown, configuration: unknown): void {
  if (name === '@custom') validateWorkflowConfiguration(configuration)
  else if (configuration !== undefined) throw new Error('Custom workflow configuration requires the Custom selector')
}
export function validatePlan(value: unknown): asserts value is WorkflowPlan {
  exact(value, ['title', 'coderPreset', 'review', 'advance', 'maxFailures', 'maxIterations', 'steps'], ['reviewerPreset', 'reviewers', 'reviewPolicy', 'helpers', 'git', 'coderReasoningEffort', 'coderPermissions', 'reviewerReasoningEffort', 'coderConfiguration', 'reviewerConfiguration', 'codeFlow', 'reviewTeam', 'coderSpecialization', 'reviewerSpecialization'])
  if (value.codeFlow !== undefined) validateCodeDefinition(value.codeFlow)
  if (value.reviewTeam !== undefined) validateReviewTeam(value.reviewTeam)
  for (const field of ['coderSpecialization', 'reviewerSpecialization']) if (value[field] !== undefined) validateSpecialization(value[field])
  for (const field of ['coderReasoningEffort', 'reviewerReasoningEffort']) if (value[field] !== undefined && value[field] !== null && !isReasoningEffort(value[field])) throw new Error('Invalid workflow reasoning effort')
  if (value.coderPermissions !== undefined && !isPermissionLabel(value.coderPermissions)) throw new Error('Invalid workflow access selection')
  text(value.title, 300); text(value.coderPreset, 200)
  if (value.reviewerPreset !== undefined) text(value.reviewerPreset, 200)
  configuredSelection(value.coderPreset, value.coderConfiguration)
  configuredSelection(value.reviewerPreset, value.reviewerConfiguration)
  if (value.reviewers !== undefined) validateSources(value.reviewers, false)
  if (value.helpers !== undefined) validateSources(value.helpers, true)
  if (value.reviewPolicy !== undefined && value.reviewPolicy !== 'all') throw new Error('Every reviewer must approve; voting cannot waive blocking findings')
  if (typeof value.review !== 'boolean' || (value.review && !value.reviewerPreset && !value.reviewers && !value.reviewTeam) || !['auto', 'manual'].includes(String(value.advance))) throw new Error('Invalid workflow policies')
  if (value.git !== undefined) {
    exact(value.git, ['commit', 'merge', 'push'], ['targetBranch', 'remote'])
    for (const field of ['commit', 'merge', 'push']) if (!['manual', 'after-plan'].includes(String(value.git[field]))) throw new Error('Invalid Git finalization policy')
    if (value.git.targetBranch !== undefined) gitBranch(value.git.targetBranch)
    if (value.git.remote !== undefined && (typeof value.git.remote !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(value.git.remote))) throw new Error('Invalid saved Git remote')
    if (value.git.merge === 'after-plan' && !value.git.targetBranch || value.git.push === 'after-plan' && !value.git.remote) throw new Error('Automatic merge and push require explicit destinations')
  }
  integer(value.maxFailures, 1, 10); integer(value.maxIterations, 1, 200)
  if (!Array.isArray(value.steps) || value.steps.length > 100) throw new Error('Expected up to 100 plan steps')
  const seen = new Set<string>()
  for (const step of value.steps) {
    exact(step, ['id', 'title', 'instructions', 'acceptance', 'dependsOn', 'newContext', 'stopAfter', 'verification'], ['presetName', 'red', 'reasoningEffort', 'permissions', 'configuration', 'codePhase', 'codeBasis', 'specialization'])
    if (step.specialization !== undefined) validateSpecialization(step.specialization)
    if (value.codeFlow !== undefined) {
      if (!['discovery', 'investigation', 'requirements', 'specification', 'planning', 'implementation', 'delivery'].includes(String(step.codePhase))) throw new Error('Each Code flow step needs its explicit phase')
    } else if (step.codePhase !== undefined) throw new Error('Preparation phases require a versioned Code flow')
    if (step.codeBasis !== undefined) { if (!value.codeFlow) throw new Error('Only Code steps have a foundation generation'); integer(step.codeBasis, 1, 1000) }
    if (step.reasoningEffort !== undefined && step.reasoningEffort !== null && !isReasoningEffort(step.reasoningEffort)) throw new Error('Invalid step reasoning effort')
    if (step.permissions !== undefined && !isPermissionLabel(step.permissions)) throw new Error('Invalid step access selection')
    workflowId(step.id)
    if (seen.has(step.id)) throw new Error('Duplicate plan step identity')
    text(step.title, 300); text(step.instructions, 20000, true)
    if (step.presetName !== undefined) text(step.presetName, 200)
    configuredSelection(step.presetName, step.configuration)
    if (typeof step.newContext !== 'boolean' || typeof step.stopAfter !== 'boolean') throw new Error('Invalid step policy')
    if (!Array.isArray(step.acceptance) || step.acceptance.length > 30) throw new Error('Invalid acceptance criteria')
    step.acceptance.forEach(item => text(item, 3000))
    // Ordered plan: dependencies can only point backwards. This also rejects cycles.
    if (!Array.isArray(step.dependsOn) || step.dependsOn.some(id => typeof id !== 'string' || !seen.has(id)) || new Set(step.dependsOn).size !== step.dependsOn.length) throw new Error('Dependencies must name earlier steps')
    if (!Array.isArray(step.verification) || step.verification.length > 10) throw new Error('Invalid verification commands')
    step.verification.forEach(validateVerification)
    if (step.red !== undefined) validateVerification(step.red)
    if (step.codePhase && step.codePhase !== 'implementation' && (step.verification.length || step.red !== undefined || step.newContext !== true)) throw new Error('Preparation uses fresh context and artifact proof, not implementation checks')
    seen.add(step.id)
  }
  if (nativeMulti(value as unknown as WorkflowPlan)) {
    const implementation = value.steps.filter(step => step.codePhase === 'implementation')
    if (new Set(implementation.map(step => step.codeBasis ?? 0)).size !== implementation.length || implementation.some(step => !step.verification.length)) throw new Error('Native Multi-model requires one whole-task implementation per foundation generation with accepted executable checks')
  }
}
function validateSources(value: unknown, helper: boolean, maximum = helper ? 4 : 8): void {
  if (!Array.isArray(value) || !value.length || value.length > maximum) throw new Error('Invalid workflow source count')
  const ids = new Set<string>()
  for (const source of value) {
    exact(source, helper ? ['id', 'presetName', 'instructions'] : ['id', 'presetName'], ['reasoningEffort', 'configuration', 'permissions', 'specialization'])
    if (source.specialization !== undefined) validateSpecialization(source.specialization)
    if (source.permissions !== undefined && !isPermissionLabel(source.permissions)) throw new Error('Invalid workflow source access selection')
    if (source.reasoningEffort !== undefined && source.reasoningEffort !== null && !isReasoningEffort(source.reasoningEffort)) throw new Error('Invalid source reasoning effort')
    workflowId(source.id); text(source.presetName, 200)
    configuredSelection(source.presetName, source.configuration)
    if (ids.has(source.id)) throw new Error('Workflow sources require distinct identities')
    ids.add(source.id)
    if (helper) text(source.instructions, 10000)
  }
}
export function validateReviewTeam(value: unknown): asserts value is ReviewTeamPreset {
  exact(value, ['version', 'id', 'name', 'reviewers', 'architect'])
  if (value.version !== 1) throw new Error('Invalid review team version')
  workflowId(value.id); text(value.name, 200)
  validateSources(value.reviewers, false); validateSources([value.architect], false)
  const architect = value.architect as unknown as ReviewTeamPreset['architect']
  if (architect.configuration && !['claude', 'api'].includes(architect.configuration.provider)) throw new Error('The blind architect supports only Claude or API with tools disabled')
  if ((value.reviewers as Array<{ id: string }>).some(source => source.id === (value.architect as { id: string }).id)) throw new Error('Architect requires its own identity')
}
function validateCodeDefinition(value: unknown): asserts value is CodeFlowDefinition {
  exact(value, ['version', 'kind', 'request'], ['planner', 'fixer', 'multi', 'promptProfile', 'interaction'])
  if (value.version !== 1 || !['auto', 'fix-bug', 'spec-first', 'requirements-first', 'multi-model'].includes(String(value.kind))) throw new Error('Invalid Code flow kind or version')
  text(value.request, 20000)
  if (value.interaction !== undefined) { exact(value.interaction, ['version']); if (value.interaction.version !== 1) throw new Error('Invalid Code interaction version') }
  if (value.planner !== undefined) validateSources([value.planner], false)
  if (value.fixer !== undefined) validateSources([value.fixer], false)
  if (value.promptProfile !== undefined) validateCodePromptProfile(value.promptProfile)
  if (value.multi !== undefined) {
    exact(value.multi, ['version'], ['explorers', 'designers', 'reviewCoordinator', 'reviewDecision'])
    if (value.kind !== 'multi-model' || value.multi.version !== 1) throw new Error('Invalid native Multi-model pipeline version')
    if (value.multi.explorers !== undefined) validateSources(value.multi.explorers, true, 6)
    if (value.multi.designers !== undefined) validateSources(value.multi.designers, false, 3)
    if (value.multi.reviewCoordinator !== undefined) validateSources([value.multi.reviewCoordinator], false)
    if (value.multi.reviewDecision !== undefined && !['auto', 'always', 'never'].includes(String(value.multi.reviewDecision))) throw new Error('Invalid whole-task review decision policy')
  }
}
function fingerprint(value: unknown): void {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid verification fingerprint')
}
export function validateWorkflowGitReceipt(value: unknown, taskId: string): asserts value is WorkflowGitReceipt {
  exact(value, ['operations', 'status'], ['error'])
  if (!['completed', 'blocked'].includes(String(value.status)) || !Array.isArray(value.operations) || value.operations.length > 100) throw new Error('Invalid Git finalization receipt')
  if (value.error !== undefined) text(value.error, 20000, true)
  for (const receipt of value.operations) {
    exact(receipt, ['schemaVersion', 'taskId', 'operationId', 'kind', 'signature', 'status', 'startedAt', 'beforeHead', 'stdout', 'stderr'], ['reviewedTree', 'finishedAt', 'afterHead', 'targetBranch', 'targetBeforeHead', 'targetPath', 'remote', 'recoveryRef', 'error', 'recovered'])
    if (receipt.schemaVersion !== 1 || receipt.taskId !== taskId || !['commit', 'merge', 'push'].includes(String(receipt.kind)) || !['pending', 'succeeded', 'failed', 'conflicted', 'interrupted'].includes(String(receipt.status))) throw new Error('Invalid Git operation receipt')
    workflowId(receipt.operationId); text(receipt.signature, 100000)
    integer(receipt.startedAt, 0, Number.MAX_SAFE_INTEGER)
    if (receipt.finishedAt !== undefined) integer(receipt.finishedAt, 0, Number.MAX_SAFE_INTEGER)
    for (const field of ['beforeHead', 'afterHead', 'reviewedTree', 'targetBeforeHead']) if (receipt[field] !== undefined && (typeof receipt[field] !== 'string' || !/^[a-f0-9]{40,64}$/.test(receipt[field] as string))) throw new Error('Invalid Git receipt revision')
    for (const field of ['targetBranch', 'targetPath', 'remote', 'recoveryRef', 'error']) if (receipt[field] !== undefined) text(receipt[field], 20000, true)
    text(receipt.stdout, 200000, true); text(receipt.stderr, 200000, true)
    if (receipt.recovered !== undefined && typeof receipt.recovered !== 'boolean') throw new Error('Invalid Git recovery receipt')
  }
}
export function validateWorkflowCommand(command: 'get' | 'save' | 'start' | 'pause' | 'respond' | 'discuss' | 'readArtifact', value: unknown): void {
  exact(value, command === 'save' ? ['taskId', 'expectedRevision', 'plan'] : command === 'start' ? ['taskId', 'revision', 'commandId'] : command === 'discuss' ? ['taskId', 'revision', 'commandId', 'text'] : command === 'respond' ? ['taskId', 'revision', 'gateId', 'commandId', 'action'] : command === 'readArtifact' ? ['taskId', 'artifactId'] : ['taskId'], command === 'respond' ? ['text', 'proposedSteps'] : command === 'discuss' ? ['stepId', 'phase', 'artifactEdits'] : [])
  workflowId(value.taskId)
  if (command === 'save') { integer(value.expectedRevision, 0, Number.MAX_SAFE_INTEGER); validatePlan(value.plan) }
  if (command === 'start') { integer(value.revision, 1, Number.MAX_SAFE_INTEGER); workflowId(value.commandId) }
  if (command === 'respond') {
    integer(value.revision, 1, Number.MAX_SAFE_INTEGER); workflowId(value.commandId); workflowId(value.gateId)
    if (!['answer', 'approve', 'changes', 'cancel', 'rereview'].includes(String(value.action))) throw new Error('Invalid workflow decision')
    if (value.text !== undefined) text(value.text, 12000, true)
    if ((value.action === 'answer' || value.action === 'changes') && (typeof value.text !== 'string' || !value.text.trim())) throw new Error('A workflow answer or change request cannot be empty')
    if (value.proposedSteps !== undefined) { if (value.action !== 'approve') throw new Error('Only approval can adopt an edited plan'); validateCodeProposals(value.proposedSteps) }
  }
  if (command === 'discuss') {
    integer(value.revision, 1, Number.MAX_SAFE_INTEGER); workflowId(value.commandId); text(value.text, 12000)
    if (value.stepId !== undefined) workflowId(value.stepId)
    if (value.phase !== undefined && !['discovery', 'investigation', 'requirements', 'specification', 'planning', 'implementation'].includes(String(value.phase))) throw new Error('Invalid discussion phase')
    if (value.phase !== undefined && value.stepId !== undefined) throw new Error('Select either a discussion phase or a step')
    if (value.artifactEdits !== undefined) {
      if (!Array.isArray(value.artifactEdits) || !value.artifactEdits.length || value.artifactEdits.length > 8) throw new Error('Invalid document edits')
      const ids = new Set<string>()
      for (const edit of value.artifactEdits) { exact(edit, ['artifactId', 'expectedSha256', 'content']); workflowId(edit.artifactId); fingerprint(edit.expectedSha256); text(edit.content, 30000); if (ids.has(edit.artifactId)) throw new Error('Duplicate document edit'); ids.add(edit.artifactId) }
    }
  }
  if (command === 'readArtifact') workflowId(value.artifactId)
}
/** Validate before main performs workspace preparation; rechecked after controlled pause. */
export function validateWorkflowDiscussionCheckpoint(current: WorkflowSnapshot | null, request: CodeFlowDiscussion): void {
  validateWorkflowCommand('discuss', request)
  if (!current?.codeFlow || !current.plan.codeFlow || current.taskId !== request.taskId || current.revision !== request.revision) throw new Error('Code discussion changed. Reload before sending.')
  if (request.stepId && !current.plan.steps.some(item => item.id === request.stepId)) throw new Error('The discussion step does not belong to this active plan')
  if (current.finalization?.receipt?.operations.length) throw new Error('This workflow has Git publication receipts. Create separate follow-up work to preserve that boundary.')
  if ((current.codeFlow.discussions?.length ?? 0) >= 200 || (current.codeFlow.dialogue?.length ?? 0) >= CODE_DIALOGUE_ENTRIES - 1 || current.iterations >= current.plan.maxIterations) throw new Error('The retained discussion or iteration limit was reached; no previous decisions were discarded')
  if (JSON.stringify([...current.codeFlow.discussions ?? [], request]).length > 2_000_000) throw new Error('The retained document edit history reached its size limit; no previous edits were discarded')
  for (const edit of request.artifactEdits ?? []) {
    const artifact = current.codeFlow.artifacts.find(item => item.id === edit.artifactId)
    if (!artifact || artifact.sha256 !== edit.expectedSha256 || !['requirements.md', 'spec.md', 'investigation.md', 'plan.md', 'planning.md', 'final_plan.md'].includes(artifact.name) || current.codeFlow.artifacts.some(item => item.name === artifact.name && item.version > artifact.version)) throw new Error('Edit only the current requirements, specification or plan document version; evidence reports remain immutable')
  }
}
/** Main checks the durable decision before preparing a workspace. The engine
 * still owns input fingerprints, published Git receipts and idempotent replies. */
export function validateWorkflowResponseCheckpoint(current: WorkflowSnapshot | null, request: CodeFlowResponse): void {
  if (!current?.codeFlow || current.taskId !== request.taskId || current.revision !== request.revision) throw new Error('Workflow checkpoint changed. Reload before responding.')
  if (request.action === 'rereview') {
    if (!nativeMulti(current.plan) || request.gateId !== 'completed-review' || current.status !== 'completed' || current.codeFlow.pending) throw new Error('Re-review requires the current completed Multi-model workflow')
  } else if (!current.codeFlow.pending || current.codeFlow.pending.id !== request.gateId) throw new Error('Workflow checkpoint changed. Reload before responding.')
}
export function parseWorkflowReview(output: string, maximumFindings = 100): WorkflowReview {
  const raw = output.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1')
  const value: unknown = JSON.parse(raw)
  exact(value, ['outcome', 'findings', 'summary'])
  if (!['approved', 'changes_requested'].includes(String(value.outcome))) throw new Error('Invalid review outcome')
  text(value.summary, 10000, true)
  if (!Array.isArray(value.findings) || value.findings.length > maximumFindings) throw new Error('Invalid review findings')
  for (const finding of value.findings) {
    exact(finding, ['severity', 'location', 'evidence', 'action'])
    if (!['blocking', 'suggestion'].includes(String(finding.severity))) throw new Error('Invalid review severity')
    text(finding.location, 3000, true); text(finding.evidence, 10000); text(finding.action, 10000)
  }
  if (value.outcome === 'approved' && value.findings.some(finding => finding.severity === 'blocking')) throw new Error('An approved review cannot contain blocking findings')
  return value as unknown as WorkflowReview
}
function validateCodeState(value: unknown, plan: WorkflowPlan, taskId: string, steps: WorkflowSnapshot['steps'], status: unknown): asserts value is CodeFlowState {
  exact(value, ['artifacts', 'answers'], ['preamble', 'complexity', 'pending', 'responses', 'fix', 'acceptedReviewAttemptIds', 'multi', 'basisRevision', 'dialogue', 'discussions', 'acceptedDocuments', 'acceptedPlans', 'retiredSteps'])
  if (!plan.codeFlow) throw new Error('Saved preparation state requires a Code flow')
  if (value.basisRevision !== undefined) integer(value.basisRevision, 1, 1000)
  if (plan.codeFlow.interaction && value.basisRevision === undefined) throw new Error('Interactive Code flow has no foundation revision')
  if (value.basisRevision !== undefined && plan.steps.some(step => (step.codeBasis ?? 0) > (value.basisRevision as number))) throw new Error('Step belongs to a future foundation generation')
  if (value.multi !== undefined) {
    exact(value.multi, ['reviewCycle', 'fixCycle'], ['decision', 'decisionReason'])
    if (!nativeMulti(plan)) throw new Error('Multi-model state requires its versioned native pipeline')
    integer(value.multi.reviewCycle, 1, 200); integer(value.multi.fixCycle, 0, 200)
    if (value.multi.decision !== undefined && !['review', 'skip'].includes(String(value.multi.decision))) throw new Error('Invalid saved review decision')
    if (value.multi.decisionReason !== undefined) text(value.multi.decisionReason, 12000)
  }
  if (value.preamble !== undefined) text(value.preamble, 16000, true)
  if (value.complexity !== undefined && !['trivial', 'small', 'medium', 'large'].includes(String(value.complexity))) throw new Error('Invalid saved complexity')
  if (!Array.isArray(value.artifacts) || value.artifacts.length > 2000) throw new Error('Invalid saved artifact count')
  const artifactRecords = value.artifacts
  const ids = new Set<string>(), versions = new Set<string>()
  for (const artifact of artifactRecords) {
    exact(artifact, ['id', 'name', 'path', 'version', 'sha256', 'bytes', 'stepId', 'attemptId', 'createdAt'])
    workflowId(artifact.id); workflowId(artifact.stepId); workflowId(artifact.attemptId)
    validateArtifactDrafts([{ name: artifact.name, content: 'validation' }])
    text(artifact.path, 4096); if (!path.isAbsolute(artifact.path)) throw new Error('Artifact paths must be absolute')
    integer(artifact.version, 1, 2000); integer(artifact.bytes, 1, 256000); integer(artifact.createdAt, 0, Number.MAX_SAFE_INTEGER); fingerprint(artifact.sha256)
    const version = `${String(artifact.name)}:${artifact.version}`
    if (ids.has(artifact.id) || versions.has(version)) throw new Error('Duplicate artifact identity or version')
    ids.add(artifact.id); versions.add(version)
    if (!steps.some(step => step.id === artifact.stepId && step.attempts.some(attempt => attempt.id === artifact.attemptId))) throw new Error('Artifact has no owning workflow attempt')
  }
  const references = (items: unknown) => {
    if (!Array.isArray(items) || items.length > 2000 || items.some(id => typeof id !== 'string' || !ids.has(id)) || new Set(items).size !== items.length) throw new Error('Invalid artifact references')
  }
  if (!Array.isArray(value.answers) || value.answers.length > 1000) throw new Error('Invalid saved workflow answers')
  for (const answer of value.answers) {
    exact(answer, ['stepId', 'kind', 'text', 'at']); workflowId(answer.stepId); text(answer.text, 12000, true); integer(answer.at, 0, Number.MAX_SAFE_INTEGER)
    if (!steps.some(step => step.id === answer.stepId) || !['answer', 'changes', 'approve'].includes(String(answer.kind))) throw new Error('Invalid saved answer identity or kind')
  }
  if (value.responses !== undefined) {
    if (!Array.isArray(value.responses) || value.responses.length > 1000) throw new Error('Invalid saved decision receipts')
    const commands = new Set<string>()
    for (const response of value.responses) {
      exact(response, ['revision', 'gateId', 'commandId', 'action'], ['text', 'proposedSteps'])
      validateWorkflowCommand('respond', { taskId, ...response })
      if (commands.has(response.commandId as string)) throw new Error('Duplicate workflow decision receipt')
      commands.add(response.commandId as string)
    }
  }
  if (value.dialogue !== undefined) {
    if (!Array.isArray(value.dialogue) || value.dialogue.length > CODE_DIALOGUE_ENTRIES || JSON.stringify(value.dialogue).length > CODE_DIALOGUE_LIMIT) throw new Error('Invalid saved Code dialogue size')
    const seen = new Set<string>()
    for (const item of value.dialogue) {
      exact(item, ['id', 'stepId', 'role', 'text', 'at'], ['questions', 'artifactIds'])
      workflowId(item.id); workflowId(item.stepId); text(item.text, 20000); integer(item.at, 0, Number.MAX_SAFE_INTEGER)
      if (seen.has(item.id) || !steps.some(step => step.id === item.stepId) || !['user', 'assistant'].includes(String(item.role))) throw new Error('Invalid Code dialogue identity')
      seen.add(item.id)
      if (item.artifactIds !== undefined) references(item.artifactIds)
      if (item.questions !== undefined) {
        if (item.role !== 'assistant' || !Array.isArray(item.questions) || item.questions.length > 8) throw new Error('Invalid saved dialogue questions')
        const questionIds = new Set<string>()
        for (const question of item.questions) {
          exact(question, ['id', 'question'], ['options']); workflowId(question.id); text(question.question, 3000)
          if (questionIds.has(question.id)) throw new Error('Duplicate saved dialogue question')
          questionIds.add(question.id)
          if (question.options !== undefined) { if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) throw new Error('Invalid saved question options'); question.options.forEach(option => text(option, 500)) }
        }
      }
    }
  }
  if (value.discussions !== undefined) {
    if (!Array.isArray(value.discussions) || value.discussions.length > 200 || JSON.stringify(value.discussions).length > 2_000_000) throw new Error('Invalid discussion receipt count or size')
    const commands = new Set<string>()
    for (const item of value.discussions) {
      exact(item, ['revision', 'commandId', 'text'], ['stepId', 'phase', 'artifactEdits'])
      validateWorkflowCommand('discuss', { taskId, ...item })
      if (commands.has(item.commandId as string)) throw new Error('Duplicate discussion receipt')
      commands.add(item.commandId as string)
    }
  }
  for (const field of ['acceptedDocuments', 'acceptedPlans'] as const) if (value[field] !== undefined) {
    const receipts = value[field]
    if (!Array.isArray(receipts) || receipts.length > 200) throw new Error('Invalid Code acceptance receipts')
    for (const receipt of receipts) {
      exact(receipt, field === 'acceptedDocuments' ? ['commandId', 'stepId', 'phase', 'basisRevision', 'artifacts', 'at'] : ['commandId', 'basisRevision', 'stepIds', 'artifacts', 'workspaceFingerprint', 'at'], ['invalidatedAt'])
      workflowId(receipt.commandId); integer(receipt.basisRevision, 1, 1000); integer(receipt.at, 0, Number.MAX_SAFE_INTEGER)
      if (receipt.invalidatedAt !== undefined) integer(receipt.invalidatedAt, 0, Number.MAX_SAFE_INTEGER)
      if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length > 2000) throw new Error('Invalid accepted document references')
      const refs = new Set<string>()
      for (const artifact of receipt.artifacts) {
        exact(artifact, ['id', 'sha256']); workflowId(artifact.id); fingerprint(artifact.sha256)
        if (refs.has(artifact.id) || !artifactRecords.some(item => isRecord(item) && item.id === artifact.id && item.sha256 === artifact.sha256)) throw new Error('Acceptance refers to a different document')
        refs.add(artifact.id)
      }
      if (field === 'acceptedDocuments') {
        workflowId(receipt.stepId)
        if (!['requirements', 'specification'].includes(String(receipt.phase)) || !steps.some(step => step.id === receipt.stepId) || !receipt.artifacts.length) throw new Error('Invalid accepted preparation document')
        const expectedName = receipt.phase === 'requirements' ? 'requirements.md' : 'spec.md'
        if (!receipt.artifacts.some(reference => isRecord(reference) && artifactRecords.some(artifact => isRecord(artifact) && artifact.id === reference.id && artifact.name === expectedName && artifact.stepId === receipt.stepId))) throw new Error('Accepted document does not match its preparation phase')
      } else {
        fingerprint(receipt.workspaceFingerprint)
        if (!Array.isArray(receipt.stepIds) || !receipt.stepIds.length || receipt.stepIds.length > 100 || new Set(receipt.stepIds).size !== receipt.stepIds.length) throw new Error('Invalid accepted plan steps')
        for (const id of receipt.stepIds) { workflowId(id); if (!steps.some(step => step.id === id)) throw new Error('Accepted implementation identity is missing') }
      }
    }
  }
  if (value.pending !== undefined) {
    exact(value.pending, ['id', 'kind', 'stepId', 'attemptId', 'summary', 'artifactIds'], ['questions', 'proposedSteps', 'reviewOutcome', 'artifactHashes', 'phase'])
    const gate = value.pending
    workflowId(gate.id); workflowId(gate.stepId); workflowId(gate.attemptId); text(gate.summary, 12000); references(gate.artifactIds)
    if (!['questions', 'document', 'plan', 'review', 'review-decision'].includes(String(gate.kind)) || !['paused', 'blocked'].includes(String(status))) throw new Error('Invalid pending decision lifecycle')
    if (gate.phase !== undefined && gate.phase !== plan.steps.find(step => step.id === gate.stepId)?.codePhase) throw new Error('Gate belongs to a different preparation phase')
    if (gate.artifactHashes !== undefined) {
      if (!Array.isArray(gate.artifactHashes) || gate.artifactHashes.length !== (gate.artifactIds as unknown[]).length) throw new Error('Invalid displayed document hashes')
      for (const [index, item] of gate.artifactHashes.entries()) { exact(item, ['id', 'sha256']); if (item.id !== (gate.artifactIds as string[])[index] || !artifactRecords.some(artifact => isRecord(artifact) && artifact.id === item.id && artifact.sha256 === item.sha256)) throw new Error('Displayed document hash changed') }
    }
    const owner = steps.find(step => step.id === gate.stepId)
    const attempt = owner?.attempts.at(-1)
    if (!attempt || attempt.id !== gate.attemptId) throw new Error('Pending decision belongs to a stale attempt')
    if (gate.kind !== 'review' && gate.reviewOutcome !== undefined) throw new Error('Only review decisions carry a review outcome')
    if (gate.kind === 'questions') {
      if (attempt.status !== 'interrupted' || gate.proposedSteps !== undefined || !Array.isArray(gate.questions) || !gate.questions.length || gate.questions.length > 8) throw new Error('Invalid question gate')
      const questions = new Set<string>()
      for (const question of gate.questions) {
        exact(question, ['id', 'question'], ['options']); workflowId(question.id); text(question.question, 3000)
        if (questions.has(question.id)) throw new Error('Duplicate workflow question')
        questions.add(question.id)
        if (question.options !== undefined) { if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) throw new Error('Invalid question options'); question.options.forEach(option => text(option, 500)) }
      }
    } else if (gate.kind === 'document') {
      if (!plan.codeFlow.interaction || !['requirements', 'specification'].includes(String(gate.phase)) || attempt.status !== 'completed' || !attempt.preparation || gate.questions !== undefined || gate.proposedSteps !== undefined || !gate.artifactHashes || !(gate.artifactIds as string[]).length) throw new Error('Invalid document acceptance gate')
    } else if (gate.kind === 'plan') {
      if (attempt.status !== 'completed' || !attempt.preparation || gate.questions !== undefined || !Array.isArray(gate.proposedSteps) || !gate.proposedSteps.length || gate.proposedSteps.length > 17) throw new Error('Invalid implementation plan gate')
      validatePlan({ ...plan, steps: [...plan.steps, ...gate.proposedSteps] })
      if (gate.proposedSteps.some(step => !isRecord(step) || !['implementation', 'delivery'].includes(String(step.codePhase)))) throw new Error('A plan gate may propose implementation and its final report only')
    } else if (gate.kind === 'review-decision') {
      if (!nativeMulti(plan) || attempt.status !== 'interrupted' || attempt.stage !== 'review' || gate.questions !== undefined || gate.proposedSteps !== undefined || gate.reviewOutcome !== undefined || !attempt.verification.some(item => item.phase === 'green' && item.status === 'passed' && item.cleanupVerified && item.exitCode === 0)) throw new Error('Invalid whole-task review choice')
    } else {
      const approved = gate.reviewOutcome === 'approved'
      if (plan.codeFlow.kind !== 'multi-model' || !['approved', 'changes_requested'].includes(String(gate.reviewOutcome)) || attempt.status !== (approved ? 'interrupted' : 'failed') || attempt.stage !== 'review' || attempt.review?.outcome !== gate.reviewOutcome || approved && !attempt.review?.findings.length || gate.questions !== undefined || gate.proposedSteps !== undefined) throw new Error('Invalid independent review gate')
    }
  }
  if (value.acceptedReviewAttemptIds !== undefined) {
    if (plan.codeFlow.kind !== 'multi-model' || !Array.isArray(value.acceptedReviewAttemptIds) || value.acceptedReviewAttemptIds.length > 200 || new Set(value.acceptedReviewAttemptIds).size !== value.acceptedReviewAttemptIds.length) throw new Error('Invalid accepted review identities')
    for (const id of value.acceptedReviewAttemptIds) {
      workflowId(id)
      if (!steps.some(step => step.attempts.some(attempt => attempt.id === id && attempt.review?.outcome === 'approved' && attempt.review.findings.length))) throw new Error('Accepted review has no retained approved report with suggestions')
    }
  }
  if (value.fix !== undefined) {
    exact(value.fix, ['stepId', 'reviewAttemptId', 'authorized'], ['attemptId', 'cycle'])
    const fix = value.fix
    if (fix.cycle !== undefined) { integer(fix.cycle, 1, 200); if (!nativeMulti(plan) || !isRecord(value.multi) || fix.cycle !== value.multi.fixCycle) throw new Error('Invalid corrective cycle') }
    workflowId(fix.stepId); workflowId(fix.reviewAttemptId)
    if (plan.codeFlow.kind !== 'multi-model' || fix.authorized !== true) throw new Error('Invalid corrective attempt authorization')
    const owner = steps.find(step => step.id === fix.stepId)
    if (!owner?.attempts.some(attempt => attempt.id === fix.reviewAttemptId && attempt.review?.outcome === 'changes_requested' && attempt.status === 'failed')) throw new Error('Correction has no retained failed review')
    if (fix.attemptId !== undefined) { workflowId(fix.attemptId); if (!owner.attempts.some(attempt => attempt.id === fix.attemptId && attempt.id !== fix.reviewAttemptId)) throw new Error('Invalid corrective attempt identity') }
  }
}
export function validateStoredWorkflow(value: unknown, taskId: string): asserts value is WorkflowSnapshot {
  exact(value, ['schemaVersion', 'taskId', 'runId', 'revision', 'sequence', 'plan', 'status', 'iterations', 'steps', 'updatedAt', 'commandIds'], ['reason', 'finalization', 'codeFlow'])
  if (value.schemaVersion !== 1 || value.taskId !== taskId) throw new Error('Invalid saved workflow')
  workflowId(value.runId); integer(value.revision, 1, Number.MAX_SAFE_INTEGER); integer(value.sequence, 0, Number.MAX_SAFE_INTEGER)
  integer(value.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  if (value.reason !== undefined) text(value.reason, 20000, true)
  validatePlan(value.plan)
  if (!['draft', 'running', 'paused', 'blocked', 'completed'].includes(String(value.status)) || !Array.isArray(value.steps) || value.steps.length !== value.plan.steps.length) throw new Error('Invalid saved workflow state')
  integer(value.iterations, 0, Number.MAX_SAFE_INTEGER)
  if (!Array.isArray(value.commandIds) || value.commandIds.length > 1000) throw new Error('Invalid workflow commands')
  value.commandIds.forEach(workflowId)
  const retired: NonNullable<CodeFlowState['retiredSteps']> = []
  if (isRecord(value.codeFlow) && value.codeFlow.retiredSteps !== undefined) {
    if (!Array.isArray(value.codeFlow.retiredSteps) || value.codeFlow.retiredSteps.length > 200) throw new Error('Invalid retired Code stages')
    for (const record of value.codeFlow.retiredSteps) {
      exact(record, ['step', 'state', 'commandId', 'reason', 'at'])
      workflowId(record.commandId); text(record.reason, 12000); integer(record.at, 0, Number.MAX_SAFE_INTEGER)
      if (!isRecord(record.step) || !Array.isArray(record.step.dependsOn) || !isRecord(record.state) || record.state.status === 'running') throw new Error('Invalid retired step ownership')
      record.step.dependsOn.forEach(workflowId)
      // Validate the full definition while its historical dependencies may now
      // themselves be retired. No old definition becomes executable again.
      validatePlan({ ...value.plan, steps: [{ ...record.step, dependsOn: [] }] })
      retired.push(record as unknown as NonNullable<CodeFlowState['retiredSteps']>[number])
    }
  }
  const allDefinitions = [...value.plan.steps, ...retired.map(item => item.step)]
  const allStates = [...value.steps, ...retired.map(item => item.state)]
  if (new Set(allDefinitions.map(item => item.id)).size !== allDefinitions.length) throw new Error('Active and retired stages share an identity')
  for (const record of retired) if (record.step.dependsOn.some(id => !allDefinitions.some(step => step.id === id))) throw new Error('Retired dependency evidence is missing')
  let attempts = 0
  let running = 0
  allStates.forEach((state, index) => {
    exact(state, ['id', 'status', 'failures', 'attempts'])
    if (state.id !== allDefinitions[index].id || !['pending', 'running', 'completed', 'blocked'].includes(String(state.status))) throw new Error('Invalid saved step state')
    integer(state.failures, 0, Number.MAX_SAFE_INTEGER)
    if (!Array.isArray(state.attempts) || state.attempts.length > 200) throw new Error('Invalid saved attempts')
    attempts += state.attempts.length
    if (state.status === 'running') running++
    for (const attempt of state.attempts) {
      exact(attempt, ['id', 'number', 'startedAt', 'stage', 'status', 'verification'], ['finishedAt', 'error', 'session', 'reviewerSession', 'review', 'reviewSources', 'helperSources', 'output', 'targetFingerprint', 'workspaceFingerprint', 'definitionFingerprint', 'preparation', 'multiStages', 'reusedVerificationFromAttemptId', 'reusedReviewFromAttemptId', 'multiCompletion', 'cleanupPending', 'architect'])
      if (!['running', 'completed', 'failed', 'interrupted'].includes(String(attempt.status)) || !['helper', 'red', 'implementation', 'verification', 'review', 'finished'].includes(String(attempt.stage)) || !Array.isArray(attempt.verification) || attempt.verification.length > 11) throw new Error('Invalid saved attempt')
      workflowId(attempt.id)
      integer(attempt.number, 1, 200); integer(attempt.startedAt, 0, Number.MAX_SAFE_INTEGER)
      if (attempt.finishedAt !== undefined) integer(attempt.finishedAt, 0, Number.MAX_SAFE_INTEGER)
      if (attempt.error !== undefined) text(attempt.error, 20000, true)
      if (attempt.output !== undefined) text(attempt.output, 60020, true)
      if (attempt.cleanupPending !== undefined) {
        if (!Array.isArray(attempt.cleanupPending) || !attempt.cleanupPending.length || attempt.cleanupPending.length > 16 || attempt.status === 'completed') throw new Error('Invalid unresolved agent cleanup')
        for (const session of attempt.cleanupPending) { exact(session, ['sessionId', 'runId', 'chatId']); Object.values(session).forEach(workflowId) }
      }
      for (const fingerprint of ['targetFingerprint', 'workspaceFingerprint', 'definitionFingerprint']) if (attempt[fingerprint] !== undefined && (typeof attempt[fingerprint] !== 'string' || !/^[a-f0-9]{64}$/.test(attempt[fingerprint] as string))) throw new Error('Invalid verification fingerprint')
      for (const field of ['session', 'reviewerSession']) if (attempt[field] !== undefined) {
        exact(attempt[field], ['sessionId', 'runId', 'chatId'])
        for (const id of Object.values(attempt[field] as Record<string, unknown>)) workflowId(id)
      }
      for (const receipt of attempt.verification) {
        exact(receipt, ['phase', 'id', 'status', 'command', 'exitCode', 'cleanupVerified', 'stdoutPath', 'stderrPath'], ['inputFingerprint', 'error', 'stdout', 'stderr'])
        workflowId(receipt.id); validateVerification(receipt.command)
        if (!['red', 'green'].includes(String(receipt.phase)) || !['passed', 'failed', 'cancelled', 'timed_out', 'output_limit', 'cleanup_failed'].includes(String(receipt.status)) || typeof receipt.cleanupVerified !== 'boolean') throw new Error('Invalid saved verification')
        if (receipt.exitCode !== null) integer(receipt.exitCode, 0, 255)
        text(receipt.stdoutPath, 4096); text(receipt.stderrPath, 4096)
        if (receipt.error !== undefined) text(receipt.error, 20000, true)
        if (receipt.stdout !== undefined) text(receipt.stdout, 20000, true)
        if (receipt.stderr !== undefined) text(receipt.stderr, 20000, true)
        if (receipt.inputFingerprint !== undefined && (typeof receipt.inputFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.inputFingerprint))) throw new Error('Invalid receipt fingerprint')
      }
      if (attempt.review !== undefined) parseWorkflowReview(JSON.stringify(attempt.review), 800)
      for (const field of ['reviewSources', 'helperSources']) if (attempt[field] !== undefined) {
        const sources = attempt[field]
        if (!Array.isArray(sources) || sources.length > (field === 'reviewSources' ? 8 : 4)) throw new Error('Invalid saved source results')
        const seen = new Set<string>()
        for (const source of sources) {
          exact(source, ['sourceId', 'presetName', 'status', 'targetFingerprint'], ['session', 'review', 'output', 'error', 'reasoningEffort', 'configuration', 'specialization'])
          if (source.specialization !== undefined) validateSpecialization(source.specialization)
          if (source.reasoningEffort !== undefined && source.reasoningEffort !== null && !isReasoningEffort(source.reasoningEffort)) throw new Error('Invalid saved source reasoning effort')
          workflowId(source.sourceId); text(source.presetName, 200); fingerprint(source.targetFingerprint)
          configuredSelection(source.presetName, source.configuration)
          if (seen.has(source.sourceId) || !['running', 'completed', 'failed', 'interrupted'].includes(String(source.status))) throw new Error('Invalid source result identity or status')
          seen.add(source.sourceId)
          if (source.session !== undefined) { exact(source.session, ['sessionId', 'runId', 'chatId']); Object.values(source.session).forEach(workflowId) }
          if (source.review !== undefined) parseWorkflowReview(JSON.stringify(source.review))
          if (source.output !== undefined) text(source.output, 20020, true)
          if (source.error !== undefined) text(source.error, 20000, true)
          if (source.status === 'completed' && (field === 'reviewSources' ? source.review === undefined : source.output === undefined)) throw new Error('Completed source has no result')
        }
      }
      if (attempt.architect !== undefined) {
        const record = attempt.architect
        exact(record, ['sourceId', 'presetName', 'status', 'targetFingerprint', 'inputFingerprint'], ['configuration', 'reasoningEffort', 'specialization', 'session', 'review', 'error'])
        validateSources([{ id: record.sourceId, presetName: record.presetName, ...(record.configuration !== undefined ? { configuration: record.configuration } : {}), ...(record.reasoningEffort !== undefined ? { reasoningEffort: record.reasoningEffort } : {}), ...(record.specialization !== undefined ? { specialization: record.specialization } : {}) }], false)
        fingerprint(record.targetFingerprint); fingerprint(record.inputFingerprint)
        if (!['running', 'completed', 'failed', 'interrupted'].includes(String(record.status))) throw new Error('Invalid architect status')
        if (record.session !== undefined) { exact(record.session, ['sessionId', 'runId', 'chatId']); Object.values(record.session).forEach(workflowId) }
        if (record.review !== undefined) parseWorkflowReview(JSON.stringify(record.review), 800)
        if (record.error !== undefined) text(record.error, 20000, true)
        if (record.status === 'completed' && record.review === undefined) throw new Error('Completed architect has no report')
      }
      if (attempt.multiStages !== undefined) {
        if (!nativeMulti(value.plan as WorkflowPlan) || !Array.isArray(attempt.multiStages) || attempt.multiStages.length > 30) throw new Error('Invalid durable Multi-model stages')
        const seen = new Set<string>()
        for (const stage of attempt.multiStages) {
          exact(stage, ['id', 'kind', 'index', 'cycle', 'status', 'targetFingerprint'], ['workspaceFingerprint', 'source', 'session', 'output', 'artifactIds', 'error', 'retries'])
          workflowId(stage.id); integer(stage.index, 1, 8); integer(stage.cycle, 0, 200); fingerprint(stage.targetFingerprint)
          if (!['exploration', 'design', 'synthesis', 'review-worker', 'review-coordinator', 'fix'].includes(String(stage.kind)) || !['running', 'completed', 'failed', 'interrupted'].includes(String(stage.status)) || seen.has(stage.id) || stage.id !== multiStageIdentity(stage.kind as Parameters<typeof multiStageIdentity>[0], stage.index, stage.cycle)) throw new Error('Invalid Multi-model stage identity or status')
          seen.add(stage.id)
          const planning = ['exploration', 'design', 'synthesis'].includes(String(stage.kind))
          if (planning ? stage.cycle !== 0 : stage.cycle < 1) throw new Error('Invalid Multi-model stage cycle')
          if (stage.workspaceFingerprint !== undefined) fingerprint(stage.workspaceFingerprint)
          if (stage.source !== undefined) validateSources([stage.source], stage.kind === 'exploration')
          if (stage.session !== undefined) { exact(stage.session, ['sessionId', 'runId', 'chatId']); Object.values(stage.session).forEach(workflowId) }
          if (stage.output !== undefined) text(stage.output, 100020, true)
          if (stage.error !== undefined) text(stage.error, 20000, true)
          if (stage.retries !== undefined) integer(stage.retries, 0, 1)
          if (stage.status === 'running' && attempt.status !== 'running') throw new Error('Running Multi-model stage has no active owner')
          if (stage.status === 'completed' && (stage.output === undefined || !stage.workspaceFingerprint)) throw new Error('Completed Multi-model stage has no durable result')
          if (stage.artifactIds !== undefined) {
            if (!Array.isArray(stage.artifactIds) || stage.artifactIds.length > 8 || new Set(stage.artifactIds).size !== stage.artifactIds.length) throw new Error('Invalid stage artifact references')
            const artifacts = isRecord(value.codeFlow) && Array.isArray(value.codeFlow.artifacts) ? value.codeFlow.artifacts : []
            const receipts = stage.artifactIds.map(id => artifacts.find(item => isRecord(item) && item.id === id && item.attemptId === attempt.id && item.stepId === state.id))
            if (receipts.some(item => !item)) throw new Error('Multi-model stage artifact belongs to another attempt')
            const required = stage.kind === 'exploration' ? `exploration_${stage.index}.md` : stage.kind === 'design' ? `plan_draft_${stage.index}.md` : stage.kind === 'review-worker' ? `review_worker_${stage.index}.json` : undefined
            if (stage.status === 'completed' && required && !receipts.some(item => isRecord(item) && item.name === required)) throw new Error('Completed Multi-model stage is missing its required artifact')
          } else if (stage.status === 'completed') throw new Error('Completed Multi-model stage must retain its artifact reference list')
        }
      }
      if (attempt.reusedVerificationFromAttemptId !== undefined) {
        workflowId(attempt.reusedVerificationFromAttemptId)
        const previous = state.attempts.find(item => isRecord(item) && item.id === attempt.reusedVerificationFromAttemptId)
        if (!nativeMulti(value.plan as WorkflowPlan) || !previous || previous.number >= attempt.number || !(previous.status === 'completed' || ['failed', 'interrupted'].includes(String(previous.status)) && previous.stage === 'review' && isRecord(previous.review)) || attempt.workspaceFingerprint !== previous.workspaceFingerprint || attempt.definitionFingerprint !== previous.definitionFingerprint || attempt.targetFingerprint !== previous.targetFingerprint || JSON.stringify(attempt.verification) !== JSON.stringify(previous.verification)) throw new Error('Review-only attempt does not match its original completed verification')
      }
      if (attempt.reusedReviewFromAttemptId !== undefined) {
        workflowId(attempt.reusedReviewFromAttemptId)
        const previous = state.attempts.find(item => isRecord(item) && item.id === attempt.reusedReviewFromAttemptId)
        if (attempt.reusedVerificationFromAttemptId !== attempt.reusedReviewFromAttemptId || !previous || !Array.isArray(previous.reviewSources) || !previous.reviewSources.length || JSON.stringify(attempt.reviewSources) !== JSON.stringify(previous.reviewSources)) throw new Error('Review reconsideration does not retain its original worker findings')
      }
      if (attempt.multiCompletion !== undefined) {
        exact(attempt.multiCompletion, ['kind', 'cycle'], ['reason', 'reviewAttemptId'])
        const completion = attempt.multiCompletion
        if (!nativeMulti(value.plan as WorkflowPlan) || !['reviewed', 'skipped', 'fix'].includes(String(completion.kind))) throw new Error('Invalid Multi-model completion policy')
        integer(completion.cycle, 1, 200)
        if (completion.reason !== undefined) text(completion.reason, 12000)
        if (completion.kind === 'reviewed') { if (!isRecord(attempt.review) || attempt.review.outcome !== 'approved') throw new Error('Reviewed completion requires independent approval') }
        else if (!attempt.verification.some(item => item.phase === 'green' && item.status === 'passed' && item.exitCode === 0 && item.cleanupVerified)) throw new Error('Unreviewed completion requires actual successful checks')
        if (completion.kind === 'fix') {
          workflowId(completion.reviewAttemptId)
          const previous = state.attempts.find(item => isRecord(item) && item.id === completion.reviewAttemptId)
          if (!previous || previous.number >= attempt.number || previous.status !== 'failed' || !isRecord(previous.review) || previous.review.outcome !== 'changes_requested') throw new Error('Corrective completion has no retained blocking review')
        } else if (completion.reviewAttemptId !== undefined) throw new Error('Only a fixer completion references its blocking review')
      }
      const definition = allDefinitions[index]
      const phase = definition.codePhase
      const isPreparation = Boolean((value.plan as WorkflowPlan).codeFlow && phase && phase !== 'implementation')
      if (attempt.preparation !== undefined) {
        exact(attempt.preparation, ['summary', 'artifactIds']); text(attempt.preparation.summary, 12000)
        if (!isPreparation || !Array.isArray(attempt.preparation.artifactIds) || attempt.preparation.artifactIds.length > 8 || new Set(attempt.preparation.artifactIds).size !== attempt.preparation.artifactIds.length) throw new Error('Invalid preparation proof')
        const artifacts = isRecord(value.codeFlow) && Array.isArray(value.codeFlow.artifacts) ? value.codeFlow.artifacts : []
        const receipts = attempt.preparation.artifactIds.map(id => artifacts.find(item => isRecord(item) && item.id === id && item.stepId === state.id && item.attemptId === attempt.id))
        if (receipts.some(item => !item)) throw new Error('Preparation proof has missing or unrelated artifacts')
        for (const name of preparationRequiredArtifacts(phase!, (value.plan as WorkflowPlan).codeFlow!.kind)) if (!receipts.some(item => isRecord(item) && item.name === name)) throw new Error('Preparation proof is missing its required document')
        if (attempt.verification.length || attempt.review !== undefined || attempt.reviewSources !== undefined || attempt.architect !== undefined) throw new Error('Preparation proof cannot substitute for implementation verification or review')
      }
      if (attempt.status === 'completed' && !isPreparation && nativeMulti(value.plan as WorkflowPlan)) {
        if (attempt.multiCompletion === undefined) throw new Error('Completed native Multi-model attempt lacks its durable review policy')
        for (const command of definition.verification) if (!attempt.verification.some(receipt => receipt.phase === 'green' && receipt.status === 'passed' && receipt.cleanupVerified && receipt.exitCode === 0 && receipt.inputFingerprint === attempt.targetFingerprint && JSON.stringify(receipt.command) === JSON.stringify(command))) throw new Error('Multi-model completion lacks one of its accepted executable checks')
      }
      if (attempt.status === 'completed' && (attempt.stage !== 'finished' || !attempt.targetFingerprint || !attempt.finishedAt || (isPreparation ? !attempt.preparation || !attempt.workspaceFingerprint || !attempt.definitionFingerprint : !attempt.verification.some(item => item.phase === 'green' && item.status === 'passed' && item.exitCode === 0 && item.cleanupVerified) && (!isRecord(attempt.review) || attempt.review.outcome !== 'approved')))) throw new Error('Completed attempt has no verified result')
      if (attempt.status === 'completed' && !isPreparation && (value.plan as WorkflowPlan).review && (!isRecord(attempt.multiCompletion) || attempt.multiCompletion.kind === 'reviewed')) {
        const plan = value.plan as WorkflowPlan
        if (!isRecord(attempt.review) || attempt.review.outcome !== 'approved') throw new Error('Completed attempt lacks required review')
        for (const reviewer of plan.reviewTeam?.reviewers ?? plan.reviewers ?? []) {
          const source = (attempt.reviewSources as Array<Record<string, unknown>> | undefined)?.find(item => item.sourceId === reviewer.id)
          if (!source || source.presetName !== reviewer.presetName || source.reasoningEffort !== reviewer.reasoningEffort || JSON.stringify(source.configuration) !== JSON.stringify(reviewer.configuration) || JSON.stringify(source.specialization) !== JSON.stringify(reviewer.specialization) || source.status !== 'completed' || source.targetFingerprint !== attempt.targetFingerprint || !isRecord(source.review) || source.review.outcome !== 'approved') throw new Error('Completed attempt lacks a required review source')
        }
        if (plan.reviewTeam) {
          const architect = attempt.architect, selected = plan.reviewTeam.architect
          if (!isRecord(architect) || architect.status !== 'completed' || architect.sourceId !== selected.id || architect.presetName !== selected.presetName || JSON.stringify(architect.configuration) !== JSON.stringify(selected.configuration) || architect.reasoningEffort !== selected.reasoningEffort || JSON.stringify(architect.specialization) !== JSON.stringify(selected.specialization) || architect.targetFingerprint !== attempt.targetFingerprint || !isRecord(architect.review) || architect.review.outcome !== 'approved' || JSON.stringify(attempt.review) !== JSON.stringify(architect.review)) throw new Error('Completed review team lacks its matching blind architect result')
        }
      }
    }
    if (state.failures !== state.attempts.filter(item => item.status === 'failed').length) throw new Error('Invalid saved failure count')
    if (state.status === 'completed' && state.attempts.at(-1)?.status !== 'completed') throw new Error('Completed step has no completed attempt')
    if (state.status === 'running' && state.attempts.at(-1)?.status !== 'running') throw new Error('Running step has no running attempt')
    if (state.status !== 'running' && state.attempts.some(item => item.status === 'running')) throw new Error('Unexpected running attempt')
  })
  if ((value.plan as WorkflowPlan).codeFlow) validateCodeState(value.codeFlow, value.plan as WorkflowPlan, taskId, allStates as WorkflowSnapshot['steps'], value.status)
  else if (value.codeFlow !== undefined) throw new Error('Unexpected saved Code flow state')
  if (attempts > value.iterations || attempts > 200 || running > 1 || value.status !== 'running' && running > 0) throw new Error('Inconsistent workflow lifecycle')
  if (value.status === 'completed' && (!value.steps.length || value.steps.some(item => item.status !== 'completed'))) throw new Error('Workflow completion is inconsistent with its steps')
  if (value.status === 'draft' && (value.iterations !== 0 || value.steps.some(item => item.status !== 'pending'))) throw new Error('Invalid draft workflow')
  if (value.finalization !== undefined) {
    exact(value.finalization, ['id', 'status', 'inputFingerprint'], ['receipt', 'error'])
    workflowId(value.finalization.id); fingerprint(value.finalization.inputFingerprint)
    if (!['pending', 'running', 'blocked', 'completed'].includes(String(value.finalization.status)) || value.steps.some(item => (item as {status: string}).status !== 'completed')) throw new Error('Git finalization requires verified completed steps')
    if (value.finalization.error !== undefined) text(value.finalization.error, 20000, true)
    if (value.finalization.receipt !== undefined) validateWorkflowGitReceipt(value.finalization.receipt, taskId)
    if (value.finalization.status === 'completed' && (!isRecord(value.finalization.receipt) || value.finalization.receipt.status !== 'completed')) throw new Error('Finalization completion requires a durable receipt')
  }
  const git = (value.plan as WorkflowPlan).git
  const hasCodeChanges = !(value.plan as WorkflowPlan).codeFlow || (value.plan as WorkflowPlan).steps.some(step => step.codePhase === 'implementation')
  if (value.status === 'completed' && hasCodeChanges && git && [git.commit, git.merge, git.push].includes('after-plan') && (!isRecord(value.finalization) || value.finalization.status !== 'completed')) throw new Error('Workflow completion requires Git finalization')
}
