import { describe, expect, it } from 'vitest'
import { claudeInspection, claudeModelMetadata } from '../ClaudeDiscovery'
import { normalizeClaudeConnectionOptions, validClaudeConnectionOptions } from '../../../shared/api-provider'

const cap = {
  version: 1, provider: 'claude', sdkVersion: 'fixture-sdk', toolCatalog: ['Read', 'WebSearch'],
  discoveredTools: [
    { name: 'Read', available: true, enabled: true, verified: true },
    { name: 'WebSearch', available: true, enabled: true, verified: false },
    { name: 'CronCreate', available: true, enabled: false, verified: false, reason: 'Outside connector ownership.' },
  ],
  callerTools: { available: true, enabled: true, verified: true },
  nativeImageInput: { available: true, verified: false }, imageInput: false,
  documentInput: { available: true, enabled: true, verified: false, mediaTypes: ['application/pdf', 'text/plain'] },
  artifacts: { available: true, enabled: true, verified: true }, thinking: { available: true, display: ['summarized', 'omitted'] },
  history: { liveSessionContinuation: true, ownedIdleResume: true, restartResume: true },
}
const models = { data: [{ id: 'fixture-model', display_name: 'Fixture model', reasoning_efforts: ['low', 'high'], context_windows: [], input_modalities: ['text', 'image'], resolved_model: 'fixture-resolved', supports_adaptive_thinking: true, supports_manual_thinking: null, max_output_tokens: null }] }

describe('Claude Connector discovery and saved options', () => {
  it('defaults to caller execution without native tools or silent history import', () => {
    expect(normalizeClaudeConnectionOptions()).toEqual({ mode: 'caller', nativeTools: [], permissionMode: 'manual', maxTurns: 30, maxTokens: 4096, historyMode: 'reject' })
    expect(normalizeClaudeConnectionOptions({ nativeTools: undefined }).nativeTools).toEqual([])
    const original = { nativeTools: ['Read'], outputSchema: { type: 'object', properties: { result: { type: 'string' } } } }
    const normalized = normalizeClaudeConnectionOptions(original)
    normalized.nativeTools.push('Write')
    expect(original.nativeTools).toEqual(['Read'])
  })
  it('validates bounded options and refuses native escalation, malformed thinking and non-JSON schemas', () => {
    expect(validClaudeConnectionOptions({ mode: 'native', permissionMode: 'acceptEdits', nativeTools: ['Read'], maxTokens: 8192, maxTurns: 100, thinking: { type: 'enabled', budget_tokens: 2048, display: 'summarized' }, historyMode: 'context' })).toBe(true)
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic
    for (const value of [{ mode: ['caller'] }, { permissionMode: 'bypassPermissions' }, { allowedTools: ['Bash'] }, { nativeTools: ['Read', 'Read'] }, { nativeTools: ['Bash(*)'] }, { maxTurns: 101 }, { maxTokens: 128001 }, { maxTokens: 1.5 }, { thinking: { type: 'enabled', budget_tokens: 4096 } }, { thinking: { type: 'adaptive', budget_tokens: 1024 } }, { thinking: { type: 'disabled', display: 'omitted' } }, { outputSchema: cyclic }, { outputSchema: { invalid: undefined } }, { outputSchema: { huge: 'x'.repeat(131073) } }]) expect(validClaudeConnectionOptions(value)).toBe(false)
  })
  it('preserves model-declared capabilities without inventing missing thinking or token budgets', () => {
    expect(claudeModelMetadata(models.data[0])).toEqual({ label: 'Fixture model', supportedReasoningEfforts: ['low', 'high'], contextWindows: [] })
    expect(claudeModelMetadata({ reasoning_efforts: ['high', {}], context_windows: [-1], default_reasoning_effort: 'max' })).toEqual({ supportedReasoningEfforts: [], contextWindows: [] })
    const result = claudeInspection({ capabilities: cap, tools: cap, models })
    expect(result.models[0]).toMatchObject({ supportsAdaptiveThinking: true, supportsManualThinking: null, maxOutputTokens: null })
    expect(result.tools.map(tool => [tool.name, tool.enabled, tool.verified])).toEqual([['Read', true, true], ['WebSearch', true, false], ['CronCreate', false, false]])
  })
  it('sanitizes discovery, retains unknown limit windows and separates manual renewal from reset', () => {
    const result = claudeInspection({ capabilities: cap, tools: cap, models,
      usage: { account: { email: 'private-owner' }, rate_limits: { available: true, experimental: true, checkedAt: '2026-10-08T18:00:00Z', subscriptionType: 'Max', windows: [{ name: 'five_hour', usedPercent: 25, remainingPercent: 99, resetsAt: '2026-10-08T20:00:00Z' }, { name: 'seven_day', usedPercent: null, remainingPercent: 100, resetsAt: null }], rawSecret: 'private-raw' }, subscription: { source: 'manual', renewsAt: '2026-11-08' } },
      status: { claude: { connected: true, version: 'fixture-cli', account: 'private-account' }, activity: { active: 1, queued: 0, nativeActive: null, concurrency: 8 }, api: { tokenHint: 'private-key-hint' } },
      sessions: { version: 1, sessions: [{ id: 'private-session-1' }, { id: 'private-session-1' }, { id: 'private-session-2' }] },
    })
    expect(result.usage).toMatchObject({ available: true, windows: [{ usedPercent: 25, remainingPercent: 75 }, { usedPercent: null, remainingPercent: null }], renewsAt: '2026-11-08', renewalSource: 'manual' })
    expect(result.status).toMatchObject({ connected: true, active: 1, queued: 0, nativeActive: null, ownedSessions: 2 })
    expect(JSON.stringify(result)).not.toMatch(/private-/)
    const missing = claudeInspection({ capabilities: cap, tools: cap, models, usage: { rate_limits: { available: false, windows: [{ name: 'five_hour', usedPercent: 0 }] }, subscription: { source: 'native', renewsAt: '2026-11-08' } } })
    expect(missing.usage).toMatchObject({ available: false, windows: [{ usedPercent: null, remainingPercent: null }], renewsAt: null, renewalSource: 'unavailable' })
    expect(missing.status).toMatchObject({ connected: null, active: null, ownedSessions: null })
  })
  it('rejects incompatible or inconsistent catalogs and does not enable absent tools', () => {
    expect(() => claudeInspection({ capabilities: { ...cap, version: 2 }, tools: cap, models })).toThrow('Unsupported')
    expect(() => claudeInspection({ capabilities: cap, tools: { ...cap, toolCatalog: ['Undiscovered'] }, models })).toThrow('absent')
    expect(() => claudeInspection({ capabilities: cap, tools: { ...cap, discoveredTools: [{ name: '../escape' }] }, models })).toThrow('Invalid')
    expect(() => claudeInspection({ capabilities: cap, tools: cap, models: { data: [models.data[0], models.data[0]] } })).toThrow('Duplicate')
    expect(claudeInspection({ capabilities: { ...cap, toolCatalog: [] }, tools: cap, models }).tools.every(tool => !tool.enabled)).toBe(true)
  })
})
