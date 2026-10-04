// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { TerminalPane } from '../TerminalPane'
import { useStore, Settings } from '../../../store'

interface MockTermInstance {
  options: {
    disableStdin?: boolean
    cursorBlink?: boolean
    fontSize?: number
    fontFamily?: string
    [key: string]: unknown
  }
  cols: number
  rows: number
  open: ReturnType<typeof vi.fn>
  loadAddon: ReturnType<typeof vi.fn>
  write: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  onData: ReturnType<typeof vi.fn>
  onResize: ReturnType<typeof vi.fn>
  _emitData: (data: string) => void
  _emitResize: (cols: number, rows: number) => void
}

interface MockFitAddonInstance {
  fit: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

const { MockTerminal, MockFitAddon, mockTermInstances, mockFitAddonInstances } = vi.hoisted(() => {
  const termInstances: MockTermInstance[] = []
  const fitInstances: MockFitAddonInstance[] = []

  class MockTerminal {
    static openError: Error | null = null

    options: {
      disableStdin?: boolean
      cursorBlink?: boolean
      fontSize?: number
      fontFamily?: string
      [key: string]: unknown
    }
    cols = 80
    rows = 24
    dataListeners: ((data: string) => void)[] = []
    resizeListeners: ((dimensions: { cols: number; rows: number }) => void)[] = []

    constructor(options: unknown) {
      this.options = (options as MockTermInstance['options']) || {}
      termInstances.push(this as unknown as MockTermInstance)
    }

    open = vi.fn(() => {
      if (MockTerminal.openError) {
        throw MockTerminal.openError
      }
    })
    loadAddon = vi.fn()
    write = vi.fn()
    clear = vi.fn()
    reset = vi.fn()
    dispose = vi.fn()
    onData = vi.fn((cb: (data: string) => void) => {
      this.dataListeners.push(cb)
      return {
        dispose: () => {
          const idx = this.dataListeners.indexOf(cb)
          if (idx >= 0) this.dataListeners.splice(idx, 1)
        },
      }
    })
    onResize = vi.fn((cb: (dimensions: { cols: number; rows: number }) => void) => {
      this.resizeListeners.push(cb)
      return {
        dispose: () => {
          const idx = this.resizeListeners.indexOf(cb)
          if (idx >= 0) this.resizeListeners.splice(idx, 1)
        },
      }
    })

    _emitData(data: string) {
      this.dataListeners.forEach((cb) => cb(data))
    }

    _emitResize(cols: number, rows: number) {
      this.cols = cols
      this.rows = rows
      this.resizeListeners.forEach((cb) => cb({ cols, rows }))
    }
  }

  class MockFitAddon {
    constructor() {
      fitInstances.push(this as unknown as MockFitAddonInstance)
    }
    fit = vi.fn()
    dispose = vi.fn()
  }

  return {
    MockTerminal,
    MockFitAddon,
    mockTermInstances: termInstances,
    mockFitAddonInstances: fitInstances,
  }
})

vi.mock('xterm', () => ({
  Terminal: MockTerminal,
}))

vi.mock('xterm-addon-fit', () => ({
  FitAddon: MockFitAddon,
}))

describe('TerminalPane', () => {
  let mockWritePty: ReturnType<typeof vi.fn>
  let mockResizePty: ReturnType<typeof vi.fn>
  let mockSpawnPty: ReturnType<typeof vi.fn>
  let mockOnPtyData: ReturnType<typeof vi.fn>
  let mockOnPtyExit: ReturnType<typeof vi.fn>
  let ptyDataCallback: ((data: string, meta?: { generation?: number }) => void) | null = null
  let ptyExitCallback: ((payload: { exitCode: number, generation?: number }) => void) | null = null
  let cleanupDataSpy: ReturnType<typeof vi.fn>
  let cleanupExitSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    MockTerminal.openError = null
    mockTermInstances.length = 0
    mockFitAddonInstances.length = 0
    cleanupDataSpy = vi.fn()
    cleanupExitSpy = vi.fn()
    ptyDataCallback = null
    ptyExitCallback = null

    mockSpawnPty = vi.fn().mockResolvedValue({ success: true, history: 'PTY history boot\n', generation: 1 })
    mockWritePty = vi.fn()
    mockResizePty = vi.fn()
    mockOnPtyData = vi.fn().mockImplementation((_sessionId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      ptyDataCallback = cb
      return cleanupDataSpy
    })
    mockOnPtyExit = vi.fn().mockImplementation((_sessionId: string, cb: (payload: { exitCode: number, generation?: number }) => void) => {
      ptyExitCallback = cb
      return cleanupExitSpy
    })

    // Setup window.ziafAPI mock
    ;(window as unknown as { ziafAPI: unknown }).ziafAPI = {
      spawnPty: mockSpawnPty,
      writePty: mockWritePty,
      resizePty: mockResizePty,
      onPtyData: mockOnPtyData,
      onPtyExit: mockOnPtyExit,
    }
  })

