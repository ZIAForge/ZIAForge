import type { FeedItem } from '../../store'
import { uiText } from '../../uiText'

function turnPattern(tabId: string): RegExp {
  const escaped = tabId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^(?:user-custom-|(?:ai|tools|prompt)-custom-pty-)${escaped}(?:-g\\d+)?-(\\d+)(?:-|$)`)
}

// Persist a turn for messages without a structured ID (errors, exits and old
// history). Infer it from their insertion position, never from a timestamp.
export function withFeedTurns(items: FeedItem[], tabId: string): FeedItem[] {
  const pattern = turnPattern(tabId)
  let latestTurn = -1
  let userOrdinal = 0
  return items.map(item => {
    const match = item.id.match(pattern)
    const turnIndex = item.turnIndex ?? (match ? Number(match[1]) : item.type === 'user' ? userOrdinal : latestTurn)
    if (item.type === 'user') userOrdinal++
    latestTurn = Math.max(latestTurn, turnIndex)
    return item.turnIndex === turnIndex ? item : { ...item, turnIndex }
  })
}

export const mergeFeeds = (current: FeedItem[], updated: FeedItem[], tabId: string, answeredPromptIds: Record<string, unknown> = {}): FeedItem[] => {
  // Use Map for O(1) lookup instead of findIndex O(n)
  const mergedMap = new Map<string, { item: FeedItem, index: number }>()
  const mergedList: FeedItem[] = []
  
  for (const item of current) {
    mergedMap.set(item.id, { item, index: mergedList.length })
    mergedList.push(item)
  }
  
  for (const newItem of updated) {
    const existing = mergedMap.get(newItem.id)
    if (!existing) {
      mergedMap.set(newItem.id, { item: newItem, index: mergedList.length })
      mergedList.push(newItem)
    } else {
      const existingItem = existing.item
      
      if (newItem.type === 'tools' && existingItem.type === 'tools') {
        const mergedTools = [...(existingItem.tools || [])]
        const toolContentMap = new Map<string, number>()
        mergedTools.forEach((t, i) => {
          if (t.type === 'prompt') {
            toolContentMap.set(`id:${t.id}`, i)
          } else {
            toolContentMap.set(`content:${(t.content || '').trim().toLowerCase()}`, i)
          }
        })
        
        for (const newTool of (newItem.tools || [])) {
          const key = newTool.type === 'prompt'
            ? `id:${newTool.id}`
            : `content:${(newTool.content || '').trim().toLowerCase()}`
          const existingToolIdx = toolContentMap.get(key)
          
          if (existingToolIdx === undefined) {
            toolContentMap.set(key, mergedTools.length)
            mergedTools.push(newTool)
          } else {
            mergedTools[existingToolIdx] = { ...mergedTools[existingToolIdx], ...newTool }
          }
        }
        
        const thCount = mergedTools.filter(t => t.type === 'thinking').length
        const tlCount = mergedTools.filter(t => t.type === 'ran').length
        
        mergedList[existing.index] = {
          ...existingItem,
          toolStats: uiText('Thinking: {thinking} · Tools: {tools}', { thinking: thCount, tools: tlCount }),
          tools: mergedTools
        }
      } else if (newItem.type === 'ai' && existingItem.type === 'ai') {
        const match = newItem.id.match(/-(\d+)$/)
        const suffix = match ? match[1] : ''
        const hasToolsBlock = suffix ? updated.some(it => it.type === 'tools' && it.id.endsWith(`-${suffix}`)) : false
        if (hasToolsBlock || (newItem.text && newItem.text.length >= (existingItem.text || '').length) || (newItem.text && !existingItem.text?.startsWith(newItem.text))) {
          mergedList[existing.index] = newItem
        }
      } else {
        mergedList[existing.index] = newItem
      }
    }
  }
  
  const ordered = withFeedTurns(mergedList, tabId)
  const latestUserIdx = Math.max(-1, ...ordered.filter(it => it.type === 'user').map(it => it.turnIndex!))
  const pattern = turnPattern(tabId)
  
  const getScore = (type: string, tIdx: number, id: string) => {
    if (type === 'user') return 0
    if (type === 'tools') return 1
    if (type === 'prompt') {
      const isAnswered = !!answeredPromptIds[id]
      const isStale = tIdx < latestUserIdx
      return (isAnswered || isStale) ? 1.5 : 3
    }
    if (type === 'ai') return 2
    return 99
  }
  
  // Unknown/system items follow the response in their own turn. Stable sorting
  // retains their insertion order when a screen snapshot is merged repeatedly.
  const score = (item: FeedItem) => getScore(pattern.test(item.id) || item.type === 'user' ? item.type : 'unknown', item.turnIndex!, item.id)
  return ordered.sort((a, b) => {
    if (a.turnIndex !== b.turnIndex) return a.turnIndex! - b.turnIndex!
    return score(a) - score(b)
  })
}
