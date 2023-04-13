import { EditorView, ViewPlugin } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { findDocumentEnvironment } from '../../utils/tree-operations/environments'
import { syntaxTree } from '@codemirror/language'
export const skipPreambleWithCursor = ViewPlugin.define((view: EditorView) => {
  let checkedOnce = false
  return {
    update(update) {
      if (
        !checkedOnce &&
        syntaxTree(update.state).length === update.state.doc.length
      ) {
        checkedOnce = true

        // Only move the cursor if we're at the default position (0). Otherwise
        // switching back and forth between source/RT while editing the preamble
        // would be annoying.
        if (
          update.view.state.selection.eq(
            EditorSelection.create([EditorSelection.cursor(0)])
          )
        ) {
          setTimeout(() => {
            const position = findDocumentEnvironment(view.state)
            view.dispatch({
              selection: EditorSelection.cursor(
                Math.min(position ? position + 1 : 0, update.state.doc.length)
              ),
            })
          }, 0)
        }
      }
    },
  }
})
