import {
  createContext,
  Dispatch,
  FC,
  PropsWithChildren,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import customLocalStorage from '@/infrastructure/local-storage'
import getMeta from '@/utils/meta'
import { useUnstableStoreSync } from '@/shared/hooks/use-unstable-store-sync'
import { sendMB } from '@/infrastructure/event-tracking'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { getVisualEditorStorageKey } from '@/features/source-editor/utils/visual-editor'

// Context value type
export type EditorPropertiesContextValue = {
  showVisual: boolean
  setShowVisual: Dispatch<SetStateAction<boolean>>
  showVisualForFile: (filename: string) => boolean
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

function migrateTexVisualMode(): boolean {
  const projectId = getMeta('ol-project_id')
  const editorModeKey = `editor.mode.${projectId}`
  const editorModeVal = customLocalStorage.getItem(editorModeKey)

  if (editorModeVal) {
    customLocalStorage.removeItem(editorModeKey)
    return editorModeVal === 'rich-text'
  }

  return false
}

export function showVisualForFile(filename: string): boolean {
  const key = getVisualEditorStorageKey(filename)
  const stored = customLocalStorage.getItem(key)
  if (stored !== null) {
    return stored === 'visual'
  }
  if (key === 'editor.lastUsedMode') {
    return migrateTexVisualMode()
  }
  // A module-provided visual editor (e.g. the SVG diagram canvas editor)
  // is the product default for the file types it claims — unless the user
  // has explicitly chosen the code editor for that family (stored above).
  return true
}

export const EditorPropertiesProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const { openDocName } = useEditorOpenDocContext()

  const [showVisual, setShowVisualState] = useState(() =>
    openDocName != null ? showVisualForFile(openDocName) : false
  )

  useEffect(() => {
    setShowVisualState(
      openDocName != null ? showVisualForFile(openDocName) : false
    )
  }, [openDocName])

  const setShowVisual: Dispatch<SetStateAction<boolean>> = useCallback(
    value => {
      setShowVisualState(prev => {
        const actual = typeof value === 'function' ? value(prev) : value
        if (openDocName != null) {
          const key = getVisualEditorStorageKey(openDocName)
          customLocalStorage.setItem(key, actual ? 'visual' : 'code')
        }
        return actual
      })
    },
    [openDocName]
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
    showVisualForFile,
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