  afterEach(() => {
    delete (window as unknown as { ziafAPI?: unknown }).ziafAPI
    MockTerminal.openError = null
  })

  it('renders container with default uncontrolled tabs, controls, and badge with translations', () => {
    // English locale (default)
    const { rerender } = render(<TerminalPane />)

    expect(screen.getByTestId('terminal-pane')).not.toBeNull()
    expect(screen.getByTestId('terminal-container')).not.toBeNull()
    expect(screen.getByTestId('terminal-tab-0')).not.toBeNull()
    expect(screen.getByText('zsh 1')).not.toBeNull()

    const newTabBtn = screen.getByTestId('terminal-new-tab-button')
    expect(newTabBtn.getAttribute('title')).toBe('New Tab')

    const clearBtn = screen.getByTestId('terminal-clear-button')
    expect(clearBtn.getAttribute('title')).toBe('Clear Terminal')

    expect(screen.getByText('xterm.js')).not.toBeNull()

    // Verifies xterm initialized and opened into container
    expect(mockTermInstances.length).toBe(1)
    expect(mockTermInstances[0].open).toHaveBeenCalled()

    // Switch to Russian locale
    act(() => {
      useStore.setState({
        settings: {
          ...useStore.getState().settings,
          uiLanguage: 'ru',
        } as Settings,
      })
    })

    rerender(<TerminalPane />)
    expect(newTabBtn.getAttribute('title')).toBe('Новая вкладка')
    expect(clearBtn.getAttribute('title')).toBe('Очистить терминал')
  })

  it('supports adding and switching tabs in uncontrolled mode', () => {
    render(<TerminalPane />)

    const tab0 = screen.getByTestId('terminal-tab-0')
    expect(tab0.className).toContain('bg-[#1e2024]')

    // Click "+" button to add new tab
    const addBtn = screen.getByTestId('terminal-new-tab-button')
    fireEvent.click(addBtn)

    const tab1 = screen.getByTestId('terminal-tab-1')
    expect(tab1).not.toBeNull()
    expect(tab1.textContent).toBe('zsh 2')
    // Active tab switches to new tab
    expect(tab1.className).toContain('bg-[#1e2024]')

    // Switch back to tab 0
    fireEvent.click(tab0)
    expect(tab0.className).toContain('bg-[#1e2024]')
    expect(tab1.className).not.toContain('bg-[#1e2024]')
  })

  it('supports controlled tabs and dispatches onTabChange and onNewTab', () => {
    const onTabChange = vi.fn()
    const onNewTab = vi.fn()

    render(
      <TerminalPane
        tabs={['Build', 'Tests', 'Server']}
        activeTabIdx={1}
        onTabChange={onTabChange}
        onNewTab={onNewTab}
      />
    )

    expect(screen.getByText('Build')).not.toBeNull()
    const testsTab = screen.getByText('Tests')
    expect(testsTab.className).toContain('bg-[#1e2024]')

    fireEvent.click(screen.getByText('Build'))
    expect(onTabChange).toHaveBeenCalledWith(0)

    fireEvent.click(screen.getByTestId('terminal-new-tab-button'))
    expect(onNewTab).toHaveBeenCalled()
  })

  it('updates uncontrolled tab selection even when onTabChange callback is provided', () => {
    const onTabChange = vi.fn()

    render(
      <TerminalPane
        tabs={['Tab A', 'Tab B']}
        onTabChange={onTabChange}
      />
    )

    const tabB = screen.getByText('Tab B')
    fireEvent.click(tabB)

    expect(onTabChange).toHaveBeenCalledWith(1)
    // Internal selection updates to Tab B because activeTabIdx was uncontrolled
    expect(tabB.className).toContain('bg-[#1e2024]')
  })

