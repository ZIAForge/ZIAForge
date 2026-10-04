/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import { WorkspaceShell, MemoWorkspaceShell, type CentralTabItem } from '../WorkspaceShell'
import { useStore } from '../../../store'
import type { Settings } from '../../../store'

describe('WorkspaceShell Component', () => {
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

  const sampleCentralTabs: CentralTabItem[] = [
    { id: 'tab-chat', name: 'Chat Feed', type: 'chat' },
    { id: 'tab-file-1', name: 'App.tsx', type: 'file', filePath: 'src/App.tsx' },
  ]

  it('renders header with title, subtitle, and right toolbar buttons', () => {
    render(
      <WorkspaceShell
        title="Agent Streaming Track"
        subtitle="ziaforge (main)"
        todoProgress={{ completed: 2, total: 5 }}
        gitChangesCount={7}
      />
    )

    expect(screen.getByText('Agent Streaming Track')).not.toBeNull()
    expect(screen.getByText('ziaforge (main)')).not.toBeNull()
    expect(screen.getByText('2/5')).not.toBeNull()
    expect(screen.getByText('7')).not.toBeNull()

    expect(screen.getByTestId('tab-btn-todo')).not.toBeNull()
    expect(screen.getByTestId('tab-btn-files')).not.toBeNull()
    expect(screen.getByTestId('tab-btn-git')).not.toBeNull()
    expect(screen.getByTestId('tab-btn-terminal')).not.toBeNull()
    expect(screen.getByTestId('tab-btn-automations')).not.toBeNull()
    expect(screen.getByTestId('tab-btn-browser')).not.toBeNull()
  })

  it('toggles right panel tab on toolbar button clicks', () => {
    const onSelectTab = vi.fn()
    const { rerender } = render(
      <WorkspaceShell
        rightPanelTab={null}
        onSelectRightPanelTab={onSelectTab}
      />
    )

    // Click terminal
    fireEvent.click(screen.getByTestId('tab-btn-terminal'))
    expect(onSelectTab).toHaveBeenCalledWith('terminal')

    // If terminal is already active, clicking it again should close it (pass null)
    rerender(
      <WorkspaceShell
        rightPanelTab="terminal"
        onSelectRightPanelTab={onSelectTab}
      />
    )
    fireEvent.click(screen.getByTestId('tab-btn-terminal'))
    expect(onSelectTab).toHaveBeenCalledWith(null)
  })

  it('renders central tabs and handles tab selection and closing', () => {
    const onSelectTab = vi.fn()
    const onCloseTab = vi.fn()

    render(
      <WorkspaceShell
        centralTabs={sampleCentralTabs}
        activeTabId="tab-chat"
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
      />
    )

    expect(screen.getByText('Chat Feed')).not.toBeNull()
    expect(screen.getByText('App.tsx')).not.toBeNull()

    // Select file tab
    fireEvent.click(screen.getByTestId('central-tab-tab-file-1'))
    expect(onSelectTab).toHaveBeenCalledWith('tab-file-1')

    // Close file tab
    fireEvent.click(screen.getByTestId('close-tab-tab-file-1'))
    expect(onCloseTab).toHaveBeenCalledWith('tab-file-1')
  })

  it('renders chat view with feed and composer when active tab is chat', () => {
    render(
      <WorkspaceShell
        centralTabs={sampleCentralTabs}
        activeTabId="tab-chat"
        feed={<div data-testid="mock-feed">Conversation Feed Content</div>}
        composer={<div data-testid="mock-composer">Composer Input Content</div>}
        fileViewer={<div data-testid="mock-file-viewer">File Editor Content</div>}
      />
    )

    expect(screen.getByTestId('mock-feed')).not.toBeNull()
    expect(screen.getByTestId('mock-composer')).not.toBeNull()
    expect(screen.queryByTestId('mock-file-viewer')).toBeNull()
  })

  it('switches to file viewer when active tab is file', () => {
    render(
      <WorkspaceShell
        centralTabs={sampleCentralTabs}
        activeTabId="tab-file-1"
        feed={<div data-testid="mock-feed">Conversation Feed Content</div>}
        composer={<div data-testid="mock-composer">Composer Input Content</div>}
        fileViewer={<div data-testid="mock-file-viewer">File Editor Content</div>}
      />
    )

    expect(screen.getByTestId('mock-file-viewer')).not.toBeNull()
    expect(screen.queryByTestId('mock-feed')).toBeNull()
    expect(screen.queryByTestId('mock-composer')).toBeNull()
  })

  it('renders right sidebar and resizer handle when rightPanelTab is open', () => {
    const { rerender } = render(
      <WorkspaceShell
        rightPanelTab={null}
        rightPanelContent={<div data-testid="mock-right-content">Sidebar Content</div>}
      />
    )

    expect(screen.queryByTestId('workspace-right-sidebar')).toBeNull()
    expect(screen.queryByTestId('right-panel-resizer')).toBeNull()

    rerender(
      <WorkspaceShell
        rightPanelTab="todo"
        rightPanelContent={<div data-testid="mock-right-content">Sidebar Content</div>}
      />
    )

    expect(screen.getByTestId('workspace-right-sidebar')).not.toBeNull()
    expect(screen.getByTestId('mock-right-content')).not.toBeNull()
    expect(screen.getByTestId('right-panel-resizer')).not.toBeNull()
  })

  it('handles right panel resizing via drag', () => {
    const onWidthChange = vi.fn()

    render(
      <WorkspaceShell
        rightPanelTab="terminal"
        rightPanelWidth={400}
        onRightPanelWidthChange={onWidthChange}
        rightPanelContent={<div>Terminal</div>}
      />
    )

    const resizer = screen.getByTestId('right-panel-resizer')

    // Mouse down on resizer at clientX 500
    fireEvent.mouseDown(resizer, { clientX: 500 })

    // Move mouse leftwards to clientX 400 (delta +100 px width)
    fireEvent.mouseMove(document, { clientX: 400 })

    expect(onWidthChange).toHaveBeenCalledWith(500)

    // Mouse up
    fireEvent.mouseUp(document)
  })

  it('cleans up drag event listeners if unmounted during resize', () => {
    const onWidthChange = vi.fn()

    const { unmount } = render(
      <WorkspaceShell
        rightPanelTab="terminal"
        rightPanelWidth={400}
        onRightPanelWidthChange={onWidthChange}
        rightPanelContent={<div>Terminal</div>}
      />
    )

    const resizer = screen.getByTestId('right-panel-resizer')
    fireEvent.mouseDown(resizer, { clientX: 500 })

    // Unmount while dragging
    unmount()

    // Subsequent mouse move should not call onWidthChange
    fireEvent.mouseMove(document, { clientX: 350 })
    expect(onWidthChange).not.toHaveBeenCalled()
  })

  it('cleans up drag event listeners if rightPanelTab is closed during resize', () => {
    const onWidthChange = vi.fn()

    const { rerender } = render(
      <WorkspaceShell
        rightPanelTab="terminal"
        rightPanelWidth={400}
        onRightPanelWidthChange={onWidthChange}
        rightPanelContent={<div>Terminal</div>}
      />
    )

    const resizer = screen.getByTestId('right-panel-resizer')
    fireEvent.mouseDown(resizer, { clientX: 500 })

    // Close right panel during drag
    rerender(
      <WorkspaceShell
        rightPanelTab={null}
        rightPanelWidth={400}
        onRightPanelWidthChange={onWidthChange}
        rightPanelContent={<div>Terminal</div>}
      />
    )

    // Subsequent mouse move should not call onWidthChange
    fireEvent.mouseMove(document, { clientX: 350 })
    expect(onWidthChange).not.toHaveBeenCalled()
  })

  it('renders loading placeholder when active tab is file and fileViewer is null/undefined', () => {
    render(
      <WorkspaceShell
        centralTabs={sampleCentralTabs}
        activeTabId="tab-file-1"
        feed={<div data-testid="mock-feed">Conversation Feed Content</div>}
        composer={<div data-testid="mock-composer">Composer Input Content</div>}
        fileViewer={null}
      />
    )

    expect(screen.getByTestId('file-viewer-loading')).not.toBeNull()
    expect(screen.queryByTestId('mock-feed')).toBeNull()
    expect(screen.queryByTestId('mock-composer')).toBeNull()
  })

  it('MemoWorkspaceShell export is genuinely wrapped in React.memo', () => {
    expect((MemoWorkspaceShell as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.memo')
    )
    expect((MemoWorkspaceShell as unknown as { type: unknown }).type).toBe(WorkspaceShell)
  })
})
