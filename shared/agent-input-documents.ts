import { validInputImageOwner, type AgentInputImageOwner } from './agent-input-images'

/** Native file-picker custody matches image inputs; no renderer paths or inline bytes. */
export type AgentInputDocumentOwner = AgentInputImageOwner
export interface AgentInputDocumentRef { id: string; name: string; mime: 'application/pdf' | 'text/plain'; bytes: number; sha256: string }

export const MAX_INPUT_DOCUMENT_BYTES = 16 * 1024 * 1024
export const MAX_INPUT_TEXT_DOCUMENT_BYTES = 1024 * 1024
export const MAX_INPUT_DOCUMENT_BATCH_BYTES = 20 * 1024 * 1024
export const MAX_INPUT_DOCUMENTS = 4
export const MAX_INPUT_DOCUMENT_CACHE_BYTES = 128 * 1024 * 1024

export const validInputDocumentOwner = validInputImageOwner
export function validInputDocumentId(value: unknown): value is string {
  return typeof value === 'string' && /^input-document-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
}
// eslint-disable-next-line no-control-regex
const unsafeName = /[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/
export function validInputDocumentRef(value: unknown): value is AgentInputDocumentRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const ref = value as AgentInputDocumentRef
  const keys = ['id', 'name', 'mime', 'bytes', 'sha256']
  return Object.keys(ref).length === keys.length && Object.keys(ref).every(key => keys.includes(key)) &&
    validInputDocumentId(ref.id) && typeof ref.name === 'string' && ref.name.length > 0 && ref.name.length <= 160 && ref.name.trim() === ref.name &&
    !['.', '..'].includes(ref.name) && !unsafeName.test(ref.name) && ['application/pdf', 'text/plain'].includes(ref.mime) &&
    Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= (ref.mime === 'text/plain' ? MAX_INPUT_TEXT_DOCUMENT_BYTES : MAX_INPUT_DOCUMENT_BYTES) && typeof ref.sha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256)
}
