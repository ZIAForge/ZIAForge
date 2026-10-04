import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { StoredRepository } from '../../shared/legacy-ipc'
import { authorizeProjectPath, folderName, isWithin } from './ProjectAccess'
import type { WorkFolderGrant } from './WorkInputGrants'

/** Keep task metadata in app-owned storage while using the explicitly selected folder as cwd. */
export function registerSelectedWorkFolder(workspace: string, grant: WorkFolderGrant, repositories: StoredRepository[]): StoredRepository {
  const existing = repositories.find(repo => repo.kind === 'folder' && repo.sourcePath === grant.path && repo.path !== repo.sourcePath)
  if (existing) { authorizeProjectPath(grant.path, [existing]); return existing }
  const repo = registerWorkFolder(workspace, `Work-${grant.id.slice(-12)}`, repositories)
  return { ...repo, name: grant.name, repoPath: grant.path, sourcePath: grant.path }
}

/** App-owned Work projects never initialize Git or change another project's kind. */
export function registerWorkFolder(workspace: string, selectedName: unknown, repositories: StoredRepository[]): StoredRepository {
  const name = folderName(selectedName)
  fs.mkdirSync(workspace, { recursive: true })
  const root = fs.realpathSync(workspace)
  const project = path.join(root, name)
  if (fs.existsSync(project) && fs.lstatSync(project).isSymbolicLink()) throw new Error('A Work project folder cannot be a symlink')
  const registered = repositories.find(repo => path.resolve(repo.path) === project)
  if (registered) {
    if (registered.kind !== 'folder') throw new Error('This folder belongs to a Code project. Choose a separate Work folder.')
    authorizeProjectPath(project, [registered])
    return registered
  }
  if (fs.existsSync(path.join(project, 'repo')) || fs.existsSync(path.join(project, 'tasks.json'))) throw new Error('This folder already contains project metadata; choose another name')
  fs.mkdirSync(project, { recursive: true })
  if (!fs.statSync(project).isDirectory() || !isWithin(root, fs.realpathSync(project), false)) throw new Error('Invalid Work folder')
  const work = path.join(project, 'worktrees')
  fs.mkdirSync(work, { recursive: true })
  return { id: `folder-${randomUUID()}`, name, kind: 'folder', path: project, repoPath: project, canonicalProjectPath: project, sourcePath: project }
}

export function prepareFolderTask(repo: StoredRepository, taskId: string): string {
  if (repo.kind !== 'folder' || !/^[A-Za-z0-9_-]{1,160}$/.test(taskId)) throw new Error('Invalid Work task')
  const project = authorizeProjectPath(repo.path, [repo])
  const target = path.join(project, 'worktrees', taskId)
  for (const candidate of [path.dirname(target), target]) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) throw new Error('Work task directory must not be a symlink')
  }
  fs.mkdirSync(target, { recursive: true })
  const resolved = fs.realpathSync(target)
  if (!isWithin(project, resolved, false)) throw new Error('Work task escaped the registered project')
  return resolved
}
