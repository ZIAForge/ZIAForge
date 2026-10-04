import { describe, expect, it } from 'vitest'
import { buildAgentCommand, resolveDefaultPreset } from '../modelSelection'

const presets = [
  { name: 'Review', agent: 'Claude Code', model: 'auto', permissions: 'Read only' },
  { name: 'Coding', agent: 'Google Antigravity', model: 'gemini-3.8-flash-high', permissions: 'Read only' },
]

describe('model selection', () => {
  it('honors an existing default and falls back when it was deleted or data is still loading', () => {
    expect(resolveDefaultPreset(presets, 'Coding')).toBe('Coding')
    expect(resolveDefaultPreset(presets, 'deleted')).toBe('Review')
    expect(resolveDefaultPreset([], 'Coding')).toBe('auto')
  })

  it('uses the preset provider and model even when the name does not mention the provider', () => {
    expect(buildAgentCommand('Review', presets, 'Google Antigravity')).toBe('claude')
    expect(buildAgentCommand('Coding', presets, 'Claude Code')).toBe("agy --model 'gemini-3.8-flash-high'")
    expect(buildAgentCommand('future-model', presets, 'Codex')).toBe("codex --model 'future-model'")
    expect(buildAgentCommand('auto', presets, 'Codex')).toBe('codex')
    expect(buildAgentCommand('Review', [{ ...presets[0], model: '' }], 'Google Antigravity')).toBe('claude')
  })

  it('refuses legacy execution of an explicit effort without inventing terminal flags', () => {
    expect(() => buildAgentCommand('Review', [{ ...presets[0], reasoningEffort: 'high' }], 'Claude Code')).toThrow('unsupported in legacy')
    expect(buildAgentCommand('Review', [{ ...presets[0], reasoningEffort: null }], 'Claude Code')).toBe('claude')
  })

  it('quotes arbitrary custom model text as one shell argument', () => {
    expect(buildAgentCommand("model'$(touch bad);x", [], 'Google Antigravity')).toBe("agy --model 'model'\"'\"'$(touch bad);x'")
  })
})
