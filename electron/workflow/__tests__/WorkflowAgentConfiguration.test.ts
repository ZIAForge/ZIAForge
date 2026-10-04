import { describe, expect, it } from 'vitest'
import type { WorkflowCustomAgentConfiguration, WorkflowPlan } from '../../../shared/workflow'
import type { Preset } from '../../../shared/legacy-ipc'
import type { TrustedAgentSessionConfig } from '../../runtime/SessionManager'
import { resolveChatSelection } from '../../runtime/ProviderLaunch'
import { applyWorkflowRolePolicy, resolveWorkflowSelection } from '../WorkflowAgentConfiguration'
import { validatePlan, validateWorkflowConfiguration } from '../WorkflowValidation'

const taskSelection = () => ({ presetName: 'Task preset', provider: 'codex' as const, model: 'task-model', reasoningEffort: 'high', permissions: 'Workspace write' })
const custom: WorkflowCustomAgentConfiguration = { provider: 'codex', model: 'custom-model', reasoningEffort: 'high', permissions: 'Workspace write' }
const basePlan: WorkflowPlan = { title: 'One task', coderPreset: '@custom', coderConfiguration: custom, reviewerPreset: '@custom', reviewerConfiguration: custom, review: true, advance: 'manual', maxFailures: 1, maxIterations: 3, steps: [] }

describe('workflow agent selection boundary', () => {
  it('resolves Custom independently of saved presets and preserves inherited effort versus explicit default', () => {
    const inherited = resolveWorkflowSelection('@custom', custom, taskSelection, { reasoningEffort: undefined, permissions: undefined })
    expect(inherited).toEqual({ presetName: '', ...custom })
    expect(resolveChatSelection(inherited.presetName, [], undefined, inherited)).toMatchObject({ provider: 'codex', model: 'custom-model', reasoningEffort: 'high', sandbox: 'workspace-write' })
    const reset = resolveWorkflowSelection('@custom', custom, taskSelection, { reasoningEffort: null })
    expect(resolveChatSelection(reset.presetName, [], undefined, reset).reasoningEffort).toBeNull()
    expect(resolveWorkflowSelection('@task', undefined, taskSelection, { reasoningEffort: undefined })).toEqual(taskSelection())
    expect(custom.reasoningEffort).toBe('high')
  })

  it('accepts repeated presets with independent source identities and refuses duplicate identities', () => {
    const plan = { ...basePlan, reviewers: [{ id: 'one', presetName: 'Same preset' }, { id: 'two', presetName: 'Same preset' }], helpers: [{ id: 'one', presetName: 'Same preset', instructions: 'Research' }, { id: 'two', presetName: 'Same preset', instructions: 'Check evidence' }] }
    expect(() => validatePlan(plan)).not.toThrow()
    expect(() => validatePlan({ ...plan, reviewers: [plan.reviewers[0], plan.reviewers[0]] })).toThrow(/distinct identities/)
    expect(() => validatePlan({ ...plan, helpers: [plan.helpers[0], plan.helpers[0]] })).toThrow(/distinct identities/)
  })

  it.each([
    { ...custom, cwd: '/renderer/chosen/path' }, { ...custom, executable: '/bin/anything' },
    { ...custom, apiKey: 'not-a-real-key' }, { ...custom, provider: ['codex'] },
    { provider: 'api', model: 'api-model' }, { ...custom, apiConnectionId: 'connection' },
    { provider: 'antigravity', model: 'agy-model', reasoningEffort: 'xhigh' },
    { provider: 'claude', model: 'claude-model', reasoningEffort: 'ultra' },
  ])('rejects unsupported Custom transport or policy fields: %j', configuration => {
    expect(() => validateWorkflowConfiguration(configuration)).toThrow()
  })

  it('requires Custom settings for the selector at every role and refuses settings hidden behind a saved preset', () => {
    expect(() => validatePlan({ ...basePlan, coderConfiguration: undefined })).toThrow()
    expect(() => validatePlan({ ...basePlan, reviewerConfiguration: undefined })).toThrow()
    expect(() => validatePlan({ ...basePlan, coderPreset: 'Saved preset' })).toThrow(/Custom selector/)
    expect(() => validatePlan({ ...basePlan, reviewers: [{ id: 'one', presetName: '@custom' }] })).toThrow()
    expect(() => validatePlan({ ...basePlan, helpers: [{ id: 'one', presetName: '@custom', instructions: 'Research' }] })).toThrow()
    expect(() => resolveWorkflowSelection('@task', custom, taskSelection)).toThrow(/Custom selector/)
    expect(() => validateWorkflowConfiguration({ provider: 'api', model: 'api-model', apiConnectionId: 'saved-connection', permissions: 'Read only', reasoningEffort: null })).not.toThrow()
  })
})

describe('workflow review and helper permission policy', () => {
  it.each(['reviewer', 'helper'] as const)('attenuates all providers for %s without changing the saved selection', role => {
    const presets: Preset[] = [
      { name: 'Codex full', agent: 'Codex', model: 'auto', permissions: 'Danger full access' },
      { name: 'Claude full', agent: 'Claude Code', model: 'auto', permissions: 'Dangerously skip permissions' },
      { name: 'AGY full', agent: 'Google Antigravity', model: 'auto', permissions: 'Dangerously skip permissions' },
      { name: 'API write', agent: 'OpenAI-compatible API', model: 'api-model', permissions: 'Workspace write', apiConnectionId: 'connection' },
    ]
    for (const preset of presets) {
      const selected = resolveChatSelection(preset.name, presets)
      const config: TrustedAgentSessionConfig = { taskId: 'task', chatId: 'review-chat', presetName: preset.name, cwd: '/trusted/workspace', ...selected }
      const before = structuredClone(config)
      const effective = applyWorkflowRolePolicy(config, role)
      if (config.provider === 'antigravity') {
        expect(effective).toMatchObject({ permissions: 'CLI settings', agyPermissionMode: 'cli-settings' })
        expect(effective.launchNotice).toContain('does not enforce filesystem read-only')
      } else {
        expect(effective.permissions).toBe('Read only')
        if (config.provider === 'codex') expect(effective).toMatchObject({ sandbox: 'read-only', approvalPolicy: 'never' })
        if (config.provider === 'claude') expect(effective.claudePermissionMode).toBe('plan')
        if (config.provider === 'api') expect(effective.apiReadOnly).toBe(true)
      }
      expect(config).toEqual(before)
      expect(applyWorkflowRolePolicy(config, 'coder')).toEqual(before)
    }
  })
})
