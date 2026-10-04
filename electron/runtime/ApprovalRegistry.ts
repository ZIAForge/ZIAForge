import { ApprovalDecision, ApprovalState, RiskLevel } from '../../shared/agent-events'

export interface RegisterApprovalOptions {
  approvalId: string
  taskId: string
  runId: string
  command?: string
  toolCallId?: string
  description?: string
  riskLevel?: RiskLevel
  decisionOptions?: string[]
  timeoutMs?: number
  data?: Record<string, unknown>
  resolver?: (decision: ApprovalDecision, note?: string) => Promise<void> | void
}

export interface PendingApprovalRecord {
  approvalId: string
  taskId: string
  runId: string
  state: ApprovalState
  command?: string
  toolCallId?: string
  description?: string
  riskLevel?: RiskLevel
  decisionOptions: string[]
  createdAt: number
  expiresAt?: number
  decision?: ApprovalDecision
  resolvedBy?: 'user' | 'auto' | 'timeout'
  data?: Record<string, unknown>
  resolver?: (decision: ApprovalDecision, note?: string) => Promise<void> | void
  timeoutTimer?: ReturnType<typeof setTimeout>
}

export class ApprovalRegistry {
  private approvals: Map<string, PendingApprovalRecord> = new Map()
  private listeners: Set<(record: PendingApprovalRecord) => void> = new Set()
  private inFlightResolutions: Map<
    string,
    { record: PendingApprovalRecord; promise: Promise<PendingApprovalRecord> }
  > = new Map()

  /**
   * Registers a new approval request.
   */
  register(options: RegisterApprovalOptions): PendingApprovalRecord {
    if (this.approvals.has(options.approvalId)) {
      throw new Error(`Approval request with ID "${options.approvalId}" already exists`)
    }

    const record: PendingApprovalRecord = {
      approvalId: options.approvalId,
      taskId: options.taskId,
      runId: options.runId,
      state: 'pending',
      command: options.command,
      toolCallId: options.toolCallId,
      description: options.description,
      riskLevel: options.riskLevel || 'medium',
      decisionOptions: options.decisionOptions || ['allow', 'deny'],
      createdAt: Date.now(),
      expiresAt: options.timeoutMs ? Date.now() + options.timeoutMs : undefined,
      data: options.data,
      resolver: options.resolver,
    }

    if (options.timeoutMs && options.timeoutMs > 0) {
      record.timeoutTimer = setTimeout(() => {
        void this.handleTimeout(options.approvalId, options.timeoutMs!)
      }, options.timeoutMs)
    }

    this.approvals.set(options.approvalId, record)
    this.notifyListeners(record)

    return record
  }

  /**
   * Resolves a pending approval with 'allow' or 'deny' and invokes the underlying RPC resolver.
   */
  resolve(
    approvalId: string,
    decision: ApprovalDecision,
    note?: string,
    resolvedBy: 'user' | 'auto' = 'user'
  ): Promise<PendingApprovalRecord> {
    const record = this.approvals.get(approvalId)
    if (!record) {
      return Promise.reject(new Error(`Approval request "${approvalId}" not found`))
    }

    const inFlight = this.inFlightResolutions.get(approvalId)
    if (inFlight && inFlight.record === record) {
      return inFlight.promise
    }

    if (record.state !== 'pending') {
      return Promise.reject(
        new Error(
          `Approval request "${approvalId}" is already resolved or terminated (current state: "${record.state}")`
        )
      )
    }

    // Check if timeout deadline has already passed before allowing submission
    if (record.expiresAt && record.expiresAt <= Date.now()) {
      if (record.timeoutTimer) {
        clearTimeout(record.timeoutTimer)
        record.timeoutTimer = undefined
      }
      void this.handleTimeout(approvalId, 0)
      return Promise.reject(
        new Error(`Approval request "${approvalId}" is already expired (timeout deadline passed)`)
      )
    }

    let resolveResolution!: (record: PendingApprovalRecord) => void
    let rejectResolution!: (err: unknown) => void

    const resolutionPromise = new Promise<PendingApprovalRecord>((resolve, reject) => {
      resolveResolution = resolve
      rejectResolution = reject
    })

    this.inFlightResolutions.set(approvalId, { record, promise: resolutionPromise })

    void (async () => {
      if (record.timeoutTimer) {
        clearTimeout(record.timeoutTimer)
        record.timeoutTimer = undefined
      }

      // Move to submitting state
      record.state = 'submitting'
      this.notifyListeners(record)

      try {
        // Call underlying resolver (e.g. sending JSON-RPC response over stdio)
        if (record.resolver) {
          await record.resolver(decision, note)
        }

        // Fencing check: ensure record was not expired/cleared during asynchronous resolver
        if (this.approvals.get(approvalId) === record && record.state === 'submitting') {
          record.state = 'resolved'
          record.decision = decision
          record.resolvedBy = resolvedBy
          this.notifyListeners(record)
        }

        resolveResolution(record)
      } catch (err) {
        // Resolver failed: rollback to pending if still in registry and not expired
        if (this.approvals.get(approvalId) === record && record.state === 'submitting') {
          record.state = 'pending'
          if (record.expiresAt && record.expiresAt <= Date.now()) {
            // Expiration deadline already passed during failed resolution: expire immediately
            // handleTimeout transitions to expired and notifies listeners
            void this.handleTimeout(approvalId, 0)
          } else {
            if (record.expiresAt) {
              const remaining = record.expiresAt - Date.now()
              record.timeoutTimer = setTimeout(() => {
                void this.handleTimeout(approvalId, remaining)
              }, remaining)
            }
            this.notifyListeners(record)
          }
        }
        rejectResolution(err)
      } finally {
        const current = this.inFlightResolutions.get(approvalId)
        if (current && current.record === record) {
          this.inFlightResolutions.delete(approvalId)
        }
      }
    })()

    return resolutionPromise
  }

