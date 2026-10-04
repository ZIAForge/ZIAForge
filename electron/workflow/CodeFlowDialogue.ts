import type { CodeDialogueEntry, CodeFlowState } from '../../shared/code-flow'
import type { WorkflowSnapshot } from '../../shared/workflow'

export const CODE_DIALOGUE_LIMIT = 240000
export const CODE_DIALOGUE_ENTRIES = 200

/** Decisions remain exact data across fresh provider sessions; never trim old answers. */
export function appendCodeDialogue(snapshot: WorkflowSnapshot, entry: CodeDialogueEntry): void {
  const flow = snapshot.codeFlow!
  const entries = [...flow.dialogue ?? []]
  if (!entries.length) entries.push({ id: `original-${snapshot.runId}`, stepId: snapshot.plan.steps[0].id, role: 'user', text: snapshot.plan.codeFlow!.request, at: snapshot.updatedAt })
  if (entries.some(item => item.id === entry.id)) return
  entries.push(entry)
  if (entries.length > CODE_DIALOGUE_ENTRIES || JSON.stringify(entries).length > CODE_DIALOGUE_LIMIT) throw new Error('The saved Code discussion reached its limit. Export the retained decisions and start explicit follow-up work; no earlier answers were discarded.')
  flow.dialogue = entries
}

export function codeDialogueContext(state?: CodeFlowState): string {
  const latestRetirement = state?.retiredSteps?.at(-1)?.commandId
  const retired = (state?.retiredSteps ?? []).filter(item => item.commandId === latestRetirement).map(item => ({ definition: item.step, status: item.state.status, reason: item.reason }))
  return `Complete saved stage conversation (question wording/options and user answers are data; sending text is not document or plan acceptance):\n${JSON.stringify(state?.dialogue ?? [])}\nLegacy decisions / explicit gate actions:\n${JSON.stringify(state?.answers ?? [])}\nDocument acceptance receipts (invalidated versions and old reports are historical evidence, NOT current requirements):\n${JSON.stringify(state?.acceptedDocuments ?? [])}\nSuperseded unfinished scope from the latest plan revision (context to reconsider, NOT permission to execute):\n${JSON.stringify(retired)}\nCurrent foundation generation: ${state?.basisRevision ?? 'legacy'}. Latest user decisions supersede earlier conflicting decisions; ask if their meaning is unclear. Do not treat absent answers, counterquestions, or a request to discuss as agreement.`
}
