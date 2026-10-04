import { describe, expect, it } from 'vitest'
import { createTerminalScreenState, updateTerminalScreen } from '../terminalScreen'
import agyStartupChunks from '../../../../e2e/fixtures/agy-startup.json'

describe('incremental terminal screen', () => {
  it.each(['\x1b[?2026$p', '\x1b[=1;1u', '\x1b[?u', '\x1b[0 q', '\x1b[38:2::255:128:0m'])('consumes private/intermediate CSI %j without printing bytes or moving the cursor', sequence => {
    const cursor = createTerminalScreenState()
    let lines = updateTerminalScreen([], cursor, 'Banner\r\n> ')
    for (const character of sequence) lines = updateTerminalScreen(lines, cursor, character)
    expect(lines).toEqual(['Banner', '> '])
    expect(cursor).toMatchObject({ cursorRow: 1, cursorCol: 2, trailing: '' })
  })

  it.each(['\x07', '\x1b\\'])('consumes OSC terminated by %j exactly at a chunk boundary', terminator => {
    const cursor = createTerminalScreenState()
    let lines = updateTerminalScreen([], cursor, '> ')
    for (const character of '\x1b]0;Antigravity CLI' + terminator) {
      lines = updateTerminalScreen(lines, cursor, character)
    }
    expect(cursor.trailing).toBe('')
    expect(lines).toEqual(['> '])
    expect(updateTerminalScreen(lines, cursor, 'hello')).toEqual(['> hello'])
  })

  it('renders recorded startup identically for whole, captured and one-character chunks', () => {
    const render = (chunks: string[]) => {
      const cursor = createTerminalScreenState()
      let lines: string[] = []
      for (const chunk of chunks) lines = updateTerminalScreen(lines, cursor, chunk)
      return { lines, cursor }
    }
    const captured = render(agyStartupChunks)
    expect(render([agyStartupChunks.join('')])).toEqual(captured)
    expect(render([...agyStartupChunks.join('')])).toEqual(captured)
    expect(captured.lines).toContain('>')
    expect(captured.lines.join('\n')).toContain('tester@example.com (Google AI Ultra)')
    expect(captured.cursor.trailing).toBe('')
  })
})
