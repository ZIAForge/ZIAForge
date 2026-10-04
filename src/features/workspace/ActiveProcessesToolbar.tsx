import React from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { uiText } from '../../uiText'

export interface ActiveProcessItem {
  id: string
  name: string
  pid?: number
  command?: string
}

export interface ActiveProcessesToolbarProps {
  activeProcesses: ActiveProcessItem[]
  disabled?: boolean
  onKillProcess?: (processId: string, pid?: number) => void
}

export const ActiveProcessesToolbar: React.FC<ActiveProcessesToolbarProps> = ({
  activeProcesses,
  disabled = false,
  onKillProcess,
}) => {
  const { t } = useTranslation()

  if (activeProcesses.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-[#0c0d0e] border border-[#1e2024] rounded-lg text-xs" data-testid="active-processes-toolbar">
      <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
        {uiText('Active processes')}:
      </span>
      {activeProcesses.map((proc) => (
        <div
          key={proc.id}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#16181b] border border-[#2b2e33] text-zinc-300"
        >
          <span className="font-mono text-[11px] truncate max-w-xs">{proc.name}</span>
          {onKillProcess && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onKillProcess(proc.id, proc.pid)}
              className="p-0.5 text-zinc-500 hover:text-rose-400 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title={t('stop') || 'Остановить'}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export const MemoActiveProcessesToolbar = React.memo(ActiveProcessesToolbar)
