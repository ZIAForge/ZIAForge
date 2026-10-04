import fs from 'node:fs'
import path from 'node:path'
import type { Preset } from '../../shared/legacy-ipc'
import { runVersionProbe } from './VersionProbe'

export function codexPermissionPolicy(permissions: string | undefined): {
  sandbox: 'read-only' | 'workspace-write' | 'danger-full-access'
  approvalPolicy: 'on-request' | 'never'
} {
  if (permissions === 'Read only') return { sandbox: 'read-only', approvalPolicy: 'on-request' }
  if (permissions === 'Danger full access' || permissions === 'Dangerously skip permissions') {
    return { sandbox: 'danger-full-access', approvalPolicy: 'never' }
  }
  if (!permissions || permissions === 'Workspace write') return { sandbox: 'workspace-write', approvalPolicy: 'on-request' }
  throw new Error('Unsupported Codex permission preset')
}

export function resolveCodexPreset(selection: string | undefined, presets: Preset[], defaultPreset?: string) {
  const name = selection || defaultPreset
  const preset = presets.find(item => item.name === name)
  if (!preset || !['Codex', 'ZIAFCoder'].includes(preset.agent)) {
    throw new Error('Select a saved Codex preset for this conversation')
  }
  const model = preset.model.trim()
  if (model.length > 200 || [...model].some(char => char.charCodeAt(0) < 32)) throw new Error('Invalid model identifier')
  return { model: model && model !== 'auto' ? model : undefined, ...codexPermissionPolicy(preset.permissions) }
}

export function parseSupportedCodexVersion(output: string): string {
  const match = output.trim().match(/^codex-cli (0\.153\.(\d+))$/)
  if (!match || Number(match[2]) < 4) {
    throw new Error('This integration supports Codex CLI 0.153.x (0.153.4 or newer patch). Update the CLI or compatibility contract before starting.')
  }
  return match[1]
}

/** Resolve from the backend environment, never from a renderer-supplied command. */
export async function prepareCodexLaunch(env: Record<string, string | undefined>): Promise<{ binary: string; version: string }> {
  let binary: string | undefined
  for (const directory of (env.PATH || '').split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue
    const candidate = path.join(directory, process.platform === 'win32' ? 'codex.exe' : 'codex')
    try {
      if (!fs.statSync(candidate).isFile()) continue
      fs.accessSync(candidate, fs.constants.X_OK)
      binary = fs.realpathSync(candidate)
      break
    } catch { /* Continue through the user's executable search path. */ }
  }
  if (!binary) throw new Error('Codex CLI was not found on PATH. Install and sign in to Codex, then reopen ZIAForge.')
  const output = await runVersionProbe(binary, env)
  return { binary, version: parseSupportedCodexVersion(output) }
}
