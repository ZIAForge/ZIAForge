import type { AgentEvent, ReconstructedMessage } from './agent-events'

/** The same incremental projector serves live sessions and disk replay. */
export function createFeedProjector() {
    const messagesMap = new Map<string, ReconstructedMessage>()
    const order: string[] = []

    const turnsMap = new Map<string, ReconstructedMessage>()

    const getOrCreateAssistantMessage = (parentMessageId?: string, turnId?: string, timestamp = Date.now(), originatingEventId?: string): ReconstructedMessage => {
      // 1. Explicit parentMessageId
      if (parentMessageId && messagesMap.has(parentMessageId)) {
        return messagesMap.get(parentMessageId)!
      }

      // 2. Explicit turnId resolved first before fallback
      if (turnId && turnsMap.has(turnId)) {
        return turnsMap.get(turnId)!
      }

      // 3. Fallback: if latest message in feed is assistant and neither turnId nor parentMessageId were specified
      if (!turnId && !parentMessageId && order.length > 0) {
        const lastMsg = messagesMap.get(order[order.length - 1])
        if (lastMsg && lastMsg.role === 'assistant') {
          return lastMsg
        }
      }

      // 4. Create new assistant turn with deterministic synthetic ID from originating event
      const syntheticId = turnId || (originatingEventId ? `turn-syn-${originatingEventId}` : `turn-syn-${timestamp}-${order.length}`)
      const syntheticMsg: ReconstructedMessage = {
        id: syntheticId,
        turnId,
        role: 'assistant',
        thinking: '',
        text: '',
        status: 'streaming',
        timestamp,
        revision: 1,
        tools: [],
        approvals: [],
      }
      messagesMap.set(syntheticId, syntheticMsg)
      if (turnId) {
        turnsMap.set(turnId, syntheticMsg)
      }
      order.push(syntheticId)
      return syntheticMsg
    }

    const apply = (evt: AgentEvent): void => {
      if (evt.type === 'message.started') {
        if (!messagesMap.has(evt.messageId)) {
          messagesMap.set(evt.messageId, {
            id: evt.messageId,
            turnId: evt.turnId,
            role: evt.role,
            ...(evt.inputImages ? { inputImages: evt.inputImages } : {}),
            ...(evt.media ? { media: evt.media } : {}),
            thinking: '',
            text: '',
            status: 'streaming',
            timestamp: evt.timestamp,
            revision: 1,
            tools: [],
            approvals: [],
          })
          order.push(evt.messageId)
        }
        if (evt.turnId && evt.role === 'assistant') turnsMap.set(evt.turnId, messagesMap.get(evt.messageId)!)
      } else if (evt.type === 'message.delta') {
        let msg = messagesMap.get(evt.messageId)
        if (!msg) {
          msg = {
            id: evt.messageId,
            turnId: evt.turnId,
            role: 'assistant',
            thinking: '',
            text: '',
            status: 'streaming',
            timestamp: evt.timestamp,
            revision: 1,
            tools: [],
            approvals: [],
          }
          messagesMap.set(evt.messageId, msg)
          order.push(evt.messageId)
        }
        if (evt.turnId) { msg.turnId = evt.turnId; turnsMap.set(evt.turnId, msg) }
        msg.revision = (msg.revision || 0) + 1
        if (evt.deltaType === 'thinking') {
          msg.thinking += evt.content
        } else {
          msg.text += evt.content
        }
      } else if (evt.type === 'message.completed') {
        if (!messagesMap.has(evt.messageId) && evt.fullContent !== undefined) {
          apply({ ...evt, type: 'message.started', role: 'assistant' })
        }
        const msg = messagesMap.get(evt.messageId)
        if (msg) {
          msg.revision = (msg.revision || 0) + 1
          if (evt.fullContent !== undefined) {
            if (evt.contentType === 'thinking') msg.thinking = evt.fullContent
            else msg.text = evt.fullContent
          }
          if (evt.finishReason === 'error') {
            msg.status = 'error'
          } else if (evt.finishReason === 'interrupted') {
            msg.status = 'interrupted'
          } else {
            msg.status = 'completed'
          }
        }
      } else if (evt.type === 'tool.started') {
        const targetMsg = getOrCreateAssistantMessage(evt.parentMessageId, evt.turnId, evt.timestamp, evt.eventId)
        targetMsg.revision = (targetMsg.revision || 0) + 1
        targetMsg.tools = targetMsg.tools || []
        targetMsg.tools.push({
          callId: evt.toolCallId,
          toolName: evt.toolName,
          input: evt.input,
          executor: evt.executor,
          status: 'running',
        })
      } else if (evt.type === 'tool.output.delta') {
        // Accumulate tool delta output
        for (const msg of messagesMap.values()) {
          const tool = msg.tools?.find((t) => t.callId === evt.toolCallId)
          if (tool) {
            msg.revision = (msg.revision || 0) + 1
            const prevOutput = typeof tool.output === 'string' ? tool.output : ''
            tool.output = prevOutput + evt.delta
            if (evt.stream) {
              tool.outputStream = evt.stream
            }
            break
          }
        }
      } else if (evt.type === 'tool.completed') {
        for (const msg of messagesMap.values()) {
          const tool = msg.tools?.find((t) => t.callId === evt.toolCallId)
          if (tool) {
            msg.revision = (msg.revision || 0) + 1
            if (evt.output !== undefined) {
              tool.output = evt.output
            }
            tool.isError = evt.isError
            tool.exitCode = evt.exitCode
            tool.signal = evt.signal
            tool.outcome = evt.outcome
            tool.media = evt.media

            if (evt.isError || evt.outcome === 'failed') {
              tool.status = 'error'
            } else if (evt.outcome === 'cancelled' || evt.outcome === 'declined') {
              tool.status = 'cancelled'
            } else {
              tool.status = 'completed'
            }
            break
          }
        }
      } else if (evt.type === 'permission.requested') {
        // Find message by toolCallId or get assistant message
        let targetMsg: ReconstructedMessage | undefined
        if (evt.toolCallId) {
          for (const msg of messagesMap.values()) {
            if (msg.tools?.some((t) => t.callId === evt.toolCallId)) {
              targetMsg = msg
              break
            }
          }
        }
        if (!targetMsg) {
          targetMsg = getOrCreateAssistantMessage(undefined, evt.turnId, evt.timestamp, evt.eventId)
        }

        targetMsg.revision = (targetMsg.revision || 0) + 1
        targetMsg.approvals = targetMsg.approvals || []
        targetMsg.approvals.push({
          approvalId: evt.approvalId,
          command: evt.command,
          toolCallId: evt.toolCallId,
          description: evt.description,
          riskLevel: evt.riskLevel,
          decisionOptions: evt.decisionOptions,
          state: 'pending',
        })
      } else if (evt.type === 'permission.state.changed') {
        for (const msg of messagesMap.values()) {
          const app = msg.approvals?.find((a) => a.approvalId === evt.approvalId)
          if (app) {
            msg.revision = (msg.revision || 0) + 1
            app.state = evt.state
            app.decision = evt.decision
            break
          }
        }
      } else if (evt.type === 'interaction.requested') {
        if ([...messagesMap.values()].some(message => message.interactions?.some(interaction => interaction.interactionId === evt.interaction.interactionId))) return
        const target = getOrCreateAssistantMessage(evt.parentMessageId, evt.turnId, evt.timestamp, evt.eventId)
        target.interactions ??= []
        target.interactions.push(JSON.parse(JSON.stringify(evt.interaction)))
        target.revision = (target.revision ?? 0) + 1
      } else if (evt.type === 'interaction.state.changed') {
        for (const message of messagesMap.values()) {
          const interaction = message.interactions?.find(item => item.interactionId === evt.interactionId)
          if (!interaction) continue
          interaction.state = evt.state
          if (evt.answer !== undefined) interaction.answer = JSON.parse(JSON.stringify(evt.answer))
          if (evt.resolvedBy !== undefined) interaction.resolvedBy = evt.resolvedBy
          if (evt.error !== undefined) interaction.error = evt.error
          message.revision = (message.revision ?? 0) + 1
          break
        }
      } else if (evt.type === 'agent.status.changed' && ['completed', 'stopped', 'error'].includes(evt.status)) {
        for (const msg of messagesMap.values()) {
          if (msg.role !== 'assistant' || (evt.scope === 'turn' && evt.turnId && msg.turnId !== evt.turnId)) continue
          let changed = false
          if (msg.status === 'streaming') {
            msg.status = evt.status === 'completed' ? 'completed' : evt.status === 'stopped' ? 'interrupted' : 'error'
            changed = true
          }
          for (const tool of msg.tools ?? []) {
            if (tool.status === 'running') { tool.status = evt.status === 'completed' ? 'completed' : evt.status === 'stopped' ? 'cancelled' : 'error'; changed = true }
          }
          for (const approval of msg.approvals ?? []) {
            if (approval.state === 'pending' || approval.state === 'submitting') { approval.state = 'expired'; changed = true }
          }
          for (const interaction of msg.interactions ?? []) {
            if (interaction.state === 'pending' || interaction.state === 'submitting') { interaction.state = 'expired'; changed = true }
          }
          if (changed) msg.revision = (msg.revision ?? 0) + 1
        }
      }
    }

    return { apply, messages: (): ReconstructedMessage[] => order.map((id) => messagesMap.get(id)!) }
}
