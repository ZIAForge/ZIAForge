import path from 'node:path'
import { app } from 'electron'
import { RecoveryStore } from '../runtime/RecoveryStore'
import { UPDATE_REPOSITORY, downloadUpdateAsset } from './UpdateDownload'
import { loadUpdateCandidate, parseReleases, type UpdateCandidate } from './UpdateRelease'
import { armPreparedUpdate, detectUpdateTarget, discardPreparedUpdate, prepareUpdate, type PreparedUpdate, type UpdateEnvironment } from './UpdateInstaller'
import { confirmUpdateStartup, pruneUpdateDownloads } from './UpdateRetention'
import type { UpdateConfig, UpdateStatus } from '../../shared/control'

function validate(value: unknown): asserts value is UpdateConfig {
  const config = value as UpdateConfig
  if (!config || Object.keys(config).some(key => !['repository', 'channel', 'automatic'].includes(key)) || typeof config.repository !== 'string' || config.repository !== '' && !/^[\w.-]+\/[\w.-]+$/.test(config.repository) || !['stable', 'preview'].includes(config.channel) || typeof config.automatic !== 'boolean') throw new Error('Use a GitHub owner/repository and stable or preview channel')
}
export interface UpdateServiceOptions { requestQuit?: () => void; currentVersion?: string }

/** Local-owner updater. Remote and assistant controls expose status only. */
export class UpdateService {
  private readonly store: RecoveryStore<UpdateConfig>
  private readonly cache: string
  private readonly version: string
  private readonly shutdown = new AbortController()
  private config: UpdateConfig
  private current: UpdateStatus
  private checking?: Promise<UpdateStatus>
  private downloading?: Promise<UpdateStatus>
  private preparing?: Promise<void>
  private timer?: ReturnType<typeof setInterval>
  private candidate?: UpdateCandidate
  private filename?: string
  private prepared?: PreparedUpdate
  private armed = false

