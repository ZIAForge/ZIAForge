import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, validMediaRef, type AgentMediaAPI, type AgentMediaRef } from '../../../shared/agent-media'
import { uiKey, uiText } from '../../uiText'

function hasMP4Signature(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const limit = Math.min(bytes.length, 64 * 1024)
  for (let offset = 0, boxes = 0; offset + 8 <= limit && boxes < 4096; boxes++) {
    let size = view.getUint32(offset)
    let header = 8
    if (size === 1) {
      if (offset + 16 > limit) return false
      const extended = view.getBigUint64(offset + 8)
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return false
      size = Number(extended)
      header = 16
    }
    if (size === 0) size = bytes.length - offset
    if (size < header || offset + size > bytes.length) return false
    if ([102, 116, 121, 112].every((value, index) => bytes[offset + index + 4] === value)) return size >= header + 8
    offset += size
  }
  return false
}

/** Only bounded image/MP4 bytes returned by the owned IPC channel enter a Blob. */
export function safeMediaBlob(media: AgentMediaRef, result: Awaited<ReturnType<AgentMediaAPI['read']>>): Blob {
  const video = media.mime === 'video/mp4'
  const invalid = () => new Error(video ? uiKey('video_invalid') : uiText('Invalid generated image data'))
  if (!validMediaRef(media) || result.mime !== media.mime || !(result.bytes instanceof Uint8Array) ||
    result.bytes.byteLength !== media.bytes || result.bytes.byteLength > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) throw invalid()
  const bytes = result.bytes
  const matches = video
    ? hasMP4Signature(bytes)
    : media.mime === 'image/png'
    ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    : media.mime === 'image/jpeg'
      ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && [82, 73, 70, 70].every((value, index) => bytes[index] === value) && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)
  if (!matches) throw invalid()
  // Copy the view into an owned ArrayBuffer, including sliced/IPC-backed views.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer], { type: media.mime })
}
