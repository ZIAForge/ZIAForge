import { createTerminalScreenState, updateTerminalScreen, type TerminalScreenState } from './terminalScreen'
import { isInteractivePrompt, parsePromptOption } from './terminalPrompts'

type Phase = 'idle' | 'booting' | 'awaiting' | 'generating' | 'stopped'
interface SessionActivity {
  phase: Phase
  pending: Set<symbol>
  queued: boolean
  lines: string[]
  cursor: TerminalScreenState
}

const MODEL_CHROME_RE = /\b(?:Gemini|Claude|GPT|OpenAI Codex|Google AI)\b|·\s*(?:high|medium|low|thinking|auto)|\bshortcuts\b/i
const DIVIDER_RE = /^[-─━═_\s]+$/
const TIP_RE = /^[└\s*•○-]*Tip\s*:/i
const READY_PROMPT_RE = /^(?:[>❯›]\s*)?(?:\?|\??\s*for shortcuts)?$/i
const SPINNER_RE = /^[\u2801-\u28FF](?:\s|$)/
const AUTH_RE = /^(?:[\u2801-\u28FF]\s*)?(?:sign(?:ing)?[ -]?in|log(?:ging)?[ -]?in|authenticat(?:ing|ion)|authoriz(?:ing|ation))\b/i
const BUSY_RE = /\b(?:esc(?:ape)? to (?:interrupt|cancel)|ctrl\+c to (?:interrupt|cancel)|still processing)\b|^(?:generating|working|thinking)(?:\.{3}|…)/i

function isGeneratingLine(line: string, allowSpinner = true): boolean {
  const trimmed = line.trim()
  // The agy sign-in spinner uses the same Braille frames as generation.
  return !AUTH_RE.test(trimmed) && ((allowSpinner && SPINNER_RE.test(trimmed)) || BUSY_RE.test(trimmed.replace(SPINNER_RE, '').trim()))
}

function isChromeOrDivider(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (isGeneratingLine(trimmed)) return false
  if (DIVIDER_RE.test(trimmed)) return true
  if (TIP_RE.test(trimmed)) return true
  if (MODEL_CHROME_RE.test(trimmed)) return true
  if (/^~\/|\.localized\//.test(trimmed)) return true
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) return true
  return false
}

function stripModelStatus(line: string): string {
  return line
    .replace(/\s*(?:Gemini|Claude|GPT|OpenAI Codex)\b.*·\s*(?:high|medium|low|thinking|auto).*$/i, '')
    .replace(/\s*\(Google AI Ultra\).*$/i, '')
    .trim()
}

// Only the current input/footer can establish readiness. A welcome banner or a
// prompt in scrollback cannot finish a turn. Busy footers override shortcuts.
export function hasIdlePrompt(lines: string[]): boolean {
  const tail = lines.map(line => line.trim()).filter(Boolean).slice(-15)
  if (tail.length === 0) return false

  // Locate the prompt line by scanning backwards from the bottom of tail,
  // skipping any trailing chrome (dividers, tips, model footers).
  let promptIndex = -1
  for (let i = tail.length - 1; i >= 0; i--) {
    const line = tail[i]
    const stripped = stripModelStatus(line)
    if (READY_PROMPT_RE.test(line) || (stripped && READY_PROMPT_RE.test(stripped))) {
      promptIndex = i
      break
    }
    if (!isChromeOrDivider(line)) {
      // Non-chrome content encountered before finding a prompt -> not idle
      break
    }
  }

  if (promptIndex < 0) return false

  // In a TUI, shortcuts may remain visible while the interrupt footer is active.
  const busyIndex = tail.reduce((lastIndex, line, index) => isGeneratingLine(line) ? index : lastIndex, -1)
  if (busyIndex < 0) return true

  // If the busy indicator / spinner is at or below the prompt, the agent is actively executing.
  if (busyIndex >= promptIndex) return false

  // A subsequent response/completion line makes earlier streaming hints scrollback.
  // Empty prompts and dividers in the live footer do not.
  return tail.slice(busyIndex + 1).some(line => {
    const stripped = stripModelStatus(line)
    return !READY_PROMPT_RE.test(stripped) && !isChromeOrDivider(line)
  })
}

