import fs from 'node:fs'
import { isWithin } from './ProjectAccess'

/** Capture the resolved directory, then reject deletion or replacement before a spawn. */
export function captureWorkingDirectory(cwd: string): () => void {
  const initial = fs.lstatSync(cwd)
  if (!initial.isDirectory() || fs.realpathSync(cwd) !== cwd) throw new Error('A canonical working directory is required')
  return () => {
    const current = fs.lstatSync(cwd)
    if (!current.isDirectory() || fs.realpathSync(cwd) !== cwd || current.dev !== initial.dev || current.ino !== initial.ino) {
      throw new Error('Working directory changed before startup; no process was started')
    }
  }
}

/** Coordinates app-owned session and terminal cwd ownership while Git removes a worktree. */
export class WorktreeRemovalGuard {
  private readonly removing = new Set<string>()

  constructor(
    private readonly reserveSessions: (taskId: string) => () => void,
    private readonly terminalCwds: () => Iterable<string>,
  ) {}

  assertTerminalAvailable(cwd: string): void {
    if ([...this.removing].some(root => isWithin(root, cwd))) throw new Error('Worktree removal is in progress; a terminal cannot start in this directory')
  }

  async run<T>(taskId: string, cwd: string, remove: () => Promise<T>): Promise<T> {
    if ([...this.terminalCwds()].some(terminalCwd => isWithin(cwd, terminalCwd))) {
      throw new Error('A terminal is still attached to this worktree. Close its terminal or restart the application before removing the worktree.')
    }
    const release = this.reserveSessions(taskId)
    this.removing.add(cwd)
    try { return await remove() }
    finally { this.removing.delete(cwd); release() }
  }
}
