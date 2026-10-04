import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import {
  AgentAdapterFactory,
  CODEX_CAPABILITIES,
  ANTIGRAVITY_CAPABILITIES,
  CLAUDE_CAPABILITIES,
  AgentAdapter,
  CreateAdapterOptions,
  createAgentAdapter,
  getAgentCapabilities,
  resolveAgentProvider,
} from '../AgentAdapterFactory'
import { CodexAdapter } from '../CodexAdapter'
import { AntigravityAdapter } from '../AntigravityAdapter'
import { ClaudeAdapter } from '../ClaudeAdapter'
import { ProcessSupervisor } from '../../runtime/ProcessSupervisor'
import { AgentEvent } from '../../../shared/agent-events'
import { AgentProviderType } from '../../../shared/agent-commands'

class MockChildProcess extends EventEmitter {
  pid = 12345
  stdin = new PassThrough()
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false
  exitCode: number | null = null
  signalCode: string | null = null

  kill(signal: NodeJS.Signals | number = 'SIGTERM') {
    this.killed = true
    this.signalCode = typeof signal === 'string' ? signal : String(signal)
    process.nextTick(() => {
      this.emit('exit', 0, this.signalCode)
      this.emit('close', 0, this.signalCode)
    })
    return true
  }
}

describe('AgentAdapterFactory & Capability Gating', () => {
  let mockProc: MockChildProcess
  let mockSupervisor: ProcessSupervisor
  let baseOptions: CreateAdapterOptions

  beforeEach(() => {
    mockProc = new MockChildProcess()
    mockSupervisor = {
      killProcessTree: vi.fn(),
      terminateProcessTree: vi.fn().mockResolvedValue(true),
    } as unknown as ProcessSupervisor

    baseOptions = {
      taskId: 'test-task-1',
      runId: 'run-1',
      worktreePath: '/tmp/worktree',
      supervisor: mockSupervisor,
      spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
    }
  })

  it('fails closed before spawn for providers without a verified tool-free contract', () => {
    const spawn = vi.fn(baseOptions.spawnProcess!)
    for (const agentProvider of ['codex', 'antigravity']) expect(() => AgentAdapterFactory.createAdapter({ ...baseOptions, agentProvider, toolPolicy: 'none', spawnProcess: spawn })).toThrow(/tool-free architect/)
    expect(spawn).not.toHaveBeenCalled()
    const claude = AgentAdapterFactory.createAdapter({ ...baseOptions, agentProvider: 'claude', toolPolicy: 'none' })
    expect(claude.getCapabilities().toolCalls).toBe(false)
  })

  describe('1. Provider Resolution and Model Inference', () => {
    it('resolves explicitly specified providers', () => {
      expect(AgentAdapterFactory.resolveProvider('codex')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider('antigravity')).toBe('antigravity')
      expect(AgentAdapterFactory.resolveProvider('claude')).toBe('claude')
    })

    it('resolves providers case-insensitively', () => {
      expect(AgentAdapterFactory.resolveProvider('CODEX')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider('Antigravity')).toBe('antigravity')
      expect(AgentAdapterFactory.resolveProvider('cLaUdE')).toBe('claude')
    })

    it('infers claude provider from model prefix or namespace when provider is omitted', () => {
      expect(AgentAdapterFactory.resolveProvider(undefined, 'claude-3-5-sonnet-20241022')).toBe('claude')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'claude-3-opus-20240229')).toBe('claude')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'claude-3-7-sonnet')).toBe('claude')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'anthropic/claude-3-haiku')).toBe('claude')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'anthropic:claude-sonnet')).toBe('claude')
    })

    it('infers antigravity provider from gemini/agy/google model prefix when provider is omitted', () => {
      expect(AgentAdapterFactory.resolveProvider(undefined, 'gemini-1.5-pro')).toBe('antigravity')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'gemini-2.0-flash')).toBe('antigravity')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'agy-standard')).toBe('antigravity')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'antigravity-code-v1')).toBe('antigravity')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'google/gemini-2.5-pro')).toBe('antigravity')
    })

    it('infers codex provider from gpt/o1/o3/codex/openai model prefix when provider is omitted', () => {
      expect(AgentAdapterFactory.resolveProvider(undefined, 'gpt-4o')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'gpt-4-turbo')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'o1-preview')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'o3-mini')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'codex-davinci-002')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider(undefined, 'openai/gpt-4o')).toBe('codex')
    })

    it('uses strict prefix matching and avoids substring false positives', () => {
      // Model starting with gpt- should resolve to codex even if 'claude' appears in the name
      expect(AgentAdapterFactory.resolveProvider(undefined, 'gpt-claude-compat')).toBe('codex')
      // Model with unknown prefix containing 'gemini' in the middle should fall back to codex
      expect(AgentAdapterFactory.resolveProvider(undefined, 'unknown-gemini-model')).toBe('codex')
    })

    it('falls back to default codex provider if model is unknown and provider is omitted', () => {
      expect(AgentAdapterFactory.resolveProvider(undefined, 'unknown-model-xyz')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider(undefined, undefined)).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider('', '')).toBe('codex')
    })

    it('prioritizes explicit provider over inferred model name', () => {
      expect(AgentAdapterFactory.resolveProvider('codex', 'claude-3-5-sonnet')).toBe('codex')
      expect(AgentAdapterFactory.resolveProvider('antigravity', 'gpt-4o')).toBe('antigravity')
      expect(AgentAdapterFactory.resolveProvider('claude', 'gemini-1.5-pro')).toBe('claude')
    })

    it('throws descriptive error for unsupported provider string', () => {
      expect(() => AgentAdapterFactory.resolveProvider('non-existent-provider')).toThrow(
        /Unsupported agent provider: "non-existent-provider"/i
      )
    })
  })

  describe('2. Capability Gating & Safety', () => {
    it('returns exact capability profiles for known providers', () => {
      expect(AgentAdapterFactory.getCapabilities('codex')).toEqual(CODEX_CAPABILITIES)
      expect(AgentAdapterFactory.getCapabilities('antigravity')).toEqual(ANTIGRAVITY_CAPABILITIES)
      expect(AgentAdapterFactory.getCapabilities('claude')).toEqual(CLAUDE_CAPABILITIES)
    })

    it('protects against Object prototype properties (constructor, __proto__, toString)', () => {
      expect(() => AgentAdapterFactory.getCapabilities('constructor')).toThrow(
        /Unsupported agent provider: "constructor"/i
      )
      expect(() => AgentAdapterFactory.getCapabilities('__proto__')).toThrow(
        /Unsupported agent provider: "__proto__"/i
      )
      expect(() => AgentAdapterFactory.getCapabilities('toString')).toThrow(
        /Unsupported agent provider: "toString"/i
      )
    })

    it('returns isolated copies preventing mutation of internal capability profiles', () => {
      const caps = AgentAdapterFactory.getCapabilities('claude')
      caps.interactiveApprovals = false
      caps.attachments = true

      // Verify that internal profile remains protected
      expect(AgentAdapterFactory.getCapabilities('claude').interactiveApprovals).toBe(true)
      expect(AgentAdapterFactory.getCapabilities('claude').attachments).toBe(false)
      expect(AgentAdapterFactory.hasCapability('claude', 'interactiveApprovals')).toBe(true)
    })

    it('accurately reports individual capabilities via hasCapability', () => {
      // Interactive approvals: Codex and Claude
      expect(AgentAdapterFactory.hasCapability('codex', 'interactiveApprovals')).toBe(true)
      expect(AgentAdapterFactory.hasCapability('antigravity', 'interactiveApprovals')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('claude', 'interactiveApprovals')).toBe(true)

      // Thinking streaming: Codex and Claude
      expect(AgentAdapterFactory.hasCapability('codex', 'thinkingStreaming')).toBe(true)
      expect(AgentAdapterFactory.hasCapability('antigravity', 'thinkingStreaming')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('claude', 'thinkingStreaming')).toBe(true)

      // Tool output streaming: Codex
      expect(AgentAdapterFactory.hasCapability('codex', 'toolOutputStreaming')).toBe(true)
      expect(AgentAdapterFactory.hasCapability('antigravity', 'toolOutputStreaming')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('claude', 'toolOutputStreaming')).toBe(false)

      // Attachments: currently false across all adapters
      expect(AgentAdapterFactory.hasCapability('codex', 'attachments')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('antigravity', 'attachments')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('claude', 'attachments')).toBe(false)

      // Text streaming and tool calls
      expect(AgentAdapterFactory.hasCapability('codex', 'textStreaming')).toBe(true)
      expect(AgentAdapterFactory.hasCapability('antigravity', 'textStreaming')).toBe(true)
      expect(AgentAdapterFactory.hasCapability('claude', 'textStreaming')).toBe(true)
      expect(AgentAdapterFactory.hasCapability('codex', 'toolCalls')).toBe(true)
      expect(AgentAdapterFactory.hasCapability('antigravity', 'toolCalls')).toBe(true)
      expect(AgentAdapterFactory.hasCapability('claude', 'toolCalls')).toBe(true)
    })

    it('assertCapability succeeds when capability is supported and throws when not', () => {
      expect(() => AgentAdapterFactory.assertCapability('codex', 'interactiveApprovals')).not.toThrow()
      expect(() => AgentAdapterFactory.assertCapability('claude', 'interactiveApprovals')).not.toThrow()
      expect(() => AgentAdapterFactory.assertCapability('antigravity', 'interactiveApprovals')).toThrow(
        /Agent provider "antigravity" does not support interactive approvals/i
      )
      expect(() => AgentAdapterFactory.assertCapability('codex', 'attachments')).toThrow(
        /Agent provider "codex" does not support attachments/i
      )
    })

    it('rejects inherited object properties as capability names (__proto__, constructor, toString)', () => {
      expect(AgentAdapterFactory.hasCapability('codex', '__proto__')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('codex', 'constructor')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('codex', 'toString')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('claude', 'valueOf')).toBe(false)
      expect(AgentAdapterFactory.hasCapability('antigravity', 'hasOwnProperty')).toBe(false)

      expect(() => AgentAdapterFactory.assertCapability('codex', '__proto__')).toThrow(
        /Agent provider "codex" does not support __proto__/i
      )
      expect(() => AgentAdapterFactory.assertCapability('codex', 'constructor')).toThrow(
        /Agent provider "codex" does not support constructor/i
      )
      expect(() => AgentAdapterFactory.assertCapability('claude', 'toString')).toThrow(
        /Agent provider "claude" does not support to string/i
      )
    })

    it('assertCanSendPrompt validates attachments capability before dispatch', () => {
      // Prompt without attachments succeeds on any provider
      expect(() =>
        AgentAdapterFactory.assertCanSendPrompt('codex', {
          taskId: 't1',
          text: 'Hello',
        })
      ).not.toThrow()

      expect(() =>
        AgentAdapterFactory.assertCanSendPrompt('claude', {
          taskId: 't1',
          text: 'Hello',
        })
      ).not.toThrow()

      expect(() =>
        AgentAdapterFactory.assertCanSendPrompt('antigravity', {
          taskId: 't1',
          text: 'Hello',
          attachments: [],
        })
      ).not.toThrow()

      // When attachments are provided, all current adapters reject them upfront
      expect(() =>
        AgentAdapterFactory.assertCanSendPrompt('codex', {
          taskId: 't1',
          text: 'Hello',
          attachments: ['/path/to/file.png'],
        })
      ).toThrow(/Attachments are not supported by codex adapter/i)

      expect(() =>
        AgentAdapterFactory.assertCanSendPrompt('antigravity', {
          taskId: 't1',
          text: 'Hello',
          attachments: ['/path/to/file.png'],
        })
      ).toThrow(/Attachments are not supported by antigravity adapter/i)

      expect(() =>
        AgentAdapterFactory.assertCanSendPrompt('claude', {
          taskId: 't1',
          text: 'Hello',
          attachments: ['/path/to/file.png'],
        })
      ).toThrow(/Attachments are not supported by claude adapter/i)
    })

    it('assertCanResolveApproval validates interactive approval capability before dispatch', () => {
      expect(() =>
        AgentAdapterFactory.assertCanResolveApproval('codex', {
          taskId: 't1',
          approvalId: 'app-1',
          decision: 'allow',
        })
      ).not.toThrow()

      expect(() =>
        AgentAdapterFactory.assertCanResolveApproval('claude', {
          taskId: 't1',
          approvalId: 'app-1',
          decision: 'allow',
        })
      ).not.toThrow()

      expect(() =>
        AgentAdapterFactory.assertCanResolveApproval('antigravity', {
          taskId: 't1',
          approvalId: 'app-1',
          decision: 'deny',
        })
      ).toThrow(/Interactive approvals are not supported by antigravity adapter/i)
    })
  })

  describe('3. Adapter Creation & Lifecycle Verification', () => {
    it('creates a CodexAdapter fulfilling AgentAdapter interface without casts', () => {
      const adapter: AgentAdapter = AgentAdapterFactory.createAdapter({
        ...baseOptions,
        agentProvider: 'codex',
        model: 'gpt-4o',
        codexBinPath: '/custom/bin/codex',
      })

      expect(adapter).toBeInstanceOf(CodexAdapter)
      expect(adapter.getCapabilities()).toEqual(CODEX_CAPABILITIES)
      expect(adapter.getProvider()).toBe('codex')
      expect(adapter.getTaskId()).toBe(baseOptions.taskId)
      expect(adapter.getRunId()).toBe(baseOptions.runId)
      expect(typeof adapter.start).toBe('function')
      expect(typeof adapter.sendPrompt).toBe('function')
      expect(typeof adapter.resolveApproval).toBe('function')
      expect(typeof adapter.stop).toBe('function')
      expect(typeof adapter.getStatus).toBe('function')
      expect(typeof adapter.getPid).toBe('function')
      expect(typeof adapter.getSessionId).toBe('function')
      expect(adapter.getStatus()).toBe('idle')
    })

    it('creates an AntigravityAdapter fulfilling AgentAdapter interface without casts', () => {
      const adapter: AgentAdapter = AgentAdapterFactory.createAdapter({
        ...baseOptions,
        agentProvider: 'antigravity',
        worktreePath: process.cwd(),
        model: 'gemini-1.5-pro',
        agyBinPath: '/custom/bin/agy',
      })

      expect(adapter).toBeInstanceOf(AntigravityAdapter)
      expect(adapter.getCapabilities()).toEqual(ANTIGRAVITY_CAPABILITIES)
      expect(adapter.getProvider()).toBe('antigravity')
      expect(adapter.getTaskId()).toBe(baseOptions.taskId)
      expect(adapter.getRunId()).toBe(baseOptions.runId)
      expect(typeof adapter.start).toBe('function')
      expect(typeof adapter.sendPrompt).toBe('function')
      expect(typeof adapter.resolveApproval).toBe('function')
      expect(typeof adapter.stop).toBe('function')
      expect(typeof adapter.getStatus).toBe('function')
      expect(typeof adapter.getPid).toBe('function')
      expect(typeof adapter.getSessionId).toBe('function')
      expect(adapter.getStatus()).toBe('idle')
    })

    it('creates a ClaudeAdapter fulfilling AgentAdapter interface without casts', () => {
      const adapter: AgentAdapter = AgentAdapterFactory.createAdapter({
        ...baseOptions,
        agentProvider: 'claude',
        model: 'claude-3-5-sonnet',
        claudeBinPath: '/custom/bin/claude',
        maxTrackedRecords: 500,
      })

      expect(adapter).toBeInstanceOf(ClaudeAdapter)
      expect(adapter.getCapabilities()).toEqual(CLAUDE_CAPABILITIES)
      expect(adapter.getProvider()).toBe('claude')
      expect(adapter.getTaskId()).toBe(baseOptions.taskId)
      expect(adapter.getRunId()).toBe(baseOptions.runId)
      expect(typeof adapter.start).toBe('function')
      expect(typeof adapter.sendPrompt).toBe('function')
      expect(typeof adapter.resolveApproval).toBe('function')
      expect(typeof adapter.stop).toBe('function')
      expect(typeof adapter.getStatus).toBe('function')
      expect(typeof adapter.getPid).toBe('function')
      expect(typeof adapter.getSessionId).toBe('function')
      expect(adapter.getStatus()).toBe('idle')
    })

    it('creates adapter based on model inference when provider is omitted', () => {
      const claudeAdapter = AgentAdapterFactory.createAdapter({
        ...baseOptions,
        model: 'claude-3-opus',
      })
      expect(claudeAdapter).toBeInstanceOf(ClaudeAdapter)

      const agyAdapter = AgentAdapterFactory.createAdapter({
        ...baseOptions,
        worktreePath: process.cwd(),
        model: 'gemini-2.0-flash',
      })
      expect(agyAdapter).toBeInstanceOf(AntigravityAdapter)

      const codexAdapter = AgentAdapterFactory.createAdapter({
        ...baseOptions,
        model: 'gpt-4o',
      })
      expect(codexAdapter).toBeInstanceOf(CodexAdapter)
    })

    it('propagates event listener and supervisor to instantiated adapter', async () => {
      const events: AgentEvent[] = []
      const adapter = AgentAdapterFactory.createAdapter({
        ...baseOptions,
        agentProvider: 'claude',
        onEvent: (evt) => events.push(evt),
      })

      mockProc.stdin.on('data', chunk => {
        const request = JSON.parse(chunk.toString())
        if (request.type === 'control_request') mockProc.stdout.write(JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: request.request_id, response: {} } }) + '\n')
      })
      await adapter.start()
      expect(adapter.getPid()).toBe(12345)
      expect(adapter.getStatus()).toBe('idle')
      await adapter.stop()
      expect(adapter.getStatus()).toBe('stopped')
      expect(mockSupervisor.terminateProcessTree).toHaveBeenCalled()
      expect(events.some((e) => e.type === 'agent.status.changed' && (e as { status: string }).status === 'stopped')).toBe(true)
    })
  })

  describe('4. CodexAdapter Lifecycle & Approval Object Normalization', () => {
    it('CodexAdapter rejects prompt attachments when called directly', async () => {
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
      })

      // Simulate started thread
      mockProc.stdin.on('data', (chunk) => {
        const line = chunk.toString().trim()
        if (!line) return
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) + '\n')
        }
      })

      await adapter.start()
      await expect(
        adapter.sendPrompt({ taskId: 't1', text: 'Hello', attachments: ['/tmp/file.txt'] })
      ).rejects.toThrow(/CodexAdapter does not currently support prompt attachments/i)

      await adapter.stop()
    })

    it('CodexAdapter normalizes ResolveApprovalRequest object form and preserves decision in event', async () => {
      const events: AgentEvent[] = []
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
        onEvent: (evt) => events.push(evt),
      })

      let writtenRpc: Record<string, unknown> | undefined
      mockProc.stdin.on('data', (chunk) => {
        const line = chunk.toString().trim()
        if (!line) return
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) + '\n')
        } else if (req.method === 'turn/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turnId: 'turn-1' } }) + '\n')
        } else if (req.result) {
          writtenRpc = req
        }
      })

      await adapter.start()
      await adapter.sendPrompt({ taskId: 't1', text: 'Run command' })

      // Simulate incoming approval request
      mockProc.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'rpc-approval-1',
          method: 'item/commandExecution/requestApproval',
          params: { approvalId: 'raw-app-1', command: 'npm test' },
        }) + '\n'
      )

      // Wait a tick for event emission
      await new Promise((r) => setTimeout(r, 20))
      expect(adapter.getStatus()).toBe('waiting_for_approval')

      // Resolve using object signature
      const requestedEvt = events.find((e) => e.type === 'permission.requested') as { approvalId: string }
      expect(requestedEvt).toBeDefined()

      await adapter.resolveApproval({
        taskId: 't1',
        approvalId: requestedEvt.approvalId,
        decision: 'allow',
      })

      // Verify RPC response had 'accept'
      expect(writtenRpc).toBeDefined()
      expect(writtenRpc?.result).toEqual({ decision: 'accept' })

      // Verify permission.state.changed event has decision: 'allow' (NOT undefined!)
      const resolvedEvt = events.find((e) => e.type === 'permission.state.changed') as { decision: string }
      expect(resolvedEvt).toBeDefined()
      expect(resolvedEvt.decision).toBe('allow')

      // Verify status transitioned back to 'running'
      expect(adapter.getStatus()).toBe('running')

      // Simulate turn/completed notification
      mockProc.stdout.write(
        JSON.stringify({
          method: 'turn/completed',
          params: { turnId: 'turn-1' },
        }) + '\n'
      )
      await new Promise((r) => setTimeout(r, 20))
      expect(adapter.getStatus()).toBe('completed')

      // Stop adapter and verify status is 'stopped'
      await adapter.stop()
      expect(adapter.getStatus()).toBe('stopped')
    })

    it('CodexAdapter throws when resolveApproval is invoked without a decision or with invalid decision', async () => {
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
      })

      mockProc.stdin.on('data', (chunk) => {
        const line = chunk.toString().trim()
        if (!line) return
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) + '\n')
        }
      })

      await adapter.start()
      await expect(
        adapter.resolveApproval('some-app-id')
      ).rejects.toThrow(/Decision must be "allow" or "deny"/i)

      await expect(
        adapter.resolveApproval('some-app-id', 'accept')
      ).rejects.toThrow(/Decision must be "allow" or "deny"/i)

      await adapter.stop()
    })

    it('CodexAdapter transitions to error or interrupted when turn/completed reports non-success', async () => {
      const events: AgentEvent[] = []
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
        onEvent: (evt) => events.push(evt),
      })

      mockProc.stdin.on('data', (chunk) => {
        const line = chunk.toString().trim()
        if (!line) return
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) + '\n')
        } else if (req.method === 'turn/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { turnId: 'turn-fail' } }) + '\n')
        }
      })

      await adapter.start()
      await adapter.sendPrompt({ taskId: 't1', text: 'Prompt' })

      // Send turn/completed with failed status
      mockProc.stdout.write(
        JSON.stringify({
          method: 'turn/completed',
          params: { turn: { id: 'turn-fail', status: 'failed', error: 'Process crashed' } },
        }) + '\n'
      )
      await new Promise((r) => setTimeout(r, 20))

      expect(adapter.getStatus()).toBe('error')
      const errEvt = events.find((e) => e.type === 'agent.status.changed' && (e as { status: string }).status === 'error')
      expect(errEvt).toBeDefined()

      await adapter.stop()
    })

    it('CodexAdapter recovers to idle status upon restarting after process exit error', async () => {
      let proc = mockProc
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => proc as unknown as import('child_process').ChildProcess,
      })

      const setupRpc = (p: MockChildProcess) => {
        p.stdin.on('data', (chunk) => {
          const line = chunk.toString().trim()
          if (!line) return
          const req = JSON.parse(line)
          if (req.method === 'initialize') {
            p.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
          } else if (req.method === 'thread/start') {
            p.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) + '\n')
          }
        })
      }

      setupRpc(proc)
      await adapter.start()
      expect(adapter.getStatus()).toBe('idle')

      // Process crashes
      proc.emit('exit', 1, null)
      expect(adapter.getStatus()).toBe('error')

      // Restart adapter with fresh process
      const proc2 = new MockChildProcess()
      setupRpc(proc2)
      proc = proc2
      await adapter.start()
      expect(adapter.getStatus()).toBe('idle')

      await adapter.stop()
    })

    it('CodexAdapter transitions to error status when turn/start RPC fails', async () => {
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
      })

      mockProc.stdin.on('data', (chunk) => {
        const line = chunk.toString().trim()
        if (!line) return
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) + '\n')
        } else if (req.method === 'turn/start') {
          mockProc.stdout.write(
            JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: 'Turn failed to start' } }) +
              '\n'
          )
        }
      })

      await adapter.start()
      await expect(adapter.sendPrompt({ taskId: 't1', text: 'Prompt' })).rejects.toThrow(/Turn failed to start/i)
      expect(adapter.getStatus()).toBe('error')

      await adapter.stop()
    })

    it('CodexAdapter preserves error status when turn/completed arrives before turn/start resolves', async () => {
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
      })

      mockProc.stdin.on('data', (chunk) => {
        const line = chunk.toString().trim()
        if (!line) return
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) + '\n')
        } else if (req.method === 'turn/start') {
          // Send turn/completed with error before replying with turn/start result
          mockProc.stdout.write(
            JSON.stringify({
              method: 'turn/completed',
              params: { turn: { id: 'fast-turn-fail', status: 'failed', error: 'Early crash' } },
            }) + '\n'
          )
          mockProc.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: { turnId: 'fast-turn-fail' },
            }) + '\n'
          )
        }
      })

      await adapter.start()
      const res = await adapter.sendPrompt({ taskId: 't1', text: 'Fast turn' })
      expect(res.turnId).toBe('fast-turn-fail')
      // Status should remain error, NOT completed!
      expect(adapter.getStatus()).toBe('error')

      await adapter.stop()
    })

    it('CodexAdapter does not emit error event when stop() is called while turn/start is pending', async () => {
      const events: AgentEvent[] = []
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
        onEvent: (evt) => events.push(evt),
      })

      mockProc.stdin.on('data', (chunk) => {
        const line = chunk.toString().trim()
        if (!line) return
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n')
        } else if (req.method === 'thread/start') {
          mockProc.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { thread: { id: 'thread-1' } } }) + '\n')
        }
        // Deliberately do not answer turn/start to leave it pending
      })

      await adapter.start()
      const sendPromise = adapter.sendPrompt({ taskId: 't1', text: 'Prompt' })

      // Stop adapter while turn/start is pending
      await adapter.stop()
      await expect(sendPromise).rejects.toThrow()

      expect(adapter.getStatus()).toBe('stopped')
      // No error event should be emitted after stopped
      const eventStatuses = events
        .filter((e) => e.type === 'agent.status.changed')
        .map((e) => (e as { status: string }).status)
      expect(eventStatuses).not.toContain('error')
    })

    it('CodexAdapter transitions to error status when start() fails during initialize handshake', async () => {
      const events: AgentEvent[] = []
      const adapter = new CodexAdapter({
        taskId: 't1',
        runId: 'r1',
        worktreePath: '/tmp/worktree',
        spawnProcess: () => mockProc as unknown as import('child_process').ChildProcess,
        onEvent: (evt) => events.push(evt),
      })

      mockProc.stdin.on('data', (chunk) => {
        const line = chunk.toString().trim()
        if (!line) return
        const req = JSON.parse(line)
        if (req.method === 'initialize') {
          mockProc.stdout.write(
            JSON.stringify({ jsonrpc: '2.0', id: req.id, error: { code: -32600, message: 'Initialize rejected' } }) +
              '\n'
          )
        }
      })

      await expect(adapter.start()).rejects.toThrow(/Initialize rejected/i)
      expect(adapter.getStatus()).toBe('error')
      const errEvt = events.find((e) => e.type === 'agent.status.changed' && (e as { status: string }).status === 'error')
      expect(errEvt).toBeDefined()

      await adapter.stop()
    })
  })

  describe('5. Custom Provider Registration & Extensibility', () => {
    it('allows registering and instantiating custom adapters', async () => {
      const mockCapabilities = {
        textStreaming: true,
        toolCalls: false,
        thinkingStreaming: false,
        toolOutputStreaming: false,
        interactiveApprovals: true,
        attachments: false,
      }
      const mockCustomAdapter: AgentAdapter = {
        start: vi.fn().mockResolvedValue({ pid: 55555, sessionId: 'custom-sess' }),
        sendPrompt: vi.fn().mockResolvedValue({ turnId: 'turn-custom' }),
        resolveApproval: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        getStatus: vi.fn().mockReturnValue('idle'),
        getPid: vi.fn().mockReturnValue(55555),
        getSessionId: vi.fn().mockReturnValue('custom-sess'),
        getCapabilities: vi.fn().mockReturnValue(mockCapabilities),
        getProvider: vi.fn().mockReturnValue('mock-custom' as unknown as AgentProviderType),
        getTaskId: vi.fn().mockReturnValue(baseOptions.taskId),
        getRunId: vi.fn().mockReturnValue(baseOptions.runId),
      }

      const customFactory = vi.fn().mockReturnValue(mockCustomAdapter)

      AgentAdapterFactory.registerProvider(
        'mock-custom',
        {
          textStreaming: true,
          toolCalls: false,
          thinkingStreaming: false,
          toolOutputStreaming: false,
          interactiveApprovals: true,
          attachments: false,
        },
        customFactory
      )

      try {
        expect(AgentAdapterFactory.getSupportedProviders()).toContain('mock-custom')
        expect(AgentAdapterFactory.resolveProvider('mock-custom')).toBe('mock-custom')
        expect(AgentAdapterFactory.hasCapability('mock-custom', 'interactiveApprovals')).toBe(true)
        expect(AgentAdapterFactory.hasCapability('mock-custom', 'attachments')).toBe(false)

        const adapter = AgentAdapterFactory.createAdapter({
          ...baseOptions,
          agentProvider: 'mock-custom',
        })

        expect(customFactory).toHaveBeenCalledTimes(1)
        expect(adapter).toBe(mockCustomAdapter)

        const startRes = await adapter.start()
        expect(startRes.pid).toBe(55555)
      } finally {
        AgentAdapterFactory.unregisterProvider('mock-custom')
      }

      expect(AgentAdapterFactory.getSupportedProviders()).not.toContain('mock-custom')
      expect(() => AgentAdapterFactory.resolveProvider('mock-custom')).toThrow(
        /Unsupported agent provider: "mock-custom"/i
      )
    })

    it('rejects registering empty provider name or overriding built-in providers', () => {
      expect(() =>
        AgentAdapterFactory.registerProvider('', CODEX_CAPABILITIES, () => ({} as AgentAdapter))
      ).toThrow(/Provider name cannot be empty/i)

      expect(() =>
        AgentAdapterFactory.registerProvider('codex', CODEX_CAPABILITIES, () => ({} as AgentAdapter))
      ).toThrow(/Cannot override built-in provider: "codex"/i)
    })
  })

  describe('6. Standalone Functional Helpers & Error Handling', () => {
    it('throws when getCapabilities is called with unsupported provider', () => {
      expect(() => AgentAdapterFactory.getCapabilities('invalid-provider')).toThrow(
        /Unsupported agent provider: "invalid-provider"/i
      )
    })

    it('assertCapability formats custom actionContext in error message', () => {
      expect(() =>
        AgentAdapterFactory.assertCapability('antigravity', 'interactiveApprovals', 'shell command approval')
      ).toThrow(/Agent provider "antigravity" does not support interactive approvals for shell command approval/i)
    })

    it('assertCanResolveApproval throws when approvalId is missing', () => {
      expect(() =>
        AgentAdapterFactory.assertCanResolveApproval('codex', {
          taskId: 't1',
          approvalId: '',
          decision: 'allow',
        })
      ).toThrow(/approvalId is required to resolve approval/i)
    })

    it('functional helpers delegate directly to AgentAdapterFactory', () => {
      expect(resolveAgentProvider('claude')).toBe('claude')
      expect(getAgentCapabilities('codex')).toEqual(CODEX_CAPABILITIES)

      const adapter = createAgentAdapter({
        ...baseOptions,
        agentProvider: 'claude',
      })
      expect(adapter).toBeInstanceOf(ClaudeAdapter)
    })
  })
})
