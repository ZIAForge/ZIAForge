import type { ResolvedApiConnection } from './ApiProviderStore'
import { validateApiBaseUrl } from './ApiProviderStore'
import { MAX_IMAGE_BYTES } from '../../shared/agent-media'
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
