import { EditorView } from '@codemirror/view'
import { startCompletion } from '@codemirror/autocomplete'
import { Transaction } from '@codemirror/state'
import { isInEmptyArgumentNodeForAutocomplete } from '../../utils/tree-query'

// start autocompletion when the cursor enters an empty pair of braces
export const openAutocomplete = () => {
  return EditorView.updateListener.of(update => {
    if (update.selectionSet || update.docChanged) {
      if (!update.transactions.some(tr => tr.annotation(Transaction.remote))) {
        if (isInEmptyArgumentNodeForAutocomplete(update.state)) {
          startCompletion(update.view)
        }
      }
    }
  })
}
