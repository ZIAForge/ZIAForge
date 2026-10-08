import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LOCAL_COMMAND_SUPPORTED, LocalCommandTool } from '../LocalCommandTool'

const roots: string[] = [], tools: LocalCommandTool[] = []
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ziaf-local-command-'))); roots.push(root)
  const cwd = path.join(root, 'workspace'); fs.mkdirSync(cwd)
  const tool = new LocalCommandTool(cwd, path.join(root, 'private-commands')); tools.push(tool)
  return { tool, cwd }
}
afterEach(async () => { await Promise.all(tools.splice(0).map(tool => tool.dispose())); roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })) })
describe.skipIf(!LOCAL_COMMAND_SUPPORTED)('owned local command execution', () => {
  it('runs actual pwd in the fixed canonical directory and never accepts cwd or environment overrides', async () => {
    const { tool, cwd } = fixture()
    expect(tool.validate({ executable: '/bin/pwd', args: [], timeoutMs: null })).toMatchObject({ executable: '/bin/pwd' })
    expect(() => tool.validate({ executable: '/bin/pwd', args: [], timeoutMs: null, cwd: os.homedir() })).toThrow('Invalid')
    expect(() => tool.validate({ executable: '/bin/pwd', args: [], timeoutMs: null, env: {} })).toThrow('Invalid')
    expect(() => tool.validate({ executable: 'pwd', args: [], timeoutMs: null })).toThrow('absolute')
    expect(() => tool.validate({ executable: '/bin/pwd', args: [], timeoutMs: 60_001 })).toThrow('60 seconds')
    const result = await tool.execute({ executable: '/bin/pwd', args: [], timeoutMs: null }, new AbortController().signal)
    expect(result).toMatchObject({ status: 'passed', exitCode: 0, stdout: `${cwd}\n`, cleanupVerified: true })
    expect(result).not.toHaveProperty('stdoutPath')
  })
  it('aborts an owned long command and waits for cleanup before resolving', async () => {
    const { tool } = fixture(), controller = new AbortController()
    const result = tool.execute({ executable: '/bin/sh', args: ['-c', 'sleep 30'], timeoutMs: null }, controller.signal)
    setTimeout(() => controller.abort(), 100)
    expect(await result).toMatchObject({ status: 'cancelled', cleanupVerified: true })
  })
  it('rejects replacement of the trusted directory before command execution', () => {
    const { tool, cwd } = fixture()
    fs.renameSync(cwd, `${cwd}-old`); fs.mkdirSync(cwd)
    expect(() => tool.validate({ executable: '/bin/pwd', args: [], timeoutMs: null })).toThrow('directory changed')
  })
})
