import { describe, expect, it } from 'vitest'
import { validateRecoveryRequest, validateRecoveryTarget, validateSavedPresets, validateSavedRepositories, validateSavedSettings, validateSavedTasks } from '../StoredMetadataValidation'

describe('saved metadata validation without silent filtering', () => {
  it('accepts partial historical settings and preserves forward-compatible unrelated fields', () => {
    const settings = { theme: 'dark', uiLanguage: 'ru', useMockData: false, futurePreference: { enabled: true } }
    expect(() => validateSavedSettings(settings)).not.toThrow()
    expect(settings.futurePreference.enabled).toBe(true)
    for (const value of [null, [], 'settings', { useMockData: 'true' }, { theme: {} }, { globalWorkspacePath: '../outside' }]) expect(() => validateSavedSettings(value)).toThrow()
  })
  it('keeps intentionally empty presets and rejects malformed or duplicate preset identities', () => {
    expect(() => validateSavedPresets([])).not.toThrow()
    const preset = { name: 'Native', agent: 'Codex', model: 'auto', permissions: 'Workspace write' }
    expect(() => validateSavedPresets([preset])).not.toThrow()
    for (const value of [[preset, preset], [null], [{ ...preset, model: {} }]]) expect(() => validateSavedPresets(value)).toThrow()
  })
  it('validates registered paths and every task identity without dropping another task', () => {
    const repo = { id: 'repo-one', name: 'Project', path: '/tmp/project', repoPath: '/tmp/source' }
    expect(() => validateSavedRepositories([repo])).not.toThrow()
    expect(() => validateSavedRepositories([{ ...repo, canonicalProjectPath: '../unsafe' }])).toThrow()
    const task = { id: 'task-one', repoId: repo.id, name: 'Task', status: 'idle', logs: [], legacyField: 'retained' }
    expect(() => validateSavedTasks([task], repo.id)).not.toThrow()
    for (const value of [[task, { ...task, id: 'task-two', repoId: 'different' }], [task, task], [task, null], [{ ...task, id: '../escape' }], [{ ...task, logs: [42] }]]) expect(() => validateSavedTasks(value, repo.id)).toThrow()
    expect(task.legacyField).toBe('retained')
  })
  it('exposes only logical recovery targets and exact content identities to the renderer', () => {
    for (const value of [{ domain: 'settings' }, { domain: 'tasks', repoId: 'repo-one' }, { domain: 'workflow', taskId: 'task-one' }, { domain: 'session-index', taskId: 'task-one' }, { domain: 'session', taskId: 'task-one', runId: 'run-one' }]) expect(() => validateRecoveryTarget(value)).not.toThrow()
    for (const value of [{ domain: 'tasks', repoId: '../outside' }, { domain: 'settings', filename: '/etc/passwd' }, { domain: 'workflow' }, { domain: 'session-index', taskId: '../outside' }, { domain: 'session', taskId: 'task-one', runId: '../outside' }, { domain: 'session', taskId: 'task-one' }, { domain: 'session', taskId: 'task-one', runId: 'run-one', filename: '/etc/passwd' }]) expect(() => validateRecoveryTarget(value)).toThrow()
    const request = { target: { domain: 'settings' }, expectedFingerprint: 'a'.repeat(64), backupId: 'b'.repeat(64) }
    expect(() => validateRecoveryRequest(request)).not.toThrow()
    expect(() => validateRecoveryRequest({ ...request, backupId: '../../backup' })).toThrow()
    expect(() => validateRecoveryRequest({ ...request, extra: true })).toThrow()
    expect(() => validateRecoveryTarget({ domain: 'message-queue', taskId: 'task-one', sessionId: 'session-one' })).not.toThrow()
    for (const extra of [{ taskId: '../outside' }, { sessionId: '../outside' }, { sessionId: 42 }, { filename: '/tmp/queue.json' }, { runId: 'other-run' }]) {
      expect(() => validateRecoveryTarget({ domain: 'message-queue', taskId: 'task-one', sessionId: 'session-one', ...extra })).toThrow()
    }
  })
})
