const fs = require('node:fs')

const cpu = value => ({ 0x01000007: 'x64', 0x0100000c: 'arm64', 0x8664: 'x64', 0xaa64: 'arm64', 62: 'x64', 183: 'arm64' })[value]
function architectures(filename) {
  const fd = fs.openSync(filename, 'r')
  const bytes = Buffer.alloc(65536)
  let length
  try { length = fs.readSync(fd, bytes, 0, bytes.length, 0) } finally { fs.closeSync(fd) }
  if (length < 64) throw new Error(`Truncated executable: ${filename}`)
  if (bytes.readUInt32LE(0) === 0xfeedfacf) return { format: 'Mach-O', arches: [cpu(bytes.readUInt32LE(4))].filter(Boolean) }
  const magic = bytes.readUInt32BE(0)
  if (magic === 0xcafebabe || magic === 0xcafebabf) {
    const count = bytes.readUInt32BE(4), stride = magic === 0xcafebabe ? 20 : 32
    if (!count || count > 16 || 8 + count * stride > length) throw new Error('Invalid Mach-O fat header')
    return { format: 'Mach-O', arches: [...new Set(Array.from({ length: count }, (_, i) => cpu(bytes.readUInt32BE(8 + i * stride))).filter(Boolean))] }
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([0x7f, 69, 76, 70]))) {
    if (bytes[4] !== 2 || bytes[5] !== 1) throw new Error('Only 64-bit little-endian ELF targets are supported')
    return { format: 'ELF', arches: [cpu(bytes.readUInt16LE(18))].filter(Boolean) }
  }
  if (bytes.toString('ascii', 0, 2) === 'MZ') {
    const offset = bytes.readUInt32LE(0x3c)
    if (offset + 6 > length || bytes.toString('ascii', offset, offset + 4) !== 'PE\0\0') throw new Error('Invalid PE header')
    return { format: 'PE', arches: [cpu(bytes.readUInt16LE(offset + 4))].filter(Boolean) }
  }
  throw new Error(`Unrecognized executable format: ${filename}`)
}
function assertArchitecture(filename, platform, arch) {
  const result = architectures(filename)
  const expected = { darwin: 'Mach-O', win32: 'PE', linux: 'ELF' }[platform]
  if (result.format !== expected || !result.arches.includes(arch)) throw new Error(`Wrong ${platform}/${arch} binary: ${filename} (${JSON.stringify(result)})`)
  return result
}
module.exports = { architectures, assertArchitecture }
