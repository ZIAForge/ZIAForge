// Incremental terminal screen used by the chat parser and activity detector.
export interface TerminalScreenState {
  cursorRow: number
  cursorCol: number
  savedRow: number
  savedCol: number
  trailing: string
}

export function createTerminalScreenState(): TerminalScreenState {
  return { cursorRow: 0, cursorCol: 0, savedRow: 0, savedCol: 0, trailing: '' }
}

export function updateTerminalScreen(currentScreen: string[], state: TerminalScreenState, cleanData: string): string[] {
  const inputData = state.trailing + cleanData
  state.trailing = ''

  const lines = [...currentScreen]
  let { cursorRow, cursorCol, savedRow, savedCol } = state

  let idx = 0
  while (idx < inputData.length) {
    const char = inputData[idx]

    if (char === '\u001b') {
      if (idx + 1 >= inputData.length) {
        state.trailing = inputData.slice(idx)
        break
      }

      const nextChar = inputData[idx + 1]

      if (nextChar === '[') {
        let j = idx + 2
        // ECMA-48: parameter bytes (0x30..0x3f), intermediates (0x20..0x2f),
        // then a final byte (0x40..0x7e). agy sends e.g. CSI ? 2026 $ p and
        // CSI = 1 ; 1 u. Even unsupported controls must be consumed in full.
        while (j < inputData.length && inputData[j] >= '0' && inputData[j] <= '?') j++
        const paramStr = inputData.slice(idx + 2, j)
        const intermediateStart = j
        while (j < inputData.length && inputData[j] >= ' ' && inputData[j] <= '/') j++
        if (j >= inputData.length) {
          state.trailing = inputData.slice(idx)
          break
        }
        const cmd = inputData[j]
        if (cmd < '@' || cmd > '~') {
          idx = j // Recover from malformed controls without dropping text.
          continue
        }
        if (j !== intermediateStart || /[<=>?:]/.test(paramStr)) {
          // Private keyboard queries ending in "u" are not cursor restores.
          idx = j + 1
          continue
        }
        const params = paramStr ? paramStr.split(';').map(p => parseInt(p, 10) || 0) : []
        const p1 = params[0] || 0
        const p2 = params[1] || 0

        switch (cmd) {
          case 'A': cursorRow = Math.max(0, cursorRow - (p1 || 1)); break
          case 'B': cursorRow += (p1 || 1); while (cursorRow >= lines.length) lines.push(''); break
          case 'C': cursorCol += (p1 || 1); break
          case 'D': cursorCol = Math.max(0, cursorCol - (p1 || 1)); break
          case 'G': cursorCol = Math.max(0, (p1 || 1) - 1); break
          case 'H': case 'f':
            cursorRow = Math.max(0, (p1 || 1) - 1)
            cursorCol = Math.max(0, (p2 || 1) - 1)
            while (cursorRow >= lines.length) lines.push('')
            break
          case 'J':
            if (p1 === 0) {
              if (cursorRow < lines.length) {
                lines[cursorRow] = lines[cursorRow].substring(0, cursorCol)
                lines.splice(cursorRow + 1)
              }
            } else if (p1 === 2 || p1 === 3) {
              lines.length = 0
              cursorRow = 0
              cursorCol = 0
            }
            break
          case 'K':
            if (cursorRow < lines.length) {
              if (p1 === 0) {
                lines[cursorRow] = lines[cursorRow].substring(0, cursorCol)
              } else if (p1 === 1) {
                lines[cursorRow] = ' '.repeat(cursorCol) + lines[cursorRow].substring(cursorCol)
              } else if (p1 === 2) {
                lines[cursorRow] = ''
              }
            }
            break
          case 'm': break
          case 'r': break
          case 's': savedRow = cursorRow; savedCol = cursorCol; break
          case 'u': cursorRow = savedRow; cursorCol = savedCol; break
          default: break
        }
        idx = j + 1
        continue
      }

      if (nextChar === ']') {
        let j = idx + 2
        let terminated = false
        while (j < inputData.length) {
          if (inputData[j] === '\x07') {
            j++
            terminated = true
            break
          }
          if (inputData[j] === '\u001b' && j + 1 < inputData.length && inputData[j + 1] === '\\') {
            j += 2
            terminated = true
            break
          }
          j++
        }
        if (!terminated) {
          state.trailing = inputData.slice(idx)
          break
        }
        idx = j
        continue
      }

      if (nextChar === '(' || nextChar === ')') {
        if (idx + 2 >= inputData.length) {
          state.trailing = inputData.slice(idx)
          break
        }
        idx += 3
        continue
      }

      idx += 2
      continue
    }

    if (char === '\r') {
      cursorCol = 0
    } else if (char === '\n') {
      cursorRow++
      while (cursorRow >= lines.length) lines.push('')
    } else if (char === '\t') {
      cursorCol = (Math.floor(cursorCol / 8) + 1) * 8
    } else if (char === '\b' || char === '\x7f') {
      cursorCol = Math.max(0, cursorCol - 1)
    } else if (char === '\x07') {
      // Bell - ignore
    } else if (char.charCodeAt(0) >= 32) {
      while (cursorRow >= lines.length) lines.push('')
      let line = lines[cursorRow]
      if (cursorCol > line.length) line = line.padEnd(cursorCol, ' ')
      lines[cursorRow] = line.substring(0, cursorCol) + char + line.substring(cursorCol + 1)
      cursorCol++
    }
    idx++
  }

  state.cursorRow = cursorRow
  state.cursorCol = cursorCol
  state.savedRow = savedRow
  state.savedCol = savedCol

  // Sanitize: ensure no undefined/null elements in lines array (prevents .trim() crashes everywhere)
  for (let li = 0; li < lines.length; li++) {
    if (lines[li] == null || typeof lines[li] !== 'string') lines[li] = ''
  }
  return lines
}
