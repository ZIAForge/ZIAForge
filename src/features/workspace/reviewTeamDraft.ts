import { uiText } from '../../uiText'
import type { ReviewTeamPreset } from '../../../shared/review-team'

export function newReviewTeam(): ReviewTeamPreset {
  return { version: 1, id: `team-${crypto.randomUUID()}`, name: uiText("Review team"), reviewers: [1, 2].map(index => ({ id: `reviewer-${index}-${crypto.randomUUID()}`, presetName: '@custom', configuration: { provider: 'codex', model: 'auto', permissions: 'Read only' } })), architect: { id: `architect-${crypto.randomUUID()}`, presetName: '@custom', configuration: { provider: 'claude', model: 'auto', permissions: 'Read only' } } }
}
