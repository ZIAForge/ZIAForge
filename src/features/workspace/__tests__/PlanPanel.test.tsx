/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import { PlanPanel, MemoPlanPanel } from '../PlanPanel'
import { EditStepModal, MemoEditStepModal } from '../EditStepModal'
import { useStore } from '../../../store'
import type { TodoStep, Settings } from '../../../store'

describe('PlanPanel and EditStepModal Components', () => {
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

  const sampleSteps: TodoStep[] = [
    { id: 's1', text: 'Scaffold feature files', done: true, description: 'Created initial layout' },
    { id: 's2', text: 'Implement PlanPanel logic', done: false, active: true },
    { id: 's3', text: 'Write integration tests', done: false },
  ]

  it('renders empty state when no steps provided', () => {
    render(<PlanPanel todoSteps={[]} />)

    expect(screen.getByTestId('plan-panel')).not.toBeNull()
    expect(screen.getByText(/Нет шагов в плане|No tasks/i)).not.toBeNull()
    expect(screen.getByTestId('plan-progress-counter').textContent).toBe('0/0')
  })

  it('renders steps with correct status indicators and progress counter', () => {
    render(<PlanPanel todoSteps={sampleSteps} />)

    expect(screen.getByTestId('plan-progress-counter').textContent).toBe('1/3')

    // Step 1: done
    expect(screen.getByTestId('todo-step-s1')).not.toBeNull()
    expect(screen.getByText('Scaffold feature files')).not.toBeNull()

    // Step 2: active with spinner
    expect(screen.getByTestId('todo-active-spinner-s2')).not.toBeNull()
    expect(screen.getByText('Implement PlanPanel logic')).not.toBeNull()

    // Step 3: pending
    expect(screen.getByTestId('todo-step-s3')).not.toBeNull()
    expect(screen.getByText('Write integration tests')).not.toBeNull()
  })

  it('calls onToggleStep when checkbox is clicked', () => {
    const onToggleStep = vi.fn()
    render(<PlanPanel todoSteps={sampleSteps} onToggleStep={onToggleStep} />)

    const checkbox = screen.getByTestId('todo-checkbox-s2')
    fireEvent.click(checkbox)

    expect(onToggleStep).toHaveBeenCalledTimes(1)
    expect(onToggleStep).toHaveBeenCalledWith('s2')
  })

  it('submits new step and resets input field', () => {
    const onAddStep = vi.fn()
    render(<PlanPanel todoSteps={sampleSteps} onAddStep={onAddStep} />)

    const input = screen.getByTestId('plan-add-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Run e2e verification' } })
    expect(input.value).toBe('Run e2e verification')

    fireEvent.click(screen.getByTestId('plan-add-button'))

    expect(onAddStep).toHaveBeenCalledTimes(1)
    expect(onAddStep).toHaveBeenCalledWith('Run e2e verification')
    expect(input.value).toBe('')
  })

  it('does not submit empty step', () => {
    const onAddStep = vi.fn()
    render(<PlanPanel todoSteps={sampleSteps} onAddStep={onAddStep} />)

    const input = screen.getByTestId('plan-add-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })

    fireEvent.click(screen.getByTestId('plan-add-button'))
    expect(onAddStep).not.toHaveBeenCalled()
  })

  it('triggers onToggleAutoStart and onOpenStructuredPlan and onClose', () => {
    const onToggleAutoStart = vi.fn()
    const onOpenStructuredPlan = vi.fn()
    const onClose = vi.fn()

    render(
      <PlanPanel
        todoSteps={sampleSteps}
        autoStartEnabled={false}
        onToggleAutoStart={onToggleAutoStart}
        onOpenStructuredPlan={onOpenStructuredPlan}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByTestId('plan-autostart-toggle'))
    expect(onToggleAutoStart).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByTestId('plan-structured-link'))
    expect(onOpenStructuredPlan).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('plan-panel-close-btn'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens edit modal, saves modifications, and calls onUpdateStep', () => {
    const onUpdateStep = vi.fn()
    const onSelectStep = vi.fn()

    render(
      <PlanPanel
        todoSteps={sampleSteps}
        onUpdateStep={onUpdateStep}
        onSelectStep={onSelectStep}
      />
    )

    // Open modal by clicking step text
    fireEvent.click(screen.getByTestId('todo-text-s2'))
    expect(onSelectStep).toHaveBeenCalledWith(sampleSteps[1])
    expect(screen.getByTestId('edit-step-modal')).not.toBeNull()

    // Modify step name and description
    const nameInput = screen.getByTestId('edit-step-name-input') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Updated Step 2 Title' } })

    const descTextarea = screen.getByTestId('edit-step-desc-textarea') as HTMLTextAreaElement
    fireEvent.change(descTextarea, { target: { value: 'New detailed notes' } })

    // Checkboxes
    const newChatCheck = screen.getByTestId('edit-step-new-chat-checkbox') as HTMLInputElement
    fireEvent.click(newChatCheck)
    expect(newChatCheck.checked).toBe(true)

    const stopCheck = screen.getByTestId('edit-step-stop-checkbox') as HTMLInputElement
    fireEvent.click(stopCheck)
    expect(stopCheck.checked).toBe(true)

    // Select preset
    fireEvent.click(screen.getByTestId('edit-step-preset-btn'))
    fireEvent.click(screen.getByTestId('preset-opt-Claude Code Pro'))

    // Save
    fireEvent.click(screen.getByTestId('edit-step-save-btn'))

    expect(onUpdateStep).toHaveBeenCalledWith('s2', {
      text: 'Updated Step 2 Title',
      description: 'New detailed notes',
      preset: 'Claude Code Pro',
      startNewChat: true,
      stopAfterCompletion: true,
    })

    // Modal should close
    expect(screen.queryByTestId('edit-step-modal')).toBeNull()
  })

  it('deletes step from inside edit modal', () => {
    const onDeleteStep = vi.fn()
    render(<PlanPanel todoSteps={sampleSteps} onDeleteStep={onDeleteStep} />)

    // Open step 3
    fireEvent.click(screen.getByTestId('todo-chevron-s3'))
    expect(screen.getByTestId('edit-step-modal')).not.toBeNull()

    // Click delete
    fireEvent.click(screen.getByTestId('edit-step-delete-btn'))
    expect(onDeleteStep).toHaveBeenCalledWith('s3')
    expect(screen.queryByTestId('edit-step-modal')).toBeNull()
  })

  it('cancels edit modal without saving', () => {
    const onUpdateStep = vi.fn()
    render(<PlanPanel todoSteps={sampleSteps} onUpdateStep={onUpdateStep} />)

    fireEvent.click(screen.getByTestId('todo-text-s1'))
    expect(screen.getByTestId('edit-step-modal')).not.toBeNull()

    fireEvent.click(screen.getByTestId('edit-step-cancel-btn'))
    expect(onUpdateStep).not.toHaveBeenCalled()
    expect(screen.queryByTestId('edit-step-modal')).toBeNull()
  })

  it('EditStepModal standalone tests', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    const step: TodoStep = {
      id: 'step-edit',
      text: 'Original Task',
      done: false,
    }

    const { rerender } = render(
      <EditStepModal step={step} onSave={onSave} onClose={onClose} />
    )

    fireEvent.click(screen.getByTestId('edit-step-close-btn'))
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<EditStepModal step={step} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('edit-step-save-btn'))
    expect(onSave).toHaveBeenCalledWith({
      text: 'Original Task',
      description: undefined,
      preset: 'Default Coder',
      startNewChat: false,
      stopAfterCompletion: false,
    })
  })

  it('resets editingStep when taskId changes', () => {
    const { rerender } = render(
      <PlanPanel taskId="task-1" todoSteps={sampleSteps} />
    )

    // Open step s2 modal
    fireEvent.click(screen.getByTestId('todo-text-s2'))
    expect(screen.getByTestId('edit-step-modal')).not.toBeNull()

    // Switch task
    rerender(<PlanPanel taskId="task-2" todoSteps={sampleSteps} />)

    // Modal should be closed automatically
    expect(screen.queryByTestId('edit-step-modal')).toBeNull()
  })

  it('supports controlled newStepText and onNewStepTextChange draft', () => {
    const onDraftChange = vi.fn()
    const { rerender } = render(
      <PlanPanel
        todoSteps={sampleSteps}
        newStepText="Preserved Draft"
        onNewStepTextChange={onDraftChange}
      />
    )

    const input = screen.getByTestId('plan-add-input') as HTMLInputElement
    expect(input.value).toBe('Preserved Draft')

    fireEvent.change(input, { target: { value: 'Updated Draft' } })
    expect(onDraftChange).toHaveBeenCalledWith('Updated Draft')

    rerender(
      <PlanPanel
        todoSteps={sampleSteps}
        newStepText="Updated Draft"
        onNewStepTextChange={onDraftChange}
      />
    )
    expect((screen.getByTestId('plan-add-input') as HTMLInputElement).value).toBe('Updated Draft')
  })

  it('passes taskId to onUpdateStep and onDeleteStep when editing', () => {
    const onUpdateStep = vi.fn()
    const onDeleteStep = vi.fn()

    const { rerender } = render(
      <PlanPanel
        taskId="task-abc"
        todoSteps={sampleSteps}
        onUpdateStep={onUpdateStep}
        onDeleteStep={onDeleteStep}
      />
    )

    // Open modal
    fireEvent.click(screen.getByTestId('todo-text-s1'))
    expect(screen.getByTestId('edit-step-modal')).not.toBeNull()

    // Save
    fireEvent.click(screen.getByTestId('edit-step-save-btn'))
    expect(onUpdateStep).toHaveBeenCalledTimes(1)
    expect(onUpdateStep).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ text: 'Scaffold feature files' }),
      'task-abc'
    )

    // Open and delete
    rerender(
      <PlanPanel
        taskId="task-abc"
        todoSteps={sampleSteps}
        onUpdateStep={onUpdateStep}
        onDeleteStep={onDeleteStep}
      />
    )
    fireEvent.click(screen.getByTestId('todo-text-s1'))
    fireEvent.click(screen.getByTestId('edit-step-delete-btn'))
    expect(onDeleteStep).toHaveBeenCalledTimes(1)
    expect(onDeleteStep).toHaveBeenCalledWith('s1', 'task-abc')
  })

  it('Memo exports are genuinely wrapped in React.memo', () => {
    expect((MemoPlanPanel as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.memo')
    )
    expect((MemoPlanPanel as unknown as { type: unknown }).type).toBe(PlanPanel)

    expect((MemoEditStepModal as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.memo')
    )
    expect((MemoEditStepModal as unknown as { type: unknown }).type).toBe(EditStepModal)
  })
})
