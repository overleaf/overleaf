import { EditorView } from '@codemirror/view'
import { startCompletion } from '@codemirror/autocomplete'
import { ancestorNodeOfType } from '@/features/source-editor/utils/tree-operations/ancestors'
import { containsDOI } from '../utils/doi'

// open autocomplete when a DOI is pasted into a \cite argument
export const autocompleteOnPaste = EditorView.domEventHandlers({
  paste(event, view) {
    const text = event.clipboardData?.getData('text/plain')
    if (text && containsDOI(text)) {
      const node = ancestorNodeOfType(
        view.state,
        view.state.selection.main.from,
        'BibKeyArgument',
        -1
      )

      if (node) {
        // allow time for the pasted content to appear in the state
        window.setTimeout(() => {
          startCompletion(view)
        })
      }
    }
  },
})
