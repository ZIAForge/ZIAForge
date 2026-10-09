/** Main issues these references after an explicit native file selection. No paths or encoded bytes. */
export interface AgentInputImageOwner {
  taskId: string
  chatId: string
  sessionId: string
  runId: string
}

export interface AgentInputImageRef {
  id: string
  name: string
  mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  bytes: number
  width: number
  height: number
  sha256: string
}

export const MAX_INPUT_IMAGE_BYTES = 16 * 1024 * 1024
export const MAX_INPUT_IMAGE_BATCH_BYTES = 20 * 1024 * 1024
export const MAX_INPUT_IMAGES = 4
export const MAX_INPUT_IMAGE_CACHE_BYTES = 128 * 1024 * 1024

export function validInputImageId(value: unknown): value is string {
  return typeof value === 'string' && /^input-image-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
}

export function validInputImageOwner(value: unknown): value is AgentInputImageOwner {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const owner = value as AgentInputImageOwner
  const keys = ['taskId', 'chatId', 'sessionId', 'runId'] as const
  return Object.keys(owner).length === keys.length && keys.every(key => typeof owner[key] === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(owner[key]))
}

// Native filenames must remain printable single path segments, including on other platforms.
// eslint-disable-next-line no-control-regex
const unsafeName = /[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/
export function validInputImageRef(value: unknown): value is AgentInputImageRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const ref = value as AgentInputImageRef
  const keys = ['id', 'name', 'mime', 'bytes', 'width', 'height', 'sha256']
  return Object.keys(ref).length === keys.length && Object.keys(ref).every(key => keys.includes(key)) &&
    validInputImageId(ref.id) && typeof ref.name === 'string' && ref.name.length > 0 && ref.name.length <= 160 &&
    ref.name.trim() === ref.name && !['.', '..'].includes(ref.name) && !unsafeName.test(ref.name) &&
    ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(ref.mime) &&
    Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= MAX_INPUT_IMAGE_BYTES &&
    Number.isSafeInteger(ref.width) && Number.isSafeInteger(ref.height) && ref.width > 0 && ref.height > 0 &&
    ref.width <= 32768 && ref.height <= 32768 && ref.width * ref.height <= 32_000_000 &&
    typeof ref.sha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256)
}
