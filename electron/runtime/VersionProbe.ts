import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { VerificationRunner, type VerificationReceipt } from '../workflow/VerificationRunner'
import { writePrivateMetadata } from './privateStorage'

const active = new Map<Promise<string>, AbortController>()
let closing = false

/** Version-only execution uses the same owned group leader as verification commands. */
export function runVersionProbe(binary: string, env: Record<string, string | undefined>, options: { timeoutMs?: number } = {}): Promise<string> {
  if (closing) return Promise.reject(new Error('CLI version service is shutting down'))
  const controller = new AbortController()
  const operation = probe(binary, env, options.timeoutMs ?? 5000, controller.signal)
  active.set(operation, controller)
  void operation.finally(() => active.delete(operation)).catch(() => {})
  return operation
}

export async function shutdownVersionProbes(): Promise<void> {
  closing = true
  for (const controller of active.values()) controller.abort()
  await Promise.allSettled([...active.keys()])
}

async function probe(binary: string, env: Record<string, string | undefined>, timeoutMs: number, signal: AbortSignal): Promise<string> {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-version-')))
  let runner: VerificationRunner | undefined
  let receipt: VerificationReceipt | undefined
  let output = ''
  let failure: Error | undefined
  let disposal: { status: 'completed' | 'failed' | 'not-created'; error?: string } = { status: 'not-created' }
  try {
    runner = new VerificationRunner({ directory, env, maxOutputBytes: 16384 })
    receipt = await runner.run({ verificationId: 'version', cwd: directory, command: { executable: binary, args: ['--version'] }, timeoutMs }, signal)
    if (receipt.status !== 'passed' || !receipt.cleanupVerified) throw new Error(`CLI version check ${receipt.status}${receipt.error ? `: ${receipt.error}` : ''}`)
    output = fs.readFileSync(receipt.stdoutPath, 'utf8')
  } catch (error) { failure = error instanceof Error ? error : new Error(String(error)) }
  if (runner) {
    try { await runner.dispose(); disposal = { status: 'completed' } }
    catch (error) {
      disposal = { status: 'failed', error: error instanceof Error ? error.message : String(error) }
      failure = new Error(`${failure ? failure.message + '; ' : 'CLI version check ' }dispose failed: ${disposal.error}`)
    }
  }
  if (failure) {
    // Keep the original receipt immutable: successful later disposal must not
    // turn an initially unverified cleanup into an apparent successful probe.
    let diagnosticError: string | undefined
    try {
      await writePrivateMetadata(path.join(directory, 'failure.json'), {
        schemaVersion: 1, operation: 'CLI --version', failedAt: new Date().toISOString(),
        error: failure.message, receiptPath: receipt ? path.join(directory, 'version', 'receipt.json') : undefined,
        receiptStatus: receipt?.status, cleanupVerified: receipt?.cleanupVerified, disposal,
      })
    } catch (error) { diagnosticError = error instanceof Error ? error.message : String(error) }
    throw Object.assign(new Error(`${failure.message}; diagnostics: ${directory}${diagnosticError ? ` (failure metadata could not be written: ${diagnosticError})` : ''}`), { diagnosticDirectory: directory, cause: failure })
  }
  fs.rmSync(directory, { recursive: true, force: true })
  return output
}
