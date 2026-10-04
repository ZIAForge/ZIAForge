import fs from 'node:fs'
import path from 'node:path'
import { authorizeProjectPath, isWithin } from './ProjectAccess'
import type { StoredRepository, StoredTask } from '../../shared/legacy-ipc'

export interface StoredTaskContext {
  task: StoredTask
  repo: StoredRepository
  tasksFile: string
  projectTasks: StoredTask[]
}

/** A damaged project index must not prevent resolving another registered project. */
export function findStoredTaskContext(taskId: string, repositories: StoredRepository[]): StoredTaskContext {
  for (const repo of repositories) {
    if (!repo || typeof repo.path !== 'string' || !repo.path) continue
    let filename: string
    let tasks: unknown
    try {
      const project = authorizeProjectPath(repo.path, [repo])
      filename = authorizeProjectPath(path.join(project, 'tasks.json'), [repo])
      if (!isWithin(project, filename, false)) continue
      tasks = JSON.parse(fs.readFileSync(filename, 'utf8'))
    }
    catch { continue }
    if (!Array.isArray(tasks)) continue
    const task = tasks.find((candidate: unknown) => candidate !== null && typeof candidate === 'object' &&
      !Array.isArray(candidate) && 'id' in candidate && candidate.id === taskId &&
      'repoId' in candidate && candidate.repoId === repo.id) as StoredTask | undefined
    if (task) return { task, repo, tasksFile: filename, projectTasks: tasks as StoredTask[] }
  }
  throw new Error('The selected task is not registered in this application')
}
