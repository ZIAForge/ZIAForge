import { describe, expect, it } from 'vitest'
import { codexPermissionPolicy, parseSupportedCodexVersion, prepareCodexLaunch, resolveCodexPreset } from '../CodexLaunch'

describe('Codex backend launch policy', () => {
  it('uses the saved provider and actual model rather than the preset label', () => {
    expect(resolveCodexPreset('My assistant', [{ name: 'My assistant', agent: 'Codex', model: 'gpt-fixture', permissions: 'Read only' }])).toEqual({
      model: 'gpt-fixture', sandbox: 'read-only', approvalPolicy: 'on-request',
    })
    expect(resolveCodexPreset(undefined, [{ name: 'Default', agent: 'Codex', model: 'auto', permissions: 'Workspace write' }], 'Default').model).toBeUndefined()
    expect(() => resolveCodexPreset('Codex-like name', [{ name: 'Codex-like name', agent: 'Claude Code', model: 'auto', permissions: 'Read only' }])).toThrow()
    expect(() => resolveCodexPreset('unknown', [])).toThrow()
  })
  it('does not silently widen an unknown or missing permission setting', () => {
    expect(codexPermissionPolicy(undefined)).toEqual({ sandbox: 'workspace-write', approvalPolicy: 'on-request' })
    expect(codexPermissionPolicy('Danger full access')).toEqual({ sandbox: 'danger-full-access', approvalPolicy: 'never' })
    expect(() => codexPermissionPolicy('custom unsafe typo')).toThrow()
  })
  it('accepts the pinned compatible patch series and rejects unknown version contracts', () => {
    expect(parseSupportedCodexVersion('codex-cli 0.153.4\n')).toBe('0.153.4')
    expect(parseSupportedCodexVersion('codex-cli 0.153.5')).toBe('0.153.5')
    for (const version of ['codex-cli 0.153.3', 'codex-cli 0.154.0', '0.153.4', 'codex-cli 0.153.4-beta', 'codex-cli 1.153.4']) {
      expect(() => parseSupportedCodexVersion(version)).toThrow()
    }
  })
  it('refuses cwd-relative executable lookup', async () => {
    await expect(prepareCodexLaunch({ PATH: '.:relative' })).rejects.toThrow('not found')
  })
})
