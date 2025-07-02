import {
  createContext,
  Dispatch,
  FC,
  PropsWithChildren,
  SetStateAction,
  useContext,
} from 'react'
import { EditorView } from '@codemirror/view'
import useExposedState from '@/shared/hooks/use-exposed-state'

export type EditorContextValue = {
  view: EditorView | null
  setView: Dispatch<SetStateAction<EditorView | null>>
}

// This provides access to the CodeMirror EditorView instance outside the editor
// component itself, including external extensions (in particular, Writefull)
export const EditorViewContext = createContext<EditorContextValue | undefined>(
  undefined
)

export const EditorViewProvider: FC<PropsWithChildren> = ({ children }) => {
  const [view, setView] = useExposedState<EditorView | null>(
    null,
    'editor.view'
  )

  const value = {
    view,
    setView,
  }

  return (
    <EditorViewContext.Provider value={value}>
      {children}
    </EditorViewContext.Provider>
  )
}

export const useEditorViewContext = (): EditorContextValue => {
  const context = useContext(EditorViewContext)
  if (!context) {
    throw new Error(
      'useEditorViewContext is only available inside EditorViewProvider'
    )
  }
  return context
}
