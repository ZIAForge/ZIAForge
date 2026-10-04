import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { ensurePrivateDirectory, replacePrivateMetadata } from './privateStorage'

export interface DispatcherRequest { command: 'list' | 'status' | 'start' | 'pause' | 'quit'; taskId?: string; commandId?: string; untilSuccess?: boolean }
export interface CliDispatcherOptions { directory: string; execute(request: DispatcherRequest): Promise<unknown> }

export function validateDispatcherRequest(value: unknown): asserts value is DispatcherRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid dispatcher request')
  const request = value as Record<string, unknown>
  if (Object.keys(request).some(key => !['command', 'taskId', 'commandId', 'untilSuccess'].includes(key)) || !['list', 'status', 'start', 'pause', 'quit'].includes(String(request.command))) throw new Error('Unsupported dispatcher command')
  if (!['list', 'quit'].includes(String(request.command)) && (typeof request.taskId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(request.taskId))) throw new Error('Select a registered task')
  if (request.command === 'start' && (typeof request.commandId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(request.commandId))) throw new Error('A command identity is required')
  if (request.untilSuccess !== undefined && (typeof request.untilSuccess !== 'boolean' || request.command !== 'start')) throw new Error('Invalid dispatcher policy')
}

/** An owner-only local command socket. No shell, eval, arbitrary paths or executable overrides. */
export async function startCliDispatcher(options: CliDispatcherOptions) {
  ensurePrivateDirectory(options.directory)
  const filename = path.join(options.directory, 'endpoint.json')
  const token = randomBytes(32).toString('hex')
  // macOS AF_UNIX paths are short; the random directory is private and owned by this run.
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(process.platform === 'win32' ? os.tmpdir() : '/tmp'), 'ziaf-cli-'))
  fs.chmodSync(temporary, 0o700)
  const socketPath = path.join(temporary, 'command.sock')
  const sockets = new Set<net.Socket>()
  const pending = new Set<Promise<void>>()
  let closing = false
  const server = net.createServer(socket => {
    if (closing) { socket.destroy(); return }
    sockets.add(socket)
    socket.setTimeout(30000, () => socket.destroy())
    socket.on('error', () => {})
    socket.on('close', () => sockets.delete(socket))
    let raw = ''
    let accepted = false
    socket.setEncoding('utf8')
    socket.on('data', chunk => {
      if (accepted) return
      raw += chunk
      if (Buffer.byteLength(raw) > 16384) { socket.destroy(); return }
      const end = raw.indexOf('\n')
      if (end < 0) return
      accepted = true
      const operation = (async () => {
        try {
          const envelope = JSON.parse(raw.slice(0, end))
          if (!envelope || typeof envelope.token !== 'string' || Object.keys(envelope).some(key => !['token', 'request'].includes(key))) throw new Error('Invalid local command authentication')
          const supplied = createHash('sha256').update(envelope.token).digest()
          const expected = createHash('sha256').update(token).digest()
          if (!timingSafeEqual(supplied, expected) || closing) throw new Error('Local command is unavailable')
          validateDispatcherRequest(envelope.request)
          const result = await options.execute(envelope.request)
          const output = JSON.stringify({ ok: true, result })
          if (Buffer.byteLength(output) > 1024 * 1024) throw new Error('Dispatcher response exceeds its limit')
          socket.end(output + '\n')
        } catch (error) { socket.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + '\n') }
      })()
      pending.add(operation)
      void operation.finally(() => pending.delete(operation)).catch(() => {})
    })
  })
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socketPath, () => { server.removeListener('error', reject); resolve() }) })
    fs.chmodSync(socketPath, 0o600)
    await replacePrivateMetadata(filename, { version: 1, pid: process.pid, socketPath, token })
  } catch (error) { server.close(); fs.rmSync(temporary, { recursive: true, force: true }); throw error }
  return {
    async close() {
      closing = true
      const stopped = new Promise<void>(resolve => server.close(() => resolve()))
      for (const socket of sockets) socket.destroy()
      await Promise.allSettled([...pending])
      await stopped
      // Never erase an endpoint published by a newer process.
      try { if (JSON.parse(fs.readFileSync(filename, 'utf8')).token === token) fs.unlinkSync(filename) } catch { /* Already removed or replaced. */ }
      fs.rmSync(temporary, { recursive: true, force: true })
    },
  }
}
