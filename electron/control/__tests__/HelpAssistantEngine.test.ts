import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelpAssistantEngine } from '../HelpAssistantEngine'
import type { HelpAssistantRequest } from '../../../shared/help-assistant'

let directory: string
const engines: HelpAssistantEngine[] = []
beforeEach(async () => { directory = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'ziaf-help-')) })
afterEach(async () => { await Promise.all(engines.splice(0).map(engine => engine.close())); await fs.rm(directory, { recursive: true, force: true }) })
const guide = { title: 'Current help fixture', sections: [{ id: 'forge', title: 'Forge decisions', paragraphs: ['The owner approves requirements before implementation.'] }] }
const sourceSha256 = 'a'.repeat(64)
const configuration = () => ({ defaultPreset: 'My connected preset', nativeEnabled: false })
function make(run: (request: { text: string; presetName: string; language: string }, prompt: string, signal: AbortSignal) => Promise<string>, sha = sourceSha256) {
  const engine = new HelpAssistantEngine({ directory, guide, sourceSha256: sha, configuration, run, validatePreset: name => { if (name !== 'My connected preset') throw new Error('help.aiSelectPreset') } }); engines.push(engine); return engine
}
describe('Help knowledge conversation', () => {
  it('uses the current guide and selected language, validates references, persists only advice and drops obsolete history from new prompts', async () => {
    const run = vi.fn(async (...args:[HelpAssistantRequest,string,AbortSignal]) => { void args; return JSON.stringify({ message: '**Approve** requirements first.', sections: ['forge', 'invented', 'forge'], commands: [{ method: 'createTask' }] }) })
    const engine = make(run)
    await engine.send({ text: 'How can I approve a decision?', presetName: 'My connected preset', language: 'ru' })
    expect(run.mock.calls[0]).toEqual(expect.arrayContaining([expect.objectContaining({ language: 'ru' }), expect.stringContaining('Requested language: ru')]))
    expect(run.mock.calls[0][1]).toContain(guide.sections[0].paragraphs[0])
    expect(engine.state().entries.at(-1)).toMatchObject({ text: '**Approve** requirements first.', sections: ['forge'], sourceSha256 })
    expect(await fs.readFile(path.join(directory, 'help-assistant-history.json'), 'utf8')).not.toContain('createTask')
    const newRun = vi.fn(async (...args:[HelpAssistantRequest,string,AbortSignal]) => { void args; return 'Current Markdown answer' })
    const reopened = make(newRun, 'b'.repeat(64))
    expect(reopened.state().entries).toHaveLength(2)
    await reopened.send({ text: 'Explain review.', presetName: 'My connected preset', language: 'ar' })
    expect(newRun.mock.calls[0][1]).not.toContain('How can I approve a decision?')
    expect(reopened.state().entries.at(-1)?.text).toBe('Current Markdown answer')
    reopened.clear(); expect(reopened.state().entries).toEqual([])
    expect(make(newRun).state().entries).toEqual([])
  })
  it('rejects invalid presets before persisting, fences concurrent sends and keeps Close pending until stopped runner is retired', async () => {
    let settle!: (value: string) => void, signal: AbortSignal | undefined
    const run = vi.fn(async (_request:HelpAssistantRequest, _prompt:string, nextSignal: AbortSignal) => { signal = nextSignal; return new Promise<string>(resolve => { settle = resolve }) })
    const engine = make(run)
    expect(() => engine.send({ text: 'Help', presetName: 'Deleted preset', language: 'en' })).toThrow('help.aiSelectPreset')
    expect(engine.state().entries).toEqual([])
    const sending = engine.send({ text: 'Help me configure review', presetName: 'My connected preset', language: 'en' })
    await expect(engine.send({ text: 'Another question', presetName: 'My connected preset', language: 'en' })).rejects.toThrow('help.aiBusy')
    expect(() => engine.clear()).toThrow('help.aiBusy')
    let closed = false
    const closing = engine.close().then(() => { closed = true })
    expect(signal?.aborted).toBe(true); await Promise.resolve(); expect(closed).toBe(false)
    settle('Late answer'); await Promise.all([sending, closing])
    expect(engine.state()).toMatchObject({ busy: false, error: 'help.aiStopped' })
    expect(engine.state().entries).toHaveLength(1)
  })
})
