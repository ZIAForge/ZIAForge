import { statusLabel } from './localizedLabels'
import { formatDate } from '../../i18n-core'
import { uiText, currentLocale } from '../../uiText'
import { useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import type { GitOperationReceipt, GitStatus } from '../../../shared/git'
import { useStore, type Task } from '../../store'

const input = 'w-full rounded border border-zinc-700 bg-[#111317] p-2 text-xs text-zinc-100'
const button = 'rounded border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800 disabled:opacity-40'

/** Every displayed revision and result comes from the task-bound Git service. */
export function GitPanel({ task, onClose }: { task: Task; onClose(): void }) {
  const settings = useStore(state => state.settings)
  const ru = (settings?.uiLanguage || settings?.language || 'en').startsWith('ru')
  const label = (en: string, russian: string) => { void russian; return uiText(en, undefined, ru ? 'ru' : undefined) }
  const [status, setStatus] = useState<GitStatus>()
  const [selected, setSelected] = useState<string[]>([])
  const [scope, setScope] = useState<'working' | 'staged' | 'base'>('working')
  const [diff, setDiff] = useState('')
  const [message, setMessage] = useState('')
  const [remote, setRemote] = useState('origin')
  const [target, setTarget] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState<'push' | 'merge' | 'remove' | null>(null)
  const generation = useRef(0)
  const work = task.mode === 'work' || task.branchType === 'Folder'
  const load = async (token = generation.current) => {
    const next = await window.ziafAPI.git.status({ taskId: task.id })
    if (token !== generation.current) return
    setStatus(next)
    setSelected(previous => previous.filter(name => next.changes.some(change => change.path === name)))
    setTarget(previous => previous || next.baseBranch)
    setRemote(previous => next.remotes?.includes(previous) ? previous : next.remotes?.[0] || '')
  }
  useEffect(() => {
    const token = ++generation.current
    setStatus(undefined); setSelected([]); setDiff(''); setError(''); setProposal(null); setTarget(''); setMessage('')
    if (!work) {
      setPending(true)
      void window.ziafAPI.git.prepare({ taskId: task.id }).then(() => load(token))
        .catch(failure => { if (generation.current === token) setError(String(failure.message ?? failure)) })
        .finally(() => { if (generation.current === token) setPending(false) })
    }
    return () => { generation.current = token + 1 }
    // Each task owns its panel state and in-flight responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, work])
  const run = async (action: () => Promise<GitOperationReceipt | void>) => {
    if (pending) return
    const token = generation.current
    setPending(true); setError('')
    try {
      const receipt = await action()
      if (token !== generation.current) return
      if (receipt && receipt.status !== 'succeeded') setError(receipt.error || receipt.stderr || receipt.status)
      setProposal(null)
      await load(token)
    } catch (failure) { if (token === generation.current) setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { if (token === generation.current) setPending(false) }
  }
  const preview = async (nextScope: typeof scope, file?: string) => {
    setScope(nextScope)
    const token = generation.current
    await run(async () => {
      const result = await window.ziafAPI.git.diff({ taskId: task.id, scope: nextScope, ...(file ? { path: file } : {}) })
      if (token === generation.current) setDiff(result.text + (result.truncated ? '\n[truncated]' : ''))
    })
  }
  const perform = async () => {
    if (!status) return
    const base = { taskId: task.id, operationId: crypto.randomUUID(), expectedHead: status.head }
    if (proposal === 'push') await run(() => window.ziafAPI.git.push({ ...base, remote }))
    if (proposal === 'merge') {
      const branch = status.branches?.find(item => item.name === target)
      if (branch) await run(() => window.ziafAPI.git.merge({ ...base, targetBranch: branch.name, expectedTargetHead: branch.head }))
    }
    if (proposal === 'remove') await run(() => window.ziafAPI.git.removeWorktree({ ...base, expectedStatusFingerprint: status.fingerprint }))
  }
  return <section className="flex min-h-0 flex-1 flex-col text-zinc-200" data-testid="git-panel">
    <header className="flex items-center justify-between border-b border-zinc-800 p-3"><strong className="text-sm">Git</strong><div className="flex gap-3"><button aria-label={label('Refresh Git', 'Обновить Git')} disabled={pending || work} onClick={() => void run(() => load())}><RefreshCw size={14} className={pending ? 'animate-spin' : ''} /></button><button onClick={onClose} aria-label={label('Close Git', 'Закрыть Git')}><X size={14} /></button></div></header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {work && <p className="text-xs text-zinc-400">{label('Work mode stores artifacts in a folder without Git.', 'В режиме Work артефакты хранятся в папке без Git.')}</p>}
      {error && <p role="alert" className="break-words text-xs text-rose-300">{error}</p>}
      {status && <>
        <p className="break-all font-mono text-xs" data-testid="git-branch">{status.branch} · {status.head.slice(0, 10)}<br /><span className="text-zinc-500">{status.mode} · {status.cwd}</span></p>
        <p className="text-xs text-zinc-400">{status.removed ? label('Worktree removed; branch and receipt retained.', 'Рабочая копия удалена; ветка и квитанция сохранены.') : status.clean ? label('Working tree is clean', 'Нет незакоммиченных изменений') : `${status.changes.length} ${label('changed files', 'изменённых файлов')}`}</p>
        {status.conflicts.length > 0 && <p className="text-xs text-amber-300">{label('Resolve conflicts:', 'Разрешите конфликты:')} {status.conflicts.join(', ')}</p>}
        {!status.removed && <>
          <div className="flex flex-wrap gap-2">{(['working', 'staged', 'base'] as const).map(value => <button key={value} className={`${button} ${scope === value ? 'border-orange-600' : ''}`} disabled={pending} onClick={() => void preview(value)}>{label({ working: 'Changes', staged: 'Staged', base: 'Against base' }[value], { working: 'Изменения', staged: 'Индекс', base: 'Относительно базы' }[value])}</button>)}</div>
          {diff && <pre data-testid="git-diff" className="max-h-72 overflow-auto whitespace-pre rounded bg-black/30 p-2 text-[10px]">{diff}</pre>}
          <div className="space-y-1">{status.changes.map(change => <div className="flex items-center justify-between gap-2 text-xs" key={change.path}><label className="flex min-w-0 items-center gap-2 break-all"><input type="checkbox" disabled={pending} checked={selected.includes(change.path)} onChange={event => setSelected(previous => event.target.checked ? [...previous, change.path] : previous.filter(name => name !== change.path))} /><span className="font-mono text-amber-300">{change.index}{change.worktree}</span>{change.path}</label><button aria-label={`${uiText("View file")} ${change.path}`} disabled={pending} className="shrink-0 text-orange-400" onClick={() => void preview(scope, change.path)}>diff</button></div>)}</div>
          <input className={input} data-testid="git-commit-message" disabled={pending} value={message} onChange={event => setMessage(event.target.value)} placeholder={label('Commit message', 'Сообщение коммита')} />
          <button className={button} data-testid="git-commit" disabled={pending || !selected.length || !message.trim() || !!status.conflicts.length} onClick={() => void run(async () => {
            const receipt = await window.ziafAPI.git.commit({ taskId: task.id, operationId: crypto.randomUUID(), expectedHead: status.head, expectedStatusFingerprint: status.fingerprint, paths: selected, message: message.trim() })
            if (receipt.status === 'succeeded') setMessage('')
            return receipt
          })}>{label('Commit selected files', 'Коммит выбранных файлов')}</button>
          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <label className="block text-xs">{label('Remote', 'Удалённый репозиторий')}<select className={input} value={remote} disabled={pending} onChange={event => { setRemote(event.target.value); setProposal(null) }}><option value="">—</option>{status.remotes?.map(name => <option key={name}>{name}</option>)}</select></label>
            <button className={button} disabled={pending || !remote} onClick={() => setProposal('push')}>{uiText("Push")}</button>
            <label className="block text-xs">{label('Merge into branch', 'Слить в ветку')}<select className={input} disabled={pending} value={target} onChange={event => { setTarget(event.target.value); setProposal(null) }}><option value="">—</option>{status.branches?.filter(item => item.name !== status.branch).map(item => <option key={item.name} value={item.name}>{item.name} · {item.head.slice(0, 10)}</option>)}</select></label>
            <button className={button} disabled={pending || !status.clean || !target || target === status.branch} onClick={() => setProposal('merge')}>{label('Review merge', 'Подтвердить слияние')}</button>
            {status.mode === 'worktree' && <button className={`${button} ml-2 text-amber-300`} disabled={pending || !status.clean} onClick={() => setProposal('remove')}>{label('Remove clean worktree', 'Удалить чистую рабочую копию')}</button>}
          </div>
          {proposal && <div className="space-y-2 rounded border border-amber-700 p-3 text-xs" data-testid="git-proposal"><p>{proposal === 'push' ? `${status.branch}@${status.head.slice(0, 10)} → ${remote}` : proposal === 'merge' ? `${status.branch}@${status.head.slice(0, 10)} → ${target}@${status.branches?.find(item => item.name === target)?.head.slice(0, 10)}` : `${label('Remove folder', 'Удалить папку')}: ${status.cwd}`}</p><button className={button} disabled={pending} onClick={() => void perform()}>{label('Confirm', 'Подтвердить')}</button><button className={`${button} ml-2`} disabled={pending} onClick={() => setProposal(null)}>{label('Cancel', 'Отмена')}</button></div>}
        </>}
        <div className="space-y-2 border-t border-zinc-800 pt-3"><strong className="text-xs">{label('Operation receipts', 'Результаты операций')}</strong>{status.receipts.map(receipt => <details key={receipt.operationId} className="rounded bg-black/20 p-2 text-[10px]"><summary>{statusLabel(receipt.kind, ru)} · {statusLabel(receipt.status, ru)} · {formatDate(currentLocale(), receipt.startedAt)}</summary><pre className="whitespace-pre-wrap break-all">{[receipt.afterHead, receipt.targetPath, receipt.recoveryRef, receipt.error, receipt.stdout, receipt.stderr].filter(Boolean).join('\n')}</pre></details>)}</div>
      </>}
    </div>
  </section>
}
