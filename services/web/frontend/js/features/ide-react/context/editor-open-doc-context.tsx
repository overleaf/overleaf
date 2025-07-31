import {
  createContext,
  Dispatch,
  FC,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from 'react'
import { DocId } from '../../../../../types/project-settings'
import useExposedState from '@/shared/hooks/use-exposed-state'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'

export interface EditorOpenDocContextState {
  currentDocumentId: DocId | null
  openDocName: string | null
  currentDocument: DocumentContainer | null
}

interface EditorOpenDocContextValue extends EditorOpenDocContextState {
  setCurrentDocumentId: Dispatch<SetStateAction<DocId | null>>
  setOpenDocName: Dispatch<SetStateAction<string | null>>
  setCurrentDocument: Dispatch<SetStateAction<DocumentContainer | null>>
}

export const EditorOpenDocContext = createContext<
  EditorOpenDocContextValue | undefined
>(undefined)

export const EditorOpenDocProvider: FC<PropsWithChildren> = ({ children }) => {
  const [currentDocumentId, setCurrentDocumentId] =
    useExposedState<DocId | null>(null, 'editor.open_doc_id')
  const [openDocName, setOpenDocName] = useExposedState<string | null>(
    null,
    'editor.open_doc_name'
  )
  const [currentDocument, setCurrentDocument] =
    useState<DocumentContainer | null>(null)

  const value = {
    currentDocumentId,
    setCurrentDocumentId,
    openDocName,
    setOpenDocName,
    currentDocument,
    setCurrentDocument,
  }

  return (
    <EditorOpenDocContext.Provider value={value}>
      {children}
    </EditorOpenDocContext.Provider>
  )
}

export const useEditorOpenDocContext = (): EditorOpenDocContextValue => {
  const context = useContext(EditorOpenDocContext)

  if (!context) {
    throw new Error(
      'useEditorOpenDocContext is only available inside EditorOpenDocContext.Provider'
    )
  }

  return context
}
