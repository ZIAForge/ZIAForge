import { describe, expect, it } from 'vitest'
import { AgentActivity } from '../agentActivity'
import agyStartupChunks from '../../../../e2e/fixtures/agy-startup.json'

describe('PTY agent activity', () => {
  it.each(['> ', '❯ ', '> ? for shortcuts', '? for shortcuts', '?'])('finishes booting at %j, including split ANSI output', prompt => {
    const activity = new AgentActivity()
    activity.boot('tab')
    activity.output('tab', 'Welcome to Claude Code\r\n')
    expect(activity.isBusy('tab')).toBe(true)
    activity.output('tab', '\x1b[3')
    activity.output('tab', '2m' + prompt + '\x1b[0m')
    expect(activity.isBusy('tab')).toBe(false)
  })

  it('stays busy for queued and in-flight input even when a prompt arrives before write resolves', () => {
    const activity = new AgentActivity()
    activity.setQueued('tab', true)
    const complete = activity.beginInput('tab')
    activity.startTurn('tab')
    activity.output('tab', 'Answer\r\n> ')
    expect(activity.isBusy('tab')).toBe(true)
    activity.setQueued('tab', false)
    expect(activity.isBusy('tab')).toBe(true)
    complete()
    expect(activity.isBusy('tab')).toBe(false)
  })

  it('requires a fresh ready prompt after submission and ignores color/cursor heartbeats', () => {
    const activity = new AgentActivity()
    activity.output('tab', '> ? for shortcuts')
    activity.startTurn('tab')
    activity.output('tab', '\x1b[?25l\x1b[0m')
    expect(activity.isBusy('tab')).toBe(true)
    activity.output('tab', 'Working on tools\r\n')
    expect(activity.isBusy('tab')).toBe(true)
    activity.output('tab', 'Complete\r\n> ')
    expect(activity.isBusy('tab')).toBe(false)
    activity.output('tab', '\x1b[?25h\x1b[0m')
    expect(activity.isBusy('tab')).toBe(false)
  })

  it('does not clear a concurrent pending submission when an input write fails', () => {
    const activity = new AgentActivity()
    const first = activity.beginInput('tab')
    const second = activity.beginInput('tab')
    activity.startTurn('tab')
    activity.failTurn('tab')
    first()
    expect(activity.isBusy('tab')).toBe(true)
    second()
    expect(activity.isBusy('tab')).toBe(false)
  })

  it.each(['> ? for shortcuts', '> '])('handles TUI redraws with persistent %j and a live interrupt indicator', prompt => {
    const activity = new AgentActivity()
    activity.output('tab', '> ? for shortcuts')
    activity.output('tab', '\x1b[2J\x1b[HThinking (esc to interrupt)\r\n' + prompt)
    expect(activity.isBusy('tab')).toBe(true)
    activity.output('tab', '\x1b[H\x1b[2KComplete\r\n' + prompt)
    expect(activity.isBusy('tab')).toBe(false)
  })

  it('keeps permission prompts busy and isolates cancellation, exit and boot per session', () => {
    const activity = new AgentActivity()
    activity.boot('first')
    activity.output('first', '> ')
    activity.startTurn('first')
    activity.output('first', 'Proceed? (y/N)')
    activity.boot('second')
    activity.output('second', '> ')
    expect(activity.isBusy('first')).toBe(true)
    expect(activity.isBusy('second')).toBe(false)
    activity.output('first', '\r\nCancelled\r\n> ')
    expect(activity.isBusy('first')).toBe(false)
    activity.startTurn('second')
    activity.finish('second')
    activity.output('second', 'shell$ ')
    expect(activity.isBusy('second')).toBe(false)
    activity.boot('second')
    expect(activity.isBusy('second')).toBe(true)
  })

  it('recognizes real agy footer on separate line and combined line', () => {
    const activity = new AgentActivity()
    activity.boot('tab')
    activity.output('tab', 'Welcome to Antigravity CLI\r\n>\r\n────────────────────────────────\r\n? for shortcuts\r\nGemini 3.8 Flash · high')
    expect(activity.isBusy('tab')).toBe(false)

    activity.startTurn('tab')
    expect(activity.isBusy('tab')).toBe(true)
    activity.output('tab', 'Some answer\r\n? for shortcuts                                  Gemini 3.8 Flash · high')
    expect(activity.isBusy('tab')).toBe(false)

    // Real agy layout with prompt sandwiched between dividers and trailing Ultra status line
    activity.startTurn('tab')
    expect(activity.isBusy('tab')).toBe(true)
    activity.output('tab', '────────────────────────────────\r\n>\r\n────────────────────────────────\r\n(Google AI Ultra)ini 3.8 Flash · high')
    expect(activity.isBusy('tab')).toBe(false)
  })

  it('accepts a new plain prompt even when old interrupt hints remain in scrollback', () => {
    const activity = new AgentActivity()
    activity.startTurn('tab')
    activity.output('tab', 'Thinking... esc to interrupt\r\n')
    activity.output('tab', 'Answer completed\r\n> ')
    expect(activity.isBusy('tab')).toBe(false)
  })

  it('correctly transitions on real captured agy startup chunks', () => {
    const activity = new AgentActivity()
    activity.boot('real-tab')
    expect(activity.isBusy('real-tab')).toBe(true)
    for (const chunk of agyStartupChunks) {
      activity.output('real-tab', chunk)
      expect(activity.isRunning('real-tab')).toBe(false)
    }
    expect(activity.isBusy('real-tab')).toBe(false)
  })

  it('does not treat an incomplete idle redraw, typing or startup text as generation', () => {
    const activity = new AgentActivity()
    activity.boot('tab')
    activity.output('tab', '> ')
    for (const chunk of [
      '\x1b[H\x1b[JAntigravity CLI 1.2.1',
      '\r\nGemini 3.8 Flash (High)',
      '\r\nChecking for updates',
      '\r\n> draft that has not been submitted',
    ]) {
      activity.output('tab', chunk)
      expect(activity.isRunning('tab')).toBe(false)
    }
  })

  it('keeps queued, pending and submitted input separate from observed generation', () => {
    const activity = new AgentActivity()
    activity.boot('tab')
    activity.setQueued('tab', true)
    const complete = activity.beginInput('tab')
    expect(activity.isBusy('tab')).toBe(true)
    expect(activity.isRunning('tab')).toBe(false)
    activity.output('tab', '> ')
    activity.startTurn('tab')
    activity.output('tab', '\r\n> submitted request\r\n')
    expect(activity.isRunning('tab')).toBe(false)
    activity.output('tab', '⣾ Generating... (esc to cancel)\r\n')
    expect(activity.isRunning('tab')).toBe(true)
    activity.output('tab', 'Answer completed\r\n> ')
    expect(activity.isRunning('tab')).toBe(false)
    expect(activity.isBusy('tab')).toBe(true)
    activity.setQueued('tab', false)
    complete()
    expect(activity.isBusy('tab')).toBe(false)
  })

  it.each(['⣾ Signing in...', '⠋ Authenticating... (esc to cancel)', '⠙ Logging in…'])('ignores authentication activity %j after an initial prompt', status => {
    const activity = new AgentActivity()
    activity.boot('tab')
    activity.output('tab', '> ')
    activity.output('tab', '\x1b[H\x1b[J' + status)
    expect(activity.isRunning('tab')).toBe(false)
    activity.output('tab', '\r\n>\r\n? for shortcuts\r\nGemini 3.8 Flash · high')
    expect(activity.isBusy('tab')).toBe(false)
  })

  it.each(['⣾ Generating...', 'Generating...', 'Generating…', 'Thinking... (esc to cancel)', 'esc to interrupt'])('detects live generation %j even when reconnecting during boot', indicator => {
    const activity = new AgentActivity()
    activity.boot('tab')
    activity.output('tab', 'Antigravity CLI 1.2.1\r\n' + indicator + '\r\n> ? for shortcuts')
    expect(activity.isRunning('tab')).toBe(true)
    activity.output('tab', '\x1b[H\x1b[JAnswer completed\r\n> ? for shortcuts')
    expect(activity.isRunning('tab')).toBe(false)
  })

  it('waits at a permission menu and resumes only when generation is observed', () => {
    const activity = new AgentActivity()
    activity.startTurn('tab')
    activity.output('tab', 'Generating... (esc to cancel)')
    expect(activity.isRunning('tab')).toBe(true)
    activity.output('tab', '\x1b[H\x1b[JProceed? (y/N)')
    expect(activity.isRunning('tab')).toBe(false)
    expect(activity.isBusy('tab')).toBe(true)
    activity.startTurn('tab')
    activity.output('tab', '⣷ Working...')
    expect(activity.isRunning('tab')).toBe(true)
  })

  it('does not flash Stop during control-only queries at a ready prompt', () => {
    const activity = new AgentActivity()
    activity.boot('tab')
    activity.output('tab', '> ')
    for (const chunk of ['\x1b[?2026$', 'p', '\x1b[=1;1', 'u', '\x1b[?u']) {
      activity.output('tab', chunk)
      expect(activity.isBusy('tab')).toBe(false)
      expect(activity.isRunning('tab')).toBe(false)
    }
  })

  it('does not mistake fragmented authentication spinner labels for a user turn', () => {
    const activity = new AgentActivity()
    activity.boot('tab')
    for (const character of agyStartupChunks.join('')) {
      activity.output('tab', character)
      expect(activity.isRunning('tab')).toBe(false)
    }
    expect(activity.isBusy('tab')).toBe(false)
    activity.startTurn('tab')
    activity.output('tab', '⣾')
    expect(activity.isRunning('tab')).toBe(true)
  })

  it('does not treat a numbered response as an approval menu', () => {
    const activity = new AgentActivity()
    activity.startTurn('tab')
    activity.output('tab', '⣾ Generating...\r\n1. First part of the answer')
    expect(activity.isRunning('tab')).toBe(true)
    activity.output('tab', '\r\n2. Second part\r\n> ')
    expect(activity.isRunning('tab')).toBe(false)
  })
})
