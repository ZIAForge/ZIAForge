import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prepareFolderTask, registerWorkFolder } from '../FolderWorkspace'
import { folderEvidence } from '../../workflow/WorkflowHost'
import { createWorkflowTemplate, CODE_TEMPLATES, WORK_TEMPLATES } from '../../workflow/WorkflowTemplates'
import { validatePlan } from '../../workflow/WorkflowValidation'

describe('Work folders and executable template proposals', () => {
  let root: string
  beforeEach(() => { root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-work-'))) })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))
  it('registers and reopens Work without Git and fingerprints actual artifacts', async () => {
    const repo = registerWorkFolder(root, 'Research', [])
    const cwd = prepareFolderTask(repo, 'task-report')
    expect(registerWorkFolder(root, 'Research', [repo])).toEqual(repo)
    expect(prepareFolderTask(repo, 'task-report')).toBe(cwd)
    expect(fs.existsSync(path.join(cwd, '.git'))).toBe(false)
    const empty = await folderEvidence(cwd)
    fs.writeFileSync(path.join(cwd, 'report.md'), '# Evidence\nSource: a real file')
    const first = await folderEvidence(cwd)
    expect(first).not.toBe(empty)
    expect(JSON.parse(first).files[0]).toMatchObject({ path: 'report.md', excerpt: '# Evidence\nSource: a real file' })
    expect(await folderEvidence(cwd)).toBe(first)
    fs.writeFileSync(path.join(cwd, 'report.md'), 'Changed')
    expect(await folderEvidence(cwd)).not.toBe(first)
  })
  it('does not adopt Code metadata or follow folder/task symlinks', () => {
    const outside = path.join(root, 'outside'); fs.mkdirSync(outside)
    fs.symlinkSync(outside, path.join(root, 'Linked'))
    expect(() => registerWorkFolder(root, 'Linked', [])).toThrow(/symlink/)
    const repo = registerWorkFolder(root, 'Research', [])
    expect(() => registerWorkFolder(root, 'Research', [{ ...repo, kind: 'git' }])).toThrow(/Code project/)
    fs.symlinkSync(outside, path.join(repo.path, 'worktrees', 'task-linked'))
    expect(() => prepareFolderTask(repo, 'task-linked')).toThrow(/symlink/)
    expect(() => prepareFolderTask(repo, '../outside')).toThrow(/Invalid/)
    expect(fs.readdirSync(outside)).toEqual([])
  })
  it('records symlink identity without reading external secrets and rejects a symlinked evidence root', async () => {
    const cwd = prepareFolderTask(registerWorkFolder(root, 'Reports', []), 'task')
    const outside = path.join(root, 'private'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'secret'), 'DO_NOT_READ')
    fs.symlinkSync(outside, path.join(cwd, 'external'))
    const evidence = await folderEvidence(cwd)
    expect(evidence).not.toContain('DO_NOT_READ')
    expect(JSON.parse(evidence).files).toEqual([{ path: 'external', symlink: outside }])
    const alias = path.join(root, 'alias'); fs.symlinkSync(cwd, alias)
    await expect(folderEvidence(alias)).rejects.toThrow(/canonical/)
  })
  it('keeps every original template in the same validated plan schema and Work free of Red/test commands', () => {
    for (const mode of ['code', 'work'] as const) for (const template of mode === 'code' ? CODE_TEMPLATES : WORK_TEMPLATES) {
      const plan = createWorkflowTemplate({ title: 'User task', description: 'Concrete request', mode, template, coderPreset: '@task', reviewerPreset: 'Review', verification: { executable: 'npm', args: ['test'], timeoutMs: 60000 } })
      expect(() => validatePlan(plan)).not.toThrow()
      if (mode === 'work') {
        expect(plan.steps).toHaveLength(3)
        expect(plan.steps[1].dependsOn).toEqual([plan.steps[0].id])
        expect(plan.steps.every(step => step.instructions.includes('Concrete request') && !step.verification.length && !step.red)).toBe(true)
        expect(plan.codeFlow).toBeUndefined()
        if (template === 'Concept Design') expect(plan.steps[0].stopAfter).toBe(true)
      } else {
        expect(plan.steps).toHaveLength(1)
        expect(plan.codeFlow).toMatchObject({ version: 1, request: 'Concrete request' })
        expect(plan.steps[0].codePhase).toBe(({ Auto: 'discovery', 'Fix a bug': 'investigation', 'Spec first': 'specification', 'Requirements first': 'requirements', 'Multi-model': 'planning' })[template as typeof CODE_TEMPLATES[number]])
        expect(plan.steps[0].verification).toEqual([])
        expect(plan.steps[0].newContext).toBe(true)
      }
    }
  })
})
