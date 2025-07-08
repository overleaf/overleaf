import {
  createContext,
  Dispatch,
  FC,
  PropsWithChildren,
  SetStateAction,
  useCallback,
  useContext,
  useState,
} from 'react'
import customLocalStorage from '@/infrastructure/local-storage'
import usePersistedState from '@/shared/hooks/use-persisted-state'
import getMeta from '@/utils/meta'
import { useUnstableStoreSync } from '@/shared/hooks/use-unstable-store-sync'
import { sendMB } from '@/infrastructure/event-tracking'

// Context value type
export type EditorPropertiesContextValue = {
  showVisual: boolean
  setShowVisual: Dispatch<SetStateAction<boolean>>
  showSymbolPalette: boolean
  setShowSymbolPalette: Dispatch<SetStateAction<boolean>>
  toggleSymbolPalette: () => void
  opening: boolean
  setOpening: Dispatch<SetStateAction<boolean>>
  trackChanges: boolean
  setTrackChanges: Dispatch<SetStateAction<boolean>>
  wantTrackChanges: boolean
  setWantTrackChanges: Dispatch<SetStateAction<boolean>>
  errorState: boolean
  setErrorState: Dispatch<SetStateAction<boolean>>
}

export const EditorPropertiesContext = createContext<
  EditorPropertiesContextValue | undefined
>(undefined)

function showVisualFallbackValue() {
  const projectId = getMeta('ol-project_id')
  const editorModeKey = `editor.mode.${projectId}`
  const editorModeVal = customLocalStorage.getItem(editorModeKey)

  if (editorModeVal) {
    // clean up the old key
    customLocalStorage.removeItem(editorModeKey)
  }

  return editorModeVal === 'rich-text'
}

export const EditorPropertiesProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const [showVisual, setShowVisual] = usePersistedState(
    `editor.lastUsedMode`,
    showVisualFallbackValue(),
    {
      converter: {
        toPersisted: showVisual => (showVisual ? 'visual' : 'code'),
        fromPersisted: mode => mode === 'visual',
      },
    }
  )

  // Sync the showVisual state with the exposed store
  useUnstableStoreSync('editor.showVisual', showVisual)

  const [showSymbolPalette, setShowSymbolPalette] = useState(false)

  const toggleSymbolPalette = useCallback(() => {
    setShowSymbolPalette(show => {
      const newValue = !show
      sendMB(newValue ? 'symbol-palette-show' : 'symbol-palette-hide')
      return newValue
    })
  }, [setShowSymbolPalette])

  const [opening, setOpening] = useState(true)
  const [trackChanges, setTrackChanges] = useState(false)
  const [wantTrackChanges, setWantTrackChanges] = useState(false)
  const [errorState, setErrorState] = useState(false)

  const value = {
    showVisual,
    setShowVisual,
    showSymbolPalette,
    setShowSymbolPalette,
    toggleSymbolPalette,
    opening,
    setOpening,
    trackChanges,
    setTrackChanges,
    wantTrackChanges,
    setWantTrackChanges,
    errorState,
    setErrorState,
  }

  return (
    <EditorPropertiesContext.Provider value={value}>
      {children}
    </EditorPropertiesContext.Provider>
  )
}

export const useEditorPropertiesContext = (): EditorPropertiesContextValue => {
  const context = useContext(EditorPropertiesContext)
  if (!context) {
    throw new Error(
      'useEditorPropertiesContext is only available inside EditorPropertiesContext.Provider'
    )
  }
  return context
}
