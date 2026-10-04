import { uiText } from '../uiText'
import { memo, useState, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from '../i18n'
import './MarkdownMessage.css'

// Match the main process external-link policy. Model text must never navigate
// the app, execute HTML, or load remote images automatically.
function externalUrl(value: string): string | undefined {
  if (value.length > 8192 || [...value].some(char => char.charCodeAt(0) <= 32)) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password ? value : undefined
  } catch { return undefined }
}

function MarkdownLink({ href, children, title }: { href?: string; children?: ReactNode; title?: string }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  if (!href) return <span>{children}</span>
  return <><a href={href} title={title} rel="noopener noreferrer" onClick={async event => {
    event.preventDefault()
    setFailed(false)
    try { await window.ziafAPI.openExternal(href) } catch { setFailed(true) }
  }}>{children}</a>{failed && <span role="alert" className="block text-rose-300">{t('browser_preview_failed')}</span>}</>
}

const components: Components = {
  a: MarkdownLink,
  img: ({ alt }) => <span className="text-zinc-400">{alt || uiText("Image")}</span>,
  table: ({ children }) => <div className="markdown-table-scroll"><table>{children}</table></div>,
}
const plugins = [remarkGfm]

/** Parse only the displayed answer; keep original journal text and CLI logs intact. */
export const MarkdownMessage = memo(function MarkdownMessage({ text }: { text: string }) {
  return <div className="markdown-message" dir="auto"><Markdown remarkPlugins={plugins} components={components} urlTransform={externalUrl}>{text}</Markdown></div>
})
