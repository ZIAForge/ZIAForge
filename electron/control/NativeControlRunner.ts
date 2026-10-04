import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { VerificationRunner } from '../workflow/VerificationRunner'
import { resolveExecutable } from '../workflow/WorkflowHost'

const MAX_OUTPUT_BYTES = 1024 * 1024

function readOutput(filename: string, expectedBytes: number): string {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  try {
    const stat = fs.fstatSync(fd)
    if (!stat.isFile() || stat.size !== expectedBytes || stat.size > MAX_OUTPUT_BYTES) throw new Error('Native command output changed or exceeded its limit')
    const bytes = Buffer.alloc(expectedBytes + 1)
    let length = 0
    while (length < bytes.length) {
      const count = fs.readSync(fd, bytes, length, bytes.length - length, null)
      if (!count) break
      length += count
    }
    if (length !== expectedBytes) throw new Error('Native command output changed while reading')
    return bytes.subarray(0, length).toString('utf8')
  } finally { fs.closeSync(fd) }
}

/** Owner-authorized native commands still need application-owned cancellation.
 * Permission checks belong to the caller; this is supervision, not a sandbox. */
export class NativeControlRunner {
  private readonly runner: VerificationRunner
  private readonly env: NodeJS.ProcessEnv
  private closing = false

  constructor(private readonly options: { directory: string; defaultCwd: string; env: NodeJS.ProcessEnv }) {
    this.env = { ...process.env, ...options.env }
    this.runner = new VerificationRunner({ directory: options.directory, env: this.env, timeoutMs: 30_000, maxOutputBytes: MAX_OUTPUT_BYTES })
  }

  async run(value: unknown): Promise<{ stdout: string; stderr: string }> {
    if (this.closing) throw new Error('Native command runner is shutting down')
    const request = value as { command?: unknown; args?: unknown; cwd?: unknown } | null
    if (!request || typeof request !== 'object' || Array.isArray(request) || typeof request.command !== 'string' || !request.command || request.command.includes('\0') ||
      (request.args !== undefined && (!Array.isArray(request.args) || request.args.length > 100 || request.args.some(arg => typeof arg !== 'string' || arg.includes('\0'))))) throw new Error('Invalid native command')
    const requestedCwd = request.cwd === undefined ? this.options.defaultCwd : request.cwd
    if (typeof requestedCwd !== 'string' || !path.isAbsolute(requestedCwd) || requestedCwd.includes('\0')) throw new Error('Native command cwd must be an existing absolute directory')
    const cwd = fs.realpathSync(requestedCwd)
    if (!fs.statSync(cwd).isDirectory()) throw new Error('Native command cwd must be an existing absolute directory')
    const receipt = await this.runner.run({
      verificationId: randomUUID(), cwd,
      command: { executable: resolveExecutable(request.command, this.env), args: request.args === undefined ? [] : [...request.args as string[]] },
    })
    if (receipt.status !== 'passed' || receipt.exitCode !== 0 || !receipt.cleanupVerified) {
      const detail = receipt.error ?? receipt.cancelReason ?? (receipt.exitCode === null ? receipt.signal : `exit ${receipt.exitCode}`)
      throw new Error(`Native command ${receipt.status}${detail ? `: ${detail}` : ''}. Receipt: ${path.join(path.dirname(receipt.stdoutPath), 'receipt.json')}`)
    }
    return { stdout: readOutput(receipt.stdoutPath, receipt.stdoutBytes), stderr: readOutput(receipt.stderrPath, receipt.stderrBytes) }
  }

  dispose(): Promise<void> {
    this.closing = true
    return this.runner.dispose()
  }
}
