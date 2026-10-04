import { describe, expect, it } from 'vitest'
import { PtyAgentReadiness } from '../agentReadiness'
import agyStartupChunks from '../../../../e2e/fixtures/agy-startup.json'

describe('PTY startup readiness', () => {
  it('waits through captured agy authentication and accepts the redrawn current input', () => {
    const readiness = new PtyAgentReadiness()
    for (const chunk of agyStartupChunks.slice(0, 31)) {
      readiness.output(chunk)
      expect(readiness.isReady()).toBe(false)
    }
    for (const chunk of agyStartupChunks.slice(31)) readiness.output(chunk)
    // Raw history still contains Signing in; ANSI redraw removed it from the screen.
    expect(agyStartupChunks.join('')).toContain('Signing in')
    expect(readiness.isReady()).toBe(true)

    readiness.output('\x1b[H\x1b[JAntigravity CLI 1.2.1\r\nGemini 3.8 Flash (High)\r\n')
    expect(readiness.isReady()).toBe(false)
    readiness.output('────────────────────────────\r\n>\r\n────────────────────────────\r\n? for shortcuts\r\nGemini 3.8 Flash · high')
    expect(readiness.isReady()).toBe(true)
    for (const chunk of ['\x1b[?2026$', 'p\x1b[=1;1u\x1b[?u']) readiness.output(chunk)
    expect(readiness.isReady()).toBe(true)
  })

  it('reconstructs the same captured screen with split ANSI sequences and a reconnect snapshot', () => {
    const bytes = agyStartupChunks.join('')
    const split = new PtyAgentReadiness()
    const snapshot = new PtyAgentReadiness()
    for (const character of bytes) split.output(character)
    snapshot.output(bytes)
    expect(split.isReady()).toBe(true)
    expect(snapshot.isReady()).toBe(true)
  })

  it.each([
    '> ',
    'Welcome to Claude Code! Type /help for shortcuts\r\n',
    'Welcome to the Antigravity CLI\r\n⣾ Signing in...',
    'Welcome to Antigravity CLI\r\n⣾ Signing in...\r\n> ? for shortcuts',
    'Welcome to Antigravity CLI\r\n> ? for shortcuts\r\n⣾ Signing in...',
    'Welcome to Antigravity CLI\r\n> ? for shortcuts\r\n⣾ Generating... (esc to cancel)',
    'Welcome to Antigravity CLI\r\n> ? for shortcuts\r\nProceed? (y/N)',
  ])('does not turn a banner, shell, authentication or busy screen into readiness: %j', screen => {
    const readiness = new PtyAgentReadiness()
    readiness.output(screen)
    expect(readiness.isReady()).toBe(false)
  })

  it.each([
    'Welcome to Claude Code\r\n> ',
    'OpenAI Codex\r\n❯ ',
    '? for shortcuts                                  Gemini 3.8 Flash · high',
    'Type your message:',
  ])('accepts an identifiable current CLI input: %j', screen => {
    const readiness = new PtyAgentReadiness()
    readiness.output(screen)
    expect(readiness.isReady()).toBe(true)
  })

  it('requires fresh screen evidence after resetting for a replacement process', () => {
    const readiness = new PtyAgentReadiness()
    readiness.output(agyStartupChunks.join(''))
    expect(readiness.isReady()).toBe(true)
    readiness.reset()
    readiness.output('> ')
    expect(readiness.isReady()).toBe(false)
    readiness.output('\x1b[2J\x1b[HWelcome to Antigravity CLI\r\n⣾ Signing in...')
    expect(readiness.isReady()).toBe(false)
    readiness.output('\r\x1b[2K> ? for shortcuts')
    expect(readiness.isReady()).toBe(true)
  })
})
