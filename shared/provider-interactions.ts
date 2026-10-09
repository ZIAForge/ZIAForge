import { answerMatchesInteraction as grokMatches, singleNativeAllowOnce as grokAllowOnce, validGrokInteractionAnswer, type GrokInteraction, type GrokInteractionAnswer } from './grok-interactions'
import { claudeAnswerMatchesInteraction, validClaudeInteractionAnswer, type ClaudeInteraction, type ClaudeInteractionAnswer } from './claude-interactions'

export type ProviderInteraction = (GrokInteraction & { provider?: 'grok' }) | ClaudeInteraction
export type ProviderInteractionAnswer = (GrokInteractionAnswer & { provider?: 'grok' }) | ClaudeInteractionAnswer
export type ProviderInteractionState = ProviderInteraction['state']
export function validProviderInteractionAnswer(value: unknown): value is ProviderInteractionAnswer {
  return typeof value === 'object' && value !== null && 'provider' in value && value.provider === 'claude'
    ? validClaudeInteractionAnswer(value) : validGrokInteractionAnswer(value)
}
export function answerMatchesInteraction(interaction: ProviderInteraction, answer: ProviderInteractionAnswer): boolean {
  if (interaction.provider === 'claude') return claudeAnswerMatchesInteraction(interaction, answer)
  return answer.provider !== 'claude' && grokMatches(interaction, answer)
}
export function singleNativeAllowOnce(interaction: ProviderInteraction) {
  return interaction.provider === 'claude' ? undefined : grokAllowOnce(interaction)
}
