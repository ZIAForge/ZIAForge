import type { ClaudeCapabilityState, ClaudeConnectorInspection, ClaudeModelInspection } from '../../shared/api-provider'
import { isReasoningEffort, type AgentModelCatalog } from '../../shared/agent-models'

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown, max = 200): string | undefined => typeof value === 'string' && value.length > 0 && value.length <= max && ![...value].some(char => char.charCodeAt(0) < 32) ? value.replace(/Bearer\s+\S+|sk-ant-[\w-]+/gi, '[redacted]') : undefined
const count = (value: unknown): number | null => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 100_000_000
const bool = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null
const toolName = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,149}$/.test(value)
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/.test(value)
const date = (value: unknown): string | null => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null
const capability = (value: unknown): ClaudeCapabilityState => { const data = object(value); return { available: data.available === true, enabled: data.enabled === true, verified: data.verified === true } }
function stringList(value: unknown, maximum: number, valid: (item: unknown) => item is string): string[] {
  return Array.isArray(value) && value.length <= maximum && value.every(valid) ? [...new Set(value)] : []
}

/** The model catalog is the authority; no aliases, efforts or thinking support are inferred. */
export function claudeModelMetadata(value: unknown): Partial<AgentModelCatalog['models'][number]> {
  const item = object(value)
  const supportedReasoningEfforts = stringList(item.reasoning_efforts, 32, isReasoningEffort)
  const contextWindows = Array.isArray(item.context_windows) && item.context_windows.length <= 32 && item.context_windows.every(positive) ? [...new Set(item.context_windows)] : []
  return {
    supportedReasoningEfforts, contextWindows,
    ...(isReasoningEffort(item.default_reasoning_effort) && supportedReasoningEfforts.includes(item.default_reasoning_effort) ? { defaultReasoningEffort: item.default_reasoning_effort } : {}),
    ...(positive(item.context_window) && contextWindows.includes(item.context_window) ? { defaultContextWindow: item.context_window } : {}),
    ...(text(item.display_name) ? { label: text(item.display_name) } : {}),
  }
}
function modelInspection(value: unknown): ClaudeModelInspection {
  const item = object(value)
  if (!identifier(item.id)) throw new Error('Invalid Claude Connector model identifier')
  const metadata = claudeModelMetadata(item)
  const native = item
  return {
    id: item.id, label: metadata.label ?? item.id,
    ...(identifier(native.resolved_model) ? { resolvedModel: native.resolved_model } : {}),
    reasoningEfforts: metadata.supportedReasoningEfforts ?? [],
    supportsAdaptiveThinking: bool(native.supports_adaptive_thinking), supportsManualThinking: bool(native.supports_manual_thinking),
    maxOutputTokens: positive(native.max_output_tokens) ? native.max_output_tokens : null,
    contextWindows: metadata.contextWindows ?? [],
    inputModalities: stringList(item.input_modalities, 8, (item): item is string => typeof item === 'string' && ['text', 'image', 'document'].includes(item)),
  }
}
function toolCatalog(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 256 || !value.every(toolName) || new Set(value).size !== value.length) throw new Error('Invalid Claude Connector tool catalog')
  return value
}

