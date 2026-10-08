import { describe, expect, it } from 'vitest'
import { grokInspection, grokModelMetadata } from '../GrokDiscovery'
import { validGrokConnectionOptions } from '../../../shared/api-provider'
import { queueContext } from '../../runtime/QueueStore'

const cap = { version: 1, cliVersion: 'fixture', nativeTools: [{ name: 'web_search' }], imageInput: true, interactiveQuestions: { available: true }, media: { images: { available: true, verified: true, edit: true }, video: { available: true, enabled: false, verified: false, restriction: 'Storage unavailable' } }, reasoningSummaries: false }
const models = { data: [{ id: 'grok-fixture', reasoning_efforts: ['low', 'high'], default_reasoning_effort: 'high', context_windows: [256000, 500000], context_window: 256000 }] }

describe('Grok capability discovery', () => {
  it('retains advertised per-model options without inventing unsupported defaults', () => {
    expect(grokModelMetadata(models.data[0])).toEqual({ supportedReasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'high', contextWindows: [256000, 500000], defaultContextWindow: 256000 })
    expect(grokModelMetadata({ reasoning_efforts: ['low'], default_reasoning_effort: 'ultra', context_windows: [256000], context_window: 999 })).toEqual({ supportedReasoningEfforts: ['low'], contextWindows: [256000] })
    expect(grokModelMetadata({ reasoning_efforts: ['high', {}], context_windows: [NaN, -1] })).toEqual({})
  })
  it('distinguishes discovered media from verified and enabled media, preserving unknown quota', () => {
    const result = grokInspection(cap, { account: { email: 'private-owner' }, rate_limits: { tier: 'fixture', currentPeriod: { end: '2026-10-14' }, creditUsagePercent: null, rawSecret: 'hidden' } }, models, true)
    expect(result).toMatchObject({ version: 1, imageInput: true, imageGeneration: true, imageEdit: true, videoAvailable: false, interactiveQuestions: true, contextWindows: [256000, 500000], usage: { tier: 'fixture', creditUsagePercent: null, periodEnd: '2026-10-14' } })
    expect(JSON.stringify(result)).not.toMatch(/private-owner|hidden|rawSecret/)
    expect(grokInspection({ ...cap, media: { images: { available: true }, video: { available: true, enabled: true } } }, null, models, false)).toMatchObject({ imageGeneration: false, videoAvailable: false })
  })
  it('refuses incompatible extensions and invalid tool catalogs', () => {
    expect(() => grokInspection({ ...cap, version: 2 }, null, models, false)).toThrow('Unsupported')
    expect(() => grokInspection({ ...cap, nativeTools: [{ name: '../foreign' }] }, null, models, false)).toThrow('Invalid')
    expect(() => grokInspection(cap, null, { data: {} }, false)).toThrow('Invalid')
  })
  it('validates configuration bounds and rejects unknown native escalation fields', () => {
    expect(validGrokConnectionOptions({ contextWindow: 500000, maxTurns: 100 })).toBe(true)
    for (const value of [{ maxTurns: 0 }, { maxTurns: 101 }, { contextWindow: 0 }, { contextWindow: 1.5 }, { permissionMode: 'yolo' }, { allowedTools: ['run_terminal_command'] }, []]) expect(validGrokConnectionOptions(value)).toBe(false)
  })
  it('binds a saved queue to Grok settings without changing legacy queue identity', () => {
    const legacy = { provider: 'api', presetName: '', apiTransport: 'responses', apiProfile: 'codex-connector' }
    expect(queueContext({ ...legacy, apiGrokConfig: { maxTurns: 7 } })).toBe(queueContext(legacy))
    const grok = { ...legacy, apiProfile: 'grok-connector-v1' }
    expect(queueContext({ ...grok, apiGrokConfig: {} })).toBe(queueContext(grok))
    expect(queueContext({ ...grok, apiGrokConfig: { contextWindow: 256000 } })).not.toBe(queueContext({ ...grok, apiGrokConfig: { contextWindow: 500000 } }))
    expect(queueContext({ ...grok, apiGrokConfig: { maxTurns: 7, contextWindow: 500000 } })).toBe(queueContext({ ...grok, apiGrokConfig: { contextWindow: 500000, maxTurns: 7 } }))
  })
})
