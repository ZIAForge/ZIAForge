import path from 'node:path'
import type { GitAPI } from '../../shared/git'

export function gitId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) throw new Error('Invalid Git operation or task identity')
}
export function gitBranch(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > 200 || value.startsWith('-') || value.startsWith('/') || value.endsWith('/') || value.endsWith('.') || value.includes('..') || value.includes('@{') || value.includes('//') || /[~^:?*\\[]/.test(value) || [...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) || value.split('/').some(part => part.startsWith('.') || part.endsWith('.lock')) || value === '@') throw new Error('Invalid local branch name')
}
export function gitPath(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > 4096 || value.includes('\0') || path.isAbsolute(value) || value.split('/').some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git')) throw new Error('Expected a repository-relative file path')
}
function hash(value: unknown): void { if (typeof value !== 'string' || !/^[a-f0-9]{40,64}$/.test(value)) throw new Error('Expected a verified Git revision or fingerprint') }

export function validateGitCommand<K extends keyof GitAPI>(kind: K, request: unknown): asserts request is Parameters<GitAPI[K]>[0] {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Expected a Git request')
  const item = request as Record<string, unknown>
  const fields: Record<keyof GitAPI, string[]> = {
    prepare: ['taskId'], status: ['taskId'], diff: ['taskId', 'scope', 'path'],
    commit: ['taskId', 'operationId', 'expectedHead', 'expectedStatusFingerprint', 'message', 'paths'],
    push: ['taskId', 'operationId', 'expectedHead', 'remote'],
    merge: ['taskId', 'operationId', 'expectedHead', 'targetBranch', 'expectedTargetHead'],
    removeWorktree: ['taskId', 'operationId', 'expectedHead', 'expectedStatusFingerprint'],
  }
  if (Object.keys(item).some(key => !fields[kind].includes(key))) throw new Error('Unknown Git request fields')
  gitId(item.taskId)
  if (kind === 'prepare' || kind === 'status') return
  if (kind === 'diff') {
    if (!['working', 'staged', 'base'].includes(String(item.scope))) throw new Error('Invalid diff scope')
    if (item.path !== undefined) gitPath(item.path)
    return
  }
  gitId(item.operationId); hash(item.expectedHead)
  if (kind === 'commit' || kind === 'removeWorktree') hash(item.expectedStatusFingerprint)
  if (kind === 'commit') {
    if (typeof item.message !== 'string' || !item.message.trim() || item.message.length > 10000 || item.message.includes('\0')) throw new Error('A bounded commit message is required')
    if (!Array.isArray(item.paths) || !item.paths.length || item.paths.length > 1000) throw new Error('Select the files to commit')
    item.paths.forEach(gitPath)
    if (new Set(item.paths).size !== item.paths.length) throw new Error('Duplicate commit paths')
  }
  if (kind === 'push' && (typeof item.remote !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(item.remote))) throw new Error('Select a saved Git remote name')
  if (kind === 'merge') { gitBranch(item.targetBranch); hash(item.expectedTargetHead) }
}
