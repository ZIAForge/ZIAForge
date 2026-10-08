import type { ResolvedApiConnection } from './ApiProviderStore'
import { validateApiBaseUrl } from './ApiProviderStore'
import { createHash } from 'node:crypto'
import type { GrokVideoArtifact } from './GrokProtocol'
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '../../shared/agent-media'
import { rasterInfo } from '../runtime/AgentMediaStore'

/** Protected file IDs only. No model-supplied URL, redirect, query key or browser login. */
export async function downloadApiImage(connection: ResolvedApiConnection, fileId: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<Buffer> {
  if (!connection.enabled || !/^file_[a-f0-9]{32}$/.test(fileId)) throw new Error('Invalid protected image file ID')
  const base = validateApiBaseUrl(connection.baseUrl)
  let response: Response
  try { response = await request(`${base}/files/${fileId}/content`, { headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}, signal, redirect: 'error' }) }
  catch { throw new Error('Protected image download failed') }
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error(`Protected image returned HTTP ${response.status}`) }
  const advertised = response.headers.get('content-length')
  if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > MAX_IMAGE_BYTES)) { await response.body.cancel(); throw new Error('Protected image exceeds its byte limit') }
  const reader = response.body.getReader(), chunks: Buffer[] = []
  let size = 0
  try {
    let done = false
    while (!done) { signal.throwIfAborted(); const next = await reader.read(); done = next.done; if (done) break; size += next.value!.byteLength; if (size > MAX_IMAGE_BYTES) throw new Error('Protected image exceeds its byte limit'); chunks.push(Buffer.from(next.value!)) }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  const bytes = Buffer.concat(chunks)
  const info = rasterInfo(bytes), mime = response.headers.get('content-type')?.split(';')[0].trim()
  if (mime !== info.mime) throw new Error('Protected image MIME does not match its bytes')
  return bytes
}

/** No storage/owner URLs are ever followed. All bytes come from the pinned Files endpoint. */
export async function downloadGrokVideo(connection: ResolvedApiConnection, artifact: GrokVideoArtifact, signal: AbortSignal, request: typeof fetch = fetch): Promise<Buffer> {
  if (!connection.enabled || connection.profile !== 'grok-connector-v1' || connection.transport !== 'responses' || artifact.kind !== 'video' || artifact.mime !== 'video/mp4' || !/^file_[a-f0-9]{32}$/.test(artifact.id) || !/^[a-f0-9]{64}$/.test(artifact.sha256) || !Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0 || artifact.bytes > MAX_VIDEO_BYTES) throw new Error('Invalid protected video metadata')
  const base = validateApiBaseUrl(connection.baseUrl)
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(120_000)])
  bounded.throwIfAborted()
  let response: Response
  try { response = await request(`${base}/files/${artifact.id}/content`, { headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}, signal: bounded, redirect: 'error' }) }
  catch { throw new Error('Protected video download failed or was cancelled') }
  if (response.status !== 200 || !response.body) { await response.body?.cancel(); throw new Error(`Protected video returned HTTP ${response.status}`) }
  const length = response.headers.get('content-length'), mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (mime !== 'video/mp4' || length !== null && (!/^\d+$/.test(length) || Number(length) !== artifact.bytes)) { await response.body.cancel(); throw new Error('Protected video MIME or length does not match its metadata') }
  const reader = response.body.getReader(), chunks: Buffer[] = []
  const abort = () => { void reader.cancel().catch(() => {}) }
  bounded.addEventListener('abort', abort, { once: true })
  let size = 0
  try {
    for (;;) {
      bounded.throwIfAborted()
      const chunk = await reader.read()
      bounded.throwIfAborted()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > artifact.bytes || size > MAX_VIDEO_BYTES) throw new Error('Protected video exceeds its declared byte limit')
      chunks.push(Buffer.from(chunk.value))
    }
  } finally { bounded.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock() }
  const bytes = Buffer.concat(chunks)
  if (bytes.length !== artifact.bytes || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw new Error('Protected video bytes do not match their native artifact metadata')
  return bytes
}
