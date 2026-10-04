/** @vitest-environment happy-dom */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react'
import { Composer, MemoComposer } from '../Composer'
import type { ComposerAttachment } from '../ComposerAttachments'
import { useStore } from '../../../store'
import type { Settings } from '../../../store'

describe('Composer Component', () => {
  it('keeps a manually entered model while the CLI catalog refreshes', () => {
    const onSelectModel = vi.fn()
    const { rerender } = render(<Composer selectedModel="auto" customModels={[]} isLoadingModels onSelectModel={onSelectModel} />)
    fireEvent.click(screen.getByTestId('composer-model-selector-btn'))
    fireEvent.click(screen.getByTestId('model-tab-custom'))
    fireEvent.change(screen.getByTestId('composer-custom-model-select'), { target: { value: '__custom__' } })
    fireEvent.change(screen.getByTestId('composer-custom-model-input'), { target: { value: 'future-model' } })
    rerender(<Composer selectedModel="auto" customModels={['model-from-cli']} onSelectModel={onSelectModel} />)
    expect((screen.getByTestId('composer-custom-model-input') as HTMLInputElement).value).toBe('future-model')
    fireEvent.click(screen.getByTestId('composer-apply-custom-model-btn'))
    expect(onSelectModel).toHaveBeenCalledWith('future-model')
  })

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

  it('renders input field with placeholder and default controls', () => {
    render(<Composer placeholder="Test placeholder" />)

    const input = screen.getByPlaceholderText('Test placeholder')
    expect(input).not.toBeNull()
    expect(screen.getByTestId('composer-send-button')).not.toBeNull()
    expect(screen.getByTestId('composer-attach-button')).not.toBeNull()
    expect(screen.getByTestId('composer-model-selector-btn')).not.toBeNull()
  })

  it('handles text typing and sends message on send button click', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} />)

    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Refactor database models' } })
    expect(textarea.value).toBe('Refactor database models')

    const sendBtn = screen.getByTestId('composer-send-button')
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('Refactor database models', [])
    // Input should be cleared after successful send
    expect(textarea.value).toBe('')
  })

  it('preserves draft text and attachments when onSend fails or rejects', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('Network disconnected'))
    render(<Composer onSend={onSend} />)

    const file = new File(['code'], 'script.py', { type: 'text/x-python' })
    const fileInput = screen.getByTestId('composer-file-input') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(screen.getByText('script.py')).not.toBeNull()

    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Crucial draft to keep' } })

    const sendBtn = screen.getByTestId('composer-send-button')
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    // Draft and attachments MUST be preserved for retry!
    expect(textarea.value).toBe('Crucial draft to keep')
    expect(screen.getByText('script.py')).not.toBeNull()
    expect(screen.getByText('Network disconnected')).not.toBeNull()
  })

  it('sends message on Enter key without Shift', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} />)

    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Run test suite' } })

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('Run test suite', [])
    expect(textarea.value).toBe('')
  })

  it('does NOT send message on Enter if IME composition is active', async () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} />)

    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'kanji' } })

    await act(async () => {
      fireEvent.keyDown(textarea, {
        key: 'Enter',
        shiftKey: false,
        isComposing: true,
      })
    })

    expect(onSend).not.toHaveBeenCalled()
    expect(textarea.value).toBe('kanji')
  })

  it('allows newline on Shift+Enter without sending', async () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} />)

    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Line 1' } })

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send message when input is only whitespace and no attachments', async () => {
    const onSend = vi.fn()
    render(<Composer onSend={onSend} />)

    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '   ' } })

    const sendBtn = screen.getByTestId('composer-send-button')
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('renders stop button when isRunning is true and triggers onStop', async () => {
    const onStop = vi.fn()
    render(<Composer isRunning={true} onStop={onStop} />)

    const stopBtn = screen.getByTestId('composer-stop-button')
    expect(stopBtn).not.toBeNull()
    expect(screen.queryByTestId('composer-send-button')).toBeNull()

    await act(async () => {
      fireEvent.click(stopBtn)
    })

    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('disables controls and prevents interactions when disabled=true', async () => {
    const onSend = vi.fn()
    const { rerender } = render(<Composer disabled={true} onSend={onSend} />)

    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    const attachBtn = screen.getByTestId('composer-attach-button')
    const modelBtn = screen.getByTestId('composer-model-selector-btn')

    expect(textarea.disabled).toBe(true)
    expect(attachBtn.hasAttribute('disabled')).toBe(true)
    expect(modelBtn.hasAttribute('disabled')).toBe(true)

    // Verify remove attachment button is disabled
    rerender(
      <Composer
        disabled={true}
        attachments={[{ id: '1', name: 'test.txt' }]}
      />
    )
    const removeBtn = screen.getByTestId('remove-attachment-test.txt')
    expect(removeBtn.hasAttribute('disabled')).toBe(true)
  })

  it('opens and interacts with model selector dropdown in presets mode', async () => {
    const onSelectModel = vi.fn()
    const modelOptions = [
      { id: 'opt-1', label: 'ZIAFCoder Fast', icon: '⚡' },
      { id: 'opt-2', label: 'Claude 3.5 Sonnet', icon: '🔥' },
    ]

    render(
      <Composer
        selectedModel="ZIAFCoder Fast"
        modelOptions={modelOptions}
        onSelectModel={onSelectModel}
      />
    )

    const modelSelectorBtn = screen.getByTestId('composer-model-selector-btn')
    expect(modelSelectorBtn.textContent).toContain('ZIAFCoder Fast')

    // Click to open dropdown
    fireEvent.click(modelSelectorBtn)
    expect(screen.getByTestId('model-selector-dropdown')).not.toBeNull()

    // Select second preset
    const sonnetOption = screen.getByText('Claude 3.5 Sonnet')
    fireEvent.click(sonnetOption)

    expect(onSelectModel).toHaveBeenCalledWith('Claude 3.5 Sonnet')
    // Dropdown closes after selection
    expect(screen.queryByTestId('model-selector-dropdown')).toBeNull()
  })

  it('switches to custom tab in model selector and applies custom configuration', async () => {
    const onSelectModel = vi.fn()
    const onCustomAgentChange = vi.fn()

    const { rerender } = render(
      <Composer
        selectedModel="auto"
        customAgent="Google Antigravity"
        customModels={['gemini-2.5-flash', 'gemini-2.5-pro']}
        onSelectModel={onSelectModel}
        onCustomAgentChange={onCustomAgentChange}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByTestId('composer-model-selector-btn'))

    // Switch to custom tab
    const customTabBtn = screen.getByTestId('model-tab-custom')
    fireEvent.click(customTabBtn)

    // Check agent selector
    const agentSelect = screen.getByTestId('composer-custom-agent-select') as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'Codex' } })
    expect(onCustomAgentChange).toHaveBeenCalledWith('Codex')

    // Rerender with new models for Codex
    rerender(
      <Composer
        selectedModel="auto"
        customAgent="Codex"
        customModels={['gpt-5.5-codex']}
        onSelectModel={onSelectModel}
        onCustomAgentChange={onCustomAgentChange}
      />
    )

    // Select model from newly provided agent models
    const modelSelect = screen.getByTestId('composer-custom-model-select') as HTMLSelectElement
    fireEvent.change(modelSelect, { target: { value: 'gpt-5.5-codex' } })
    expect(modelSelect.value).toBe('gpt-5.5-codex')

    // Click apply
    const applyBtn = screen.getByTestId('composer-apply-custom-model-btn')
    fireEvent.click(applyBtn)

    expect(onSelectModel).toHaveBeenCalledWith('gpt-5.5-codex')
    expect(screen.queryByTestId('model-selector-dropdown')).toBeNull()
  })

  it('manages file attachments and sends them alongside message', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<Composer onSend={onSend} />)

    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' })
    const fileInput = screen.getByTestId('composer-file-input') as HTMLInputElement

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Badge should appear
    expect(screen.getByText('test.txt')).not.toBeNull()

    // Send with attachment
    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Analyze this file' } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('composer-send-button'))
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('Analyze this file', [
      expect.objectContaining({ name: 'test.txt' }),
    ])

    // Attachments and text should be cleared upon successful send
    expect(screen.queryByText('test.txt')).toBeNull()
  })

  it('removes an attachment when clicking its remove button', () => {
    render(<Composer />)

    const file = new File(['content'], 'to-remove.ts', { type: 'text/typescript' })
    const fileInput = screen.getByTestId('composer-file-input') as HTMLInputElement

    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(screen.getByText('to-remove.ts')).not.toBeNull()

    const removeBtn = screen.getByTestId('remove-attachment-to-remove.ts')
    fireEvent.click(removeBtn)

    expect(screen.queryByText('to-remove.ts')).toBeNull()
  })

  it('forwards arrow keys to onKeyDown handler for shell navigation', () => {
    const onKeyDown = vi.fn()
    render(<Composer onKeyDown={onKeyDown} />)

    const textarea = screen.getByTestId('composer-input')
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    expect(onKeyDown).toHaveBeenCalledTimes(2)
  })

  it('preserves newly injected controlled draft and attachments if changed during async onSend', async () => {
    let resolveSend: () => void
    const pendingPromise = new Promise<void>((resolve) => {
      resolveSend = resolve
    })
    const onSend = vi.fn().mockReturnValue(pendingPromise)
    const onChange = vi.fn()

    const { rerender } = render(
      <Composer
        value="Draft A"
        onChange={onChange}
        onSend={onSend}
        attachments={[{ id: 'a1', name: 'draft-a.ts' }]}
      />
    )

    // Trigger send of Draft A
    const sendBtn = screen.getByTestId('composer-send-button')
    act(() => {
      fireEvent.click(sendBtn)
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('Draft A', [
      expect.objectContaining({ name: 'draft-a.ts' }),
    ])

    // Parent updates props to Draft B while Draft A is still being sent
    rerender(
      <Composer
        value="Draft B (Freshly Injected)"
        onChange={onChange}
        onSend={onSend}
        attachments={[{ id: 'b1', name: 'fresh-b.ts' }]}
      />
    )

    // Resolve send of Draft A
    await act(async () => {
      resolveSend!()
      await pendingPromise
    })

    // onChange should NOT have been called with '' for Draft B!
    expect(onChange).not.toHaveBeenCalledWith('')
    expect(screen.getByText('Draft B (Freshly Injected)')).not.toBeNull()
    expect(screen.getByText('fresh-b.ts')).not.toBeNull()
  })

  it('preserves explicitly user-chosen auto even when parent re-renders with new customModels array reference', () => {
    const onSelectModel = vi.fn()
    const customModelsInitial = ['model-a', 'model-b']

    const { rerender } = render(
      <Composer
        selectedModel="model-b"
        customModels={customModelsInitial}
        onSelectModel={onSelectModel}
      />
    )

    // Open model selector dropdown
    fireEvent.click(screen.getByTestId('composer-model-selector-btn'))
    // Switch to custom tab
    fireEvent.click(screen.getByTestId('model-tab-custom'))

    // User explicitly selects 'auto'
    const select = screen.getByTestId('composer-custom-model-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'auto' } })
    expect(select.value).toBe('auto')

    // Parent re-renders with a fresh array reference with identical or updated items
    rerender(
      <Composer
        selectedModel="model-b"
        customModels={['model-a', 'model-b']}
        onSelectModel={onSelectModel}
      />
    )

    // Selection must remain 'auto', not reset to 'model-b'
    expect(select.value).toBe('auto')

    // Click Apply
    fireEvent.click(screen.getByTestId('composer-apply-custom-model-btn'))
    expect(onSelectModel).toHaveBeenCalledWith('auto')
  })

  it('notifies onChange and onAttachmentsChange upon clearing uncontrolled input when sent successfully', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const onChange = vi.fn()
    const onAttachmentsChange = vi.fn()

    render(
      <Composer
        onChange={onChange}
        onAttachmentsChange={onAttachmentsChange}
        onSend={onSend}
      />
    )

    const textarea = screen.getByTestId('composer-input') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Draft message' } })
    expect(onChange).toHaveBeenLastCalledWith('Draft message')

    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByTestId('composer-file-input') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })
    expect(onAttachmentsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: 'report.pdf' }),
    ])

    // Send the message
    await act(async () => {
      fireEvent.click(screen.getByTestId('composer-send-button'))
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    // Both onChange and onAttachmentsChange must be notified of the cleared state
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(onAttachmentsChange).toHaveBeenLastCalledWith([])
    expect(textarea.value).toBe('')
    expect(screen.queryByText('report.pdf')).toBeNull()
  })

  it('notifies onChange and onAttachmentsChange exactly once in StrictMode without cross-component update warnings', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const onAttachmentsNotify = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // ParentObserver that holds state updated by callback, wrapped in StrictMode
    const ParentObserver: React.FC = () => {
      const [, setObservedAttachments] = React.useState<ComposerAttachment[]>([])

      return (
        <Composer
          onSend={onSend}
          onAttachmentsChange={(atts) => {
            onAttachmentsNotify(atts)
            setObservedAttachments(atts)
          }}
        />
      )
    }

    render(
      <React.StrictMode>
        <ParentObserver />
      </React.StrictMode>
    )

    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByTestId('composer-file-input') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(onAttachmentsNotify).toHaveBeenCalledTimes(1)
    expect(onAttachmentsNotify).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: 'report.pdf' }),
    ])

    // Send the message
    await act(async () => {
      fireEvent.click(screen.getByTestId('composer-send-button'))
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    // Must be called EXACTLY once with empty array upon clearing
    expect(onAttachmentsNotify).toHaveBeenCalledTimes(2)
    expect(onAttachmentsNotify).toHaveBeenLastCalledWith([])

    // Verify zero React warnings about updating during render
    const renderWarning = consoleErrorSpy.mock.calls.find((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes('Cannot update a component'))
    )
    expect(renderWarning).toBeUndefined()

    consoleErrorSpy.mockRestore()
  })

  it('MemoComposer export is genuinely wrapped in React.memo and references base component', () => {
    // Structural verification of the exported Memo component
    expect((MemoComposer as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.memo')
    )
    expect((MemoComposer as unknown as { type: unknown }).type).toBe(Composer)
  })
})
