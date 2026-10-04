import { describe, expect, it, vi } from 'vitest'
import { execFile } from 'node:child_process'
import { parseAgentModels, queryAntigravityModels } from '../agentModels'

vi.mock('node:child_process', async importOriginal => ({ ...await importOriginal<typeof import('node:child_process')>(), execFile: vi.fn() }))

describe('agent model discovery', () => {
  it('extracts unique CLI IDs from tab and space columns, ignoring progress and diagnostics', () => {
    expect(parseAgentModels([
      'Fetching available models...',
      '\u001b[32mgemini-3.8-flash-high\tGemini 3.8 Flash (High)\u001b[0m',
      '  gemini-3.8-flash-medium    Gemini 3.8 Flash (Medium)',
      'gemini-3.8-flash-high\tGemini 3.8 Flash (High)',
      'future-model-id',
      'Warning: unable to refresh a provider',
      '',
    ].join('\r\n'))).toEqual(['gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'future-model-id'])
  })

  it('queries without blocking Electron and allows slow CLI startup', async () => {
    vi.mocked(execFile).mockImplementationOnce((_file, _args, _options, callback) => {
      callback!(null, 'Fetching available models...\nmodel-new\tNew Model', '')
      return {} as ReturnType<typeof execFile>
    })
    const env = { PATH: '/test/bin', APP_ROOT: '/workspace', VITE_PUBLIC: '/workspace/dist' }
    expect(await queryAntigravityModels(env, '/workspace')).toEqual(['model-new'])
    expect(execFile).toHaveBeenCalledWith('agy', ['models'], expect.objectContaining({
      cwd: '/workspace', env, timeout: 15_000, encoding: 'utf8',
    }), expect.any(Function))
  })
})
