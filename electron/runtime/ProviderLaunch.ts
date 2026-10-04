import type { AgentExecutionOptions } from '../../shared/agent-models'
import { validateReasoningEffort, isPermissionLabel } from './AgentExecutionPolicy'
import fs from 'node:fs'
import path from 'node:path'
import type { Preset } from '../../shared/legacy-ipc'
import type { AgentSessionProvider } from '../../shared/agent-session'
import { codexPermissionPolicy, prepareCodexLaunch } from './CodexLaunch'
import { runVersionProbe, shutdownVersionProbes } from './VersionProbe'

export function presetProvider(agent: string): AgentSessionProvider | undefined {
  if (agent === 'Codex' || agent === 'ZIAFCoder') return 'codex'
  if (agent === 'Claude Code') return 'claude'
  if (agent === 'Google Antigravity') return 'antigravity'
  if (agent === 'OpenAI-compatible API') return 'api'
}

export function resolveProviderPreset(selection: string | undefined, presets: Preset[], defaultPreset?: string) {
  const preset = presets.find(item => item.name === (selection || defaultPreset))
  const provider = preset && presetProvider(preset.agent)
  if (!preset || !provider) throw new Error('Select a saved Codex, Claude Code or Antigravity preset')
  const model = preset.model.trim()
  if (model.length > 200 || [...model].some(char => char.charCodeAt(0) < 32)) throw new Error('Invalid model identifier')
  validateReasoningEffort(provider, preset.reasoningEffort)
  const common = { provider, model: model && model !== 'auto' ? model : undefined, reasoningEffort: preset.reasoningEffort, permissions: preset.permissions || (provider === 'claude' ? 'Read & Write' : provider === 'antigravity' ? 'CLI settings' : 'Workspace write') }
  const permission = preset.permissions
  if (provider === 'api') {
    if (!['Read only', 'Workspace write', 'Read & Write', ''].includes(permission)) throw new Error('API tools support Read only or Workspace write with explicit write approval')
    if (!preset.apiConnectionId || !/^[A-Za-z0-9_-]{1,160}$/.test(preset.apiConnectionId)) throw new Error('Select a saved API connection')
    return { ...common, apiConnectionId: preset.apiConnectionId, apiReadOnly: permission === 'Read only' }
  }
  if (provider === 'codex') return { ...common, ...codexPermissionPolicy(permission === 'Read & Write' ? 'Workspace write' : permission) }
  if (provider === 'claude') {
    if (permission === 'Read only') return { ...common, claudePermissionMode: 'plan' as const }
    if (permission === 'Danger full access' || permission === 'Dangerously skip permissions') return { ...common, claudePermissionMode: 'bypassPermissions' as const }
    if (!permission || ['CLI settings', 'Read & Write', 'Workspace write'].includes(permission)) return { ...common, claudePermissionMode: 'default' as const }
    throw new Error('Unsupported Claude permission preset')
  }
  if (permission === 'CLI settings') return { ...common, agyPermissionMode: 'cli-settings' as const }
  if (permission === 'Danger full access' || permission === 'Dangerously skip permissions') return { ...common, agyPermissionMode: 'dangerously-skip' as const }
  throw new Error('Antigravity headless cannot enforce Read only or Workspace write. Choose CLI settings in its preset, or explicitly choose unrestricted permissions.')
}

/** A deliberate chat override; never mutate the user's saved preset. */
export function resolveChatSelection(selection: string | undefined, presets: Preset[], defaultPreset?: string, override?: AgentExecutionOptions & { provider?: AgentSessionProvider; model?: string; apiConnectionId?: string }) {
  // Empty is deliberate direct CLI selection; undefined retains the saved default.
  const direct = selection === ''
  const saved = direct ? undefined : presets.find(item => item.name === (selection ?? defaultPreset))
  if (!saved && !direct) throw new Error('Select a saved preset or choose a CLI directly')
  const originalProvider = saved && presetProvider(saved.agent)
  const provider = override?.provider ?? originalProvider
  if (provider !== 'codex' && provider !== 'claude' && provider !== 'antigravity' && provider !== 'api') throw new Error('Unsupported CLI provider')
  const changed = !saved || provider !== originalProvider
  const agent = { codex: 'Codex', claude: 'Claude Code', antigravity: 'Google Antigravity', api: 'OpenAI-compatible API' }[provider]
  if (override?.permissions !== undefined && !isPermissionLabel(override.permissions)) throw new Error('Unsupported access selection')
  const permissions = override?.permissions ?? (changed ? provider === 'antigravity' ? 'CLI settings' : provider === 'claude' ? 'Read & Write' : 'Workspace write' : saved!.permissions)
  const reasoningEffort = override?.reasoningEffort !== undefined ? override.reasoningEffort : changed ? undefined : saved?.reasoningEffort
  const model = override?.model ?? (changed ? 'auto' : saved!.model)
  const name = saved?.name || 'Direct CLI'
  return resolveProviderPreset(name, [{ name, agent, model, permissions, reasoningEffort, ...(provider === 'api' ? { apiConnectionId: override?.apiConnectionId ?? (originalProvider === 'api' ? saved?.apiConnectionId : undefined) } : {}) }])
}

