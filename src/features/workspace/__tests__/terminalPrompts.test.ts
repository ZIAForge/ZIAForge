import { describe, expect, it } from 'vitest'
import { isInteractivePrompt, parsePromptOption, promptActionsForText } from '../terminalPrompts'

describe('terminal prompts', () => {
  it.each(['1. Continue', '1) Continue', '[1] Continue', '(1) Continue', '> 1) Continue', '❯ [1] Continue'])(
    'parses the option %s', line => {
      expect(parsePromptOption(line)).toEqual({ id: '1', label: 'Continue' })
    },
  )

  it.each(['Proceed? [y/n]', 'Proceed? (y/N)', 'Continue [Y/n]', 'Continue (yes/no)'])(
    'recognizes %s and preserves the expected response tokens', text => {
      expect(isInteractivePrompt(text)).toBe(true)
      expect(promptActionsForText(text).map(action => action.id)).toEqual(text.includes('yes') ? ['yes', 'no'] : ['y', 'n'])
    },
  )

  it('prefers explicit choices over inferred yes/no and does not treat ordinary prose as a prompt', () => {
    expect(promptActionsForText('Choose an action:\n1) Continue\n[2] Cancel\n(3) Explain').map(action => action.id)).toEqual(['1', '2', '3'])
    expect(isInteractivePrompt('The generated code contains a select element.')).toBe(false)
    expect(isInteractivePrompt('Run this command?')).toBe(true)
    expect(isInteractivePrompt('Do you trust the contents of this project?')).toBe(true)
    expect(isInteractivePrompt('  ↑/↓ Navigate · enter Confirm')).toBe(true)

    // Unnumbered trust prompt navigation menu
    const trustMenu = `Do you trust the contents of this project?
> Yes, I trust this folder
  No, exit
  ↑/↓ Navigate · enter Confirm`
    expect(promptActionsForText(trustMenu)).toEqual([
      { id: '1', label: 'Yes, I trust this folder', payload: '\r' },
      { id: '2', label: 'No, exit', payload: '\u001b[B\r' },
    ])

    // Numbered permission prompt with arrow navigation
    const permMenu = `Run this command?
> 1. Yes, run command
  2. Yes, and always allow
  3. No, cancel
  ↑/↓ Navigate · enter Confirm`
    expect(promptActionsForText(permMenu)).toEqual([
      { id: '1', label: 'Yes, run command', payload: '\r' },
      { id: '2', label: 'Yes, and always allow', payload: '\u001b[B\r' },
      { id: '3', label: 'No, cancel', payload: '\u001b[B\u001b[B\r' },
    ])
  })
})
