/** Immutable private-cache references. Never contains a filesystem path, URL or encoded bytes. */
export interface AgentArtifactRef {
  id: string
  sourceRunId: string
  filename: string
  mime: string
  bytes: number
  sha256: string
  providerFileId: string
  revision?: number
  supersedesFileId?: string
}

/** Validated transport metadata; additional provider fields are never persisted by the artifact store. */
export interface AgentArtifactMetadata {
  id: string
  filename: string
  mime_type: string
  bytes: number
  sha256: string
  revision?: number
  supersedes_file_id?: string
}

export interface AgentArtifactRequest { sessionId: string; runId: string; artifactId: string }
export interface AgentArtifactAPI {
  read(request: AgentArtifactRequest): Promise<{ bytes: Uint8Array; mime: string }>
  /** Main shows the native Save dialog. Renderer callers never supply a destination. */
  save(request: AgentArtifactRequest): Promise<{ cancelled: boolean }>
}

export const MAX_ARTIFACT_BYTES = 128 * 1024 * 1024
export const MAX_ARTIFACT_CACHE_BYTES = 1024 * 1024 * 1024
export const MAX_ARTIFACTS_PER_EVENT = 32
export const MAX_ARTIFACT_EVENT_BYTES = 16 * 1024

const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}'
const artifactId = new RegExp(`^artifact-${uuid}$`)
// eslint-disable-next-line no-control-regex
const unsafeName = /[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/
export function validArtifactId(value: unknown): value is string { return typeof value === 'string' && artifactId.test(value) }
export function validArtifactProviderFileId(value: unknown): value is string { return typeof value === 'string' && /^file_[a-f0-9]{32}$/.test(value) }
export function validArtifactFilename(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value && !['.', '..'].includes(value) && !unsafeName.test(value)
}
export function validArtifactMime(value: unknown): value is string { return typeof value === 'string' && value.length <= 128 && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(value) }
const validSize = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_ARTIFACT_BYTES
const validDigest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 1

export function validArtifactMetadata(value: unknown): value is AgentArtifactMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as AgentArtifactMetadata
  return ['id', 'filename', 'mime_type', 'bytes', 'sha256'].every(key => Object.hasOwn(value, key)) &&
    validArtifactProviderFileId(item.id) && validArtifactFilename(item.filename) && validArtifactMime(item.mime_type) && validSize(item.bytes) && validDigest(item.sha256) &&
    (!Object.hasOwn(item, 'revision') || validRevision(item.revision)) &&
    (!Object.hasOwn(item, 'supersedes_file_id') || validArtifactProviderFileId(item.supersedes_file_id) && item.supersedes_file_id !== item.id)
}

export function validArtifactRef(value: unknown): value is AgentArtifactRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const ref = value as AgentArtifactRef
  const required = ['id', 'sourceRunId', 'filename', 'mime', 'bytes', 'sha256', 'providerFileId']
  const optional = ['revision', 'supersedesFileId']
  return required.every(key => Object.hasOwn(ref, key)) && Object.keys(ref).every(key => required.includes(key) || optional.includes(key)) &&
    validArtifactId(ref.id) && typeof ref.sourceRunId === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(ref.sourceRunId) &&
    validArtifactFilename(ref.filename) && validArtifactMime(ref.mime) && !['text/html', 'application/xhtml+xml', 'image/svg+xml'].includes(ref.mime) &&
    validSize(ref.bytes) && validDigest(ref.sha256) && validArtifactProviderFileId(ref.providerFileId) &&
    (!Object.hasOwn(ref, 'revision') || validRevision(ref.revision)) &&
    (!Object.hasOwn(ref, 'supersedesFileId') || validArtifactProviderFileId(ref.supersedesFileId) && ref.supersedesFileId !== ref.providerFileId)
}