export function parseProviderVersion(provider: 'claude' | 'antigravity', output: string): string {
  const match = provider === 'claude' ? output.trim().match(/^(2\.1\.(\d+)) \(Claude Code\)$/) : output.trim().match(/^(?:agy\s+)?(1\.2\.(\d+))$/)
  const supported = provider === 'claude' ? ['2.1.114'] : ['1.2.2', '1.2.7']
  if (!match || !supported.includes(match[1])) throw new Error(`Unsupported ${provider} CLI version. Supported versions: Claude Code 2.1.114, Antigravity 1.2.2 or 1.2.7.`)
  return match[1]
}

export interface ProviderLaunchOptions { preferNativeClaude?: boolean; reasoningEffort?: string | null }

/** Inspect the executable container only; never interpret user wrapper contents. */
export function isNativeProgram(filename: string): boolean {
  const file = fs.openSync(filename, fs.constants.O_RDONLY)
  try {
    const header = Buffer.alloc(4)
    if (fs.readSync(file, header, 0, 4, 0) !== 4) return false
    const magic = header.readUInt32BE(0)
    if (process.platform === 'darwin') return [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca].includes(magic)
    return magic === 0x7f454c46
  } finally { fs.closeSync(file) }
}

let launchClosing = false
const pendingLaunches = new Set<Promise<Awaited<ReturnType<typeof prepareProviderLaunchInternal>>>>()

/** Includes Codex's delegated version probe; shutdown owns every in-flight preflight. */
export function prepareProviderLaunch(provider: AgentSessionProvider, env: Record<string, string | undefined>, options: ProviderLaunchOptions = {}) {
  if (launchClosing) return Promise.reject(new Error('Provider launch service is shutting down'))
  const operation = prepareProviderLaunchInternal(provider, env, options)
  pendingLaunches.add(operation)
  void operation.finally(() => pendingLaunches.delete(operation)).catch(() => {})
  return operation
}

export async function shutdownProviderLaunches(): Promise<void> {
  launchClosing = true
  await shutdownVersionProbes()
  await Promise.allSettled([...pendingLaunches])
}

async function prepareProviderLaunchInternal(provider: AgentSessionProvider, env: Record<string, string | undefined>, options: ProviderLaunchOptions = {}) {
  if (provider === 'api') throw new Error('API connections do not launch a CLI process')
  if (provider === 'codex') {
    const launch = await prepareCodexLaunch(env)
    return { codexBinPath: launch.binary }
  }
  const name = provider === 'claude' ? 'claude' : 'agy'
  let binary: string | undefined
  let pathCandidate: string | undefined
  for (const directory of (env.PATH || '').split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue
    const candidate = path.join(directory, name)
    try {
      if (!fs.statSync(candidate).isFile()) continue
      fs.accessSync(candidate, fs.constants.X_OK)
      binary = fs.realpathSync(candidate); pathCandidate = candidate; break
    } catch { /* Continue through the backend executable search path. */ }
  }
  if (!binary) throw new Error(`${name} CLI was not found on PATH. Install it and sign in, then reopen ZIAForge.`)
  let launchNotice: string | undefined
  if (provider === 'claude') {
    if (options.preferNativeClaude !== false && !isNativeProgram(binary)) {
      const nativeCandidate = `${pathCandidate}.real`
      let exists = false
      try { fs.lstatSync(nativeCandidate); exists = true } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      if (exists) {
        try {
          const resolved = fs.realpathSync(nativeCandidate)
          if (!fs.statSync(resolved).isFile()) throw new Error('Not a regular file')
          fs.accessSync(resolved, fs.constants.X_OK)
          if (!isNativeProgram(resolved)) throw new Error('Not a native executable')
          binary = resolved
        } catch { throw new Error('The adjacent Claude .real executable is invalid. Repair it or disable Prefer native Claude executable in ZIAForge settings.') }
      }
    }
    launchNotice = `Claude CLI: ${isNativeProgram(binary) ? 'native executable' : 'PATH command (script or wrapper)'} — ${binary}`
  }
  const output = await runVersionProbe(binary, env)
  const version = parseProviderVersion(provider, output)
  if (provider === 'antigravity' && options.reasoningEffort != null && version !== '1.2.7') throw new Error('Antigravity reasoning effort requires the verified CLI version 1.2.7')
  return provider === 'claude' ? { claudeBinPath: binary, launchNotice } : { agyBinPath: binary }
}
