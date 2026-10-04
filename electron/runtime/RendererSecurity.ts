import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Only the application's top-level document may invoke privileged IPC. */
export function isTrustedRendererUrl(url: string, rendererFile: string, devServer?: string): boolean {
  try {
    const target = new URL(url)
    if (devServer) {
      const expected = new URL(devServer)
      return target.origin === expected.origin && target.pathname === expected.pathname &&
        !target.username && !target.password
    }
    return target.protocol === 'file:' && !target.host &&
      path.resolve(fileURLToPath(target)) === path.resolve(rendererFile)
  } catch { return false }
}

export function isAllowedExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 8192 || [...value].some(char => char.charCodeAt(0) <= 32)) return false
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}

/** Validate both lexical and canonical containment; a symlink cannot escape the selected root. */
export function canonicalChildDirectory(root: string, candidate: string): string {
  const absoluteRoot = path.resolve(root)
  const absoluteCandidate = path.resolve(candidate)
  const relative = path.relative(absoluteRoot, absoluteCandidate)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Directory is outside the selected project')
  }
  const canonicalRoot = fs.realpathSync(absoluteRoot)
  const canonicalCandidate = fs.realpathSync(absoluteCandidate)
  const canonicalRelative = path.relative(canonicalRoot, canonicalCandidate)
  if (!canonicalRelative || canonicalRelative === '..' || canonicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(canonicalRelative)) {
    throw new Error('Directory resolves outside the selected project')
  }
  if (!fs.statSync(canonicalCandidate).isDirectory()) throw new Error('Expected a project directory')
  return canonicalCandidate
}

export function assertTrustedSender(
  event: { sender: unknown; senderFrame: unknown },
  expected: { mainFrame: unknown } | null | undefined,
  url: string,
  rendererFile: string,
  devServer?: string,
): void {
  if (!expected || event.sender !== expected || event.senderFrame !== expected.mainFrame ||
      !isTrustedRendererUrl(url, rendererFile, devServer)) {
    throw new Error('IPC is restricted to the application main frame')
  }
}
