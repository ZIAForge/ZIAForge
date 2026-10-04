import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GitService } from '../../git/GitService'
import { WorkflowGitFinalizer, type FinalizeGitRequest } from '../WorkflowGitFinalizer'
import { workspaceEvidence } from '../WorkflowHost'
import type { WorkflowGitReceipt } from '../../../shared/workflow'

describe('verified Git finalization through real task repositories', () => {
  let root: string, repo: string, project: string, cwd: string, git: GitService, finalizer: WorkflowGitFinalizer
  const command = (directory: string, args: string[]) => execFileSync('/usr/bin/git', ['-C', directory, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  beforeEach(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-final-git-')))
    repo = path.join(root, 'source'); project = path.join(root, 'project'); cwd = path.join(project, 'worktrees', 'task')
    fs.mkdirSync(repo); fs.mkdirSync(project)
    command(repo, ['init', '-b', 'main']); command(repo, ['config', 'user.name', 'Fixture']); command(repo, ['config', 'user.email', 'fixture@example.test'])
    fs.writeFileSync(path.join(repo, 'file.txt'), 'initial\n'); command(repo, ['add', '.']); command(repo, ['commit', '-m', 'initial'])
    git = new GitService({ directory: path.join(root, 'git'), env: () => process.env, resolveTask: () => ({ taskId: 'task', projectPath: project, repoPath: repo, worktreePath: cwd, mode: 'worktree', branch: 'task', baseRef: 'main', createBranch: true }) })
    await git.prepare({ taskId: 'task' })
    fs.writeFileSync(path.join(cwd, 'file.txt'), 'verified\n')
    finalizer = new WorkflowGitFinalizer({ directory: path.join(root, 'finalization'), git, validateTask() {} })
  }, 20000)
  afterEach(async () => { await git?.shutdown(); fs.rmSync(root, { recursive: true, force: true }) })
  async function request(): Promise<FinalizeGitRequest> {
    const evidence = await workspaceEvidence(cwd, process.env)
    return { taskId: 'task', workflowRunId: 'workflow', id: 'finalization', policy: { commit: 'after-plan', merge: 'manual', push: 'manual' }, inputFingerprint: createHash('sha256').update(evidence).digest('hex'), assertVerified: async () => { if (await workspaceEvidence(cwd, process.env) !== evidence) throw new Error('Verified evidence changed') } }
  }
  it('commits only the verified task result, preserves its receipt across restart and never duplicates the commit', async () => {
    const input = await request()
    const observed: WorkflowGitReceipt[] = []
    const first = await finalizer.run(input, new AbortController().signal, async receipt => { observed.push(receipt) })
    expect(first.status).toBe('completed')
    expect(first.operations.map(item => [item.kind, item.status])).toEqual([['commit', 'succeeded']])
    const head = command(cwd, ['rev-parse', 'HEAD'])
    expect(command(cwd, ['show', 'HEAD:file.txt'])).toBe('verified')
    expect(command(repo, ['show', 'HEAD:file.txt'])).toBe('initial')
    const restarted = new WorkflowGitFinalizer({ directory: path.join(root, 'finalization'), git, validateTask() {} })
    const second = await restarted.run(input, new AbortController().signal, async () => {})
    expect(second).toEqual(first)
    expect(command(cwd, ['rev-parse', 'HEAD'])).toBe(head)
    expect(command(cwd, ['rev-list', '--count', 'HEAD'])).toBe('2')
    expect(observed.at(-1)?.status).toBe('completed')
  }, 30000)
  it('keeps completed commit and merge when push fails, then retries only push after explicit continuation', async () => {
    const remote = path.join(root, 'remote.git')
    command(repo, ['remote', 'add', 'origin', remote])
    const input = await request()
    input.policy = { commit: 'after-plan', merge: 'after-plan', push: 'after-plan', targetBranch: 'main', remote: 'origin' }
    const first = await finalizer.run(input, new AbortController().signal, async () => {})
    expect(first.status).toBe('blocked')
    expect(first.operations.map(item => [item.kind, item.status])).toEqual([['commit', 'succeeded'], ['merge', 'succeeded'], ['push', 'failed']])
    const committed = command(cwd, ['rev-parse', 'HEAD'])
    fs.mkdirSync(remote); command(remote, ['init', '--bare'])
    const second = await finalizer.run(input, new AbortController().signal, async () => {})
    expect(second.status).toBe('completed')
    expect(second.operations.filter(item => item.kind === 'commit')).toHaveLength(1)
    expect(second.operations.filter(item => item.kind === 'merge')).toHaveLength(1)
    expect(second.operations.filter(item => item.kind === 'push').map(item => item.status)).toEqual(['failed', 'succeeded'])
    expect(command(remote, ['rev-parse', 'refs/heads/task'])).toBe(committed)
    expect(command(cwd, ['rev-list', '--count', 'HEAD'])).toBe('2')
  }, 60000)
  it('blocks changed evidence and a dirty result after its own commit instead of publishing it', async () => {
    const input = await request()
    fs.writeFileSync(path.join(cwd, 'unreviewed.txt'), 'new bytes')
    expect((await finalizer.run(input, new AbortController().signal, async () => {})).status).toBe('blocked')
    expect(command(cwd, ['rev-list', '--count', 'HEAD'])).toBe('1')
    fs.unlinkSync(path.join(cwd, 'unreviewed.txt'))
    expect((await finalizer.run(input, new AbortController().signal, async () => {})).status).toBe('completed')
    fs.writeFileSync(path.join(cwd, 'file.txt'), 'changed after commit')
    const resumed = await finalizer.run(input, new AbortController().signal, async () => {})
    expect(resumed.status).toBe('blocked')
    expect(resumed.error).toMatch(/clean/)
    expect(command(cwd, ['show', 'HEAD:file.txt'])).toBe('verified')
  }, 30000)
  it.each(['manual', 'changed-remote'] as const)('does not replay an uncertain push intent after its authorization becomes %s', async change => {
    const remote = path.join(root, 'remote.git')
    fs.mkdirSync(remote); command(remote, ['init', '--bare'])
    command(repo, ['remote', 'add', 'origin', remote])
    const input = await request()
    const committed = await finalizer.run(input, new AbortController().signal, async () => {})
    expect(committed.status).toBe('completed')
    const head = command(cwd, ['rev-parse', 'HEAD'])
    // A real crash can happen between persisting this intent and invoking Git.
    // The same bytes also cannot prove that a remote effect did not happen.
    const ledgerPath = path.join(root, 'finalization', 'task', 'finalization.json')
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
    ledger.operations.push({ kind: 'push', request: { taskId: 'task', operationId: 'push-before-crash', expectedHead: head, remote: 'origin' } })
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger))
    input.policy = { commit: 'after-plan', merge: 'manual', push: change === 'manual' ? 'manual' : 'after-plan', ...(change === 'changed-remote' ? { remote: 'another-remote' } : {}) }
    const restarted = new WorkflowGitFinalizer({ directory: path.join(root, 'finalization'), git, validateTask() {} })
    const result = await restarted.run(input, new AbortController().signal, async () => {})
    expect(result.status).toBe('blocked')
    expect(result.error).toMatch(/policy|authoriz/i)
    expect(result.operations).toEqual(committed.operations)
    expect(command(remote, ['for-each-ref', '--format=%(refname)'])).toBe('')
    expect(command(cwd, ['rev-parse', 'HEAD'])).toBe(head)
    expect(JSON.parse(fs.readFileSync(ledgerPath, 'utf8')).operations).toEqual(ledger.operations)
  }, 30000)
})
