/** @vitest-environment happy-dom */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import { undo, undoDepth } from '@codemirror/commands'
import { getSearchQuery, openSearchPanel, SearchQuery, setSearchQuery } from '@codemirror/search'
import { FileEditor } from '../FileEditor'
import { useStore } from '../../../store'
import { uiText } from '../../../uiText'
import type { EditorDocument, EditorOpenRequest } from '../../../../shared/editor'

const originalStore = useStore.getState()
const originalApi = Object.getOwnPropertyDescriptor(window, 'ziafAPI')
let selectionChangeTimer: ReturnType<typeof setTimeout> | undefined

afterEach(() => {
  cleanup()
  clearTimeout(selectionChangeTimer)
  selectionChangeTimer = undefined
  useStore.setState(originalStore)
  if (originalApi) Object.defineProperty(window, 'ziafAPI', originalApi)
  else Reflect.deleteProperty(window, 'ziafAPI')
  vi.restoreAllMocks()
})

it('changes live editor and search labels without losing an unsaved draft, focus, selection or undo', async () => {
  // happy-dom dispatches selectionchange synchronously from Selection setters.
  // Browsers queue one document event, after CodeMirror's DOM update finishes.
  // Keep real selection/event handling, but model that scheduling in this test.
  const dispatch = document.dispatchEvent.bind(document)
  let deliveredSelectionChanges = 0
  vi.spyOn(document, 'dispatchEvent').mockImplementation(event => {
    if (event.type !== 'selectionchange') return dispatch(event)
    if (selectionChangeTimer === undefined) selectionChangeTimer = setTimeout(() => {
      selectionChangeTimer = undefined
      deliveredSelectionChanges += 1
      dispatch(new Event('selectionchange'))
    }, 0)
    return true
  })
  useStore.setState({ settings: { ...originalStore.settings!, uiLanguage: 'en' } })
  const request: EditorOpenRequest = { repoId: 'locale-editor-repo', taskId: 'locale-editor-task', scope: 'task', relativePath: 'draft.txt' }
  const disk: EditorDocument = { id: 'locale-editor-document', relativePath: request.relativePath, text: 'original\n', size: 9, version: 'disk-v1', encoding: 'utf8', bom: false, mode: 'full', start: 0, end: 9, canLoadFull: true, lineEnding: 'LF' }
  const restoredDraft = 'unsaved draft\n'
  const editorOpen = vi.fn().mockResolvedValue(disk)
  const editorLoadDraft = vi.fn().mockResolvedValue({ document: disk, text: restoredDraft, updatedAt: 1 })
  const editorSave = vi.fn()
  Object.defineProperty(window, 'ziafAPI', { configurable: true, value: {
    editorOpen, editorLoadDraft, editorSave,
    editorStoreDraft: vi.fn().mockResolvedValue(undefined),
    editorDirtyState: vi.fn().mockResolvedValue(undefined),
    editorClose: vi.fn().mockResolvedValue(undefined),
  } })

  render(<FileEditor request={request} />)
  const content = await screen.findByRole('textbox', { name: 'Editor: draft.txt' })
  await screen.findByText('Unsaved draft restored. The original file version is checked before saving.')
  const editor = EditorView.findFromDOM(content)!
  expect(editor.state.doc.toString()).toBe(restoredDraft)

  const editedDraft = `${restoredDraft}more text`
  act(() => {
    editor.focus()
    editor.dispatch({ changes: { from: editor.state.doc.length, insert: 'more text' }, selection: { anchor: 3, head: 8 }, userEvent: 'input' })
    openSearchPanel(editor)
    editor.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: 'draft', replace: 'replacement', caseSensitive: true, wholeWord: true })) })
  })
  const searchField = editor.dom.querySelector<HTMLInputElement>('.cm-search input[name="search"]')!
  searchField.focus()
  searchField.setSelectionRange(1, 4)
  await waitFor(() => expect(deliveredSelectionChanges).toBeGreaterThan(0))
  const documentSelection = editor.state.selection
  expect(undoDepth(editor.state)).toBe(1)
  expect(searchField.value).toBe('draft')
  expect(getSearchQuery(editor.state)).toMatchObject({ search: 'draft', replace: 'replacement', caseSensitive: true, wholeWord: true })

  // Use the real store notification and CodeMirror state, rather than a mocked editor.
  act(() => useStore.setState({ settings: { ...useStore.getState().settings!, uiLanguage: 'ru' } }))
  await waitFor(() => expect(editor.dom.querySelector('input[name="search"]')?.getAttribute('aria-label')).toBe('Найти'))
  const localizedSearch = editor.dom.querySelector<HTMLInputElement>('.cm-search input[name="search"]')!
  expect(localizedSearch).not.toBe(searchField) // Search panel labels are refreshed; the editor itself stays mounted.
  expect(document.activeElement).toBe(localizedSearch)
  expect([localizedSearch.selectionStart, localizedSearch.selectionEnd]).toEqual([1, 4])
  expect(localizedSearch.value).toBe('draft')
  expect(editor.dom.querySelector<HTMLInputElement>('input[name="replace"]')!.value).toBe('replacement')
  expect(getSearchQuery(editor.state)).toMatchObject({ search: 'draft', replace: 'replacement', caseSensitive: true, wholeWord: true })
  expect(EditorView.findFromDOM(screen.getByRole('textbox', { name: uiText('Editor: {path}', { path: request.relativePath }, 'ru') }))).toBe(editor)
  expect(editor.contentDOM.getAttribute('dir')).toBe('ltr')
  expect(editor.state.doc.toString()).toBe(editedDraft)
  expect(editor.state.selection.eq(documentSelection)).toBe(true)
  expect(undoDepth(editor.state)).toBe(1)
  expect(screen.getByTestId('editor-save').hasAttribute('disabled')).toBe(false)
  expect(editorOpen).toHaveBeenCalledTimes(1)
  expect(editorLoadDraft).toHaveBeenCalledTimes(1)
  expect(editorSave).not.toHaveBeenCalled()

  act(() => { expect(undo(editor)).toBe(true) })
  expect(editor.state.doc.toString()).toBe(restoredDraft)
  expect(screen.getByTestId('editor-save').hasAttribute('disabled')).toBe(false)
})
