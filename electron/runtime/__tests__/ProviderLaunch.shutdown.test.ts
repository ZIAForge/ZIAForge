import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runVersionProbe, shutdownVersionProbes } from '../VersionProbe'
import { expect, it, vi } from 'vitest'
import { prepareProviderLaunch, shutdownProviderLaunches } from '../ProviderLaunch'
vi.mock('../VersionProbe', () => ({ runVersionProbe: vi.fn(), shutdownVersionProbes: vi.fn(async () => {}) }))

it('owns both delegated Codex and Claude version probes through quit, and refuses new probes', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-preflight-quit-')))
  const callbacks = new Map<string, (stdout: string) => void>()
  for (const name of ['codex', 'claude']) fs.writeFileSync(path.join(directory, name), '#!/bin/sh\nexit 0\n', { mode: 0o700 })
  vi.mocked(runVersionProbe).mockImplementation(binary => new Promise(resolve => { callbacks.set(path.basename(binary), resolve) }))
  try {
    const codex = prepareProviderLaunch('codex', { PATH: directory })
    const claude = prepareProviderLaunch('claude', { PATH: directory })
    let quitFinished = false
    const quitting = shutdownProviderLaunches().then(() => { quitFinished = true })
    await expect(prepareProviderLaunch('antigravity', { PATH: directory })).rejects.toThrow(/shutting down/)
    expect(runVersionProbe).toHaveBeenCalledTimes(2)
    expect(shutdownVersionProbes).toHaveBeenCalledTimes(1)
    expect(quitFinished).toBe(false)
    callbacks.get('codex')!('codex-cli 0.153.4\n')
    await codex
    expect(quitFinished).toBe(false)
    callbacks.get('claude')!('2.1.114 (Claude Code)\n')
    await claude
    await quitting
    expect(quitFinished).toBe(true)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
