import { createContext, useContext } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'

export const CodeMirrorStateContext = createContext<EditorState | undefined>(
  undefined
)

export const CodeMirrorViewContext = createContext<EditorView | undefined>(
  undefined
)

export const useCodeMirrorStateContext = (): EditorState => {
  const context = useContext(CodeMirrorStateContext)

  if (!context) {
    throw new Error(
      'useCodeMirrorStateContext is only available inside CodeMirrorStateContext.Provider'
    )
  }

  return context
}

export const useCodeMirrorViewContext = (): EditorView => {
  const context = useContext(CodeMirrorViewContext)

  if (!context) {
    throw new Error(
      'useCodeMirrorViewContext is only available inside CodeMirrorViewContext.Provider'
    )
  }

  return context
}
