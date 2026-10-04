/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react'
import { ConversationFeed } from '../ConversationFeed'
import { useStore } from '../../../store'
import type {
  ReconstructedMessage,
  ReconstructedToolItem,
  ReconstructedApprovalItem,
} from '../../../../shared/agent-events'
import type { FeedItem, Settings } from '../../../store'

describe('ConversationFeed Component (happy-dom)', () => {
  beforeEach(() => {
    useStore.setState({
      settings: {
        theme: 'dark',
        language: 'ru',
        uiLanguage: 'ru',
        defaultIDE: 'cursor',
        autoArchive: 'never',
        soundAlerts: false,
        soundType: 'default',
        desktopNotifications: false,
        launchAtLogin: false,
        preventSleep: false,
      } as Settings,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('formats streaming and restored assistant Markdown while user text stays literal', () => {
    const message: ReconstructedMessage = { id: 'markdown-stream', role: 'assistant', text: '### Отчёт\n\n```sh\necho **literal**', thinking: '', status: 'streaming', timestamp: 1, revision: 1 }
    const user: ReconstructedMessage = { ...message, id: 'markdown-user', role: 'user', text: '**мой исходный запрос**', status: 'completed' }
    const view = render(<ConversationFeed messages={[user, message]} />)
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Отчёт')
    expect(screen.getByTestId('message-content-markdown-stream').querySelector('pre code')?.textContent).toBe('echo **literal**\n')
    expect(screen.getByTestId('user-message-markdown-user').textContent).toContain('**мой исходный запрос**')
    expect(screen.getByTestId('user-message-markdown-user').querySelector('strong')).toBeNull()
    view.rerender(<ConversationFeed messages={[user, { ...message, text: message.text + '\n```\n\n**Готово**', status: 'completed', revision: 2 }]} />)
    expect(screen.getByTestId('message-content-markdown-stream').querySelector('strong')?.textContent).toBe('Готово')
    view.unmount()
    render(<ConversationFeed feedItems={[{ id: 'legacy-md', type: 'ai', text: '### Сохранённый отчёт\n\n**64 GB**' }]} />)
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Сохранённый отчёт')
    expect(screen.getByTestId('message-content-legacy-md').querySelector('strong')?.textContent).toBe('64 GB')
  })

  it('renders empty state when no messages are provided', () => {
    render(<ConversationFeed messages={[]} />)
    expect(screen.getByTestId('conversation-feed')).not.toBeNull()
    expect(screen.getByText('Нет сообщений в ленте')).not.toBeNull()
  })

  it('renders user message with correct text and container attributes', () => {
    const messages: ReconstructedMessage[] = [
      {
        id: 'user-msg-1',
        role: 'user',
        text: 'Fix the failing unit tests in UserAuthService',
        thinking: '',
        status: 'completed',
        timestamp: 1700000000,
      },
    ]

    render(<ConversationFeed messages={messages} />)
    const userBubble = screen.getByTestId('user-message-user-msg-1')
    expect(userBubble).not.toBeNull()
    expect(screen.getByText('Fix the failing unit tests in UserAuthService')).not.toBeNull()
    expect(screen.getByText('Вы')).not.toBeNull()
  })

  it('renders assistant message with streaming indicator when status is streaming', () => {
    const messages: ReconstructedMessage[] = [
      {
        id: 'asst-msg-1',
        role: 'assistant',
        text: 'I am analyzing the repository structure...',
        thinking: '',
        status: 'streaming',
        timestamp: 1700000001,
      },
    ]

    render(<ConversationFeed messages={messages} />)
    expect(screen.getByTestId('assistant-message-asst-msg-1')).not.toBeNull()
    expect(screen.getByText('I am analyzing the repository structure...')).not.toBeNull()
    expect(screen.getByText('ZIAForge')).not.toBeNull()
    expect(screen.getByTitle('Потоковый ответ')).not.toBeNull()
  })

  it('renders thinking block and toggles expand/collapse on click', () => {
    const messages: ReconstructedMessage[] = [
      {
        id: 'asst-msg-thinking',
        role: 'assistant',
        text: 'Found the root cause in jwt.verify call.',
        thinking: 'Let me double check the secret expiration timestamp logic first.',
        status: 'completed',
        timestamp: 1700000002,
      },
    ]

    render(<ConversationFeed messages={messages} />)
    expect(screen.getByTestId('thinking-block-asst-msg-thinking')).not.toBeNull()
    expect(screen.getByText('Мышление')).not.toBeNull()

    // Initially collapsed
    expect(screen.queryByText('Let me double check the secret expiration timestamp logic first.')).toBeNull()

    // Click to expand
    fireEvent.click(screen.getByText('Мышление'))
    expect(screen.getByText('Let me double check the secret expiration timestamp logic first.')).not.toBeNull()

    // Click to collapse
    fireEvent.click(screen.getByText('Мышление'))
    expect(screen.queryByText('Let me double check the secret expiration timestamp logic first.')).toBeNull()
  })

  it('renders tool items with running, completed, error, and cancelled statuses', () => {
    const tools: ReconstructedToolItem[] = [
      {
        callId: 'tool-1',
        toolName: 'execute_command',
        input: 'npm test -- src/auth.test.ts',
        status: 'running',
      },
      {
        callId: 'tool-2',
        toolName: 'read_file',
        input: 'src/config.ts',
        output: 'export const JWT_SECRET = "test"',
        status: 'completed',
      },
      {
        callId: 'tool-3',
        toolName: 'bash',
        input: 'cat /nonexistent/path',
        output: 'cat: /nonexistent/path: No such file or directory',
        status: 'error',
      },
      {
        callId: 'tool-4',
        toolName: 'git_status',
        input: 'git status',
        status: 'cancelled',
      },
    ]

    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-tools',
        role: 'assistant',
        text: 'Executing tools',
        thinking: '',
        status: 'completed',
        timestamp: 1700000003,
        tools,
      },
    ]

    render(<ConversationFeed messages={messages} />)

    // Tool 1: Running
    expect(screen.getByTestId('tool-item-tool-1')).not.toBeNull()
    expect(screen.getByText('npm test -- src/auth.test.ts')).not.toBeNull()
    expect(screen.getByText('Выполняется')).not.toBeNull()

    // Tool 2: Completed
    expect(screen.getByTestId('tool-item-tool-2')).not.toBeNull()
    expect(screen.getByText('Завершено')).not.toBeNull()

    // Tool 3: Error
    expect(screen.getByTestId('tool-item-tool-3')).not.toBeNull()
    expect(screen.getByText('Ошибка')).not.toBeNull()

    // Tool 4: Cancelled
    expect(screen.getByTestId('tool-item-tool-4')).not.toBeNull()
    expect(screen.getByText('Отменено')).not.toBeNull()
  })

  it('preserves payload values 0 and false for tool input and output', () => {
    const tools: ReconstructedToolItem[] = [
      {
        callId: 'tool-zero',
        toolName: 'calculate',
        input: 0,
        output: false,
        status: 'completed',
      },
    ]

    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-zero',
        role: 'assistant',
        text: 'Result calculation',
        thinking: '',
        status: 'completed',
        timestamp: 1700000004,
        tools,
      },
    ]

    render(<ConversationFeed messages={messages} />)

    // Input 0 should be visible
    expect(screen.getByText('0')).not.toBeNull()

    // Output toggle should be present for boolean false
    const outputToggle = screen.getByText('Вывод')
    expect(outputToggle).not.toBeNull()

    // Expand output
    fireEvent.click(outputToggle)
    expect(screen.getByText('false')).not.toBeNull()
  })

  it('extracts command from JSON object when stop is clicked and triggers onStopTool', () => {
    const onStopTool = vi.fn()
    const tools: ReconstructedToolItem[] = [
      {
        callId: 'tool-running-1',
        toolName: 'shell',
        input: { command: 'python train.py', cwd: '/workspace' },
        status: 'running',
      },
    ]

    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-stop',
        role: 'assistant',
        text: 'Running model training',
        thinking: '',
        status: 'completed',
        timestamp: 1700000005,
        tools,
      },
    ]

    render(<ConversationFeed messages={messages} onStopTool={onStopTool} />)

    const stopButton = screen.getByTitle('Остановить команду')
    expect(stopButton).not.toBeNull()

    fireEvent.click(stopButton)

    expect(onStopTool).toHaveBeenCalledTimes(1)
    expect(onStopTool).toHaveBeenCalledWith('tool-running-1', 'python train.py')
  })

  it('renders pending approval card, disables buttons when no onResolveApproval, and executes onResolveApproval on click', async () => {
    const onResolveApproval = vi.fn()
    const approvals: ReconstructedApprovalItem[] = [
      {
        approvalId: 'appr-101',
        command: 'rm -rf node_modules && npm install',
        description: 'Clean installation of dependencies',
        riskLevel: 'high',
        state: 'pending',
      },
      {
        approvalId: 'appr-102',
        command: 'git reset --hard HEAD~1',
        description: 'Discard last commit',
        riskLevel: 'medium',
        state: 'pending',
      },
    ]

    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-appr',
        role: 'assistant',
        text: 'I need your permission to run high risk command',
        thinking: '',
        status: 'completed',
        timestamp: 1700000006,
        approvals,
      },
    ]

    const { rerender } = render(<ConversationFeed messages={messages} onResolveApproval={onResolveApproval} />)

    expect(screen.getByTestId('approval-card-appr-101')).not.toBeNull()
    expect(screen.getByTestId('approval-card-appr-102')).not.toBeNull()
    expect(screen.getByText('Clean installation of dependencies')).not.toBeNull()
    expect(screen.getByText('rm -rf node_modules && npm install')).not.toBeNull()

    const allowBtn = screen.getByTestId('approval-allow-appr-101')
    const denyBtn = screen.getByTestId('approval-deny-appr-102')

    expect(allowBtn).not.toBeNull()
    expect(denyBtn).not.toBeNull()

    // Click allow on appr-101
    await act(async () => {
      fireEvent.click(allowBtn)
    })
    expect(onResolveApproval).toHaveBeenCalledWith('appr-101', 'allow')

    // Click deny on appr-102
    await act(async () => {
      fireEvent.click(denyBtn)
    })
    expect(onResolveApproval).toHaveBeenCalledWith('appr-102', 'deny')

    // Test without onResolveApproval: buttons should be disabled
    rerender(<ConversationFeed messages={messages} />)
    const disabledAllow = screen.getByTestId('approval-allow-appr-101')
    expect(disabledAllow.hasAttribute('disabled')).toBe(true)
  })

  it('renders resolved and expired approval cards', () => {
    const approvals: ReconstructedApprovalItem[] = [
      {
        approvalId: 'appr-allowed',
        command: 'git push origin main',
        riskLevel: 'critical',
        state: 'resolved',
        decision: 'allow',
      },
      {
        approvalId: 'appr-denied',
        command: 'DROP DATABASE test',
        riskLevel: 'critical',
        state: 'resolved',
        decision: 'deny',
      },
      {
        approvalId: 'appr-expired',
        command: 'sleep 10',
        riskLevel: 'low',
        state: 'expired',
      },
    ]

    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-resolved-appr',
        role: 'assistant',
        text: 'Past approval requests',
        thinking: '',
        status: 'completed',
        timestamp: 1700000007,
        approvals,
      },
    ]

    render(<ConversationFeed messages={messages} />)

    expect(screen.getByText('Действие разрешено')).not.toBeNull()
    expect(screen.getByText('Действие отклонено')).not.toBeNull()
    expect(screen.getByText('Запрос устарел или пропущен')).not.toBeNull()
  })

  it('adapts legacy FeedItem array: user, ai, tools with separated thinking and ran commands', () => {
    const feedItems: FeedItem[] = [
      {
        id: 'legacy-u-1',
        type: 'user',
        text: 'Legacy prompt from feed',
      },
      {
        id: 'legacy-t-1',
        type: 'tools',
        tools: [
          {
            type: 'thinking',
            title: 'Thinking step',
            content: 'Deep thought about codebase structure',
          },
          {
            type: 'ran',
            title: 'git status',
            content: 'git status -s',
            isRunning: true,
          },
        ],
      },
      {
        id: 'legacy-ai-1',
        type: 'ai',
        text: 'Legacy assistant response',
      },
    ]

    render(<ConversationFeed feedItems={feedItems} />)

    expect(screen.getByText('Legacy prompt from feed')).not.toBeNull()
    expect(screen.getByText('git status -s')).not.toBeNull()
    expect(screen.getByText('Выполняется')).not.toBeNull()
    expect(screen.getByText('Legacy assistant response')).not.toBeNull()

    // Thinking is preserved in the thinking accordion
    expect(screen.getByText('Мышление')).not.toBeNull()
    fireEvent.click(screen.getByText('Мышление'))
    expect(screen.getByText('Deep thought about codebase structure')).not.toBeNull()
  })

  it('renders legacy prompt with promptActions and triggers onPromptAction on click', () => {
    const onPromptAction = vi.fn()
    const feedItems: FeedItem[] = [
      {
        id: 'prompt-1',
        type: 'prompt',
        text: 'Would you like to install recommended packages?',
        promptActions: [
          { id: 'act-install', label: 'Install Now' },
          { id: 'act-skip', label: 'Skip' },
        ],
      },
    ]

    render(<ConversationFeed feedItems={feedItems} onPromptAction={onPromptAction} />)

    expect(screen.getByTestId('legacy-prompt-prompt-1')).not.toBeNull()
    expect(screen.getByText('Would you like to install recommended packages?')).not.toBeNull()

    const installBtn = screen.getByText('Install Now')
    fireEvent.click(installBtn)

    expect(onPromptAction).toHaveBeenCalledWith('act-install', 'prompt-1')
  })

  it('renders legacy commit with file list, additions, deletions, and hash', () => {
    const feedItems: FeedItem[] = [
      {
        id: 'commit-1',
        type: 'commit',
        commitHash: 'a1b2c3d4e5f6',
        totalAdditions: 42,
        totalDeletions: 7,
        committedFiles: [
          {
            filename: 'UserService.ts',
            directory: 'src/services',
            additions: 30,
            deletions: 5,
            isNew: false,
          },
          {
            filename: 'UserDto.ts',
            directory: 'src/types',
            additions: 12,
            deletions: 2,
            isNew: true,
          },
        ],
      },
    ]

    render(<ConversationFeed feedItems={feedItems} />)

    expect(screen.getByTestId('legacy-commit-commit-1')).not.toBeNull()
    expect(screen.getByText('Зафиксированные изменения (a1b2c3d)')).not.toBeNull()
    expect(screen.getByText('+42')).not.toBeNull()
    expect(screen.getByText('-7')).not.toBeNull()
    expect(screen.getByText('UserService.ts')).not.toBeNull()
    expect(screen.getByText('UserDto.ts')).not.toBeNull()
    expect(screen.getByText('НОВЫЙ')).not.toBeNull()
  })

  it('collapses and expands tool output on click', () => {
    const tools: ReconstructedToolItem[] = [
      {
        callId: 'tool-expand-collapse',
        toolName: 'read_config',
        input: 'config.json',
        output: '{"port": 8080}',
        status: 'completed',
      },
    ]

    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-exp-col',
        role: 'assistant',
        text: 'Configuration loaded',
        thinking: '',
        status: 'completed',
        timestamp: 1700000008,
        tools,
      },
    ]

    render(<ConversationFeed messages={messages} />)

    const outputToggle = screen.getByText('Вывод')
    expect(screen.queryByText('{"port": 8080}')).toBeNull()

    // Expand
    fireEvent.click(outputToggle)
    expect(screen.getByText('{"port": 8080}')).not.toBeNull()

    // Collapse
    fireEvent.click(outputToggle)
    expect(screen.queryByText('{"port": 8080}')).toBeNull()
  })

  it('renders submitting approval state with spinner and no action buttons', () => {
    const approvals: ReconstructedApprovalItem[] = [
      {
        approvalId: 'appr-submitting',
        command: 'terraform apply',
        riskLevel: 'critical',
        state: 'submitting',
      },
    ]

    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-submitting',
        role: 'assistant',
        text: 'Applying infrastructure',
        thinking: '',
        status: 'completed',
        timestamp: 1700000009,
        approvals,
      },
    ]

    render(<ConversationFeed messages={messages} />)

    expect(screen.getByText('Отправка решения...')).not.toBeNull()
    expect(screen.queryByTestId('approval-allow-appr-submitting')).toBeNull()
  })

  it('renders legacy prompt with disabled buttons when onPromptAction is absent', () => {
    const feedItems: FeedItem[] = [
      {
        id: 'prompt-no-handler',
        type: 'prompt',
        text: 'Continue with next phase?',
        promptActions: [{ id: 'yes', label: 'Yes' }],
      },
    ]

    render(<ConversationFeed feedItems={feedItems} />)

    const btn = screen.getByText('Yes')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('preserves user scroll position when user scrolled up, and follows bottom otherwise', () => {
    const initialMessages: ReconstructedMessage[] = [
      {
        id: 'msg-scroll-1',
        role: 'user',
        text: 'Initial message',
        thinking: '',
        status: 'completed',
        timestamp: 1700000010,
        revision: 1,
      },
    ]

    const { rerender } = render(<ConversationFeed messages={initialMessages} autoScroll={true} />)
    const feed = screen.getByTestId('conversation-feed')

    // Mock scroll properties
    Object.defineProperty(feed, 'scrollHeight', { value: 1000, configurable: true, writable: true })
    Object.defineProperty(feed, 'clientHeight', { value: 400, configurable: true, writable: true })

    // Case 1: User is at bottom (scrollTop = 600, distance = 1000 - 600 - 400 = 0 <= 80)
    feed.scrollTop = 600
    fireEvent.scroll(feed)

    // Add new message -> autoScroll triggers scrollTop = scrollHeight
    Object.defineProperty(feed, 'scrollHeight', {
      configurable: true,
      value: 1200,
    })
    rerender(
      <ConversationFeed
        messages={[
          ...initialMessages,
          {
            id: 'msg-scroll-2',
            role: 'assistant',
            text: 'Streamed continuation',
            thinking: '',
            status: 'streaming',
            timestamp: 1700000011,
            revision: 1,
          },
        ]}
        autoScroll={true}
      />
    )
    expect(feed.scrollTop).toBe(1200)

    // Case 2: User scrolls up (scrollTop = 100, distance = 1200 - 100 - 400 = 700 > 80)
    feed.scrollTop = 100
    fireEvent.scroll(feed)

    // New token arrives
    Object.defineProperty(feed, 'scrollHeight', {
      configurable: true,
      value: 1400,
    })
    rerender(
      <ConversationFeed
        messages={[
          ...initialMessages,
          {
            id: 'msg-scroll-2',
            role: 'assistant',
            text: 'Streamed continuation with more tokens',
            thinking: '',
            status: 'streaming',
            timestamp: 1700000012,
            revision: 2,
          },
        ]}
        autoScroll={true}
      />
    )
    // Scroll position must NOT jump to bottom; must be preserved at 100
    expect(feed.scrollTop).toBe(100)

    // Case 3: User scrolls back near the bottom (scrollTop = 950, distance = 1400 - 950 - 400 = 50 <= 80)
    feed.scrollTop = 950
    fireEvent.scroll(feed)

    // Resumed follow mode: new message arrives
    Object.defineProperty(feed, 'scrollHeight', {
      configurable: true,
      value: 1600,
    })
    rerender(
      <ConversationFeed
        messages={[
          ...initialMessages,
          {
            id: 'msg-scroll-2',
            role: 'assistant',
            text: 'Streamed continuation final message',
            thinking: '',
            status: 'completed',
            timestamp: 1700000013,
            revision: 3,
          },
        ]}
        autoScroll={true}
      />
    )
    expect(feed.scrollTop).toBe(1600)
  })

  it('respects autoScroll=false and suppresses auto-scrolling', () => {
    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-no-auto',
        role: 'user',
        text: 'Testing autoScroll disabled',
        thinking: '',
        status: 'completed',
        timestamp: 1700000013,
      },
    ]

    const { rerender } = render(<ConversationFeed messages={messages} autoScroll={false} />)
    const feed = screen.getByTestId('conversation-feed')

    Object.defineProperty(feed, 'scrollHeight', { value: 800, configurable: true, writable: true })
    Object.defineProperty(feed, 'clientHeight', { value: 300, configurable: true, writable: true })
    feed.scrollTop = 50

    rerender(
      <ConversationFeed
        messages={[
          ...messages,
          {
            id: 'msg-no-auto-2',
            role: 'assistant',
            text: 'Answer',
            thinking: '',
            status: 'completed',
            timestamp: 1700000014,
          },
        ]}
        autoScroll={false}
      />
    )

    expect(feed.scrollTop).toBe(50)
  })

  it('supports locale switching between English and Russian with fallback', () => {
    const messages: ReconstructedMessage[] = [
      {
        id: 'msg-lang',
        role: 'user',
        text: 'Language test',
        thinking: '',
        status: 'completed',
        timestamp: 1700000015,
      },
    ]

    const { rerender } = render(<ConversationFeed messages={messages} />)
    expect(screen.getByText('Вы')).not.toBeNull()

    // Switch to English
    act(() => {
      useStore.setState({
        settings: {
          theme: 'dark',
          language: 'en',
          uiLanguage: 'en',
          defaultIDE: 'cursor',
          autoArchive: 'never',
          soundAlerts: false,
          soundType: 'default',
          desktopNotifications: false,
          launchAtLogin: false,
          preventSleep: false,
        } as Settings,
      })
    })

    rerender(<ConversationFeed messages={messages} />)
    expect(screen.getByText('You')).not.toBeNull()

    // Switch to unknown locale -> falls back to English ('en')
    act(() => {
      useStore.setState({
        settings: {
          ...useStore.getState().settings,
          uiLanguage: 'de' as unknown as Settings['uiLanguage'],
        } as Settings,
      })
    })

    rerender(<ConversationFeed messages={messages} />)
    expect(screen.getByText('You')).not.toBeNull()
  })

  it('skips unchanged journal rows and displays changed revisions', () => {
    const reads = vi.fn()
    const createTool = (name = 'bash'): ReconstructedToolItem => ({
      callId: 'tool-1',
      get toolName() {
        reads()
        return name
      },
      input: 'echo test',
      status: 'completed',
    })

    const message: ReconstructedMessage = {
      id: 'message-1',
      role: 'assistant',
      text: 'History',
      thinking: '',
      status: 'completed',
      timestamp: 0,
      revision: 1,
      tools: [createTool()],
    }

    const { rerender } = render(<ConversationFeed messages={[message]} />)
    expect(reads).toHaveBeenCalled()
    reads.mockClear()

    // Same revision, new tools array: MemoMessageBubble must skip rendering
    rerender(<ConversationFeed messages={[{ ...message, tools: [createTool()] }]} />)
    expect(reads).not.toHaveBeenCalled()

    // New revision: must re-render and display updated tool
    rerender(
      <ConversationFeed
        messages={[
          {
            ...message,
            revision: 2,
            tools: [createTool('updated_tool')],
          },
        ]}
      />
    )
    expect(screen.getByText('updated_tool')).not.toBeNull()
  })
})
