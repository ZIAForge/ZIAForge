import { useEffect, useRef, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { validArtifactRef, type AgentArtifactRef } from '../../../shared/agent-artifacts'
import type { AgentSessionRef } from '../../../shared/agent-session'
import { useTranslation } from '../../i18n'

export interface GeneratedArtifactsProps {
  artifacts: readonly AgentArtifactRef[]
  /** The current owner is needed to fence acknowledgements after switching or resuming a chat. */
  owner?: AgentSessionRef
  onSave?: (artifactId: string) => Promise<{ cancelled: boolean }>
}
interface SaveState { key: string; pending?: boolean; outcome?: 'saved' | 'cancelled'; error?: string }
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
function fileSize(bytes: number, locale: string): string {
  const units = ['B', 'KiB', 'MiB', 'GiB']
  const index = bytes === 0 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index ? 1 : 0 }).format(bytes / 1024 ** index)} ${units[index]}`
}

/** Download-only cards never turn an artifact's MIME or filename into executable markup. */
export function GeneratedArtifacts({ artifacts, owner, onSave }: GeneratedArtifactsProps) {
  const { t } = useTranslation()
  if (!artifacts.length) return null
  return <ul aria-label={t('files')} data-testid="generated-artifacts" className="space-y-2">
    {artifacts.map(artifact => <ArtifactCard key={artifact.id} artifact={artifact} owner={owner} onSave={onSave} />)}
  </ul>
}

function ArtifactCard({ artifact, owner, onSave }: { artifact: AgentArtifactRef; owner?: AgentSessionRef; onSave?: GeneratedArtifactsProps['onSave'] }) {
  const { t, language } = useTranslation()
  const valid = validArtifactRef(artifact)
  const identity = JSON.stringify([owner?.sessionId, owner?.runId, artifact.id, artifact.sourceRunId, artifact.filename, artifact.mime, artifact.bytes, artifact.sha256, artifact.providerFileId, artifact.revision, artifact.supersedesFileId])
  const currentKey = useRef(identity)
  currentKey.current = identity
  const mounted = useRef(false)
  const saving = useRef<{ key: string } | null>(null)
  const [saveState, setSaveState] = useState<SaveState>({ key: identity })
  const save = saveState.key === identity ? saveState : { key: identity }

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    setSaveState({ key: identity })
    return () => { if (saving.current?.key === identity) saving.current = null }
  }, [identity])

  const saveFile = async () => {
    if (!valid || !onSave || saving.current?.key === identity) return
    const operation = { key: identity }
    saving.current = operation
    setSaveState({ key: identity, pending: true })
    try {
      const result = await onSave(artifact.id)
      if (mounted.current && currentKey.current === identity && saving.current === operation) setSaveState({ key: identity, outcome: result.cancelled ? 'cancelled' : 'saved' })
    } catch (error) {
      if (mounted.current && currentKey.current === identity && saving.current === operation) setSaveState({ key: identity, error: errorText(error) })
    } finally { if (saving.current === operation) saving.current = null }
  }

  return <li data-testid={`generated-artifact-${artifact.id}`} className="rounded-lg border border-[#2b2e33] bg-[#111317] p-3 text-xs">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="flex items-start gap-2 font-medium text-zinc-200"><FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /><span className="break-words" data-testid={`artifact-name-${artifact.id}`}>{artifact.filename}</span></p>
        {valid && <p className="break-words text-zinc-400">{fileSize(artifact.bytes, language)} · {artifact.mime}</p>}
        {valid && artifact.revision !== undefined && <p data-testid={`artifact-revision-${artifact.id}`} className="text-zinc-400">{t('artifact_revision', { revision: artifact.revision })}</p>}
        {valid && artifact.supersedesFileId && <p data-testid={`artifact-supersedes-${artifact.id}`} className="break-all text-[10px] text-zinc-500">{t('artifact_supersedes', { fileId: artifact.supersedesFileId })}</p>}
      </div>
      <button type="button" data-testid={`generated-artifact-save-${artifact.id}`} disabled={!valid || !onSave || Boolean(save.pending)} onClick={() => void saveFile()} className="flex shrink-0 items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"><Download aria-hidden="true" className="h-3 w-3" />{t(save.pending ? 'saving' : 'save')}</button>
    </div>
    {!valid && <p role="alert" className="mt-2 text-rose-300">{t('artifact_unavailable')}</p>}
    {save.error && <div className="mt-2 text-rose-300"><p role="alert" className="break-words">{t('artifact_save_error', { error: save.error })}</p>{onSave && <button type="button" data-testid={`generated-artifact-retry-${artifact.id}`} disabled={Boolean(save.pending)} onClick={() => void saveFile()} className="mt-1 underline disabled:opacity-40">{t('retry')}</button>}</div>}
    {save.outcome && <p role="status" className="mt-2 text-zinc-400">{t(save.outcome === 'cancelled' ? 'artifact_save_cancelled' : 'file_saved')}</p>}
  </li>
}
