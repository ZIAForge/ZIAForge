import path from 'node:path'
import type { ReviewTeamPreset } from '../../shared/review-team'
import { RecoveryStore } from '../runtime/RecoveryStore'
import { validateReviewTeam, workflowId } from './WorkflowValidation'
interface TeamDocument { version: 1; teams: ReviewTeamPreset[] }
function validate(value: unknown): asserts value is TeamDocument {
  const doc = value as TeamDocument
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || Object.keys(doc).some(key => !['version', 'teams'].includes(key)) || doc.version !== 1 || !Array.isArray(doc.teams) || doc.teams.length > 100) throw new Error('Invalid saved review teams')
  doc.teams.forEach(validateReviewTeam)
  if (new Set(doc.teams.map(team => team.id)).size !== doc.teams.length) throw new Error('Duplicate review team identity')
}
export class ReviewTeamStore {
  private readonly store: RecoveryStore<TeamDocument>
  constructor(directory: string) { this.store = new RecoveryStore({ filename: path.join(directory, 'review-teams.json'), validate, maxBytes: 1024 * 1024 }) }
  list(): ReviewTeamPreset[] { return structuredClone(this.store.read()?.teams ?? []) }
  save({ team }: { team: ReviewTeamPreset }): ReviewTeamPreset {
    validateReviewTeam(team)
    const before = this.store.inspect(), teams = this.list()
    const index = teams.findIndex(item => item.id === team.id)
    if (index < 0) teams.push(structuredClone(team)); else teams[index] = structuredClone(team)
    this.store.write({ version: 1, teams }, before.fingerprint)
    return structuredClone(team)
  }
  remove({ id }: { id: string }): void {
    workflowId(id)
    const before = this.store.inspect(), teams = this.list().filter(team => team.id !== id)
    this.store.write({ version: 1, teams }, before.fingerprint)
  }
}
