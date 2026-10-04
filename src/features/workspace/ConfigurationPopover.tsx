import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'

/** Portal positioning keeps Composer menus above scroll/overflow boundaries. */
export function ConfigurationPopover({ anchor, label, onClose, children, width = 340, testId }: {
  anchor: RefObject<HTMLElement | null>; label: string; onClose: (restoreFocus?: boolean) => void
  children: ReactNode; width?: number; testId?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const focusedOnOpen = useRef(false)
  const close = useRef(onClose)
  close.current = onClose
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 480, ready: false })
  useLayoutEffect(() => {
    const place = () => {
      const trigger = anchor.current?.getBoundingClientRect()
      const menu = panel.current
      if (!trigger || !menu) return
      const left = Math.max(8, Math.min(trigger.left, window.innerWidth - menu.offsetWidth - 8))
      const above = trigger.top - 16
      const below = window.innerHeight - trigger.bottom - 16
      const openBelow = above < 160 && below > above
      const maxHeight = Math.max(80, openBelow ? below : above)
      setPosition({ left, top: openBelow ? trigger.bottom + 8 : Math.max(8, trigger.top - Math.min(menu.offsetHeight, maxHeight) - 8), maxHeight, ready: true })
    }
    place()
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) close.current(false)
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    if (panel.current) observer?.observe(panel.current)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      observer?.disconnect()
    }
  }, [anchor])
  useLayoutEffect(() => {
    if (!position.ready || focusedOnOpen.current) return
    const menu = panel.current
    if (!menu) return
    // Positioning first commits visibility; browsers refuse focus while hidden.
    // This mount owns only its opening focus, never later catalog/resize updates.
    focusedOnOpen.current = true
    const target = menu.querySelector<HTMLElement>(focusable) || menu
    target.focus({ preventScroll: true })
  }, [position.ready])
  return createPortal(<div ref={panel} tabIndex={-1} role="dialog" aria-label={label} data-testid={testId}
    style={{ position: 'fixed', left: position.left, top: position.top, width, maxWidth: 'calc(100vw - 16px)', maxHeight: position.maxHeight, visibility: position.ready ? 'visible' : 'hidden', zIndex: 100 }}
    className="overflow-y-auto rounded-lg border border-[#36383e] bg-[#18191d] p-2 text-xs text-zinc-200 shadow-[0_14px_48px_#0009]"
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(true); return }
      const items = [...(panel.current?.querySelectorAll<HTMLElement>(focusable) || [])]
      const index = items.indexOf(document.activeElement as HTMLElement)
      if (event.key === 'Tab' && items.length && (event.shiftKey ? index <= 0 : index === items.length - 1)) {
        event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus()
      }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (event.target as HTMLElement).getAttribute('role')?.startsWith('menuitem')) {
        event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }
    }}>{children}</div>, document.body)
}
