export const EDITOR_WINDOW_BYTES = 256 * 1024
export const EDITOR_DEFAULT_BYTES = 8 * 1024 * 1024
export const EDITOR_FULL_BYTES = 64 * 1024 * 1024
export interface EditorScope { repoId: string; taskId?: string; scope: 'task' | 'project' }
export interface EditorOpenRequest extends EditorScope { relativePath: string; full?: boolean }
export type EditorEncoding = 'utf8' | 'utf16le' | 'utf16be' | 'binary'
export interface EditorDocument {
  id: string; relativePath: string; size: number; version: string; encoding: EditorEncoding
  bom: boolean; mode: 'full' | 'window' | 'binary'; text: string
  start: number; end: number; canLoadFull: boolean; lineEnding: 'LF' | 'CRLF' | 'CR' | 'mixed'
  warning?: string; backupPath?: string
}
export interface EditorReadRequest { id: string; offset?: number; full?: boolean }
export interface EditorSaveRequest { id: string; version: string; start: number; end: number; text: string }
export type EditorSaveResult = { status: 'saved'; document: EditorDocument } | { status: 'conflict'; message: string }
export interface EditorSearchRequest { id: string; version: string; query: string; offset: number }
export interface EditorSearchResult { offset?: number; nextOffset: number; done: boolean }
export interface EditorDraft { document: EditorDocument; text: string; updatedAt: number }
export interface EditorAPI {
  /** Desktop renderer notice used before Quit begins shutting down services. */
  editorDirtyState(request: { dirty: boolean }): Promise<void>
  editorOnClosing(callback: () => void): () => void
  editorCreate(request: EditorOpenRequest & { text?: string }): Promise<EditorDocument>
  editorOpen(request: EditorOpenRequest): Promise<EditorDocument>
  editorRead(request: EditorReadRequest): Promise<EditorDocument>
  editorSave(request: EditorSaveRequest): Promise<EditorSaveResult>
  editorSearch(request: EditorSearchRequest): Promise<EditorSearchResult>
  editorClose(request: { id: string }): Promise<void>
  editorLoadDraft(request: EditorOpenRequest): Promise<EditorDraft | null>
  editorStoreDraft(request: { id: string; document: EditorDocument; text: string } | { id: string; discard: true }): Promise<void>
  editorReveal(request: EditorScope & { relativePath?: string }): Promise<void>
}