  /**
   * Internal handler when an approval request reaches its configured timeout.
   */
  private async handleTimeout(approvalId: string, timeoutMs: number): Promise<void> {
    const record = this.approvals.get(approvalId)
    if (!record || record.state !== 'pending') return

    record.timeoutTimer = undefined
    record.state = 'expired'
    record.resolvedBy = 'timeout'
    record.decision = 'deny'

    if (record.resolver) {
      try {
        await record.resolver('deny', `Approval request timed out after ${timeoutMs}ms`)
      } catch (err) {
        console.error(`Error in timeout resolver for approval "${approvalId}":`, err)
      }
    }

    // Fencing check: ensure record was not cleared while waiting for resolver
    if (this.approvals.get(approvalId) === record) {
      this.notifyListeners(record)
    }
  }

  /**
   * Gets an approval record by its ID.
   */
  get(approvalId: string): PendingApprovalRecord | undefined {
    return this.approvals.get(approvalId)
  }

  /**
   * Returns all approval records for a given task.
   */
  getByTask(taskId: string): PendingApprovalRecord[] {
    const results: PendingApprovalRecord[] = []
    for (const record of this.approvals.values()) {
      if (record.taskId === taskId) {
        results.push(record)
      }
    }
    return results
  }

  /**
   * Returns only active (pending or submitting) approvals for a given task.
   */
  getActiveByTask(taskId: string): PendingApprovalRecord[] {
    const results: PendingApprovalRecord[] = []
    for (const record of this.approvals.values()) {
      if (record.taskId === taskId && (record.state === 'pending' || record.state === 'submitting')) {
        results.push(record)
      }
    }
    return results
  }

  /**
   * Cleans up all pending approvals for a task (e.g. when stopping or tearing down).
   */
  clearForTask(taskId: string): void {
    for (const [approvalId, record] of this.approvals.entries()) {
      if (record.taskId === taskId) {
        if (record.timeoutTimer) {
          clearTimeout(record.timeoutTimer)
          record.timeoutTimer = undefined
        }
        if (record.state === 'pending' || record.state === 'submitting') {
          record.state = 'expired'
          record.resolvedBy = 'auto'
          this.notifyListeners(record)
        }
        this.approvals.delete(approvalId)
        this.inFlightResolutions.delete(approvalId)
      }
    }
  }

  /**
   * Clears all approvals across all tasks.
   */
  clearAll(): void {
    for (const record of this.approvals.values()) {
      if (record.timeoutTimer) {
        clearTimeout(record.timeoutTimer)
        record.timeoutTimer = undefined
      }
    }
    this.approvals.clear()
    this.inFlightResolutions.clear()
  }

  /**
   * Subscribes to approval state change notifications.
   */
  onStateChanged(callback: (record: PendingApprovalRecord) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notifyListeners(record: PendingApprovalRecord): void {
    for (const listener of this.listeners) {
      try {
        listener(record)
      } catch (err) {
        console.error('Error in ApprovalRegistry state listener:', err)
      }
    }
  }
}
