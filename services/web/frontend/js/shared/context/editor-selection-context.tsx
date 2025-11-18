import {
  createContext,
  type Dispatch,
  type FC,
  type PropsWithChildren,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { EditorSelection } from '@codemirror/state'

export const EditorSelectionContext = createContext<
  | {
      editorSelection: EditorSelection | undefined
      setEditorSelection: Dispatch<SetStateAction<EditorSelection | undefined>>
    }
  | undefined
>(undefined)

export const EditorSelectionProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const [editorSelection, setEditorSelection] = useState<EditorSelection>()

  const value = useMemo(() => {
    return { editorSelection, setEditorSelection }
  }, [editorSelection])

  return (
    <EditorSelectionContext.Provider value={value}>
      {children}
    </EditorSelectionContext.Provider>
  )
}

export const useEditorSelectionContext = () => {
  const context = useContext(EditorSelectionContext)

  if (!context) {
    throw new Error(
      'useEditorSelectionContext is only available inside EditorSelectionProvider'
    )
  }

  return context
}
