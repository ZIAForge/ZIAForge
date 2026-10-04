import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawn, spawnSync, type ChildProcess, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process'
import { ProcessSupervisor } from '../runtime/ProcessSupervisor'
import { ensurePrivateDirectory, writePrivateMetadata } from '../runtime/privateStorage'

export interface VerificationCommand { executable: string; args: string[] }
export interface VerificationRequest {
  verificationId: string
  /** Canonical, backend-authorized directory; never take a renderer path as a grant. */
  cwd: string
  command: VerificationCommand
  inputFingerprint?: string
  timeoutMs?: number
}
export interface VerificationReceipt {
  schemaVersion: 1
  verificationId: string
  command: VerificationCommand
  resolvedExecutable: string
  cwd: string
  fingerprint: string
  inputFingerprint?: string
  startedAt: string
  finishedAt: string
  status: 'passed' | 'failed' | 'cancelled' | 'timed_out' | 'output_limit' | 'cleanup_failed'
  exitCode: number | null
  signal: string | null
  stdoutPath: string
  stderrPath: string
  stdoutBytes: number
  stderrBytes: number
  outputTruncated: boolean
  timeoutMs: number
  maxOutputBytes: number
  cleanupVerified: boolean
  cancelled: boolean
  cancelReason?: string
  error?: string
}
export interface VerificationRunnerOptions {
  directory: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  maxOutputBytes?: number
  killGraceMs?: number
  supervisor?: ProcessSupervisor
}

// Embedded so a packaged ASAR needs no separately copied executable asset.
// The group leader remains alive after the tested command exits. This lets the
// owner terminate ordinary orphan descendants without a PID-reuse window.
// This is process supervision, not an OS sandbox: deliberate setsid daemons
// that escape the group before observation cannot be contained by this runner.
const WORKER = String.raw`
const {spawn}=require('node:child_process');
let child,closed=false,shutdown=false,started=false;
const send=value=>{if(process.connected)process.send(value)};
const finish=()=>{if(shutdown&&(!started||closed))process.stdout.write('',()=>process.stderr.write('',()=>process.exit(0)))};
process.on('SIGTERM',()=>{});
process.on('SIGINT',()=>{});
process.on('message',message=>{
  if(message?.type==='shutdown'){shutdown=true;finish();return}
  if(message?.type!=='run'||started)return;
  started=true;
  try{
    child=spawn(message.executable,message.args,{cwd:message.cwd,env:message.env,stdio:['ignore','pipe','pipe'],shell:false});
    child.stdout.pipe(process.stdout,{end:false});child.stderr.pipe(process.stderr,{end:false});
    child.once('error',error=>send({type:'command-error',error:error.message}));
    child.once('exit',(code,signal)=>send({type:'command-exit',code,signal}));
    child.once('close',()=>{closed=true;finish()});
  }catch(error){closed=true;send({type:'command-error',error:error.message});finish()}
});
// If the owner vanishes, terminate only our still-owned process group.
process.on('disconnect',()=>{try{process.kill(-process.pid,'SIGKILL')}catch{process.exit(1)}});
send({type:'ready'});
`

interface GroupMember { pid: number; started: string; zombie: boolean }
type StopReason = 'cancelled' | 'timed_out' | 'output_limit' | 'failed'
interface Execution {
  promise: Promise<VerificationReceipt>
  cancel(reason: string): void
}
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function groupMembers(group: number): GroupMember[] {
  // Node supports detached synchronous children; older @types/node omit it.
  const options: SpawnSyncOptionsWithStringEncoding & { detached: boolean } = {
    encoding: 'utf8', timeout: 1500, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  }
  const result = spawnSync('/bin/ps', ['-axo', 'pid=,pgid=,stat=,lstart='], options)
  if (result.status !== 0) throw new Error('Cannot inspect verification process group')
  return result.stdout.split('\n').flatMap(line => {
    const fields = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/)
    return fields && Number(fields[2]) === group ? [{ pid: Number(fields[1]), started: fields[4], zombie: fields[3].startsWith('Z') }] : []
  })
}

export class VerificationRunner {
  private readonly directory: string
  private readonly env: NodeJS.ProcessEnv
  private readonly supervisor: ProcessSupervisor
  private readonly active = new Map<string, Execution>()
  private readonly unresolved = new Map<string, { worker: ChildProcess; birth?: string }>()
  private closing = false

