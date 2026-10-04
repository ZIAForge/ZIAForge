/** Prompt guidance only: never changes tools, access, verification or approvals. */
export interface SpecializationSelection {
  mode: 'none' | 'standard' | 'auto' | 'manual'
  ids?: string[]
  instructions?: string
}
export const SPECIALIZATIONS = [
  { id: 'general', name: 'General engineering', nameRu: 'Общая разработка', guidance: 'Trace requirements through callers and data flow. Prefer minimal coherent changes, explicit invariants, maintainable interfaces and relevant regression evidence.' },
  { id: 'security', name: 'Security', nameRu: 'Безопасность', guidance: 'Examine trust boundaries, authorization, injection, secrets, path handling and untrusted input. Report concrete reachable failures and their preconditions, not generic security advice.' },
  { id: 'reliability', name: 'Lifecycle and reliability', nameRu: 'Жизненный цикл и надёжность', guidance: 'Trace cancellation, concurrency, resource ownership, restart, persistence and ambiguous delivery. Look for stale callbacks, duplicate effects, data loss and cleanup failures.' },
  { id: 'architecture', name: 'Architecture and contracts', nameRu: 'Архитектура и контракты', guidance: 'Trace module boundaries, API compatibility, dependencies and migration. Verify that every affected caller follows the same contract; avoid speculative abstraction.' },
  { id: 'performance', name: 'Performance', nameRu: 'Производительность', guidance: 'Identify actual hot paths, repeated I/O, unbounded data and algorithmic costs. Tie concerns to measurable workload or explicit bounds; do not infer bottlenecks without evidence.' },
  { id: 'testing', name: 'Tests and verification', nameRu: 'Тесты и проверка', guidance: 'Check meaningful failure-path and boundary coverage. Distinguish real behavior from mocks and assertions mirroring implementation. Preserve independent verification and report untested claims.' },
  { id: 'ux', name: 'User flows and accessibility', nameRu: 'UX и доступность', guidance: 'Trace real user actions, focus, keyboard access, drafts, loading/error states and recovery. Identify unreachable actions, lost input and misleading completion or permission claims.' },
] as const
export function validateSpecialization(value: unknown): asserts value is SpecializationSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid specialization selection')
  const v = value as Record<string, unknown>
  if (Object.keys(v).some(key => !['mode', 'ids', 'instructions'].includes(key)) || !['none', 'standard', 'auto', 'manual'].includes(String(v.mode))) throw new Error('Invalid specialization mode')
  if (v.mode !== 'manual' && (v.ids !== undefined || v.instructions !== undefined)) throw new Error('Only manual specialization accepts selected profiles or instructions')
  if (v.ids !== undefined && (!Array.isArray(v.ids) || v.ids.length > 4 || new Set(v.ids).size !== v.ids.length || v.ids.some(id => !SPECIALIZATIONS.some(item => item.id === id)))) throw new Error('Invalid specialization catalog selection')
  if (v.instructions !== undefined && (typeof v.instructions !== 'string' || !v.instructions.trim() || v.instructions.length > 4000 || v.instructions.includes('\0'))) throw new Error('Invalid specialization instructions')
  if (v.mode === 'manual' && !(Array.isArray(v.ids) && v.ids.length) && !v.instructions) throw new Error('Select a specialization or provide its instructions')
}
export function suggestedSpecializations(text: string): string[] {
  const rules: Array<[string, RegExp]> = [
    ['security', /auth|secur|secret|token|permission|injection|безопас|доступ|авторизац/i],
    ['reliability', /concurr|cancel|restart|persist|stream|process|session|race|очеред|сохран|поток|процесс|сесси/i],
    ['ux', /\bui\b|focus|accessib|keyboard|composer|draft|интерфейс|фокус|доступност|черновик/i],
    ['performance', /perform|memory|latency|cache|scale|производ|памят|задерж/i],
    ['architecture', /architect|schema|migration|\bapi\b|contract|архитект|контракт|миграц/i],
  ]
  const ids = rules.filter(([, match]) => match.test(text)).map(([id]) => id).slice(0, 3)
  return ids.length ? ids : ['general', 'testing']
}
export function specializationPrompt(value: SpecializationSelection | undefined, context: string): string {
  if (!value || value.mode === 'none') return ''
  validateSpecialization(value)
  const ids = value.mode === 'standard' ? ['general', 'testing'] : value.mode === 'auto' ? suggestedSpecializations(context) : value.ids ?? []
  return '\nAdditional specialization guidance (subordinate to the assigned task, access and verification rules):\n' + ids.map(id => SPECIALIZATIONS.find(item => item.id === id)!.guidance).join('\n') + (value.instructions ? `\nUser-selected specialty instructions:\n${value.instructions}` : '')
}