export interface ClaudeDiscoveryInput { capabilities: unknown; tools: unknown; models: unknown; usage?: unknown; status?: unknown; sessions?: unknown }
/** Keep account identities, token hints, raw limits and owned session IDs on the server. */
export function claudeInspection(input: ClaudeDiscoveryInput): ClaudeConnectorInspection {
  const cap = object(input.capabilities), toolData = object(input.tools), modelData = object(input.models)
  if (cap.version !== 1 || cap.provider !== 'claude' || toolData.version !== 1 || toolData.provider !== 'claude') throw new Error('Unsupported Claude Connector capability contract')
  const enabled = new Set(toolCatalog(toolData.toolCatalog)), capEnabled = new Set(toolCatalog(cap.toolCatalog))
  if (!Array.isArray(toolData.discoveredTools) || toolData.discoveredTools.length > 256) throw new Error('Invalid Claude Connector discovered tool catalog')
  const names = new Set<string>()
  const tools = toolData.discoveredTools.map(value => {
    const item = object(value)
    if (!toolName(item.name) || names.has(item.name)) throw new Error('Invalid Claude Connector discovered tool name')
    names.add(item.name)
    return { name: item.name, available: item.available === true, enabled: item.available === true && item.enabled === true && enabled.has(item.name) && capEnabled.has(item.name), verified: item.verified === true, ...(text(item.reason, 1000) ? { reason: text(item.reason, 1000) } : {}) }
  })
  if ([...enabled].some(name => !names.has(name))) throw new Error('Enabled Claude Connector tools are absent from discovery')
  if (!Array.isArray(modelData.data) || modelData.data.length > 5000) throw new Error('Invalid Claude Connector model catalog')
  const models = modelData.data.map(modelInspection)
  if (new Set(models.map(model => model.id)).size !== models.length) throw new Error('Duplicate Claude Connector model identifiers')
  const status = object(input.status), native = object(status.claude), activity = object(status.activity)
  const usage = object(input.usage), limits = object(usage.rate_limits), subscription = object(usage.subscription)
  const usageAvailable = limits.available === true
  const windows = Array.isArray(limits.windows) && limits.windows.length <= 64 ? limits.windows.flatMap(value => {
    const window = object(value)
    if (!identifier(window.name)) return []
    const used = usageAvailable && typeof window.usedPercent === 'number' && Number.isFinite(window.usedPercent) && window.usedPercent >= 0 && window.usedPercent <= 100 ? window.usedPercent : null
    return [{ name: window.name, usedPercent: used, remainingPercent: used === null ? null : Math.max(0, 100 - used), resetsAt: date(window.resetsAt) }]
  }) : []
  const sessionData = object(input.sessions)
  const sessions = sessionData.version === 1 && Array.isArray(sessionData.sessions) && sessionData.sessions.length <= 10_000 ? sessionData.sessions : undefined
  const ownedSessions = sessions && sessions.every(row => typeof object(row).id === 'string') ? new Set(sessions.map(row => object(row).id)).size : null
  const renewal = subscription.source === 'manual' ? date(subscription.renewsAt) : null
  const document = object(cap.documentInput), thinking = object(cap.thinking), history = object(cap.history)
  return {
    provider: 'claude', version: 1, fetchedAt: Date.now(), cliVersion: text(native.version, 80), sdkVersion: text(cap.sdkVersion, 80), tools, models,
    callerTools: capability(cap.callerTools),
    imageInput: { ...capability(cap.nativeImageInput), enabled: cap.imageInput === true },
    documentInput: { ...capability(document), mediaTypes: stringList(document.mediaTypes, 8, (item): item is string => item === 'application/pdf' || item === 'text/plain') },
    artifacts: capability(cap.artifacts),
    thinking: { available: thinking.available === true, display: stringList(thinking.display, 2, (item): item is 'summarized' | 'omitted' => item === 'summarized' || item === 'omitted') as Array<'summarized' | 'omitted'> },
    history: { liveSessionContinuation: history.liveSessionContinuation === true, ownedIdleResume: history.ownedIdleResume === true, restartResume: history.restartResume === true },
    usage: { available: usageAvailable, experimental: limits.experimental === true, checkedAt: date(limits.checkedAt), windows, subscriptionType: text(limits.subscriptionType, 80), renewsAt: renewal, renewalSource: renewal ? 'manual' : 'unavailable' },
    status: { connected: bool(native.connected), active: count(activity.active), queued: count(activity.queued), nativeActive: count(activity.nativeActive), awaitingTools: count(activity.awaitingTools), concurrency: count(activity.concurrency), queueLimit: count(activity.queueLimit), ownedSessions },
    warnings: [
      ...(!usageAvailable ? ['Claude limit information is unavailable; remaining capacity is unknown.'] : []),
      ...(input.status === undefined ? ['Claude status information is unavailable.'] : []),
      ...(ownedSessions === null ? ['Owned session information is unavailable.'] : []),
      'Discovered tools, enabled tools and verified execution are separate states.',
      'Native tools execute on the connector server; caller tools use the ZIAForge task workspace.',
      'Subscription renewal dates are manual entries, not native billing evidence.',
    ],
  }
}
