import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Expand, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useTranslation } from '../../i18n'

interface ImageViewerProps {
  url: string
  width: number
  height: number
  onClose: () => void
  onError: () => void
}
interface Drag { id: number; x: number; y: number; left: number; top: number }
const control = 'flex h-9 min-w-9 items-center justify-center rounded-lg border border-zinc-700 px-2 text-xs hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-40'

/** Displays an already authenticated preview. URL custody stays with GeneratedMedia. */
export function ImageViewer({ url, width, height, onClose, onError }: ImageViewerProps) {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)
  const [size, setSize] = useState({ width: Math.max(1, window.innerWidth - 48), height: Math.max(1, window.innerHeight - 160) })
  const [zoom, setZoom] = useState<number | null>(null)
  const fit = Math.min(1, Math.max(1, size.width - 32) / width, Math.max(1, size.height - 32) / height)
  const scale = zoom ?? fit
  const minimum = Math.min(0.1, fit)
  const canPan = width * scale > size.width || height * scale > size.height
  const setScale = (value: number | null) => { drag.current = null; setDragging(false); setZoom(value === null ? null : Math.min(8, Math.max(minimum, value))) }

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) closeButton.current?.focus()
    }
    document.addEventListener('focusin', keepFocus)
    return () => {
      drag.current = null
      document.removeEventListener('focusin', keepFocus)
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const measure = () => {
      const node = viewport.current
      if (node?.clientWidth && node.clientHeight) setSize({ width: node.clientWidth, height: node.clientHeight })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (viewport.current) observer?.observe(viewport.current)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  useEffect(() => {
    const node = viewport.current
    if (node) {
      node.scrollLeft = Math.max(0, (width * scale - size.width) / 2)
      node.scrollTop = Math.max(0, (height * scale - size.height) / 2)
    }
  }, [scale, size.width, size.height, width, height])

  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setScale(scale * 1.25); return }
    if (event.key === '-') { event.preventDefault(); setScale(scale / 1.25); return }
    if (event.key === '0') { event.preventDefault(); setScale(null); return }
    if (event.key === '1') { event.preventDefault(); setScale(1); return }
    if (event.key !== 'Tab') return
    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return createPortal(<div data-testid="image-viewer-backdrop" className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 p-2 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={t('image_viewer_title')} data-testid="image-viewer" className="flex h-[calc(100dvh-16px)] w-full max-w-[1600px] flex-col overflow-hidden rounded-xl border border-[#383a40] bg-[#111317] text-zinc-200 shadow-2xl sm:h-[calc(100dvh-48px)]" onKeyDown={keyboard}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 p-3">
        <div className="min-w-0"><h2 className="text-sm font-medium">{t('image_viewer_title')}</h2><p className="text-xs text-zinc-500">{width} × {height}</p></div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" data-testid="image-viewer-zoom-out" className={control} aria-label={t('image_viewer_zoom_out')} title={t('image_viewer_zoom_out')} disabled={scale <= minimum} onClick={() => setScale(scale / 1.25)}><ZoomOut aria-hidden="true" className="h-4 w-4" /></button>
          <span data-testid="image-viewer-scale" className="w-14 text-center text-xs tabular-nums" aria-live="polite">{Math.round(scale * 100)}%</span>
          <button type="button" data-testid="image-viewer-zoom-in" className={control} aria-label={t('image_viewer_zoom_in')} title={t('image_viewer_zoom_in')} disabled={scale >= 8} onClick={() => setScale(scale * 1.25)}><ZoomIn aria-hidden="true" className="h-4 w-4" /></button>
          <button type="button" data-testid="image-viewer-actual-size" className={control} aria-label={t('image_viewer_actual_size')} title={t('image_viewer_actual_size')} onClick={() => setScale(1)}>100%</button>
          <button type="button" data-testid="image-viewer-fit" className={control} aria-label={t('image_viewer_fit')} title={t('image_viewer_fit')} onClick={() => setScale(null)}><Expand aria-hidden="true" className="h-4 w-4" /></button>
          <button ref={closeButton} type="button" data-testid="image-viewer-close" className={`${control} ml-1`} aria-label={t('image_viewer_close')} title={t('image_viewer_close')} onClick={onClose}><X aria-hidden="true" className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={viewport} tabIndex={0} data-testid="image-viewer-viewport" aria-label={t('image_viewer_hint')} className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[#090a0c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500" style={{ cursor: canPan ? dragging ? 'grabbing' : 'grab' : 'default' }} onPointerDown={event => {
        if (!canPan || event.button !== 0 || event.pointerType === 'touch') return
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }
        setDragging(true)
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }} onPointerMove={event => {
        const start = drag.current
        if (!start || start.id !== event.pointerId) return
        event.currentTarget.scrollLeft = start.left + start.x - event.clientX
        event.currentTarget.scrollTop = start.top + start.y - event.clientY
      }} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}>
        <div className="flex items-center justify-center p-4" style={{ width: Math.max(size.width, width * scale + 32), height: Math.max(size.height, height * scale + 32) }}>
          <img data-testid="image-viewer-image" src={url} alt={t('image_viewer_title')} width={width} height={height} draggable={false} decoding="async" onError={onError} className="pointer-events-none max-w-none shrink-0 select-none object-contain" style={{ width: width * scale, height: height * scale }} />
        </div>
      </div>
      <p className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">{t('image_viewer_hint')}</p>
    </div>
  </div>, document.body)
}
