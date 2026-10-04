import { afterEach, describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runVersionProbe } from '../VersionProbe'
vi.mock('../VersionProbe', () => ({ runVersionProbe: vi.fn(), shutdownVersionProbes: vi.fn(async () => {}) }))
import { parseProviderVersion, prepareProviderLaunch, resolveProviderPreset, resolveChatSelection } from '../ProviderLaunch'

describe('native provider preflight', () => {
  it('allows direct CLI selection without a saved preset and applies provider defaults', () => {
    expect(resolveChatSelection('', [], undefined, { provider: 'codex', model: 'custom/model-next' })).toMatchObject({ provider: 'codex', model: 'custom/model-next', sandbox: 'workspace-write', approvalPolicy: 'on-request' })
    expect(resolveChatSelection('', [], undefined, { provider: 'claude' })).toMatchObject({ provider: 'claude', claudePermissionMode: 'default' })
    expect(resolveChatSelection('', [], undefined, { provider: 'antigravity' })).toMatchObject({ provider: 'antigravity', agyPermissionMode: 'cli-settings' })
    expect(() => resolveChatSelection('', [], undefined)).toThrow(/provider/)
    expect(() => resolveChatSelection('Missing', [], undefined, { provider: 'codex' })).toThrow(/saved preset/)
    expect(() => resolveChatSelection('', [], undefined, { provider: 'codex', model: 'bad\nmodel' })).toThrow(/model/)
  })
  it('preserves inherited effort, explicit default and provider-compatible access overrides', () => {
    const presets = [{ name: 'Saved', agent: 'Codex', model: 'future-model', permissions: 'Workspace write', reasoningEffort: 'high' }]
    expect(resolveChatSelection('Saved', presets)).toMatchObject({ reasoningEffort: 'high', sandbox: 'workspace-write' })
    expect(resolveChatSelection('Saved', presets, undefined, { reasoningEffort: null, permissions: 'Read only' })).toMatchObject({ reasoningEffort: null, permissions: 'Read only', sandbox: 'read-only' })
    expect(resolveChatSelection('Saved', presets, undefined, { reasoningEffort: 'none' })).toMatchObject({ reasoningEffort: 'none' })
    expect(resolveChatSelection('Saved', presets, undefined, { provider: 'claude' })).toMatchObject({ reasoningEffort: undefined, permissions: 'Read & Write', claudePermissionMode: 'default' })
    expect(presets[0]).toMatchObject({ reasoningEffort: 'high', permissions: 'Workspace write' })
    expect(() => resolveChatSelection('', [], undefined, { provider: 'antigravity', reasoningEffort: 'ultra' })).toThrow(/does not support/)
    expect(() => resolveChatSelection('', [], undefined, { provider: 'claude', reasoningEffort: 'none' })).toThrow(/does not support/)
    expect(() => resolveChatSelection('', [], undefined, { provider: 'codex', reasoningEffort: 'high --danger' })).toThrow(/Invalid reasoning/)
    expect(() => resolveChatSelection('', [], undefined, { provider: 'antigravity', reasoningEffort: 'high', permissions: 'Read only' })).toThrow(/cannot enforce/)
  })

  it('requires the verified Claude and Antigravity versions', () => {
    expect(parseProviderVersion('claude', '2.1.114 (Claude Code)\n')).toBe('2.1.114')
    expect(parseProviderVersion('antigravity', '1.2.2\n')).toBe('1.2.2')
    expect(parseProviderVersion('antigravity', '1.2.7\n')).toBe('1.2.7')
    expect(parseProviderVersion('antigravity', 'agy 1.2.7\n')).toBe('1.2.7')
    for (const output of ['2.1.113 (Claude Code)', '2.2.1 (Claude Code)', '2.1.114 (Claude Code)\nextra']) expect(() => parseProviderVersion('claude', output)).toThrow()
    for (const output of ['1.2.1', '1.3.0', '1.2.3', '1.2.6', '1.2.8', '1.2.2\nextra', '1.2.7\nextra', '1.2.7-beta']) expect(() => parseProviderVersion('antigravity', output)).toThrow()
  })

  it('maps saved permissions explicitly and never infers unrestricted access from the name', () => {
    const resolve = (agent: string, permissions: string) => resolveProviderPreset('Full access name', [{ name: 'Full access name', agent, model: 'auto', permissions }])
    expect(resolve('Claude Code', 'Read only')).toMatchObject({ provider: 'claude', claudePermissionMode: 'plan', model: undefined })
    expect(resolve('Claude Code', 'Read & Write')).toMatchObject({ claudePermissionMode: 'default' })
    expect(resolve('Claude Code', 'Dangerously skip permissions')).toMatchObject({ claudePermissionMode: 'bypassPermissions' })
    expect(resolve('Google Antigravity', 'CLI settings')).toMatchObject({ provider: 'antigravity', agyPermissionMode: 'cli-settings' })
    expect(resolve('Google Antigravity', 'Danger full access')).toMatchObject({ agyPermissionMode: 'dangerously-skip' })
    expect(() => resolve('Google Antigravity', 'Read only')).toThrow(/cannot enforce/)
    expect(() => resolve('Google Antigravity', 'Workspace write')).toThrow(/cannot enforce/)
    expect(() => resolve('Claude Code', 'typo')).toThrow()
    expect(resolve('Codex', 'Read & Write')).toMatchObject({ provider: 'codex', sandbox: 'workspace-write', approvalPolicy: 'on-request' })
  })
})


