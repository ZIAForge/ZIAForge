import { describe, expect, it } from 'vitest'
import type { FeedItem } from '../../../store'
import { mergeFeeds } from '../mergeFeeds'

describe('custom chat turn order', () => {
  const tab = 'term-custom-13'
  const user = (turn: number): FeedItem => ({ id: `user-custom-${tab}-${turn}-${1000 + turn}`, type: 'user', text: `User ${turn}` })
  const reply = (turn: number, generation = 0): FeedItem => ({ id: `ai-custom-pty-${tab}-g${generation}-${turn}`, type: 'ai', text: `Reply ${turn}` })
  const exit: FeedItem = { id: 'ai-custom-exit-1700000000000', type: 'ai', text: '[Process exited with code 0]' }

  it('places each user before their response, including generation suffixes and restarts', () => {
    const merged = mergeFeeds([user(0), user(1)], [reply(1, 12), reply(0)], tab)
    expect(merged.map(item => item.text)).toEqual(['User 0', 'Reply 0', 'User 1', 'Reply 1'])
  })

  it('anchors exit/error messages to their insertion turn across subsequent screen merges', () => {
    const error: FeedItem = { id: 'err-queued-msg-1700000000001', type: 'ai', text: 'Write failed' }
    const merged = mergeFeeds([user(0), exit, user(1), error], [reply(1, 1), reply(0)], tab)
    expect(merged.map(item => item.text)).toEqual(['User 0', 'Reply 0', exit.text, 'User 1', 'Reply 1', error.text])
    expect(mergeFeeds([...merged, user(2)], [reply(2, 2), reply(1, 1)], tab).map(item => item.text))
      .toEqual(['User 0', 'Reply 0', exit.text, 'User 1', 'Reply 1', error.text, 'User 2', 'Reply 2'])
  })

  it('supports legacy IDs and tabs containing regex metacharacters', () => {
    const tabId = 'chat.[5]+-12'
    const items: FeedItem[] = [
      { id: `ai-custom-pty-${tabId}-0`, type: 'ai', text: 'Legacy reply' },
      { id: `user-custom-${tabId}-0-1700000000000`, type: 'user', text: 'Legacy user' },
      { id: `tools-custom-pty-${tabId}-g4-0`, type: 'tools', tools: [{ type: 'ran', content: 'ls' }] },
    ]
    expect(mergeFeeds(items, [], tabId).map(item => item.type)).toEqual(['user', 'tools', 'ai'])
  })

  it('preserves explicit turn metadata and merges streaming text without moving system events to the top', () => {
    const original = mergeFeeds([user(0), exit], [reply(0)], tab)
    const updated = mergeFeeds(original, [{ ...reply(0), text: 'Reply 0 completed' }], tab)
    expect(updated.map(item => item.text)).toEqual(['User 0', 'Reply 0 completed', exit.text])
    expect(updated.every(item => item.turnIndex === 0)).toBe(true)
    expect(original[1].text).toBe('Reply 0')
  })
})
