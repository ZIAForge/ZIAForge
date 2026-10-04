import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { Plus, Trash2, Terminal as TerminalIcon } from 'lucide-react'
import { useTranslation } from '../../i18n'

export interface TerminalPaneProps {
  sessionId?: string
  tabs?: string[]
  activeTabIdx?: number
  onTabChange?: (index: number) => void
  onNewTab?: () => void
  logs?: string[]
  isRealMode?: boolean
  cwd?: string
  readOnly?: boolean
  fontSize?: number
  fontFamily?: string
  className?: string
  onData?: (data: string) => void
  onResize?: (cols: number, rows: number) => void
  onClear?: () => void
}

const DEFAULT_THEME = {
  background: '#0a0b0d',
  foreground: '#d4d4d8',
  cursor: '#ff6b00',
  black: '#1e2024',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#8b5cf6',
  cyan: '#06b6d4',
  white: '#f4f4f5',
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  sessionId,
  tabs: controlledTabs,
  activeTabIdx: controlledActiveTabIdx,
  onTabChange,
  onNewTab,
  logs = [],
  isRealMode = false,
  cwd,
  readOnly = false,
  fontSize = 11,
  fontFamily = 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  className = '',
  onData,
  onResize,
  onClear,
}) => {
  const { t } = useTranslation()

  // Uncontrolled fallback tab state
  const [internalTabs, setInternalTabs] = useState<string[]>(['zsh 1'])
  const [internalActiveTabIdx, setInternalActiveTabIdx] = useState<number>(0)

  const tabs = controlledTabs ?? internalTabs
  const isTabControlled = controlledActiveTabIdx !== undefined
  const isTabsControlled = controlledTabs !== undefined

  // Normalize activeTabIdx so shrinking tabs does not leave index out of bounds
  const rawActiveTabIdx = controlledActiveTabIdx ?? internalActiveTabIdx
  const activeTabIdx =
    tabs.length > 0 ? Math.max(0, Math.min(rawActiveTabIdx, tabs.length - 1)) : 0

  useEffect(() => {
    if (internalActiveTabIdx >= tabs.length && tabs.length > 0) {
      setInternalActiveTabIdx(tabs.length - 1)
    }
  }, [tabs.length, internalActiveTabIdx])

  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermInstance = useRef<Terminal | null>(null)
  const fitAddonInstance = useRef<FitAddon | null>(null)

  // Track logs for replay and diffing
  const prevLogsRef = useRef<string[]>([])
  const lastLogsCount = useRef<number>(0)

  // Callbacks and configuration stored in refs to prevent terminal recreation
  const onDataRef = useRef(onData)
  onDataRef.current = onData
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize
  const onClearRef = useRef(onClear)
  onClearRef.current = onClear
  const readOnlyRef = useRef(readOnly)
  readOnlyRef.current = readOnly
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const isRealModeRef = useRef(isRealMode)
  isRealModeRef.current = isRealMode

  const fontSizeRef = useRef(fontSize)
  fontSizeRef.current = fontSize
  const fontFamilyRef = useRef(fontFamily)
  fontFamilyRef.current = fontFamily
  const logsRef = useRef(logs)
  logsRef.current = logs

  const handleTabClick = (idx: number) => {
    if (!isTabControlled) {
      setInternalActiveTabIdx(idx)
    }
    onTabChange?.(idx)
  }

  const handleAddTab = () => {
    if (!isTabsControlled) {
      setInternalTabs((prev) => [...prev, `zsh ${prev.length + 1}`])
      if (!isTabControlled) {
        setInternalActiveTabIdx(tabs.length)
      }
    }
    onNewTab?.()
  }

  // In-band hard reset sequence (\x1bc) clears pending queue and resets parser state
  const resetAndWrite = useCallback((term: Terminal, payload?: string | string[]) => {
    term.reset()
    if (Array.isArray(payload)) {
      term.write('\x1bc' + payload.join(''))
    } else if (payload) {
      term.write('\x1bc' + payload)
    } else {
      term.write('\x1bc')
    }
  }, [])

  const handleClearTerminal = useCallback(() => {
    if (xtermInstance.current) {
      resetAndWrite(xtermInstance.current)
    }
    onClearRef.current?.()
  }, [resetAndWrite])

  // Shared resize handler to fit addon and notify PTY / parent
  const handleResize = useCallback(() => {
    const term = xtermInstance.current
    const fitAddon = fitAddonInstance.current
    if (!term || !fitAddon) return
    try {
      fitAddon.fit()
      onResizeRef.current?.(term.cols, term.rows)
      if (isRealModeRef.current && sessionIdRef.current && window.ziafAPI?.resizePty) {
        window.ziafAPI.resizePty({
          sessionId: sessionIdRef.current,
          cols: term.cols,
          rows: term.rows,
        })
      }
    } catch {
      // Safe fallback
    }
  }, [])

  // Dynamic terminal options update without recreation
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.disableStdin = readOnly
      xtermInstance.current.options.cursorBlink = !readOnly
    }
  }, [readOnly])

  useEffect(() => {
    if (xtermInstance.current) {
      if (fontSize) xtermInstance.current.options.fontSize = fontSize
      if (fontFamily) xtermInstance.current.options.fontFamily = fontFamily
      handleResize()
    }
  }, [fontSize, fontFamily, handleResize])

  // Initialize Terminal instance
  useEffect(() => {
    if (!terminalRef.current) return

    let term: Terminal | null = null
    let fitAddon: FitAddon | null = null

    try {
      term = new Terminal({
        theme: DEFAULT_THEME,
        fontSize: fontSizeRef.current,
        fontFamily: fontFamilyRef.current,
        cursorBlink: !readOnlyRef.current,
        convertEol: true,
        rows: 24,
        cols: 60,
        disableStdin: readOnlyRef.current,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalRef.current)

      try {
        fitAddon.fit()
      } catch {
        // Safe fallback in test / non-visual DOM
      }

      xtermInstance.current = term
      fitAddonInstance.current = fitAddon
    } catch {
      try {
        fitAddon?.dispose()
      } catch {
        // Ignore
      }
      try {
        term?.dispose()
      } catch {
        // Ignore
      }
      return
    }

    // Set initial welcome
    if (!isRealMode) {
      term.write('\x1b[32m✔\x1b[0m Welcome to ZIAForge zsh terminal shell.\r\n')
      term.write('ziaforge git:(main) $ ')
    }

    // Replay logs for newly created terminal instance
    const initialLogs = logsRef.current
    let initialWrittenText = ''
    if (initialLogs.length > 0) {
      initialLogs.forEach((line) => term?.write(line))
      initialWrittenText = initialLogs.join('')
      prevLogsRef.current = initialLogs
      lastLogsCount.current = initialLogs.length
    } else {
      prevLogsRef.current = []
      lastLogsCount.current = 0
    }

    // PTY data handling
    let dataDisposer = { dispose: () => {} }

    if (isRealMode) {
      const sub = term.onData((data) => {
        if (readOnlyRef.current) return
        onDataRef.current?.(data)
        if (sessionId && window.ziafAPI?.writePty) {
          window.ziafAPI.writePty({ sessionId, data })
        }
      })
      dataDisposer = { dispose: () => sub.dispose() }
    } else {
      let cmdBuffer = ''
      const sub = term.onData((data) => {
        if (readOnlyRef.current || !term) return
        onDataRef.current?.(data)

        if (data === '\r') {
          term.write('\r\n')
          const cmd = cmdBuffer.trim()
          if (cmd === 'help') {
            term.write('Available mock commands: ls, cat, git status, clear, help\r\n')
          } else if (cmd === 'clear') {
            resetAndWrite(term)
          } else if (cmd === 'ls') {
            term.write('src   package.json   README.md\r\n')
          } else if (cmd === 'git status') {
            term.write('\x1b[33mOn branch main\x1b[0m\r\nnothing to commit, working tree clean\r\n')
          } else if (cmd.length > 0) {
            term.write(`zsh: command not found: ${cmd}\r\n`)
          }
          term.write('ziaforge git:(main) $ ')
          cmdBuffer = ''
        } else if (data === '\x7f' || data === '\b') {
          if (cmdBuffer.length > 0) {
            cmdBuffer = cmdBuffer.slice(0, -1)
            term.write('\b \b')
          }
        } else {
          cmdBuffer += data
          term.write(data)
        }
      })
      dataDisposer = { dispose: () => sub.dispose() }
    }

    // Terminal geometry change subscriber
    const resizeListener = term.onResize(({ cols, rows }) => {
      onResizeRef.current?.(cols, rows)
      if (isRealMode && sessionId && window.ziafAPI?.resizePty) {
        window.ziafAPI.resizePty({ sessionId, cols, rows })
      }
    })

    window.addEventListener('resize', handleResize)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize()
      })
      resizeObserver.observe(terminalRef.current)
    }

    // Subscribe to background PTY events only in real mode
    let cleanupPtyData = () => {}
    let cleanupPtyExit = () => {}
    let isCancelled = false
    const termInstance = term

    const isTaskSession = Boolean(sessionId?.startsWith('term-task-')) || Boolean(sessionId?.startsWith('chat-')) || Boolean(sessionId?.startsWith('recent-'))
    // Task and chat terminals MUST NOT spawn without an eligible task worktree CWD
    const isEligibleToSpawn = !isTaskSession || Boolean(cwd)

    let currentPtyGen: number | undefined
    let isSpawnPending = Boolean(isRealMode && sessionId && cwd && isEligibleToSpawn && window.ziafAPI?.spawnPty)
    const pendingEventsBuffer: Array<{ type: 'data' | 'exit', data?: string, exitCode?: number, generation?: number }> = []

    if (isRealMode && sessionId && cwd && isEligibleToSpawn && window.ziafAPI?.spawnPty) {
      const requestSessionId = sessionId
      window.ziafAPI.spawnPty({ sessionId: requestSessionId, cwd, cols: 80, rows: 24 })
        .then((res) => {
          if (isCancelled) return
          if (sessionIdRef.current !== requestSessionId) return
          if (xtermInstance.current !== termInstance) return
          isSpawnPending = false
          if (res?.generation !== undefined) {
            currentPtyGen = res.generation
          }
          let writtenHistory = ''
          if (res?.success && res.history) {
            if (!initialWrittenText) {
              termInstance.write(res.history)
              writtenHistory = res.history
            } else if (res.history === initialWrittenText) {
              writtenHistory = res.history
            } else if (res.history.startsWith(initialWrittenText)) {
              const delta = res.history.slice(initialWrittenText.length)
              termInstance.write(delta)
              writtenHistory = res.history
            } else {
              resetAndWrite(termInstance, res.history)
              writtenHistory = res.history
            }
          }

          // Concatenate all buffered data events for current authoritative generation
          const matchingDataEvents = pendingEventsBuffer.filter(
            evt => evt.type === 'data' && (evt.generation === undefined || currentPtyGen === undefined || evt.generation === currentPtyGen)
          )
          const allBufferedData = matchingDataEvents.map(e => e.data || '').join('')

          // Reconcile snapshot and buffered stream: determine unseen portion of buffered data
          let unseenBufferedData = ''
          if (!writtenHistory) {
            unseenBufferedData = allBufferedData
          } else if (allBufferedData) {
            if (writtenHistory.endsWith(allBufferedData)) {
              unseenBufferedData = ''
            } else if (allBufferedData.startsWith(writtenHistory)) {
              unseenBufferedData = allBufferedData.slice(writtenHistory.length)
            } else {
              const maxOverlap = Math.min(writtenHistory.length, allBufferedData.length)
              let overlap = 0
              for (let len = maxOverlap; len > 0; len--) {
                if (writtenHistory.endsWith(allBufferedData.slice(0, len))) {
                  overlap = len
                  break
                }
              }
              unseenBufferedData = allBufferedData.slice(overlap)
            }
          }

          if (unseenBufferedData && xtermInstance.current) {
            xtermInstance.current.write(unseenBufferedData)
          }

          // Drain exit events matching authoritative generation
          for (const evt of pendingEventsBuffer) {
            if (evt.generation !== undefined && currentPtyGen !== undefined && evt.generation !== currentPtyGen) {
              continue
            }
            if (evt.type === 'exit' && xtermInstance.current && evt.exitCode !== undefined) {
              xtermInstance.current.write(
                `\r\n\x1b[31m✖ [Process exited with code ${evt.exitCode}]\x1b[0m\r\n`
              )
            }
          }
          pendingEventsBuffer.length = 0
        })
        .catch(() => {
          isSpawnPending = false
          pendingEventsBuffer.length = 0
        })
    } else if (isTaskSession && !cwd && termInstance) {
      termInstance.write('\r\n\x1b[90m[Terminal is idle. Start the task to open a terminal in the task worktree.]\x1b[0m\r\n')
    }

    if (isRealMode && sessionId && window.ziafAPI?.onPtyData) {
      cleanupPtyData = window.ziafAPI.onPtyData(sessionId, (data: string, meta?: { generation?: number }) => {
        if (isSpawnPending) {
          pendingEventsBuffer.push({ type: 'data', data, generation: meta?.generation })
          return
        }
        if (meta?.generation !== undefined && currentPtyGen !== undefined && meta.generation !== currentPtyGen) {
          return
        }
        if (meta?.generation !== undefined && currentPtyGen === undefined) {
          currentPtyGen = meta.generation
        }
        if (xtermInstance.current) {
          xtermInstance.current.write(data)
        }
      })
    }

    if (isRealMode && sessionId && window.ziafAPI?.onPtyExit) {
      cleanupPtyExit = window.ziafAPI.onPtyExit(
        sessionId,
        ({ exitCode, generation }: { exitCode: number, generation?: number }) => {
          if (isSpawnPending) {
            pendingEventsBuffer.push({ type: 'exit', exitCode, generation })
            return
          }
          if (generation !== undefined && currentPtyGen !== undefined && generation !== currentPtyGen) {
            return
          }
          if (xtermInstance.current) {
            xtermInstance.current.write(
              `\r\n\x1b[31m✖ [Process exited with code ${exitCode}]\x1b[0m\r\n`
            )
          }
        }
      )
    }

    return () => {
      isCancelled = true
      dataDisposer.dispose()
      resizeListener.dispose()
      window.removeEventListener('resize', handleResize)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      cleanupPtyData()
      cleanupPtyExit()
      term?.dispose()
      xtermInstance.current = null
      fitAddonInstance.current = null
    }
  }, [sessionId, activeTabIdx, isRealMode, cwd, handleResize, resetAndWrite])

  // Stream new logs, handle replacements, and reset without losing output
  useEffect(() => {
    if (!xtermInstance.current) return

    // In real mode with an active session, PTY data is streamed directly via onPtyData listener.
    // Writing store `logs` here causes duplicate output in the terminal.
    if (isRealMode && sessionId) {
      prevLogsRef.current = logs
      lastLogsCount.current = logs.length
      return
    }

    // Case 1: Empty stream -> full in-band hard reset
    if (logs.length === 0) {
      if (prevLogsRef.current.length > 0) {
        resetAndWrite(xtermInstance.current)
      }
      prevLogsRef.current = []
      lastLogsCount.current = 0
      return
    }

    // Case 2: Strict append -> write delta lines
    const isStrictAppend =
      logs.length > prevLogsRef.current.length &&
      prevLogsRef.current.every((line, idx) => line === logs[idx])

    if (isStrictAppend) {
      const nextLines = logs.slice(prevLogsRef.current.length)
      nextLines.forEach((line) => xtermInstance.current?.write(line))
      prevLogsRef.current = logs
      lastLogsCount.current = logs.length
      return
    }

    // Case 3: Identical contents -> no-op
    if (
      logs.length === prevLogsRef.current.length &&
      logs.every((line, idx) => line === prevLogsRef.current[idx])
    ) {
      return
    }

    // Case 4: Replacement or truncation -> in-band hard reset and replay
    resetAndWrite(xtermInstance.current, logs)
    prevLogsRef.current = logs
    lastLogsCount.current = logs.length
  }, [logs, resetAndWrite, isRealMode, sessionId])

  return (
    <div
      className={`flex-1 flex flex-col overflow-hidden bg-[#0a0b0d] text-[#e2e8f0] font-sans ${className}`}
      data-testid="terminal-pane"
    >
      {/* Tabs & Controls bar */}
      <div className="h-10 border-b border-[#1e2024]/60 bg-[#0c0d0e]/60 flex items-center px-3 justify-between select-none shrink-0 no-drag-region">
        <div className="flex items-center gap-1">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleTabClick(idx)}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTabIdx === idx
                  ? 'bg-[#1e2024] text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              data-testid={`terminal-tab-${idx}`}
            >
              {tab}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAddTab}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-[#1e2024] transition-colors cursor-pointer"
            title={t('new_tab')}
            data-testid="terminal-new-tab-button"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearTerminal}
            className="p-1 rounded text-zinc-600 hover:text-zinc-400 hover:bg-[#1e2024] transition-colors cursor-pointer"
            title={t('clear_terminal')}
            data-testid="terminal-clear-button"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <div className="flex items-center gap-1 text-[9px] text-zinc-600 font-mono font-bold uppercase tracking-wide">
            <TerminalIcon className="h-2.5 w-2.5" />
            <span>xterm.js</span>
          </div>
        </div>
      </div>

      {/* Terminal mount container */}
      <div
        ref={terminalRef}
        className="flex-1 p-3 bg-[#0a0b0d] overflow-hidden"
        data-testid="terminal-container"
      />
    </div>
  )
}
