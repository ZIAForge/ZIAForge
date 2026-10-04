import fs from 'node:fs'
import path from 'node:path'
import type { StoredRepository } from '../../shared/legacy-ipc'

export function isWithin(root: string, candidate: string, allowRoot = true): boolean {
  const relative = path.relative(root, candidate)
  return (allowRoot || relative !== '') && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export function absolutePath(value: unknown): string {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.length > 4096 || [...value].some(char => char.charCodeAt(0) < 32)) throw new Error('Expected an absolute project path')
  return path.resolve(value)
}

export function folderName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || (/[/\\]/.test(value) || [...value].some(char => char.charCodeAt(0) < 32)) || ['.', '..'].includes(value.trim())) throw new Error('Expected a single folder name')
  return value.trim()
}

function canonicalDestination(candidate: string): string {
  let existing = candidate
  const missing: string[] = []
  for (;;) {
    try { fs.lstatSync(existing); break }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const parent = path.dirname(existing)
      if (parent === existing) throw new Error('Project root does not exist')
      missing.unshift(path.basename(existing)); existing = parent
    }
  }
  return path.join(fs.realpathSync(existing), ...missing)
}

/** Resolve only beneath the same registered root, including non-existent write destinations. */
export function authorizeProjectPath(value: unknown, repositories: StoredRepository[]): string {
  const candidate = absolutePath(value)
  for (const repo of repositories) {
    for (const [alias, pinned] of [[repo.path, repo.canonicalProjectPath], [repo.repoPath, repo.sourcePath], ...(repo.workDirectories ?? []).map(root => [root, root])] as const) {
      if (!alias) continue
      try {
        const root = absolutePath(alias)
        const canonical = fs.realpathSync(root)
        if (pinned && canonical !== pinned) continue
        // Callers may use either the saved repo link or its canonical source path.
        if (!isWithin(root, candidate) && !isWithin(canonical, candidate)) continue
        const resolved = canonicalDestination(candidate)
        if (isWithin(canonical, resolved)) return resolved
      } catch { /* A broken registration grants no filesystem access. */ }
    }
  }
  throw new Error('Path is outside the registered project roots')
}

/** The renderer may remove/reorder/rename registrations, but cannot invent filesystem grants. */
export function updateRepositoryList(value: unknown, current: StoredRepository[]): StoredRepository[] {
  if (!Array.isArray(value)) throw new Error('Expected registered projects')
  const seen = new Set<string>()
  return value.map(candidate => {
    if (!candidate || typeof candidate !== 'object' || typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !candidate.name.trim() || candidate.name.length > 200 || seen.has(candidate.id)) throw new Error('Invalid project registration')
    seen.add(candidate.id)
    const saved = current.find(repo => repo.id === candidate.id)
    if (!saved || candidate.path !== saved.path || candidate.repoPath !== saved.repoPath) throw new Error('Project paths can only be registered through the folder picker')
    return { ...saved, name: candidate.name }
  })
}

export interface DeleteProjectRequest { repoId: string; deleteWorkspaceDir: boolean; deleteSourceDir: boolean }

/** Validate every target before deleting anything; never trust renderer-supplied paths. */
export function projectDeletionTargets(value: unknown, repositories: StoredRepository[], workspace: string, userHome: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a project deletion request')
  const data = value as Record<string, unknown>
  if (Object.keys(data).some(key => !['repoId', 'deleteWorkspaceDir', 'deleteSourceDir'].includes(key)) || typeof data.repoId !== 'string' || typeof data.deleteWorkspaceDir !== 'boolean' || typeof data.deleteSourceDir !== 'boolean') throw new Error('Invalid project deletion request')
  const repo = repositories.find(item => item.id === data.repoId)
  if (!repo) throw new Error('Project is not registered')
  const targets: string[] = []
  const canonicalWorkspace = fs.realpathSync(absolutePath(workspace))
  const canonicalHome = fs.realpathSync(absolutePath(userHome))
  if (data.deleteWorkspaceDir && fs.existsSync(repo.path)) {
    const project = authorizeProjectPath(repo.path, [repo])
    if (!isWithin(canonicalWorkspace, project, false) || fs.lstatSync(repo.path).isSymbolicLink()) throw new Error('Workspace deletion is restricted to its registered project directory')
    targets.push(project)
  }
  if (data.deleteSourceDir && fs.existsSync(repo.repoPath)) targets.push(authorizeProjectPath(repo.repoPath, [repo]))
  for (const target of targets) {
    if (isWithin(target, canonicalHome) || isWithin(target, canonicalWorkspace)) throw new Error('Cannot delete a protected directory or its ancestor')
    for (const other of repositories.filter(item => item.id !== repo.id)) {
      for (const otherPath of [other.path, other.repoPath, ...(other.workDirectories ?? [])]) {
        if (otherPath && fs.existsSync(otherPath) && isWithin(target, fs.realpathSync(otherPath))) throw new Error('Deletion would affect another registered project')
      }
    }
  }
  return [...new Set(targets)]
}
