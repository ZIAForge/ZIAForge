/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react'
import { ApprovalCard, MemoApprovalCard } from '../ApprovalCard'
import { useStore } from '../../../store'
import type { ReconstructedApprovalItem } from '../../../../shared/agent-events'
import type { Settings } from '../../../store'

describe('ApprovalCard Component', () => {
  beforeEach(() => {
    useStore.setState({
      settings: {
        theme: 'dark',
        language: 'ru',
        uiLanguage: 'ru',
        defaultIDE: 'cursor',
        autoArchive: 'never',
        soundAlerts: false,
        soundType: 'default',
        desktopNotifications: false,
        launchAtLogin: false,
        preventSleep: false,
      } as Settings,
    })
  })

  afterEach(() => {
    cleanup()
  })

  const baseApproval: ReconstructedApprovalItem = {
    approvalId: 'appr-42',
    toolCallId: 'call-bash-1',
    description: 'Execute dangerous terminal command rm -rf /tmp/cache',
    command: 'rm -rf /tmp/cache',
    riskLevel: 'high',
    state: 'pending',
  }

  it('renders pending approval card with command and action buttons', () => {
    render(<ApprovalCard approval={baseApproval} />)

    const card = screen.getByTestId('approval-card-appr-42')
    expect(card).not.toBeNull()
    expect(screen.getByText('Execute dangerous terminal command rm -rf /tmp/cache')).not.toBeNull()
    expect(screen.getByText('rm -rf /tmp/cache')).not.toBeNull()
    expect(screen.getByText(/ВЫСОКИЙ|HIGH/i)).not.toBeNull()

    const allowBtn = screen.getByTestId('approval-allow-appr-42')
    const denyBtn = screen.getByTestId('approval-deny-appr-42')
    expect(allowBtn).not.toBeNull()
    expect(denyBtn).not.toBeNull()
  })

  it('calls onResolveApproval with allow decision when allow button is clicked', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined)
    render(<ApprovalCard approval={baseApproval} onResolveApproval={onResolve} />)

    const allowBtn = screen.getByTestId('approval-allow-appr-42')
    await act(async () => {
      fireEvent.click(allowBtn)
    })

    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenCalledWith('appr-42', 'allow')
  })

  it('calls onResolveApproval with deny decision when deny button is clicked', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined)
    render(<ApprovalCard approval={baseApproval} onResolveApproval={onResolve} />)

    const denyBtn = screen.getByTestId('approval-deny-appr-42')
    await act(async () => {
      fireEvent.click(denyBtn)
    })

    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenCalledWith('appr-42', 'deny')
  })

  it('disables buttons and shows submitting state while async decision is processing', async () => {
    let resolvePromise: (value: void) => void
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })
    const onResolve = vi.fn().mockReturnValue(pendingPromise)

    render(<ApprovalCard approval={baseApproval} onResolveApproval={onResolve} />)

    const allowBtn = screen.getByTestId('approval-allow-appr-42')
    const denyBtn = screen.getByTestId('approval-deny-appr-42')

    act(() => {
      fireEvent.click(allowBtn)
    })

    // While submitting
    expect(screen.getByText(/Отправка решения|Submitting/i)).not.toBeNull()
    expect(allowBtn.hasAttribute('disabled')).toBe(true)
    expect(denyBtn.hasAttribute('disabled')).toBe(true)

    // Resolve promise
    await act(async () => {
      resolvePromise!()
      await pendingPromise
    })

    expect(onResolve).toHaveBeenCalledWith('appr-42', 'allow')
  })

  it('handles promise rejection in onResolveApproval gracefully without unhandledRejection', async () => {
    const onResolve = vi.fn().mockRejectedValue(new Error('Backend RPC failed'))
    render(<ApprovalCard approval={baseApproval} onResolveApproval={onResolve} />)

    const allowBtn = screen.getByTestId('approval-allow-appr-42')
    await act(async () => {
      fireEvent.click(allowBtn)
    })

    expect(onResolve).toHaveBeenCalledTimes(1)
    // Error message is displayed to user and buttons can be retried
    expect(screen.getByText('Backend RPC failed')).not.toBeNull()
    expect(allowBtn.hasAttribute('disabled')).toBe(false)
  })

  it('blocks opposite decision button immediately upon synchronous decision callback', async () => {
    // Synchronous callback without returning a promise
    const onResolve = vi.fn().mockReturnValue(undefined)
    render(<ApprovalCard approval={baseApproval} onResolveApproval={onResolve} />)

    const allowBtn = screen.getByTestId('approval-allow-appr-42')

    await act(async () => {
      fireEvent.click(allowBtn)
    })

    // After deciding, both buttons are disabled to prevent duplicate opposite decision
    const allowAfter = screen.getByTestId('approval-allow-appr-42')
    const denyAfter = screen.getByTestId('approval-deny-appr-42')
    expect(allowAfter.hasAttribute('disabled')).toBe(true)
    expect(denyAfter.hasAttribute('disabled')).toBe(true)
  })

  it('terminal status (expired/resolved) unconditionally overrides submitting spinner while async promise is pending', async () => {
    let resolvePromise: () => void
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })
    const onResolve = vi.fn().mockReturnValue(pendingPromise)

    const { rerender } = render(
      <ApprovalCard approval={baseApproval} onResolveApproval={onResolve} />
    )

    const allowBtn = screen.getByTestId('approval-allow-appr-42')
    act(() => {
      fireEvent.click(allowBtn)
    })

    // Submitting spinner is active while pendingPromise is unsettled
    expect(screen.getByText(/Отправка решения|Submitting/i)).not.toBeNull()

    // While promise is still pending, server reports expired state
    rerender(
      <ApprovalCard
        approval={{
          ...baseApproval,
          state: 'expired',
        }}
        onResolveApproval={onResolve}
      />
    )

    // Submitting spinner MUST disappear immediately in terminal state
    expect(screen.queryByText(/Отправка решения|Submitting/i)).toBeNull()
    expect(screen.getByText(/Запрос устарел или пропущен|expired/i)).not.toBeNull()

    // Cleanup unsettled promise
    await act(async () => {
      resolvePromise!()
      await pendingPromise
    })
  })

  it('unlocks buttons after server rolls back from submitting to pending upon RPC error', async () => {
    const onResolve = vi.fn().mockReturnValue(undefined)
    const { rerender } = render(
      <ApprovalCard approval={baseApproval} onResolveApproval={onResolve} />
    )

    const allowBtn = screen.getByTestId('approval-allow-appr-42')
    await act(async () => {
      fireEvent.click(allowBtn)
    })

    // Local click locked buttons
    expect(allowBtn.hasAttribute('disabled')).toBe(true)

    // Server transition to submitting
    rerender(
      <ApprovalCard
        approval={{ ...baseApproval, state: 'submitting' }}
        onResolveApproval={onResolve}
      />
    )

    // Server encountered error and rolled back to pending (e.g. in ApprovalRegistry.ts)
    rerender(
      <ApprovalCard
        approval={{ ...baseApproval, state: 'pending' }}
        onResolveApproval={onResolve}
      />
    )

    // Buttons must be unlocked for retry!
    const allowBtnRetry = screen.getByTestId('approval-allow-appr-42')
    const denyBtnRetry = screen.getByTestId('approval-deny-appr-42')
    expect(allowBtnRetry.hasAttribute('disabled')).toBe(false)
    expect(denyBtnRetry.hasAttribute('disabled')).toBe(false)
  })

  it('renders resolved deny state without action buttons', () => {
    const resolvedApproval: ReconstructedApprovalItem = {
      ...baseApproval,
      state: 'resolved',
      decision: 'deny',
    }

    render(<ApprovalCard approval={resolvedApproval} />)

    expect(screen.queryByTestId('approval-allow-appr-42')).toBeNull()
    expect(screen.queryByTestId('approval-deny-appr-42')).toBeNull()
    expect(screen.getByText(/Действие отклонено|denied/i)).not.toBeNull()
  })

  it('ensures late rejection of previous attempt does not unlock subsequent in-flight attempt', async () => {
    let rejectAttemptA: ((err: Error) => void) | undefined
    let resolveAttemptB: (() => void) | undefined

    const pendingPromiseA = new Promise<void>((_, reject) => {
      rejectAttemptA = reject
    })
    const pendingPromiseB = new Promise<void>((resolve) => {
      resolveAttemptB = resolve
    })

    let callCount = 0
    const onResolve = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return pendingPromiseA
      return pendingPromiseB
    })

    const { rerender } = render(
      <ApprovalCard approval={baseApproval} onResolveApproval={onResolve} />
    )

    const allowBtn = screen.getByTestId('approval-allow-appr-42')
    const denyBtn = screen.getByTestId('approval-deny-appr-42')

    // 1. User clicks Allow (Attempt A)
    act(() => {
      fireEvent.click(allowBtn)
    })
    expect(onResolve).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenLastCalledWith('appr-42', 'allow')

    // 2. Server reports submitting -> pending (e.g. transient RPC timeout rollback)
    rerender(
      <ApprovalCard
        approval={{ ...baseApproval, state: 'submitting' }}
        onResolveApproval={onResolve}
      />
    )
    rerender(
      <ApprovalCard
        approval={{ ...baseApproval, state: 'pending' }}
        onResolveApproval={onResolve}
      />
    )

    // Buttons are unlocked for retry
    const allowBtnRetry = screen.getByTestId('approval-allow-appr-42')
    const denyBtnRetry = screen.getByTestId('approval-deny-appr-42')
    expect(allowBtnRetry.hasAttribute('disabled')).toBe(false)
    expect(denyBtnRetry.hasAttribute('disabled')).toBe(false)

    // 3. User initiates Attempt B (clicks Allow again)
    act(() => {
      fireEvent.click(allowBtnRetry)
    })
    expect(onResolve).toHaveBeenCalledTimes(2)
    expect(onResolve).toHaveBeenLastCalledWith('appr-42', 'allow')

    // Buttons are now locked by Attempt B
    expect(allowBtnRetry.hasAttribute('disabled')).toBe(true)
    expect(denyBtnRetry.hasAttribute('disabled')).toBe(true)

    // 4. Stale Attempt A rejects late with an error
    await act(async () => {
      rejectAttemptA!(new Error('Stale Attempt A Network Failure'))
      try {
        await pendingPromiseA
      } catch {
        // Expected rejection
      }
    })

    // 5. CRUCIAL GUARD: Stale Attempt A rejection must NOT unlock buttons while Attempt B is in-flight!
    expect(allowBtn.hasAttribute('disabled')).toBe(true)
    expect(denyBtn.hasAttribute('disabled')).toBe(true)

    // Attempting to click Deny while Attempt B is in flight must be ignored!
    act(() => {
      fireEvent.click(denyBtnRetry)
    })
    expect(onResolve).toHaveBeenCalledTimes(2) // No 3rd call allowed!

    // 6. Complete Attempt B
    await act(async () => {
      resolveAttemptB!()
      await pendingPromiseB
    })
  })

  it('MemoApprovalCard export is genuinely wrapped in React.memo and references base component', () => {
    // Structural verification of the exported Memo component
    expect((MemoApprovalCard as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.memo')
    )
    expect((MemoApprovalCard as unknown as { type: unknown }).type).toBe(ApprovalCard)
  })
})
