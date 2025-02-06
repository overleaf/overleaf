import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import customLocalStorage from '@/infrastructure/local-storage'
import getMeta from '@/utils/meta'

export function populateEditorScope(
  store: ReactScopeValueStore,
  projectId: string
) {
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
    getMeta('ol-usedLatex') === 'never' || showVisualFallbackValue(projectId),
    `editor.lastUsedMode`,
    {
      toPersisted: showVisual => (showVisual ? 'visual' : 'code'),
      fromPersisted: mode => mode === 'visual',
    }
  )

  store.persisted(
    'editor.codeEditorOpened',
    codeEditorOpenedFallbackValue(),
    'editor.codeEditorOpened'
  )
  store.watch('editor.showVisual', showVisual => {
    if (store.get('editor.codeEditorOpened') !== true && showVisual === false) {
      store.set('editor.codeEditorOpened', true)
    }
  })
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

function codeEditorOpenedFallbackValue() {
  const signUpDate = getMeta('ol-user').signUpDate
  if (
    typeof signUpDate === 'string' &&
    new Date(signUpDate) < new Date('2024-08-02')
  ) {
    // if signUpDate is before releasing "codeEditorOpened" value
    // it is assumed that the user has opened the code editor at some point
    return true
  }
  return false
}
