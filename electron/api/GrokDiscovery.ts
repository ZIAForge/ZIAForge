import type { GrokConnectorInspection } from '../../shared/api-provider'
import { isReasoningEffort, type AgentModelCatalog } from '../../shared/agent-models'

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown, max = 200): string | undefined => typeof value === 'string' && value.length <= max && !/[\r\n\0]/.test(value) ? value : undefined
const contextSize = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 100_000_000

/** Only explicitly advertised model metadata is offered to the owner. */
export function grokModelMetadata(value: unknown): Partial<AgentModelCatalog['models'][number]> {
  const item = object(value)
  const efforts = Array.isArray(item.reasoning_efforts) && item.reasoning_efforts.length <= 32 && item.reasoning_efforts.every(isReasoningEffort)
    ? [...new Set(item.reasoning_efforts)] : undefined
  const contexts = Array.isArray(item.context_windows) && item.context_windows.length <= 32 && item.context_windows.every(contextSize)
    ? [...new Set(item.context_windows)] : undefined
  return {
    ...(efforts ? { supportedReasoningEfforts: efforts } : {}),
    ...(isReasoningEffort(item.default_reasoning_effort) && efforts?.includes(item.default_reasoning_effort) ? { defaultReasoningEffort: item.default_reasoning_effort } : {}),
    ...(contexts ? { contextWindows: contexts } : {}),
    ...(contextSize(item.context_window) && contexts?.includes(item.context_window) ? { defaultContextWindow: item.context_window } : {}),
  }
}

export function grokInspection(capabilities: unknown, usage: unknown, models: unknown, usageAvailable: boolean): GrokConnectorInspection {
  const cap = object(capabilities)
  if (cap.version !== 1 || !Array.isArray(cap.nativeTools) || cap.nativeTools.length > 256) throw new Error('Unsupported Grok Connector capability contract')
  const tools = cap.nativeTools.map(item => text(object(item).name)).filter((name): name is string => Boolean(name && /^[a-zA-Z0-9_-]+$/.test(name)))
  if (tools.length !== cap.nativeTools.length) throw new Error('Invalid Grok Connector tool catalog')
  const media = object(cap.media), images = object(media.images), video = object(media.video), questions = object(cap.interactiveQuestions)
  const limits = object(object(usage).rate_limits), period = object(limits.currentPeriod)
  const modelList = object(models).data
  if (!Array.isArray(modelList) || modelList.length > 5000) throw new Error('Invalid Grok Connector model catalog')
  const contextWindows = [...new Set(modelList.flatMap(item => grokModelMetadata(item).contextWindows ?? []))].sort((a, b) => a - b)
  const credit = limits.creditUsagePercent
  const imageGeneration = images.available === true && images.verified === true
  const videoAvailable = video.available === true && video.enabled === true && video.verified === true
  return {
    version: 1, fetchedAt: Date.now(), cliVersion: text(cap.cliVersion), tools,
    imageInput: cap.imageInput === true, imageGeneration,
    imageEdit: imageGeneration && images.edit === true,
    videoAvailable, videoRestriction: text(video.restriction, 1000),
    interactiveQuestions: questions.available === true,
    reasoningSummaries: cap.reasoningSummaries === true,
    contextWindows,
    ...(usageAvailable ? { usage: { tier: text(limits.tier), creditUsagePercent: typeof credit === 'number' && Number.isFinite(credit) && credit >= 0 && credit <= 100 ? credit : null, periodEnd: text(period.end, 80) ?? null } } : {}),
    warnings: [
      ...(!usageAvailable ? ['Usage information is unavailable.'] : []),
      ...(!imageGeneration ? ['Image generation has not been verified on this connector.'] : []),
      ...(!videoAvailable ? ['Video generation is unavailable on this connector.'] : []),
      'Provider tools run on the connector. Project file tools run in the ZIAForge task workspace.',
      'A usage period end is not a subscription payment or expiration date.',
    ],
  }
}