  it('clamps internal active tab index when tabs array shrinks', () => {
    const { rerender } = render(<TerminalPane tabs={['T1', 'T2', 'T3']} />)

    // Select T3 (index 2)
    fireEvent.click(screen.getByText('T3'))
    expect(screen.getByText('T3').className).toContain('bg-[#1e2024]')

    // Shrink tabs to 1 entry
    rerender(<TerminalPane tabs={['T1']} />)
    expect(screen.getByText('T1').className).toContain('bg-[#1e2024]')
  })

  it('clears terminal on clear button click and triggers onClear with in-band reset', () => {
    const onClear = vi.fn()
    render(<TerminalPane onClear={onClear} />)

    const clearBtn = screen.getByTestId('terminal-clear-button')
    fireEvent.click(clearBtn)

    expect(mockTermInstances[0].reset).toHaveBeenCalled()
    expect(mockTermInstances[0].write).toHaveBeenCalledWith('\x1bc')
    expect(onClear).toHaveBeenCalled()
  })

  it('does not recreate xterm instance when callbacks change', () => {
    let onDataFn = () => {}
    let onResizeFn = () => {}

    const { rerender } = render(
      <TerminalPane
        onData={onDataFn}
        onResize={onResizeFn}
        readOnly={false}
      />
    )

    expect(mockTermInstances.length).toBe(1)
    const term = mockTermInstances[0]

    // Update with new callback references and modified readOnly
    onDataFn = () => {}
    onResizeFn = () => {}

    rerender(
      <TerminalPane
        onData={onDataFn}
        onResize={onResizeFn}
        readOnly={true}
      />
    )

    // Terminal must NOT be recreated!
    expect(mockTermInstances.length).toBe(1)
    expect(term.options.disableStdin).toBe(true)
    expect(term.options.cursorBlink).toBe(false)
  })

  it('notifies onResize and resizePty when font size or family changes without recreating terminal', () => {
    const sessionId = 'pty-font-test'
    const onResize = vi.fn()

    const { rerender } = render(
      <TerminalPane
        sessionId={sessionId}
        isRealMode={true}
        fontSize={11}
        fontFamily="Menlo"
        onResize={onResize}
      />
    )

    expect(mockTermInstances.length).toBe(1)
    const term = mockTermInstances[0]
    onResize.mockClear()
    mockResizePty.mockClear()

    // Change font size
    rerender(
      <TerminalPane
        sessionId={sessionId}
        isRealMode={true}
        fontSize={16}
        fontFamily="JetBrains Mono"
        onResize={onResize}
      />
    )

    expect(mockTermInstances.length).toBe(1)
    expect(term.options.fontSize).toBe(16)
    expect(term.options.fontFamily).toBe('JetBrains Mono')
    expect(mockFitAddonInstances[0].fit).toHaveBeenCalled()
    expect(onResize).toHaveBeenCalledWith(80, 24)
    expect(mockResizePty).toHaveBeenCalledWith({
      sessionId,
      cols: 80,
      rows: 24,
    })
  })

  it('streams logs to xterm and handles appends, in-band resets, and replacements without losing output', () => {
    const { rerender } = render(<TerminalPane logs={['[INFO] Initializing server\r\n']} />)

    expect(mockTermInstances.length).toBe(1)
    const term = mockTermInstances[0]
    expect(term.write).toHaveBeenCalledWith('[INFO] Initializing server\r\n')

    // 1. Strict append: only new lines written
    rerender(
      <TerminalPane
        logs={[
          '[INFO] Initializing server\r\n',
          '[INFO] Listening on port 3000\r\n',
          '[INFO] Connected to DB\r\n',
        ]}
      />
    )

    expect(mockTermInstances.length).toBe(1)
    expect(term.write).toHaveBeenCalledWith('[INFO] Listening on port 3000\r\n')
    expect(term.write).toHaveBeenCalledWith('[INFO] Connected to DB\r\n')

    // 2. Empty stream: in-band hard reset \x1bc
    rerender(<TerminalPane logs={[]} />)
    expect(term.reset).toHaveBeenCalled()
    expect(term.write).toHaveBeenCalledWith('\x1bc')

    // 3. New logs arriving after empty stream: writes all lines cleanly to reset buffer
    rerender(<TerminalPane logs={['[INFO] After clear\r\n']} />)
    expect(term.write).toHaveBeenCalledWith('[INFO] After clear\r\n')

    // 4. Replacement of same length: in-band hard reset and replay together
    rerender(<TerminalPane logs={['[INFO] Replaced line\r\n']} />)
    expect(term.reset).toHaveBeenCalledTimes(2)
    expect(term.write).toHaveBeenCalledWith('\x1bc[INFO] Replaced line\r\n')
  })

