import React from 'react'
import { FileText, X } from 'lucide-react'

export interface ComposerAttachment {
  id: string
  name: string
  path?: string
  size?: number
  content?: string
}

export interface ComposerAttachmentsProps {
  attachments: ComposerAttachment[]
  disabled?: boolean
  onRemoveAttachment: (attachmentId: string) => void
}

export const ComposerAttachments: React.FC<ComposerAttachmentsProps> = ({
  attachments,
  disabled = false,
  onRemoveAttachment,
}) => {
  if (attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-1" data-testid="composer-attachments-list">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#16181b] border border-[#2b2e33] text-zinc-300 text-xs font-medium"
          data-testid={`attachment-chip-${att.id}`}
        >
          <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="truncate max-w-[200px]" title={att.name}>
            {att.name}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemoveAttachment(att.id)}
            className="p-0.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 disabled:hover:text-zinc-500 disabled:cursor-not-allowed transition-colors cursor-pointer"
            data-testid={`remove-attachment-${att.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

export const MemoComposerAttachments = React.memo(ComposerAttachments)
