import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { validMediaRef, type AgentMediaRef, type AgentMediaRequest } from '../../../shared/agent-media'
import { useTranslation } from '../../i18n'
import { uiText } from '../../uiText'
import { safeMediaBlob } from './generatedMediaData'
import { ImageViewer } from './ImageViewer'

export type AgentMediaOwner = Pick<AgentMediaRequest, 'sessionId' | 'runId'>
interface GeneratedMediaProps { media: AgentMediaRef; owner?: AgentMediaOwner; label?: string }
interface Preview { key: string; url?: string; error?: string }
interface SaveState { key: string; pending?: boolean; outcome?: 'saved' | 'cancelled'; error?: string }

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

export function GeneratedMedia({ media, owner, label }: GeneratedMediaProps) {
  const { t } = useTranslation()
  const valid = validMediaRef(media)
  const video = media.mime === 'video/mp4'
  const api = window.ziafAPI?.agentMedia
  const identity = JSON.stringify([owner?.sessionId, owner?.runId, media.id, media.sourceRunId, media.sha256, media.mime, media.bytes, media.width, media.height])
  const currentKey = useRef(identity)
  currentKey.current = identity
  const mounted = useRef(false)
  const container = useRef<HTMLElement>(null)
  const retainedURL = useRef<{ key: string; url: string } | null>(null)
  const saving = useRef<{ key: string } | null>(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  const [retry, setRetry] = useState(0)
  const [preview, setPreview] = useState<Preview>({ key: identity })
  const [saveState, setSaveState] = useState<SaveState>({ key: identity })
  const [viewer, setViewer] = useState<{ key: string; url: string } | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const current = preview.key === identity ? preview : { key: identity }
  const save = saveState.key === identity ? saveState : { key: identity }
  const viewerOpen = viewer?.key === identity && viewer.url === current.url
  const shouldLoad = visible || viewerOpen || playing === identity
  const unavailable = video ? t('video_unavailable') : uiText('Image unavailable')
  const mediaLabel = label ?? (video ? t('video_generated') : uiText('Generated image'))

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    setSaveState({ key: identity })
    setViewer(null)
    setPlaying(null)
    return () => { if (saving.current?.key === identity) saving.current = null }
  }, [identity])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(item => item.target === container.current)
      if (entry) setVisible(entry.isIntersecting)
    }, { rootMargin: '240px' })
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    let createdURL: string | undefined
    setPreview({ key: identity })
    if (!valid || !owner || !api?.read) {
      setPreview({ key: identity, error: video ? t('video_unavailable') : uiText('Image unavailable') })
      return
    }
    if (!shouldLoad) return
    const request: AgentMediaRequest = { sessionId: owner.sessionId, runId: owner.runId, mediaId: media.id }
    void (async () => {
      try {
        const result = await api.read(request)
        if (!active || currentKey.current !== identity) return
        const blob = safeMediaBlob(media, result)
        createdURL = URL.createObjectURL(blob)
        retainedURL.current = { key: identity, url: createdURL }
        setPreview({ key: identity, url: createdURL })
      } catch (error) {
        if (active && currentKey.current === identity) setPreview({ key: identity, error: video ? t('video_load_error', { error: errorText(error) }) : uiText('Could not load image: {error}', { error: errorText(error) }) })
      }
    })()
    return () => {
      active = false
      if (createdURL && retainedURL.current?.url === createdURL) {
        URL.revokeObjectURL(createdURL)
        retainedURL.current = null
      }
    }
  // The identity contains every primitive owner/ref field; new snapshot objects
  // for the same image must not reload bytes or revoke a visible preview.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, valid, api, shouldLoad, retry])

  const saveImage = async () => {
    if (!owner || !api?.save || !current.url || saving.current?.key === identity) return
    const operation = { key: identity }
    saving.current = operation
    setSaveState({ key: identity, pending: true })
    try {
      const result = await api.save({ sessionId: owner.sessionId, runId: owner.runId, mediaId: media.id })
      if (mounted.current && currentKey.current === identity && saving.current === operation) setSaveState({ key: identity, outcome: result.cancelled ? 'cancelled' : 'saved' })
    } catch (error) {
      if (mounted.current && currentKey.current === identity && saving.current === operation) setSaveState({ key: identity, error: video ? t('video_save_error', { error: errorText(error) }) : uiText('Could not save image: {error}', { error: errorText(error) }) })
    } finally { if (saving.current === operation) saving.current = null }
  }

  const imageFailed = (url: string) => {
    if (currentKey.current !== identity || retainedURL.current?.key !== identity || retainedURL.current.url !== url) return
    URL.revokeObjectURL(url)
    retainedURL.current = null
    setViewer(null)
    setPlaying(null)
    setPreview({ key: identity, error: video ? t('video_invalid') : uiText('Invalid generated image data') })
  }

  return <figure ref={container} data-testid={`generated-media-${media.id}`} className="max-w-xl space-y-2 rounded-lg border border-[#2b2e33] bg-[#111317] p-2">
    <div className="relative flex max-h-[32rem] w-full items-center justify-center overflow-hidden rounded bg-[#090a0c]" style={{ aspectRatio: valid ? `${media.width} / ${media.height}` : '4 / 3' }}>
      {current.url ? video
        ? <video key={current.url} data-testid={`generated-video-${media.id}`} src={current.url} aria-label={mediaLabel} width={media.width} height={media.height} controls playsInline preload="metadata" onPlay={() => setPlaying(identity)} onPause={() => setPlaying(value => value === identity ? null : value)} onEnded={() => setPlaying(value => value === identity ? null : value)} onError={() => imageFailed(current.url!)} className="h-full max-h-[32rem] w-full object-contain" />
        : <button type="button" data-testid={`generated-media-open-${media.id}`} aria-label={t('image_viewer_open')} onClick={() => setViewer({ key: identity, url: current.url! })} className="flex h-full w-full cursor-zoom-in items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"><img key={current.url} data-testid={`generated-image-${media.id}`} src={current.url} alt={mediaLabel} width={media.width} height={media.height} loading="lazy" decoding="async" onError={() => imageFailed(current.url!)} className="h-full w-full object-contain" /></button>
        : <span className="p-4 text-xs text-zinc-500">{current.error ? unavailable : uiText('Loading…')}</span>}
    </div>
    <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
      <span>{mediaLabel}</span>
      <button type="button" data-testid={`generated-media-save-${media.id}`} disabled={!current.url || !api?.save || Boolean(save.pending)} onClick={() => void saveImage()} className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800 disabled:opacity-40"><Download aria-hidden="true" className="h-3 w-3" />{save.pending ? t('saving') : video ? t('video_save') : uiText('Save image')}</button>
    </figcaption>
    {current.error && <div className="text-xs text-rose-300"><p role="alert" className="break-words">{current.error}</p>{valid && owner && api?.read && <button type="button" data-testid={`generated-media-retry-${media.id}`} onClick={() => setRetry(value => value + 1)} className="mt-1 underline">{t('retry')}</button>}</div>}
    {save.error && <p role="alert" className="break-words text-xs text-rose-300">{save.error}</p>}
    {save.outcome && <p role="status" className="text-xs text-zinc-400">{video ? t(save.outcome === 'cancelled' ? 'video_save_cancelled' : 'video_saved') : save.outcome === 'cancelled' ? uiText('Image save cancelled') : uiText('Image saved')}</p>}
    {!video && viewerOpen && current.url && <ImageViewer key={`${identity}:${current.url}`} url={current.url} width={media.width} height={media.height} onClose={() => setViewer(null)} onError={() => imageFailed(current.url!)} />}
  </figure>
}