export class AgentActivity {
  private sessions = new Map<string, SessionActivity>()
  private listeners = new Set<() => void>()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private get(sessionId: string): SessionActivity {
    let state = this.sessions.get(sessionId)
    if (!state) {
      state = { phase: 'idle', pending: new Set(), queued: false, lines: [], cursor: createTerminalScreenState() }
      this.sessions.set(sessionId, state)
    }
    return state
  }

  isBusy = (sessionId: string): boolean => {
    const state = this.sessions.get(sessionId)
    return !!state && (state.phase === 'booting' || state.phase === 'awaiting' || state.phase === 'generating' || state.pending.size > 0 || state.queued)
  }

  isRunning = (sessionId: string): boolean => {
    const state = this.sessions.get(sessionId)
    // Process liveness, queued input and IPC delivery are not generation.
    return state?.phase === 'generating'
  }

  private change(sessionId: string, update: (state: SessionActivity) => void) {
    const prevBusy = this.isBusy(sessionId)
    const prevRunning = this.isRunning(sessionId)
    update(this.get(sessionId))
    if (prevBusy !== this.isBusy(sessionId) || prevRunning !== this.isRunning(sessionId)) {
      this.listeners.forEach(listener => listener())
    }
  }

  boot(sessionId: string) {
    this.change(sessionId, state => {
      state.phase = 'booting'
      state.lines = []
      state.cursor = createTerminalScreenState()
    })
  }

  beginInput(sessionId: string): () => void {
    const token = Symbol('input')
    this.change(sessionId, state => { state.pending.add(token) })
    return () => this.change(sessionId, state => { state.pending.delete(token) })
  }

  setQueued(sessionId: string, queued: boolean) {
    this.change(sessionId, state => { state.queued = queued })
  }

  startTurn(sessionId: string) {
    this.change(sessionId, state => {
      // Submission alone is not evidence that the CLI is producing a response.
      // A second input must not hide a generation already observed in this PTY.
      if (state.phase !== 'generating') state.phase = 'awaiting'
      // Require a fresh ready prompt after submission, including when a TUI
      // redraws at absolute cursor positions or writes escape sequences only.
      state.lines = []
      state.cursor = createTerminalScreenState()
    })
  }

  output(sessionId: string, data: string) {
    this.change(sessionId, state => {
      if (state.phase === 'stopped') return
      const lines = updateTerminalScreen(state.lines, state.cursor, data)
      const changed = lines.join('\n') !== state.lines.join('\n')
      state.lines = lines
      if (!changed) return // Cursor visibility, color changes and heartbeats.
      if (hasIdlePrompt(lines)) state.phase = 'idle'
      else {
        const tail = lines.map(line => line.trim()).filter(Boolean).slice(-15)
        const lastContent = [...tail].reverse().find(line => !isChromeOrDivider(line))
        if (lastContent && AUTH_RE.test(lastContent)) {
          state.phase = 'booting'
        } else if (lastContent && (isInteractivePrompt(lastContent) || (parsePromptOption(lastContent) && tail.some(isInteractivePrompt)))) {
          // An approval needs user input, not a Stop control for generation.
          if (state.phase !== 'booting') state.phase = 'awaiting'
        } else if (tail.some(line => isGeneratingLine(line, state.phase === 'awaiting' || state.phase === 'generating'))) {
          // Also recover active generation from a reconnect snapshot. Arbitrary
          // banner/footer/echo redraws must never promote idle to generating.
          // A bare spinner during untouched startup may be a split sign-in
          // label. Only submitted turns can use spinner-only evidence.
          state.phase = 'generating'
        }
      }
      // Bound activity scrollback independently of the conversation history.
      if (lines.length > 200) {
        const removed = lines.length - 200
        state.lines = lines.slice(removed)
        state.cursor.cursorRow = Math.max(0, state.cursor.cursorRow - removed)
        state.cursor.savedRow = Math.max(0, state.cursor.savedRow - removed)
      }
    })
  }

  finish(sessionId: string) {
    this.change(sessionId, state => {
      state.phase = 'stopped'
      state.pending.clear()
      state.queued = false
    })
  }

  failTurn(sessionId: string) {
    this.change(sessionId, state => { state.phase = 'idle' })
  }

  forget(sessionId: string) {
    this.finish(sessionId)
    this.sessions.delete(sessionId)
  }
}

// Like PTY ownership, activity survives Workspace unmounts and tab switches.
export const agentActivity = new AgentActivity()
