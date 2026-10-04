export interface PromptAction {
  id: string
  label: string
  payload?: string
}

const YES_NO = /(?:\[|\()\s*(y(?:es)?)\s*\/\s*(n(?:o)?)\s*(?:\]|\))/i
const NAV_MENU_RE = /↑\/↓\s*Navigate|Navigate\s*·\s*(?:enter|tab|ctrl)|enter\s*Confirm/i

export function parsePromptOption(line: string): PromptAction | undefined {
  const match = line.trim().match(/^(?:[>❯›▸*•○-]\s*)?(?:(\d+)[.)]|\[(\d+)\]|\((\d+)\))\s+(.+)$/)
  return match ? { id: match[1] || match[2] || match[3], label: match[4].trim() } : undefined
}

export function isInteractivePrompt(line: string): boolean {
  const trimmed = line.trim()
  return YES_NO.test(trimmed) ||
    /^(?:[?*•○-]\s*)?(?:requesting permission|permission requested|run this command\?|execute this command\?|do you want to|are you sure|allow creation of this file|allow non-workspace access|deny creation|do you trust\b|trust the contents\b|(?:please\s+)?(?:select|choose)\b.*[:?]$|proceed\?)/i.test(trimmed) ||
    NAV_MENU_RE.test(trimmed)
}

export function promptActionsForText(text: string): PromptAction[] {
  const isNav = NAV_MENU_RE.test(text)
  const lines = text.split('\n')

  // 1. Standard numbered options: 1) Foo, [2] Bar, > 1. Baz
  const numberedOptions = lines.flatMap(line => {
    const option = parsePromptOption(line)
    return option ? [option] : []
  })

  if (numberedOptions.length > 0) {
    if (isNav) {
      // In arrow-navigation menus, pressing Enter submits the selected item.
      // Arrow keys (Down \u001b[B) move selection from the initially highlighted 0th item.
      return numberedOptions.map((opt, idx) => ({
        ...opt,
        payload: idx === 0 ? '\r' : '\u001b[B'.repeat(idx) + '\r'
      }))
    }
    return numberedOptions.map(opt => ({
      ...opt,
      payload: opt.id + '\r'
    }))
  }

  // 2. Unnumbered arrow-navigation menu (e.g. "Do you trust... > Yes, I trust / No, exit / ↑/↓ Navigate")
  if (isNav) {
    const navItems: PromptAction[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (NAV_MENU_RE.test(trimmed)) break
      const itemMatch = trimmed.match(/^(?:[>❯›▸*•○-]\s*)?((?:Yes|No|Allow|Deny|Continue|Cancel|Exit)\b.*)$/i)
      if (itemMatch) {
        const idx = navItems.length
        navItems.push({
          id: String(idx + 1),
          label: itemMatch[1].trim(),
          payload: idx === 0 ? '\r' : '\u001b[B'.repeat(idx) + '\r'
        })
      }
    }
    if (navItems.length > 0) return navItems
  }

  // 3. (y/N) prompts
  const yesNo = text.match(YES_NO)
  if (yesNo) return [
    { id: yesNo[1].toLowerCase(), label: `Yes (${yesNo[1].toLowerCase()})`, payload: yesNo[1].toLowerCase() + '\r' },
    { id: yesNo[2].toLowerCase(), label: `No (${yesNo[2].toLowerCase()})`, payload: yesNo[2].toLowerCase() + '\r' },
  ]

  return []
}
