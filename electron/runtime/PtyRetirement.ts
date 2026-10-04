import type { ProcessSupervisor } from './ProcessSupervisor'

export interface RetiringPty<T extends { pid: number }> {
  sessionId: string
  generation: number
  process: T
  cwd: string
}
type Supervisor = Pick<ProcessSupervisor, 'trackProcessTree' | 'terminateProcessTree'>

/** A detached terminal still owns its cwd until its original process tree is gone. */
export class PtyRetirement<T extends { pid: number }> {
  readonly entries = new Map<string, RetiringPty<T>>()
  private readonly pending = new Map<string, Promise<void>>()
  private readonly owners = new Map<string, { entry: RetiringPty<T>; supervisor: Supervisor }>()

  constructor(private readonly createSupervisor: () => Supervisor) {}

  /** A PID may be reused while the old generation still owns orphaned children. */
  track(entry: RetiringPty<T>): Supervisor {
    const key = `${entry.sessionId}:${entry.generation}`
    let owner = this.owners.get(key)
    if (owner && owner.entry.process !== entry.process) throw new Error('PTY generation belongs to another process')
    if (!owner) {
      owner = { entry, supervisor: this.createSupervisor() }
      this.owners.set(key, owner)
    }
    owner.supervisor.trackProcessTree(entry.process.pid)
    return owner.supervisor
  }

  retire(entry: RetiringPty<T>, detach: () => void, options?: { timeoutMs?: number; force?: boolean }): Promise<void> {
    const key = `${entry.sessionId}:${entry.generation}`
    const retained = this.entries.get(key)
    if (retained && retained.process !== entry.process) return Promise.reject(new Error('PTY generation belongs to another process'))
    const pending = this.pending.get(key)
    if (pending) return pending
    const owner = retained ?? entry
    // Register ownership before any signal or callback can remove the active map.
    this.entries.set(key, owner)
    let supervisor: Supervisor
    try {
      supervisor = this.track(owner)
      detach()
    } catch (error) { return Promise.reject(error) }
    const cleanup = (async () => {
      const confirmed = await supervisor.terminateProcessTree(owner.process.pid, options)
      if (!confirmed) throw new Error('Terminal process cleanup was not verified; its worktree remains in use')
      if (this.entries.get(key) === owner) this.entries.delete(key)
      if (this.owners.get(key)?.supervisor === supervisor) this.owners.delete(key)
    })()
    this.pending.set(key, cleanup)
    void cleanup.finally(() => { if (this.pending.get(key) === cleanup) this.pending.delete(key) }).catch(() => {})
    return cleanup
  }
}
