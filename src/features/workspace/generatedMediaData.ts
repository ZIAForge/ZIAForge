import { MAX_IMAGE_BYTES, validMediaRef, type AgentMediaAPI, type AgentMediaRef } from '../../../shared/agent-media'
import { uiText } from '../../uiText'

/** Only bounded raster bytes returned by the owned IPC channel enter a Blob. */
export function safeMediaBlob(media: AgentMediaRef, result: Awaited<ReturnType<AgentMediaAPI['read']>>): Blob {
  if (!validMediaRef(media) || result.mime !== media.mime || !(result.bytes instanceof Uint8Array) ||
    result.bytes.byteLength !== media.bytes || result.bytes.byteLength > MAX_IMAGE_BYTES) throw new Error(uiText('Invalid generated image data'))
  const bytes = result.bytes
  const matches = media.mime === 'image/png'
    ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    : media.mime === 'image/jpeg'
      ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && [82, 73, 70, 70].every((value, index) => bytes[index] === value) && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)
  if (!matches) throw new Error(uiText('Invalid generated image data'))
  // Copy the view into an owned ArrayBuffer, including sliced/IPC-backed views.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type: media.mime })
}
