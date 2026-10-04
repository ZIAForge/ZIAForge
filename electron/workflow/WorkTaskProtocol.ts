import type { WorkPhaseResult } from '../../shared/work-flow'
import { validateWorkResult } from './WorkTaskValidation'
export function parseWorkResult(output: string): WorkPhaseResult {
  if (Buffer.byteLength(output) > 1000000) throw new Error('Work result exceeds the bounded output limit')
  const matches = [...output.matchAll(/```ziaforge-work\s*\n([\s\S]*?)\n```/g)]
  if (matches.length !== 1) throw new Error('Expected exactly one ziaforge-work result')
  let value: unknown
  try { value = JSON.parse(matches[0][1]) } catch { throw new Error('Work result is not valid JSON') }
  // Native models sometimes omit unused collections. Normalize only absence at
  // this transport boundary; explicit null/wrong types and saved receipts keep
  // their strict validation. Required questions/plan steps are checked below.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const field of ['questions', 'artifacts', 'sources', 'steps']) if (!Object.hasOwn(record, field)) record[field] = []
  }
  validateWorkResult(value)
  return value
}
