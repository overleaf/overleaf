import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { SyntaxNode } from '@lezer/common'

export const selectNode = (view: EditorView, node: SyntaxNode) => {
  view.dispatch({
    selection: EditorSelection.single(node.from + 1, node.to - 1),
    scrollIntoView: true,
  })
}
