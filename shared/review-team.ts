import type { WorkflowReviewSource } from './workflow'
/** A copied team definition, never a live reference to a mutable saved preset. */
export interface ReviewTeamPreset {
  version: 1
  id: string
  name: string
  reviewers: WorkflowReviewSource[]
  architect: WorkflowReviewSource
}
export interface ReviewTeamsAPI {
  list(): Promise<ReviewTeamPreset[]>
  save(request: { team: ReviewTeamPreset }): Promise<ReviewTeamPreset>
  remove(request: { id: string }): Promise<void>
}
