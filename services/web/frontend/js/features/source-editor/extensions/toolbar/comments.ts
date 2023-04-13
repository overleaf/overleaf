import { EditorState } from '@codemirror/state'

export const canAddComment = (state: EditorState) => {
  // TODO: permissions.comment

  // allow an empty selection if there's content on the line
  const range = state.selection.main
  if (range.empty) {
    return state.doc.lineAt(range.head).text.length > 0
  }

  // always allow a non-empty selection
  return true
}
