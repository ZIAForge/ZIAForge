import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { loadCodePromptProfile, promptProfileHash, validateCodePromptProfile } from '../CodePromptProfile'
import { codePhasePrompt, parseMultiStageResult } from '../CodeFlowProtocol'
import { codeImplementationPrompt, multiStagePrompt } from '../CodeFlowPrompts'
import { CodeArtifactStore } from '../CodeArtifacts'
import { workspaceReviewDiff } from '../WorkflowHost'
import { createWorkflowTemplate } from '../WorkflowTemplates'

const roots: string[] = []
const temporary = () => { const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-code-bindings-'))); roots.push(root); return root }
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

describe('Frozen local workflow instructions', () => {
  it('includes the exact workflow and role guides in orchestration and implementation turns', () => {
    const plan = createWorkflowTemplate({ title: 'A', description: 'User task', mode: 'code', template: 'Multi-model', coderPreset: 'Coder', reviewerPreset: 'Reviewer' })
    const documents = { 'multi-model': 'EXACT WHOLE WORKFLOW\r\n', planner: 'EXACT PLANNER', implementer: 'EXACT IMPLEMENTER', 'review-orchestrator': 'EXACT COORDINATOR' }
    plan.codeFlow!.promptProfile = { version: 1, documents, sha256: promptProfileHash(documents) }
    for (const [stage, role] of [['synthesis', 'planner'], ['review-coordinator', 'review-orchestrator']] as const) {
      const prompt = multiStagePrompt({ stage, index: 1, cycle: 0, plan, step: plan.steps[0], context: '', previousOutputs: '' })
      expect(prompt).toContain(documents['multi-model'])
      expect(prompt).toContain(documents[role])
    }
    const prompt = codeImplementationPrompt({ plan, step: plan.steps[0], context: '' })
    expect(prompt).toContain(documents['multi-model'])
    expect(prompt).toContain(documents.implementer)
  })
  it('preserves exact guide bytes in new plans while rejecting a changed pack or symlink', () => {
    const root = temporary(), filename = path.join(root, 'prompts.json')
    const documents = { 'spec-first': '\nUser-owned exact guide.\r\n' }
    const profile = { version: 1, documents, sha256: promptProfileHash(documents) }
    fs.writeFileSync(filename, JSON.stringify(profile))
    const plan = createWorkflowTemplate({ title: 'A', description: 'User task', mode: 'code', template: 'Spec first', coderPreset: 'Coder', reviewerPreset: 'Reviewer' })
    plan.codeFlow!.promptProfile = loadCodePromptProfile(filename)
    fs.writeFileSync(filename, JSON.stringify({ ...profile, documents: { 'spec-first': 'Substituted' } }))
    expect(() => loadCodePromptProfile(filename)).toThrow('hash')
    expect(codePhasePrompt({ plan, step: plan.steps[0], context: '' })).toContain(documents['spec-first'])
    expect(plan.codeFlow!.promptProfile!.sha256).toBe(profile.sha256)
    expect(() => validateCodePromptProfile({ ...profile, documents: { config: 'not a guide' } })).toThrow()
    fs.symlinkSync(filename, path.join(root, 'linked.json'))
    expect(() => loadCodePromptProfile(path.join(root, 'linked.json'))).toThrow()
    expect(loadCodePromptProfile(path.join(root, 'absent.json'))).toBeUndefined()
  })
})

describe('Multi-model artifact boundaries', () => {
  it('binds returned documents to the actual worker rather than accepting a different stage or path', () => {
    const output = JSON.stringify({ summary: 'Source evidence', artifacts: [{ name: 'exploration_1.md', content: '# Evidence\nfile.ts:3' }] })
    expect(parseMultiStageResult(output, { stage: 'exploration', index: 1, cycle: 0 }).artifacts[0].name).toBe('exploration_1.md')
    expect(() => parseMultiStageResult(output, { stage: 'exploration', index: 2, cycle: 0 })).toThrow('exactly')
    expect(() => parseMultiStageResult(output.replace('exploration_1.md', '../exploration_1.md'), { stage: 'exploration', index: 1, cycle: 0 })).toThrow()
  })
  it('passes references to a full diff after verifying its bytes, without truncating or embedding it in designer context', async () => {
    // Use a stable task root, as in production.
    const root = temporary(), stable = new CodeArtifactStore(() => root)
    const content = 'x'.repeat(180000)
    const receipts = await stable.write({ taskId: 'task', stepId: 'step', attemptId: 'attempt', artifacts: [{ name: 'review_diff.patch', content }], previous: [] })
    const refs = await stable.context('task', receipts, true)
    expect(refs).toContain(receipts[0].path)
    expect(refs).toContain(receipts[0].sha256)
    expect(refs).not.toContain('xxxxx')
    await expect(stable.context('task', receipts)).rejects.toThrow('context exceeds')
    fs.writeFileSync(receipts[0].path, content + 'changed')
    await expect(stable.context('task', receipts, true)).rejects.toThrow('changed')
  })
  it('uses the same complete tracked and untracked patch and refuses a binary addition', async () => {
    const root = temporary()
    const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root, ...args], { encoding: 'utf8' })
    git('init', '-q')
    fs.writeFileSync(path.join(root, 'tracked.txt'), 'before\n')
    git('add', 'tracked.txt')
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'baseline')
    fs.writeFileSync(path.join(root, 'tracked.txt'), 'after\n')
    fs.writeFileSync(path.join(root, 'new file.txt'), 'новая строка')
    const patch = await workspaceReviewDiff(root, process.env)
    expect(patch).toContain('-before\n+after')
    expect(patch).toContain('"b/new file.txt"')
    expect(patch).toContain('+новая строка\n\\ No newline at end of file')
    expect(await workspaceReviewDiff(root, process.env)).toBe(patch)
    fs.writeFileSync(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2]))
    await expect(workspaceReviewDiff(root, process.env)).rejects.toThrow('binary')
  })
})
