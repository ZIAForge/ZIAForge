/** Private cache references only. Never contains URLs, paths, credentials or encoded bytes. */
interface AgentMediaBase {
  id: string
  sourceRunId: string
  bytes: number
  sha256: string
  width: number
  height: number
}
export interface AgentImageRef extends AgentMediaBase { mime: 'image/png' | 'image/jpeg' | 'image/webp' }
export interface AgentVideoRef extends AgentMediaBase { mime: 'video/mp4'; durationMs?: number }
export type AgentMediaRef = AgentImageRef | AgentVideoRef
export interface AgentMediaRequest { sessionId: string; runId: string; mediaId: string }
export interface AgentMediaAPI {
  read(request: AgentMediaRequest): Promise<{ bytes: Uint8Array; mime: AgentMediaRef['mime'] }>
  save(request: AgentMediaRequest): Promise<{ cancelled: boolean }>
}

export const MAX_IMAGE_BYTES = 32 * 1024 * 1024
export const MAX_VIDEO_BYTES = 128 * 1024 * 1024
export function validMediaRef(value: unknown): value is AgentMediaRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const ref = value as AgentMediaRef
  const video = ref.mime === 'video/mp4'
  const keys = ['id', 'sourceRunId', 'mime', 'bytes', 'sha256', 'width', 'height', ...(video ? ['durationMs'] : [])]
  return Object.keys(ref).length === 7 + (video && Object.hasOwn(ref, 'durationMs') ? 1 : 0) && Object.keys(ref).every(key => keys.includes(key)) &&
    typeof ref.id === 'string' && /^media-[a-f0-9-]{36}$/.test(ref.id) && typeof ref.sourceRunId === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(ref.sourceRunId) &&
    (video || ['image/png', 'image/jpeg', 'image/webp'].includes(ref.mime)) && Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES) &&
    (!video || !Object.hasOwn(ref, 'durationMs') || Number.isSafeInteger(ref.durationMs) && ref.durationMs! > 0) &&
    typeof ref.sha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256) && Number.isSafeInteger(ref.width) && Number.isSafeInteger(ref.height) && ref.width > 0 && ref.height > 0 && ref.width <= 32768 && ref.height <= 32768 && ref.width * ref.height <= 32_000_000
}
export function validImageMediaRef(value: unknown): value is AgentImageRef { return validMediaRef(value) && value.mime !== 'video/mp4' }
