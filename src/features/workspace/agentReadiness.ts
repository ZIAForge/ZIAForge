import { hasIdlePrompt } from './agentActivity'
import { createTerminalScreenState, updateTerminalScreen } from './terminalScreen'

const AGENT_IDENTITY = /\b(?:Antigravity CLI|Claude Code|OpenAI Codex)\b/i
const INPUT_PROMPT = /^(?:[>❯›]\s*)?(?:\?|\??\s*for shortcuts)?$/i
const SHORTCUT_PROMPT = /^(?:[>❯›]\s*)?\??\s*for shortcuts\b/i
const TEXT_PROMPT = /^(?:[>❯›]\s*)?type (?:your message|a prompt)[.:…\s]*$/i
const AUTH_STATUS = /^(?:[\u2801-\u28FF]\s*)?(?:sign(?:ing)?[ -]?in|log(?:ging)?[ -]?in|authenticat(?:ing|ion)|authoriz(?:ing|ation))\b/i

/**
 * Startup readiness comes from the current CLI input, never its scrollback or PID.
 * Keep this screen separate from AgentActivity's per-turn screen: submitting a
 * prompt resets activity, but must not erase evidence collected during startup.
 * The owner resets this tracker before launching a replacement CLI and recreates
 * it from the authoritative snapshot when reconnecting to a PTY generation.
 */
export class PtyAgentReadiness {
  private lines: string[] = []
  private cursor = createTerminalScreenState()

  reset(): void {
    this.lines = []
    this.cursor = createTerminalScreenState()
  }

  output(data: string): void {
    this.lines = updateTerminalScreen(this.lines, this.cursor, data)
    if (this.lines.length > 200) {
      const removed = this.lines.length - 200
      this.lines = this.lines.slice(removed)
      this.cursor.cursorRow = Math.max(0, this.cursor.cursorRow - removed)
      this.cursor.savedRow = Math.max(0, this.cursor.savedRow - removed)
    }
  }

  isReady(): boolean {
    const lines = this.lines.map(line => line.trim()).filter(Boolean)
    const tail = lines.slice(-15)
    let inputIndex = -1
    let authIndex = -1
    for (let index = 0; index < tail.length; index++) {
      if (INPUT_PROMPT.test(tail[index]) || SHORTCUT_PROMPT.test(tail[index]) || TEXT_PROMPT.test(tail[index])) inputIndex = index
      if (AUTH_STATUS.test(tail[index])) authIndex = index
    }
    // A visible auth indicator cannot be made ready by a welcome banner or a
    // persistent input/footer. Redraws remove it from this screen, unlike raw history.
    if (inputIndex < 0 || authIndex >= 0) return false
    const identifiesAgent = lines.some(line => AGENT_IDENTITY.test(line)) ||
      tail.some(line => SHORTCUT_PROMPT.test(line)) || TEXT_PROMPT.test(tail[inputIndex])
    if (!identifiesAgent) return false // A bare shell prompt is not a CLI handshake.
    return hasIdlePrompt(this.lines) || (inputIndex === tail.length - 1 && TEXT_PROMPT.test(tail[inputIndex]))
  }
}
