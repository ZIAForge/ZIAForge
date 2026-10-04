import { describe, expect, it } from 'vitest'
import { validateSessionCommand } from '../AgentSessionValidation'

describe('structured session IPC payloads', () => {
  const target = { sessionId: 'session-1', runId: 'run-1' }
  it('rejects renderer paths, binaries, environment and permission overrides', () => {
    for (const extra of [{ cwd: '/tmp' }, { codexBinPath: '/tmp/program' }, { env: {} }, { sandbox: 'danger-full-access' }, { taskId: '../other' }]) {
      expect(() => validateSessionCommand('create', { taskId: 'task-1', chatId: 'chat-main', ...extra })).toThrow()
    }
    expect(() => validateSessionCommand('create', { taskId: 'task-1', chatId: 'chat-main', presetName: 'My saved Codex' })).not.toThrow()
  })
  it('requires bounded identity and text and rejects unknown fields', () => {
    for (const payload of [null, [], {}, { ...target, text: 'x' }, { ...target, clientMessageId: 'msg-1', text: '' }, { ...target, clientMessageId: 'msg-1', text: 'x'.repeat(100001) }]) {
      expect(() => validateSessionCommand('send', payload)).toThrow()
    }
    expect(() => validateSessionCommand('send', { ...target, clientMessageId: 'msg-1', text: 'hi' })).not.toThrow()
    expect(() => validateSessionCommand('snapshot', { ...target, force: true })).toThrow()
  })
  it('validates explicit switch selections without accepting launch configuration', () => {
    expect(() => validateSessionCommand('create', { taskId: 'task-1', chatId: 'chat-main', presetName: '', provider: 'codex', model: 'custom/model' })).not.toThrow()
    expect(() => validateSessionCommand('reconfigure', { ...target, presetName: '', provider: 'claude', model: 'custom-model' })).not.toThrow()
    expect(() => validateSessionCommand('reconfigure', { ...target, presetName: '' })).toThrow(/provider/)
    expect(() => validateSessionCommand('create', { taskId: 'task-1', chatId: 'chat-main', presetName: '' })).toThrow(/provider/)
    expect(() => validateSessionCommand('resume', target)).not.toThrow()
    expect(() => validateSessionCommand('reconfigure', { ...target, presetName: '', provider: 'api', apiConnectionId: 'api-saved', model: 'vendor/model' })).not.toThrow()
    expect(() => validateSessionCommand('create', { taskId: 'task-1', chatId: 'chat-main', presetName: '', provider: 'api', apiConnectionId: '../secret' })).toThrow()
    expect(() => validateSessionCommand('reconfigure', { ...target, presetName: 'Selected', provider: 'claude', model: 'sonnet', requestId: 'switch-1' })).not.toThrow()
    for (const extra of [{ provider: 'unknown' }, { model: '' }, { model: 'x'.repeat(201) }, { env: {} }, { cwd: '/tmp' }, { sandbox: 'danger-full-access' }]) expect(() => validateSessionCommand('reconfigure', { ...target, presetName: 'Selected', ...extra })).toThrow()
  })
  it('requires a specific current turn and finite approval decision', () => {
    expect(() => validateSessionCommand('interrupt', target)).toThrow()
    expect(() => validateSessionCommand('interrupt', { ...target, turnId: 'turn-1' })).not.toThrow()
    expect(() => validateSessionCommand('resolveApproval', { ...target, turnId: 'turn-1', approvalId: 'approval-1', decision: 'always allow' })).toThrow()
    expect(() => validateSessionCommand('resolveApproval', { ...target, turnId: 'turn-1', approvalId: 'approval-1', decision: 'deny' })).not.toThrow()
  })
  it('bounds durable queue commands and rejects delivery or configuration overrides', () => {
    expect(() => validateSessionCommand('queue', { ...target, clientMessageId: 'queued-1', text: 'next task' })).not.toThrow()
    expect(() => validateSessionCommand('setQueuePaused', { ...target, paused: true })).not.toThrow()
    expect(() => validateSessionCommand('cancelQueued', { ...target, clientMessageId: 'queued-1' })).not.toThrow()
    for (const extra of [{ text: '' }, { text: 'x'.repeat(100001) }, { clientMessageId: '../other' }, { cwd: '/tmp' }, { provider: 'claude' }, { force: true }, { status: 'queued' }]) {
      expect(() => validateSessionCommand('queue', { ...target, clientMessageId: 'queued-1', text: 'next task', ...extra })).toThrow()
    }
    for (const paused of [undefined, 1, 'false', null]) expect(() => validateSessionCommand('setQueuePaused', { ...target, paused })).toThrow()
    expect(() => validateSessionCommand('cancelQueued', { ...target, clientMessageId: 'queued-1', retry: true })).toThrow()
  })
})