  constructor(private readonly options: VerificationRunnerOptions) {
    if (process.platform === 'win32') throw new Error('Verification process supervision currently requires macOS or Linux')
    if (!path.isAbsolute(options.directory)) throw new Error('Verification storage must be absolute')
    ensurePrivateDirectory(options.directory)
    this.directory = fs.realpathSync(options.directory)
    this.env = { ...process.env, ...options.env }
    if (this.env.HOME !== process.env.HOME) throw new Error('Verification must inherit the standard HOME')
    delete this.env.ELECTRON_RUN_AS_NODE
    this.supervisor = options.supervisor ?? new ProcessSupervisor()
  }

  run(request: VerificationRequest, signal?: AbortSignal): Promise<VerificationReceipt> {
    if (this.closing) return Promise.reject(new Error('Verification runner is shutting down'))
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(request.verificationId)) return Promise.reject(new Error('Invalid verification identity'))
    if (this.active.has(request.verificationId)) return Promise.reject(new Error('Verification identity is already running'))
    let cancel: (reason: string) => void = () => { /* Assigned synchronously before execution starts. */ }
    const promise = this.execute(request, signal, handler => { cancel = handler })
    this.active.set(request.verificationId, { promise, cancel: reason => cancel(reason) })
    void promise.finally(() => this.active.delete(request.verificationId)).catch(() => {})
    return promise
  }

  async cancel(verificationId: string, reason = 'Cancelled by user'): Promise<void> {
    const execution = this.active.get(verificationId)
    if (!execution) {
      const owned = this.unresolved.get(verificationId)
      if (owned && await this.cleanup(owned.worker, owned.birth)) this.unresolved.delete(verificationId)
      if (this.unresolved.has(verificationId)) throw new Error('Verification processes could not be completely stopped')
      return
    }
    execution.cancel(reason)
    const receipt = await execution.promise
    if (!receipt.cleanupVerified) throw new Error('Verification processes could not be completely stopped')
  }

  async dispose(): Promise<void> {
    this.closing = true
    const executions = [...this.active.values()]
    for (const execution of executions) execution.cancel('Application shutdown')
    await Promise.allSettled(executions.map(execution => execution.promise))
    for (const [id, owned] of this.unresolved) {
      if (await this.cleanup(owned.worker, owned.birth).catch(() => false)) this.unresolved.delete(id)
    }
    if (this.unresolved.size) throw new Error('Verification shutdown could not confirm cleanup')
  }

  private async execute(request: VerificationRequest, signal: AbortSignal | undefined, registerCancel: (handler: (reason: string) => void) => void): Promise<VerificationReceipt> {
    const cwd = request.cwd
    if (!path.isAbsolute(cwd) || path.resolve(cwd) !== cwd || fs.realpathSync(cwd) !== cwd || !fs.statSync(cwd).isDirectory()) throw new Error('Verification cwd must be the canonical authorized directory')
    const cwdIdentity = fs.statSync(cwd)
    const command = request.command
    if (!command || !path.isAbsolute(command.executable) || command.executable.includes('\0') || !Array.isArray(command.args) || command.args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) throw new Error('Verification requires an explicit executable and string argv')
    if (Buffer.byteLength(JSON.stringify(command)) > 65536) throw new Error('Verification command is too large')
    const resolvedExecutable = fs.realpathSync(command.executable)
    if (!fs.statSync(resolvedExecutable).isFile()) throw new Error('Verification executable must be a file')
    fs.accessSync(resolvedExecutable, fs.constants.X_OK)
    const timeoutMs = request.timeoutMs ?? this.options.timeoutMs ?? 60_000
    const maxOutputBytes = this.options.maxOutputBytes ?? 1024 * 1024
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30 * 60_000) throw new Error('Verification timeout must be between 1ms and 30 minutes')
    if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 16 * 1024 * 1024) throw new Error('Invalid verification output limit')
    if (request.inputFingerprint !== undefined && (typeof request.inputFingerprint !== 'string' || request.inputFingerprint.length > 1024)) throw new Error('Invalid input fingerprint')
    const directory = path.join(this.directory, request.verificationId)
    fs.mkdirSync(directory, { mode: 0o700 }) // Never overwrite a prior command or receipt.
    const stdoutPath = path.join(directory, 'stdout.log')
    const stderrPath = path.join(directory, 'stderr.log')
    const record = {
      schemaVersion: 1 as const, verificationId: request.verificationId,
      command: { executable: command.executable, args: [...command.args] }, resolvedExecutable, cwd,
      inputFingerprint: request.inputFingerprint, timeoutMs, maxOutputBytes,
      startedAt: new Date().toISOString(), stdoutPath, stderrPath,
      fingerprint: fingerprint({ command, resolvedExecutable, cwd, timeoutMs, maxOutputBytes, inputFingerprint: request.inputFingerprint,
        environment: fingerprint(Object.entries(this.env).sort(([a], [b]) => a.localeCompare(b))) }),
    }
    let reason: StopReason | undefined
    let error: string | undefined
    let cancelReason: string | undefined
    let worker: ChildProcess | undefined
    let leaderBirth: string | undefined
    let exitCode: number | null = null
    let exitSignal: string | null = null
    let stdoutBytes = 0
    let stderrBytes = 0
    let outputTruncated = false
    let stdout: number | undefined
    let stderr: number | undefined
    let timeout: NodeJS.Timeout | undefined
    let tracking: NodeJS.Timeout | undefined
    let finish!: () => void
    const finished = new Promise<void>(resolve => { finish = resolve })
    const stop = (why: StopReason, detail?: string) => {
      if (!reason) { reason = why; error = detail }
      finish()
    }
    const cancel = (detail: string) => { cancelReason ??= detail; stop('cancelled') }
    registerCancel(cancel)
    const aborted = () => cancel('Aborted by caller')
    signal?.addEventListener('abort', aborted, { once: true })
    if (signal?.aborted) aborted()
    let cleanupVerified = true
    try {
      await writePrivateMetadata(path.join(directory, 'request.json'), record)
      const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW
      stdout = fs.openSync(stdoutPath, flags, 0o600)
      stderr = fs.openSync(stderrPath, flags, 0o600)
      if (!reason) {
        const actual = fs.statSync(cwd)
        if (fs.realpathSync(cwd) !== cwd || actual.dev !== cwdIdentity.dev || actual.ino !== cwdIdentity.ino) throw new Error('Authorized verification directory changed before execution')
        const workerEnv: NodeJS.ProcessEnv = { ...this.env, ELECTRON_RUN_AS_NODE: '1' }
        // NODE_OPTIONS may inject arbitrary preload hooks into our supervisor;
        // preserve it for the actual explicit command, but not the owned wrapper.
        delete workerEnv.NODE_OPTIONS
        worker = spawn(process.execPath, ['-e', WORKER], { cwd, env: workerEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], shell: false })
        const child = worker
        const append = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
          const remaining = Math.max(0, maxOutputBytes - stdoutBytes - stderrBytes)
          const retained = chunk.subarray(0, remaining)
          try {
            let written = 0
            while (written < retained.length) {
              const bytes = fs.writeSync(stream === 'stdout' ? stdout! : stderr!, retained, written)
              if (!bytes) throw new Error('Verification output write made no progress')
              written += bytes
            }
            if (stream === 'stdout') stdoutBytes += retained.length; else stderrBytes += retained.length
            if (chunk.length > retained.length) { outputTruncated = true; stop('output_limit', 'Verification output limit exceeded') }
          } catch (caught) { stop('failed', `Cannot persist verification output: ${message(caught)}`) }
        }
        child.stdout!.on('data', (chunk: Buffer) => append('stdout', chunk))
        child.stderr!.on('data', (chunk: Buffer) => append('stderr', chunk))
        child.once('error', caught => stop('failed', message(caught)))
        child.once('exit', () => { if (exitCode === null && !reason) stop('failed', 'Verification supervisor exited before command completion') })
        child.on('message', (incoming: unknown) => {
          if (!incoming || typeof incoming !== 'object' || !('type' in incoming)) return
          const value = incoming as Record<string, unknown>
          if (value.type === 'ready') {
            if (reason) { finish(); return }
            try {
              leaderBirth = groupMembers(child.pid!).find(item => item.pid === child.pid)?.started
              if (!leaderBirth) throw new Error('Cannot establish verification supervisor ownership')
              this.supervisor.trackProcessTree(child.pid!)
              tracking = setInterval(() => {
                try { this.supervisor.trackProcessTree(child.pid!) } catch (caught) { stop('failed', message(caught)) }
              }, 100)
              child.send({ type: 'run', executable: resolvedExecutable, args: record.command.args, cwd, env: this.env }, caught => { if (caught) stop('failed', message(caught)) })
            } catch (caught) { stop('failed', message(caught)) }
          } else if (value.type === 'command-exit') {
            exitCode = typeof value.code === 'number' ? value.code : null
            exitSignal = typeof value.signal === 'string' ? value.signal : null
            finish()
          } else if (value.type === 'command-error') stop('failed', typeof value.error === 'string' ? value.error : 'Command failed to start')
        })
        timeout = setTimeout(() => stop('timed_out', 'Verification timeout exceeded'), timeoutMs)
        await finished
      }
    } catch (caught) { reason ??= 'failed'; error ??= message(caught) }
    finally {
      clearTimeout(timeout)
      clearInterval(tracking)
      signal?.removeEventListener('abort', aborted)
      if (worker?.pid) {
        try { cleanupVerified = await this.cleanup(worker, leaderBirth) }
        catch (caught) { cleanupVerified = false; error = `${error ? error + '; ' : ''}Cleanup failed: ${message(caught)}` }
        if (!cleanupVerified) this.unresolved.set(request.verificationId, { worker, birth: leaderBirth })
      }
      for (const descriptor of [stdout, stderr]) if (descriptor !== undefined) {
        try { fs.fsyncSync(descriptor) } catch (caught) { reason ??= 'failed'; error ??= message(caught) }
        finally { fs.closeSync(descriptor) }
      }
    }
    const receipt: VerificationReceipt = {
      ...record, finishedAt: new Date().toISOString(), status: !cleanupVerified ? 'cleanup_failed' : reason ?? (exitCode === 0 ? 'passed' : 'failed'),
      exitCode, signal: exitSignal, stdoutBytes, stderrBytes, outputTruncated, cleanupVerified,
      cancelled: reason === 'cancelled', ...(cancelReason ? { cancelReason } : {}), ...(error ? { error } : {}),
    }
    await writePrivateMetadata(path.join(directory, 'receipt.json'), receipt)
    return receipt
  }

  private async cleanup(worker: ChildProcess, birth: string | undefined): Promise<boolean> {
    const pid = worker.pid!
    const alive = () => worker.exitCode === null && worker.signalCode === null
    const owned = () => birth !== undefined && groupMembers(pid).some(item => item.pid === pid && item.started === birth)
    if (alive()) {
      if (!birth) {
        // A never-initialized wrapper cannot have spawned the command; the
        // ChildProcess handle is still the owned direct child.
        worker.kill('SIGKILL')
      } else {
        if (!owned()) throw new Error('Verification supervisor ownership changed')
        this.supervisor.trackProcessTree(pid)
        const remaining = () => groupMembers(pid).filter(item => item.pid !== pid && !item.zombie)
        if (remaining().length) process.kill(-pid, 'SIGTERM')
        const grace = Date.now() + (this.options.killGraceMs ?? 200)
        while (Date.now() < grace && remaining().length) await delay(20)
        if (!owned()) throw new Error('Verification supervisor disappeared during cleanup')
        if (remaining().length) process.kill(-pid, 'SIGKILL')
        else worker.send({ type: 'shutdown' }, () => {})
      }
    }
    const deadline = Date.now() + 1500
    while (alive() && Date.now() < deadline) await delay(20)
    if (alive()) {
      if (!owned()) throw new Error('Verification supervisor ownership is unresolved')
      process.kill(-pid, 'SIGKILL')
      const forced = Date.now() + 1000
      while (alive() && Date.now() < forced) await delay(20)
    }
    // close, not exit, means stdout/stderr have drained into the receipt files.
    if (worker.stdout && !worker.stdout.destroyed || worker.stderr && !worker.stderr.destroyed) {
      await Promise.race([new Promise<void>(resolve => worker.once('close', () => resolve())), delay(1000)])
    }
    const stopped = await this.supervisor.terminateProcessTree(pid, { force: true, timeoutMs: 250 })
    if (alive()) throw new Error(`Verification supervisor ${pid} is still alive after cleanup`)
    if (!stopped) throw new Error(`Verification owned process cleanup is unresolved for supervisor ${pid}; tracked PIDs: ${this.supervisor.getOwnedPids(pid).join(', ') || '(none)'}`)
    const remaining = groupMembers(pid).filter(item => !item.zombie)
    if (remaining.length) throw new Error(`Verification process group ${pid} still contains non-zombie PIDs: ${remaining.map(item => item.pid).join(', ')}`)
    return true
  }
}
