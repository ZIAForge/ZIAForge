import { currentLocale, uiText } from '../../uiText'
import { useTranslation } from '../../i18n'
import { formatNumber, localeDirection, type TranslationValues } from '../../i18n-core'
import { useEffect, useRef, useState } from 'react'
import { Compartment, EditorState, StateEffect } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, drawSelection, rectangularSelection, highlightSpecialChars } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap, highlightSelectionMatches, closeSearchPanel, openSearchPanel, getSearchQuery, setSearchQuery } from '@codemirror/search'
import { bracketMatching, foldGutter, LanguageDescription } from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { ArrowLeft, ArrowRight, FolderOpen, RotateCw, Save, Search, X } from 'lucide-react'
import { EDITOR_DEFAULT_BYTES, EDITOR_WINDOW_BYTES, type EditorAPI, type EditorDocument, type EditorOpenRequest, type EditorScope } from '../../../shared/editor'

interface CachedEditor { document: EditorDocument; state?: EditorState; text: string; dirty: boolean; draftError?: string; persistedText?: string; mock?: boolean }
interface EditorNotice { source: string; values?: TranslationValues }
const cache = new Map<string, CachedEditor>()
const mounted = new Set<string>()
let unloadGuardInstalled = false
let lastDirtyNotice: boolean | undefined
let editorClosing = false
function keyFor(request: EditorOpenRequest): string { return JSON.stringify([request.repoId, request.taskId, request.scope, request.relativePath]) }
const api = () => window.ziafAPI as typeof window.ziafAPI & EditorAPI
const bytesLabel = (bytes: number) => {
  const divisor = bytes < 1024 ? 1 : bytes < 1024 * 1024 ? 1024 : 1024 * 1024
  return `${formatNumber(currentLocale(), bytes / divisor, { minimumFractionDigits: divisor === 1 ? 0 : 1, maximumFractionDigits: divisor === 1 ? 0 : 1 })} ${divisor === 1 ? 'B' : divisor === 1024 ? 'KiB' : 'MiB'}`
}
const shortcut = (key: string) => `${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'}${key}`
const searchPhrases = (locale: string) => Object.fromEntries([
  ['Find', uiText('Find', undefined, locale)], ['Replace', uiText('Replace', undefined, locale)],
  ['next', uiText('Next match', undefined, locale)], ['previous', uiText('Previous match', undefined, locale)],
  ['all', uiText('Select all matches', undefined, locale)], ['match case', uiText('Match case', undefined, locale)],
  ['regexp', uiText('Regular expression', undefined, locale)], ['by word', uiText('Whole words', undefined, locale)],
  ['replace', uiText('Replace', undefined, locale)], ['replace all', uiText('Replace all', undefined, locale)],
  ['close', uiText('Close search', undefined, locale)], ['Go to line', uiText('Go to line', undefined, locale)],
  ['go', uiText('Go', undefined, locale)], ['current match', uiText('Current match', undefined, locale)],
  ['on line', uiText('On line', undefined, locale)],
  ['replaced match on line $', uiText('Replaced the match on line {line}', { line: '$' }, locale)],
  ['replaced $ matches', uiText('Replaced matches: {count}', { count: '$' }, locale)],
  ['Folded lines', uiText('Folded lines', undefined, locale)], ['Unfolded lines', uiText('Unfolded lines', undefined, locale)],
  ['to', uiText('To', undefined, locale)], ['folded code', uiText('Folded code', undefined, locale)],
  ['unfold', uiText('Unfold', undefined, locale)], ['Fold line', uiText('Fold line', undefined, locale)],
  ['Unfold line', uiText('Unfold line', undefined, locale)], ['Completions', uiText('Completions', undefined, locale)],
  ['Control character', uiText('Control character', undefined, locale)]
])
const localizedEditor = (locale: string, relativePath: string) => [
  EditorState.phrases.of(searchPhrases(locale)),
  EditorView.contentAttributes.of({ 'aria-label': uiText('Editor: {path}', { path: relativePath }, locale), dir: 'ltr', spellcheck: 'false' }),
  EditorView.theme({ '.cm-panel': { direction: localeDirection(locale) } })
]
const button = 'rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-default'
function notifyDirtyState() {
  if ((window as Window & { ziafRemote?: boolean }).ziafRemote || typeof api().editorDirtyState !== 'function') return
  const dirty = [...cache.values()].some(item => item.dirty && !item.mock)
  if (lastDirtyNotice === dirty) return
  lastDirtyNotice = dirty
  void api().editorDirtyState({ dirty }).catch(() => { if (lastDirtyNotice === dirty) lastDirtyNotice = undefined })
}
function trimCache() {
  let estimate = [...cache.values()].reduce((sum, item) => sum + item.text.length * 4, 0)
  for (const [key, item] of cache) {
    if (estimate <= 128 * 1024 * 1024 && cache.size <= 16) break
    if (mounted.has(key) || (item.dirty && item.persistedText !== item.text)) continue
    estimate -= item.text.length * 4; cache.delete(key)
    if (!item.mock) void api().editorClose({ id: item.document.id }).catch(() => undefined)
  }
  notifyDirtyState()
}
async function persistDraft(item: CachedEditor) {
  if (item.mock) return
  if (!item.dirty) {
    if (item.persistedText !== undefined) { await api().editorStoreDraft({ id: item.document.id, discard: true }); item.persistedText = undefined }
    return
  }
  const text = item.text
  await api().editorStoreDraft({ id: item.document.id, document: item.document, text })
  item.persistedText = text; item.draftError = undefined; trimCache()
}
function installUnloadGuard() {
  if (unloadGuardInstalled) return
  unloadGuardInstalled = true
  if (typeof api().editorOnClosing === 'function') api().editorOnClosing(() => { editorClosing = true })
  notifyDirtyState()
  // Retry a failed notice even while a chat is selected and every editor is unmounted.
  window.setInterval(notifyDirtyState, 1000)
  // Remains installed while an ordinary chat is selected, including closed file tabs.
  window.addEventListener('beforeunload', event => {
    notifyDirtyState()
    const dirty = [...cache.values()].filter(item => item.dirty && !item.mock)
    if (!dirty.length) return
    for (const item of dirty) void persistDraft(item).catch(() => undefined)
    event.preventDefault(); event.returnValue = ''
  })
}