  it('replays existing logs when terminal instance is recreated on tab/session change', () => {
    const persistentLogs = ['Log 1\r\n', 'Log 2\r\n']

    const { rerender } = render(
      <TerminalPane
        sessionId="session-1"
        logs={persistentLogs}
        isRealMode={true}
      />
    )

    expect(mockTermInstances.length).toBe(1)
    expect(mockTermInstances[0].write).toHaveBeenCalledWith('Log 1\r\n')
    expect(mockTermInstances[0].write).toHaveBeenCalledWith('Log 2\r\n')

    // Switch to another session with same logs array
    rerender(
      <TerminalPane
        sessionId="session-2"
        logs={persistentLogs}
        isRealMode={true}
      />
    )

    expect(mockTermInstances.length).toBe(2)
    // New terminal instance must have had persistentLogs replayed!
    expect(mockTermInstances[1].write).toHaveBeenCalledWith('Log 1\r\n')
    expect(mockTermInstances[1].write).toHaveBeenCalledWith('Log 2\r\n')
  })

  it('does not subscribe to real PTY events when isRealMode is false', () => {
    render(<TerminalPane sessionId="mock-session" isRealMode={false} />)

    expect(mockOnPtyData).not.toHaveBeenCalled()
    expect(mockOnPtyExit).not.toHaveBeenCalled()
  })

  it('subscribes to PTY stream and writes data/exit events in real mode', () => {
    const sessionId = 'pty-session-123'
    const { unmount } = render(<TerminalPane sessionId={sessionId} isRealMode={true} />)

    expect(mockOnPtyData).toHaveBeenCalledWith(sessionId, expect.any(Function))
    expect(mockOnPtyExit).toHaveBeenCalledWith(sessionId, expect.any(Function))

    const term = mockTermInstances[0]

    // Simulate incoming PTY data
    act(() => {
      ptyDataCallback?.('Compiling TypeScript...\r\n')
    })
    expect(term.write).toHaveBeenCalledWith('Compiling TypeScript...\r\n')

    // Simulate PTY exit
    act(() => {
      ptyExitCallback?.({ exitCode: 1 })
    })
    expect(term.write).toHaveBeenCalledWith(
      expect.stringContaining('[Process exited with code 1]')
    )

    // Unmount must call PTY cleanups and term dispose
    unmount()
    expect(cleanupDataSpy).toHaveBeenCalled()
    expect(cleanupExitSpy).toHaveBeenCalled()
    expect(term.dispose).toHaveBeenCalled()
  })

  it('disposes partially initialized resources if open throws during initialization', () => {
    MockTerminal.openError = new Error('Container not attached to DOM')

    render(<TerminalPane />)
    // Must not throw, and must have cleaned up the created instance and addon
    expect(mockTermInstances.length).toBe(1)
    expect(mockTermInstances[0].dispose).toHaveBeenCalled()
    expect(mockFitAddonInstances[0].dispose).toHaveBeenCalled()
  })

  it('pipes user keyboard input to writePty in real mode and calls onData', () => {
    const sessionId = 'pty-session-interactive'
    const onData = vi.fn()

    render(
      <TerminalPane
        sessionId={sessionId}
        isRealMode={true}
        onData={onData}
      />
    )

    const term = mockTermInstances[0]
    term._emitData('ls -la\r')

    expect(onData).toHaveBeenCalledWith('ls -la\r')
    expect(mockWritePty).toHaveBeenCalledWith({
      sessionId,
      data: 'ls -la\r',
    })
  })

  it('ignores user input when readOnly is set to true', () => {
    const sessionId = 'pty-session-readonly'
    const onData = vi.fn()

    render(
      <TerminalPane
        sessionId={sessionId}
        isRealMode={true}
        readOnly={true}
        onData={onData}
      />
    )

    const term = mockTermInstances[0]
    term._emitData('npm test\r')

    expect(onData).not.toHaveBeenCalled()
    expect(mockWritePty).not.toHaveBeenCalled()
  })