const temporary: string[] = []
afterEach(() => { vi.clearAllMocks(); for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })
function executableFixture(nativePath = false, nativeSibling?: boolean) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-native-cli-')))
  temporary.push(directory)
  const native = Buffer.from(process.platform === 'darwin' ? [0xcf, 0xfa, 0xed, 0xfe] : [0x7f, 0x45, 0x4c, 0x46])
  const wrapper = Buffer.from('#!/bin/sh\nexit 0\n')
  const binary = path.join(directory, 'claude')
  fs.writeFileSync(binary, nativePath ? native : wrapper, { mode: 0o700 })
  if (nativeSibling !== undefined) fs.writeFileSync(`${binary}.real`, nativeSibling ? native : wrapper, { mode: 0o700 })
  vi.mocked(runVersionProbe).mockResolvedValue('2.1.114 (Claude Code)\n')
  return { binary, env: { PATH: directory } }
}

describe('explicit native Claude preference', () => {
  it('uses an already-native PATH executable without searching for a replacement', async () => {
    const fixture = executableFixture(true, false)
    const result = await prepareProviderLaunch('claude', fixture.env)
    expect(result).toMatchObject({ claudeBinPath: fixture.binary, launchNotice: expect.stringContaining('native executable') })
    expect(runVersionProbe).toHaveBeenCalledWith(fixture.binary, fixture.env)
  })
  it('selects only the adjacent native executable and announces its real path', async () => {
    const fixture = executableFixture(false, true)
    const result = await prepareProviderLaunch('claude', fixture.env)
    expect(result).toMatchObject({ claudeBinPath: `${fixture.binary}.real`, launchNotice: expect.stringContaining(`${fixture.binary}.real`) })
    expect(runVersionProbe).toHaveBeenCalledTimes(1)
    expect(runVersionProbe).toHaveBeenCalledWith(`${fixture.binary}.real`, fixture.env)
    expect(fixture.env).toEqual({ PATH: path.dirname(fixture.binary) })
  })
  it('honors explicit PATH preference and reports wrapper fallback when no native sibling exists', async () => {
    const fixture = executableFixture(false, true)
    expect(await prepareProviderLaunch('claude', fixture.env, { preferNativeClaude: false })).toMatchObject({ claudeBinPath: fixture.binary, launchNotice: expect.stringContaining('script or wrapper') })
    fs.unlinkSync(`${fixture.binary}.real`)
    expect(await prepareProviderLaunch('claude', fixture.env)).toMatchObject({ claudeBinPath: fixture.binary, launchNotice: expect.stringContaining('script or wrapper') })
  })
  it('refuses an invalid native sibling or unsupported native version without executing a fallback wrapper', async () => {
    const fixture = executableFixture(false, false)
    await expect(prepareProviderLaunch('claude', fixture.env)).rejects.toThrow(/adjacent Claude .real executable is invalid/)
    expect(runVersionProbe).not.toHaveBeenCalled()
    fs.writeFileSync(`${fixture.binary}.real`, Buffer.from(process.platform === 'darwin' ? [0xcf, 0xfa, 0xed, 0xfe] : [0x7f, 0x45, 0x4c, 0x46]))
    vi.mocked(runVersionProbe).mockResolvedValue('2.1.999 (Claude Code)\n')
    await expect(prepareProviderLaunch('claude', fixture.env)).rejects.toThrow(/Unsupported claude CLI version/)
    expect(runVersionProbe).toHaveBeenCalledTimes(1)
    expect(runVersionProbe).toHaveBeenCalledWith(`${fixture.binary}.real`, fixture.env)
  })
})
