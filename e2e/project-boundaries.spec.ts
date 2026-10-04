import { test, expect } from './fixtures'
import { mkdir, writeFile, readFile, symlink, access, rename } from 'node:fs/promises'
import path from 'node:path'

test('file IPC and project deletion stay within registered roots, and reset preserves files', async ({ app }, testInfo) => {
  const root = testInfo.outputPath('profile')
  const project = path.join(root, 'project')
  const outside = path.join(root, 'unregistered-neighbor')
  const secret = path.join(outside, 'keep.txt')
  const allowed = path.join(project, 'worktrees', 'task-e2e', 'note.txt')
  const escape = path.join(project, 'worktrees', 'task-e2e', 'escape')
  await mkdir(outside)
  await writeFile(secret, 'neighbor survives')
  await symlink(outside, escape)
  const { window } = app
  await window.evaluate(filePath => globalThis.window.ziafAPI.writeFile({ filePath, content: 'project note' }), allowed)
  expect(await window.evaluate(filePath => globalThis.window.ziafAPI.readFile({ filePath }), allowed)).toBe('project note')
  for (const filePath of [secret, path.join(escape, 'keep.txt')]) {
    await expect(window.evaluate(filePath => globalThis.window.ziafAPI.readFile({ filePath }), filePath)).rejects.toThrow(/registered project/)
    await expect(window.evaluate(filePath => globalThis.window.ziafAPI.writeFile({ filePath, content: 'must not write' }), filePath)).rejects.toThrow(/registered project/)
  }
  await expect(window.evaluate(dirPath => globalThis.window.ziafAPI.createDirectory({ dirPath }), path.join(escape, 'new-dir'))).rejects.toThrow()
  const files = await window.evaluate(projectPath => globalThis.window.ziafAPI.listProjectFiles({ projectPath }), path.dirname(allowed))
  expect(files.map(file => file.name)).toContain('note.txt')
  expect(files.map(file => file.name)).not.toContain('escape')
  expect((await window.evaluate(() => globalThis.window.ziafAPI.createWorkspaceFolder('../escaped-workspace'))).success).toBe(false)
  expect((await window.evaluate(repoPath => globalThis.window.ziafAPI.registerProject({ repoPath, projectName: '../escaped-project' }), outside)).success).toBe(false)
  await expect(access(path.join(outside, '.git'))).rejects.toThrow()
  const repositories = await window.evaluate(() => globalThis.window.ziafAPI.getRepositories())
  await expect(window.evaluate(({ repositories, outside }) => globalThis.window.ziafAPI.saveRepositories([
    ...repositories, { id: 'forged', name: 'Forged', path: outside, repoPath: outside },
  ]), { repositories, outside })).rejects.toThrow(/folder picker/)
  const invalidDelete = await window.evaluate(projectPath => globalThis.window.ziafAPI.deleteProjectFiles({
    repoId: 'repo-e2e', projectPath, deleteWorkspaceDir: true, deleteSourceDir: false,
  } as Parameters<typeof globalThis.window.ziafAPI.deleteProjectFiles>[0]), outside)
  expect(invalidDelete.success).toBe(false)
  expect(await readFile(secret, 'utf8')).toBe('neighbor survives')

  const deleted = await window.evaluate(() => globalThis.window.ziafAPI.deleteProjectFiles({ repoId: 'repo-e2e', deleteWorkspaceDir: true, deleteSourceDir: false }))
  expect(deleted).toEqual({ success: true })
  await expect(access(project)).rejects.toThrow()
  expect(await readFile(secret, 'utf8')).toBe('neighbor survives')
  await window.evaluate(async globalWorkspacePath => {
    const settings = await globalThis.window.ziafAPI.getSettings()
    await globalThis.window.ziafAPI.saveSettings({ ...settings, globalWorkspacePath })
    const result = await globalThis.window.ziafAPI.restoreFactoryDefaults()
    if (!result.success) throw new Error(result.error)
  }, outside)
  expect(await readFile(secret, 'utf8')).toBe('neighbor survives')
})