  it('handles resize events and notifies onResize and resizePty', () => {
    const sessionId = 'pty-resize-test'
    const onResize = vi.fn()

    render(
      <TerminalPane
        sessionId={sessionId}
        isRealMode={true}
        onResize={onResize}
      />
    )

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(onResize).toHaveBeenCalledWith(80, 24)
    expect(mockResizePty).toHaveBeenCalledWith({
      sessionId,
      cols: 80,
      rows: 24,
    })
  })

  it('guarantees complete isolation from chat state and store feeds', () => {
    const initialFeed = useStore.getState().activeFeed

    const { rerender } = render(
      <TerminalPane
        sessionId="pty-isolated"
        logs={['Log line 1\r\n', 'Log line 2\r\n']}
        isRealMode={true}
      />
    )

    // Simulate intense PTY activity
    act(() => {
      ptyDataCallback?.('data chunk 1')
      ptyDataCallback?.('data chunk 2')
    })

    rerender(
      <TerminalPane
        sessionId="pty-isolated"
        logs={['Log line 1\r\n', 'Log line 2\r\n', 'Log line 3\r\n']}
        isRealMode={true}
      />
    )

    // Verify chat feed in Zustand store is 100% untouched
    expect(useStore.getState().activeFeed).toEqual(initialFeed)
  })

  it('spawns PTY when eligible with cwd in real mode and writes boot history to terminal', async () => {
    render(
      <TerminalPane
        sessionId="term-task-123-0"
        cwd="/tmp/worktree-123"
        isRealMode={true}
      />
    )

    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalledWith({
        sessionId: 'term-task-123-0',
        cwd: '/tmp/worktree-123',
        cols: 80,
        rows: 24,
      })
    })

