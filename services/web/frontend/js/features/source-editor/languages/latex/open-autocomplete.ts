import { EditorView } from '@codemirror/view'
import { startCompletion } from '@codemirror/autocomplete'
import { Transaction } from '@codemirror/state'
import { isInEmptyArgumentNodeForAutocomplete } from '../../utils/tree-query'
import { openContextMenuAnnotation } from '../../extensions/context-menu'

// start autocompletion when the cursor enters an empty pair of braces
// but skip updates caused by context menu open or remote transactions
export const openAutocomplete = () => {
  return EditorView.updateListener.of(update => {
    if (update.selectionSet || update.docChanged) {
      if (
        !update.transactions.some(
          tr =>
            tr.annotation(Transaction.remote) ||
            tr.annotation(openContextMenuAnnotation)
        )
      ) {
        if (isInEmptyArgumentNodeForAutocomplete(update.state)) {
          startCompletion(update.view)
        }
      }
    }
  })
}
