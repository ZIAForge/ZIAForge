import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistantEngine } from '../AssistantEngine'
import type { ControlRequest } from '../../../shared/control'

let directory: string
const engines: AssistantEngine[] = []
const releasePending: (() => void)[] = []
beforeEach(async () => { directory = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'ziaf-architect-')) })
afterEach(async () => {
  releasePending.splice(0).forEach(release => release())
  for (const engine of engines.splice(0)) await engine.close()
  await fs.rm(directory, { recursive: true, force: true })
})
async function jsonFiles(folder: string): Promise<string[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? jsonFiles(path.join(folder, entry.name)) : Promise.resolve(entry.name.endsWith('.json') ? [path.join(folder, entry.name)] : [])))
  return nested.flat()
}

describe('application architect output and shutdown', () => {
  it('displays captured screenshots without copying base64 into subsequent prompts or durable history', async () => {
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
    const execute = vi.fn(async (request: ControlRequest) => {
      expect(request.method).toBe('system.screenshot')
      expect(request.requestId).toEqual(expect.any(String))
      return { windowId: 1, dataUrl: image }
    })
    const run = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({ message: 'Capturing the application window.', commands: [{ method: 'system.screenshot' }] }))
      .mockResolvedValueOnce('{"message":"The capture is displayed.","commands":[]}')
      .mockResolvedValueOnce('{"message":"The earlier receipt records a capture.","commands":[]}')
    const engine = new AssistantEngine({ directory, execute, run, context: async () => ({ project: 'offline fixture' }), commands: () => ['system.screenshot'] })
    engines.push(engine)
    await engine.send({ text: 'Show the application window.' })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledTimes(2)
    expect(engine.state().entries.find(entry => entry.image)?.image).toBe(image)
    expect(engine.state().busy).toBe(false)
    expect(run.mock.calls[1][0]).toContain('Image captured and displayed to owner')
    await engine.send({ text: 'Summarize the previous command receipt.' })
    expect(run).toHaveBeenCalledTimes(3)
    for (const [prompt] of run.mock.calls) {
      expect(prompt).not.toContain(image)
      expect(prompt).not.toContain('iVBORw0KGgoAAAANSUhEUgAAAAE')
    }
    const files = await jsonFiles(directory)
    expect(files).toContain(path.join(directory, 'architect-history.json'))
    for (const filename of files) {
      const text = await fs.readFile(filename, 'utf8')
      expect(text).not.toContain('data:image/png;base64,')
      expect(text).not.toContain('iVBORw0KGgoAAAANSUhEUgAAAAE')
    }
    const reopened = new AssistantEngine({ directory, execute, run, context: async () => ({}), commands: () => [] })
    engines.push(reopened)
    expect(reopened.state().entries.some(entry => entry.text.includes('Image captured and displayed to owner'))).toBe(true)
    expect(reopened.state().entries.every(entry => entry.image === undefined)).toBe(true)
  })

  it('keeps Stop/Close pending until its owned runner settles and durably records the stopped turn', async () => {
    let settle!: () => void
    let signal: AbortSignal | undefined
    const run = vi.fn((_prompt: string, nextSignal: AbortSignal) => {
      void _prompt; signal = nextSignal
      return new Promise<string>(resolve => { settle = () => resolve('{"message":"Late output","commands":[{"method":"createTask"}]}'); releasePending.push(settle) })
    })
    const execute = vi.fn(async () => ({}))
    const engine = new AssistantEngine({ directory, execute, run, context: async () => ({}), commands: () => ['createTask'] })
    engines.push(engine)
    const sending = engine.send({ text: 'Inspect the task before making changes.' })
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    engine.stop()
    expect(signal?.aborted).toBe(true)
    expect(engine.state().busy).toBe(true)
    let closed = false
    const closing = engine.close().then(() => { closed = true })
    await Promise.resolve()
    expect(closed).toBe(false)
    expect(engine.state().busy).toBe(true)
    settle()
    await Promise.all([sending, closing])
    expect(closed).toBe(true)
    expect(engine.state()).toMatchObject({ busy: false, error: 'Stopped' })
    expect(execute).not.toHaveBeenCalled()
    const saved = JSON.parse(await fs.readFile(path.join(directory, 'architect-history.json'), 'utf8')) as { role: string; text: string }[]
    expect(saved[0]).toMatchObject({ role: 'user', text: 'Inspect the task before making changes.' })
    expect(saved.at(-1)).toMatchObject({ role: 'assistant', text: 'Stopped' })
    expect(saved.some(entry => entry.text === 'Late output')).toBe(false)
    const reopened = new AssistantEngine({ directory, execute, run, context: async () => ({}), commands: () => [] })
    engines.push(reopened)
    expect(reopened.state().busy).toBe(false)
    expect(reopened.state().entries.at(-1)?.text).toBe('Stopped')
  })
})
