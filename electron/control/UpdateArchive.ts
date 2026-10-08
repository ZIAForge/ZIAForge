import fs from 'node:fs'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'

const unsafePathCharacters = (value: string) => value.includes('\\') || value.includes(':') || [...value].some(character => character.charCodeAt(0) < 32)

/** Validate the ZIP directory and framework symlinks before ditto can write anything. */
export async function validateMacUpdateZip(filename: string): Promise<void> {
  const file = await fs.promises.open(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
  const read = async (offset: number, size: number) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || size < 0) throw new Error('Invalid update ZIP offsets')
    const buffer = Buffer.alloc(size)
    if ((await file.read(buffer, 0, size, offset)).bytesRead !== size) throw new Error('Truncated update ZIP')
    return buffer
  }
  try {
    const size = (await file.stat()).size
    const tailSize = Math.min(size, 65557), tail = await read(size - tailSize, tailSize)
    let end = -1
    for (let offset = tail.length - 22; offset >= 0; offset--) {
      if (tail.readUInt32LE(offset) === 0x06054b50 && offset + 22 + tail.readUInt16LE(offset + 20) === tail.length) { end = offset; break }
    }
    if (end < 0 || tail.readUInt16LE(end + 4) || tail.readUInt16LE(end + 6)) throw new Error('Unsupported update ZIP directory')
    const entries = tail.readUInt16LE(end + 10), directorySize = tail.readUInt32LE(end + 12), directoryOffset = tail.readUInt32LE(end + 16)
    if (!entries || entries > 20000 || entries !== tail.readUInt16LE(end + 8) || directorySize > 16 * 1024 * 1024 || directoryOffset + directorySize > size - tailSize + end) throw new Error('Invalid update ZIP directory bounds')
    const directory = await read(directoryOffset, directorySize), names = new Set<string>(), links = new Map<string, string>()
    let offset = 0, expandedBytes = 0
    for (let index = 0; index < entries; index++) {
      if (offset + 46 > directory.length || directory.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid update ZIP entry')
      const nameLength = directory.readUInt16LE(offset + 28), extraLength = directory.readUInt16LE(offset + 30), commentLength = directory.readUInt16LE(offset + 32)
      const entryEnd = offset + 46 + nameLength + extraLength + commentLength
      if (entryEnd > directory.length) throw new Error('Truncated update ZIP entry')
      const name = directory.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'), normalized = name.replace(/\/$/, '')
      const parts = normalized.split('/')
      if (!nameLength || !['ZIAForge.app'].includes(parts[0]) || parts.some(part => !part || part === '.' || part === '..') || unsafePathCharacters(name) || names.has(normalized.toLocaleLowerCase('en-US'))) throw new Error('Unsafe or duplicate update ZIP path')
      names.add(normalized.toLocaleLowerCase('en-US'))
      const flags = directory.readUInt16LE(offset + 8), method = directory.readUInt16LE(offset + 10), compressed = directory.readUInt32LE(offset + 20), expanded = directory.readUInt32LE(offset + 24), mode = directory.readUInt32LE(offset + 38) >>> 16
      const localOffset = directory.readUInt32LE(offset + 42)
      expandedBytes += expanded
      if (flags & 1 || ![0, 8].includes(method) || expandedBytes > 2 * 1024 * 1024 * 1024 || localOffset >= directoryOffset || (mode & 0xf000) && ![0x4000, 0x8000, 0xa000].includes(mode & 0xf000)) throw new Error('Unsupported update ZIP entry type')
      const local = await read(localOffset, 30)
      if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== flags || local.readUInt16LE(8) !== method || local.readUInt16LE(26) !== nameLength) throw new Error('Inconsistent local ZIP header')
      const localName = await read(localOffset + 30, nameLength)
      if (!localName.equals(directory.subarray(offset + 46, offset + 46 + nameLength))) throw new Error('Local ZIP filename differs from its directory')
      const dataOffset = localOffset + 30 + nameLength + local.readUInt16LE(28)
      if (dataOffset + compressed > directoryOffset) throw new Error('Invalid ZIP entry bounds')
      if (!(flags & 8) && (local.readUInt32LE(18) !== compressed || local.readUInt32LE(22) !== expanded || local.readUInt32LE(14) !== directory.readUInt32LE(offset + 16))) throw new Error('Local ZIP sizes differ from its directory')
      if ((mode & 0xf000) === 0xa000) {
        if (expanded > 4096 || compressed > 8192) throw new Error('Oversized update ZIP symlink')
        const data = await read(dataOffset, compressed), target = (method === 8 ? inflateRawSync(data, { maxOutputLength: 4096 }) : data).toString('utf8')
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(normalized), target))
        if (!target || target.startsWith('/') || unsafePathCharacters(target) || !resolved.startsWith('ZIAForge.app/')) throw new Error('Update ZIP symlink escapes the application')
        links.set(normalized.toLocaleLowerCase('en-US'), resolved.toLocaleLowerCase('en-US'))
      }
      offset = entryEnd
    }
    if (offset !== directory.length) throw new Error('Unexpected ZIP directory data')
    // No later archive entry may write through an extracted symlink. Framework
    // aliases are allowed, but must point to a real archived path without cycles.
    for (const name of names) {
      for (const link of links.keys()) if (name.startsWith(`${link}/`)) throw new Error('Update ZIP writes through a symlink')
    }
    for (const [name, initial] of links) {
      let target = initial
      const seen = new Set([name])
      for (let depth = 0; depth <= links.size; depth++) {
        if (seen.has(target)) throw new Error('Cyclic update ZIP symlink')
        seen.add(target)
        const prefix = [...links.keys()].find(link => target === link || target.startsWith(`${link}/`))
        if (!prefix) { if (!names.has(target)) throw new Error('Broken update ZIP symlink'); break }
        target = links.get(prefix)! + target.slice(prefix.length)
      }
    }
  } finally { await file.close() }
}
