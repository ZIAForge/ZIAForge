import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, RefreshCw, Save, Settings2 } from 'lucide-react'
import type { UpdateStatus, UpdateConfig } from '../../../shared/control'
import { useStore } from '../../store'
import { useTranslation } from '../../i18n'
import { uiText } from '../../uiText'
import { statusLabel } from './localizedLabels'

const defaultConfig: UpdateConfig = { repository: 'ZIAForge/ZIAForge', channel: 'stable', automatic: false }
const activeStates = new Set<UpdateStatus['state']>(['checking', 'downloading', 'preparing', 'installing'])
const buttonClass = 'zf-control inline-flex items-center justify-center gap-2 border border-zinc-700 px-4 py-2 text-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50'

export function UpdatesPanel() {
  const { t, formatNumber } = useTranslation()
  const appVersion = useStore(state => state.appVersion)
  const remote = Boolean((window as Window & { ziafRemote?: boolean }).ziafRemote)
  const [status, setStatus] = useState<UpdateStatus>()
  const [config, setConfig] = useState<UpdateConfig>(defaultConfig)
  const [savedConfig, setSavedConfig] = useState<UpdateConfig>(defaultConfig)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const actionPending = useRef(false)
  const generation = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (remote) return () => { mounted.current = false }
    let stopped = false
    let polling = false
    const refresh = async (initial = false) => {
      if (polling) return
      polling = true
      const requestedGeneration = generation.current
      try {
        const next = await window.ziafAPI.updates.status()
        if (stopped || requestedGeneration !== generation.current) return
        setStatus(next)
        if (initial) {
          const current = { repository: next.repository || defaultConfig.repository, channel: next.currentChannel, automatic: next.automatic ?? false }
          setConfig(current)
          setSavedConfig(current)
        }
      } catch (failure) {
        if (!stopped && requestedGeneration === generation.current && initial) setError(failure instanceof Error ? failure.message : String(failure))
      } finally { polling = false }
    }
    void refresh(true)
    const timer = setInterval(() => { void refresh() }, 1500)
    return () => { stopped = true; mounted.current = false; clearInterval(timer) }
  }, [remote])

  const action = async (run: () => Promise<void>) => {
    if (remote || actionPending.current) return
    actionPending.current = true
    generation.current += 1
    setBusy(true)
    setError('')
    try { await run() }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure)) }
    finally {
      generation.current += 1
      actionPending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const acceptStatus = (next: UpdateStatus) => { if (mounted.current) setStatus(next) }
  const install = async () => {
    await window.ziafAPI.updates.install()
    if (mounted.current) setStatus(current => current ? { ...current, state: 'installing', messageCode: 'updates.installAfterQuit' } : current)
  }
  const update = async () => {
    const downloaded = await window.ziafAPI.updates.download()
    acceptStatus(downloaded)
    // A resolved IPC call may still report failure or a manual-only package.
    if (downloaded.state === 'downloaded' && downloaded.canInstall === true) await install()
  }
  const dirty = config.repository.trim() !== savedConfig.repository || config.channel !== savedConfig.channel || config.automatic !== savedConfig.automatic
  const unavailable = remote || busy || (!status && !error) || Boolean(status && activeStates.has(status.state))
  const canInstall = status?.canInstall === true
  const progress = typeof status?.progress === 'number' && Number.isFinite(status.progress) ? Math.max(0, Math.min(100, status.progress)) : undefined
  const stateText = !status ? uiText('Loading…') : status.state === 'current' ? uiText('Up to date') : status.state === 'preparing' ? t('updates.preparing') : status.state === 'installing' ? t('updates.installing') : statusLabel(status.state)
  const failure = error || (status?.state === 'error' ? status.message : '')
  const manual = status?.canInstall === false

  return <section className="max-w-3xl space-y-5" data-testid="updates-settings">
    <div className="zf-surface space-y-4 border border-zinc-800 bg-[#15171a] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Download size={20} className="text-orange-400" />{uiText('Updates')}</h2>
        <button type="button" className={buttonClass} disabled={unavailable || dirty} onClick={() => void action(async () => { acceptStatus(await window.ziafAPI.updates.check()) })}>
          <RefreshCw size={16} className={status?.state === 'checking' ? 'animate-spin' : ''} />{t('updates.check')}
        </button>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-zinc-400">{t('updates.installedVersion')}</dt><dd className="mt-1 font-mono" dir="ltr">{status?.currentVersion || appVersion?.fullVersion || '—'}</dd></div>
        {status?.version && <div><dt className="text-zinc-400">{t('updates.availableVersion')}</dt><dd className="mt-1 font-mono" dir="ltr">{status.version}</dd></div>}
      </dl>
      {remote ? <p className="text-sm text-amber-200">{t('updates.localOnly')}</p> : <>
        <p role="status" aria-live="polite" className="text-sm text-zinc-300">{stateText}{status?.state === 'downloading' && progress !== undefined ? ` · ${formatNumber(progress, { maximumFractionDigits: 0 })}%` : ''}</p>
        {status?.state === 'downloading' && <progress aria-label={uiText('Downloading')} className="h-2 w-full accent-orange-500" max={100} value={progress} />}
        {manual && <p className="text-sm text-zinc-400">{t('updates.manualInstall')}</p>}
        {canInstall && (status?.state === 'available' || status?.state === 'downloaded') && <p className="text-sm text-zinc-400">{t('updates.installNotice')}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {status?.state === 'available' && canInstall && <button type="button" className={`${buttonClass} border-orange-500/50 bg-orange-600 text-white hover:bg-orange-500`} disabled={unavailable || dirty} onClick={() => void action(update)}>
            <Download size={16} />{t('updates.update')}
          </button>}
          {status?.state === 'downloaded' && canInstall && <button type="button" className={`${buttonClass} border-orange-500/50 bg-orange-600 text-white hover:bg-orange-500`} disabled={unavailable || dirty} onClick={() => void action(install)}>
            <RefreshCw size={16} />{uiText('Install and restart')}
          </button>}
          {status?.releaseUrl && <button type="button" className={buttonClass} disabled={busy} onClick={() => void action(async () => { await window.ziafAPI.openExternal(status.releaseUrl!) })}>
            <ExternalLink size={16} />{t('updates.release')}
          </button>}
        </div>
      </>}
      {failure && <p role="alert" className="break-words rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{uiText('Error')}: {failure}</p>}
    </div>
    <details className="zf-surface border border-zinc-800 p-4">
      <summary className="cursor-pointer text-sm font-medium"><Settings2 size={16} className="me-2 inline-block" />{t('updates.settings')}</summary>
      <fieldset disabled={unavailable || status?.state === 'downloaded'} className="mt-4 space-y-4 disabled:opacity-60">
        <label className="block text-sm">{uiText('GitHub owner/repository')}
          <input dir="ltr" className="zf-control mt-2 w-full border border-zinc-700 bg-zinc-950 p-3 text-sm" value={config.repository} placeholder="ZIAForge/ZIAForge" onChange={event => setConfig(current => ({ ...current, repository: event.target.value }))} />
        </label>
        <label className="block text-sm">{uiText('Channel')}
          <select className="zf-control ms-3 border border-zinc-700 bg-zinc-950 p-2" value={config.channel} onChange={event => setConfig(current => ({ ...current, channel: event.target.value as UpdateConfig['channel'] }))}>
            <option value="stable">{uiText('Stable')}</option><option value="preview">{uiText('Preview')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.automatic} onChange={event => setConfig(current => ({ ...current, automatic: event.target.checked }))} />{uiText('Automatically check and download')}</label>
        <p className="text-xs text-zinc-400">{t('updates.autoInstallNotice')}</p>
        <button type="button" className={buttonClass} disabled={!dirty || !config.repository.trim()} onClick={() => void action(async () => {
          const submitted = { ...config, repository: config.repository.trim() }
          const next = await window.ziafAPI.updates.configure(submitted)
          acceptStatus(next)
          if (next.state !== 'error' && mounted.current) { setConfig(submitted); setSavedConfig(submitted) }
        })}><Save size={16} />{uiText('Save settings')}</button>
      </fieldset>
      {dirty && status?.state === 'downloaded' && <button type="button" className={`${buttonClass} mt-3`} disabled={remote || busy} onClick={() => { setConfig(savedConfig); setError('') }}>{uiText('Cancel')}</button>}
    </details>
  </section>
}
