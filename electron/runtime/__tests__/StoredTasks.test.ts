import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findStoredTaskContext } from '../StoredTasks'
import type { StoredRepository } from '../../../shared/legacy-ipc'

describe('registered task lookup', () => {
  let directory: string
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-task-lookup-')) })
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }) })
  function repository(id: string, contents?: string): StoredRepository {
    const folder = path.join(directory, id)
    fs.mkdirSync(folder)
    if (contents !== undefined) fs.writeFileSync(path.join(folder, 'tasks.json'), contents)
    return { id, name: id, path: folder, repoPath: folder }
  }

  it('isolates missing, torn, non-array and invalid entries in unrelated indexes', () => {
    const malformed = '[{"id":'
    const repos = [repository('missing'), repository('torn', malformed), repository('object', '{}'),
      repository('invalid', '[null,7,[],{"id":"target","repoId":"elsewhere"}]'),
      repository('healthy', '[{"id":"target","repoId":"healthy","name":"Target"}]')]
    const result = findStoredTaskContext('target', repos)
    expect(result.repo.id).toBe('healthy')
    expect(result.tasksFile).toBe(fs.realpathSync(path.join(repos[4].path, 'tasks.json')))
    expect(result.task).toBe(result.projectTasks[0])
    expect(fs.readFileSync(path.join(repos[1].path, 'tasks.json'), 'utf8')).toBe(malformed)
  })

  it('fails closed when the task is absent or belongs to another repository', () => {
    const repos = [repository('torn', '['), repository('wrong', '[{"id":"target","repoId":"unregistered"}]')]
    expect(() => findStoredTaskContext('target', repos)).toThrow(/not registered/)
    expect(() => findStoredTaskContext('absent', repos)).toThrow(/not registered/)
  })
  it('rejects a replaced registered root even when the outside index contains the matching task identity', () => {
    const repo = repository('registered', '[{"id":"target","repoId":"registered"}]')
    repo.canonicalProjectPath = fs.realpathSync(repo.path)
    repo.sourcePath = fs.realpathSync(repo.repoPath)
    const outside = repository('outside', '[{"id":"target","repoId":"registered"}]')
    const bytes = fs.readFileSync(path.join(outside.path, 'tasks.json'), 'utf8')
    fs.renameSync(repo.path, `${repo.path}-old`)
    fs.symlinkSync(outside.path, repo.path, 'dir')
    expect(() => findStoredTaskContext('target', [repo])).toThrow(/not registered/)
    expect(fs.readFileSync(path.join(outside.path, 'tasks.json'), 'utf8')).toBe(bytes)
    const healthy = repository('healthy', '[{"id":"valid","repoId":"healthy"}]')
    expect(findStoredTaskContext('valid', [repo, healthy]).repo.id).toBe('healthy')
  })

  it('does not read task metadata linked outside the registered project', () => {
    const repo = repository('registered')
    repo.canonicalProjectPath = fs.realpathSync(repo.path)
    repo.sourcePath = fs.realpathSync(repo.repoPath)
    const outside = repository('outside', '[{"id":"target","repoId":"registered"}]')
    fs.symlinkSync(path.join(outside.path, 'tasks.json'), path.join(repo.path, 'tasks.json'))
    expect(() => findStoredTaskContext('target', [repo])).toThrow(/not registered/)
  })

})
