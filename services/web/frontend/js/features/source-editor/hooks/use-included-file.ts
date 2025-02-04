import { useCodeMirrorStateContext } from '@/features/source-editor/components/codemirror-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { resolveCommandNode } from '@/features/source-editor/extensions/command-tooltip'
import {
  FilePathArgument,
  LiteralArgContent,
} from '@/features/source-editor/lezer-latex/latex.terms.mjs'

export const useIncludedFile = (argumentType: string) => {
  const state = useCodeMirrorStateContext()
  const { findEntityByPath } = useFileTreePathContext()
  const { openDocWithId } = useEditorManagerContext()

  const openIncludedFile = useCallback(() => {
    const name = readIncludedPath(state, argumentType)
    if (name) {
      // TODO: find in relative path or root folder
      for (const extension of ['.tex', '']) {
        const result = findEntityByPath(`${name}${extension}`)
        if (result) {
          return openDocWithId(result.entity._id)
        }
      }
      // TODO: handle file not found
    }
  }, [argumentType, findEntityByPath, openDocWithId, state])

  return { openIncludedFile }
}

const readIncludedPath = (
  state: EditorState,
  argumentType: string | number
) => {
  const commandNode = resolveCommandNode(state)
  const argumentNode = commandNode
    ?.getChild(argumentType)
    ?.getChild(FilePathArgument)
    ?.getChild(LiteralArgContent)

  if (argumentNode) {
    return state.sliceDoc(argumentNode.from, argumentNode.to)
  }
}
