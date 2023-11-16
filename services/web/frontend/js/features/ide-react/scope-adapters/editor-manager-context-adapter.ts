import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'

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
  store.persisted('editor.showVisual', false, `editor.mode.${projectId}`, {
    toPersisted: showVisual => (showVisual ? 'rich-text' : 'source'),
    fromPersisted: mode => mode === 'rich-text',
  })
}