export function FolderActions({ scope }: { scope: EditorScope }) {
  useTranslation()
  const [error, setError] = useState('')
  const open = (target: EditorScope) => { setError(''); void api().editorReveal(target).catch(e => setError(String(e.message ?? e))) }
  return <div className="flex flex-wrap items-center gap-1" data-testid="file-folder-actions">
    {scope.taskId && <button className={button} onClick={() => open({ ...scope, scope: 'task' })} title={uiText("Show the current task folder in the file manager")}><FolderOpen size={13} className="inline mr-1" />{uiText("Task folder")}</button>}
    <button className={button} onClick={() => open({ repoId: scope.repoId, scope: 'project' })} title={uiText("Show the project folder in the file manager")}><FolderOpen size={13} className="inline mr-1" />{uiText("Project")}</button>
    {error && <span role="alert" className="text-xs text-red-300">{error}</span>}
  </div>
}

/** CM6 renders only its viewport. A large file's fragment is a byte window, not a truncated full document. */
export function FileEditor({ request, mockText, onMockSave }: { request: EditorOpenRequest; mockText?: string; onMockSave?: (text: string) => void }) {
  const { language: uiLocale } = useTranslation()
  const cacheKey = keyFor(request)
  const [entry, setEntry] = useState<CachedEditor | undefined>(() => cache.get(cacheKey))
  const [error, setError] = useState(''); const [notice, setNotice] = useState<EditorNotice>(); const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(entry?.dirty ?? false)
  const [language, setLanguage] = useState('Plain text'); const [wrap, setWrap] = useState(false)
  const [offset, setOffset] = useState('0'); const [query, setQuery] = useState(''); const [searching, setSearching] = useState(false)
  const [position, setPosition] = useState({ line: 1, column: 1 })
  const host = useRef<HTMLDivElement>(null); const view = useRef<EditorView>(); const alive = useRef(true)
  const entryRef = useRef(entry); entryRef.current = entry
  const persistTimer = useRef<ReturnType<typeof setTimeout>>()
  const searchGeneration = useRef(0); const saveRef = useRef<() => void>(() => undefined)
  const wrapCompartment = useRef(new Compartment())
  const editingCompartment = useRef(new Compartment())
  const localeCompartment = useRef(new Compartment())
  const isMock = mockText !== undefined

  const persist = async (item: CachedEditor) => {
    if (isMock) return
    try { await persistDraft(item) }
    catch (e) { item.draftError = uiText('Draft could not be saved: {error}', { error: String((e as Error).message ?? e) }); if (alive.current) setError(item.draftError) }
  }
  useEffect(() => {
    alive.current = true
    mounted.add(cacheKey); if (!isMock) installUnloadGuard()
    if (entryRef.current) return () => { alive.current = false; mounted.delete(cacheKey) }
    let cancelled = false
    async function open() {
      let openedId: string | undefined
      try {
        const document: EditorDocument = isMock ? { id: cacheKey, relativePath: request.relativePath, text: mockText!, size: mockText!.length, version: 'mock', encoding: 'utf8', bom: false, mode: 'full', start: 0, end: mockText!.length, canLoadFull: true, lineEnding: 'LF' } : await api().editorOpen(request)
        if (!isMock) openedId = document.id
        const draft = isMock ? null : await api().editorLoadDraft(request)
        if (cancelled) { if (!isMock) void api().editorClose({ id: document.id }); return }
        // Recover the original version/range. A stale draft must conflict on Save, not overwrite new disk bytes.
        const item: CachedEditor = draft ? { document: { ...draft.document, id: document.id }, text: draft.text, dirty: true, persistedText: draft.text } : { document, text: document.text, dirty: false, mock: isMock }
        if (draft) {
          // Align the backend's current range; the draft's version remains unchanged for conflict detection.
          if (draft.document.mode === 'window') await api().editorRead({ id: document.id, offset: draft.document.start })
          else if (document.mode !== 'full' && document.canLoadFull) await api().editorRead({ id: document.id, full: true })
          if (cancelled) { void api().editorClose({ id: document.id }); return }
          setNotice({ source: 'Unsaved draft restored. The original file version is checked before saving.' })
        }
        cache.set(cacheKey, item); entryRef.current = item; setEntry(item); setDirty(item.dirty); setOffset(String(item.document.start)); trimCache()
      } catch (e) {
        if (openedId) void api().editorClose({ id: openedId }).catch(() => undefined)
        if (!cancelled) setError(String((e as Error).message ?? e))
      }
    }
    void open()
    return () => { cancelled = true; alive.current = false; mounted.delete(cacheKey) }
    // Identity changes remount the editor; opening once keeps undo and drafts across tab selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  useEffect(() => {
    if (!host.current || !entry || entry.document.mode === 'binary') return
    let cancelled = false
    const cancelPendingSearch = () => { searchGeneration.current++ }
    const lang = new Compartment()
    const fast = entry.document.size > EDITOR_DEFAULT_BYTES || entry.text.length > EDITOR_DEFAULT_BYTES
    const separator = entry.document.lineEnding === 'CRLF' ? '\r\n' : entry.document.lineEnding === 'CR' ? '\r' : '\n'
    const description = LanguageDescription.matchFilename(languages, request.relativePath)
    const extensions = [
      lineNumbers(), highlightActiveLineGutter(), drawSelection(), rectangularSelection(), history(), oneDark,
      EditorState.transactionFilter.of(transaction => editorClosing && transaction.docChanged ? [] : transaction),
      EditorState.lineSeparator.of(separator),
      localeCompartment.current.of(localizedEditor(uiLocale, request.relativePath)),
      keymap.of([{ key: 'Mod-s', run: () => { saveRef.current(); return true } }, indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...closeBracketsKeymap]),
      search({ top: true }), lang.of([]), wrapCompartment.current.of(wrap ? EditorView.lineWrapping : []), editingCompartment.current.of([]),
      ...(fast ? [] : [highlightSpecialChars(), bracketMatching(), foldGutter(), closeBrackets(), autocompletion(), highlightSelectionMatches()]),
      EditorView.theme({ '&': { height: '100%', fontSize: '13px' }, '.cm-scroller': { overflow: 'auto', direction: 'ltr', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }, '.cm-content': { minHeight: '100%' }, '.cm-gutters': { minHeight: '100%' } }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          entry.text = update.state.sliceDoc(); entry.dirty = entry.text !== entry.document.text; cache.set(cacheKey, entry)
          notifyDirtyState()
          setDirty(entry.dirty); setNotice(undefined)
          clearTimeout(persistTimer.current); persistTimer.current = setTimeout(() => { void persist(entry) }, 800)
        }
        if (update.selectionSet || update.docChanged) {
          const cursor = update.state.selection.main.head; const line = update.state.doc.lineAt(cursor)
          setPosition({ line: line.number, column: cursor - line.from + 1 })
        }
      })
    ]
    // Cached doc/selection/history are preserved; callbacks belong to this mounted editor.
    const state = entry.state ? entry.state.update({ effects: StateEffect.reconfigure.of(extensions) }).state : EditorState.create({ doc: entry.text, extensions })
    const editor = new EditorView({ state, parent: host.current }); view.current = editor
    setLanguage(fast ? 'Large file · highlighting disabled' : description?.name ?? 'Plain text')
    if (!fast && description) void description.load().then(support => { if (!cancelled) editor.dispatch({ effects: lang.reconfigure(support) }) }).catch(() => { if (!cancelled) setLanguage('Plain text · language module unavailable') })
    return () => { cancelled = true; entry.state = editor.state; clearTimeout(persistTimer.current); void persist(entry); editor.destroy(); view.current = undefined; cancelPendingSearch() }
    // Entry identity changes only on open/reload/save/window navigation; ordinary typing stays inside CM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, cacheKey])

  useEffect(() => { view.current?.dispatch({ effects: wrapCompartment.current.reconfigure(wrap ? EditorView.lineWrapping : []) }) }, [wrap])
  useEffect(() => {
    const editor = view.current
    if (!editor) return
    const active = document.activeElement
    const field = active instanceof HTMLInputElement && editor.dom.contains(active) ? { name: active.name, start: active.selectionStart, end: active.selectionEnd } : undefined
    const hadEditorFocus = editor.hasFocus
    const hadSearchPanel = !!editor.dom.querySelector('.cm-search')
    const searchQuery = hadSearchPanel ? getSearchQuery(editor.state) : undefined
    // Reconfigure only locale facets: the document, undo history, selection and draft stay intact.
    editor.dispatch({ effects: localeCompartment.current.reconfigure(localizedEditor(uiLocale, request.relativePath)) })
    if (hadSearchPanel) {
      closeSearchPanel(editor); openSearchPanel(editor)
      // Opening a panel seeds its query from the document selection. A locale
      // refresh must preserve the user's current query and replacement instead.
      if (searchQuery) editor.dispatch({ effects: setSearchQuery.of(searchQuery) })
      const input = field && Array.from(editor.dom.querySelectorAll<HTMLInputElement>('.cm-search input')).find(item => item.name === field.name)
      if (input && field) { input.focus(); if (field.start !== null && field.end !== null && input.type !== 'checkbox') input.setSelectionRange(field.start, field.end) }
      else if (hadEditorFocus) editor.focus()
      else if (active instanceof HTMLElement) active.focus()
    }
  }, [uiLocale, request.relativePath])
  const accept = (document: EditorDocument) => {
    const item = { document, text: document.text, dirty: false, mock: isMock, state: view.current?.state.sliceDoc() === document.text ? view.current.state : undefined }
    cache.set(cacheKey, item); entryRef.current = item; setEntry(item); setDirty(false); setOffset(String(document.start))
    notifyDirtyState()
  }
  const save = async () => {
    const current = entryRef.current
    if (!current || !current.dirty || busy) return
    setBusy(true); setError('')
    view.current?.dispatch({ effects: editingCompartment.current.reconfigure([EditorState.readOnly.of(true), EditorView.editable.of(false)]) })
    try {
      if (isMock) { onMockSave?.(current.text); accept({ ...current.document, text: current.text }); setNotice({ source: 'Saved' }); return }
      await persist(current)
      const sentText = current.text
      const result = await api().editorSave({ id: current.document.id, version: current.document.version, start: current.document.start, end: current.document.end, text: sentText })
      if (result.status === 'conflict') { setError(result.message); return }
      const changedDuringSave = current.text !== sentText
      current.dirty = false; current.persistedText = undefined // Old view cleanup must not restore the pre-save draft.
      if (changedDuringSave) {
        const item = { document: { ...result.document, text: sentText }, text: current.text, dirty: true }
        cache.set(cacheKey, item); entryRef.current = item; setEntry(item); setDirty(true); await persist(item)
        notifyDirtyState()
        setNotice({ source: 'The submitted version was saved. Newer changes remain in the editor and draft.' })
      } else { accept(result.document); setNotice({ source: 'Saved. Previous version: {path}', values: { path: result.document.backupPath ?? '—' } }) }
    } catch (e) { setError(String((e as Error).message ?? e)) } finally { setBusy(false); view.current?.dispatch({ effects: editingCompartment.current.reconfigure([]) }) }
  }
  saveRef.current = () => { void save() }
  const load = async (nextOffset = 0, full = false) => {
    if (!entry || busy) return
    if (entry.dirty && !window.confirm(uiText('Reload the file and discard unsaved changes in this fragment? Save or copy the text you need first.'))) return
    setBusy(true); setError(''); searchGeneration.current++
    view.current?.dispatch({ effects: editingCompartment.current.reconfigure([EditorState.readOnly.of(true), EditorView.editable.of(false)]) })
    try {
      const document = await api().editorRead({ id: entry.document.id, offset: nextOffset, full })
      await api().editorStoreDraft({ id: entry.document.id, discard: true })
      entry.dirty = false; entry.persistedText = undefined; accept(document); setNotice(undefined)
    } catch (e) { setError(String((e as Error).message ?? e)) } finally { setBusy(false); view.current?.dispatch({ effects: editingCompartment.current.reconfigure([]) }) }
  }
  const find = async () => {
    if (!entry || !query || searching) return
    if (entry.dirty) { setError(uiText('Save your changes before searching the file on disk. Use {shortcut} to search this fragment.', { shortcut: shortcut('F') })); return }
    const generation = ++searchGeneration.current; setSearching(true); setError('')
    let nextOffset = entry.document.start
    try {
      for (;;) {
        const found = await api().editorSearch({ id: entry.document.id, version: entry.document.version, query, offset: nextOffset })
        if (generation !== searchGeneration.current) return
        if (found.offset !== undefined) { await load(found.offset); setNotice({ source: 'Found at byte offset {offset}', values: { offset: found.offset } }); return }
        if (found.done) { setNotice({ source: 'No matches before the end of the file' }); return }
        nextOffset = found.nextOffset; setNotice({ source: 'Searching: {searched} / {size}', values: { searched: bytesLabel(nextOffset), size: bytesLabel(entry.document.size) } })
      }
    } catch (e) { if (generation === searchGeneration.current) setError(String((e as Error).message ?? e)) }
    finally { if (alive.current) setSearching(false) }
  }
  return <section className="flex min-h-0 flex-1 flex-col h-full bg-[#0c0d0e] text-zinc-300" data-testid="file-editor">
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-2 shrink-0">
      <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-xs" title={request.relativePath}>{request.relativePath}{dirty ? ' ●' : ''}</span>
      <button className={button} disabled={isMock} title={uiText('Show this file in its parent folder')} aria-label={uiText('Show this file in its parent folder')} onClick={() => { void api().editorReveal(request).catch(e => setError(String(e.message ?? e))) }}><FolderOpen size={14} /></button>
      <button className={button} disabled={!entry || busy || isMock} onClick={() => { void load(entry?.document.start, entry?.document.mode === 'full') }} title={uiText("Reload from disk")} aria-label={uiText('Reload from disk')}><RotateCw size={14} /></button>
      <label className="text-xs"><input type="checkbox" checked={wrap} onChange={e => setWrap(e.target.checked)} /> {uiText("Wrap lines")}</label>
      <button className={button} disabled={!dirty || busy || entry?.document.mode === 'binary'} onClick={() => { void save() }} data-testid="editor-save"><Save size={13} className="inline mr-1" />{busy ? uiText('Please wait…') : uiText('Save {shortcut}', { shortcut: shortcut('S') })}</button>
    </div>
    {entry?.document.mode === 'window' && <div className="border-b border-zinc-800 p-2 space-y-2 text-xs shrink-0" data-testid="editor-large-controls">
      <p>{uiText('Large file: {size}. Editing bytes {start}–{end}; saving streams the remaining bytes without loading the entire file.', { size: bytesLabel(entry.document.size), start: entry.document.start, end: entry.document.end })}</p>
      <div className="flex flex-wrap gap-1 items-center">
        <button className={button} disabled={busy || entry.document.start === 0} onClick={() => { void load(Math.max(0, entry.document.start - EDITOR_WINDOW_BYTES)) }} title={uiText("Previous fragment")} aria-label={uiText('Previous fragment')}><ArrowLeft size={13} /></button>
        <button className={button} disabled={busy || entry.document.end >= entry.document.size} onClick={() => { void load(entry.document.end) }} title={uiText("Next fragment")} aria-label={uiText('Next fragment')}><ArrowRight size={13} /></button>
        <input dir="ltr" aria-label={uiText("Byte offset")} className="w-32 bg-zinc-900 rounded px-2 py-1" inputMode="numeric" value={offset} onChange={e => setOffset(e.target.value)} />
        <button className={button} disabled={busy} onClick={() => { void load(Number(offset)) }}>{uiText("Go")}</button>
        {entry.document.canLoadFull && <button className={button} disabled={busy} onClick={() => { void load(0, true) }}>{uiText("Load the entire file for editing (up to 64 MiB)")}</button>}
      </div>
      <div className="flex gap-1"><input className="min-w-0 flex-1 rounded bg-zinc-900 px-2 py-1" aria-label={uiText("Search the entire file")} placeholder={uiText('Exact text, from the current byte offset to the end')} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void find() }} /><button className={button} disabled={!query || searching} onClick={() => { void find() }} aria-label={uiText('Search the entire file')}><Search size={13} /></button>{searching && <button className={button} onClick={() => { searchGeneration.current++; setSearching(false) }} aria-label={uiText("Stop search")}><X size={13} /></button>}</div>
    </div>}
    {error && <div role="alert" className="p-2 text-xs text-red-300 bg-red-950/30 break-words">{error} {entry?.dirty && <button className={button} onClick={() => { void navigator.clipboard.writeText(entry.text).then(() => setNotice({ source: 'Your text was copied' }), e => setError(String(e))) }}>{uiText("Copy my text")}</button>}</div>}
    {notice && <p role="status" className="p-2 text-xs text-emerald-300 break-all">{uiText(notice.source, notice.values)}</p>}
    {!entry && !error && <p className="p-4 text-sm">{uiText("Opening file…")}</p>}
    {entry?.document.mode === 'binary' ? <p className="p-4 text-sm">{entry.document.warning ?? uiText('Binary file. Text editing is disabled to preserve the original bytes.')}</p> : <div ref={host} className="min-h-0 flex-1 overflow-hidden" />}
    {entry && <footer className="flex flex-wrap gap-4 border-t border-zinc-800 px-3 py-1 text-[11px] text-zinc-500 shrink-0"><span>{uiText(language)}</span><span dir="ltr">{entry.document.encoding.toUpperCase()}{entry.document.bom ? ' BOM' : ''} · {entry.document.lineEnding}</span><span>{bytesLabel(entry.document.size)}</span><span>{uiText('Line {line}, column {column}', { line: position.line, column: position.column })}{entry.document.mode === 'window' ? ` ${uiText('(within this fragment)')}` : ''}</span><span>{dirty ? uiText('Unsaved · draft is stored locally') : uiText('Saved')} · {uiText('Find: {shortcut} · Replace in the search panel', { shortcut: shortcut('F') })}</span></footer>}
  </section>
}
