import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { VerificationRunner } from '../workflow/VerificationRunner'

/** This is owned process supervision, not a filesystem or network sandbox. */
export const LOCAL_COMMAND_SUPPORTED = process.platform === 'darwin' || process.platform === 'linux'
export const API_COMMAND_TOOL = {
  type: 'function' as const,
  name: 'run_command',
  description: 'Run an explicit absolute executable and argument vector in the trusted task directory, only after explicit owner approval. Maximum 60 seconds and 256 KiB output. This command has ordinary local account permissions; it is not sandboxed. No cwd or environment override is accepted.',
  parameters: {
    type: 'object',
    properties: {
      executable: { type: 'string', description: 'Absolute path to the executable; do not supply a shell command string.' },
      args: { type: 'array', items: { type: 'string' } },
      timeoutMs: { type: ['integer', 'null'], minimum: 1, maximum: 60_000, description: 'Null uses the 60-second default.' },
    },
    required: ['executable', 'args', 'timeoutMs'],
    additionalProperties: false,
  },
  strict: true,
}

export interface LocalCommandInput { executable: string; args: string[]; timeoutMs: number | null }
export interface LocalCommandResult {
  status: 'passed' | 'failed' | 'cancelled' | 'timed_out' | 'output_limit' | 'cleanup_failed'
  exitCode: number | null
  signal: string | null
  stdout: string
  stderr: string
  outputTruncated: boolean
  cleanupVerified: boolean
}

/** The adapter owns approvals and durable intent; this executor owns the entire command process group. */
export class LocalCommandTool {
  private readonly runner: VerificationRunner
  private readonly cwdIdentity: { dev: number; ino: number }
  constructor(private readonly cwd: string, directory: string) {
    if (!LOCAL_COMMAND_SUPPORTED) throw new Error('Local API commands require macOS or Linux process supervision')
    if (!path.isAbsolute(cwd) || path.resolve(cwd) !== cwd || fs.realpathSync(cwd) !== cwd || !fs.lstatSync(cwd).isDirectory()) throw new Error('Local API command cwd must be canonical')
    const stat = fs.statSync(cwd)
    this.cwdIdentity = { dev: stat.dev, ino: stat.ino }
    this.runner = new VerificationRunner({ directory, timeoutMs: 60_000, maxOutputBytes: 256 * 1024 })
  }
  private assertCwd(): void {
    const stat = fs.statSync(this.cwd)
    if (fs.realpathSync(this.cwd) !== this.cwd || stat.dev !== this.cwdIdentity.dev || stat.ino !== this.cwdIdentity.ino || !stat.isDirectory()) throw new Error('Trusted task directory changed before command execution')
  }
  validate(value: unknown): LocalCommandInput {
    this.assertCwd()
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3 || Object.keys(value).some(key => !['executable', 'args', 'timeoutMs'].includes(key))) throw new Error('Invalid local command arguments')
    const input = value as LocalCommandInput
    if (typeof input.executable !== 'string' || !path.isAbsolute(input.executable) || input.executable.includes('\0') || input.executable.length > 2000 || !Array.isArray(input.args) || input.args.length > 256 || input.args.some(arg => typeof arg !== 'string' || arg.includes('\0')) || Buffer.byteLength(JSON.stringify(input)) > 64 * 1024 || !(input.timeoutMs === null || Number.isSafeInteger(input.timeoutMs) && input.timeoutMs > 0 && input.timeoutMs <= 60_000)) throw new Error('Local command requires an absolute executable, bounded argv and at most 60 seconds')
    const executable = fs.realpathSync(input.executable)
    if (!fs.statSync(executable).isFile()) throw new Error('Local command executable must be a regular file')
    fs.accessSync(executable, fs.constants.X_OK)
    return { executable: input.executable, args: [...input.args], timeoutMs: input.timeoutMs }
  }
  async execute(value: unknown, signal: AbortSignal): Promise<LocalCommandResult> {
    const input = this.validate(value)
    signal.throwIfAborted()
    const receipt = await this.runner.run({ verificationId: `command-${randomUUID()}`, cwd: this.cwd, command: { executable: input.executable, args: input.args }, timeoutMs: input.timeoutMs ?? 60_000 }, signal)
    // Only bounded command output reaches the function result; private receipt paths never do.
    return { status: receipt.status, exitCode: receipt.exitCode, signal: receipt.signal, stdout: fs.readFileSync(receipt.stdoutPath, 'utf8'), stderr: fs.readFileSync(receipt.stderrPath, 'utf8'), outputTruncated: receipt.outputTruncated, cleanupVerified: receipt.cleanupVerified }
  }
  async dispose(): Promise<void> { await this.runner.dispose() }
}
