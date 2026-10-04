import { uiText } from '../../uiText'
import { useEffect, useRef, useState } from 'react'
import type { ReviewTeamPreset } from '../../../shared/review-team'
import { useStore } from '../../store'
import { ReviewTeamEditor } from './ReviewTeamEditor'
import { newReviewTeam } from './reviewTeamDraft'

export function ReviewTeamsSettings() {
  const { presets, settings } = useStore()
  const ru = (settings?.uiLanguage ?? settings?.language ?? 'en').startsWith('ru')
  const [teams, setTeams] = useState<ReviewTeamPreset[]>([])
  const [draft, setDraft] = useState<ReviewTeamPreset | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; void window.ziafAPI.reviewTeams.list().then(items => { if (mounted.current) setTeams(items) }).catch(failure => { if (mounted.current) setError(String(failure.message ?? failure)) }); return () => { mounted.current = false } }, [])
  const save = async () => {
    if (!draft || busy) return
    setBusy(true); setError('')
    try { const saved = await window.ziafAPI.reviewTeams.save({ team: draft }); if (mounted.current) { setTeams(items => [...items.filter(item => item.id !== saved.id), saved]); setDraft(saved) } }
    catch (failure) { if (mounted.current) setError(String(failure instanceof Error ? failure.message : failure)) }
    finally { if (mounted.current) setBusy(false) }
  }
  const remove = async (id: string) => {
    if (busy) return
    setBusy(true); setError('')
    try { await window.ziafAPI.reviewTeams.remove({ id }); if (mounted.current) { setTeams(items => items.filter(item => item.id !== id)); setDraft(previous => previous?.id === id ? null : previous) } }
    catch (failure) { if (mounted.current) setError(String(failure instanceof Error ? failure.message : failure)) }
    finally { if (mounted.current) setBusy(false) }
  }
  return <section className="space-y-3" data-testid="review-teams-settings"><h3 className="text-sm font-medium">{uiText("Review teams", undefined, (ru) ? 'ru' : undefined)}</h3>
    <p className="text-xs text-zinc-400">{uiText("A saved team is copied into the plan. Later team or preset edits do not change an already saved plan.", undefined, (ru) ? 'ru' : undefined)}</p>
    <div className="flex flex-wrap gap-2">{teams.map(team => <button key={team.id} type="button" className="rounded border border-zinc-700 p-2 text-xs" disabled={busy} onClick={() => { setDraft(structuredClone(team)); setError('') }}>{team.name}</button>)}<button type="button" className="rounded border border-zinc-700 p-2 text-xs" disabled={busy} onClick={() => { setDraft(newReviewTeam()); setError('') }}>{uiText("New team", undefined, (ru) ? 'ru' : undefined)}</button></div>
    {draft && <><ReviewTeamEditor value={draft} onChange={setDraft} presets={presets} disabled={busy} ru={ru} /><div className="flex gap-2"><button type="button" disabled={busy} className="rounded bg-orange-600 px-3 py-2 text-xs" onClick={() => void save()}>{uiText("Save team", undefined, (ru) ? 'ru' : undefined)}</button><button type="button" disabled={busy || !teams.some(team => team.id === draft.id)} className="rounded border border-zinc-700 px-3 py-2 text-xs" onClick={() => void remove(draft.id)}>{uiText("Delete", undefined, (ru) ? 'ru' : undefined)}</button></div></>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </section>
}
