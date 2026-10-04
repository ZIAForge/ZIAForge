import { validateSpecialization } from '../../shared/specializations'
import path from 'node:path'
import { isReasoningEffort } from '../../shared/agent-models'
import { isPermissionLabel } from '../runtime/AgentExecutionPolicy'
import type { WorkFlowDefinition, WorkFlowSnapshot, WorkPhaseResult } from '../../shared/work-flow'
import { validateReviewTeam, validateVerification, validateWorkflowConfiguration, workflowId } from './WorkflowValidation'
import { validateWorkPromptProfile } from './WorkPromptProfile'

export const workKinds = ['auto', 'brainstorm', 'deep-brainstorm', 'research', 'write'] as const
export const workPhases = ['intake', 'requirements', 'planning', 'execution', 'divergence', 'convergence', 'research', 'outline', 'draft', 'worker', 'helper', 'synthesis', 'revision', 'review', 'review-architect', 'delivery', 'follow-up'] as const
export const workActions = ['answer', 'more', 'evaluate', 'approve', 'approve-with-comments', 'changes', 'cancel', 'finish', 'continue'] as const
export function workObject(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) throw new Error('Invalid Work fields')
}
export function workText(value: unknown, max = 20000, empty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || value.includes('\0') || !empty && !value.trim()) throw new Error('Invalid Work text')
}
const number = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => { if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new Error('Invalid Work number') }
const hash = (value: unknown) => { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid Work hash') }
const list = (value: unknown, max: number): unknown[] => { if (!Array.isArray(value) || value.length > max) throw new Error('Invalid Work list'); return value }
function uniqueIds(values: unknown[], name: string) { if (new Set(values).size !== values.length) throw new Error(`Duplicate Work ${name}`) }
function citation(source: unknown) {
  workObject(source, ['id', 'url', 'title', 'accessedAt', 'kind', 'provenance']); workflowId(source.id)
  workText(source.title, 1000); workText(source.url, 4000); const url = new URL(source.url); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid Work citation URL')
  workText(source.accessedAt, 40); if (!Number.isFinite(Date.parse(source.accessedAt)) || !['primary', 'secondary'].includes(String(source.kind)) || !['provided', 'model-reported'].includes(String(source.provenance))) throw new Error('Invalid Work citation metadata')
}
function savedStep(step: unknown) {
  workObject(step, ['id', 'title', 'instructions', 'acceptance', 'verification', 'status']); workflowId(step.id); workText(step.title, 300); workText(step.instructions)
  if (!['pending', 'completed'].includes(String(step.status))) throw new Error('Invalid Work step')
  list(step.acceptance, 30).forEach(item => workText(item, 3000)); list(step.verification, 10).forEach(validateVerification)
}
function savedQuestions(value: unknown, stageIds: Set<unknown>) {
  const ids: unknown[] = []
  for (const question of list(value, 40)) {
    workObject(question, ['id', 'question', 'stageIds'], ['options']); workflowId(question.id); ids.push(question.id); workText(question.question, 4000)
    const owners = list(question.stageIds, 8); if (!owners.length) throw new Error('Missing Work question owner'); uniqueIds(owners, 'question owner')
    owners.forEach(id => { if (!stageIds.has(id)) throw new Error('Invalid question owner') })
    if (question.options !== undefined) list(question.options, 10).forEach(item => workText(item, 1000))
  }
  uniqueIds(ids, 'question')
}
export function workOutputPath(value: unknown): asserts value is string {
  workText(value, 500)
  if (path.isAbsolute(value) || value.includes('\\') || value.split('/').some(segment => !segment || segment === '.' || segment === '..') || value.startsWith('.ziaf-inputs/')) throw new Error('Work output must be a relative task file')
}
export function validateWorkSource(value: unknown): void {
  workObject(value, ['id', 'presetName'], ['configuration', 'reasoningEffort', 'permissions', 'instructions', 'specialization'])
  workflowId(value.id); workText(value.presetName, 200)
  if (value.specialization !== undefined) validateSpecialization(value.specialization)
  if (value.presetName === '@custom') validateWorkflowConfiguration(value.configuration)
  else if (value.configuration !== undefined) throw new Error('Work Custom configuration needs @custom')
  if (value.reasoningEffort !== undefined && value.reasoningEffort !== null && !isReasoningEffort(value.reasoningEffort)) throw new Error('Invalid Work reasoning effort')
  if (value.permissions !== undefined && !isPermissionLabel(value.permissions)) throw new Error('Invalid Work access policy')
  if (value.instructions !== undefined) workText(value.instructions, 10000)
}
export function validateWorkDefinition(value: unknown): asserts value is WorkFlowDefinition {
  workObject(value, ['kind', 'request', 'advance', 'executor', 'reviewers', 'review', 'inputs', 'limits'], ['version', 'helpers', 'deep', 'promptProfile', 'roleLabels', 'reviewTeam'])
  if (value.version !== undefined && value.version !== 1 || !workKinds.includes(value.kind as typeof workKinds[number]) || !['auto', 'manual'].includes(String(value.advance)) || typeof value.review !== 'boolean') throw new Error('Invalid Work definition')
  workText(value.request); validateWorkSource(value.executor)
  const sources = (values: unknown, max: number) => { const ids = new Set<unknown>(); for (const item of list(values, max)) { validateWorkSource(item); const id = (item as { id: string }).id; if (ids.has(id)) throw new Error('Duplicate Work role identity'); ids.add(id) } }
  sources(value.reviewers, 8)
  if (value.reviewTeam !== undefined) validateReviewTeam(value.reviewTeam)
  if (value.review && value.reviewTeam === undefined && !(value.reviewers as unknown[]).length) throw new Error('Independent Work review requires a selected reviewer')
  if (value.helpers !== undefined) sources(value.helpers, 4)
  if (value.deep !== undefined) { workObject(value.deep, ['workers']); sources(value.deep.workers, 8); if (!(value.deep.workers as unknown[]).length || value.kind !== 'deep-brainstorm') throw new Error('Deep Work requires selected workers') }
  if (value.kind === 'deep-brainstorm' && value.deep === undefined) throw new Error('Select Deep Work worker models before starting')
  const ids = new Set<unknown>()
  for (const input of list(value.inputs, 32)) {
    workObject(input, ['id', 'name', 'sha256', 'sizeBytes'], ['relativePath']); workflowId(input.id); workText(input.name, 300); hash(input.sha256); number(input.sizeBytes, 0, 32 * 1024 * 1024)
    if (input.relativePath !== undefined) { workText(input.relativePath, 500); if (path.isAbsolute(input.relativePath) || input.relativePath.includes('\\') || input.relativePath.split('/').includes('..')) throw new Error('Invalid Work input path') }
    if (ids.has(input.id)) throw new Error('Duplicate Work input'); ids.add(input.id)
  }
  workObject(value.limits, ['maxTurns', 'maxFailures', 'maxFollowUps']); number(value.limits.maxTurns, 1, 200); number(value.limits.maxFailures, 1, 10); number(value.limits.maxFollowUps, 1, 30)
  if (value.promptProfile !== undefined) validateWorkPromptProfile(value.promptProfile)
  if (value.roleLabels !== undefined) { if (!value.roleLabels || typeof value.roleLabels !== 'object' || Array.isArray(value.roleLabels) || Object.keys(value.roleLabels).length > 40) throw new Error('Invalid Work role labels'); for (const [key, label] of Object.entries(value.roleLabels)) { if (!/^(executor|reviewer|worker|helper|architect):[A-Za-z0-9_-]{1,160}$/.test(key)) throw new Error('Invalid Work role label identity'); workText(label, 200) } }
}
export function validateWorkResult(value: unknown): asserts value is WorkPhaseResult {
  workObject(value, ['status', 'summary', 'questions', 'artifacts', 'sources', 'steps'], ['complexity', 'nextPhase', 'followUpSize', 'review', 'outputs'])
  if (!['complete', 'needs_input', 'plan', 'continue'].includes(String(value.status))) throw new Error('Invalid Work result status')
  workText(value.summary, 20000)
  if (value.complexity !== undefined && !['trivial', 'small', 'medium', 'large'].includes(String(value.complexity))) throw new Error('Invalid Work complexity')
  if (value.nextPhase !== undefined && !workPhases.includes(value.nextPhase as typeof workPhases[number])) throw new Error('Invalid Work next phase')
  if (value.followUpSize !== undefined && !['small', 'large'].includes(String(value.followUpSize))) throw new Error('Invalid follow-up size')
  const ids = new Set<unknown>()
  for (const question of list(value.questions, 20)) { workObject(question, ['id', 'question'], ['options']); workflowId(question.id); workText(question.question, 4000); if (ids.has(question.id)) throw new Error('Duplicate Work question'); ids.add(question.id); if (question.options !== undefined) list(question.options, 10).forEach(item => workText(item, 1000)) }
  if (value.status === 'needs_input' !== Boolean((value.questions as unknown[]).length)) throw new Error('Work questions need a needs_input result')
  const names = new Set<unknown>(); let bytes = 0
  for (const artifact of list(value.artifacts, 16)) { workObject(artifact, ['name', 'content']); workText(artifact.name, 120); if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(md|txt|csv|json|html|svg)$/.test(artifact.name) || names.has(artifact.name)) throw new Error('Invalid Work artifact basename'); names.add(artifact.name); workText(artifact.content, 240000); bytes += Buffer.byteLength(artifact.content) }
  if (bytes > 800000) throw new Error('Work artifacts exceed one result limit')
  if (value.outputs !== undefined) for (const output of list(value.outputs, 16)) { workObject(output, ['path']); workOutputPath(output.path) }
  ids.clear()
  for (const source of list(value.sources, 100)) {
    citation(source); const id = (source as { id: string }).id; if (ids.has(id)) throw new Error('Duplicate Work source'); ids.add(id)
  }
  for (const step of list(value.steps, 30)) { workObject(step, ['title', 'instructions', 'acceptance', 'verification']); workText(step.title, 300); workText(step.instructions); list(step.acceptance, 30).forEach(item => workText(item, 3000)); list(step.verification, 10).forEach(validateVerification) }
  if (value.status === 'plan' !== Boolean((value.steps as unknown[]).length)) throw new Error('Only a plan result may propose Work steps')
  if (value.status === 'continue' && !value.nextPhase) throw new Error('A continuing Work result needs its next phase')
  if (value.status === 'continue' && value.nextPhase === 'execution') throw new Error('Work execution requires a proposed plan and explicit user approval')
  if (value.review !== undefined) { workObject(value.review, ['outcome', 'findings']); if (!['approved', 'changes_requested'].includes(String(value.review.outcome))) throw new Error('Invalid Work review'); list(value.review.findings, 50).forEach(item => workText(item, 4000)) }
}
export function validateWorkCommand(kind: string, value: unknown): void {
  const fields: Record<string, [string[], string[]]> = {
    get: [['taskId'], []], pause: [['taskId'], []], readArtifact: [['taskId', 'artifactId'], []],
    save: [['taskId', 'expectedRevision', 'definition'], []], start: [['taskId', 'revision', 'commandId'], []],
    respond: [['taskId', 'runId', 'revision', 'gateId', 'commandId', 'action'], ['text', 'answers']],
    followUp: [['taskId', 'runId', 'revision', 'commandId', 'text'], ['artifactId']],
  }
  if (!fields[kind]) throw new Error('Unknown Work command')
  workObject(value, ...fields[kind]); workflowId(value.taskId)
  for (const field of ['runId', 'gateId', 'commandId', 'artifactId']) if (value[field] !== undefined) workflowId(value[field])
  for (const field of ['revision', 'expectedRevision']) if (value[field] !== undefined) number(value[field])
  if (value.text !== undefined) workText(value.text, 20000, kind === 'respond')
  if (kind === 'save') validateWorkDefinition(value.definition)
  if (kind === 'respond') { if (!workActions.includes(value.action as typeof workActions[number])) throw new Error('Invalid Work action'); if (value.answers !== undefined) for (const answer of list(value.answers, 40)) { workObject(answer, ['questionId', 'text']); workflowId(answer.questionId); workText(answer.text, 10000) } }
}
export function validateWorkSnapshot(value: unknown, taskId: string): asserts value is WorkFlowSnapshot {
  workObject(value, ['schemaVersion', 'taskId', 'runId', 'revision', 'sequence', 'definition', 'status', 'stages', 'artifacts', 'sources', 'decisions', 'commandReceipts', 'round', 'turns', 'failures', 'updatedAt'], ['plan', 'pending', 'reason', 'recoveryGeneration'])
  if (value.schemaVersion !== 1 || value.taskId !== taskId || !['draft', 'running', 'waiting', 'paused', 'completed', 'cancelled', 'blocked'].includes(String(value.status))) throw new Error('Invalid saved Work identity/status')
  workflowId(value.runId); validateWorkDefinition(value.definition)
  for (const field of ['revision', 'sequence', 'round', 'turns', 'failures', 'updatedAt']) number(value[field])
  if (value.recoveryGeneration !== undefined) number(value.recoveryGeneration, 1)
  if (value.reason !== undefined) workText(value.reason, 20000)
  const stageIds = new Set<unknown>(); const invocationIds = new Set<unknown>()
  for (const stage of list(value.stages, 600)) {
    workObject(stage, ['id', 'phase', 'round', 'source', 'status', 'configurationHash', 'inputFingerprint', 'invocations', 'artifactIds', 'reportRepairCount', 'verification'], ['sourceId', 'stepId', 'reportName', 'error', 'transitioned', 'reviewOf', 'reportFingerprint', 'outputFingerprint', 'contextVersion', 'forceContinuation']); workflowId(stage.id); if (stageIds.has(stage.id)) throw new Error('Duplicate Work stage'); stageIds.add(stage.id)
    if (!workPhases.includes(stage.phase as typeof workPhases[number]) || !['pending', 'running', 'waiting_input', 'completed', 'failed', 'interrupted', 'uncertain'].includes(String(stage.status))) throw new Error('Invalid saved Work stage')
    validateWorkSource(stage.source); hash(stage.configurationHash); hash(stage.inputFingerprint); number(stage.round); number(stage.reportRepairCount, 0, 1)
    for (const field of ['sourceId', 'stepId']) if (stage[field] !== undefined) workflowId(stage[field])
    if (stage.reviewOf !== undefined) workflowId(stage.reviewOf)
    if (stage.reportFingerprint !== undefined) hash(stage.reportFingerprint)
    if (stage.phase === 'review-architect' && (!stage.reviewOf || !stage.reportFingerprint || !(value.definition as WorkFlowDefinition).reviewTeam)) throw new Error('Blind Work architect needs its team, reviewed owner and anonymous report fingerprint')
    if (stage.phase !== 'review-architect' && stage.reportFingerprint !== undefined) throw new Error('Anonymous report binding belongs only to the Work architect')
    if (stage.outputFingerprint !== undefined) hash(stage.outputFingerprint)
    if (stage.transitioned !== undefined && typeof stage.transitioned !== 'boolean') throw new Error('Invalid Work transition marker')
    if (stage.contextVersion !== undefined) number(stage.contextVersion, 0, 200)
    if (stage.forceContinuation !== undefined && typeof stage.forceContinuation !== 'boolean') throw new Error('Invalid Work continuation')
    for (const field of ['reportName', 'error']) if (stage[field] !== undefined) workText(stage[field], 20000)
    list(stage.artifactIds, 100).forEach(workflowId)
    for (const invocation of list(stage.invocations, 50)) {
      workObject(invocation, ['id', 'clientMessageId', 'status', 'purpose', 'inputFingerprint', 'prompt'], ['session', 'output', 'result', 'error']); workflowId(invocation.id); workflowId(invocation.clientMessageId); if (invocationIds.has(invocation.id)) throw new Error('Duplicate Work invocation'); invocationIds.add(invocation.id); hash(invocation.inputFingerprint); workText(invocation.prompt, 1000000)
      if (!['pending', 'running', 'completed', 'failed', 'interrupted', 'uncertain'].includes(String(invocation.status)) || !['initial', 'answer', 'repair', 'continuation'].includes(String(invocation.purpose))) throw new Error('Invalid Work invocation')
      if (invocation.session !== undefined) { workObject(invocation.session, ['sessionId', 'runId', 'chatId']); Object.values(invocation.session).forEach(workflowId) }
      if (invocation.output !== undefined) workText(invocation.output, 1000000, true)
      if (invocation.error !== undefined) workText(invocation.error, 20000)
      if (invocation.result !== undefined) validateWorkResult(invocation.result)
      if (stage.phase === 'review-architect' && invocation.result !== undefined) { const result = invocation.result as WorkPhaseResult; if (result.status !== 'complete' || !result.review || result.artifacts.length || result.sources.length || result.steps.length || result.questions.length || result.outputs?.length) throw new Error('Blind Work architect may return only a completed report aggregation') }
      if (invocation.status === 'completed' && invocation.result === undefined) throw new Error('Completed Work invocation needs a validated result')
    }
    for (const check of list(stage.verification, 10)) {
      workObject(check, ['id', 'phase', 'status', 'command', 'exitCode', 'cleanupVerified', 'stdoutPath', 'stderrPath'], ['inputFingerprint', 'stdout', 'stderr', 'error'])
      validateVerification(check.command); workflowId(check.id)
      if (check.phase !== 'green' || !['passed', 'failed', 'cancelled', 'timed_out', 'output_limit', 'cleanup_failed'].includes(String(check.status)) || typeof check.cleanupVerified !== 'boolean' || check.exitCode !== null && !Number.isInteger(check.exitCode)) throw new Error('Invalid Work verification result')
      for (const field of ['stdoutPath', 'stderrPath']) workText(check[field], 4096)
      for (const field of ['stdout', 'stderr', 'error']) if (check[field] !== undefined) workText(check[field], 1000000, true)
      if (check.inputFingerprint !== undefined) hash(check.inputFingerprint)
      if (check.status === 'passed' && (check.exitCode !== 0 || check.cleanupVerified !== true)) throw new Error('Passed Work verification needs successful owned cleanup')
    }
    if (['completed', 'waiting_input'].includes(String(stage.status))) {
      const invocation = (stage.invocations as Array<{ status: string; result?: WorkPhaseResult }>).at(-1)
      if (invocation?.status !== 'completed' || stage.outputFingerprint === undefined || stage.status === 'waiting_input' && invocation.result?.status !== 'needs_input') throw new Error('Completed Work stage needs its invocation proof')
    }
  }
  const artifactIds = new Set<unknown>()
  for (const artifact of list(value.artifacts, 1000)) { workObject(artifact, ['id', 'name', 'path', 'sha256', 'bytes', 'version', 'stageId', 'invocationId', 'createdAt'], ['binary', 'sourcePath']); workflowId(artifact.id); workflowId(artifact.stageId); workflowId(artifact.invocationId); if (artifactIds.has(artifact.id) || !stageIds.has(artifact.stageId) || !invocationIds.has(artifact.invocationId)) throw new Error('Invalid Work artifact ownership'); artifactIds.add(artifact.id); workText(artifact.name, 300); workText(artifact.path, 4096); hash(artifact.sha256); number(artifact.bytes, 1, 32 * 1024 * 1024); number(artifact.version, 1); number(artifact.createdAt); if (artifact.binary !== undefined && typeof artifact.binary !== 'boolean') throw new Error('Invalid Work artifact format'); if (artifact.sourcePath !== undefined) workOutputPath(artifact.sourcePath) }
  if (value.plan !== undefined) { list(value.plan, 30).forEach(savedStep); uniqueIds((value.plan as Array<{ id: string }>).map(item => item.id), 'plan step') }
  for (const stage of value.stages as WorkFlowSnapshot['stages']) {
    if (stage.reviewOf && !stageIds.has(stage.reviewOf) || stage.stepId && !stage.transitioned && !(value.plan as WorkFlowSnapshot['plan'])?.some(step => step.id === stage.stepId)) throw new Error('Work stage references an unknown owner')
    uniqueIds(stage.artifactIds, 'stage artifact'); stage.artifactIds.forEach(id => { const receipt = (value.artifacts as WorkFlowSnapshot['artifacts']).find(item => item.id === id); if (!receipt || receipt.stageId !== stage.id || !stage.invocations.some(item => item.id === receipt.invocationId)) throw new Error('Work stage artifact belongs to another invocation') })
  }
  for (const receipt of list(value.commandReceipts, 2000)) { workObject(receipt, ['commandId', 'payloadHash']); workflowId(receipt.commandId); hash(receipt.payloadHash) }
  uniqueIds((value.commandReceipts as Array<{ commandId: string }>).map(item => item.commandId), 'command receipt')
  for (const decision of list(value.decisions, 1000)) { workObject(decision, ['commandId', 'action', 'at'], ['gateId', 'text', 'answers', 'questions']); workflowId(decision.commandId); if (![...workActions, 'follow-up'].includes(String(decision.action))) throw new Error('Invalid saved Work decision'); number(decision.at); if (decision.gateId !== undefined) workflowId(decision.gateId); if (decision.text !== undefined) workText(decision.text, 20000, true); if (decision.answers !== undefined) for (const answer of list(decision.answers, 40)) { workObject(answer, ['questionId', 'text']); workflowId(answer.questionId); workText(answer.text, 10000) } if (decision.questions !== undefined) savedQuestions(decision.questions, stageIds) }
  list(value.sources, 1000).forEach(citation)
  if (value.pending !== undefined) {
    const gate = value.pending; workObject(gate, ['id', 'kind', 'stageId', 'summary', 'artifactIds', 'actions'], ['questions', 'proposedSteps']); workflowId(gate.id); if (!stageIds.has(gate.stageId) || !['questions', 'brainstorm-direction', 'plan', 'outline', 'artifact-review', 'continue', 'recovery'].includes(String(gate.kind))) throw new Error('Invalid saved Work gate'); workText(gate.summary); list(gate.artifactIds, 100).forEach(id => { if (!artifactIds.has(id)) throw new Error('Work gate artifact missing') }); list(gate.actions, 10).forEach(action => { if (!workActions.includes(action as typeof workActions[number])) throw new Error('Invalid saved Work gate action') })
    if (gate.kind === 'questions' && !list(gate.questions, 40).length) throw new Error('Missing Work questions')
    if (gate.questions !== undefined) { if (gate.kind !== 'questions') throw new Error('Only a question checkpoint may contain questions'); savedQuestions(gate.questions, stageIds) }
    if (gate.proposedSteps !== undefined) { if (gate.kind !== 'plan' || !list(gate.proposedSteps, 30).length) throw new Error('Only a plan checkpoint may propose steps'); (gate.proposedSteps as unknown[]).forEach(savedStep); if ((gate.proposedSteps as Array<{ status: string }>).some(step => step.status !== 'pending')) throw new Error('Proposed Work steps cannot already be completed') }
    if (gate.kind === 'plan' && gate.proposedSteps === undefined) throw new Error('Missing proposed Work plan')
    const allowed: Record<string, readonly string[]> = { questions: ['answer', 'cancel'], 'brainstorm-direction': ['more', 'evaluate', 'finish', 'cancel'], plan: ['approve', 'changes', 'cancel'], outline: ['approve', 'changes', 'cancel'], 'artifact-review': ['approve', 'approve-with-comments', 'changes', 'cancel'], continue: ['continue', 'cancel'], recovery: ['continue', 'cancel'] }
    if (!(gate.actions as unknown[]).length || (gate.actions as string[]).some(action => !allowed[String(gate.kind)].includes(action))) throw new Error('Work checkpoint action does not belong to this gate')
    uniqueIds(gate.actions as unknown[], 'gate action')
  }
  if (value.status === 'waiting' && !value.pending || value.pending && !['waiting', 'paused', 'cancelled'].includes(String(value.status))) throw new Error('Work gate/status mismatch')
}
