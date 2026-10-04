import React, { useState, useEffect, useRef } from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { useTranslation } from '../../i18n'
import type {
  ReconstructedApprovalItem,
  ApprovalState,
} from '../../../shared/agent-events'

export interface ApprovalCardProps {
  approval: ReconstructedApprovalItem
  onResolveApproval?: (
    approvalId: string,
    decision: 'allow' | 'deny'
  ) => void | Promise<void>
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  approval,
  onResolveApproval,
}) => {
  const { t } = useTranslation()
  const [isLocalSubmitting, setIsLocalSubmitting] = useState<boolean>(false)
  const [hasLocalDecision, setHasLocalDecision] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const prevServerStateRef = useRef<ApprovalState>(approval.state)
  const attemptIdRef = useRef<number>(0)

  // If server rolls back from submitting to pending (e.g. transient RPC failure), reset local decision guard
  useEffect(() => {
    if (prevServerStateRef.current === 'submitting' && approval.state === 'pending') {
      setHasLocalDecision(false)
      setIsLocalSubmitting(false)
    }
    prevServerStateRef.current = approval.state
  }, [approval.state])

  const isRiskHigh =
    approval.riskLevel === 'high' || approval.riskLevel === 'critical'
  const isResolved = approval.state === 'resolved'
  const isExpired = approval.state === 'expired'
  const isTerminal = isResolved || isExpired

  // Terminal status unconditionally takes precedence over submitting
  const isSubmitting = !isTerminal && (approval.state === 'submitting' || isLocalSubmitting)
  const isPending = !isTerminal && approval.state === 'pending'

  const handleDecision = async (decision: 'allow' | 'deny') => {
    if (!onResolveApproval || isSubmitting || isTerminal || hasLocalDecision) return
    const currentAttemptId = ++attemptIdRef.current
    setIsLocalSubmitting(true)
    setHasLocalDecision(true)
    setSubmitError(null)

    try {
      await Promise.resolve(onResolveApproval(approval.approvalId, decision))
    } catch (err) {
      if (attemptIdRef.current !== currentAttemptId) return
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(msg)
      setHasLocalDecision(false)
    } finally {
      if (attemptIdRef.current === currentAttemptId) {
        setIsLocalSubmitting(false)
      }
    }
  }

  const getRiskLabel = (level?: string) => {
    if (!level) return ''
    const key = `risk_${level.toLowerCase()}`
    const translated = t(key)
    return translated && translated !== key ? translated : level.toUpperCase()
  }

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-3 shadow-md ${
        isResolved
          ? approval.decision === 'allow'
            ? 'border-emerald-500/20 bg-emerald-950/10'
            : 'border-rose-500/20 bg-rose-950/10'
          : isExpired
          ? 'border-zinc-800 bg-zinc-900/20 opacity-60'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}
      data-testid={`approval-card-${approval.approvalId}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          {isRiskHigh ? (
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          <span className={isRiskHigh ? 'text-rose-300' : 'text-amber-300'}>
            {t('permission_requested') || 'Требуется подтверждение действия'}
          </span>
        </div>

        {approval.riskLevel && (
          <span
            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
              isRiskHigh
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {getRiskLabel(approval.riskLevel)}
          </span>
        )}
      </div>

      {approval.description && (
        <p className="text-xs text-zinc-300 font-medium">
          {approval.description}
        </p>
      )}

      {approval.command && (
        <pre className="font-mono text-[11px] text-zinc-300 bg-[#0d0e11] p-2.5 rounded-lg border border-[#1e2024] select-all whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
          {approval.command}
        </pre>
      )}

      {/* Submit Error Message if any */}
      {submitError && (
        <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-500/30 rounded p-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Action buttons if pending */}
      {isPending && (
        <div className="flex items-center gap-2 pt-1 select-none">
          <button
            type="button"
            disabled={!onResolveApproval || isSubmitting || hasLocalDecision}
            onClick={() => handleDecision('allow')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#ff6b00] hover:bg-[#ff8c3a] disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            data-testid={`approval-allow-${approval.approvalId}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{t('allow') || 'Разрешить'}</span>
          </button>

          <button
            type="button"
            disabled={!onResolveApproval || isSubmitting || hasLocalDecision}
            onClick={() => handleDecision('deny')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e2024] hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 border border-[#2b2e33] transition-all cursor-pointer flex items-center gap-1.5"
            data-testid={`approval-deny-${approval.approvalId}`}
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>{t('deny') || 'Отклонить'}</span>
          </button>
        </div>
      )}

      {/* Submitting state: shown only if not in terminal state */}
      {isSubmitting && (
        <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
          <Clock className="h-3.5 w-3.5 animate-spin" />
          <span>{t('submitting_decision') || 'Отправка решения...'}</span>
        </div>
      )}

      {/* Resolved state */}
      {isResolved && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          {approval.decision === 'allow' ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t('allowed') || 'Действие разрешено'}</span>
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              <span>{t('denied') || 'Действие отклонено'}</span>
            </span>
          )}
        </div>
      )}

      {/* Expired state */}
      {isExpired && (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{t('approval_expired') || 'Запрос устарел или пропущен'}</span>
        </div>
      )}
    </div>
  )
}

export const MemoApprovalCard = React.memo(ApprovalCard)