test.describe('owned project process removal', () => {
  test.use({ providerFixture: 'codex' })
  test('ends structured and PTY children before deletion, revokes registration and keeps journal history', async ({ app }, testInfo) => {
    const { window } = app
    const project = path.join(testInfo.outputPath('profile'), 'project')
    const worktree = path.join(project, 'worktrees', 'task-e2e')
    await window.getByRole('button', { name: 'E2E Workspace', exact: true }).click()
    await window.getByTestId('composer-input').fill('fixture-interrupt')
    await window.getByTestId('composer-send-button').click()
    await expect.poll(async () => (await app.transcript()).filter(entry => entry.event === 'prompt' && entry.text === 'fixture-interrupt').length).toBe(1)
    const session = await window.evaluate(() => globalThis.window.ziafAPI.agentSessions.attach({ taskId: 'task-e2e', chatId: 'chat-main' }))
    expect(session?.activeTurn).toBeDefined()
    const ref = { sessionId: session!.sessionId, runId: session!.runId }
    const providerPid = (await app.transcript()).find(entry => entry.event === 'prompt')!.pid
    const spawned = await window.evaluate(cwd => globalThis.window.ziafAPI.spawnPty({ sessionId: 'removal-pty', cwd, cols: 80, rows: 24 }), worktree)
    expect(spawned.success).toBe(true)
    await expect.poll(async () => (await app.transcript()).filter(entry => entry.event === 'pty-shell-start').length).toBeGreaterThan(0)
    const terminalPid = (await app.transcript()).filter(entry => entry.event === 'pty-shell-start').at(-1)!.pid
    const deleted = await window.evaluate(() => globalThis.window.ziafAPI.deleteProjectFiles({ repoId: 'repo-e2e', deleteWorkspaceDir: true, deleteSourceDir: false }))
    expect(deleted).toEqual({ success: true })
    for (const pid of [providerPid, terminalPid]) await expect.poll(() => { try { process.kill(pid, 0); return true } catch { return false } }).toBe(false)
    await expect(access(project)).rejects.toThrow()
    expect(await window.evaluate(() => globalThis.window.ziafAPI.getRepositories())).toEqual([])
    await expect(window.evaluate(ref => globalThis.window.ziafAPI.agentSessions.send({ ...ref, clientMessageId: 'after-delete', text: 'Must not reach a deleted project' }), ref)).rejects.toThrow(/not registered/)
    expect((await app.transcript()).some(entry => entry.event === 'prompt' && entry.text === 'Must not reach a deleted project')).toBe(false)
    await expect(window.evaluate(() => globalThis.window.ziafAPI.agentSessions.create({ taskId: 'task-e2e', chatId: 'after-delete' }))).rejects.toThrow(/not registered/)
    const stopped = await window.evaluate(ref => globalThis.window.ziafAPI.agentSessions.snapshot(ref), ref)
    expect(stopped.sessionStatus).toBe('stopped')
    expect(stopped.feed.some(message => message.text === 'fixture-interrupt')).toBe(true)
    expect((await window.evaluate(cwd => globalThis.window.ziafAPI.spawnPty({ sessionId: 'removed-new-pty', cwd }), worktree)).success).toBe(false)
  })
})


test.describe('pinned project root', () => {
  test.use({ providerFixture: 'codex' })
  test('rejects task reads, creation and native startup after the registered root is replaced by an outside symlink', async ({ app }, testInfo) => {
    const { window } = app
    const root = testInfo.outputPath('profile')
    const project = path.join(root, 'project')
    const outside = path.join(root, 'outside-root')
    // Reading registrations pins legacy entries before filesystem replacement.
    await window.evaluate(() => globalThis.window.ziafAPI.getRepositories())
    const tasks = await readFile(path.join(project, 'tasks.json'), 'utf8')
    await mkdir(outside)
    await writeFile(path.join(outside, 'tasks.json'), tasks)
    await rename(project, path.join(root, 'original-project'))
    await symlink(outside, project)
    expect(await window.evaluate(() => globalThis.window.ziafAPI.getTasks())).toEqual([])
    await expect(window.evaluate(() => globalThis.window.ziafAPI.createTask({ repoId: 'repo-e2e', name: 'Must not write outside', model: 'E2E Codex' }))).rejects.toThrow(/registered project/)
    await expect(window.evaluate(() => globalThis.window.ziafAPI.agentSessions.create({ taskId: 'task-e2e', chatId: 'outside-attempt' }))).rejects.toThrow(/not registered/)
    const prepared = await window.evaluate(() => globalThis.window.ziafAPI.startTask('task-e2e'))
    expect(prepared?.success).toBe(false)
    await expect(access(path.join(outside, 'artifacts'))).rejects.toThrow()
    await expect(access(path.join(outside, 'worktrees'))).rejects.toThrow()
    expect((await app.transcript()).filter(entry => entry.event === 'app-server-start')).toHaveLength(0)
    expect(await readFile(path.join(outside, 'tasks.json'), 'utf8')).toBe(tasks)
  })
})
