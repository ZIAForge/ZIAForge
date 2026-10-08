/** Private cache references only. Never contains URLs, paths, credentials or encoded bytes. */
export interface AgentMediaRef {
  id: string
  sourceRunId: string
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
  bytes: number
  sha256: string
  width: number
  height: number
}
export interface AgentMediaRequest { sessionId: string; runId: string; mediaId: string }
export interface AgentMediaAPI {
  read(request: AgentMediaRequest): Promise<{ bytes: Uint8Array; mime: AgentMediaRef['mime'] }>
  save(request: AgentMediaRequest): Promise<{ cancelled: boolean }>
}

export const MAX_IMAGE_BYTES = 32 * 1024 * 1024
export function validMediaRef(value: unknown): value is AgentMediaRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const ref = value as AgentMediaRef
  return Object.keys(ref).length === 7 && Object.keys(ref).every(key => ['id', 'sourceRunId', 'mime', 'bytes', 'sha256', 'width', 'height'].includes(key)) &&
    typeof ref.id === 'string' && /^media-[a-f0-9-]{36}$/.test(ref.id) && typeof ref.sourceRunId === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(ref.sourceRunId) &&
    ['image/png', 'image/jpeg', 'image/webp'].includes(ref.mime) && Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= MAX_IMAGE_BYTES &&
    typeof ref.sha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256) && Number.isSafeInteger(ref.width) && Number.isSafeInteger(ref.height) && ref.width > 0 && ref.height > 0 && ref.width * ref.height <= 32_000_000
}