    expect(mockTermInstances[0].write).toHaveBeenCalledWith('PTY history boot\n')
  })

  it('displays idle placeholder and defers spawning when task session has no cwd', () => {
    render(
      <TerminalPane
        sessionId="term-task-123-0"
        cwd=""
        isRealMode={true}
      />
    )

    expect(mockSpawnPty).not.toHaveBeenCalled()
    expect(mockTermInstances[0].write).toHaveBeenCalledWith(
      expect.stringContaining('Terminal is idle. Start the task to open a terminal in the task worktree.')
    )
  })

  it('ignores pty-data and pty-exit events from obsolete generations', async () => {
    let capturedOnData: ((data: string, meta?: { generation?: number }) => void) | undefined
    let capturedOnExit: ((res: { exitCode: number; generation?: number }) => void) | undefined

    mockOnPtyData.mockImplementation((_sessionId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      capturedOnData = cb
      return () => {}
    })
    mockOnPtyExit.mockImplementation((_sessionId: string, cb: (res: { exitCode: number; generation?: number }) => void) => {
      capturedOnExit = cb
      return () => {}
    })

    mockSpawnPty.mockResolvedValueOnce({
      success: true,
      generation: 2,
      history: '',
    })

    render(
      <TerminalPane
        sessionId="term-task-gen-test"
        cwd="/tmp/worktree-gen-test"
        isRealMode={true}
      />
    )

    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalled()
      expect(capturedOnData).toBeDefined()
      expect(capturedOnExit).toBeDefined()
    })

    const termInstance = mockTermInstances[mockTermInstances.length - 1]
    termInstance.write.mockClear()

    // 1. Obsolete generation 1 stdout event should be discarded
    act(() => {
      capturedOnData?.('stale stdout from gen 1', { generation: 1 })
    })
    expect(termInstance.write).not.toHaveBeenCalledWith('stale stdout from gen 1')

    // 2. Obsolete generation 1 exit event should be discarded
    act(() => {
      capturedOnExit?.({ exitCode: 1, generation: 1 })
    })
    expect(termInstance.write).not.toHaveBeenCalledWith(
      expect.stringContaining('Process exited with code 1')
    )

    // 3. Current generation 2 stdout event must be written
    act(() => {
      capturedOnData?.('fresh stdout from gen 2', { generation: 2 })
    })
    expect(termInstance.write).toHaveBeenCalledWith('fresh stdout from gen 2')

    // 4. Current generation 2 exit event must be written
    act(() => {
      capturedOnExit?.({ exitCode: 0, generation: 2 })
    })
    expect(termInstance.write).toHaveBeenCalledWith(
      expect.stringContaining('Process exited with code 0')
    )
  })

  it('buffers events while spawn response is pending and discards stale generation events when spawn resolves', async () => {
    let capturedOnData: ((data: string, meta?: { generation?: number }) => void) | undefined
    let capturedOnExit: ((res: { exitCode: number; generation?: number }) => void) | undefined

    mockOnPtyData.mockImplementation((_sessionId: string, cb: (data: string, meta?: { generation?: number }) => void) => {
      capturedOnData = cb
      return () => {}
    })
    mockOnPtyExit.mockImplementation((_sessionId: string, cb: (res: { exitCode: number; generation?: number }) => void) => {
      capturedOnExit = cb
      return () => {}
    })

    let resolveSpawn: (val: unknown) => void
    const spawnPromise = new Promise((resolve) => {
      resolveSpawn = resolve
    })
    mockSpawnPty.mockReturnValueOnce(spawnPromise)

    render(
      <TerminalPane
        sessionId="term-task-pre-response-test"
        cwd="/tmp/worktree-pre-response-test"
        isRealMode={true}
      />
    )

    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalled()
      expect(capturedOnData).toBeDefined()
      expect(capturedOnExit).toBeDefined()
    })

    const termInstance = mockTermInstances[mockTermInstances.length - 1]
    termInstance.write.mockClear()

    // Emit generation-1 data and exit while spawn is still pending
    act(() => {
      capturedOnData?.('stale gen-1 data arriving before spawn resolves', { generation: 1 })
      capturedOnExit?.({ exitCode: 1, generation: 1 })
      // Also emit generation-2 data arriving while spawn is still pending
      capturedOnData?.('valid gen-2 data arriving before spawn resolves', { generation: 2 })
    })

    // Before spawn resolves, nothing should be written yet (buffered!)
    expect(termInstance.write).not.toHaveBeenCalledWith('stale gen-1 data arriving before spawn resolves')
    expect(termInstance.write).not.toHaveBeenCalledWith(expect.stringContaining('Process exited with code 1'))

    // Now spawn resolves with authoritative generation: 2
    await act(async () => {
      resolveSpawn({
        success: true,
        generation: 2,
        history: '',
      })
    })

    // After spawn resolves:
    // Stale gen-1 data and exit must NOT have been written
    expect(termInstance.write).not.toHaveBeenCalledWith('stale gen-1 data arriving before spawn resolves')
    expect(termInstance.write).not.toHaveBeenCalledWith(expect.stringContaining('Process exited with code 1'))

    // Valid gen-2 data must have been drained and written!
    expect(termInstance.write).toHaveBeenCalledWith('valid gen-2 data arriving before spawn resolves')
  })

  it('reconciles history and buffered data to avoid duplicate output replay', async () => {
    let resolveSpawn: (res: unknown) => void = () => {}
    const spawnPromise = new Promise((resolve) => {
      resolveSpawn = resolve
    })
    mockSpawnPty.mockReturnValueOnce(spawnPromise)

    let capturedOnData: ((chunk: string, meta?: { generation?: number }) => void) | undefined
    mockOnPtyData.mockImplementation((_sid: string, handler: (chunk: string, meta?: { generation?: number }) => void) => {
      capturedOnData = handler
      return () => {}
    })

    render(
      <TerminalPane
        sessionId="term-task-reconcile-test"
        cwd="/tmp/worktree-reconcile-test"
        isRealMode={true}
      />
    )

    await waitFor(() => {
      expect(mockSpawnPty).toHaveBeenCalled()
      expect(capturedOnData).toBeDefined()
    })

    const termInstance = mockTermInstances[mockTermInstances.length - 1]
    termInstance.write.mockClear()

    // While spawn is pending, "chunk1\n" and "chunk2\n" arrive
    act(() => {
      capturedOnData?.('chunk1\n', { generation: 1 })
      capturedOnData?.('chunk2\n', { generation: 1 })
    })

    // Now spawn resolves with history that already contains "chunk1\n"
    await act(async () => {
      resolveSpawn({
        success: true,
        generation: 1,
        history: 'initial banner\nchunk1\n',
      })
    })

    // History was written
    expect(termInstance.write).toHaveBeenCalledWith('initial banner\nchunk1\n')

    // Only the unseen "chunk2\n" should be written, NOT "chunk1\n" again!
    expect(termInstance.write).toHaveBeenCalledWith('chunk2\n')
    expect(termInstance.write).not.toHaveBeenCalledWith('chunk1\nchunk2\n')
    expect(termInstance.write).not.toHaveBeenCalledWith('chunk1\n')
  })
})
