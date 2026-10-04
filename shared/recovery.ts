export type RecoveryTarget = { domain: 'settings' | 'presets' | 'repositories' } | { domain: 'tasks'; repoId: string } | { domain: 'workflow'; taskId: string } | { domain: 'session-index'; taskId: string } | { domain: 'session'; taskId: string; runId: string } | { domain: 'message-queue'; taskId: string; sessionId: string }
export interface RecoveryDocument {
  target: RecoveryTarget
  state: 'missing' | 'valid' | 'corrupt' | 'unavailable'
  fingerprint: string | null
  backups: Array<{ id: string; bytes: number; savedAt: number }>
  invalidBackups: number
  error?: string
}
export interface RecoveryAPI {
  list(): Promise<RecoveryDocument[]>
  inspect(target: RecoveryTarget): Promise<RecoveryDocument>
  restore(request: { target: RecoveryTarget; expectedFingerprint: string; backupId: string }): Promise<{ fingerprint: string; preservedFingerprint: string }>
  onChanged(callback: () => void): () => void
}
