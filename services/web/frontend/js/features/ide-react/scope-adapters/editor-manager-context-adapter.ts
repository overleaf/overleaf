import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import customLocalStorage from '@/infrastructure/local-storage'

export function populateEditorScope(
  store: ReactScopeValueStore,
  projectId: string
) {
  // This value is not used in the React code. It's just here to prevent errors
  // from EditorProvider
  store.set('state.loading', false)

  store.set('project.name', null)

  store.set('editor', {
    showSymbolPalette: false,
    toggleSymbolPalette: () => {},
    sharejs_doc: null,
    open_doc_id: null,
    open_doc_name: null,
    opening: true,
    trackChanges: false,
    wantTrackChanges: false,
    // No Ace here
    newSourceEditor: true,
    error_state: false,
  })
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
