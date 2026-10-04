import { uiText, uiKey } from '../../uiText'

/** Display-only labels. Stored protocol values and provider output stay unchanged. */
const statuses: Record<string, string> = {
  draft: 'Draft', running: 'Working', paused: 'Paused', blocked: 'Blocked', completed: 'Completed', pending: 'Waiting',
  failed: 'Failed', interrupted: 'Interrupted', helper: 'Research', implementation: 'Implementation', verification: 'Verification',
  review: 'Review', red: 'Failing test', finished: 'Finished', approved: 'Approved', changes_requested: 'Changes requested',
  succeeded: 'Succeeded', conflicted: 'Conflict', stopped: 'Stopped', ready: 'Ready', starting: 'Starting', stopping: 'Stopping',
  waiting: 'Waiting', waiting_input: 'Awaiting an answer', cancelled: 'Cancelled', uncertain: 'Outcome unknown',
  disabled: 'Disabled', idle: 'Idle', checking: 'Checking', available: 'Update available', downloading: 'Downloading',
  downloaded: 'Downloaded', 'up-to-date': 'Up to date', up_to_date: 'Up to date', unsupported: 'Unavailable', error: 'Error',
  requirements: 'Requirements', specification: 'Specification', planning: 'Planning', discovery: 'Task assessment', investigation: 'Bug investigation', delivery: 'Delivery report', primary: 'Primary source', secondary: 'Secondary source',
  commit: 'Commit', merge: 'Merge', push: 'Push', stage: 'Stage', unstage: 'Unstage', discard: 'Discard',
}
export const statusLabel = (value: string, russian = false) => uiText(statuses[value] ?? value, undefined, russian ? 'ru' : undefined)

const flowKeys: Record<string, string> = { auto: 'wf_auto_name', Auto: 'wf_auto_name', fix: 'wf_fix_bug_name', Fix: 'wf_fix_bug_name', 'Fix a bug': 'wf_fix_bug_name', 'spec-first': 'wf_spec_first_name', 'Spec first': 'wf_spec_first_name', 'requirements-first': 'wf_req_first_name', 'Requirements first': 'wf_req_first_name', 'multi-model': 'wf_multimodel_name', 'Multi-model': 'wf_multimodel_name' }
const workNames: Record<string, string> = { write: 'Write', brainstorm: 'Brainstorm', deep: 'Deep Brainstorm', 'deep-brainstorm': 'Deep Brainstorm', research: 'Research', draft: 'Draft' }
export const flowLabel = (value: string) => flowKeys[value] ? uiKey(flowKeys[value]) : uiText(workNames[value] ?? value)
