import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import customLocalStorage from '@/infrastructure/local-storage'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'

export type EditorScopeValue = {
  showSymbolPalette: false
  toggleSymbolPalette: () => void
  sharejs_doc: DocumentContainer | null
  open_doc_id: string | null
  open_doc_name: string | null
  opening: boolean
  trackChanges: boolean
  wantTrackChanges: boolean
  showVisual: boolean
  error_state: boolean
}

export function populateEditorScope(
  store: ReactScopeValueStore,
  projectId: string
) {
  store.set('project.name', null)

  const editor: Omit<EditorScopeValue, 'showVisual'> = {
    showSymbolPalette: false,
    toggleSymbolPalette: () => {},
    sharejs_doc: null,
    open_doc_id: null,
    open_doc_name: null,
    opening: true,
    trackChanges: false,
    wantTrackChanges: false,
    error_state: false,
  }
  store.set('editor', editor)

  store.persisted(
    'editor.showVisual',
    showVisualFallbackValue(projectId),
    `editor.lastUsedMode`,
    {
      toPersisted: showVisual => (showVisual ? 'visual' : 'code'),
      fromPersisted: mode => mode === 'visual',
    }
  )
}

function showVisualFallbackValue(projectId: string) {
  const editorModeKey = `editor.mode.${projectId}`
  const editorModeVal = customLocalStorage.getItem(editorModeKey)

  if (editorModeVal) {
    // clean up the old key
    customLocalStorage.removeItem(editorModeKey)
  }

  return editorModeVal === 'rich-text'
}
