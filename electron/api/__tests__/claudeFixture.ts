/** Deterministic connector-shaped records, never captured provider content. */
export const responseId = (n: number) => `resp_${n.toString(16).padStart(32, '0')}`
export const claudeFrame = (event: unknown) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`
export function claudeRecords(n: number, blocks: Array<Record<string, unknown>>, extras: Array<Record<string, unknown>> = []) {
  return [
    { type: 'message_start', message: { id: responseId(n).replace('resp_', 'msg_'), type: 'message', role: 'assistant', model: 'fixture-model', content: [], stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } } },
    ...extras,
    ...blocks.flatMap((block, index) => [
      { type: 'content_block_start', index, content_block: block.type === 'text' ? { type: 'text', text: '' } : block.type === 'thinking' ? { type: 'thinking', thinking: '' } : block.type === 'tool_use' ? { ...block, input: {} } : block },
      ...(block.type === 'text' ? [{ type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } }] : block.type === 'thinking' ? [{ type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking: block.thinking } }, { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: block.signature } }] : block.type === 'tool_use' ? [{ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } }] : []),
      { type: 'content_block_stop', index },
    ]),
    { type: 'message_delta', delta: { stop_reason: blocks.some(block => block.type === 'tool_use') ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { input_tokens: 7, output_tokens: 3 } },
    { type: 'message_stop', claude: { version: 1, response_id: responseId(n), requires_action: blocks.some(block => block.type === 'tool_use'), artifacts: [] } },
  ]
}
export const claudeWire = (n: number, blocks: Array<Record<string, unknown>>, extras: Array<Record<string, unknown>> = []) => new Response(claudeRecords(n, blocks, extras).map(claudeFrame).join(''), { headers: { 'Content-Type': 'text/event-stream' } })
