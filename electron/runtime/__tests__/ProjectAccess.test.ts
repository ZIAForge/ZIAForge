import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { authorizeProjectPath, folderName, projectDeletionTargets, updateRepositoryList } from '../ProjectAccess'
import type { StoredRepository } from '../../../shared/legacy-ipc'

describe('registered project filesystem boundary', () => {
  let directory: string
  let workspace: string
  let userHome: string
  let repo: StoredRepository
  beforeEach(() => {
    directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-access-')))
    workspace = path.join(directory, 'workspace')
    userHome = path.join(directory, 'home')
    const project = path.join(workspace, 'one')
    const source = path.join(directory, 'source')
    for (const folder of [project, source, userHome]) fs.mkdirSync(folder, { recursive: true })
    fs.symlinkSync(source, path.join(project, 'repo'))
    repo = { id: 'one', name: 'One', path: project, repoPath: path.join(project, 'repo'), canonicalProjectPath: project, sourcePath: source }
  })
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }) })

  it('allows source links, worktree files and new destinations within their own registered root', () => {
    expect(authorizeProjectPath(path.join(repo.repoPath, 'new', 'file.ts'), [repo])).toBe(path.join(repo.sourcePath!, 'new', 'file.ts'))
    expect(authorizeProjectPath(path.join(repo.path, 'worktrees', 'task', 'plan.json'), [repo])).toBe(path.join(repo.path, 'worktrees', 'task', 'plan.json'))
    expect(authorizeProjectPath(repo.sourcePath, [repo])).toBe(repo.sourcePath)
  })

  it('rejects prefix collisions, traversal, relative paths and symlink escapes on reads and new writes', () => {
    fs.symlinkSync(userHome, path.join(repo.sourcePath!, 'escape'))
    for (const target of [path.join(workspace, 'one-other'), path.join(repo.path, '..', 'other'), 'relative', path.join(repo.repoPath, 'escape', 'secret'), path.join(repo.repoPath, 'escape', 'new', 'file')]) {
      expect(() => authorizeProjectPath(target, [repo]), target).toThrow()
    }
  })

  it('rejects a retargeted repository root rather than granting its new destination', () => {
    fs.unlinkSync(repo.repoPath); fs.symlinkSync(userHome, repo.repoPath)
    expect(() => authorizeProjectPath(path.join(repo.repoPath, 'secret'), [repo])).toThrow()
    expect(() => projectDeletionTargets({ repoId: repo.id, deleteWorkspaceDir: false, deleteSourceDir: true }, [repo], workspace, userHome)).toThrow()
    expect(fs.existsSync(userHome)).toBe(true)
  })

  it('accepts deletion only by registered ID and checks both targets before any operation', () => {
    expect(projectDeletionTargets({ repoId: repo.id, deleteWorkspaceDir: true, deleteSourceDir: true }, [repo], workspace, userHome)).toEqual([repo.path, repo.sourcePath])
    expect(() => projectDeletionTargets({ repoId: repo.id, projectPath: userHome, deleteWorkspaceDir: true, deleteSourceDir: false }, [repo], workspace, userHome)).toThrow()
    expect(() => projectDeletionTargets({ repoId: 'other', deleteWorkspaceDir: true, deleteSourceDir: true }, [repo], workspace, userHome)).toThrow()
    expect(fs.existsSync(repo.path)).toBe(true)
  })

  it('does not delete a sibling workspace prefix, protected ancestor or another registered project', () => {
    const sibling = path.join(directory, 'workspace-extra'); fs.mkdirSync(sibling)
    expect(() => projectDeletionTargets({ repoId: repo.id, deleteWorkspaceDir: true, deleteSourceDir: false }, [{ ...repo, path: sibling, canonicalProjectPath: sibling }], workspace, userHome)).toThrow()
    expect(() => projectDeletionTargets({ repoId: repo.id, deleteWorkspaceDir: false, deleteSourceDir: true }, [{ ...repo, repoPath: userHome, sourcePath: userHome }], workspace, userHome)).toThrow()
    const other = { ...repo, id: 'two', name: 'Two' }
    expect(() => projectDeletionTargets({ repoId: repo.id, deleteWorkspaceDir: true, deleteSourceDir: true }, [repo, other], workspace, userHome)).toThrow(/another/)
  })

  it('prevents registration forgery while retaining backend grants when the renderer saves its list', () => {
    expect(updateRepositoryList([{ ...repo, name: 'Renamed', sourcePath: userHome }], [repo])[0]).toMatchObject({ name: 'Renamed', sourcePath: repo.sourcePath })
    expect(() => updateRepositoryList([{ ...repo, path: userHome }], [repo])).toThrow()
    expect(() => updateRepositoryList([{ ...repo, id: 'new' }], [repo])).toThrow()
    expect(() => updateRepositoryList([repo, repo], [repo])).toThrow()
    expect(updateRepositoryList([], [repo])).toEqual([])
  })

  it('requires a single folder name for project and workspace creation', () => {
    expect(folderName(' A project ')).toBe('A project')
    for (const name of ['', '.', '..', '../sibling', '/absolute', 'nested/path', 'a\\b', 'a\0b']) expect(() => folderName(name)).toThrow()
  })
})
