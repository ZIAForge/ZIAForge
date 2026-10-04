import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { effectivePermissionLabel, validateReasoningEffort } from '../AgentExecutionPolicy'
import { validateSessionCommand } from '../AgentSessionValidation'
import { queueContext } from '../QueueStore'
import { parseStructuredModels } from '../../agentModels'

describe('provider reasoning and frozen access contracts', () => {
  it('preserves model-advertised future tokens without inventing a universal effort enum', () => {
    const models = parseStructuredModels([{ model: 'future', displayName: 'Future', supportedReasoningEfforts: [{ reasoningEffort: 'none' }, { reasoningEffort: 'ultra' }], defaultReasoningEffort: 'ultra' }], 'codex')
    expect(models[0]).toEqual({ id: 'future', label: 'Future', supportedReasoningEfforts: ['none', 'ultra'], defaultReasoningEffort: 'ultra' })
    expect(() => parseStructuredModels([{ model: 'future', supportedReasoningEfforts: [{ reasoningEffort: '--danger' }] }], 'codex')).toThrow(/invalid reasoning/)
    expect(() => validateReasoningEffort('codex', 'ultra')).not.toThrow()
    expect(() => validateReasoningEffort('antigravity', 'ultra')).toThrow(/does not support/)
  })
  it('accepts explicit default and none as distinct IPC values while rejecting malformed effort and access', () => {
    const request = { taskId: 'task', chatId: 'chat', provider: 'codex', presetName: '' }
    for (const reasoningEffort of [undefined, null, 'none', 'xhigh']) expect(() => validateSessionCommand('create', { ...request, reasoningEffort, permissions: 'Read only' })).not.toThrow()
    for (const reasoningEffort of ['', [], {}, '--effort high', 1]) expect(() => validateSessionCommand('create', { ...request, reasoningEffort })).toThrow()
    expect(() => validateSessionCommand('create', { ...request, permissions: 'unsafe typo' })).toThrow()
  })
  it('derives old read-only labels from concrete frozen policies without changing legacy queued context bytes', () => {
    const old = { provider: 'codex', presetName: 'Old', sandbox: 'read-only' }
    const before = JSON.stringify(old)
    expect(effectivePermissionLabel(old)).toBe('Read only')
    expect(effectivePermissionLabel({ provider: 'claude', claudePermissionMode: 'plan' })).toBe('Read only')
    expect(effectivePermissionLabel({ provider: 'api', apiReadOnly: true })).toBe('Read only')
    expect(effectivePermissionLabel({ provider: 'codex' })).toBeUndefined()
    const originalHash = createHash('sha256').update(JSON.stringify(['codex', 'Old', null, null, 'on-request', 'read-only', 'default', 'cli-settings', false])).digest('hex')
    expect(queueContext(old)).toBe(originalHash)
    expect(JSON.stringify(old)).toBe(before)
    expect(queueContext({ ...old, reasoningEffort: null })).not.toBe(originalHash)
    expect(queueContext({ ...old, reasoningEffort: 'none' })).not.toBe(queueContext({ ...old, reasoningEffort: null }))
  })
})