  constructor(directory: string, private readonly options: UpdateServiceOptions = {}) {
    this.version = options.currentVersion ?? app.getVersion()
    this.store = new RecoveryStore({ filename: path.join(directory, 'updates.json'), validate })
    const saved = this.store.read()
    // Migrate the earlier empty default without enabling background activity.
    this.config = { ...(saved ?? { repository: UPDATE_REPOSITORY, channel: 'stable', automatic: false }), repository: saved?.repository || UPDATE_REPOSITORY }
    this.cache = path.join(directory, 'update-cache')
    this.current = { state: 'idle', configured: true, currentChannel: this.config.channel, currentVersion: this.version }
  }
  private environment(): UpdateEnvironment {
    return { platform: process.platform, arch: process.arch, version: this.version, isPackaged: app.isPackaged, executable: process.execPath, resources: process.resourcesPath, appImage: process.env.APPIMAGE }
  }
  status(): UpdateStatus { return { ...this.current, repository: this.config.repository, automatic: this.config.automatic } }
  configure(config: UpdateConfig): UpdateStatus {
    validate(config)
    if (this.checking || this.downloading || this.preparing || this.prepared || this.current.state === 'downloaded') throw new Error('Finish or restart the pending update before changing channels')
    const updated = { ...config, repository: config.repository || UPDATE_REPOSITORY }
    this.store.write(updated)
    this.config = updated
    this.candidate = undefined; this.filename = undefined
    this.current = { state: 'idle', configured: true, currentChannel: this.config.channel, currentVersion: this.version }
    this.start()
    return this.status()
  }
  check(): Promise<UpdateStatus> {
    if (this.checking) return this.checking
    if (this.downloading || this.preparing || this.prepared || this.current.state === 'downloaded') return Promise.resolve(this.status())
    const operation = this.checkInternal(); this.checking = operation
    void operation.finally(() => { if (this.checking === operation) this.checking = undefined }).catch(() => {})
    return operation
  }
  private async checkInternal(): Promise<UpdateStatus> {
    this.current = { state: 'checking', configured: true, currentChannel: this.config.channel, currentVersion: this.version }
    this.candidate = undefined; this.filename = undefined
    const signal = AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(30000)])
    try {
      const response = await fetch(`https://api.github.com/repos/${this.config.repository}/releases?per_page=100`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal, redirect: 'error' })
      if (!response.ok || !response.body) throw new Error(`GitHub releases are unavailable (HTTP ${response.status})`)
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 4 * 1024 * 1024) throw new Error('GitHub release catalog is too large')
          chunks.push(value)
        }
      } finally { await reader.cancel().catch(() => {}) }
      const release = parseReleases(JSON.parse(Buffer.concat(chunks).toString('utf8')), this.config.repository, this.version, this.config.channel)[0]
      signal.throwIfAborted()
      if (!release) {
        this.current = { ...this.current, state: 'current', version: this.version, messageCode: 'updates.current' }
        return this.status()
      }
      let target = detectUpdateTarget(this.environment())
      if (this.config.repository !== UPDATE_REPOSITORY) target = { ...target, canInstall: false, messageCode: 'updates.manualInstall' }
      this.candidate = await loadUpdateCandidate(release, this.config.repository, process.platform, process.arch, target.extension, signal)
      this.current = { ...this.current, state: 'available', version: release.version, releaseUrl: release.url, assetName: this.candidate.asset.name, canInstall: target.canInstall, installKind: target.kind, messageCode: target.messageCode ?? 'updates.readyToDownload' }
      if (this.config.automatic) await this.download()
    } catch (error) {
      this.current = { ...this.current, state: 'error', messageCode: 'updates.checkFailed', message: error instanceof Error ? error.message : 'Update check failed' }
    }
    return this.status()
  }
  download(): Promise<UpdateStatus> {
    if (this.downloading) return this.downloading
    if (this.current.state === 'downloaded') return Promise.resolve(this.status())
    if (this.current.state !== 'available' || !this.candidate) return Promise.reject(new Error('Check for an available update first'))
    const operation = this.downloadInternal(this.candidate); this.downloading = operation
    void operation.finally(() => { if (this.downloading === operation) this.downloading = undefined }).catch(() => {})
    return operation
  }
  private async downloadInternal(candidate: UpdateCandidate): Promise<UpdateStatus> {
    this.current = { ...this.current, state: 'downloading', progress: 0, message: undefined, messageCode: undefined }
    try {
      this.filename = await downloadUpdateAsset(candidate.asset, this.config.repository, this.cache, AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(30 * 60 * 1000)]), progress => { this.current = { ...this.current, progress } })
      this.current = { ...this.current, state: 'downloaded', progress: 100, messageCode: 'updates.downloadVerified' }
      try { pruneUpdateDownloads(this.cache, this.filename) } catch { /* Retention failure must not invalidate a verified download. */ }
      return this.status()
    } catch (error) {
      this.current = { ...this.current, state: 'available', progress: undefined, messageCode: 'updates.downloadFailed', message: error instanceof Error ? error.message : 'Update download failed' }
      throw error
    }
  }
  install(): Promise<void> {
    if (this.preparing) return this.preparing
    if (this.prepared) return Promise.resolve()
    if (this.current.state !== 'downloaded' || !this.candidate || !this.filename) return Promise.reject(new Error('No verified update is ready'))
    if (!this.current.canInstall || this.config.repository !== UPDATE_REPOSITORY || !this.options.requestQuit) return Promise.reject(new Error('Use the published package installer for this installation'))
    const operation = this.installInternal(this.candidate, this.filename); this.preparing = operation
    void operation.finally(() => { if (this.preparing === operation) this.preparing = undefined }).catch(() => {})
    return operation
  }
  private async installInternal(candidate: UpdateCandidate, filename: string): Promise<void> {
    this.current = { ...this.current, state: 'preparing', message: undefined, messageCode: 'updates.preparingInstall' }
    try {
      const target = detectUpdateTarget(this.environment())
      if (!target.canInstall || candidate.asset.name !== `ZIAForge-${candidate.release.version}-${process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux'}-${process.arch}.${target.extension}`) throw new Error('The installation changed; check for updates again')
      this.prepared = await prepareUpdate(candidate, filename, target, this.cache, this.shutdown.signal)
      this.current = { ...this.current, state: 'installing', messageCode: 'updates.installAfterQuit' }
      this.options.requestQuit!()
    } catch (error) {
      if (this.prepared) discardPreparedUpdate(this.prepared)
      this.prepared = undefined
      this.current = { ...this.current, state: 'downloaded', messageCode: 'updates.installFailed', message: error instanceof Error ? error.message : 'Update installation failed' }
      throw error
    }
  }
  async finalizeInstallAfterQuitCleanup(): Promise<void> {
    if (!this.prepared || this.armed) return
    try { await armPreparedUpdate(this.prepared); this.armed = true }
    catch (error) { this.cancelPendingInstall(); throw error }
  }
  cancelPendingInstall(): void {
    if (!this.prepared || this.armed) return
    discardPreparedUpdate(this.prepared)
    this.prepared = undefined
  }
  start(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    if (this.shutdown.signal.aborted) return
    if (app.isPackaged) {
      try { confirmUpdateStartup(this.cache, this.environment()) } catch { /* Retain unrecognized receipts. */ }
    }
    if (this.config.automatic) {
      void this.check()
      this.timer = setInterval(() => { if (!['downloading', 'downloaded', 'preparing', 'installing'].includes(this.current.state)) void this.check() }, 6 * 60 * 60 * 1000)
      this.timer.unref()
    }
  }
  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    this.shutdown.abort()
    await Promise.allSettled([this.checking, this.downloading, this.preparing].filter(Boolean))
    // Only this process's explicit install request reaches the final Quit hook.
    // Restart never treats a persisted stage as permission to install.
  }
}
